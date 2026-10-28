import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";
import { NativeResidentSegmentRunner } from "../src/performance/nativeResidentSegmentRunner.ts";
import { NativeRealFixtureOccupancy } from "../src/performance/nativeRealResidentFixture.ts";
import {
  nativeResidentReconcileInterruptedClaim,
  nativeResidentReleaseMismatchedRouteOrigin,
  nativeResidentReleaseSharedHomeArrival
} from "../src/performance/nativeResidentRouteTransitions.ts";

test("200 real runners reconcile 4,000 interrupted destination claims across pause and 1x/2x/4x", () => {
  const occupancy = new NativeRealFixtureOccupancy();
  const frames = new Map<number, (at: number) => void>();
  const stale: Array<(at: number) => void> = [];
  let nextFrame = 0;
  let speed = 1;
  let writes = 0;
  const bus = new NativeResidentFrameBus(
    callback => { const id = ++nextFrame; frames.set(id, callback); return id; },
    id => { const callback = frames.get(id); if (callback) stale.push(callback); frames.delete(id); }
  );
  const walking = Array<boolean>(200).fill(false);
  const arrivals = Array<number>(200).fill(0);
  const runners = Array.from({ length: 200 }, (_, i) =>
    new NativeResidentSegmentRunner({
      requestFrame: callback => bus.request(callback),
      subscribeFrame: callback => bus.subscribeFrame(callback),
      cancelFrame: id => bus.cancel(id),
      readTimeScale: () => speed,
      writePositionXY: (x, y) => {
        assert.ok(Number.isFinite(x) && Number.isFinite(y));
        writes++;
      },
      advanceSprite: () => {},
      setWalking: moving => { walking[i] = moving; }
    })
  );
  for (let i = 0; i < 200; i++) assert.equal(occupancy.tryClaim(i, i), true);

  const dispatch = (at: number) => {
    assert.equal(frames.size, 1, "200 active residents require one OS RAF");
    const [id, callback] = frames.entries().next().value!;
    frames.delete(id);
    callback(at);
    assert.ok(frames.size <= 1);
  };

  for (let cycle = 0; cycle < 20; cycle++) {
    const at = cycle * 2000;
    speed = [1, 2, 4][cycle % 3]!;
    for (let i = 0; i < 200; i++) {
      assert.equal(occupancy.tryClaim(i, i + 200), true);
      runners[i]!.start({
        from: { x: i, y: 0 },
        to: { x: i + 200, y: 0 },
        durationMs: 1000,
        startTimestamp: at,
        onArrival: () => { arrivals[i]!++; }
      });
    }
    dispatch(at + 100);
    if (cycle % 4 === 0) {
      bus.setActive(false);
      assert.equal(frames.size, 0, "no RAF while paused/backgrounded");
      bus.setActive(true);
      dispatch(at + 150); // resumed RAF rebases; cannot teleport
    }
    for (let i = 0; i < 200; i++) {
      assert.equal(walking[i], true);
      runners[i]!.stop();
      assert.equal(walking[i], false);
      assert.equal(nativeResidentReconcileInterruptedClaim(
        i,
        cell => occupancy.tryClaim(i, cell),
        () => occupancy.release(i)
      ), "reclaimed");
      assert.equal(occupancy.isFreeFor(i, i + 200), true);
    }
    assert.equal(frames.size, 0);
    assert.equal(bus.snapshot().continuousSubscribers, 0);
    assert.equal(occupancy.snapshot().occupied, 200);
    assert.equal(occupancy.checkInvariants(), true);
    const priorWrites = writes;
    for (const callback of stale.splice(0)) callback(at + 180);
    assert.equal(writes, priorWrites, "canceled RAF delivered obsolete movement");
    assert.ok(arrivals.every(count => count === 0), "interrupted segment arrived");
  }
  assert.ok(writes > 0);
  assert.equal(occupancy.snapshot().occupied, 200);
  for (let i = 0; i < 200; i++) occupancy.release(i);
  assert.equal(occupancy.snapshot().occupied, 0);
  assert.equal(occupancy.checkInvariants(), true);
});

