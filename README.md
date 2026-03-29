# Chord Play

Chord Play は、外部で再生している曲に合わせてコード練習や確認をするための、ブラウザベースのコード再生アプリです。  
低遅延な再生、手動同期、モバイルでの扱いやすさを重視しています。

現在は **Cloudflare Access による認証を前提** とし、データは **Cloudflare D1** にユーザー単位で保存します。  
ブラウザ側の保存は、一時キャッシュ用途に限定しています。

## Features

- コード進行のテキスト入力
- 小節ごとのプレビューとパースエラー表示
- コード再生、ドラム再生、テンポ設定
- `Play / Pause / Resume / Stop`
- `1-Bar Sync` による手動再同期
- シンセ音色プリセットの編集と保存
- Cloudflare Access 認証前提のサーバー保存
- PC / スマホ間の状態共有

## Tech Stack

- TypeScript
- Vite
- pnpm
- Web Audio API
- Cloudflare Pages Functions
- Cloudflare D1
- Cloudflare Access

## Local Development

```bash
pnpm install
pnpm dev
```

ローカル開発では、Vite の開発サーバー上で簡易 API を動かし、認証なしでブラウザ確認できるようにしています。  
本番の保存先は D1 ですが、ローカルではメモリ上の開発用ストアを使います。

### Commands

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:browser
pnpm build
```

`pnpm test:browser` は Playwright による browser verification です。  
主要 UI、入力反映、transport 操作、保存・再読込、import/export、console/page error を確認します。

## Cloudflare Setup

このリポジトリを Cloudflare Pages へ公開するには、**Cloudflare Access**, **Pages Functions**, **D1 binding** の手動設定が必要です。

### 1. Zero Trust の Team domain を確認する

Cloudflare Dashboard の `Zero Trust` を開き、組織の Team domain を確認します。  
この値は `https://<team-name>.cloudflareaccess.com` の形で、Pages Functions 側の Access JWT 検証に使います。

### 2. Access Application を作成する

アプリ全体を認証必須にするため、Pages の本番ホスト名に対して Access Application を作成します。

Cloudflare Dashboard で次を設定します。

1. `Zero Trust`
2. `Access`
3. `Applications`
4. `Add an application`
5. `Self-hosted`
6. Pages の本番ホスト名を指定
7. 許可したいユーザー条件の policy を設定

この構成により、アプリ全体がログイン必須になります。

### 補足: Login method は別途有効化が必要

Cloudflare Access でユーザーが実際にログインできるようにするには、`Zero Trust` の `Settings` から `Authentication` を開き、`Login methods` で利用したい認証方式を有効化してください。  
このアプリのコードは Access が渡す JWT を使うだけなので、ここで選ぶ認証方式が Google、ワンタイム PIN、GitHub などのどれであっても、Access 側で一意なユーザー識別子が出る構成なら動きます。

Functions 側では Cloudflare Access の application token を検証し、その JWT payload の `sub` を優先、なければ `email` を使ってユーザーを識別します。Cloudflare 公式の Access token payload では `sub` はユーザー ID、`email` は認証済みメールアドレスとして説明されています。  
Source: [Application token payload](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/)

### 3. D1 データベースを作成する

Cloudflare Dashboard で次を設定します。

1. `Workers & Pages`
2. `D1 SQL Database`
3. `Create`

作成後、Pages プロジェクトへ binding を追加します。

### 4. Pages プロジェクトに binding / variables を追加する

Pages プロジェクトの設定で以下を追加します。

#### D1 binding

- Binding name: `DB`
- 対象: 作成した D1 データベース

#### Environment variables

- `CLOUDFLARE_ACCESS_DOMAIN`
  - 例: `https://<your-team-name>.cloudflareaccess.com`
- `CLOUDFLARE_ACCESS_AUD`
  - Access Application の Audience tag 値

Pages Functions の Access JWT 検証と D1 接続は、この 3 つの設定を前提にしています。  
Sources: [Cloudflare Access Pages Plugin](https://developers.cloudflare.com/pages/functions/plugins/cloudflare-access/), [Pages Functions bindings](https://developers.cloudflare.com/pages/functions/bindings/), [Wrangler configuration for Pages Functions](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)

### 5. 再デプロイして動作確認する

- Pages を再デプロイ
- Access 保護下でアプリにアクセス
- 初回表示時に `/api/bootstrap` が 200 を返すことを確認
- 編集後に `/api/state` が 200 を返し、再読込後も同じデータが復元されることを確認

## Persistence Model

- 正式な保存先は D1
- ユーザー識別は Access JWT の `sub` を優先し、無ければ `email`
- 保存競合は `updatedAt` ベースの last-write-wins
- ローカル保存は一時キャッシュのみ
- コード入力欄は毎キー入力ではなく、主に blur 時に保存します

## Status

このプロジェクトは個人用ツールとして継続的に更新しています。  
Cloudflare Pages 上での運用を前提に、Android Chrome と PC Chrome の使いやすさを優先しています。
