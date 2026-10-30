# Native resident lifecycle: React pause subscription removal (PR #297)

## Scope and motivation

This change is **native-only** (`MapWandererCharacter.native.tsx` and
`NativeResidentFrameBus`). It does not alter web Phaser, GameContext,
game rules, resident path selection, collision ownership, saved games,
navigation, or the 1×/2×/4× motion model.

Previously each mounted resident called `useGiocoInPausa()`, which uses
`useSyncExternalStore` on the global game-pause store. A map with 200
residents therefore had **200 additional React subscriptions** to the same
pause flag, alongside the single native module lifecycle subscription.
Every manual pause/unpause or phase lock could schedule React updates of
all resident bodies. The native scheduler already received that transition
synchronously through `NativeResidentFrameLifecycle` and the frame bus.

## Implementation

1. The native resident body no longer calls `useGiocoInPausa()`, nor does it
   maintain a redundant pause-effect/previous-value ref. The global lifecycle
   module remains the **single subscription** to the game-pause store for the
   resident scheduling system. The hook is unchanged and remains available to
   other screens and the web renderer.
2. Each mounted native resident still has **one frame-bus activity callback**,
   required to resume idle wandering and deferred collision retries after a
   foreground or game-pause transition. That callback is stable across route,
   fixed-cell and roaming changes. A `useLayoutEffect`-updated ref exposes
   the **committed** props to the callback; it does not read uncommitted
   values from an aborted React render.
3. The frame bus now checks listener membership during a transition. If one
   callback synchronously unmounts another resident, the unmounted listener
   is skipped even if it was present when the dispatch snapshot was created.
   Unsubscription remains idempotent.
4. Read-only `activityListeners` was added to the frame-bus snapshot to
   make listener leaks observable in deterministic tests. No identifiers,
   positions or game data are recorded.

The reduction is **200 React pause subscriptions to zero in the native
resident bodies**, while the shared lifecycle still owns one game-pause
subscription. This is a structural count from code, **not a measured FPS
or CPU improvement**. The per-resident frame-bus listeners are intentionally
retained; they are not React subscriptions and only run on activity changes.

## Verification

- `native-resident-platform-boundary.test.ts` ensures that native residents
  do not subscribe to React pause state, the global gate still controls both
  timer queue and frame bus, committed route props remain accessible, and the
  web/default renderer remains separate.
- `native-resident-frame-bus.test.ts` adds a 200-resident lifecycle stress
  test with 1,000 simulated route updates and 20 pause/resume cycles, plus
  tests for synchronous unmount during dispatch and complete listener cleanup.
- `native-resident-lifecycle-integration.test.ts` uses the actual
  `NativeResidentTimerQueue`, `NativeResidentFrameBus` and
  `NativeResidentActivityGate` with a deterministic fake OS. It schedules
  200 idle timers, pauses after 400 ms, changes routes, unmounts 50 residents,
  backgrounds the app, and resumes with **600 ms of active delay remaining**.
  It checks that 150 callbacks run exactly once, in cooperative 32-callback
  batches, with no background execution or stale unmounted callback.
- Android/iOS/web JavaScript export smoke tests and the existing native
  diagnostics suite are run by `.github/workflows/native-perf-diagnostics.yml`.
  These are **not physical device tests**.

## Limits and manual validation

The structural subscription reduction should reduce avoidable React work on
pause transitions; the actual effect on touch latency, UI-thread FPS, JS
frame pacing and battery **must be measured on Android/iOS devices**.
The next manual comparison should use 25/50/100/200 live residents, 10-second
JS frame samples at 1×/2×/4×, a manual pause and resume, and an app
background/foreground cycle. Confirm no resident teleports, no duplicate
arrival/collision events, correct hit targets and no motion during pause.

The PR remains Draft and stacked on #296 → #295. Do not merge or release
based on synthetic tests alone.