test("lost origin cannot evict another resident; release stale destination", () => {
  const occupancy = new NativeRealFixtureOccupancy();
  assert.equal(occupancy.tryClaim(0, 0), true);
  assert.equal(occupancy.tryClaim(1, 1), true);
  assert.equal(occupancy.tryClaim(0, 200), true);
  assert.equal(occupancy.tryClaim(1, 0), true); // origin occupied while 0 moves
  assert.equal(nativeResidentReconcileInterruptedClaim(
    0, cell => occupancy.tryClaim(0, cell), () => occupancy.release(0)
  ), "released");
  assert.equal(occupancy.isFreeFor(0, 0), false);
  assert.equal(occupancy.isFreeFor(2, 200), true);
  assert.equal(occupancy.snapshot().occupied, 1);
  assert.equal(occupancy.checkInvariants(), true);
});

test("reroute to a different origin releases old claim without exclusive home claim", () => {
  const occupancy = new NativeRealFixtureOccupancy();
  assert.equal(occupancy.tryClaim(3, 50), true);
  assert.equal(nativeResidentReleaseMismatchedRouteOrigin(
    50, 70, () => occupancy.release(3)
  ), true);
  assert.equal(occupancy.snapshot().occupied, 0);
  assert.equal(occupancy.isFreeFor(9, 70), true);
  assert.equal(nativeResidentReleaseMismatchedRouteOrigin(
    70, 70, () => { throw new Error("same origin must not release"); }
  ), false);
  assert.equal(nativeResidentReleaseMismatchedRouteOrigin(
    null, 70, () => { throw new Error("uninitialized origin must not release"); }
  ), false);
  assert.equal(nativeResidentReconcileInterruptedClaim(null, undefined, undefined), "unmanaged");
  assert.equal(nativeResidentReconcileInterruptedClaim(
    null, undefined, () => occupancy.release(3)
  ), "released");
});

