import { describe, expect, it } from 'vitest';
import { Transport } from '../src/audio/transport';

describe('Transport', () => {
  it('handles play, pause, resume, stop', () => {
    const transport = new Transport(120);
    transport.play(10);
    expect(transport.getSnapshot(10).state).toBe('playing');
    expect(transport.getCurrentBeat(11)).toBeCloseTo(2, 4);

    transport.pause(11);
    expect(transport.getSnapshot(11).state).toBe('paused');
    expect(transport.getCurrentBeat(12)).toBeCloseTo(2, 4);

    transport.resume(12);
    expect(transport.getSnapshot(12).state).toBe('playing');
    expect(transport.getCurrentBeat(13)).toBeCloseTo(4, 4);

    transport.stop();
    expect(transport.getSnapshot(13).state).toBe('stopped');
    expect(transport.getCurrentBeat(13)).toBe(0);
  });

  it('syncs to nearest bar boundary', () => {
    const transport = new Transport(120);
    transport.play(0);
    transport.syncToNearestBar(2.1);
    expect(transport.getCurrentBeat(2.1)).toBe(4);
  });

  it('cues to a selected bar and resumes from there', () => {
    const transport = new Transport(120);
    transport.cueToBar(3);
    expect(transport.getSnapshot(0).state).toBe('paused');
    expect(transport.getCurrentBeat(0)).toBe(8);
    expect(transport.getSnapshot(0).currentBar).toBe(3);

    transport.resume(10);
    expect(transport.getSnapshot(10).state).toBe('playing');
    expect(transport.getCurrentBeat(11)).toBeCloseTo(10, 4);
  });
});
