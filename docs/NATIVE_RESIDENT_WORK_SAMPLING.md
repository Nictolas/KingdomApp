# Native 200-resident diagnostics: opt-in work counters (29 October 2026)

## Scope and implementation
Draft #297 only, stacked on #296 and #295. No changes to web Phaser, GameContext, saved games, gameplay rules, native timer deadlines, movement speed, touch policy or production release.

Previously, each native resident frame called the development work-counter function, which incremented aggregate values even when the HUD was closed. With 200 moving residents this meant thousands of unnecessary development-only increments per second, although the closed HUD had no reader. This also made later readings depend on how long the app had run with diagnostics hidden.

The new tokenized work-sampling lease starts when a focused native HUD is expanded and ends on collapse, navigation blur or unmount. Multiple leases are safe: an old cleanup cannot disable a newer observer. The hot path checks one boolean and does not allocate. Closing the final lease clears only short-window counts; cumulative render invocation totals remain available for correctly delimited 10-second snapshot differences. All counters remain aggregate, memory-only and non-identifying.

The native sprite runner passes its diagnostic callback directly in development and no callback in production, avoiding one closure per resident and the no-op callback invocation in release builds. The shared RAF dispatcher also no longer allocates an empty fallback array on continuous-only frames with no one-shot requests. The existing native RAF and timer schedulers are otherwise unchanged.

## Verification
`tests/native-resident-work-sampling.test.ts` exercises:
- 200 residents × 240 callbacks with the HUD closed: zero increments.
- Two concurrent sampling leases, stale/idempotent cleanup, cumulative snapshots and reopening.
- The actual `NativeResidentFrameBus` with 200 persistent subscribers for 720 synthetic frames (closed/open/closed), one fake platform RAF per frame, no leaked subscribers.
- Static boundary checks for native-only wiring, no change to web renderer or game clock.

The test is included in the dedicated native CI workflow and is not an Android/iOS device benchmark. The 48,000 callbacks per active 240-frame window are deterministic fake-RAF invocations, not measured FPS or CPU time. No claim of improved physical FPS, battery, memory or GPU performance is justified until #298/#297 are profiled on the same Android and iPhone hardware. Bundled JS exports are not installable apps.

## Risk and rollback
This changes what **development diagnostics count while the HUD is closed**, not how residents move. The HUD still samples aggregate callbacks and render invocations while focused and expanded. If an unexpected diagnostic consumer needs counts with no open HUD, it must explicitly acquire a sampling lease. Rollback is the single commit on #297; #298 remains an untouched A/B baseline. No merge, deploy or release.
