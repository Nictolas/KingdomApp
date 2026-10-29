# Native RAF fault isolation — 29 ottobre 2026

**Scope:** PR Draft #297, experimental Android/iOS-native scheduler. This is NOT a release, a gameplay change, or a physical FPS result.

## Defect and fix

The shared native RAF bus uses a one-shot queue and persistent subscribers for roughly 200 residents. The same bus publishes app/game activity transitions to idle and movement listeners.

Both RAF dispatch and lifecycle notification collected the first callback exception using `firstError === null` as a sentinel. JavaScript permits `throw null`, `throw undefined`, `throw false`, `throw 0`, and `throw ""`. Consequently, such values could be silently swallowed; if a later callback threw an `Error`, that later error replaced the actual first failure.

Now both paths use an explicit boolean `hasError` and preserve the first thrown value, without stopping delivery to eligible sibling subscribers. The existing `finally` cleanup still re-arms at most one RAF or holds work during suspension. No resident identifiers, world state, storage, game rules, GameContext, save data or web renderer were changed.

## Regression matrix (synthetic, deterministic)

`tests/native-resident-raf-falsy-errors.test.ts` contains five scenarios:

1. 200 one-shot residents: first throws `undefined`, second throws an `Error`; the original failure is propagated and 198 healthy siblings still dispatch.
2. 200 persistent subscribers: the first five throw falsy values; 195 remaining walkers continue, canceled subscriptions do not leak, and background/foreground resumes with a rebase.
3. 200 activity listeners: first throws `false` and four others throw falsy values; all listeners receive the state transition; unmount cleanup releases all listeners.
4. Reentrant pause/resume during an activity callback followed by `throw ""`: older transition callbacks are not delivered after the newer state.
5. 200 one-shots: the first triggers nested pause/resume and `throw undefined`; the other 199 wait until the next rebased frame.

The native diagnostic workflow runs these cases alongside existing movement, timer, touch, collision and 200-resident stress tests. Results must be checked on the latest branch SHA before any claim of passing.

## Validation boundaries and remaining evidence

- This checks JS dispatch semantics with a fake RAF, **not native FPS, UI/GPU frame time, energy, or human touch latency**.
- Keep #295 (marker baseline), #296 (native persistent RAF), #297 (timer/RAF optimizations), #298 (real-sprite A/B baseline) and #294 (Phaser web benchmark) isolated.
- Confirm the actual Android/iOS/web **JS bundle** results separately from Node tests; exports are not native installable builds.
- On physical Android and iPhone devices, compare #298 against #297 for the same 25/50/100/200 real-sprite scenes and 1×/2×/4×, pause/resume, background, collision retry, tap and double tap. No performance improvement or FPS claim is valid without captures on those devices.
- General CI may remain red for pre-existing TypeScript diagnostics, which should be reported separately from the native regression gate.

No merges, production deploys, destructive operations or release changes in this block.
