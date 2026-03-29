# Current Implementation Plan

## Goal

Move persistence from browser-local storage to authenticated Cloudflare-backed storage.

Target outcome:

- the whole app is protected by Google login through Cloudflare Access
- user data is stored per authenticated account in D1
- writes use `updatedAt`-based last-write-wins
- local persistence is reduced to temporary cache only
- progression text avoids aggressive autosave and syncs on blur

## Constraints

- Cloudflare Pages deployment already exists
- Authentication should use Google accounts through Cloudflare services
- Browser-only UI remains, but persistence and identity move server-side
- Existing local saved data can be ignored rather than migrated
- Timing-sensitive playback behavior must remain intact
- Browser automation remains required for UI and persistence-related changes

## Current State

- App state is persisted directly in `localStorage`
- No server-side API exists
- No authentication exists
- Saved songs and synth presets are fully local

## Target Design

### Auth and Request Flow

- Protect the app with Cloudflare Access
- Validate Access JWTs in Pages Functions
- Identify the user from Access identity data
- Expose authenticated JSON endpoints for app state load/save

### Persistence

- Store per-user state in D1
- Keep one canonical remote app-state document per user
- Use `updatedAt` timestamps with last-write-wins semantics
- Keep a temporary local cache only for short-lived recovery and startup fallback

### Client Behavior

- On startup:
  - fetch authenticated remote state
  - fall back to cache only if remote is temporarily unavailable
- On edits:
  - progression text saves on blur
  - discrete controls save on change
  - remote writes compare timestamps and keep the newest state

### Local Development

- Provide a local API path for browser tests and development without requiring live Cloudflare auth
- Keep production-oriented server logic reusable between local and Pages environments

## Files To Change

- `PLANS.md`
- `README.md`
- `package.json`
- `vite.config.ts`
- `src/state/**`
- `src/ui/**`
- `src/types/**`
- `src/server/**`
- `functions/**`
- `test/**`
- `e2e/**`
- Cloudflare config files as needed

## Risks

- Access and D1 require manual Cloudflare dashboard setup outside the repo
- Local dev and browser test setup can drift from production behavior if server logic is duplicated
- Last-write-wins can still overwrite edits from another device if both sides edit concurrently
- Removing durable local persistence increases dependence on remote availability

## Validation Steps

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:browser`
- `pnpm build`

## Rollback / Fallback Strategy

- Keep remote persistence behind a small client abstraction
- Preserve temporary cache as a safety net for transient failures
- Keep local dev API compatible with production request/response shapes
