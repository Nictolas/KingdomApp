import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";
import { NativeResidentSegmentRunner } from "../src/performance/nativeResidentSegmentRunner.ts";
import { NativeRealFixtureOccupancy } from "../src/performance/nativeRealResidentFixture.ts";
import { NativeResidentRouteEpoch } from "../src/performance/nativeResidentRouteEpoch.ts";
import { nativeResidentRethrowAfterUnsettledArrivalFault } from "../src/performance/nativeResidentRouteTransitions.ts";

test("unsettled arrival failure restores the previous cell, preserving the first error", () => {
  const occupancy = new NativeRealFixtureOccupancy();
  assert.equal(occupancy.tryClaim(1, 5), true);
  assert.equal(occupancy.tryClaim(1, 6), true);
  const error = new Error("injected release failure before settlement");
  assert.throws(() => nativeResidentRethrowAfterUnsettledArrivalFault(
    error, 5, cell => occupancy.tryClaim(1, cell), () => occupancy.release(1), true
  ), value => value === error);
  assert.equal(occupancy.isFreeFor(2, 6), true);
  assert.equal(occupancy.isFreeFor(2, 5), false);
  assert.equal(occupancy.checkInvariants(), true);
});

test("settled arrival and superseded route must never release a newer cell", () => {
  const occupancy = new NativeRealFixtureOccupancy();
  assert.equal(occupancy.tryClaim(1, 5), true);
  assert.equal(occupancy.tryClaim(1, 6), true);
  const epoch = new NativeResidentRouteEpoch();
  const old = epoch.begin();
  epoch.begin(); // reentrant replacement
  assert.equal(epoch.isCurrent(old), false);
  for (const caughtError of [null, undefined, false, 0, ""]) {
    let caught = false;
    try {
      nativeResidentRethrowAfterUnsettledArrivalFault(caughtError, 5, () => {
        assert.fail("old route must not claim");
      }, () => assert.fail("old route must not release"), epoch.isCurrent(old));
    } catch (actual) {
      caught = true;
      assert.equal(actual, caughtError);
    }
    assert.equal(caught, true);
  }
  const parentError = new Error("parent callback fault AFTER published arrival");
  assert.throws(() => nativeResidentRethrowAfterUnsettledArrivalFault(
    parentError, 5, () => { assert.fail("already settled"); },
    () => assert.fail("already settled"), false
  ), error => error === parentError);
  assert.equal(occupancy.isFreeFor(2, 6), false);
  assert.equal(occupancy.checkInvariants(), true);
});

test("occupied origin on an unsettled callback releases only the obsolete destination", () => {
  const occupancy = new NativeRealFixtureOccupancy();
  assert.equal(occupancy.tryClaim(0, 10), true);
  assert.equal(occupancy.tryClaim(1, 11), true);
  assert.equal(occupancy.tryClaim(0, 20), true);
  assert.equal(occupancy.tryClaim(1, 10), true);
  const error = new Error("injected pre-settlement error");
  assert.throws(() => nativeResidentRethrowAfterUnsettledArrivalFault(
    error, 10, cell => occupancy.tryClaim(0, cell), () => occupancy.release(0), true
  ), actual => actual === error);
  assert.equal(occupancy.snapshot().occupied, 1);
  assert.equal(occupancy.isFreeFor(0, 20), true);
  assert.equal(occupancy.isFreeFor(0, 10), false);
  assert.equal(occupancy.checkInvariants(), true);
});

