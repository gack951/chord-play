# Chord Play

Chord Play は、ブラウザだけで動く個人用のコード進行再生アプリです。  
外部で流れている曲に合わせてコード練習や耳コピ確認をしたい場面を想定し、**低遅延な再生**と**手動同期のしやすさ**を重視しています。

主な利用環境は Android Chrome と PC Chrome です。  
バックエンド、認証、クラウド保存はありません。データはブラウザ内に保存されます。

## Features

- テキスト入力によるコード進行作成
- 小節ごとのプレビューとパースエラー表示
- コード再生、ドラム再生、テンポ設定
- `Play / Pause / Resume / Stop`
- `1-Bar Sync` による外部音源への手動再同期
- ローカル保存
- JSON import / export
- 軽量なブラウザ内シンセ音色の編集と保存

## Why This Exists

一般的なコード再生ツールは、練習中に「今この小節から合わせたい」「外で鳴っている曲に今すぐ合わせたい」という用途に対して反応が鈍いことがあります。  
Chord Play はその逆で、**演奏補助用の実用性**を優先しています。

## Tech Stack

- TypeScript
- Vite
- pnpm
- Web Audio API
- Browser-only architecture

## Development

```bash
pnpm install
pnpm dev
```

### Commands

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:browser
pnpm build
```

`pnpm test:browser` は Playwright による browser verification です。  
主要 UI の存在、入力反映、transport 操作、sync の press-start 経路、保存・再読込、import/export、console/page error の検出を確認します。

## Project Principles

- クライアントのみで完結する
- 保存先はローカルのみ
- 音色の豪華さよりタイミング安定性を優先する
- UI はモバイルで扱いやすく、重要操作を隠さない

## Status

このリポジトリは、個人利用向けの実験的な音楽練習ツールとして継続的に更新しています。  
仕様は改善のために変わることがありますが、Android Chrome と PC Chrome での使いやすさは継続して重視します。
