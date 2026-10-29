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
      subscribeFrame: cb => f.bus.subscribeFrame(cb),
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
  assert.equal(f.bus.snapshot().subscriptionAdds, 200, "no 200 re-registrations per RAF");
  assert.equal(f.bus.snapshot().continuousSubscribers, 0, "all arrivals/unmounts dispose subscriptions");
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

test("synchronous Animated.Value listener may replace a route without completing the obsolete one", () => {
  const f = fakeFrameBus();
  const arrivals: string[] = [];
  const writes: number[] = [];
  let runner!: NativeResidentSegmentRunner;
  runner = new NativeResidentSegmentRunner({
    requestFrame: cb => f.bus.request(cb),
    cancelFrame: id => f.bus.cancel(id),
    readTimeScale: () => 1,
    writePosition: p => {
      writes.push(p.x);
      if (p.x === 50) {
        runner.start({
          from: { x: 500, y: 0 }, to: { x: 600, y: 0 },
          durationMs: 100, startTimestamp: 50,
          onArrival: () => arrivals.push("new")
        });
      }
    },
    advanceSprite: () => {},
    setWalking: () => {}
  });
  runner.start({
    from: { x: 0, y: 0 }, to: { x: 100, y: 0 },
    durationMs: 100, startTimestamp: 0,
    onArrival: () => arrivals.push("obsolete")
  });
  f.tick(50);
  assert.deepEqual(writes, [50]);
  assert.deepEqual(arrivals, []);
  assert.equal(f.os.size, 1);
  f.tick(150);
  assert.deepEqual(writes, [50, 600]);
  assert.deepEqual(arrivals, ["new"]);
  assert.equal(f.os.size, 0);
});

test("synchronous onFrame or setWalking cancellation leaves no phantom RAF", () => {
  const f = fakeFrameBus();
  let runner!: NativeResidentSegmentRunner;
  let frames = 0;
  let positions = 0;
  runner = new NativeResidentSegmentRunner({
    requestFrame: cb => f.bus.request(cb),
    cancelFrame: id => f.bus.cancel(id),
    readTimeScale: () => 1,
    writePosition: () => { positions++; },
    advanceSprite: () => {},
    setWalking: () => {},
    onFrame: () => { frames++; runner.cancel(); }
  });
  runner.start({
    from: { x: 0, y: 0 }, to: { x: 100, y: 0 },
    durationMs: 100, startTimestamp: 0, onArrival: () => { throw new Error("obsolete arrival"); }
  });
  f.tick(50);
  assert.equal(frames, 1);
  assert.equal(positions, 0);
  assert.equal(f.os.size, 0);
  assert.equal(runner.snapshot().active, false);

  let second!: NativeResidentSegmentRunner;
  second = new NativeResidentSegmentRunner({
    requestFrame: cb => f.bus.request(cb),
    cancelFrame: id => f.bus.cancel(id),
    readTimeScale: () => 1,
    writePosition: () => { throw new Error("must not write"); },
    advanceSprite: () => {},
    setWalking: moving => { if (moving) second.cancel(); }
  });
  second.start({
    from: { x: 0, y: 0 }, to: { x: 100, y: 0 },
    durationMs: 100, startTimestamp: 0, onArrival: () => { throw new Error("must not arrive"); }
  });
  assert.equal(second.snapshot().active, false);
  assert.equal(f.os.size, 0);
});

test("persistent runner: 5000 route replacements do not leak frame subscriptions", () => {
  const f = fakeFrameBus();
  const arrivals: number[] = [];
  const runner = new NativeResidentSegmentRunner({
    requestFrame: cb => f.bus.request(cb),
    subscribeFrame: cb => f.bus.subscribeFrame(cb),
    cancelFrame: id => f.bus.cancel(id),
    readTimeScale: () => 1,
    writePosition: () => {},
    advanceSprite: () => {},
    setWalking: () => {}
  });
  for (let i = 0; i < 5000; i++) {
    runner.start({
      from: { x: i, y: 0 }, to: { x: i + 10, y: 0 },
      startTimestamp: 0, durationMs: 100,
      onArrival: () => arrivals.push(i)
    });
    assert.equal(f.bus.snapshot().continuousSubscribers, 1);
    assert.equal(f.bus.snapshot().queued, 1);
    assert.equal(f.os.size, 1);
  }
  f.tick(100);
  assert.deepEqual(arrivals, [4999]);
  assert.equal(f.bus.snapshot().continuousSubscribers, 0);
  assert.equal(f.os.size, 0);
  assert.equal(runner.snapshot().completed, 1);
  assert.equal(f.bus.snapshot().subscriptionAdds, 5000);
});

