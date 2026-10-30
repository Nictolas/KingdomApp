import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";
import { NativeResidentSegmentRunner } from "../src/performance/nativeResidentSegmentRunner.ts";
import { NativeRealFixtureOccupancy } from "../src/performance/nativeRealResidentFixture.ts";
import {
  nativeResidentReconcileInterruptedClaim, nativeResidentRunCleanup
} from "../src/performance/nativeResidentRouteTransitions.ts";

// Deterministic fake-native scheduler only: no on-device FPS measurements.
test("failed RAF cancel still resets the native walking state", () => {
  let walking = false;
  let cancellations = 0;
  const failure = new Error("native bridge cancel failed");
  const runner = new NativeResidentSegmentRunner({
    requestFrame: () => 1,
    subscribeFrame: () => 17,
    cancelFrame: () => { cancellations++; throw failure; },
    readTimeScale: () => 1,
    writePositionXY: () => {},
    advanceSprite: () => {},
    setWalking: moving => { walking = moving; }
  });
  runner.start({
    from: { x: 0, y: 0 }, to: { x: 50, y: 0 },
    startTimestamp: 0, durationMs: 1000, onArrival: () => {}
  });
  assert.equal(walking, true);
  assert.throws(() => runner.stop(), error => error === failure);
  assert.equal(walking, false);
  assert.equal(runner.snapshot().active, false);
  assert.equal(runner.snapshot().scheduled, false);
  runner.stop();
  assert.equal(cancellations, 1);
});

test("all terminal cleanup tasks run; falsy first exception is preserved", () => {
  for (const thrown of [null, undefined, 0, false, ""]) {
    const called: string[] = [];
    let observed = false;
    try {
      nativeResidentRunCleanup(
        () => { called.push("cancel"); throw thrown; },
        () => { called.push("release"); throw new Error("secondary"); },
        () => { called.push("unmount"); }
      );
    } catch (error) { observed = true; assert.equal(error, thrown); }
    assert.equal(observed, true);
    assert.deepEqual(called, ["cancel", "release", "unmount"]);
  }
  const events: string[] = [];
  nativeResidentRunCleanup(() => events.push("stop"), () => events.push("release"));
  assert.deepEqual(events, ["stop", "release"]);
});

test("200 walkers x 30 interrupted routes: 1,200 cancel faults leave no ghost occupancy", () => {
  const occupancy = new NativeRealFixtureOccupancy();
  const frames = new Map<number, (at: number) => void>();
  const obsolete: Array<(at: number) => void> = [];
  let nextFrame = 0;
  let speed = 1;
  const bus = new NativeResidentFrameBus(
    cb => { const id = ++nextFrame; frames.set(id, cb); return id; },
    id => { const cb = frames.get(id); if (cb) obsolete.push(cb); frames.delete(id); }
  );
  const walking = Array<boolean>(200).fill(false);
  const arrivals = Array<number>(200).fill(0);
  const runners = Array.from({ length: 200 }, (_, i) =>
    new NativeResidentSegmentRunner({
      requestFrame: cb => bus.request(cb),
      subscribeFrame: cb => bus.subscribeFrame(cb),
      cancelFrame: id => {
        bus.cancel(id);
        if (i % 5 === 0) throw new Error("injected cancel fault");
      },
      readTimeScale: () => speed,
      writePositionXY: () => {},
      advanceSprite: () => {},
      setWalking: moving => { walking[i] = moving; }
    })
  );
  for (let i = 0; i < 200; i++) assert.equal(occupancy.tryClaim(i, i), true);
  let failures = 0;
  for (let cycle = 0; cycle < 30; cycle++) {
    speed = [1, 2, 4][cycle % 3]!;
    const at = cycle * 2000;
    for (let i = 0; i < 200; i++) {
      assert.equal(occupancy.tryClaim(i, i + 200), true);
      runners[i]!.start({
        from: { x: i, y: 0 }, to: { x: i + 200, y: 0 },
        startTimestamp: at, durationMs: 1000,
        onArrival: () => { arrivals[i]!++; }
      });
    }
    assert.equal(frames.size, 1);
    const [id, cb] = frames.entries().next().value!;
    frames.delete(id);
    cb(at + 50);
    if (cycle % 4 === 0) bus.setActive(false);
    for (let i = 0; i < 200; i++) {
      let failed = false;
      try {
        nativeResidentRunCleanup(
          () => runners[i]!.stop(),
          () => nativeResidentReconcileInterruptedClaim(
            i, cell => occupancy.tryClaim(i, cell), () => occupancy.release(i)
          )
        );
      } catch (error) {
        failed = true;
        assert.match(String(error), /injected cancel fault/);
        failures++;
      }
      assert.equal(failed, i % 5 === 0);
      assert.equal(walking[i], false);
      assert.equal(runners[i]!.snapshot().active, false);
    }
    assert.equal(occupancy.snapshot().occupied, 200);
    assert.equal(occupancy.checkInvariants(), true);
    assert.equal(bus.snapshot().continuousSubscribers, 0);
    assert.equal(frames.size, 0);
    const priorArrivals = [...arrivals];
    for (const cb of obsolete.splice(0)) cb(at + 10000);
    assert.deepEqual(arrivals, priorArrivals);
    if (cycle % 4 === 0) bus.setActive(true);
  }
  assert.equal(failures, 1200);
  assert.deepEqual(arrivals, Array<number>(200).fill(0));
  for (let i = 0; i < 200; i++) occupancy.release(i);
  assert.equal(occupancy.snapshot().occupied, 0);
  assert.equal(bus.snapshot().queued, 0);
});

test("native component guards route, fixed home, idle and unmount; web remains separate", () => {
  const native = readFileSync(new URL("../src/components/MapWandererCharacter.native.tsx", import.meta.url), "utf8");
  const web = readFileSync(new URL("../src/components/MapWandererCharacter.tsx", import.meta.url), "utf8");
  for (const expected of [
    "const stopAndReconcile = useCallback",
    "nativeResidentRunCleanup(",
    "nativeResidentReconcileInterruptedClaim(",
    "nativeResidentRunCleanup(clearIdle, () => motion.stop(), () => releaseMyCellRef.current?.())",
    "nativeResidentRunCleanup(clearIdle, stopAndReconcile)",
    "() => motion.cancel(),",
    "() => releaseMyCellRef.current?.()"
  ]) assert.ok(native.includes(expected), "missing protected cleanup: " + expected);
  assert.ok(!web.includes("nativeResidentRunCleanup("));
});
