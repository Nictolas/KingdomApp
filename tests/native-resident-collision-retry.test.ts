import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { NativeResidentCollisionRetry } from "../src/performance/nativeResidentCollisionRetry.ts";
import { NativeResidentTimerQueue } from "../src/performance/nativeResidentTimerQueue.ts";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";
import { NativeResidentSegmentRunner } from "../src/performance/nativeResidentSegmentRunner.ts";

test("existing three failed claims request exactly one repath; route reset permits another", () => {
  const retry = new NativeResidentCollisionRetry(3);
  assert.equal(retry.fail(true), "retry");
  assert.equal(retry.fail(true), "retry");
  assert.equal(retry.fail(true), "request-repath");
  for (let i = 0; i < 1000; i++) assert.equal(retry.fail(true), "awaiting-repath");
  assert.deepEqual(retry.snapshot(), { failures: 0, awaitingRepath: true });
  retry.reset();
  assert.equal(retry.fail(true), "retry");
  retry.reset();
  assert.deepEqual(retry.snapshot(), { failures: 0, awaitingRepath: false });
  for (const threshold of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => new NativeResidentCollisionRetry(threshold), /Invalid/);
  }
});

test("missing repath handler preserves retry behavior and never silently strands a resident", () => {
  const retry = new NativeResidentCollisionRetry(3);
  for (let i = 0; i < 100; i++) assert.equal(retry.fail(false), "retry");
  assert.equal(retry.snapshot().awaitingRepath, false);
  assert.equal(retry.fail(true), "request-repath");
  retry.reset();
  assert.equal(retry.fail(true), "retry");
});

test("200 collision controllers and one shared native timer: 12,000 failed claims, no duplicated repaths", () => {
  let wall = 0, nextId = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const queue = new NativeResidentTimerQueue(
    () => wall,
    (callback, delay) => {
      const id = ++nextId;
      timers.set(id, { at: wall + delay, callback });
      return id;
    },
    id => { timers.delete(id); },
    32
  );
  const retries = Array.from({ length: 200 }, () => new NativeResidentCollisionRetry(3));
  const escalations = Array<number>(200).fill(0);
  let failures = 0;
  const attempt = (id: number) => {
    failures++;
    const decision = retries[id]!.fail(true);
    if (decision === "retry") queue.schedule(() => attempt(id), 900);
    else if (decision === "request-repath") escalations[id]!++;
  };
  const drain = () => {
    let wakeups = 0;
    while (timers.size) {
      const [id, task] = timers.entries().next().value!;
      if (task.at > wall) break;
      timers.delete(id);
      task.callback();
      if (++wakeups > 100) throw new Error("Unbounded collision timer burst");
    }
    return wakeups;
  };
  for (let cycle = 0; cycle < 20; cycle++) {
    retries.forEach(retry => retry.reset());
    for (let id = 0; id < 200; id++) attempt(id);
    wall += 900;
    assert.equal(drain(), 7, "200 retries must be time-sliced into 32-callback wakeups");
    wall += 900;
    assert.equal(drain(), 7);
    assert.equal(queue.snapshot().pending, 0);
    assert.equal(timers.size, 0);
    assert.ok(escalations.every(n => n === cycle + 1));
    // Late callbacks must not generate duplicate requests.
    for (let id = 0; id < 200; id++) assert.equal(retries[id]!.fail(true), "awaiting-repath");
  }
  assert.equal(failures, 12_000);
  assert.equal(escalations.reduce((a, b) => a + b, 0), 4_000);
  assert.ok(queue.snapshot().platformWakeups >= 280);
});

test("pause/background freezes remaining collision retries without an immediate burst", () => {
  let wall = 0, nextId = 0, called = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const queue = new NativeResidentTimerQueue(
    () => wall,
    (callback, delay) => {
      const id = ++nextId;
      timers.set(id, { at: wall + delay, callback });
      return id;
    },
    id => { timers.delete(id); },
    32
  );
  for (let i = 0; i < 200; i++) queue.schedule(() => { called++; }, 900);
  wall = 300;
  queue.setActive(false);
  assert.equal(timers.size, 0);
  wall = 100_000;
  queue.setActive(true);
  assert.equal(called, 0);
  assert.equal(timers.size, 1);
  assert.equal([...timers.values()][0]!.at, 100_600);
  wall = 100_599;
  assert.equal(called, 0);
  wall = 100_600;
  while (timers.size) {
    const [id, task] = timers.entries().next().value!;
    assert.ok(task.at <= wall);
    timers.delete(id);
    task.callback();
  }
  assert.equal(called, 200);
  assert.equal(queue.snapshot().pending, 0);
});

