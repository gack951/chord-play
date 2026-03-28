export interface ParsedChord {
  raw: string;
  root: string;
  bass: string | null;
  quality: 'major' | 'minor' | 'diminished' | 'augmented' | 'suspended2' | 'suspended4';
  intervals: number[];
  label: string;
}

export interface Slot {
  token: string;
  kind: 'chord' | 'rest';
  chord: ParsedChord | null;
  sourceTokenIndex: number;
  anticipationBeats: number;
}

export interface ParsedBar {
  index: number;
  raw: string;
  tokens: string[];
  slots: Slot[];
  slotCount: number;
}

export interface ParseIssue {
  barIndex: number;
  tokenIndex?: number;
  token?: string;
  message: string;
}

export interface ProgressionParseResult {
  bars: ParsedBar[];
  issues: ParseIssue[];
  validBars: ParsedBar[];
}
