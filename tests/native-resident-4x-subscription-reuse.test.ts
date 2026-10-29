import assert from "node:assert/strict";
import test from "node:test";
import { NativeResidentActivityGate } from "../src/performance/nativeResidentActivityGate.ts";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";
import { NativeResidentSegmentRunner } from "../src/performance/nativeResidentSegmentRunner.ts";
import { NativeResidentSpriteFrameDriver } from "../src/performance/nativeResidentSpriteFrameDriver.ts";

/** Deterministic fake OS. This measures *work counts*, never phone FPS. */
function makeFrames() {
  const os = new Map<number, (timestamp: number) => void>();
  const stale: Array<(timestamp: number) => void> = [];
  let next = 0;
  let requests = 0;
  const bus = new NativeResidentFrameBus(
    callback => { requests++; const id = ++next; os.set(id, callback); return id; },
    id => { const cb = os.get(id); if (cb) stale.push(cb); os.delete(id); }
  );
  const gate = new NativeResidentActivityGate(true, false, active => bus.setActive(active));
  return {
    bus, gate, os, stale,
    get requests() { return requests; },
    tick(timestamp: number) {
      assert.equal(os.size, 1, "all live resident walkers share one platform RAF");
      const [id, callback] = os.entries().next().value!;
      os.delete(id);
      callback(timestamp);
      assert.ok(os.size <= 1);
    },
    drainStale(timestamp: number) {
      for (const callback of stale.splice(0)) callback(timestamp);
    }
  };
}

test("4x: 200 actual runners cross 12 consecutive tiles without renewing RAF subscriptions", () => {
  const f = makeFrames();
  const population = 200;
  const tiles = 12;
  const positions = Array<number>(population).fill(0);
  const arrivals = Array<number>(population).fill(0);
  const walking = Array<boolean>(population).fill(false);
  let spriteOffsetPublishes = 0;
  let positionWrites = 0;
  let now = 0;
  const sprites = Array.from({ length: population }, () =>
    new NativeResidentSpriteFrameDriver(40, () => { spriteOffsetPublishes++; })
  );
  const runners = Array.from({ length: population }, (_, resident) =>
    new NativeResidentSegmentRunner({
      requestFrame: cb => f.bus.request(cb),
      subscribeFrame: cb => f.bus.subscribeFrame(cb),
      cancelFrame: id => f.bus.cancel(id),
      readTimeScale: () => 4,
      writePositionXY: (x, y) => {
        assert.equal(y, resident);
        positions[resident] = x;
        positionWrites++;
      },
      advanceSprite: elapsed => sprites[resident]!.advanceElapsed(elapsed),
      setWalking: moving => {
        walking[resident] = moving;
        sprites[resident]!.setMoving(moving);
      }
    })
  );
  const start = (id: number, segment: number): void => {
    runners[id]!.start({
      from: { x: segment * 40, y: id },
      to: { x: (segment + 1) * 40, y: id },
      startTimestamp: now,
      durationMs: 750,
      keepWalkingOnArrival: segment < tiles - 1,
      onArrival: () => {
        arrivals[id]!++;
        if (segment + 1 < tiles) start(id, segment + 1);
      }
    });
  };
  for (let id = 0; id < population; id++) start(id, 0);
  assert.equal(f.bus.snapshot().subscriptionAdds, population);
  let dispatches = 0;
  while (f.bus.snapshot().continuousSubscribers > 0 && dispatches < 260) {
    now += 16;
    if (dispatches === 45) {
      const before = [...positions];
      const spriteBefore = sprites.map(s => s.snapshot().offsetPx);
      f.gate.setGamePaused(true);
      f.gate.setForeground(false);
      assert.equal(f.os.size, 0);
      now += 80_000;
      f.gate.setGamePaused(false);
      assert.equal(f.os.size, 0, "background remains authoritative");
      f.gate.setForeground(true);
      f.tick(now); // first frame only rebases clocks
      assert.deepEqual(positions, before);
      assert.deepEqual(sprites.map(s => s.snapshot().offsetPx), spriteBefore);
      f.drainStale(now);
      assert.deepEqual(positions, before);
    }
    f.tick(now);
    dispatches++;
    assert.ok(f.bus.snapshot().continuousSubscribers <= population);
    assert.ok(f.os.size <= 1);
  }
  assert.ok(dispatches < 260, "4x resident movement failed to finish");
  assert.ok(arrivals.every(n => n === tiles));
  assert.ok(walking.every(value => value === false));
  assert.ok(positions.every(value => value === tiles * 40));
  assert.equal(f.bus.snapshot().continuousSubscribers, 0);
  assert.equal(f.bus.snapshot().subscriptionAdds, population,
    "segment chains must reuse one live registration each (2400 segment starts)");
  assert.equal(f.bus.snapshot().oneShotRequests, 0);
  assert.equal(f.os.size, 0);
  assert.ok(positionWrites <= population * (dispatches + 1));
  assert.ok(spriteOffsetPublishes > 0 && spriteOffsetPublishes <= population * (dispatches + 1));
  runners.forEach(runner => runner.stop());
  f.drainStale(now + 100);
  assert.equal(f.os.size, 0);
  assert.equal(f.bus.snapshot().queued, 0);
});

