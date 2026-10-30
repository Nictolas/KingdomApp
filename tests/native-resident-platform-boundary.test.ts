import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const shared = read("../src/components/MapWandererCharacter.tsx");
const native = read("../src/components/MapWandererCharacter.native.tsx");
const segment = read("../src/performance/nativeResidentSegmentProgress.ts");
const runner = read("../src/performance/nativeResidentSegmentRunner.ts");
const map = read("../app/mappa.tsx");

function propsSignature(source: string): string {
  const match = source.match(/type MapWandererCharacterProps = \{[\s\S]*?\n\};/);
  assert.ok(match, "Component must export the same resident props type");
  return match[0];
}

test("native-specific movement does not alter the web resident renderer", () => {
  assert.ok(!shared.includes("Animated.ValueXY"), "the web/default resident renderer should retain state-based position");
  assert.ok(!shared.includes("PendingCommuteRetry"), "the web/default resident renderer must not inherit the experiment");
  assert.match(shared, /setPixelPos\(/);
  assert.match(native, /Animated\.ValueXY/);
  assert.match(native, /NativeResidentSegmentRunner/);
  assert.match(runner, /NativeResidentSegmentProgress/);
  assert.match(segment, /PauseAwareMotionClock/);
  assert.match(native, /PendingCommuteRetry/);
});

test("native/default residents share an identical prop contract", () => {
  assert.equal(propsSignature(native), propsSignature(shared));
});

test("map imports resident component without an extension, for Metro platform resolution", () => {
  assert.match(map, /from ["']\.\.\/src\/components\/MapWandererCharacter["']/);
  assert.ok(!map.includes("MapWandererCharacter.native.tsx"));
});

test("only native residents use the shared frame dispatcher and imperative sprite frames", () => {
  assert.match(native, /from ["']\.\.\/performance\/nativeResidentFrameBus["']/);
  assert.match(native, /requestFrame: requestResidentAnimationFrame/);
  assert.match(native, /subscribeFrame: subscribeResidentAnimationFrames/);
  assert.match(native, /cancelFrame: cancelResidentAnimationFrame/);
  assert.match(runner, /subscribeFrame\?:/);
  assert.match(read("../src/performance/nativeResidentFrameBus.ts"), /subscribeFrame\(callback: ResidentFrameCallback\)/);
  assert.equal((native.match(/motion\.start\(/g) ?? []).length, 2, "both native movement paths share runner");
  // A route replacement/home transition must STOP walking, not only cancel
  // the RAF. cancel() remains valid for final unmount cleanup.
  // Terminal paths now share one stop-and-reconcile helper, so counting
  // repeated motion.stop() call sites would reject a correct refactor.
  assert.match(native, /const stopAndReconcile = useCallback/);
  // Cleanup is passed as a stable function to the fault-safe coordinator,
  // rather than called directly and skipped when another cleanup throws.
  assert.ok(native.split("nativeResidentRunCleanup(").length - 1 >= 6);
  assert.ok(native.split("stopAndReconcile").length - 1 >= 4);
  assert.ok((native.match(/motion\.stop\(\)/g) ?? []).length >= 3);
  assert.match(native, /motion\.cancel\(\)/);
  assert.ok(!native.includes("rafRef"), "no duplicated per-component RAF loop");
  assert.ok(!native.includes("rafRef.current = requestAnimationFrame(step)"));
  assert.match(native, /advanceSprite: \(elapsedMs\) => spriteFrames\.advanceElapsed\(elapsedMs\)/);
  assert.match(native, /<Animated\.Image/);
  assert.match(native, /left: spriteSheetOffset/);
  assert.equal((native.match(/setWalkFrame\(/g) ?? []).length, 0, "walking frame never commits React state");
  assert.ok(!shared.includes("NativeResidentSpriteFrameDriver"), "web renderer must not import native sprite driver");
  assert.ok(!shared.includes("nativeResidentFrameBus"), "the web renderer must not import native dispatcher");
  assert.ok(!shared.includes("subscribeResidentAnimationFrames"), "web must not use persistent native RAF");
});

test("only native movement subscribes to pause/background and guards idle/claim timers", () => {
  assert.match(native, /subscribeNativeResidentFrameBusActivity/);
  assert.match(native, /isNativeResidentFrameBusActive\(\)/);
  assert.match(native, /getOrologioGiocoInPausaSnapshot\(\)/);
  assert.match(native, /pendingCommuteRetry\.take\(\)/);
  assert.ok(!shared.includes("nativeResidentFrameLifecycle"));
  assert.ok(!shared.includes("NativeResidentSegmentProgress"));
  assert.ok(!shared.includes("NativeResidentSegmentRunner"));
});

test("native idle/retry timers use shared queue, not independent platform timeouts", () => {
  assert.match(native, /from ["']\.\.\/performance\/nativeResidentTimerQueue["']/);
  assert.match(native, /new NativeResidentOwnedTimer\(scheduleNativeResidentTimer, cancelNativeResidentTimer\)/);
  assert.match(native, /const clearIdle = useCallback\(\(\) => wakeTimer\.cancel\(\)/);
  assert.match(read("../src/performance/nativeResidentOwnedTimer.ts"), /class NativeResidentOwnedTimer/);
  assert.equal((native.match(/setTimeout\(/g) ?? []).length, 0);
  assert.equal((native.match(/clearTimeout\(/g) ?? []).length, 0);
  assert.ok(!shared.includes("nativeResidentTimerQueue"), "web renderer retains original timer behavior");
});

test("activity changes preserve existing scheduled timers instead of restarting them", () => {
  const handler = native.slice(native.indexOf("const onResidentActivityChanged = useCallback("));
  assert.match(handler, /if \(!active\) return;/);
  assert.match(handler, /if \(wakeTimer\.pending\) return;/);
  assert.ok(!handler.split("  useEffect(() => {")[0]!.includes("clearIdle()"));
  assert.match(native, /wakeTimer\.schedule\(\(\) => \{\s*pickNextMoveRef\.current\(\)/);
});

test("native memoization keeps parent handlers live without hiding motion or touch changes", () => {
  const relay = read("../src/performance/nativeResidentCallbackRelay.ts");
  assert.match(native, /const MemoNativeResidentBody = React\.memo\(NativeResidentBody\)/);
  assert.match(native, /React\.useLayoutEffect\(\(\) => \{ relay\.current\?\.update\(props\); \}\)/);
  assert.match(native, /<MemoNativeResidentBody \{\.\.\.props\} \{\.\.\.relay\.current\.bound\(props\)\} \/>/);
  assert.match(native, /if \(__DEV__\) markNativeResidentWrapperInvocation\(\)/);
  assert.match(native, /if \(__DEV__\) markNativeResidentRenderInvocation\(\)/);
  assert.ok(!shared.includes("NativeResidentCallbackRelay"));
  assert.ok(!shared.includes("React.memo"));
  for (const predicate of ["isWalkable", "isRoadCell", "passTouchesToMapOnCell"]) {
    assert.ok(!relay.includes(predicate + ":"), predicate + " must remain a normal render prop");
  }
});

test("native lifecycle is driven by one clock gate, not 200 React pause subscriptions", () => {
  const lifecycle = read("../src/performance/nativeResidentFrameLifecycle.native.ts");
  const hook = read("../src/hooks/useGiocoInPausa.ts");
  assert.match(hook, /useSyncExternalStore/);
  assert.match(lifecycle, /subscribeOrologioGiocoInPausa/);
  const coordinator = read("../src/performance/nativeResidentSchedulerActivity.ts");
  // The single clock gate reaches both schedulers via a shared fault-safe
  // coordinator. Verify the link and ordering instead of obsolete inline code.
  assert.match(lifecycle, /applyNativeResidentSchedulerActivity\(\s*active,\s*setNativeResidentTimerQueueActive,\s*setNativeResidentFrameBusActive/);
  assert.match(coordinator, /setTimerActive\(active\)/);
  assert.match(coordinator, /setFrameActive\(active\)/);
  assert.ok(coordinator.indexOf("setTimerActive(active)") < coordinator.indexOf("setFrameActive(active)"),
    "timer pause must precede frame-bus pause");
  assert.match(coordinator, /if \(failed\) throw firstError;/);
  assert.ok(!native.includes("useGiocoInPausa("),
    "200 native sprite bodies must not subscribe to React pause state");
  assert.ok(!native.includes("prevGiocoInPausaRef"),
    "no redundant per-resident React pause effect");
  assert.match(native, /activityConfigRef = useRef/);
  assert.match(native, /activityConfigRef\.current = \{ fixedCell, commutePath, disableIdleRoam \}/);
  assert.match(native, /const \{ fixedCell, commutePath, disableIdleRoam \} = activityConfigRef\.current/);
  assert.match(native, /subscribeNativeResidentFrameBusActivity\(onResidentActivityChanged\)/);
  assert.match(native, /\}, \[pendingCommuteRetry, tapRecognizer, wakeTimer\]\)/);
  assert.match(native, /tapRecognizer\.reset\(\);\s+if \(!active\) return;/);
  assert.ok(!shared.includes("activityConfigRef"), "web resident remains unchanged");
});