test("native-only renderer wires terminal claim reconciliation; web remains unchanged", () => {
  const native = readFileSync(new URL("../src/components/MapWandererCharacter.native.tsx", import.meta.url), "utf8");
  const web = readFileSync(new URL("../src/components/MapWandererCharacter.tsx", import.meta.url), "utf8");
  assert.match(native, /const stopAndReconcile = useCallback/);
  assert.match(native, /nativeResidentReconcileInterruptedClaim\(\s*cellRef\.current/);
  assert.match(native, /nativeResidentReleaseMismatchedRouteOrigin\(\s*previousCell, start/);
  assert.match(native, /if \(routeMode !== "free" \|\| !disableIdleRoam\) return;/);
  assert.doesNotMatch(web, /nativeResidentReconcileInterruptedClaim|nativeResidentReleaseMismatchedRouteOrigin/);
});


test("shared-home arrival releases stale road claims without evicting a home owner", () => {
  const occupancy = new NativeRealFixtureOccupancy();
  assert.equal(occupancy.tryClaim(900, 300), true);
  assert.equal(occupancy.tryClaim(1, 20), true);
  assert.equal(occupancy.tryClaim(1, 300), false, "soft shared-home claim can fail");
  assert.equal(occupancy.isFreeFor(2, 20), false, "street stays reserved while walking");
  assert.equal(nativeResidentReleaseSharedHomeArrival(true, "home", () => occupancy.release(1)), true);
  assert.equal(occupancy.isFreeFor(2, 20), true, "arrival releases old road cell");
  assert.equal(occupancy.isFreeFor(1, 300), false, "existing home owner is preserved");
  assert.equal(occupancy.snapshot().occupied, 1);
  assert.equal(occupancy.checkInvariants(), true);

  // The same final home step can also successfully reserve an empty home.
  assert.equal(occupancy.tryClaim(1, 20), true);
  assert.equal(occupancy.tryClaim(1, 301), true);
  assert.equal(nativeResidentReleaseSharedHomeArrival(true, "home", () => occupancy.release(1)), true);
  assert.equal(occupancy.isFreeFor(2, 301), true);
  assert.equal(occupancy.snapshot().occupied, 1);
  assert.equal(occupancy.checkInvariants(), true);
});

test("non-home and non-final arrivals preserve claims; absent release is a no-op", () => {
  const occupancy = new NativeRealFixtureOccupancy();
  assert.equal(occupancy.tryClaim(1, 20), true);
  const release = () => occupancy.release(1);
  assert.equal(nativeResidentReleaseSharedHomeArrival(false, "home", release), false);
  assert.equal(nativeResidentReleaseSharedHomeArrival(true, "work", release), false);
  assert.equal(nativeResidentReleaseSharedHomeArrival(true, "bar", release), false);
  assert.equal(nativeResidentReleaseSharedHomeArrival(true, null, release), false);
  assert.equal(nativeResidentReleaseSharedHomeArrival(true, "home", undefined), false);
  assert.equal(occupancy.snapshot().occupied, 1);
  assert.equal(occupancy.isFreeFor(2, 20), false);
  assert.equal(occupancy.checkInvariants(), true);
});

test("200 runners, 20 shared homes, 12 commute cycles: 2400 arrivals leave no road ghosts", () => {
  const occupancy = new NativeRealFixtureOccupancy();
  const frames = new Map<number, (at: number) => void>();
  let nextFrame = 0;
  let speed = 1;
  let arrivals = 0;
  const bus = new NativeResidentFrameBus(
    callback => { const id = ++nextFrame; frames.set(id, callback); return id; },
    id => { frames.delete(id); }
  );
  const runners = Array.from({ length: 200 }, () => new NativeResidentSegmentRunner({
    requestFrame: callback => bus.request(callback),
    subscribeFrame: callback => bus.subscribeFrame(callback),
    cancelFrame: id => bus.cancel(id),
    readTimeScale: () => speed,
    writePositionXY: (x, y) => {
      assert.ok(Number.isFinite(x) && Number.isFinite(y));
    },
    advanceSprite: () => {},
    setWalking: () => {}
  }));
  for (let home = 0; home < 20; home++) {
    assert.equal(occupancy.tryClaim(1000 + home, 300 + home), true);
  }
  const frame = (at: number) => {
    assert.equal(frames.size, 1, "shared bus uses one platform RAF for 200 walkers");
    const [id, callback] = frames.entries().next().value!;
    frames.delete(id);
    callback(at);
  };
  for (let cycle = 0; cycle < 12; cycle++) {
    speed = [1, 2, 4][cycle % 3]!;
    const at = cycle * 3000;
    for (let i = 0; i < 200; i++) {
      assert.equal(occupancy.tryClaim(i, i), true);
      assert.equal(occupancy.tryClaim(i, 300 + (i % 20)), false,
        "the soft-home destination is already shared");
      runners[i]!.start({
        from: { x: i, y: 0 },
        to: { x: i, y: 1 },
        durationMs: 1000,
        startTimestamp: at,
        onArrival: () => {
          assert.equal(nativeResidentReleaseSharedHomeArrival(
            true, "home", () => occupancy.release(i)
          ), true);
          arrivals++;
          assert.equal(occupancy.isFreeFor(201, i), true);
        }
      });
    }
    frame(at + 200);
    assert.equal(occupancy.snapshot().occupied, 220,
      "unfinished walkers must still reserve their road cell");
    if (cycle % 3 === 0) {
      bus.setActive(false);
      assert.equal(frames.size, 0);
      bus.setActive(true);
      frame(at + 400);
    }
    frame(at + 1600);
    assert.equal(arrivals, (cycle + 1) * 200);
    assert.equal(frames.size, 0);
    assert.equal(bus.snapshot().continuousSubscribers, 0);
    assert.equal(occupancy.snapshot().occupied, 20,
      "only the 20 original shared-home owners may remain");
    assert.equal(occupancy.checkInvariants(), true);
  }
  for (let home = 0; home < 20; home++) occupancy.release(1000 + home);
  assert.equal(occupancy.snapshot().occupied, 0);
  assert.equal(occupancy.checkInvariants(), true);
});

test("native home arrival releases reservation before parent settle and completion callbacks", () => {
  const native = readFileSync(new URL("../src/components/MapWandererCharacter.native.tsx", import.meta.url), "utf8");
  const web = readFileSync(new URL("../src/components/MapWandererCharacter.tsx", import.meta.url), "utf8");
  const start = native.indexOf("nativeResidentReleaseSharedHomeArrival(");
  assert.ok(start > 0);
  const arrival = native.slice(start, start + 350);
  assert.match(arrival, /isLastSegment, purpose, releaseMyCellRef\.current/);
  assert.ok(arrival.indexOf("nativeResidentReleaseSharedHomeArrival(") <
    arrival.indexOf("onCellSettledRef.current?.(to)"));
  assert.ok(arrival.indexOf("onCellSettledRef.current?.(to)") <
    arrival.indexOf("onDone()"));
  assert.doesNotMatch(web, /nativeResidentReleaseSharedHomeArrival/);
});