test("persistent runner: synchronous route replacement never completes obsolete segment", () => {
  const f = fakeFrameBus();
  const arrivals: string[] = [];
  const positions: number[] = [];
  let runner!: NativeResidentSegmentRunner;
  runner = new NativeResidentSegmentRunner({
    requestFrame: cb => f.bus.request(cb),
    subscribeFrame: cb => f.bus.subscribeFrame(cb),
    cancelFrame: id => f.bus.cancel(id),
    readTimeScale: () => 1,
    writePosition: point => {
      positions.push(point.x);
      if (point.x === 50) {
        runner.start({
          from: { x: 500, y: 0 }, to: { x: 600, y: 0 },
          startTimestamp: 50, durationMs: 100,
          onArrival: () => arrivals.push("new")
        });
      }
    },
    advanceSprite: () => {},
    setWalking: () => {}
  });
  runner.start({
    from: { x: 0, y: 0 }, to: { x: 100, y: 0 },
    startTimestamp: 0, durationMs: 100,
    onArrival: () => arrivals.push("obsolete")
  });
  f.tick(50);
  assert.deepEqual(positions, [50]);
  assert.equal(f.bus.snapshot().continuousSubscribers, 1);
  f.tick(150);
  assert.deepEqual(positions, [50, 600]);
  assert.deepEqual(arrivals, ["new"]);
  assert.equal(f.bus.snapshot().continuousSubscribers, 0);
  assert.equal(f.os.size, 0);
});

test("persistent runner: 200 chained commutes reuse one subscription per resident", () => {
  const f = fakeFrameBus();
  const total = 200;
  const segmentsPerResident = 4;
  const completions = Array<number>(total).fill(0);
  const runners = Array.from({ length: total }, () =>
    new NativeResidentSegmentRunner({
      requestFrame: cb => f.bus.request(cb),
      subscribeFrame: cb => f.bus.subscribeFrame(cb),
      cancelFrame: id => f.bus.cancel(id),
      readTimeScale: () => 1,
      writePosition: () => {},
      advanceSprite: () => {},
      setWalking: () => {}
    })
  );
  const start = (id: number, index: number) => {
    runners[id]!.start({
      from: { x: index * 10, y: id },
      to: { x: (index + 1) * 10, y: id },
      startTimestamp: index * 100,
      durationMs: 100,
      keepWalkingOnArrival: index + 1 < segmentsPerResident,
      onArrival: () => {
        completions[id]!++;
        if (index + 1 < segmentsPerResident) start(id, index + 1);
      }
    });
  };
  for (let i = 0; i < total; i++) start(i, 0);
  for (let index = 1; index <= segmentsPerResident; index++) {
    f.tick(index * 100);
    assert.ok(completions.every(value => value === index));
    assert.equal(f.bus.snapshot().continuousSubscribers, index === segmentsPerResident ? 0 : total);
  }
  assert.equal(f.bus.snapshot().subscriptionAdds, total, "200 walkers should subscribe once across four consecutive tiles");
  assert.equal(f.os.size, 0);
  assert.ok(runners.every(r => r.snapshot().completed === segmentsPerResident));
});