test("200 runners stop their walking sprites on collision and restart cleanly after reroute", () => {
  const frames = new Map<number, (at: number) => void>();
  let nextId = 0;
  const bus = new NativeResidentFrameBus(
    callback => { const id = ++nextId; frames.set(id, callback); return id; },
    id => { frames.delete(id); }
  );
  const walking = Array<boolean>(200).fill(false);
  const arrivals = Array<number>(200).fill(0);
  const runners = Array.from({ length: 200 }, (_, i) => new NativeResidentSegmentRunner({
    requestFrame: callback => bus.request(callback),
    subscribeFrame: callback => bus.subscribeFrame(callback),
    cancelFrame: id => bus.cancel(id),
    readTimeScale: () => 1,
    writePositionXY: (x, y) => { assert.ok(Number.isFinite(x) && Number.isFinite(y)); },
    advanceSprite: () => {},
    setWalking: moving => { walking[i] = moving; }
  }));
  const dispatch = (at: number) => {
    assert.equal(frames.size, 1);
    const [id, callback] = frames.entries().next().value!;
    frames.delete(id);
    callback(at);
  };
  const start = (at: number) => runners.forEach((runner, i) => runner.start({
    from: { x: i, y: 0 }, to: { x: i + 1, y: 0 },
    startTimestamp: at, durationMs: 100, keepWalkingOnArrival: true,
    onArrival: () => { arrivals[i]!++; }
  }));
  start(0);
  dispatch(100);
  assert.ok(walking.every(Boolean), "intermediate arrivals preserve walking for a seamless next step");
  assert.equal(frames.size, 0);
  const retry = Array.from({ length: 200 }, () => new NativeResidentCollisionRetry(3));
  for (let id = 0; id < 200; id++) {
    runners[id]!.stop(); // actual native blocked-claim branch
    assert.equal(walking[id], false);
    assert.equal(retry[id]!.fail(true), "retry");
    assert.equal(retry[id]!.fail(true), "retry");
    assert.equal(retry[id]!.fail(true), "request-repath");
    retry[id]!.reset();
  }
  assert.equal(bus.snapshot().continuousSubscribers, 0);
  start(200);
  dispatch(300);
  assert.ok(arrivals.every(n => n === 2));
  runners.forEach(runner => runner.stop());
  assert.ok(walking.every(moving => moving === false));
  assert.equal(frames.size, 0);
});

test("native renderer stops walking before retry/repath and never changes the web renderer", () => {
  const native = readFileSync(new URL("../src/components/MapWandererCharacter.native.tsx", import.meta.url), "utf8");
  const web = readFileSync(new URL("../src/components/MapWandererCharacter.tsx", import.meta.url), "utf8");
  const block = native.slice(native.indexOf("if (claim && !softHomeEntry && !claim(to))"),
    native.indexOf("// Soft entry casa"));
  assert.match(block, /motion\.stop\(\)/);
  assert.match(block, /claimRetry\.fail\(canRepath\)/);
  assert.match(block, /decision === "request-repath"/);
  assert.ok(block.indexOf("motion.stop()") < block.indexOf("onCommuteBlockedRef.current?.("));
  assert.match(native, /claimRetry\.reset\(\)/);
  assert.doesNotMatch(native, /claimFailCountRef/);
  assert.doesNotMatch(web, /NativeResidentCollisionRetry|claimRetry/);
});


