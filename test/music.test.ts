import { describe, expect, it } from 'vitest';
import { buildChordMidiNotes, barsToChordEvents } from '../src/music/voicing';
import { parseProgression } from '../src/parser/progression';

describe('music voicing', () => {
  it('builds midi notes from register choices', () => {
    const midi = buildChordMidiNotes('C', [0, 4, 7], null, 'C3', 'C4');
    expect(midi[0]).toBe(48);
    expect(midi[1]).toBe(60);
  });

  it('chooses an inversion close to the previous chord height', () => {
    const cMajor = buildChordMidiNotes('C', [0, 4, 7], null, 'C3', 'C4');
    const gMajor = buildChordMidiNotes('G', [0, 4, 7], null, 'C3', 'C4', cMajor);
    const rootPositionG = buildChordMidiNotes('G', [0, 4, 7], null, 'C3', 'C4');

    const movementWithVoiceLeading = gMajor
      .slice(1)
      .reduce((sum, note, index) => sum + Math.abs(note - cMajor[index + 1]!), 0);
    const movementWithoutVoiceLeading = rootPositionG
      .slice(1)
      .reduce((sum, note, index) => sum + Math.abs(note - cMajor[index + 1]!), 0);

    expect(movementWithVoiceLeading).toBeLessThan(movementWithoutVoiceLeading);
  });

  it('creates arpeggio events', () => {
    const parsed = parseProgression('C | G');
    const events = barsToChordEvents(parsed.validBars, 'arp-up-8', 'C3', 'C4');
    expect(events.length).toBeGreaterThan(2);
    expect(events[0]?.midi).toHaveLength(1);
    expect(events[0]?.chordLabel).toBe('C');
    expect(events[0]?.sourceToken).toBe('C');
  });

  it('shifts anticipated chords 0.5 beats early and extends durations', () => {
    const parsed = parseProgression("C 'F | 'B E");
    const events = barsToChordEvents(parsed.validBars, 'block', 'C3', 'C4');

    const chordEvents = events.filter((event) => event.midi.length > 1);
    expect(chordEvents[0]?.startBeat).toBe(0);
    expect(chordEvents[0]?.durationBeats).toBe(1.375);
    expect(chordEvents[1]?.startBeat).toBe(1.5);
    expect(chordEvents[1]?.durationBeats).toBe(1.875);
    expect(chordEvents[2]?.startBeat).toBe(3.5);
    expect(chordEvents[2]?.durationBeats).toBe(2.375);
    expect(chordEvents[3]?.startBeat).toBe(6);
    expect(chordEvents[3]?.durationBeats).toBe(1.875);
  });

  it('sustains until just before the next rest', () => {
    const parsed = parseProgression('C N.C.');
    const events = barsToChordEvents(parsed.validBars, 'block', 'C3', 'C4');
    const chordEvent = events.find((event) => event.midi.length > 1);

    expect(chordEvent?.startBeat).toBe(0);
    expect(chordEvent?.durationBeats).toBe(1.875);
  });

  it('merges trailing repeats into a longer sustain but keeps explicit duplicate chords separated', () => {
    const repeated = barsToChordEvents(parseProgression('A B C %').validBars, 'block', 'C3', 'C4');
    const explicit = barsToChordEvents(parseProgression('A B C C').validBars, 'block', 'C3', 'C4');

    const repeatedChordEvents = repeated.filter((event) => event.midi.length > 1);
    const explicitChordEvents = explicit.filter((event) => event.midi.length > 1);

    expect(repeatedChordEvents).toHaveLength(3);
    expect(repeatedChordEvents[2]?.chordLabel).toBe('C');
    expect(repeatedChordEvents[2]?.durationBeats).toBe(1.875);

    expect(explicitChordEvents).toHaveLength(4);
    expect(explicitChordEvents[2]?.durationBeats).toBe(0.875);
    expect(explicitChordEvents[3]?.durationBeats).toBe(0.875);
  });

  it('extends anticipated chords across following repeat slots', () => {
    const parsed = parseProgression("C 'F % %");
    const events = barsToChordEvents(parsed.validBars, 'block', 'C3', 'C4');
    const chordEvents = events.filter((event) => event.midi.length > 1);

    expect(chordEvents).toHaveLength(2);
    expect(chordEvents[1]?.chordLabel).toBe('F');
    expect(chordEvents[1]?.startBeat).toBe(0.5);
    expect(chordEvents[1]?.durationBeats).toBe(3.375);
  });
});
