import { describe, expect, it } from 'vitest';
import { DEFAULT_SYNTH_PRESET_ID, createDefaultSynthPreset } from '../src/audio/synthPresets';
import { createMemoryUserStateStore } from '../src/server/stateStore';
import { createInitialState, createSong, exportSongs, generateSongId, importSongs, loadCachedState, saveCachedState } from '../src/state/song';

describe('state persistence', () => {
  it('exports and imports songs with synth presets', () => {
    const preset = createDefaultSynthPreset({ id: 'preset-1', name: 'My Preset' });
    const song = createSong({ id: 'song-1', title: 'Test Song', synthPresetId: preset.id });
    const json = exportSongs([song], [preset]);
    const imported = importSongs(json);
    expect(imported.songs).toHaveLength(1);
    expect(imported.songs[0]?.id).toBe('song-1');
    expect(imported.synthPresets.some((item) => item.id === 'preset-1')).toBe(true);
  });

  it('migrates legacy schema version 1 imports to the default synth preset', () => {
    const imported = importSongs(JSON.stringify({
      schemaVersion: 1,
      songs: [
        {
          id: 'legacy-song',
          title: 'Legacy Song',
          createdAt: '2026-03-28T00:00:00.000Z',
          updatedAt: '2026-03-28T00:00:00.000Z',
          progressionText: 'C | F | G | C',
          bpm: 120,
          playbackMode: 'block',
          drumPattern: 'metronome',
          instrument: 'triangle-keys',
          bassRegister: 'C3',
          chordRegister: 'C4',
          masterVolume: 0.8,
          chordVolume: 0.75,
          drumVolume: 0.65,
        },
      ],
    }));

    expect(imported.songs[0]?.synthPresetId).toBe(DEFAULT_SYNTH_PRESET_ID);
    expect(imported.synthPresets[0]?.id).toBe(DEFAULT_SYNTH_PRESET_ID);
  });

  it('uses local cache for temporary fallback only', () => {
    const storage = new MemoryStorage();
    const state = createInitialState('2026-03-29T00:00:00.000Z');
    saveCachedState(storage, state);

    const loaded = loadCachedState(storage);
    expect(loaded?.updatedAt).toBe('2026-03-29T00:00:00.000Z');
    expect(loaded?.songs).toHaveLength(1);
  });

  it('applies updatedAt last-write-wins in the server-side store', async () => {
    const store = createMemoryUserStateStore();
    const session = { id: 'tester-user-id', email: 'tester@example.com' };
    const initial = await store.load(session);
    const newer = {
      ...initial,
      updatedAt: '2099-03-29T12:00:00.000Z',
      songs: initial.songs.map((song, index) => (index === 0 ? { ...song, title: 'Newer Title', updatedAt: '2099-03-29T12:00:00.000Z' } : song)),
    };
    const older = {
      ...initial,
      updatedAt: '2099-03-29T11:00:00.000Z',
      songs: initial.songs.map((song, index) => (index === 0 ? { ...song, title: 'Older Title', updatedAt: '2099-03-29T11:00:00.000Z' } : song)),
    };

    const savedNewer = await store.save(session, newer);
    const savedOlder = await store.save(session, older);

    expect(savedNewer.applied).toBe('saved');
    expect(savedOlder.applied).toBe('ignored');
    expect(savedOlder.state.songs[0]?.title).toBe('Newer Title');
  });

  it('falls back when crypto.randomUUID is unavailable', () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      value: { ...originalCrypto, randomUUID: undefined },
      configurable: true,
    });

    try {
      expect(generateSongId()).toMatch(/^song-/);
      expect(createSong().id).toMatch(/^song-/);
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        value: originalCrypto,
        configurable: true,
      });
    }
  });
});

class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}
