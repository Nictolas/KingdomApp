import assert from "node:assert/strict";
import test from "node:test";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";
import { NativeResidentActivityGate } from "../src/performance/nativeResidentActivityGate.ts";
import { NativeResidentSegmentRunner, type NativeResidentPoint } from "../src/performance/nativeResidentSegmentRunner.ts";
import { NativeResidentSpriteFrameDriver } from "../src/performance/nativeResidentSpriteFrameDriver.ts";

function fakeFrameBus() {
  let nextId = 1;
  let requests = 0;
  const os = new Map<number, (now: number) => void>();
  const bus = new NativeResidentFrameBus(
    callback => {
      requests++;
      const id = nextId++;
      os.set(id, callback);
      return id;
    },
    id => { os.delete(id); }
  );
  return {
    bus, os,
    get requests() { return requests; },
    tick(now: number) {
      assert.equal(os.size, 1, "exactly one OS RAF for the entire population");
      const [id, callback] = os.entries().next().value!;
      os.delete(id);
      callback(now);
    }
  };
}

test("runner preserves 1x/2x/4x progress and never writes a duplicate arrival snap", () => {
  const f = fakeFrameBus();
  let speed = 1;
  const positions: NativeResidentPoint[] = [];
  const spriteElapsed: number[] = [];
  const walking: boolean[] = [];
  let arrivals = 0;
  const runner = new NativeResidentSegmentRunner({
    requestFrame: callback => f.bus.request(callback),
    cancelFrame: id => f.bus.cancel(id),
    readTimeScale: () => speed,
    writePosition: point => positions.push(point),
    advanceSprite: ms => spriteElapsed.push(ms),
    setWalking: value => walking.push(value)
  });
  runner.start({
    from: { x: 10, y: 20 },
    to: { x: 110, y: 20 },
    startTimestamp: 0,
    durationMs: 1000,
    onArrival: () => { arrivals++; }
  });
  f.tick(100);
  assert.equal(positions.at(-1)?.x, 20);
  speed = 2;
  f.tick(200);
  assert.equal(positions.at(-1)?.x, 40);
  speed = 4;
  f.tick(300);
  assert.equal(positions.at(-1)?.x, 80);
  speed = 0;
  f.tick(400);
  assert.equal(positions.length, 3, "paused/invalid scale never writes a position");
  speed = 4;
  f.tick(475);
  assert.equal(positions.at(-1)?.x, 110);
  assert.equal(positions.filter(p => p.x === 110).length, 1);
  assert.equal(arrivals, 1);
  assert.deepEqual(walking, [true, false]);
  assert.equal(runner.snapshot().completed, 1);
  assert.equal(runner.snapshot().positionWrites, 4);
  assert.equal(f.os.size, 0);
  assert.ok(spriteElapsed.includes(700));
});

test("stale OS callback after cancellation cannot revive a replaced segment", () => {
  const f = fakeFrameBus();
  const writes: NativeResidentPoint[] = [];
  const arrivals: number[] = [];
  const runner = new NativeResidentSegmentRunner({
    requestFrame: cb => f.bus.request(cb),
    cancelFrame: id => f.bus.cancel(id),
    readTimeScale: () => 1,
    writePosition: p => writes.push(p),
    advanceSprite: () => {},
    setWalking: () => {}
  });
  runner.start({
    from: { x: 0, y: 0 }, to: { x: 100, y: 0 },
    startTimestamp: 0, durationMs: 100,
    onArrival: () => arrivals.push(1)
  });
  const stale = f.os.values().next().value as (now: number) => void;
  runner.cancel();
  runner.start({
    from: { x: 500, y: 0 }, to: { x: 600, y: 0 },
    startTimestamp: 0, durationMs: 100,
    onArrival: () => arrivals.push(2)
  });
  stale(100);
  assert.deepEqual(writes, []);
  assert.equal(f.os.size, 1);
  f.tick(100);
  assert.deepEqual(arrivals, [2]);
  assert.deepEqual(writes, [{ x: 600, y: 0 }]);
  assert.equal(runner.snapshot().completed, 1);
  runner.cancel();
  assert.equal(f.os.size, 0);
});