test("repath fallback is delayed, one-shot and never repeats expensive pathfinding", () => {
  const retry = new NativeResidentCollisionRetry(3);
  assert.equal(retry.fail(true), "retry");
  assert.equal(retry.fail(true), "retry");
  assert.equal(retry.fail(true), "request-repath");
  for (let i = 0; i < 1000; i++) assert.equal(retry.fail(true), "awaiting-repath");
  assert.equal(retry.resumeWithoutRepath(retry.repathGeneration()), true);
  assert.equal(retry.resumeWithoutRepath(retry.repathGeneration()), false, "duplicate timer delivery cannot restart the route");
  for (let i = 0; i < 1000; i++) assert.equal(retry.fail(true), "retry");
  retry.reset(); // successful claim or replacement route
  assert.equal(retry.resumeWithoutRepath(retry.repathGeneration()), false, "obsolete fallback cannot revive a new route");
  assert.equal(retry.fail(true), "retry");
  assert.equal(retry.fail(true), "retry");
  assert.equal(retry.fail(true), "request-repath");
});

test("200 residents, 20 route cycles, 120,000 fallback collisions: one repath request per cycle", () => {
  const retries = Array.from({ length: 200 }, () => new NativeResidentCollisionRetry(3));
  let requests = 0, fallbackAttempts = 0;
  for (let cycle = 0; cycle < 20; cycle++) {
    for (const retry of retries) {
      assert.equal(retry.fail(true), "retry");
      assert.equal(retry.fail(true), "retry");
      assert.equal(retry.fail(true), "request-repath");
      requests++;
      assert.equal(retry.resumeWithoutRepath(retry.repathGeneration()), true);
      for (let i = 0; i < 30; i++) {
        assert.equal(retry.fail(true), "retry");
        fallbackAttempts++;
      }
      retry.reset();
    }
  }
  assert.equal(requests, 4_000);
  assert.equal(fallbackAttempts, 120_000);
});

test("200 delayed repath fallbacks freeze during pause and discard replaced routes", () => {
  let wall = 0, nextId = 0, resumed = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const queue = new NativeResidentTimerQueue(
    () => wall,
    (callback, delay) => {
      const id = ++nextId;
      timers.set(id, { at: wall + delay, callback });
      return id;
    },
    id => { timers.delete(id); },
    32
  );
  const retries = Array.from({ length: 200 }, () => new NativeResidentCollisionRetry(3));
  for (let id = 0; id < 200; id++) {
    const retry = retries[id]!;
    assert.equal(retry.fail(true), "retry");
    assert.equal(retry.fail(true), "retry");
    assert.equal(retry.fail(true), "request-repath");
    const generation = retry.repathGeneration();
    queue.schedule(() => { if (retry.resumeWithoutRepath(generation)) resumed++; }, 900);
  }
  wall = 300;
  queue.setActive(false);
  assert.equal(timers.size, 0);
  // 100 residents receive a replacement route or complete while paused.
  for (let id = 0; id < 100; id++) retries[id]!.reset();
  wall = 100_000;
  queue.setActive(true);
  assert.equal(resumed, 0);
  assert.equal([...timers.values()][0]!.at, 100_600);
  wall = 100_600;
  let wakeups = 0;
  while (timers.size) {
    const [id, task] = timers.entries().next().value!;
    assert.ok(task.at <= wall);
    timers.delete(id);
    task.callback();
    if (++wakeups > 20) throw new Error("Unbounded fallback burst");
  }
  assert.equal(resumed, 100);
  assert.equal(queue.snapshot().pending, 0);
  assert.ok(retries.slice(0, 100).every(r => r.resumeWithoutRepath(r.repathGeneration()) === false));
  assert.ok(retries.slice(100).every(r => r.fail(true) === "retry"));
});

