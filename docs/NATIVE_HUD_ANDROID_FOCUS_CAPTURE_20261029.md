# Native HUD: Android focus-safe A/B captures (29 October 2026)

## Observed code-level failure mode

The native resident renderer suspends RAF and timer work on Android AppState
`blur` (for example, opening the notification shade while AppState remains
`active`). Before this change the opt-in JS diagnostic HUD watched only
AppState `change`, so it could continue a 10-second A/B capture while the
resident workload was suspended. That is an invalid mixed measurement, not
evidence of better or worse native performance.

## Fix in Draft #297 only

The HUD now reuses the same `NativeResidentAppVisibility` policy as the
native resident scheduler. When expanded on a focused screen, it observes
AppState `change`, Android `blur` and `focus`, and bounded checks for an
initially unknown AppState. Effective foreground transitions jointly control
the HUD's one RAF loop, work-counter sampling lease and 10-second capture.
Losing foreground immediately invalidates the capture; a repeated `active`
event cannot override an outstanding Android blur. A new capture is rejected
while the effective foreground gate is closed. Cleanup removes all observers
and cancels stale RAF callbacks. Collapsed HUDs do not register observers.

## Regression and stress coverage

`tests/native-hud-frame-loop.test.ts` exercises simulated Android
notification-shade blur while AppState stays active, late canceled callbacks,
iOS inactive/background/active transitions, and 200 repeated Android
blur/focus cycles with exactly one HUD RAF and no leaked sampling leases or
observers. Source-boundary assertions check that the React HUD uses the shared
visibility policy and gates the capture button. These are **Node fake-OS
tests**, not hardware measurements.

The native test workflow already runs this test file as an independent suite.
The four A/B sprite fixture files are unchanged and remain Git-blob-identical
to Draft #298. Draft #295 is still the simple-marker baseline; #298 is the
real-sprite A/B baseline for #297. No GameContext, save, game rules, production,
web renderer, merge or deploy is modified.

## Evidence still required

Verify on physical Android that opening the notification shade during a
10-second `/native-perf` capture interrupts it, that a repeated AppState
`active` event does not resume the HUD while blurred, and that a new capture
works after focus returns. Repeat on iPhone with background/foreground.
Then capture matched #298/#297 runs at 25/50/100/200 residents and
1x/2x/4x with separate UI/GPU and physical-touch evidence. No measured
device FPS, GPU benefit, battery gain or release approval is claimed here.
