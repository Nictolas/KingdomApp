# Native resident start-fault occupancy repair — MyKingdom, 29 October 2026

## Reproducible risk in PR #297

The native resident's neighbor sampler and commute route runner reserve the **destination** cell before calling `face()` and `NativeResidentSegmentRunner.start()`. A sprite initialization failure or native RAF registration exception during the start invalidates the runner, but previously did not reconcile the destination reservation. That could block subsequent residents even though the failed sprite never moved.

This is a verified code-path defect under injected failures, **not a claimed production crash or physical-device FPS change**.

## Native-only fix

- Wrap the two already-claimed segment start paths (free roaming and scripted commute, including shared-home entrance) with a failure-only recovery.
- `nativeResidentRethrowAfterClaimedStartFault` reclaims the settled origin if possible; otherwise it releases the obsolete destination without evicting an unrelated cell owner. It rethrows the **original** failure, even when its value is `null`, `undefined`, `false`, `0`, or an empty string, and even if the rollback callback itself throws.
- No rollback if a newer route already owns the segment. The commute checks its epoch and settled cell; free roaming checks that its logical cell is still the attempted origin.
- Recovery is only in the exceptional start path. It does not add allocations in the per-frame RAF loop, change collision retries, affect the game clock, alter persistence/GameContext or touch the web renderer.

## Regression tests

`tests/native-resident-claimed-start-fault.test.ts` covers origin reclamation, another resident owning the origin, falsy failures, a superseded route and **200 native segment runners × 30 route cycles**. Each cycle injects 40 RAF registration failures (1,200 total), with 4,800 successful arrivals, game speeds 1×/2×/4×, long background/rebase cycles, occupancy invariants and stale callbacks. The suite is included in Native Performance Diagnostics with fail-closed aggregation.

These are deterministic JavaScript simulations, not tests on Android/iPhone hardware. They do not measure UI/GPU FPS, memory, heat, battery, collision touch latency or actual native bridge failure rates.

## Branches and release constraints

PR #297 remains Draft stacked on #296. A/B real sprite fixture remains byte-identical with #298. #295 (marker baseline), #294 (web), GameContext, saves, live release and main are not changed. Verify the full CI after this commit, then compare real hardware with #298 vs #297 at 25/50/100/200 sprites and 1×/2×/4×. No merge/deploy/release.
