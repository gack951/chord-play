import { expect, test } from '@playwright/test';

function collectUnexpectedErrors(page: import('@playwright/test').Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  return {
    assertClean() {
      expect(consoleErrors, `Unexpected console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
      expect(pageErrors, `Unexpected page errors:\n${pageErrors.join('\n')}`).toEqual([]);
    },
  };
}

test('主要 UI が表示され、入力と transport が動作する', async ({ page }) => {
  const errors = collectUnexpectedErrors(page);
  await page.goto('/');

  await expect(page.locator('#progression-text')).toBeVisible();
  await expect(page.locator('#preview')).toBeVisible();
  await expect(page.locator('#parse-errors')).toBeAttached();
  await expect(page.locator('#sync-btn')).toBeVisible();
  await expect(page.locator('#song-list')).toBeVisible();
  await expect(page.locator('#synth-preset')).toBeVisible();
  await expect(page.locator('#attack')).toBeVisible();

  await page.locator('#progression-text').fill('C | Am | F | G');
  await expect(page.locator('.bar-card')).toHaveCount(4);
  await expect(page.locator('#parse-summary')).toContainText('4 小節');

  await page.locator('#progression-text').fill('C D E');
  await expect(page.locator('#parse-errors')).toContainText('1, 2, 4');

  await page.locator('#progression-text').fill("C 'F | 'B E | Gm7-5");
  await expect(page.locator('#parse-errors')).toBeEmpty();
  await expect(page.locator('.bar-card')).toHaveCount(3);
  await expect(page.locator('#preview')).toContainText("'F");
  await expect(page.locator('#preview')).toContainText("'B");
  await expect(page.locator('#preview')).toContainText('Gm7-5');

  await page.locator('#bpm').fill('132');
  await page.locator('#tap-tempo-btn').dispatchEvent('pointerdown');
  await page.waitForTimeout(500);
  await page.locator('#tap-tempo-btn').dispatchEvent('pointerdown');
  await page.waitForTimeout(500);
  await page.locator('#tap-tempo-btn').dispatchEvent('pointerdown');
  const tappedBpm = Number(await page.locator('#bpm').inputValue());
  expect(tappedBpm).toBeGreaterThanOrEqual(110);
  expect(tappedBpm).toBeLessThanOrEqual(130);
  await page.locator('#playback-mode').selectOption('arp-updown-8');
  await page.locator('#drum-pattern').selectOption('16beat');
  await page.locator('#waveform').selectOption('square');
  await page.locator('#filter-cutoff').fill('2800');
  await page.locator('#attack').fill('0.020');
  await page.locator('#release').fill('0.010');
  await page.locator('#preview-note-btn').click();
  await expect(page.locator('#notice')).toContainText('C4');
  await page.locator('#preview-chord-btn').click();
  await expect(page.locator('#notice')).toContainText('C の和音');
  await page.locator('#bass-register').selectOption('E3');
  await page.locator('#chord-register').selectOption('G4');

  await page.locator('#play-btn').click();
  await expect(page.locator('#transport-state')).toHaveText('playing');

  await page.locator('#pause-btn').click();
  await expect(page.locator('#transport-state')).toHaveText('paused');

  await page.locator('#resume-btn').click();
  await expect(page.locator('#transport-state')).toHaveText('playing');

  await page.locator('#sync-btn').dispatchEvent('pointerdown');
  await expect(page.locator('#notice')).toContainText('同期');
  await expect(page.locator('#transport-state')).toHaveText('playing');

  await page.locator('#stop-btn').click();
  await expect(page.locator('#transport-state')).toHaveText('stopped');

  errors.assertClean();
});

test('モバイル表示で transport が初期表示内にあり、preview の現在小節がハイライトされる', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  const errors = collectUnexpectedErrors(page);
  await page.goto('/');

  const playButton = page.locator('#play-btn');
  await expect(playButton).toBeVisible();

  const playBox = await playButton.boundingBox();
  expect(playBox).not.toBeNull();
  expect((playBox?.y ?? 9999) + (playBox?.height ?? 0)).toBeLessThanOrEqual(844);

  await page.locator('#progression-text').fill('C | F');
  await page.locator('#bpm').fill('240');
  await page.locator('#play-btn').click();

  await expect(page.locator('.bar-card-active')).toHaveAttribute('data-bar-index', '1');
  await expect(page.locator('.bar-card-active')).toHaveAttribute('data-bar-index', '2', { timeout: 5000 });

  errors.assertClean();
});

test('randomUUID が無くても起動でき、短い進行は最後で自動停止する', async ({ page }) => {
  await page.addInitScript(() => {
    const cryptoApi = window.crypto;
    Object.defineProperty(window, 'crypto', {
      value: {
        ...cryptoApi,
        randomUUID: undefined,
      },
      configurable: true,
    });
  });

  const errors = collectUnexpectedErrors(page);
  await page.goto('/');

  await expect(page.locator('#song-title')).toBeVisible();
  await page.locator('#progression-text').fill('C');
  await page.locator('#bpm').fill('240');
  await page.locator('#play-btn').click();

  await expect(page.locator('#transport-state')).toHaveText('playing');
  await expect(page.locator('#transport-state')).toHaveText('stopped', { timeout: 2500 });
  await expect(page.locator('#notice')).toContainText('最後の小節');

  errors.assertClean();
});

test('保存・再読込・import/export が動作し、無効 JSON を拒否する', async ({ page }) => {
  const errors = collectUnexpectedErrors(page);
  await page.goto('/');

  await page.locator('#song-title').fill('Persisted Song');
  await page.locator('#progression-text').fill('C | F | G | C');
  await page.locator('#preset-name').fill('Persist Hold');
  await page.locator('#waveform').selectOption('sawtooth');
  await page.locator('#attack').fill('0.015');
  await page.locator('#save-preset-btn').click();
  await expect(page.locator('#synth-preset option')).toHaveCount(2);
  await page.reload();

  await expect(page.locator('#song-title')).toHaveValue('Persisted Song');
  await expect(page.locator('#progression-text')).toHaveValue('C | F | G | C');
  await expect(page.locator('#preset-name')).toHaveValue('Persist Hold copy');
  await expect(page.locator('#waveform')).toHaveValue('sawtooth');

  await page.locator('#new-song-btn').click();
  await expect(page.locator('.song-item')).toHaveCount(2);
  await page.locator('#song-title').fill('Second Song');
  await page.locator('.song-item').filter({ hasText: 'Persisted Song' }).click();
  await expect(page.locator('#song-title')).toHaveValue('Persisted Song');
  await expect(page.locator('#preset-name')).toHaveValue('Persist Hold copy');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#export-current-btn').click(),
  ]);
  expect(download.suggestedFilename()).toContain('.json');

  const validImport = JSON.stringify({
    schemaVersion: 2,
    exportedAt: new Date('2026-03-28T00:00:00Z').toISOString(),
    songs: [
      {
        id: 'imported-song',
        title: 'Imported Song',
        createdAt: new Date('2026-03-28T00:00:00Z').toISOString(),
        updatedAt: new Date('2026-03-28T00:00:00Z').toISOString(),
        progressionText: 'F | G | Em | Am',
        bpm: 120,
        playbackMode: 'block',
        drumPattern: 'metronome',
        synthPresetId: 'preset-imported',
        bassRegister: 'C3',
        chordRegister: 'C4',
        masterVolume: 0.8,
        chordVolume: 0.75,
        drumVolume: 0.65,
      },
    ],
    synthPresets: [
      {
        id: 'preset-imported',
        name: 'Imported Preset',
        waveform: 'triangle',
        filterCutoff: 3100,
        attack: 0.01,
        release: 0.005,
      },
    ],
  });

  await page.locator('#import-file').setInputFiles({
    name: 'valid-import.json',
    mimeType: 'application/json',
    buffer: Buffer.from(validImport, 'utf8'),
  });
  await expect(page.locator('#notice')).toContainText('取り込みました');
  await expect(page.locator('.song-item').filter({ hasText: 'Imported Song' })).toHaveCount(1);
  await page.locator('.song-item').filter({ hasText: 'Imported Song' }).click();
  await expect(page.locator('#preset-name')).toHaveValue('Imported Preset');

  await page.locator('#import-file').setInputFiles({
    name: 'invalid-import.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{invalid', 'utf8'),
  });
  await expect(page.locator('#notice')).toContainText('JSON の構文が不正');
  await expect(page.locator('.song-item').filter({ hasText: 'Imported Song' })).toHaveCount(1);

  errors.assertClean();
});

test('複数回 render 後も単一操作で duplicate handling が起きない', async ({ page }) => {
  const errors = collectUnexpectedErrors(page);
  await page.goto('/');

  const songItems = page.locator('.song-item');
  await expect(songItems).toHaveCount(1);

  await page.locator('#song-title').fill('Rendered Song');
  await page.locator('#progression-text').fill('C | F | G | C');
  await page.locator('#bpm').fill('128');
  await page.locator('#playback-mode').selectOption('arp-down-8');
  await page.locator('#drum-pattern').selectOption('8beat');
  await page.locator('#waveform').selectOption('sine');
  await page.locator('#filter-cutoff').fill('2600');
  await page.locator('#attack').fill('0.030');
  await page.locator('#bass-register').selectOption('D3');
  await page.locator('#chord-register').selectOption('E4');
  await page.locator('#master-volume').fill('0.72');
  await page.locator('#chord-volume').fill('0.61');
  await page.locator('#drum-volume').fill('0.43');
  await page.locator('#tap-tempo-btn').dispatchEvent('pointerdown');
  await page.waitForTimeout(300);
  await page.locator('#tap-tempo-btn').dispatchEvent('pointerdown');

  await page.locator('#new-song-btn').click();
  await expect(songItems).toHaveCount(2);

  await page.locator('#new-song-btn').click();
  await expect(songItems).toHaveCount(3);

  errors.assertClean();
});

test('invalid bar を含んでも preview highlight は再生対象の有効小節に追従する', async ({ page }) => {
  const errors = collectUnexpectedErrors(page);
  await page.goto('/');

  await page.locator('#progression-text').fill('C | C D E | F');
  await expect(page.locator('.bar-card')).toHaveCount(3);
  await expect(page.locator('.bar-invalid')).toHaveCount(1);

  await page.locator('#bpm').fill('240');
  await page.locator('#play-btn').click();

  await expect(page.locator('.bar-card-active')).toHaveAttribute('data-bar-index', '1');
  await expect(page.locator('.bar-card-active')).toHaveAttribute('data-bar-index', '3', { timeout: 5000 });

  errors.assertClean();
});

test('preview の小節クリックで現在小節を設定し Resume できる', async ({ page }) => {
  const errors = collectUnexpectedErrors(page);
  await page.goto('/');

  await page.locator('#progression-text').fill('C | Am | F | G');
  await page.locator('.bar-card[data-playback-bar-index="3"]').click();

  await expect(page.locator('#transport-state')).toHaveText('paused');
  await expect(page.locator('#current-bar')).toHaveText('3');
  await expect(page.locator('.bar-card-active')).toHaveAttribute('data-bar-index', '3');

  await page.locator('#resume-btn').click();
  await expect(page.locator('#transport-state')).toHaveText('playing');
  await expect(page.locator('.bar-card-active')).toHaveAttribute('data-bar-index', '3');

  errors.assertClean();
});
