import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";
import { NativeResidentSegmentRunner } from "../src/performance/nativeResidentSegmentRunner.ts";
import { NativeRealFixtureOccupancy } from "../src/performance/nativeRealResidentFixture.ts";
import {
  nativeResidentRethrowAfterClaimedStartFault
} from "../src/performance/nativeResidentRouteTransitions.ts";

/** All scheduler tests use deterministic JS doubles, NOT an Android/iOS build. */
test("failed sprite/RAF start returns a reserved destination to its settled origin", () => {
  const occupancy = new NativeRealFixtureOccupancy();
  assert.equal(occupancy.tryClaim(1, 50), true);
  assert.equal(occupancy.tryClaim(1, 51), true);
  const first = new Error("native sprite initialization failed");
  assert.throws(() => nativeResidentRethrowAfterClaimedStartFault(
    first, 50, cell => occupancy.tryClaim(1, cell), () => occupancy.release(1), true
  ), error => error === first);
  assert.equal(occupancy.isFreeFor(2, 51), true);
  assert.equal(occupancy.isFreeFor(2, 50), false);
  assert.equal(occupancy.snapshot().occupied, 1);
  assert.equal(occupancy.checkInvariants(), true);
});

test("occupied origin is never evicted; failed start drops only its stale destination", () => {
  const occupancy = new NativeRealFixtureOccupancy();
  assert.equal(occupancy.tryClaim(0, 10), true);
  assert.equal(occupancy.tryClaim(1, 11), true);
  assert.equal(occupancy.tryClaim(0, 20), true);
  assert.equal(occupancy.tryClaim(1, 10), true);
  const cause = "bridge refused start";
  let caught = false;
  try { nativeResidentRethrowAfterClaimedStartFault(
    cause, 10, cell => occupancy.tryClaim(0, cell), () => occupancy.release(0), true
  ); } catch (error) { caught = true; assert.equal(error, cause); }
  assert.equal(caught, true);
  assert.equal(occupancy.isFreeFor(0, 10), false);
  assert.equal(occupancy.isFreeFor(0, 20), true);
  assert.equal(occupancy.snapshot().occupied, 1);
  assert.equal(occupancy.checkInvariants(), true);
});

test("obsolete route never touches the newer claim; rollback faults preserve falsy first errors", () => {
  const occupancy = new NativeRealFixtureOccupancy();
  assert.equal(occupancy.tryClaim(1, 12), true);
  assert.equal(occupancy.tryClaim(1, 13), true);
  let claims = 0;
  let releases = 0;
  for (const cause of [null, undefined, false, 0, ""]) {
    let caught = false;
    try {
      nativeResidentRethrowAfterClaimedStartFault(
        cause, 12, () => { claims++; return true; }, () => { releases++; }, false
      );
    } catch (error) { caught = true; assert.equal(error, cause); }
    assert.equal(caught, true);
  }
  assert.equal(claims, 0);
  assert.equal(releases, 0);
  assert.equal(occupancy.isFreeFor(2, 13), false, "new route retains its destination");

  let caught = false;
  try {
    nativeResidentRethrowAfterClaimedStartFault(
      0, 12, () => { throw new Error("rollback claim failure"); },
      () => { releases++; }, true
    );
  } catch (error) { caught = true; assert.equal(error, 0); }
  assert.equal(caught, true);
  assert.equal(releases, 0, "rollback callback failure does not mask original");
  occupancy.release(1);
});

