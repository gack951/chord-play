# Current Implementation Plan

## Goal

Lengthen chord sustain so notes keep sounding until just before the next chord or rest, independent of nominal slot length.

## Constraints

- Client-only; no backend, auth, or cloud sync
- TypeScript + pnpm + Vite
- Web Audio API based playback
- Local persistence only
- Timing stability and low-latency sync take priority over synthesis realism
- Browser automation is required for UI-facing changes
- Keep the implementation modular across parser, music, audio, state, and UI

## Current State

- Parser, transport, preview click cue/resume, anticipation, and playback are implemented
- Remaining playback issue:
  - note lengths still follow relatively short slot-derived durations
  - user wants sustain to continue until 0.125 beats before the next chord or rest

## Target Design

### Timing

- Derive each slot's release boundary from the next slot start or progression end
- Subtract a 0.125-beat gap before the next chord/rest
- Keep anticipation timing compatible with the new sustain rule
- Apply the longer sustain to block and arpeggio note events

### Verification

- Add/update unit coverage for the new sustain timing
- Keep browser verification green to ensure no runtime regressions
- Update `README.md` timing notes

## Files To Change

- `PLANS.md`
- `README.md`
- `src/music/**`
- `test/**`

## Risks

- Longer sustain can cause unintended overlap if release boundaries are wrong
- Arpeggio note durations must remain positive after subtracting the release gap
- Final-chord release should still stop cleanly before transport end

## Validation Steps

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:browser`
- `pnpm build`

## Rollback / Fallback Strategy

- Keep the change localized to event-duration generation in music timing
- Preserve start-time generation and only revise release/end calculation if needed
