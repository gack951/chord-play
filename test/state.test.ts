import { describe, expect, it } from 'vitest';
import { createSong, exportSongs, generateSongId, importSongs } from '../src/state/song';

describe('import/export', () => {
  it('exports and imports songs with schema validation', () => {
    const song = createSong({ id: 'song-1', title: 'Test Song' });
    const json = exportSongs([song]);
    const imported = importSongs(json);
    expect(imported).toHaveLength(1);
    expect(imported[0]?.id).toBe('song-1');
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
