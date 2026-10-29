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

## CI regression repaired and background lifecycle hardened (29 October)

The original native CI on commit `6385442` reported **three failures in suite_01**, not an aggregator defect. The legacy `native-performance-diagnostics.test.ts` tests expected counters to update with no sampling lease; all three now acquire/release a lease in `try/finally`. The fail-closed aggregator is unchanged. The new dedicated work-sampling suite still explicitly asserts that **closed-HUD counters do not increment**.

A further lifecycle gap was found: an expanded HUD could retain its sampling lease while the app was inactive or backgrounded. The native-only `NativeResidentSamplingLifecycle` now starts sampling only while the focused HUD is expanded **and** `AppState.currentState === "active"`; an inactive/background transition immediately relinquishes its lease, and resuming foreground reacquires exactly one. Collapse, blur and unmount dispose the owner. Duplicate lifecycle events and cleanup are idempotent. Overlapping HUD lifetimes use independent tokens; stale cleanup cannot disable the new observer.

The deterministic regressions now cover 200 residents over 240 frames, a closed/open/closed frame bus, 200 background/foreground transitions with 200 callbacks each, overlapping observers, idempotent cleanup, cumulative totals across background and fresh sampling after resume. These are Node/fake-RAF assertions, not physical FPS, energy or GPU measurements. The native diagnostic and pure helper changed; **no web renderer, GameContext, saves, game speed, resident movement, production or A/B baseline #298** was modified.

Do not label this validation complete before the latest GitHub workflow for the final commit finishes. The distinct Android/iOS/web Expo export jobs demonstrate only JavaScript bundle compatibility, not installable app behavior. On physical devices, still verify a 10-second capture at 25/50/100/200 native sprites (1×/2×/4×), start/collapse/background/resume, and compare #298 versus #297 on the same hardware; do not infer physical FPS from test counts.


## Follow-up: suite_07 CI root cause and full sampling/RAF invariants

The first post-fix workflow (run 40857326192) passed 15 of its 16 independently aggregated native test groups, plus the Android/iOS/web JS bundle exports. Its only failing group, \`suite_07\`, was due to two **over-escaped regular expressions in a source-inspection assertion**, which failed to match the already-present HUD lifecycle calls. This was not a movement fault, nor a reason to disable the fail-closed CI aggregator.

The corrective test commit replaces both patterns with correctly escaped JS regular-expression literals. Two additional deterministic tests now validate:
- Exactly-once lease acquisition/release for repeated \`active\`, \`inactive\`, \`background\` and disposal notifications, including token \`0\` and a newly acquired lease on resume.
- A real \`NativeResidentFrameBus\` with 200 persistent subscriptions over 720 simulated RAF ticks: 48,000 counted native resident callbacks while the HUD is foregrounded, zero **diagnostic** callbacks counted across the middle 240-frame background period, then 48,000 after reactivation, while all 144,000 synthetic resident callbacks still execute. All subscriptions are removed at the end.

The "real frame bus" here refers to the actual TypeScript scheduler run against a fake platform RAF; it is **not a physical device test**. The last failing CI run also still had the general TypeScript baseline errors; the additive regression gate reported none newly introduced. The four A/B scene/fixture files on #297 and #298 were compared directly by Git blob SHA again and are identical.

Rollback remains limited to #297. The #298 baseline, #296, #295, main, gameplay rules, web code and saves remain unmodified. Full native CI and the independent JS bundle exports must be rechecked for the final commit; device FPS/UI-thread/GPU and touch tests remain outstanding.
