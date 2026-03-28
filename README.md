# Chord Play

ブラウザのみで動作する、個人用のコード進行再生アプリです。主対象は Android Chrome、次点で PC Chrome です。

## できること

- コード進行テキスト入力
- 小節ごとのプレビュー表示
- 構文エラー表示
- コード再生 `block / arp-up-8 / arp-down-8 / arp-updown-8`
- ドラム再生 `metronome / four-on-the-floor / 8beat / 16beat`
- `Play / Pause / Resume / Stop`
- `1-Bar Sync` による即時小節同期
- パース結果の小節クリックによる再生位置指定と `Resume`
- Tap Tempo による BPM 入力補助
- ローカル保存
- JSON import/export

## セットアップ

```bash
pnpm install
pnpm dev
```

## コマンド

```bash
pnpm typecheck
pnpm test
pnpm test:browser
pnpm build
pnpm lint
```

`pnpm test:browser` は Playwright による browser verification です。console/page error の検出、主要 UI の存在、入力反映、transport 操作、sync の press-start 経路、localStorage 維持、JSON import/export、Tap Tempo、複数回 render 後の duplicate event handling がないことを確認します。

## サポートしているコード進行文法

区切り:

- 小節区切りは `|` または `;`
- 先頭・末尾の区切りは省略可

例:

- `C | Am | F | G`
- `| C | Am | F | G |`
- `C G/B | Am7 D7 | F % G7 C`
- `C 'F | 'B E`

小節ルール:

- 4/4 固定
- 各小節は 1, 2, 4 トークンのみ対応
- `%` は直前の有効コードを繰り返す
- コードの前に `'` を付けると、そのコードは 0.5 拍早く入る
  - 例: `C 'F` なら `C` は 1.5 拍、`F` は 2.5 拍
  - 例: `C F | 'B E` なら `F` は 1.5 拍、`B` は前小節へ 0.5 拍食い込んで 2.5 拍
- `N.C.` と `-` はそのスロットを休符として扱う
- エラーのある小節はプレビューで表示し、再生対象から除外する
- invalid bar も preview 上に残し、エラー表示付きで再生対象から除外する
- 発音の長さは nominal な拍数固定ではなく、次のコードまたは休符の 0.125 拍前まで sustain する

対応コード:

- 基本: `C`, `Dm`, `G7`, `Bbmaj7`, `F#m`
- フラットファイブ: `Gm7-5`, `Cm(b5)` ではなく `Cmb5` または `Cm-5`
- テンション: `Cadd9`, `G7(b9)`, `Dm7(11)`
- スラッシュ: `C/E`
- 特殊品質: `Gsus4`, `Caug`, `Bdim`

現時点の意図的な制限:

- 複雑な TexChord 拡張構文は未対応
- voice leading 最適化は未実装
- 再生は固定ボイシング

## アーキテクチャ

- `src/parser`: 文字列解析
- `src/music`: 音名、ボイシング、アルペジオ
- `src/audio`: transport, scheduler, synth, drums
- `src/state`: localStorage と JSON schema
- `src/ui`: DOM UI

## 手動確認項目

1. `Play` で小節 1 から始まる
2. `Pause` 後に `Resume` で続きから再開する
3. `Stop` で停止し、次回 `Play` は先頭から始まる
4. `1-Bar Sync` を押した瞬間に小節表示が同期し続行する
5. Android Chrome で最初のユーザー操作後に音が出る
6. プレビュー表示と再生対象小節が一致する

### 手動確認メモ
- 再生、停止、一時停止、再開は OK
- 再同期も OK
- 以前の課題だった「最後まで再生したら自動停止してほしい」は実装済み。再度実機確認が必要
  - 確認OK
- 以前の課題だった「Android Chrome で背景色だけ表示される」は `crypto.randomUUID` 非依存化で修正済み想定。再度実機確認が必要
  - 確認OK
- スマホ表示向けに以下を実装済み。実機確認が必要
  - 最上部の大きいタイトル・説明を削除
  - 現在小節表示を小型化
  - 再生ボタン群と Sync を上側へ移動
  - 各種再生オプションを再生ボタンの下へ移動
  - パース結果を横スクロール前提のコンパクト表示へ変更
  - パース結果に現在再生中の小節ハイライトを追加
  - invalid bar があっても、再生対象の有効小節にハイライトが追従するよう修正
- パース結果の有効小節をクリックすると、その小節を現在位置にして `Resume` できる
- BPM 入力欄の右に `Tap` ボタンを追加
  - 複数回タップしたテンポから BPM を計算して入力欄へ反映する

### 次回の実機確認ポイント
1. Android Chrome で UI が正常に描画されること
2. 1 小節だけの進行を再生したとき、自動的に停止すること
3. `Play / Pause / Resume / Stop / Sync` が引き続き問題ないこと
4. スマホ表示で初期表示内に `Play` ボタンが見えること
5. プレビューの現在小節ハイライトが再生に追従すること
6. `Tap` ボタンで意図したテンポが BPM 欄へ反映されること

## Browser Verification

UI やイベント処理を変更したときは、unit test に加えて以下を実行します。

```bash
pnpm test:browser
```

この検証は音の主観品質ではなく、DOM 構造、イベント配線、永続化、import/export、console/page error の検出を対象にしています。

## 既知の制限

- `sync` は短い lookahead 前提で即時性を優先しており、押下直前にすでに予約済みの微小なノートは完全には取り消せません
- 楽器音色は軽量な Web Audio 合成で、リアルなサウンドフォントではありません
