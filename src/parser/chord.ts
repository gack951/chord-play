import type { ParsedChord } from '../types/music';
import { normalizePitchClass } from '../music/note';

const ROOT_RE = /^([A-G](?:#|b)?)(.*)$/;
const PARENS_RE = /\(([^)]+)\)/g;

function addUnique(intervals: number[], interval: number): void {
  if (!intervals.includes(interval)) {
    intervals.push(interval);
  }
}

function replaceInterval(intervals: number[], from: number, to: number): void {
  const index = intervals.indexOf(from);
  if (index >= 0) {
    intervals.splice(index, 1, to);
    return;
  }

  addUnique(intervals, to);
}

function applyTension(intervals: number[], tension: string): boolean {
  const normalized = tension.trim();
  const map: Record<string, number> = {
    b9: 13,
    '9': 14,
    '#9': 15,
    '11': 17,
    '#11': 18,
    b13: 20,
    '13': 21,
  };
  const interval = map[normalized];

  if (interval === undefined) {
    return false;
  }

  addUnique(intervals, interval);
  return true;
}

export function parseChordSymbol(symbol: string): ParsedChord {
  const slashParts = symbol.split('/');
  if (slashParts.length > 2) {
    throw new Error('スラッシュコードの形式が不正です');
  }

  const [mainPart, bassPart] = slashParts;
  const rootMatch = mainPart.match(ROOT_RE);

  if (!rootMatch) {
    throw new Error('コードのルートを解釈できません');
  }

  const root = normalizePitchClass(rootMatch[1]);
  if (!root) {
    throw new Error('ルート音が不正です');
  }

  const bass = bassPart ? normalizePitchClass(bassPart) : null;
  if (bassPart && !bass) {
    throw new Error('ベース音が不正です');
  }

  let quality: ParsedChord['quality'] = 'major';
  let suffix = rootMatch[2];
  const tensions: string[] = [];

  suffix = suffix.replace(PARENS_RE, (_match, value: string) => {
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => tensions.push(item));
    return '';
  });

  if (suffix.includes('sus2')) {
    quality = 'suspended2';
    suffix = suffix.replace('sus2', '');
  } else if (suffix.includes('sus4') || suffix.includes('sus')) {
    quality = 'suspended4';
    suffix = suffix.replace('sus4', '').replace('sus', '');
  } else if (suffix.includes('dim')) {
    quality = 'diminished';
    suffix = suffix.replace('dim', '');
  } else if (suffix.includes('aug')) {
    quality = 'augmented';
    suffix = suffix.replace('aug', '');
  } else if (suffix.startsWith('m') && !suffix.startsWith('maj')) {
    quality = 'minor';
    suffix = suffix.slice(1);
  }

  const intervals: number[] = [0];
  switch (quality) {
    case 'major':
      intervals.push(4, 7);
      break;
    case 'minor':
      intervals.push(3, 7);
      break;
    case 'diminished':
      intervals.push(3, 6);
      break;
    case 'augmented':
      intervals.push(4, 8);
      break;
    case 'suspended2':
      intervals.push(2, 7);
      break;
    case 'suspended4':
      intervals.push(5, 7);
      break;
  }

  if (suffix.includes('maj7')) {
    addUnique(intervals, 11);
    suffix = suffix.replace('maj7', '');
  } else if (suffix.includes('7')) {
    addUnique(intervals, 10);
    suffix = suffix.replace('7', '');
  }

  if (suffix.includes('6')) {
    addUnique(intervals, 9);
    suffix = suffix.replace('6', '');
  }

  if (suffix.includes('add9')) {
    addUnique(intervals, 14);
    suffix = suffix.replace('add9', '');
  }

  if (suffix.includes('-5')) {
    replaceInterval(intervals, 7, 6);
    replaceInterval(intervals, 8, 6);
    suffix = suffix.replace('-5', '');
  }

  if (suffix.includes('b5')) {
    replaceInterval(intervals, 7, 6);
    replaceInterval(intervals, 8, 6);
    suffix = suffix.replace('b5', '');
  }

  const directTensions = ['13', '11', '9'];
  for (const direct of directTensions) {
    if (suffix.includes(direct)) {
      tensions.push(direct);
      suffix = suffix.replace(direct, '');
    }
  }

  if (suffix.trim().length > 0) {
    throw new Error(`未対応のコード修飾子です: ${suffix.trim()}`);
  }

  for (const tension of tensions) {
    if (!applyTension(intervals, tension)) {
      throw new Error(`未対応のテンションです: ${tension}`);
    }
  }

  intervals.sort((a, b) => a - b);

  return {
    raw: symbol,
    root,
    bass,
    quality,
    intervals,
    label: symbol,
  };
}
