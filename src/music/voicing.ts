import type { ParsedBar } from '../types/music';
import type { PlaybackMode, RegisterName } from '../types/app';
import { noteNameToMidi, placePitchClassAtOrAbove, pitchClassToSemitone } from './note';

export interface ChordEvent {
  startBeat: number;
  durationBeats: number;
  midi: number[];
  chordLabel: string;
  sourceToken: string;
}

const RELEASE_GAP_BEATS = 0.125;

interface TimedSlot {
  token: string;
  chord: ParsedBar['slots'][number]['chord'];
  actualStartBeat: number;
  actualEndBeat: number;
  isRepeat: boolean;
}

function averageMidi(notes: number[]): number {
  return notes.reduce((sum, note) => sum + note, 0) / notes.length;
}

function scoreVoicing(notes: number[], previousNotes: number[] | null, chordRegisterMidi: number): number {
  const registerTarget = chordRegisterMidi + 5;
  let score = Math.abs(averageMidi(notes) - registerTarget) * 0.35;

  if (!previousNotes || previousNotes.length === 0) {
    score += Math.abs(notes[0] - chordRegisterMidi);
    return score;
  }

  const compareLength = Math.max(notes.length, previousNotes.length);
  for (let index = 0; index < compareLength; index += 1) {
    const note = notes[Math.min(index, notes.length - 1)]!;
    const previousNote = previousNotes[Math.min(index, previousNotes.length - 1)]!;
    score += Math.abs(note - previousNote);
  }

  score += Math.abs(averageMidi(notes) - averageMidi(previousNotes)) * 0.5;
  return score;
}

function buildNearestChordVoicing(
  chordRoot: string,
  intervals: number[],
  chordRegister: RegisterName,
  previousNotes: number[] | null,
): number[] {
  const chordRegisterMidi = noteNameToMidi(chordRegister);
  const rootSemitone = pitchClassToSemitone(chordRoot);
  const rootPosition = intervals.map((interval) => {
    const semitone = (rootSemitone + interval) % 12;
    let note = Math.floor(chordRegisterMidi / 12) * 12 + semitone;
    while (note < chordRegisterMidi) {
      note += 12;
    }
    return note;
  });

  if (!previousNotes || previousNotes.length === 0) {
    return rootPosition;
  }

  const orderedPitchClasses = intervals.map((interval) => (rootSemitone + interval) % 12);
  const candidates: number[][] = [];
  const lowestMin = chordRegisterMidi - 12;
  const lowestMax = chordRegisterMidi + 24;

  orderedPitchClasses.forEach((_, inversionIndex) => {
    const rotated = orderedPitchClasses.slice(inversionIndex).concat(orderedPitchClasses.slice(0, inversionIndex));
    let lowest = Math.floor(lowestMin / 12) * 12 + rotated[0]!;
    while (lowest < lowestMin) {
      lowest += 12;
    }

    for (let candidateLowest = lowest; candidateLowest <= lowestMax; candidateLowest += 12) {
      const notes = [candidateLowest];
      rotated.slice(1).forEach((pitchClass) => {
        let note = Math.floor(notes[notes.length - 1]! / 12) * 12 + pitchClass;
        while (note <= notes[notes.length - 1]!) {
          note += 12;
        }
        notes.push(note);
      });
      candidates.push(notes);
    }
  });

  return candidates.reduce((best, candidate) => {
    if (!best) {
      return candidate;
    }

    return scoreVoicing(candidate, previousNotes, chordRegisterMidi) < scoreVoicing(best, previousNotes, chordRegisterMidi)
      ? candidate
      : best;
  }, candidates[0]!);
}

export function buildChordMidiNotes(
  chordRoot: string,
  intervals: number[],
  bass: string | null,
  bassRegister: RegisterName,
  chordRegister: RegisterName,
  previousChordMidi: number[] | null = null,
): number[] {
  const bassPitch = bass ?? chordRoot;
  const bassMidi = placePitchClassAtOrAbove(bassPitch, noteNameToMidi(bassRegister));
  const chordNotes = buildNearestChordVoicing(chordRoot, intervals, chordRegister, previousChordMidi?.slice(1) ?? null);

  return [bassMidi, ...chordNotes];
}

export function barsToChordEvents(
  bars: ParsedBar[],
  mode: PlaybackMode,
  bassRegister: RegisterName,
  chordRegister: RegisterName,
): ChordEvent[] {
  const events: ChordEvent[] = [];
  const rawTimedSlots: TimedSlot[] = [];
  let previousChordMidi: number[] | null = null;

  bars.forEach((bar, barIndex) => {
    const slotBeats = 4 / bar.slotCount;

    bar.slots.forEach((slot, slotIndex) => {
      const nominalStartBeat = barIndex * 4 + slotIndex * slotBeats;
      const actualStartBeat = Math.max(0, nominalStartBeat - slot.anticipationBeats);
      rawTimedSlots.push({
        token: slot.token,
        chord: slot.chord,
        actualStartBeat,
        actualEndBeat: nominalStartBeat + slotBeats,
        isRepeat: slot.isRepeat,
      });
    });
  });

  const totalBeats = bars.length * 4;
  const mergedSlots: TimedSlot[] = [];

  rawTimedSlots.forEach((slot) => {
    const previousSlot = mergedSlots[mergedSlots.length - 1];
    if (slot.isRepeat && previousSlot && previousSlot.chord) {
      previousSlot.actualEndBeat = Math.max(previousSlot.actualEndBeat, slot.actualEndBeat);
      return;
    }

    mergedSlots.push({ ...slot });
  });

  mergedSlots.forEach((slot, index) => {
    const nextStartBeat = mergedSlots[index + 1]?.actualStartBeat ?? totalBeats;
    const releaseBeat = nextStartBeat - RELEASE_GAP_BEATS;
    slot.actualEndBeat = Math.max(slot.actualStartBeat, Math.min(slot.actualEndBeat, releaseBeat));
  });

  mergedSlots.forEach((slot) => {
    if (!slot.chord) {
      return;
    }

    const chord = slot.chord;
    const startBeat = slot.actualStartBeat;
    const endBeat = slot.actualEndBeat;
    const durationBeats = endBeat - startBeat;
    const midi = buildChordMidiNotes(
      chord.root,
      chord.intervals,
      chord.bass,
      bassRegister,
      chordRegister,
      previousChordMidi,
    );
    previousChordMidi = midi;

    if (mode === 'block') {
      events.push({
        startBeat,
        durationBeats,
        midi,
        chordLabel: chord.label,
        sourceToken: slot.token,
      });
      return;
    }

    const ordered = midi.slice(1);
    if (mode === 'arp-down-8') {
      ordered.reverse();
    } else if (mode === 'arp-updown-8') {
      const body = ordered.slice(1, Math.max(ordered.length - 1, 1)).reverse();
      ordered.push(...body);
    }

    const steps = Math.max(ordered.length, 1);
    const stepDuration = durationBeats / Math.max(steps, 2);

    events.push({
      startBeat,
      durationBeats,
      midi: [midi[0]],
      chordLabel: chord.label,
      sourceToken: slot.token,
    });
    ordered.forEach((note, arpIndex) => {
      const noteStartBeat = startBeat + arpIndex * stepDuration;
      events.push({
        startBeat: noteStartBeat,
        durationBeats: Math.max(endBeat - noteStartBeat, 0),
        midi: [note],
        chordLabel: chord.label,
        sourceToken: slot.token,
      });
    });
  });

  return events;
}