test("200 interrupted native commutes clear walking state and preserve pause/RAF invariants", () => {
  const f = fakeFrameBus();
  const gate = new NativeResidentActivityGate(true, false, active => f.bus.setActive(active));
  const count = 200;
  let speed = 1;
  const walking = Array<boolean>(count).fill(false);
  const arrivals = Array<number>(count).fill(0);
  const writes = Array<number>(count).fill(0);
  const runners = Array.from({ length: count }, (_, id) =>
    new NativeResidentSegmentRunner({
      requestFrame: cb => f.bus.request(cb),
      subscribeFrame: cb => f.bus.subscribeFrame(cb),
      cancelFrame: key => f.bus.cancel(key),
      readTimeScale: () => speed,
      writePositionXY: () => { writes[id]!++; },
      advanceSprite: () => {},
      setWalking: active => { walking[id] = active; }
    })
  );
  const start = (id: number, at: number) => runners[id]!.start({
    from: { x: id, y: 0 }, to: { x: id + 100, y: 0 },
    startTimestamp: at, durationMs: 1000,
    onArrival: () => { arrivals[id]!++; }
  });
  for (let id = 0; id < count; id++) start(id, 0);
  assert.equal(f.bus.snapshot().continuousSubscribers, count);
  assert.equal(f.os.size, 1);
  f.tick(100);
  const writesBefore = writes.reduce((sum, n) => sum + n, 0);
  assert.equal(writesBefore, count);
  // 50 routes disappear in foreground; these must be eligible for idle.
  for (let id = 0; id < 50; id++) runners[id]!.stop();
  assert.ok(walking.slice(0, 50).every(value => !value));
  assert.equal(f.bus.snapshot().continuousSubscribers, 150);
  const staleOsFrame = f.os.values().next().value as (at: number) => void;
  gate.setGamePaused(true);
  gate.setForeground(false);
  assert.equal(f.os.size, 0);
  // 50 more route removals while paused must not schedule a RAF.
  for (let id = 50; id < 100; id++) runners[id]!.stop();
  assert.equal(f.bus.snapshot().continuousSubscribers, 100);
  assert.equal(f.os.size, 0);
  assert.ok(walking.slice(0, 100).every(value => !value));
  staleOsFrame(10_000);
  assert.equal(writes.reduce((sum, n) => sum + n, 0), writesBefore);
  gate.setGamePaused(false);
  assert.equal(f.os.size, 0, "foreground=false must continue to suppress RAF");
  gate.setForeground(true);
  f.tick(10_000); // resumed frame only rebases the active motion clocks
  assert.equal(writes.reduce((sum, n) => sum + n, 0), writesBefore);
  // The other 100 residents continue; half replace their path while active.
  for (let id = 100; id < 150; id++) start(id, 10_000);
  speed = 4;
  f.tick(10_200);
  assert.equal(f.bus.snapshot().continuousSubscribers, 100);
  f.tick(10_250);
  assert.equal(f.bus.snapshot().continuousSubscribers, 0);
  assert.equal(f.os.size, 0);
  assert.ok(walking.every(value => !value), "no phantom walking after interruption/arrival");
  assert.ok(arrivals.every((n, id) => n === (id >= 100 ? 1 : 0)),
    "interrupted routes cannot fire old arrivals");
  const beforeStale = [...writes];
  staleOsFrame(20_000);
  assert.deepEqual(writes, beforeStale);
  runners.forEach(runner => runner.stop());
  assert.equal(f.bus.snapshot().continuousSubscribers, 0);
  assert.equal(f.os.size, 0);
});

test("stop is reentrant-safe and does not suppress a replacement started by walking listeners", () => {
  const f = fakeFrameBus();
  let runner!: NativeResidentSegmentRunner;
  const walking: boolean[] = [];
  const arrivals: string[] = [];
  let replaced = false;
  runner = new NativeResidentSegmentRunner({
    requestFrame: cb => f.bus.request(cb),
    subscribeFrame: cb => f.bus.subscribeFrame(cb),
    cancelFrame: id => f.bus.cancel(id),
    readTimeScale: () => 1,
    writePositionXY: () => {},
    advanceSprite: () => {},
    setWalking: active => {
      walking.push(active);
      if (!active && !replaced) {
        replaced = true;
        runner.start({
          from: { x: 50, y: 0 }, to: { x: 60, y: 0 },
          startTimestamp: 0, durationMs: 100,
          onArrival: () => arrivals.push("replacement")
        });
      }
    }
  });
  runner.start({
    from: { x: 0, y: 0 }, to: { x: 10, y: 0 },
    startTimestamp: 0, durationMs: 100,
    onArrival: () => arrivals.push("obsolete")
  });
  runner.stop();
  assert.deepEqual(walking, [true, false, true]);
  assert.equal(runner.snapshot().active, true);
  assert.equal(f.bus.snapshot().continuousSubscribers, 1);
  f.tick(100);
  assert.deepEqual(arrivals, ["replacement"]);
  assert.equal(f.bus.snapshot().continuousSubscribers, 0);
  assert.equal(f.os.size, 0);
});

