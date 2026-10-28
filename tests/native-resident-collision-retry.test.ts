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
  assert.equal(retry.resumeWithoutRepath(), true);
  assert.equal(retry.resumeWithoutRepath(), false, "duplicate timer delivery cannot restart the route");
  for (let i = 0; i < 1000; i++) assert.equal(retry.fail(true), "retry");
  retry.reset(); // successful claim or replacement route
  assert.equal(retry.resumeWithoutRepath(), false, "obsolete fallback cannot revive a new route");
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
      assert.equal(retry.resumeWithoutRepath(), true);
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
    queue.schedule(() => { if (retry.resumeWithoutRepath()) resumed++; }, 900);
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
  assert.ok(retries.slice(0, 100).every(r => r.resumeWithoutRepath() === false));
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
  assert.match(branch, /claimRetry\.resumeWithoutRepath\(\)/);
  assert.match(branch, /scheduleNativeResidentTimer\(/);
  assert.match(branch, /CLAIM_RETRY_MS/);
  assert.ok(branch.indexOf("scheduleNativeResidentTimer(") < branch.indexOf("onCommuteBlockedRef.current?.("));
  assert.doesNotMatch(web, /resumeWithoutRepath|NativeResidentCollisionRetry/);
});