test("commute chain starts the next segment synchronously without losing RAF ownership", () => {
  const f = fakeFrameBus();
  const positions: NativeResidentPoint[] = [];
  const walking: boolean[] = [];
  const arrivalOrder: number[] = [];
  const runner = new NativeResidentSegmentRunner({
    requestFrame: cb => f.bus.request(cb),
    cancelFrame: id => f.bus.cancel(id),
    readTimeScale: () => 1,
    writePosition: point => positions.push(point),
    advanceSprite: () => {},
    setWalking: value => walking.push(value)
  });
  function start(index: number, now: number): void {
    runner.start({
      from: { x: index * 40, y: 0 },
      to: { x: (index + 1) * 40, y: 0 },
      startTimestamp: now, durationMs: 100,
      keepWalkingOnArrival: index < 3,
      onArrival: () => {
        arrivalOrder.push(index);
        if (index < 3) start(index + 1, now + 100);
      }
    });
  }
  start(0, 0);
  for (const at of [100, 200, 300, 400]) f.tick(at);
  assert.deepEqual(arrivalOrder, [0, 1, 2, 3]);
  assert.deepEqual(walking, [true, true, true, true, false]);
  assert.equal(positions.at(-1)?.x, 160);
  assert.equal(runner.snapshot().completed, 4);
  assert.equal(f.os.size, 0);
});

test("200 residents, 60 frames, background, manual pause, 1x/2x/4x and 50 removals", () => {
  const f = fakeFrameBus();
  const gate = new NativeResidentActivityGate(true, false, active => f.bus.setActive(active));
  const population = 200;
  let speed = 1;
  let arrivals = 0;
  let writes = 0;
  let callbacks = 0;
  const positions = Array.from({ length: population }, () => ({ x: 0, y: 0 }));
  const sprites = Array.from({ length: population }, () =>
    new NativeResidentSpriteFrameDriver(40, () => {})
  );
  const runners = Array.from({ length: population }, (_, id) =>
    new NativeResidentSegmentRunner({
      requestFrame: cb => f.bus.request(cb),
      cancelFrame: key => f.bus.cancel(key),
      readTimeScale: () => speed,
      writePosition: p => { positions[id] = p; writes++; },
      advanceSprite: elapsed => sprites[id]!.advanceElapsed(elapsed),
      setWalking: moving => sprites[id]!.setMoving(moving),
      onFrame: () => { callbacks++; }
    })
  );
  runners.forEach((runner, id) => {
    runner.start({
      from: { x: id * 40, y: 0 },
      to: { x: id * 40 + 400, y: 0 },
      startTimestamp: 0,
      durationMs: 2000,
      onArrival: () => { arrivals++; }
    });
  });
  assert.equal(f.os.size, 1);
  for (let i = 1; i <= 20; i++) f.tick(i * 16);
  const before = positions.map(p => p.x);
  const beforeWrites = writes;
  gate.setForeground(false);
  assert.equal(f.os.size, 0);
  gate.setGamePaused(true);
  gate.setForeground(true);
  assert.equal(f.os.size, 0, "manual pause still blocks frames");
  gate.setGamePaused(false);
  f.tick(30_320); // resume rebase
  assert.equal(writes, beforeWrites);
  assert.deepEqual(positions.map(p => p.x), before);
  speed = 2;
  for (let i = 1; i <= 20; i++) f.tick(30_320 + i * 16);
  // Unmount 50 active residents; no old callbacks may complete them.
  for (let id = 0; id < population; id += 4) runners[id]!.cancel();
  assert.equal(f.bus.snapshot().queued, 150);
  speed = 4;
  for (let i = 21; i <= 60; i++) {
    if (!f.os.size) break;
    f.tick(30_320 + i * 16);
  }
  assert.equal(arrivals, 150);
  assert.equal(f.bus.snapshot().queued, 0);
  assert.equal(f.os.size, 0);
  assert.ok(writes <= callbacks, "each RAF callback makes at most one position write");
  assert.ok(runners.every((runner, id) => id % 4 === 0
    ? runner.snapshot().completed === 0 : runner.snapshot().completed === 1));
  assert.equal(new Set(runners.filter((_, id) => id % 4 !== 0).map((r) => r.snapshot().completed)).size, 1);
  assert.ok(f.requests <= 62, "one native RAF per active frame regardless of population");
});

test("invalid segment cannot cancel a valid movement; thousands of restarts keep one RAF", () => {
  const f = fakeFrameBus();
  const runner = new NativeResidentSegmentRunner({
    requestFrame: cb => f.bus.request(cb),
    cancelFrame: id => f.bus.cancel(id),
    readTimeScale: () => 1,
    writePosition: () => {},
    advanceSprite: () => {},
    setWalking: () => {}
  });
  const valid = {
    from: { x: 0, y: 0 }, to: { x: 100, y: 0 },
    durationMs: 100, startTimestamp: 0, onArrival: () => {}
  };
  runner.start(valid);
  assert.throws(() => runner.start({ ...valid, durationMs: Number.NaN }), /Invalid/);
  assert.equal(runner.snapshot().active, true);
  for (let i = 0; i < 5000; i++) {
    runner.start({ ...valid, startTimestamp: i });
    assert.equal(f.os.size, 1);
    assert.equal(f.bus.snapshot().queued, 1);
  }
  runner.cancel();
  assert.equal(f.os.size, 0);
  assert.equal(f.bus.snapshot().queued, 0);
});