test("200 real native runners: 180 frames, 1200+ route restarts, terminal stops, background and stale OS RAF", () => {
  const f = fakeFrameBus();
  const population = 200;
  let speed = 1;
  const walking = Array<boolean>(population).fill(false);
  const active = Array<boolean>(population).fill(true);
  const writes = Array<number>(population).fill(0);
  const positions = Array.from({ length: population }, (_, i) => i * 10);
  const arrivals = Array<number>(population).fill(0);
  const runners = Array.from({ length: population }, (_, i) =>
    new NativeResidentSegmentRunner({
      requestFrame: cb => f.bus.request(cb),
      subscribeFrame: cb => f.bus.subscribeFrame(cb),
      cancelFrame: id => f.bus.cancel(id),
      readTimeScale: () => speed,
      writePositionXY: (x, y) => {
        assert.ok(Number.isFinite(x) && y === 0);
        positions[i] = x;
        writes[i]!++;
      },
      advanceSprite: () => {},
      setWalking: moving => { walking[i] = moving; }
    })
  );
  let starts = 0;
  const start = (i: number, at: number) => {
    const from = positions[i]!;
    runners[i]!.start({
      from: { x: from, y: 0 },
      to: { x: from + 1000, y: 0 },
      startTimestamp: at,
      durationMs: 100_000,
      onArrival: () => { arrivals[i]!++; }
    });
    active[i] = true;
    starts++;
  };
  for (let i = 0; i < population; i++) start(i, 0);
  assert.equal(f.os.size, 1);

  let staleDeliveries = 0;
  for (let frame = 1; frame <= 180; frame++) {
    const at = frame * 16;
    speed = [1, 2, 4][frame % 3]!;
    // Forty residents end their route; one frame later they are restarted
    // from their last actual pixel, not a stale cell or an obsolete segment.
    if (frame % 6 === 0) {
      for (let i = 0; i < population; i += 5) {
        runners[i]!.stop();
        active[i] = false;
        assert.equal(walking[i], false);
        assert.equal(runners[i]!.snapshot().scheduled, false);
      }
    } else if (frame % 6 === 1 && frame > 1) {
      for (let i = 0; i < population; i += 5) start(i, at - 16);
    }
    if (frame % 15 === 0) {
      const stale = f.os.values().next().value as (now: number) => void;
      const before = [...writes];
      f.bus.setActive(false);
      assert.equal(f.os.size, 0);
      f.bus.setActive(true);
      stale(at);
      staleDeliveries++;
      assert.deepEqual(writes, before, "late canceled platform RAF must not move any resident");
    }
    const before = [...writes];
    f.tick(at);
    for (let i = 0; i < population; i++) {
      if (!active[i]) {
        assert.equal(walking[i], false);
        assert.equal(writes[i], before[i], "a stopped resident received a frame");
      }
      assert.equal(runners[i]!.snapshot().active, active[i]);
    }
    assert.equal(f.bus.snapshot().continuousSubscribers, active.filter(Boolean).length);
    assert.equal(f.os.size, 1, "one platform RAF regardless of the number of moving residents");
  }
  assert.equal(staleDeliveries, 12);
  assert.ok(starts >= 1200);
  assert.ok(writes.reduce((sum, n) => sum + n, 0) > 10000);
  assert.ok(arrivals.every(n => n === 0), "replaced routes must not report phantom arrivals");
  runners.forEach(r => r.stop());
  assert.ok(walking.every(value => value === false));
  assert.equal(f.bus.snapshot().continuousSubscribers, 0);
  assert.equal(f.os.size, 0);
});
