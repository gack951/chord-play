import '../style.css';
import { AudioEngine } from '../audio/engine';
import { calculateTapTempo, normalizeTapHistory } from '../music/tapTempo';
import { Scheduler } from '../audio/scheduler';
import { Transport } from '../audio/transport';
import { parseProgression } from '../parser/progression';
import { createInitialState, createSong, exportSongs, importSongs, loadState, saveState } from '../state/song';
import { DRUM_PATTERNS, INSTRUMENTS, PLAYBACK_MODES, type AppState, type Song } from '../types/app';
import { REGISTER_OPTIONS } from '../utils/constants';

type NoticeKind = 'info' | 'error';

export function mountApp(root: HTMLElement): void {
  const state = safeLoadState();
  const transport = new Transport(getCurrentSong(state).bpm);
  const engine = new AudioEngine();
  const scheduler = new Scheduler(
    transport,
    engine,
    () => parseProgression(getCurrentSong(state).progressionText).validBars,
    () => {
      const song = getCurrentSong(state);
      return {
        bpm: song.bpm,
        masterVolume: song.masterVolume,
        chordVolume: song.chordVolume,
        drumVolume: song.drumVolume,
        playbackMode: song.playbackMode,
        instrument: song.instrument,
        bassRegister: song.bassRegister,
        chordRegister: song.chordRegister,
        drumPattern: song.drumPattern,
      };
    },
    () => {
      transport.stop();
      scheduler.stop();
      setNotice('info', '最後の小節まで再生したため停止しました');
      render();
    },
  );

  let lastNotice: { kind: NoticeKind; message: string } | null = null;
  let tapHistory: number[] = [];

  root.innerHTML = `
    <div class="app-shell">
      <main class="layout">
        <section class="panel editor-panel">
          <div class="editor-header">
            <label class="stack stack-inline">
              <span>曲タイトル</span>
              <input id="song-title" type="text" />
            </label>
            <div class="status-card">
              <div>現在小節</div>
              <strong id="current-bar">1</strong>
              <div id="transport-state">stopped</div>
            </div>
          </div>
          <label class="stack stack-tight">
            <span>コード進行</span>
            <textarea id="progression-text" rows="8"></textarea>
          </label>
          <div class="preview-section">
            <div class="notice compact-notice" id="parse-summary"></div>
            <div class="error-list" id="parse-errors"></div>
            <div class="preview-strip" id="preview"></div>
          </div>
        </section>
        <section class="panel controls-panel">
          <div class="transport-meta">
            <div class="stack stack-tight">
              <span>BPM</span>
              <div class="bpm-row">
                <input id="bpm" type="number" min="40" max="240" step="1" />
                <button id="tap-tempo-btn" type="button" class="tap-btn">Tap</button>
              </div>
            </div>
          </div>
          <div class="transport-row">
            <button id="play-btn">Play</button>
            <button id="pause-btn">Pause</button>
            <button id="resume-btn">Resume</button>
            <button id="stop-btn">Stop</button>
          </div>
          <button id="sync-btn" class="sync-btn">1-Bar Sync</button>
          <div class="notice" id="notice"></div>
          <div class="controls-grid">
            <label class="stack stack-tight"><span>再生モード</span><select id="playback-mode"></select></label>
            <label class="stack stack-tight"><span>ドラム</span><select id="drum-pattern"></select></label>
            <label class="stack stack-tight"><span>楽器</span><select id="instrument"></select></label>
            <label class="stack stack-tight"><span>ベース音域</span><select id="bass-register"></select></label>
            <label class="stack stack-tight"><span>コード音域</span><select id="chord-register"></select></label>
            <label class="stack stack-tight"><span>Master</span><input id="master-volume" type="range" min="0" max="1" step="0.01" /></label>
            <label class="stack stack-tight"><span>Chord</span><input id="chord-volume" type="range" min="0" max="1" step="0.01" /></label>
            <label class="stack stack-tight"><span>Drum</span><input id="drum-volume" type="range" min="0" max="1" step="0.01" /></label>
          </div>
        </section>
        <section class="panel songs-panel">
          <div class="songs-toolbar">
            <button id="new-song-btn">New Song</button>
            <button id="export-current-btn">Export Current</button>
            <button id="export-all-btn">Export All</button>
            <button id="import-btn">Import JSON</button>
            <input id="import-file" type="file" accept="application/json" hidden />
          </div>
          <div id="song-list" class="song-list"></div>
        </section>
      </main>
    </div>
  `;

  const currentBarEl = query<HTMLDivElement>('#current-bar', root);
  const transportStateEl = query<HTMLDivElement>('#transport-state', root);
  const titleInput = query<HTMLInputElement>('#song-title', root);
  const progressionText = query<HTMLTextAreaElement>('#progression-text', root);
  const bpmInput = query<HTMLInputElement>('#bpm', root);
  const tapTempoButton = query<HTMLButtonElement>('#tap-tempo-btn', root);
  const playbackModeSelect = query<HTMLSelectElement>('#playback-mode', root);
  const drumPatternSelect = query<HTMLSelectElement>('#drum-pattern', root);
  const instrumentSelect = query<HTMLSelectElement>('#instrument', root);
  const bassRegisterSelect = query<HTMLSelectElement>('#bass-register', root);
  const chordRegisterSelect = query<HTMLSelectElement>('#chord-register', root);
  const masterVolume = query<HTMLInputElement>('#master-volume', root);
  const chordVolume = query<HTMLInputElement>('#chord-volume', root);
  const drumVolume = query<HTMLInputElement>('#drum-volume', root);
  const previewEl = query<HTMLDivElement>('#preview', root);
  const parseSummaryEl = query<HTMLDivElement>('#parse-summary', root);
  const parseErrorsEl = query<HTMLDivElement>('#parse-errors', root);
  const noticeEl = query<HTMLDivElement>('#notice', root);
  const songListEl = query<HTMLDivElement>('#song-list', root);
  const importFileInput = query<HTMLInputElement>('#import-file', root);

  setSelectOptions(playbackModeSelect, PLAYBACK_MODES);
  setSelectOptions(drumPatternSelect, DRUM_PATTERNS);
  setSelectOptions(instrumentSelect, INSTRUMENTS);
  setSelectOptions(bassRegisterSelect, REGISTER_OPTIONS);
  setSelectOptions(chordRegisterSelect, REGISTER_OPTIONS);

  function persist(): void {
    saveState(localStorage, state);
  }

  function render(): void {
    const song = getCurrentSong(state);
    const parseResult = parseProgression(song.progressionText);
    const playbackBarIndexMap = new Map<number, number>();
    parseResult.validBars.forEach((bar, playbackIndex) => {
      playbackBarIndexMap.set(bar.index, playbackIndex + 1);
    });

    titleInput.value = song.title;
    progressionText.value = song.progressionText;
    bpmInput.value = String(song.bpm);
    playbackModeSelect.value = song.playbackMode;
    drumPatternSelect.value = song.drumPattern;
    instrumentSelect.value = song.instrument;
    bassRegisterSelect.value = song.bassRegister;
    chordRegisterSelect.value = song.chordRegister;
    masterVolume.value = String(song.masterVolume);
    chordVolume.value = String(song.chordVolume);
    drumVolume.value = String(song.drumVolume);

    engine.applySettings({
      bpm: song.bpm,
      playbackMode: song.playbackMode,
      drumPattern: song.drumPattern,
      instrument: song.instrument,
      bassRegister: song.bassRegister,
      chordRegister: song.chordRegister,
      masterVolume: song.masterVolume,
      chordVolume: song.chordVolume,
      drumVolume: song.drumVolume,
    });

    parseSummaryEl.textContent =
      parseResult.issues.length === 0
        ? `${parseResult.validBars.length} 小節を再生対象にします`
        : `${parseResult.validBars.length} 小節を再生対象、${parseResult.issues.length} 件のエラーあり`;

    parseErrorsEl.innerHTML = parseResult.issues
      .map((issue) => `<div class="error-item">Bar ${issue.barIndex + 1}: ${issue.message}</div>`)
      .join('');

    previewEl.innerHTML = parseResult.bars
      .map((bar) => {
        const invalid = parseResult.issues.some((issue) => issue.barIndex === bar.index);
        const playbackBarIndex = playbackBarIndexMap.get(bar.index);
        return `
          <div
            class="bar-card ${invalid ? 'bar-invalid' : ''}"
            data-bar-index="${bar.index + 1}"
            ${playbackBarIndex ? `data-playback-bar-index="${playbackBarIndex}"` : ''}
          >
            <div class="bar-index">Bar ${bar.index + 1}</div>
            <div class="bar-slots">${(invalid ? bar.tokens : bar.slots.map((slot) => slot.token))
              .map((value) => `<span class="slot ${value === 'N.C.' || value === '-' ? 'slot-rest' : ''}">${value}</span>`)
              .join('')}</div>
          </div>
        `;
      })
      .join('');

    songListEl.innerHTML = state.songs
      .map(
        (songItem) => `
        <button class="song-item ${songItem.id === state.currentSongId ? 'song-item-active' : ''}" data-song-id="${songItem.id}">
          <strong>${escapeHtml(songItem.title)}</strong>
          <span>${escapeHtml(songItem.updatedAt.replace('T', ' ').slice(0, 16))}</span>
        </button>`,
      )
      .join('');

    noticeEl.textContent = lastNotice?.message ?? '';
    noticeEl.className = `notice ${lastNotice ? `notice-${lastNotice.kind}` : ''}`;
    updatePreviewPlaybackIndicator(transport.getSnapshot(engine.currentTime).currentBar, transport.getSnapshot(engine.currentTime).state);
  }

  function updateSong(mutator: (song: Song) => void): void {
    const song = getCurrentSong(state);
    mutator(song);
    song.updatedAt = new Date().toISOString();
    transport.setBpm(song.bpm, engine.currentTime);
    scheduler.resetWindow();
    persist();
    render();
  }

  titleInput.addEventListener('input', () => updateSong((song) => {
    song.title = titleInput.value || 'Untitled';
  }));
  progressionText.addEventListener('input', () => updateSong((song) => {
    song.progressionText = progressionText.value;
  }));
  bpmInput.addEventListener('input', () => updateSong((song) => {
    song.bpm = clampNumber(Number(bpmInput.value), 40, 240, 120);
  }));
  tapTempoButton.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    const now = performance.now();
    tapHistory = normalizeTapHistory(tapHistory, now);
    const tappedBpm = calculateTapTempo(tapHistory);

    if (tappedBpm === null) {
      setNotice('info', 'Tap Tempo: 続けてタップしてください');
      render();
      return;
    }

    updateSong((song) => {
      song.bpm = clampNumber(tappedBpm, 40, 240, 120);
    });
    setNotice('info', `Tap Tempo: ${getCurrentSong(state).bpm} BPM`);
    render();
  });
  playbackModeSelect.addEventListener('change', () => updateSong((currentSong) => {
    currentSong.playbackMode = playbackModeSelect.value as Song['playbackMode'];
  }));
  drumPatternSelect.addEventListener('change', () => updateSong((currentSong) => {
    currentSong.drumPattern = drumPatternSelect.value as Song['drumPattern'];
  }));
  instrumentSelect.addEventListener('change', () => updateSong((currentSong) => {
    currentSong.instrument = instrumentSelect.value as Song['instrument'];
  }));
  bassRegisterSelect.addEventListener('change', () => updateSong((currentSong) => {
    currentSong.bassRegister = bassRegisterSelect.value as Song['bassRegister'];
  }));
  chordRegisterSelect.addEventListener('change', () => updateSong((currentSong) => {
    currentSong.chordRegister = chordRegisterSelect.value as Song['chordRegister'];
  }));
  masterVolume.addEventListener('input', () => updateSong((song) => {
    song.masterVolume = Number(masterVolume.value);
  }));
  chordVolume.addEventListener('input', () => updateSong((song) => {
    song.chordVolume = Number(chordVolume.value);
  }));
  drumVolume.addEventListener('input', () => updateSong((song) => {
    song.drumVolume = Number(drumVolume.value);
  }));

  query<HTMLButtonElement>('#new-song-btn', root).addEventListener('click', () => {
    const song = createSong();
    state.songs.unshift(song);
    state.currentSongId = song.id;
    persist();
    setNotice('info', '新しい曲を作成しました');
    render();
  });

  songListEl.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>('[data-song-id]');
    if (!button) {
      return;
    }
    state.currentSongId = button.dataset.songId ?? state.currentSongId;
    persist();
    render();
  });

  previewEl.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const card = target.closest<HTMLElement>('.bar-card');
    if (!card) {
      return;
    }

    const playbackBarIndex = card.dataset.playbackBarIndex;
    if (!playbackBarIndex) {
      setNotice('error', 'エラー小節は再生位置に指定できません');
      render();
      return;
    }

    transport.cueToBar(Number(playbackBarIndex));
    scheduler.stop();
    setNotice('info', `Bar ${card.dataset.barIndex} を現在小節に設定しました。Resume で再開できます`);
    render();
  });

  query<HTMLButtonElement>('#play-btn', root).addEventListener('click', async () => {
    await engine.ensureReady();
    const parseResult = parseProgression(getCurrentSong(state).progressionText);
    if (parseResult.validBars.length === 0) {
      setNotice('error', '再生可能な小節がありません');
      render();
      return;
    }
    transport.play(engine.currentTime);
    scheduler.start();
    setNotice('info', '先頭から再生を開始しました');
    render();
  });

  query<HTMLButtonElement>('#pause-btn', root).addEventListener('click', () => {
    transport.pause(engine.currentTime);
    scheduler.stop();
    setNotice('info', '一時停止しました');
    render();
  });

  query<HTMLButtonElement>('#resume-btn', root).addEventListener('click', async () => {
    await engine.ensureReady();
    transport.resume(engine.currentTime);
    scheduler.start();
    setNotice('info', '再生を再開しました');
    render();
  });

  query<HTMLButtonElement>('#stop-btn', root).addEventListener('click', () => {
    transport.stop();
    scheduler.stop();
    setNotice('info', '停止しました');
    render();
  });

  const syncButton = query<HTMLButtonElement>('#sync-btn', root);
  const handleSyncPress = async (event: Event) => {
    event.preventDefault();
    await engine.ensureReady();
    transport.syncToNearestBar(engine.currentTime);
    scheduler.resetWindow();
    scheduler.start();
    setNotice('info', '現在位置を小節頭へ同期しました');
    render();
  };
  syncButton.addEventListener('pointerdown', handleSyncPress);
  syncButton.addEventListener('touchstart', handleSyncPress, { passive: false });
  syncButton.addEventListener('mousedown', handleSyncPress);

  query<HTMLButtonElement>('#export-current-btn', root).addEventListener('click', () => {
    downloadJson(exportSongs([getCurrentSong(state)]), `${slugify(getCurrentSong(state).title)}.json`);
    setNotice('info', '現在の曲を JSON 出力しました');
    render();
  });

  query<HTMLButtonElement>('#export-all-btn', root).addEventListener('click', () => {
    downloadJson(exportSongs(state.songs), 'chord-play-all.json');
    setNotice('info', '全曲を JSON 出力しました');
    render();
  });

  query<HTMLButtonElement>('#import-btn', root).addEventListener('click', () => {
    importFileInput.click();
  });

  importFileInput.addEventListener('change', async () => {
    const file = importFileInput.files?.[0];
    if (!file) {
      return;
    }
    const text = await file.text();
    try {
      const imported = importSongs(text);
      state.songs = mergeSongs(state.songs, imported);
      state.currentSongId = imported[0]?.id ?? state.currentSongId;
      persist();
      setNotice('info', `${imported.length} 曲を取り込みました`);
      render();
    } catch (error) {
      setNotice('error', error instanceof Error ? error.message : 'インポートに失敗しました');
      render();
    } finally {
      importFileInput.value = '';
    }
  });

  function setNotice(kind: NoticeKind, message: string): void {
    lastNotice = { kind, message };
  }

  function tickUi(): void {
    const snapshot = transport.getSnapshot(engine.currentTime);
    currentBarEl.textContent = String(snapshot.currentBar);
    transportStateEl.textContent = snapshot.state;
    updatePreviewPlaybackIndicator(snapshot.currentBar, snapshot.state);
    requestAnimationFrame(tickUi);
  }

  render();
  tickUi();
}

