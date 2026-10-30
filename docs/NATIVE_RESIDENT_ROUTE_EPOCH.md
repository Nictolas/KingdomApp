# Native route epoch: protection against stale commute callbacks

The native resident renderer reuses a single PendingCommuteRetry instance across
commutes. A canceled timer or obsolete segment arrival could be delivered after
a new route has installed a pending retry. Without ownership validation, the
old callback could consume the new route's retry, clear its timer reference,
or report an obsolete arrival.

Each commute effect now captures a NativeResidentRouteEpoch token. Cleanup
invalidates the token before canceling the timer or animation. Both 900 ms
retry closures validate ownership BEFORE touching the timer reference or
PendingCommuteRetry. The delayed repath fallback, runOneSegment, stepChain
and segment arrival also reject callbacks from superseded routes.

The threshold (3 failures), 900 ms retry delay, 1x/2x/4x motion, occupancy,
gameplay rules, web renderer, GameContext and saves are unchanged.

Synthetic validation: tests/native-resident-route-epoch.test.ts runs 200
actual collision retry controllers and shared native timers through 40 route
replacements each, with 8,000 stale and 8,000 live logical callbacks, manual
pause, background/foreground, canceled platform callback delivery, and a
source-level check that both native timer branches guard ownership. This is
correctness testing in Node with a fake platform, not device FPS evidence.

Hardware gate: compare #298 (pre-timer renderer) against #297 with the same
real-sprite fixture, 25/50/100/200 residents, 1x/2x/4x and three captures per
scenario on Android and iPhone. Check reroute, collision, touch, pause,
background and home entry visually. Do not merge or release on Node results.
