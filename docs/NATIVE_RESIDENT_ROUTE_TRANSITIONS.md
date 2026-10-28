# Native resident route transitions — commute, night and idle (28 October 2026)

## Confirmed source-level regression and scope

In `MapWandererCharacter.native.tsx`, React runs the commute effect before the fixed-home and morning-wake effects. When `fixedCell` changed together with `commutePath`, the latter effects could call `motion.cancel()` after a valid commute had already started. A remembered night cell could also snap the sprite back home after the commute path was removed. Finally, removing a completed commute canceled its scheduled idle timeout, potentially leaving the resident stopped indefinitely until another activity transition.

The native-only route arbitration now explicitly prioritizes a valid commute path (length >= 2) over the fixed-home anchor, consumes a night exit once, invalidates stale remembered exits when commuting, and re-arms idle when a completed commute is cleared or roaming is re-enabled. The rearm is guarded by active app/game state, valid logical position, no ongoing movement and no existing timer. Pauses and background never initiate movement. The existing `NativeResidentTimerQueue` remains the sole timer scheduler.

## Verification and limits

`tests/native-resident-route-transitions.test.ts` covers simultaneous home/commute updates, route clearing, repeated wake-up, disabled roaming, and a deterministic 200-resident × 200-cycle (40,000 transitions) stress model. A source boundary test confirms the native renderer uses the arbiter and the web renderer does not. The native diagnostic workflow runs the tests and JavaScript bundles separately.

These are **pure transition and source-level tests**, not a mounted React integration test, a physical touch test, or Android/iPhone FPS. Mid-segment cancellation by an external route replacement remains a distinct occupancy/position consistency scenario requiring targeted follow-up and device checks; the idle rearm deliberately does not fire while the sprite reports movement. No GameContext, save data, world clock, gameplay design, web renderer, main branch, merge or release is changed.

The A/B fixture files in #297 and #298 remain byte-identical; this correction is **only on the candidate #297**, so a route-transition correctness comparison must account for it separately from pure movement FPS.
