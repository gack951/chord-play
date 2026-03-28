import type { AppState, Song, SongSettings } from '../types/app';

export const STORAGE_KEY = 'chord-play-state-v1';
export const EXPORT_SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS: SongSettings = {
  bpm: 120,
  playbackMode: 'block',
  drumPattern: 'metronome',
  instrument: 'triangle-keys',
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
  const cryptoApi = globalThis.crypto as Crypto | undefined;

  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36);
  return `song-${timePart}-${randomPart}`;
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

export function createInitialState(): AppState {
  const song = createSong();
  return {
    songs: [song],
    currentSongId: song.id,
  };
}

export function validateSong(input: unknown): Song {
  if (!input || typeof input !== 'object') {
    throw new Error('Song object が必要です');
  }

  const song = input as Record<string, unknown>;
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

  const stringEnums = ['playbackMode', 'drumPattern', 'instrument', 'bassRegister', 'chordRegister'] as const;
  stringEnums.forEach((key) => {
    if (typeof song[key] !== 'string') {
      throw new Error(`Song.${key} が不正です`);
    }
  });

  return song as unknown as Song;
}

export function loadState(storage: Storage): AppState {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    return createInitialState();
  }

  try {
    const parsed = JSON.parse(raw) as AppState;
    const songs = parsed.songs.map((song) => validateSong(song));
    const currentSongId = songs.some((song) => song.id === parsed.currentSongId) ? parsed.currentSongId : songs[0]?.id;

    if (!currentSongId) {
      return createInitialState();
    }

    return { songs, currentSongId };
  } catch {
    return createInitialState();
  }
}

export function saveState(storage: Storage, state: AppState): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function exportSongs(songs: Song[]): string {
  const bundle: ExportBundle = {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    songs,
  };

  return JSON.stringify(bundle, null, 2);
}

export function importSongs(json: string): Song[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('JSON の構文が不正です');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('JSON ルートが不正です');
  }

  const bundle = parsed as Record<string, unknown>;
  if (bundle.schemaVersion !== EXPORT_SCHEMA_VERSION) {
    throw new Error(`schemaVersion ${String(bundle.schemaVersion)} は未対応です`);
  }

  if (!Array.isArray(bundle.songs)) {
    throw new Error('songs 配列が必要です');
  }

  return bundle.songs.map((song) => validateSong(song));
}
