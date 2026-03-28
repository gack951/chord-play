import type { DrumPattern } from '../types/app';

export interface DrumHit {
  beat: number;
  type: 'kick' | 'snare' | 'hihat' | 'click';
}

export function getDrumHitsForBar(pattern: DrumPattern, barStartBeat: number): DrumHit[] {
  switch (pattern) {
    case 'metronome':
      return [0, 1, 2, 3].map((offset) => ({
        beat: barStartBeat + offset,
        type: offset === 0 ? 'click' : 'hihat',
      }));
    case 'four-on-the-floor':
      return [
        { beat: barStartBeat + 0, type: 'kick' },
        { beat: barStartBeat + 1, type: 'kick' },
        { beat: barStartBeat + 2, type: 'kick' },
        { beat: barStartBeat + 3, type: 'kick' },
        { beat: barStartBeat + 1, type: 'hihat' },
        { beat: barStartBeat + 3, type: 'hihat' },
      ];
    case '8beat':
      return [
        { beat: barStartBeat + 0, type: 'kick' },
        { beat: barStartBeat + 1, type: 'hihat' },
        { beat: barStartBeat + 2, type: 'snare' },
        { beat: barStartBeat + 3, type: 'hihat' },
        { beat: barStartBeat + 0.5, type: 'hihat' },
        { beat: barStartBeat + 1.5, type: 'hihat' },
        { beat: barStartBeat + 2.5, type: 'hihat' },
        { beat: barStartBeat + 3.5, type: 'hihat' },
      ];
    case '16beat':
      return Array.from({ length: 16 }, (_, index) => ({
        beat: barStartBeat + index * 0.25,
        type: index % 8 === 0 ? 'kick' : index % 8 === 4 ? 'snare' : 'hihat',
      }));
  }
}
