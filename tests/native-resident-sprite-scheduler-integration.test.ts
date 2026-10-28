import assert from "node:assert/strict";
import test from "node:test";
import { NativeResidentActivityGate } from "../src/performance/nativeResidentActivityGate.ts";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";
import { NativeResidentSegmentRunner } from "../src/performance/nativeResidentSegmentRunner.ts";
import { NativeResidentSpriteFrameDriver } from "../src/performance/nativeResidentSpriteFrameDriver.ts";
import { NativeResidentTimerQueue, NATIVE_RESIDENT_TIMER_CALLBACK_BUDGET } from "../src/performance/nativeResidentTimerQueue.ts";

/**
 * End-to-end deterministic model of the native resident scheduling stack.
 * The OS is mocked; this is not a device performance measurement.
 */
test("200 native residents: shared RAF + sprite offsets + collision timers across speeds and background", () => {
  let wall = 0;
  let speed = 1;
  let nextRaf = 1;
  let nextTimeout = 1;
  const frames = new Map<number, (timestamp: number) => void>();
  const timeouts = new Map<number, { at: number; callback: () => void }>();
  let platformFrameRequests = 0;
  let platformTimeoutRequests = 0;
  const bus = new NativeResidentFrameBus(
    callback => {
      platformFrameRequests++;
      const id = nextRaf++;
      frames.set(id, callback);
      return id;
    },
    id => { frames.delete(id); }
  );
  const timers = new NativeResidentTimerQueue(
    () => wall,
    (callback, delayMs) => {
      platformTimeoutRequests++;
      const id = nextTimeout++;
      timeouts.set(id, { at: wall + delayMs, callback });
      return id;
    },
    id => { timeouts.delete(id); },
    NATIVE_RESIDENT_TIMER_CALLBACK_BUDGET
  );
  const gate = new NativeResidentActivityGate(true, false, active => {
    timers.setActive(active);
    bus.setActive(active);
  });

  const population = 200;
  let arrivals = 0;
  const retries: number[] = [];
  const retried: number[] = [];
  const offsetWrites = new Array<number>(population).fill(0);
  const drivers = Array.from({ length: population }, (_, resident) =>
    new NativeResidentSpriteFrameDriver(40, () => { offsetWrites[resident]!++; })
  );
  let positionWrites = 0;
  const motions: NativeResidentSegmentRunner[] = [];
  for (let resident = 0; resident < population; resident++) {
    const driver = drivers[resident]!;
    driver.face(resident % 2 ? "w" : "n");
    const motion = new NativeResidentSegmentRunner({
      requestFrame: callback => bus.request(callback),
      subscribeFrame: callback => bus.subscribeFrame(callback),
      cancelFrame: id => bus.cancel(id),
      readTimeScale: () => speed,
      writePosition: () => { positionWrites++; },
      advanceSprite: elapsed => driver.advanceElapsed(elapsed),
      setWalking: moving => driver.setMoving(moving)
    });
    motions.push(motion);
    motion.start({
      from: { x: 0, y: resident * 40 },
      to: { x: 40, y: resident * 40 },
      startTimestamp: 0,
      durationMs: 1000 + (resident % 3) * 250,
      onArrival: () => {
        arrivals++;
        retries[resident] = timers.schedule(() => retried.push(resident), 900);
      }
    });
  }

  function tick(deltaMs = 16): void {
    wall += deltaMs;
    assert.ok(frames.size <= 1, "the native frame bus must share one OS RAF");
    if (frames.size === 0) return;
    const [id, callback] = frames.entries().next().value!;
    frames.delete(id);
    callback(wall);
  }

  function runTimersUntil(targetWall: number): void {
    while (timeouts.size) {
      const [id, timer] = [...timeouts.entries()]
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0]!;
      if (timer.at > targetWall) break;
      wall = timer.at;
      timeouts.delete(id);
      timer.callback();
      assert.ok(timeouts.size <= 1);
    }
    wall = targetWall;
  }

  for (let i = 0; i < 20; i++) tick();
  assert.equal(arrivals, 0);
  const beforePause = drivers.map(d => d.snapshot().offsetPx);
  const callbacksBeforePause = bus.snapshot().dispatchCount;
  const stale = frames.values().next().value as ((timestamp: number) => void);
  gate.setForeground(false);
  assert.equal(frames.size, 0);
  assert.equal(timeouts.size, 0);
  wall += 30_000;
  stale(wall); // canceled OS callback arriving late must not dispatch residents
  assert.equal(bus.snapshot().dispatchCount, callbacksBeforePause);
  assert.deepEqual(drivers.map(d => d.snapshot().offsetPx), beforePause);

  gate.setForeground(true);
  tick(0); // first frame rebases, never catches up 30 seconds of movement
  assert.deepEqual(drivers.map(d => d.snapshot().offsetPx), beforePause);
  speed = 2;
  for (let i = 0; i < 20; i++) tick();
  speed = 4;
  for (let i = 0; i < 10; i++) tick();
  assert.equal(arrivals, population, "all three segment durations must finish");
  assert.ok(motions.every(motion => motion.snapshot().completed === 1));
  assert.ok(motions.every(motion => !motion.snapshot().active));
  assert.ok(positionWrites <= 200 * 51, "at most one native position write per resident per RAF");
  assert.equal(bus.snapshot().queued, 0);
  assert.equal(bus.snapshot().continuousSubscribers, 0, "no stale moving resident subscription");
  assert.equal(bus.snapshot().subscriptionAdds, population, "one subscription per segment, not per frame");
  assert.equal(frames.size, 0);
  assert.equal(timers.snapshot().pending, population);
  assert.equal(timeouts.size, 1);
  assert.ok(platformFrameRequests <= 52, "one RAF for the entire population per frame");
  assert.ok(platformTimeoutRequests < 20, "200 collision retries share platform alarms");
  assert.ok(offsetWrites.reduce((sum, n) => sum + n, 0) < population * 60,
    "frame-offset writes are much fewer than all per-resident RAF samples");

  // Cancellation while paused must not cause old retry callbacks to fire.
  for (let resident = 0; resident < population; resident += 4) {
    timers.cancel(retries[resident]!);
  }
  assert.equal(timers.snapshot().pending, 150);
  gate.setGamePaused(true);
  assert.equal(timeouts.size, 0);
  wall += 50_000;
  gate.setForeground(false);
  gate.setForeground(true);
  assert.equal(timeouts.size, 0, "foreground must not override manual pause");
  gate.setGamePaused(false);
  assert.equal(timeouts.size, 1);
  runTimersUntil(wall + 2000);
  assert.equal(retried.length, 150);
  assert.ok(timers.snapshot().budgetYields > 0, "integration must exercise real native cooperative batches");
  assert.ok(timers.snapshot().platformWakeups >= Math.ceil(150 / NATIVE_RESIDENT_TIMER_CALLBACK_BUDGET));
  assert.equal(new Set(retried).size, 150);
  assert.ok(retried.every(id => id % 4 !== 0));
  assert.equal(timers.snapshot().pending, 0);
  assert.equal(timeouts.size, 0);
  assert.equal(bus.snapshot().queued, 0);
  assert.equal(gate.active, true);
});
