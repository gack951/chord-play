import { DEFAULT_SYNTH_PRESET_ID, createDefaultSynthPreset, normalizeSynthPresetName } from '../audio/synthPresets';
import type { AppState, Song, SongSettings, SynthPreset } from '../types/app';

export const CACHE_KEY = 'chord-play-cache-v2';
export const EXPORT_SCHEMA_VERSION = 2;

const LEGACY_EXPORT_SCHEMA_VERSION = 1;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export const DEFAULT_SETTINGS: SongSettings = {
  bpm: 120,
  playbackMode: 'block',
  drumPattern: 'metronome',
  synthPresetId: DEFAULT_SYNTH_PRESET_ID,
  bassRegister: 'C3',
  chordRegister: 'C4',
  masterVolume: 0.8,
  chordVolume: 0.75,
  drumVolume: 0.65,
};

export interface ExportBundle {
  schemaVersion: number;
  exportedAt: string;
  songs: Song[];
  synthPresets: SynthPreset[];
}

interface CacheEnvelope {
  cachedAt: string;
  state: AppState;
}

interface LegacySong extends Omit<Song, 'synthPresetId'> {
  instrument?: string;
}

interface LegacyExportBundle {
  schemaVersion: number;
  exportedAt?: string;
  songs: LegacySong[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

function buildPresetMap(synthPresets: SynthPreset[]): Map<string, SynthPreset> {
  return new Map(synthPresets.map((preset) => [preset.id, preset]));
}

function repairSongPresetReference(song: Song, synthPresets: SynthPreset[]): Song {
  if (buildPresetMap(synthPresets).has(song.synthPresetId)) {
    return song;
  }

  return {
    ...song,
    synthPresetId: synthPresets[0]?.id ?? DEFAULT_SYNTH_PRESET_ID,
  };
}

function normalizeSynthPresets(input: unknown): SynthPreset[] {
  if (!Array.isArray(input) || input.length === 0) {
    return [createDefaultSynthPreset()];
  }

  const presets = input.map((preset) => validateSynthPreset(preset));
  const presetMap = buildPresetMap(presets);
  if (!presetMap.has(DEFAULT_SYNTH_PRESET_ID)) {
    presets.unshift(createDefaultSynthPreset());
  }
  return presets;
}

function normalizeSong(input: unknown): Song {
  if (!isRecord(input)) {
    throw new Error('Song object が必要です');
  }

  return {
    id: String(input.id ?? ''),
    title: String(input.title ?? ''),
    createdAt: String(input.createdAt ?? ''),
    updatedAt: String(input.updatedAt ?? ''),
    progressionText: String(input.progressionText ?? ''),
    bpm: Number(input.bpm),
    playbackMode: String(input.playbackMode ?? ''),
    drumPattern: String(input.drumPattern ?? ''),
    synthPresetId:
      typeof input.synthPresetId === 'string' && input.synthPresetId !== ''
        ? input.synthPresetId
        : DEFAULT_SYNTH_PRESET_ID,
    bassRegister: String(input.bassRegister ?? ''),
    chordRegister: String(input.chordRegister ?? ''),
    masterVolume: Number(input.masterVolume),
    chordVolume: Number(input.chordVolume),
    drumVolume: Number(input.drumVolume),
  } as Song;
}

export function defaultSongTitle(now = new Date()): string {
  return now.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function generateSongId(): string {
  const cryptoApi = globalThis.crypto as { randomUUID?: () => string } | undefined;

  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36);
  return `song-${timePart}-${randomPart}`;
}

export function generateSynthPresetId(): string {
  return `preset-${generateSongId()}`;
}

export function createSong(seed?: Partial<Song>): Song {
  const now = new Date().toISOString();
  return {
    id: generateSongId(),
    title: defaultSongTitle(),
    progressionText: 'C | Am | F | G',
    createdAt: now,
    updatedAt: now,
    ...DEFAULT_SETTINGS,
    ...seed,
  };
}

export function createInitialState(now = new Date().toISOString()): AppState {
  const synthPresets = [createDefaultSynthPreset()];
  const song = createSong({ createdAt: now, updatedAt: now });
  return {
    updatedAt: now,
    songs: [song],
    currentSongId: song.id,
    synthPresets,
  };
}

export function validateSynthPreset(input: unknown): SynthPreset {
  if (!isRecord(input)) {
    throw new Error('SynthPreset object が必要です');
  }

  const preset = input as Record<string, unknown>;
  if (typeof preset.id !== 'string' || preset.id === '') {
    throw new Error('SynthPreset.id が不正です');
  }
  if (typeof preset.name !== 'string' || preset.name === '') {
    throw new Error('SynthPreset.name が不正です');
  }
  if (!['sine', 'triangle', 'square', 'sawtooth'].includes(String(preset.waveform))) {
    throw new Error('SynthPreset.waveform が不正です');
  }

  return {
    id: preset.id,
    name: normalizeSynthPresetName(preset.name),
    waveform: preset.waveform as SynthPreset['waveform'],
    filterCutoff: clampNumber(Number(preset.filterCutoff), 120, 12000, 3200),
    attack: clampNumber(Number(preset.attack), 0, 2, 0.01),
    release: clampNumber(Number(preset.release), 0.001, 2, 0.005),
  };
}

export function validateSong(input: unknown): Song {
  const song = normalizeSong(input);
  const requiredStrings = ['id', 'title', 'createdAt', 'updatedAt', 'progressionText'] as const;

  requiredStrings.forEach((key) => {
    if (typeof song[key] !== 'string' || song[key] === '') {
      throw new Error(`Song.${key} が不正です`);
    }
  });

  const requiredNumbers = ['bpm', 'masterVolume', 'chordVolume', 'drumVolume'] as const;
  requiredNumbers.forEach((key) => {
    if (typeof song[key] !== 'number' || Number.isNaN(song[key])) {
      throw new Error(`Song.${key} が不正です`);
    }
  });

  const stringEnums = ['playbackMode', 'drumPattern', 'synthPresetId', 'bassRegister', 'chordRegister'] as const;
  stringEnums.forEach((key) => {
    if (typeof song[key] !== 'string' || song[key] === '') {
      throw new Error(`Song.${key} が不正です`);
    }
  });

  return song;
}

export function normalizeAppState(input: unknown): AppState {
  if (!isRecord(input)) {
    return createInitialState();
  }

  const updatedAt = typeof input.updatedAt === 'string' && input.updatedAt !== '' ? input.updatedAt : new Date().toISOString();
  const synthPresets = normalizeSynthPresets(input.synthPresets);
  if (!Array.isArray(input.songs)) {
    return createInitialState(updatedAt);
  }

  const songs = input.songs.map((song) => repairSongPresetReference(validateSong(song), synthPresets));
  const currentSongId =
    typeof input.currentSongId === 'string' && songs.some((song) => song.id === input.currentSongId)
      ? input.currentSongId
      : songs[0]?.id;

  if (!currentSongId) {
    return createInitialState(updatedAt);
  }

  return { updatedAt, songs, currentSongId, synthPresets };
}

export function loadCachedState(storage: Storage): AppState | null {
  const raw = storage.getItem(CACHE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as CacheEnvelope;
    if (!parsed?.cachedAt || !parsed.state) {
      return null;
    }

    const cachedAt = Date.parse(parsed.cachedAt);
    if (!Number.isFinite(cachedAt) || Date.now() - cachedAt > CACHE_TTL_MS) {
      storage.removeItem(CACHE_KEY);
      return null;
    }

    return normalizeAppState(parsed.state);
  } catch {
    return null;
  }
}

export function saveCachedState(storage: Storage, state: AppState): void {
  const envelope: CacheEnvelope = {
    cachedAt: new Date().toISOString(),
    state,
  };
  storage.setItem(CACHE_KEY, JSON.stringify(envelope));
}

export function clearCachedState(storage: Storage): void {
  storage.removeItem(CACHE_KEY);
}

export function exportSongs(songs: Song[], synthPresets: SynthPreset[], includeAllPresets = false): string {
  const referencedPresetIds = new Set(songs.map((song) => song.synthPresetId));
  const exportedPresets = includeAllPresets
    ? synthPresets
    : synthPresets.filter((preset) => referencedPresetIds.has(preset.id));
  const bundle: ExportBundle = {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    songs,
    synthPresets: exportedPresets.length > 0 ? exportedPresets : [createDefaultSynthPreset()],
  };

  return JSON.stringify(bundle, null, 2);
}

function importLegacySongs(bundle: LegacyExportBundle): ExportBundle {
  const synthPresets = [createDefaultSynthPreset()];
  const songs = bundle.songs.map((song) =>
    repairSongPresetReference(
      validateSong({
        ...song,
        synthPresetId: DEFAULT_SYNTH_PRESET_ID,
      }),
      synthPresets,
    ));

  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: bundle.exportedAt ?? new Date().toISOString(),
    songs,
    synthPresets,
  };
}

export function importSongs(json: string): { songs: Song[]; synthPresets: SynthPreset[] } {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('JSON の構文が不正です');
  }

  if (!isRecord(parsed)) {
    throw new Error('JSON ルートが不正です');
  }

  const schemaVersion = Number(parsed.schemaVersion);
  if (schemaVersion === LEGACY_EXPORT_SCHEMA_VERSION) {
    const legacy = parsed as unknown as LegacyExportBundle;
    if (!Array.isArray(legacy.songs)) {
      throw new Error('songs 配列が必要です');
    }
    const migrated = importLegacySongs(legacy);
    return {
      songs: migrated.songs,
      synthPresets: migrated.synthPresets,
    };
  }

  if (schemaVersion !== EXPORT_SCHEMA_VERSION) {
    throw new Error(`schemaVersion ${String(parsed.schemaVersion)} は未対応です`);
  }

  if (!Array.isArray(parsed.songs)) {
    throw new Error('songs 配列が必要です');
  }

  const synthPresets = normalizeSynthPresets(parsed.synthPresets);
  const songs = parsed.songs.map((song) => repairSongPresetReference(validateSong(song), synthPresets));
  return { songs, synthPresets };
}
