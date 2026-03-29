# Current Implementation Plan

## Goal

Replace the fixed instrument list with a configurable ADSR synthesizer, persist synth presets locally, include presets in JSON import/export, and allow songs to select from saved presets.

## Constraints

- Client-only; no backend, auth, or cloud sync
- TypeScript + pnpm + Vite
- Web Audio API based playback
- Local persistence only
- Timing stability and low-latency sync take priority over synthesis realism
- Browser automation is required for UI-facing changes
- Keep the implementation modular across audio, state, and UI
- The old first three instruments are removed; the default preset should match current `debug-hold` behavior as closely as practical

## Current State

- Songs currently store a fixed `instrument` string
- Local storage and JSON export contain only song data
- AudioEngine derives tone directly from hard-coded instrument branches
- UI exposes a simple instrument select with four built-in options

## Target Design

### Data Model

- Introduce synth preset entities with:
  - `id`
  - `name`
  - oscillator waveform
  - filter cutoff
  - attack
  - decay
  - sustain
  - release
- Store presets alongside songs in app state
- Songs store `synthPresetId` instead of fixed instrument IDs
- Bump export schema version and keep practical backward compatibility for earlier song-only exports

### Audio

- Replace hard-coded instrument branches with parameter-driven ADSR scheduling
- Use the new default preset as the migration target for old songs
- Keep note logging and timing behavior intact

### UI

- Replace the instrument select with a saved preset select
- Add editable ADSR controls and waveform/filter parameters
- Add a save/update preset action so edited values persist locally
- Keep mobile usability acceptable without hiding transport controls

### Verification

- Update state tests for schema migration and preset import/export
- Update browser tests for preset selection/edit/save/import paths
- Keep transport and parser coverage green

## Files To Change

- `PLANS.md`
- `README.md`
- `src/types/**`
- `src/state/**`
- `src/audio/**`
- `src/ui/**`
- `test/**`
- `e2e/**`

## Risks

- Schema migration can break existing local data if defaults are wrong
- Songs can reference missing presets after import/merge unless repaired
- ADSR release settings can unintentionally reintroduce short perceived note lengths
- UI growth can hurt mobile layout if controls become too dense

## Validation Steps

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:browser`
- `pnpm build`

## Rollback / Fallback Strategy

- Keep preset definitions centralized so migration can fall back to one built-in default preset
- Preserve import support for prior schema versions instead of hard-failing old exports
- If preset CRUD becomes too large, keep a single editable saved preset path first rather than a larger redesign
