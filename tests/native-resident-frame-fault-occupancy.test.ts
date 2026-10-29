import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";
import { NativeResidentSegmentRunner } from "../src/performance/nativeResidentSegmentRunner.ts";
import { NativeRealFixtureOccupancy } from "../src/performance/nativeRealResidentFixture.ts";
import { nativeResidentReconcileInterruptedClaim } from "../src/performance/nativeResidentRouteTransitions.ts";

type Frame = (timestamp: number) => void;
function fakeBridge() {
  let nextId = 0;
  const scheduled = new Map<number, Frame>();
  const stale: Frame[] = [];
  const bus = new NativeResidentFrameBus(
    callback => { const id = ++nextId; scheduled.set(id, callback); return id; },
    id => { const old = scheduled.get(id); if (old) stale.push(old); scheduled.delete(id); }
  );
  return {
    scheduled, stale, bus,
    tick(timestamp: number) {
      assert.equal(scheduled.size, 1, "200 residents share one RAF");
      const [id, frame] = scheduled.entries().next().value!;
      scheduled.delete(id);
      frame(timestamp);
    },
    tickStale(timestamp: number) {
      for (const frame of stale.splice(0)) frame(timestamp);
    }
  };
}

test("a frame write failure recovers an in-flight destination; 199 other callbacks still run", () => {
  const f = fakeBridge();
  const occupancy = new NativeRealFixtureOccupancy();
  const walking = Array<boolean>(200).fill(false);
  const arrived = Array<number>(200).fill(0);
  const repaired = Array<number>(200).fill(0);
  const runners = Array.from({ length: 200 }, (_, i) => new NativeResidentSegmentRunner({
    requestFrame: cb => f.bus.request(cb),
    subscribeFrame: cb => f.bus.subscribeFrame(cb),
    cancelFrame: id => f.bus.cancel(id),
    readTimeScale: () => 4,
    writePositionXY: x => {
      if (i === 0 && x > 0) throw new Error("injected JS-to-native position write");
    },
    advanceSprite: () => {},
    setWalking: value => { walking[i] = value; }
  }));
  for (let i = 0; i < 200; i++) {
    assert.equal(occupancy.tryClaim(i, i), true);
    assert.equal(occupancy.tryClaim(i, i + 200), true);
    runners[i]!.start({
      from: {x: 0, y: i}, to: {x: 100, y: i},
      startTimestamp: 0, durationMs: 100,
      onFrameFault: () => {
        repaired[i]!++;
        nativeResidentReconcileInterruptedClaim(i,
          cell => occupancy.tryClaim(i, cell), () => occupancy.release(i));
      },
      onArrival: () => { arrived[i]!++; }
    });
  }
  assert.throws(() => f.tick(25), /injected JS-to-native position write/);
  assert.equal(repaired[0], 1);
  assert.ok(repaired.slice(1).every(x => x === 0));
  assert.equal(occupancy.isFreeFor(201, 200), true, "failed walker releases destination");
  assert.equal(occupancy.isFreeFor(201, 0), false, "its settled origin is owned");
  assert.equal(f.bus.snapshot().continuousSubscribers, 0);
  assert.ok(walking.every(value => value === false));
  assert.ok(arrived.every((x, i) => x === (i === 0 ? 0 : 1)));
  assert.equal(occupancy.snapshot().occupied, 200);
  assert.equal(occupancy.checkInvariants(), true);
  f.tickStale(100_000);
  assert.equal(repaired[0], 1, "late canceled callbacks cannot double-release");
});

test("200 walkers x 18 routes: 720 mid-frame failures, 3,600 valid arrivals, three game speeds", () => {
  const f = fakeBridge();
  const occupancy = new NativeRealFixtureOccupancy();
  const settled = Array.from({length: 200}, (_, i) => i);
  const arrivals = Array<number>(200).fill(0);
  const recovery = Array<number>(200).fill(0);
  const walking = Array<boolean>(200).fill(false);
  let speed = 1;
  const runners = Array.from({length: 200}, (_, i) => new NativeResidentSegmentRunner({
    requestFrame: callback => f.bus.request(callback),
    subscribeFrame: callback => f.bus.subscribeFrame(callback),
    cancelFrame: id => f.bus.cancel(id),
    readTimeScale: () => speed,
    writePositionXY: () => {
      if (i % 5 === 0) throw new Error("injected frame update failure");
    },
    advanceSprite: () => {},
    setWalking: active => { walking[i] = active; }
  }));
  for (let i = 0; i < 200; i++) assert.equal(occupancy.tryClaim(i, i), true);
  for (let cycle = 0; cycle < 18; cycle++) {
    speed = [1, 2, 4][cycle % 3]!;
    const t = cycle * 100_000;
    for (let i = 0; i < 200; i++) {
      assert.equal(occupancy.tryClaim(i, i + 200), true);
      runners[i]!.start({
        from: {x: 0, y: i}, to: {x: 100, y: i},
        startTimestamp: t, durationMs: 1000,
        onArrival: () => {
          settled[i] = i + 200;
          arrivals[i]!++;
        },
        onFrameFault: () => {
          recovery[i]!++;
          if (settled[i] === i) {
            nativeResidentReconcileInterruptedClaim(i,
              cell => occupancy.tryClaim(i, cell), () => occupancy.release(i));
          }
        }
      });
    }
    assert.equal(f.bus.snapshot().continuousSubscribers, 200);
    if (cycle % 4 === 0) {
      f.bus.setActive(false);
      assert.equal(f.scheduled.size, 0);
      f.bus.setActive(true);
      f.tick(t + 50_000); // resume rebases; no movement
      assert.ok(arrivals.every((count, i) => count === (i % 5 === 0 ? 0 : cycle)));
      assert.throws(() => f.tick(t + 50_000 + (1000 / speed)), /injected frame update failure/);
    } else {
      assert.throws(() => f.tick(t + (1000 / speed)), /injected frame update failure/);
    }
    assert.equal(f.bus.snapshot().continuousSubscribers, 0);
    assert.equal(f.scheduled.size, 0);
    assert.equal(occupancy.snapshot().occupied, 200);
    assert.equal(occupancy.checkInvariants(), true);
    assert.ok(walking.every(value => !value));
    for (let i = 0; i < 200; i++) {
      const expected = i % 5 === 0 ? i : i + 200;
      assert.equal(settled[i], expected);
      assert.equal(occupancy.isFreeFor(400, expected), false);
      assert.equal(occupancy.tryClaim(i, i), true);
      settled[i] = i;
    }
    f.tickStale(t + 90_000);
    assert.equal(occupancy.checkInvariants(), true);
  }
  assert.equal(recovery.reduce((sum, n) => sum + n, 0), 720);
  assert.equal(arrivals.reduce((sum, n) => sum + n, 0), 2880);
  assert.ok(recovery.every((count, i) => count === (i % 5 === 0 ? 18 : 0)));
  for (let i = 0; i < 200; i++) occupancy.release(i);
  assert.equal(occupancy.snapshot().occupied, 0);
  assert.equal(f.bus.snapshot().queued, 0);
});

