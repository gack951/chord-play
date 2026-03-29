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
}

export function buildChordMidiNotes(
  chordRoot: string,
  intervals: number[],
  bass: string | null,
  bassRegister: RegisterName,
  chordRegister: RegisterName,
): number[] {
  const chordBase = placePitchClassAtOrAbove(chordRoot, noteNameToMidi(chordRegister));
  const bassPitch = bass ?? chordRoot;
  const bassMidi = placePitchClassAtOrAbove(bassPitch, noteNameToMidi(bassRegister));
  const rootSemitone = pitchClassToSemitone(chordRoot);

  const chordNotes = intervals.map((interval) => {
    const semitone = (rootSemitone + interval) % 12;
    let note = Math.floor(chordBase / 12) * 12 + semitone;
    while (note < chordBase) {
      note += 12;
    }
    return note;
  });

  return [bassMidi, ...chordNotes];
}

export function barsToChordEvents(
  bars: ParsedBar[],
  mode: PlaybackMode,
  bassRegister: RegisterName,
  chordRegister: RegisterName,
): ChordEvent[] {
  const events: ChordEvent[] = [];
  const timedSlots: TimedSlot[] = [];

  bars.forEach((bar, barIndex) => {
    const slotBeats = 4 / bar.slotCount;

    bar.slots.forEach((slot, slotIndex) => {
      const nominalStartBeat = barIndex * 4 + slotIndex * slotBeats;
      const actualStartBeat = Math.max(0, nominalStartBeat - slot.anticipationBeats);
      timedSlots.push({
        token: slot.token,
        chord: slot.chord,
        actualStartBeat,
        actualEndBeat: nominalStartBeat + slotBeats,
      });
    });
  });

  const totalBeats = bars.length * 4;
  timedSlots.forEach((slot, index) => {
    const nextStartBeat = timedSlots[index + 1]?.actualStartBeat ?? totalBeats;
    const releaseBeat = nextStartBeat - RELEASE_GAP_BEATS;
    slot.actualEndBeat = Math.max(slot.actualStartBeat, releaseBeat);
  });

  timedSlots.forEach((slot) => {
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
    );

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
