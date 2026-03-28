const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};

const SEMITONE_TO_NOTE = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export function normalizePitchClass(note: string): string | null {
  if (!(note in NOTE_TO_SEMITONE)) {
    return null;
  }

  return SEMITONE_TO_NOTE[NOTE_TO_SEMITONE[note]];
}

export function pitchClassToSemitone(note: string): number {
  const value = NOTE_TO_SEMITONE[note];

  if (value === undefined) {
    throw new Error(`Unsupported pitch class: ${note}`);
  }

  return value;
}

export function noteNameToMidi(noteName: string): number {
  const match = noteName.match(/^([A-G](?:#|b)?)(-?\d)$/);

  if (!match) {
    throw new Error(`Invalid note name: ${noteName}`);
  }

  const [, pitchClass, octaveText] = match;
  const octave = Number(octaveText);

  return pitchClassToSemitone(pitchClass) + (octave + 1) * 12;
}

export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function placePitchClassAtOrAbove(note: string, registerMidi: number): number {
  const semitone = pitchClassToSemitone(note);
  let midi = Math.floor(registerMidi / 12) * 12 + semitone;

  while (midi < registerMidi) {
    midi += 12;
  }

  return midi;
}