test("200 native runners, 30 route cycles, 1,200 injected startup faults: no ghost claims or stale callbacks", () => {
  const occupancy = new NativeRealFixtureOccupancy();
  const nativeFrames = new Map<number, (at: number) => void>();
  const staleFrames: Array<(at: number) => void> = [];
  let nextNativeFrame = 0;
  let speed = 1;
  const bus = new NativeResidentFrameBus(
    cb => { const id = ++nextNativeFrame; nativeFrames.set(id, cb); return id; },
    id => {
      const cb = nativeFrames.get(id);
      if (cb) staleFrames.push(cb);
      nativeFrames.delete(id);
    }
  );
  const arrivalCounts = Array<number>(200).fill(0);
  const walking = Array<boolean>(200).fill(false);
  const runners = Array.from({ length: 200 }, (_, i) => new NativeResidentSegmentRunner({
    requestFrame: cb => bus.request(cb),
    subscribeFrame: cb => {
      if (i % 5 === 0) throw new Error("simulated native RAF subscribe failure");
      return bus.subscribeFrame(cb);
    },
    cancelFrame: id => bus.cancel(id),
    readTimeScale: () => speed,
    writePositionXY: () => {},
    advanceSprite: () => {},
    setWalking: isWalking => { walking[i] = isWalking; }
  }));
  for (let i = 0; i < 200; i++) assert.equal(occupancy.tryClaim(i, i), true);
  let failedStarts = 0;
  let arrivals = 0;
  const deliver = (at: number) => {
    assert.equal(nativeFrames.size, 1);
    const [id, cb] = nativeFrames.entries().next().value!;
    nativeFrames.delete(id);
    cb(at);
  };
  for (let cycle = 0; cycle < 30; cycle++) {
    speed = [1, 2, 4][cycle % 3]!;
    const at = cycle * 100_000;
    for (let i = 0; i < 200; i++) {
      assert.equal(occupancy.tryClaim(i, i + 200), true);
      const start = () => runners[i]!.start({
        from: { x: i, y: 0 }, to: { x: i + 200, y: 0 },
        startTimestamp: at, durationMs: 1000,
        onArrival: () => { arrivalCounts[i]!++; arrivals++; }
      });
      if (i % 5 === 0) {
        let failed = false;
        try { start(); } catch (error) {
          failed = true;
          failedStarts++;
          assert.match(String(error), /RAF subscribe failure/);
          assert.throws(() => nativeResidentRethrowAfterClaimedStartFault(
            error, i, cell => occupancy.tryClaim(i, cell), () => occupancy.release(i), true
          ), actual => actual === error);
        }
        assert.equal(failed, true);
        assert.equal(occupancy.isFreeFor(i, i + 200), true);
        assert.equal(runners[i]!.snapshot().active, false);
      } else {
        start();
      }
    }
    assert.equal(bus.snapshot().continuousSubscribers, 160);
    if (cycle % 4 === 0) {
      // Freeze and rebase during a long Android background/inactive interval.
      bus.setActive(false);
      assert.equal(nativeFrames.size, 0);
      bus.setActive(true);
      deliver(at + 90_000);
      assert.equal(arrivals, cycle * 160);
      deliver(at + 91_000);
    } else {
      deliver(at + 1000);
    }
    assert.equal(bus.snapshot().continuousSubscribers, 0);
    assert.equal(nativeFrames.size, 0);
    assert.equal(occupancy.snapshot().occupied, 200);
    assert.equal(occupancy.checkInvariants(), true);
    assert.ok(walking.every(x => !x), "failed start cannot leave a walking sprite");
    for (let i = 0; i < 200; i++) assert.equal(occupancy.tryClaim(i, i), true);
    const before = [...arrivalCounts];
    for (const old of staleFrames.splice(0)) old(at + 95_000);
    assert.deepEqual(arrivalCounts, before);
    assert.equal(occupancy.checkInvariants(), true);
  }
  assert.equal(failedStarts, 1200);
  assert.equal(arrivals, 4800);
  assert.ok(arrivalCounts.every((n, i) => n === (i % 5 === 0 ? 0 : 30)));
  for (let i = 0; i < 200; i++) occupancy.release(i);
  assert.equal(occupancy.snapshot().occupied, 0);
  assert.equal(bus.snapshot().queued, 0);
});

test("both native segment start paths roll back claims; default web renderer remains unchanged", () => {
  const native = readFileSync(new URL("../src/components/MapWandererCharacter.native.tsx", import.meta.url), "utf8");
  const web = readFileSync(new URL("../src/components/MapWandererCharacter.tsx", import.meta.url), "utf8");
  assert.equal(native.split("nativeResidentRethrowAfterClaimedStartFault(").length - 1, 2);
  const free = native.slice(native.indexOf("const pickNextMove = useCallback("),
    native.indexOf("pickNextMoveRef.current = pickNextMove;"));
  const commute = native.slice(native.indexOf("const runOneSegment = useCallback("),
    native.indexOf("/** Percorso casa"));
  assert.ok(free.includes("claim != null && cellRef.current === prev"));
  assert.ok(commute.includes("destinationClaimed && routeEpoch.isCurrent(routeToken) && cellRef.current === from"));
  assert.ok(!web.includes("nativeResidentRethrowAfterClaimedStartFault"));
});

test("shared-home entry denied before a sprite start failure preserves both original claims", () => {
  const occupancy = new NativeRealFixtureOccupancy();
  assert.equal(occupancy.tryClaim(1, 20), true);
  assert.equal(occupancy.tryClaim(2, 21), true);
  const denied = occupancy.tryClaim(1, 21);
  assert.equal(denied, false);
  const error = new Error("native sprite start failed after denied shared-home claim");
  assert.throws(() => nativeResidentRethrowAfterClaimedStartFault(
    error, 20, cell => occupancy.tryClaim(1, cell), () => occupancy.release(1), denied
  ), actual => actual === error);
  assert.equal(occupancy.snapshot().occupied, 2);
  assert.equal(occupancy.isFreeFor(3, 20), false);
  assert.equal(occupancy.isFreeFor(3, 21), false);
  assert.equal(occupancy.checkInvariants(), true);
});