test("native-only fallback is scheduled before parent repath callback; web stays untouched", () => {
  const native = readFileSync(new URL("../src/components/MapWandererCharacter.native.tsx", import.meta.url), "utf8");
  const web = readFileSync(new URL("../src/components/MapWandererCharacter.tsx", import.meta.url), "utf8");
  const start = native.indexOf('if (decision === "request-repath")');
  const end = native.indexOf('if (decision === "awaiting-repath")', start);
  const branch = native.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(branch, /pendingCommuteRetry\.hold\(/);
  assert.match(branch, /claimRetry\.resumeWithoutRepath\(repathGeneration\)/);
  // The renderer now uses a route-owned timer rather than calling the
  // shared scheduler directly. Assert the real ownership boundary, not an
  // implementation detail that disappeared during the timer refactor.
  assert.match(native, /new NativeResidentOwnedTimer\(scheduleNativeResidentTimer, cancelNativeResidentTimer\)/);
  const fallbackTimer = branch.match(/wakeTimer\.schedule\(\(\) => \{([\s\S]*?)\}, CLAIM_RETRY_MS\)/);
  assert.ok(fallbackTimer, "repath fallback must be scheduled through the route-owned timer");
  assert.match(fallbackTimer[1]!, /if \(!routeEpoch\.isCurrent\(routeToken\)\) return;/);
  assert.match(fallbackTimer[1]!, /pendingCommuteRetry\.take\(\)\?\.\(\)/);
  assert.ok(fallbackTimer[1]!.indexOf("routeEpoch.isCurrent(routeToken)") <
    fallbackTimer[1]!.indexOf("pendingCommuteRetry.take()"),
    "obsolete route must not consume the current route's pending retry");
  assert.ok(branch.indexOf("pendingCommuteRetry.hold(") < branch.indexOf("wakeTimer.schedule("));
  assert.ok(branch.indexOf("wakeTimer.schedule(") < branch.indexOf("onCommuteBlockedRef.current?.("),
    "arm fallback before invoking a potentially synchronous parent reroute");
  const retryBranch = native.slice(end, native.indexOf("// Soft entry casa", end));
  const retryTimer = retryBranch.match(/wakeTimer\.schedule\(\(\) => \{([\s\S]*?)\}, CLAIM_RETRY_MS\)/);
  assert.ok(retryTimer, "ordinary collision retry must use the same owned timer");
  assert.match(retryTimer[1]!, /if \(!routeEpoch\.isCurrent\(routeToken\)\) return;/);
  assert.match(retryTimer[1]!, /pendingCommuteRetry\.take\(\)\?\.\(\)/);
  assert.ok(retryBranch.indexOf("pendingCommuteRetry.hold(") < retryBranch.indexOf("wakeTimer.schedule("));
  assert.doesNotMatch(web, /resumeWithoutRepath|NativeResidentCollisionRetry|NativeResidentOwnedTimer/);
});


test("200 residents reject obsolete fallback closures across 40 replaced routes each", () => {
  const retries = Array.from({ length: 200 }, () => new NativeResidentCollisionRetry(3));
  let staleRejected = 0;
  let validResumed = 0;
  for (let cycle = 0; cycle < 40; cycle++) {
    for (const retry of retries) {
      retry.reset();
      assert.equal(retry.fail(true), "retry");
      assert.equal(retry.fail(true), "retry");
      assert.equal(retry.fail(true), "request-repath");
      const staleGeneration = retry.repathGeneration();
      // A replacement route arrives while the old timer callback is already
      // enqueued by the OS and cannot be reliably withdrawn.
      retry.reset();
      assert.equal(retry.fail(true), "retry");
      assert.equal(retry.fail(true), "retry");
      assert.equal(retry.fail(true), "request-repath");
      const currentGeneration = retry.repathGeneration();
      assert.notEqual(staleGeneration, currentGeneration);
      assert.equal(retry.resumeWithoutRepath(staleGeneration), false);
      staleRejected++;
      assert.equal(retry.snapshot().awaitingRepath, true);
      assert.equal(retry.resumeWithoutRepath(currentGeneration), true);
      validResumed++;
      assert.equal(retry.resumeWithoutRepath(currentGeneration), false);
      assert.equal(retry.fail(true), "retry", "the valid fallback continues retrying");
    }
  }
  assert.equal(staleRejected, 8_000);
  assert.equal(validResumed, 8_000);
});

test("200 stale and 200 live repath fallbacks survive background without cross-route revival", () => {
  let wall = 0, nextId = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const queue = new NativeResidentTimerQueue(
    () => wall,
    (callback, delay) => {
      const id = ++nextId;
      timers.set(id, { at: wall + delay, callback });
      return id;
    },
    id => { timers.delete(id); },
    32
  );
  const retries = Array.from({ length: 200 }, () => new NativeResidentCollisionRetry(3));
  let staleResumed = 0, liveResumed = 0;
  for (const retry of retries) {
    for (let n = 0; n < 2; n++) retry.fail(true);
    assert.equal(retry.fail(true), "request-repath");
    const obsoleteGeneration = retry.repathGeneration();
    // Intentionally leave the obsolete callback scheduled to model a late
    // native delivery after a route has been replaced.
    queue.schedule(() => {
      if (retry.resumeWithoutRepath(obsoleteGeneration)) staleResumed++;
    }, 900);
    retry.reset();
    for (let n = 0; n < 2; n++) retry.fail(true);
    assert.equal(retry.fail(true), "request-repath");
    const liveGeneration = retry.repathGeneration();
    queue.schedule(() => {
      if (retry.resumeWithoutRepath(liveGeneration)) liveResumed++;
    }, 900);
  }
  wall = 300;
  queue.setActive(false);
  assert.equal(timers.size, 0);
  wall = 100_000;
  queue.setActive(true);
  assert.equal([...timers.values()][0]!.at, 100_600);
  wall = 100_600;
  let wakeups = 0;
  while (timers.size > 0) {
    const [id, timer] = timers.entries().next().value!;
    assert.ok(timer.at <= wall);
    timers.delete(id);
    timer.callback();
    if (++wakeups > 20) throw new Error("Repath backlog did not drain");
  }
  assert.equal(staleResumed, 0);
  assert.equal(liveResumed, 200);
  assert.equal(queue.snapshot().pending, 0);
  assert.ok(retries.every(retry => retry.snapshot().awaitingRepath === false));
});

test("seeded 200-resident collision state machine: stale callbacks never revive superseded routes", () => {
  // Independent reference model: each resident has one live route generation.
  // All actions are deterministic and repeatable in CI.
  let seed = 0x297298;
  const random = () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return seed >>> 0;
  };
  const residents = Array.from({ length: 200 }, () => ({
    controller: new NativeResidentCollisionRetry(3),
    generation: 0,
    failures: 0,
    awaiting: false,
    fallback: false,
    callbacks: [] as number[],
  }));
  let stale = 0, accepted = 0, requests = 0, retries = 0;
  for (let step = 0; step < 100_000; step++) {
    const resident = residents[random() % residents.length]!;
    const action = random() % 8;
    if (action === 0 || action === 1) {
      // Route replacement or successful claim invalidates every old closure.
      resident.controller.reset();
      resident.generation++;
      resident.failures = 0;
      resident.awaiting = false;
      resident.fallback = false;
    } else if (action <= 4) {
      const canRepath = action !== 2;
      const actual = resident.controller.fail(canRepath);
      let expected: "retry" | "request-repath" | "awaiting-repath";
      if (resident.awaiting) expected = "awaiting-repath";
      else if (resident.fallback) expected = "retry";
      else {
        resident.failures++;
        if (canRepath && resident.failures >= 3) {
          resident.failures = 0;
          resident.awaiting = true;
          resident.generation++;
          resident.callbacks.push(resident.controller.repathGeneration());
          expected = "request-repath";
          requests++;
        } else expected = "retry";
      }
      assert.equal(actual, expected, `step ${step}`);
      if (expected === "retry") retries++;
    } else {
      // Deliver pending callbacks in a shuffled order, including obsolete ones.
      const generation = resident.callbacks.length && action !== 7
        ? resident.callbacks.splice(random() % resident.callbacks.length, 1)[0]!
        : resident.controller.repathGeneration() - 1;
      const expected = resident.awaiting &&
        generation === resident.controller.repathGeneration();
      assert.equal(resident.controller.resumeWithoutRepath(generation), expected,
        `callback at step ${step}`);
      if (expected) {
        resident.awaiting = false;
        resident.fallback = true;
        accepted++;
      } else stale++;
    }
    assert.deepEqual(resident.controller.snapshot(), {
      failures: resident.failures,
      awaitingRepath: resident.awaiting
    }, `snapshot at step ${step}`);
  }
  assert.ok(requests > 1000);
  assert.ok(retries > 1000);
  assert.ok(stale > 1000);
  assert.ok(accepted > 0);
});
