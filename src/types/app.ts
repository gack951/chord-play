export const PLAYBACK_MODES = ['block', 'arp-up-8', 'arp-down-8', 'arp-updown-8'] as const;
export type PlaybackMode = (typeof PLAYBACK_MODES)[number];

export const DRUM_PATTERNS = ['metronome', 'four-on-the-floor', '8beat', '16beat'] as const;
export type DrumPattern = (typeof DRUM_PATTERNS)[number];

export const OSCILLATOR_TYPES = ['sine', 'triangle', 'square', 'sawtooth'] as const;
export type OscillatorTypeId = (typeof OSCILLATOR_TYPES)[number];

export type RegisterName =
  | 'C2'
  | 'D2'
  | 'E2'
  | 'F2'
  | 'G2'
  | 'A2'
  | 'B2'
  | 'C3'
  | 'D3'
  | 'E3'
  | 'F3'
  | 'G3'
  | 'A3'
  | 'B3'
  | 'C4'
  | 'D4'
  | 'E4'
  | 'F4'
  | 'G4'
  | 'A4'
  | 'B4'
  | 'C5';

export interface SynthPreset {
  id: string;
  name: string;
  waveform: OscillatorTypeId;
  filterCutoff: number;
  attack: number;
  release: number;
}

export interface SongSettings {
  bpm: number;
  playbackMode: PlaybackMode;
  drumPattern: DrumPattern;
  synthPresetId: string;
  bassRegister: RegisterName;
  chordRegister: RegisterName;
  masterVolume: number;
  chordVolume: number;
  drumVolume: number;
}

export interface Song extends SongSettings {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  progressionText: string;
}

export interface AppState {
  songs: Song[];
  currentSongId: string;
  synthPresets: SynthPreset[];
}