test("1x/2x/4x: 200 chained residents preserve speed changes, terminal cleanup and callback ownership", () => {
  const f = makeFrames();
  const population = 200;
  const tiles = 6;
  const completions = Array<number>(population).fill(0);
  let now = 0, speed = 1;
  const positions = Array<number>(population).fill(0);
  const runners = Array.from({ length: population }, (_, id) =>
    new NativeResidentSegmentRunner({
      requestFrame: cb => f.bus.request(cb),
      subscribeFrame: cb => f.bus.subscribeFrame(cb),
      cancelFrame: key => f.bus.cancel(key),
      readTimeScale: () => speed,
      writePositionXY: x => { positions[id] = x; },
      advanceSprite: () => {},
      setWalking: () => {}
    })
  );
  const start = (id: number, index: number): void => runners[id]!.start({
    from: { x: index * 10, y: 0 }, to: { x: (index + 1) * 10, y: 0 },
    durationMs: 750, startTimestamp: now,
    keepWalkingOnArrival: index < tiles - 1,
    onArrival: () => {
      completions[id]!++;
      if (index + 1 < tiles) start(id, index + 1);
    }
  });
  runners.forEach((_, id) => start(id, 0));
  let frames = 0;
  while (f.bus.snapshot().continuousSubscribers && frames < 400) {
    frames++;
    now += 16;
    speed = frames <= 35 ? 1 : frames <= 70 ? 2 : 4;
    f.tick(now);
    assert.equal(f.bus.snapshot().subscriptionAdds, population);
    assert.ok(f.os.size <= 1);
  }
  assert.ok(frames < 400);
  assert.ok(completions.every(n => n === tiles));
  assert.ok(positions.every(n => n === tiles * 10));
  assert.equal(f.bus.snapshot().continuousSubscribers, 0);
  assert.equal(f.os.size, 0);
});

test("onArrival throwing cannot retain an idle subscription or starve 199 other 4x walkers", () => {
  const f = makeFrames();
  let now = 0;
  const completed: number[] = [];
  const runners = Array.from({ length: 200 }, (_, id) =>
    new NativeResidentSegmentRunner({
      requestFrame: cb => f.bus.request(cb),
      subscribeFrame: cb => f.bus.subscribeFrame(cb),
      cancelFrame: key => f.bus.cancel(key),
      readTimeScale: () => 4,
      writePositionXY: () => {}, advanceSprite: () => {},
      setWalking: () => {}
    })
  );
  runners.forEach((r, id) => r.start({
    from: { x: 0, y: id }, to: { x: 10, y: id },
    durationMs: 100, startTimestamp: 0,
    onArrival: () => {
      if (id === 0) throw new Error("expected terminal callback failure");
      completed.push(id);
    }
  }));
  now = 40;
  assert.throws(() => f.tick(now), /expected terminal callback failure/);
  assert.equal(completed.length, 199);
  assert.equal(f.bus.snapshot().continuousSubscribers, 0);
  assert.equal(f.bus.snapshot().queued, 0);
  assert.equal(f.os.size, 0);
  const previous = completed.length;
  f.drainStale(now + 100);
  assert.equal(completed.length, previous);
});
