# Native resident touch-policy render gating — 29 October 2026

## Scope
Draft #297 only, stacked on #296. No web renderer, GameContext, persistence, gameplay rule, release or production change. The #298 A/B laboratory baseline remains untouched.

## Bottleneck and change
The native resident already moves its visual sprite and Pressable hit target with `Animated.ValueXY`. Previously, **every** completed idle or commute segment called `setLogicalCell`, forcing a React body render even if the new cell had the same touch pass-through policy as the old cell. This can affect 200 moving residents. The authoritative movement cell has always been `cellRef.current`.

The new `nativeResidentNeedsTouchRender` predicate requests a React state publication only for first mount and when the boolean value of `passTouchesToMapOnCell` changes between the previous and destination cell. `publishCell` updates the authoritative ref **before** testing the policy. The native component now evaluates the live ref on subsequent parent-prop renders, so changes to buildings/demolition mode or touch callback do not reuse a stale React state cell. Removing the old state-to-ref effect also prevents a delayed state render from overwriting a newer native movement cell.

This preserves touch pass-through, press/double press, occupancy, commute notifications, idle timing, fixed/home transitions, pause/4× and sprite position. The parent still rerenders a body normally for changed props. A same-policy movement only skips the redundant React publication; it does not skip movement or its native animation.

## Verification and limitations
`npx tsx --test tests/native-resident-touch-render-gate.test.ts` checks first mount, same-policy moves, both directions of footprint boundary, callback replacement, six arrival sites, and a deterministic 200-resident × 240-leg model. `npx tsx tests/native-resident-touch-render-gate-benchmark.ts` reports decision counts and Node elapsed times over five alternating runs. **Counts are a theoretical upper bound on avoided state publications, not measured React commits or actual device performance.** Both are included in the independent native CI workflow. JS bundle smoke checks Android, iOS and web separately.

Still required before any merge: paired physical #298 vs #297 captures with identical real sprites and workload, React render counts, UI/GPU frame traces, memory, touch/pass-through at house footprints, foreground/background, pause and 1×/2×/4× on Android and iPhone. No FPS or device performance claim until those tests are completed.