test("reentrant route replacement during a failing frame retains the new claim", () => {
  const f = fakeBridge();
  const occupancy = new NativeRealFixtureOccupancy();
  assert.equal(occupancy.tryClaim(1, 10), true);
  assert.equal(occupancy.tryClaim(1, 11), true);
  let replaced = false;
  let staleRecovery = 0;
  let newArrivals = 0;
  let runner!: NativeResidentSegmentRunner;
  runner = new NativeResidentSegmentRunner({
    requestFrame: cb => f.bus.request(cb),
    subscribeFrame: cb => f.bus.subscribeFrame(cb),
    cancelFrame: id => f.bus.cancel(id),
    readTimeScale: () => 4,
    writePositionXY: () => {
      if (replaced) return;
      replaced = true;
      assert.equal(occupancy.tryClaim(1, 12), true);
      runner.start({
        from: {x: 0, y: 0}, to: {x: 100, y: 0},
        startTimestamp: 25, durationMs: 100,
        onArrival: () => { newArrivals++; }
      });
      throw new Error("old route failed after replacement");
    },
    advanceSprite: () => {},
    setWalking: () => {}
  });
  runner.start({
    from: {x: 0, y: 0}, to: {x: 100, y: 0},
    startTimestamp: 0, durationMs: 100,
    onFrameFault: () => {
      staleRecovery++;
      nativeResidentReconcileInterruptedClaim(10,
        cell => occupancy.tryClaim(1, cell), () => occupancy.release(1));
    },
    onArrival: () => { assert.fail("obsolete arrival"); }
  });
  assert.throws(() => f.tick(25), /old route failed after replacement/);
  assert.equal(staleRecovery, 0, "obsolete callback cannot reconcile another route");
  assert.equal(occupancy.isFreeFor(2, 12), false);
  f.tick(50);
  assert.equal(newArrivals, 1);
  assert.equal(occupancy.isFreeFor(2, 12), false);
  assert.equal(occupancy.checkInvariants(), true);
});

test("failed start does not call frame fault hook; first thrown value is preserved", () => {
  const f = fakeBridge();
  let aborts = 0;
  const runner = new NativeResidentSegmentRunner({
    requestFrame: cb => f.bus.request(cb),
    subscribeFrame: cb => f.bus.subscribeFrame(cb),
    cancelFrame: id => f.bus.cancel(id),
    readTimeScale: () => 1,
    writePositionXY: () => { throw null; },
    advanceSprite: () => {},
    setWalking: moving => { if (moving) throw false; }
  });
  let didThrow = false;
  try {
    runner.start({
      from: {x: 0, y: 0}, to: {x: 100, y: 0},
      startTimestamp: 0, durationMs: 100,
      onArrival: () => {},
      onFrameFault: () => { aborts++; }
    });
  } catch (error) { didThrow = true; assert.equal(error, false); }
  assert.equal(didThrow, true);
  assert.equal(aborts, 0);
  assert.equal(f.bus.snapshot().continuousSubscribers, 0);
  assert.equal(f.scheduled.size, 0);
});

test("native body wires midframe claim recovery for both free roam and commute, not web", () => {
  const native = readFileSync(new URL("../src/components/MapWandererCharacter.native.tsx", import.meta.url), "utf8");
  const web = readFileSync(new URL("../src/components/MapWandererCharacter.tsx", import.meta.url), "utf8");
  assert.equal(native.split("onFrameFault: () => {").length - 1, 2);
  const free = native.slice(native.indexOf("const pickNextMove = useCallback("),
    native.indexOf("pickNextMoveRef.current = pickNextMove;"));
  const commute = native.slice(native.indexOf("const runOneSegment = useCallback("),
    native.indexOf("/** Percorso casa"));
  assert.ok(free.includes("claim != null && cellRef.current === prev"));
  assert.ok(commute.includes("destinationClaimed && routeEpoch.isCurrent(routeToken)"));
  assert.ok(commute.includes("cellRef.current === from"));
  assert.ok(!web.includes("onFrameFault:"));
});
