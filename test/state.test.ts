import { describe, expect, it } from 'vitest';
import { DEFAULT_SYNTH_PRESET_ID, createDefaultSynthPreset } from '../src/audio/synthPresets';
import { createSong, exportSongs, generateSongId, importSongs, loadState } from '../src/state/song';

describe('import/export', () => {
  it('exports and imports songs with synth presets', () => {
    const preset = createDefaultSynthPreset({ id: 'preset-1', name: 'My Preset' });
    const song = createSong({ id: 'song-1', title: 'Test Song', synthPresetId: preset.id });
    const json = exportSongs([song], [preset]);
    const imported = importSongs(json);
    expect(imported.songs).toHaveLength(1);
    expect(imported.songs[0]?.id).toBe('song-1');
    expect(imported.synthPresets.some((preset) => preset.id === 'preset-1')).toBe(true);
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

  it('loads legacy local state and repairs missing preset references', () => {
    const storage = {
      getItem() {
        return JSON.stringify({
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
              instrument: 'debug-hold',
              bassRegister: 'C3',
              chordRegister: 'C4',
              masterVolume: 0.8,
              chordVolume: 0.75,
              drumVolume: 0.65,
            },
          ],
          currentSongId: 'legacy-song',
        });
      },
      setItem() {
        throw new Error('not used');
      },
      removeItem() {
        throw new Error('not used');
      },
      clear() {
        throw new Error('not used');
      },
      key() {
        return null;
      },
      length: 0,
    } as Storage;

    const state = loadState(storage);
    expect(state.synthPresets[0]?.id).toBe(DEFAULT_SYNTH_PRESET_ID);
    expect(state.songs[0]?.synthPresetId).toBe(DEFAULT_SYNTH_PRESET_ID);
  });

  it('rejects invalid schema version', () => {
    expect(() => importSongs(JSON.stringify({ schemaVersion: 999, songs: [] }))).toThrow(/未対応/);
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