test("200 residents x 20 arrivals with 800 injected pre-settlement faults retain occupancy, at 1x/2x/4x", () => {
  const occupancy = new NativeRealFixtureOccupancy();
  const osFrames = new Map<number, (timestamp: number) => void>();
  let nextFrame = 0;
  let speed = 1;
  const bus = new NativeResidentFrameBus(
    cb => { const id = ++nextFrame; osFrames.set(id, cb); return id; },
    id => { osFrames.delete(id); }
  );
  const settled = Array.from({ length: 200 }, (_, i) => i);
  const completions = Array<number>(200).fill(0);
  const walking = Array<boolean>(200).fill(false);
  const runners = Array.from({ length: 200 }, (_, i) => new NativeResidentSegmentRunner({
    requestFrame: callback => bus.request(callback),
    subscribeFrame: callback => bus.subscribeFrame(callback),
    cancelFrame: id => bus.cancel(id),
    readTimeScale: () => speed,
    writePositionXY: () => {},
    advanceSprite: () => {},
    setWalking: moving => { walking[i] = moving; }
  }));
  for (let i = 0; i < 200; i++) assert.equal(occupancy.tryClaim(i, i), true);
  let failureCount = 0;
  for (let cycle = 0; cycle < 20; cycle++) {
    const at = cycle * 100_000;
    speed = [1, 2, 4][cycle % 3]!;
    for (let i = 0; i < 200; i++) {
      assert.equal(occupancy.tryClaim(i, i + 200), true);
      runners[i]!.start({
        from: { x: i, y: 0 }, to: { x: i + 200, y: 0 },
        durationMs: 1000, startTimestamp: at,
        onArrival: () => {
          try {
            if (i % 5 === 0) throw new Error("fault before logical settlement");
            settled[i] = i + 200;
            completions[i]!++;
          } catch (error) {
            failureCount++;
            nativeResidentRethrowAfterUnsettledArrivalFault(
              error, i, cell => occupancy.tryClaim(i, cell),
              () => occupancy.release(i), settled[i] === i
            );
          }
        }
      });
    }
    assert.equal(bus.snapshot().continuousSubscribers, 200);
    const dispatch = (time: number) => {
      assert.equal(osFrames.size, 1);
      const [id, callback] = osFrames.entries().next().value!;
      osFrames.delete(id);
      callback(time);
    };
    if (cycle % 4 === 0) {
      bus.setActive(false);
      assert.equal(osFrames.size, 0);
      bus.setActive(true);
      dispatch(at + 50_000); // first frame is a rebase, no catch-up
      assert.equal(bus.snapshot().continuousSubscribers, 200);
      assert.throws(() => dispatch(at + 51_000), /fault before logical settlement/);
    } else {
      assert.throws(() => dispatch(at + 1000), /fault before logical settlement/);
    }
    assert.equal(bus.snapshot().continuousSubscribers, 0);
    assert.equal(osFrames.size, 0);
    assert.ok(walking.every(value => value === false));
    assert.equal(occupancy.snapshot().occupied, 200);
    assert.equal(occupancy.checkInvariants(), true);
    for (let i = 0; i < 200; i++) {
      const expected = i % 5 === 0 ? i : i + 200;
      assert.equal(settled[i], expected);
      assert.equal(occupancy.isFreeFor(i + 1000, expected), false);
      assert.equal(occupancy.tryClaim(i, i), true);
      settled[i] = i;
    }
    assert.equal(occupancy.checkInvariants(), true);
  }
  assert.equal(failureCount, 800);
  assert.ok(completions.every((count, i) => count === (i % 5 === 0 ? 0 : 20)));
  for (let i = 0; i < 200; i++) occupancy.release(i);
  assert.equal(occupancy.snapshot().occupied, 0);
  assert.equal(bus.snapshot().queued, 0);
});

test("native idle and commute arrival callbacks guard only unsettled claims, web remains unchanged", () => {
  const native = readFileSync(new URL("../src/components/MapWandererCharacter.native.tsx", import.meta.url), "utf8");
  const web = readFileSync(new URL("../src/components/MapWandererCharacter.tsx", import.meta.url), "utf8");
  assert.equal(native.split("nativeResidentRethrowAfterUnsettledArrivalFault(").length - 1, 2);
  const idle = native.slice(native.indexOf("const pickNextMove = useCallback("), native.indexOf("pickNextMoveRef.current = pickNextMove;"));
  const commute = native.slice(native.indexOf("const runOneSegment = useCallback("), native.indexOf("/** Percorso casa"));
  assert.ok(idle.includes("claim != null && cellRef.current === prev"));
  assert.ok(commute.includes("destinationClaimed && routeEpoch.isCurrent(routeToken)"));
  assert.ok(commute.includes("cellRef.current === from"));
  assert.ok(commute.includes("if (!routeEpoch.isCurrent(routeToken)) return;"));
  assert.ok(!web.includes("nativeResidentRethrowAfterUnsettledArrivalFault"));
});