function updatePreviewPlaybackIndicator(currentBar: number, state: string): void {
  const currentActive = document.querySelector<HTMLElement>('.bar-card-active');

  if (state === 'stopped') {
    currentActive?.classList.remove('bar-card-active');
    return;
  }

  const activeBar = document.querySelector<HTMLElement>(`.bar-card[data-playback-bar-index="${currentBar}"]`);
  if (currentActive === activeBar) {
    return;
  }

  currentActive?.classList.remove('bar-card-active');
  activeBar?.classList.add('bar-card-active');
  activeBar?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function getCurrentSong(state: AppState): Song {
  return state.songs.find((song) => song.id === state.currentSongId) ?? state.songs[0];
}

function safeLoadState(): AppState {
  try {
    return loadState(localStorage);
  } catch {
    return createInitialState();
  }
}

function setSelectOptions(select: HTMLSelectElement, values: readonly string[]): void {
  select.innerHTML = values.map((value) => `<option value="${value}">${value}</option>`).join('');
}

function query<T extends HTMLElement>(selector: string, root: ParentNode): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`${selector} が見つかりません`);
  }
  return element;
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function slugify(value: string): string {
  const cleaned = value.trim().toLowerCase().replaceAll(/[^a-z0-9]+/g, '-');
  return cleaned.length > 0 ? cleaned : 'song';
}

function downloadJson(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function mergeSongs(existing: Song[], imported: Song[]): Song[] {
  const map = new Map(existing.map((song) => [song.id, song]));
  imported.forEach((song) => {
    map.set(song.id, song);
  });
  return Array.from(map.values()).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
