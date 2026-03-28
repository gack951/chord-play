import { describe, expect, it } from 'vitest';
import { calculateTapTempo, normalizeTapHistory, TAP_TEMPO_TIMEOUT_MS } from '../src/music/tapTempo';

describe('tap tempo', () => {
  it('returns null until there are at least two taps', () => {
    expect(calculateTapTempo([1000])).toBeNull();
  });

  it('calculates bpm from average intervals', () => {
    expect(calculateTapTempo([0, 500, 1000, 1500])).toBe(120);
    expect(calculateTapTempo([0, 400, 800, 1200])).toBe(150);
  });

  it('drops stale taps and keeps only recent history', () => {
    const history = normalizeTapHistory([0, 500, 1000], 1000 + TAP_TEMPO_TIMEOUT_MS + 1);
    expect(history).toEqual([1000 + TAP_TEMPO_TIMEOUT_MS + 1]);
  });
});
