import assert from "node:assert/strict";
import test from "node:test";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";
import { NativeResidentActivityGate } from "../src/performance/nativeResidentActivityGate.ts";
import { NativeResidentSegmentRunner } from "../src/performance/nativeResidentSegmentRunner.ts";

/** These are fake JS/RAF integration tests, NOT measurements on a phone. */
function environment() {
  let nextId = 0;
  const os = new Map<number, (now: number) => void>();
  const stale: Array<(now: number) => void> = [];
  const bus = new NativeResidentFrameBus(
    callback => { const id = ++nextId; os.set(id, callback); return id; },
    id => { const callback = os.get(id); if (callback) stale.push(callback); os.delete(id); }
  );
  const gate = new NativeResidentActivityGate(true, false, active => bus.setActive(active));
  return {
    bus, gate, os, stale,
    frame(now: number) {
      assert.equal(os.size, 1);
      const [id, callback] = os.entries().next().value!;
      os.delete(id);
      callback(now);
      assert.ok(os.size <= 1);
    },
    staleFrame(now: number) {
      for (const callback of stale.splice(0)) callback(now);
    }
  };
}

test("200 native residents: failed start, sprite initialization or RAF registration leaves no ghost walkers", () => {
  const f = environment();
  const population = 200;
  const walking = Array<boolean>(population).fill(false);
  const arrivals = Array<number>(population).fill(0);
  const runners = Array.from({ length: population }, (_, id) =>
    new NativeResidentSegmentRunner({
      requestFrame: cb => f.bus.request(cb),
      subscribeFrame: cb => {
        if (id % 40 === 30) throw new Error("injected subscribe failure");
        return f.bus.subscribeFrame(cb);
      },
      cancelFrame: key => f.bus.cancel(key),
      readTimeScale: () => 4,
      writePositionXY: () => {},
      advanceSprite: elapsed => {
        if (id % 40 === 20 && elapsed === 0) throw new Error("injected sprite failure");
      },
      setWalking: active => {
        walking[id] = active;
        if (id % 40 === 10 && active) throw new Error("injected walking failure");
      }
    })
  );
  let failed = 0;
  runners.forEach((runner, id) => {
    const start = () => runner.start({
      from: { x: 0, y: id }, to: { x: 100, y: id },
      durationMs: 100, startTimestamp: 0,
      onArrival: () => { arrivals[id]!++; }
    });
    if ([10, 20, 30].includes(id % 40)) {
      assert.throws(start, /injected/);
      failed++;
      assert.equal(runner.snapshot().active, false);
      assert.equal(runner.snapshot().scheduled, false);
      assert.equal(walking[id], false, "a failed start cannot leave phantom movement");
    } else start();
  });
  assert.equal(failed, 15);
  assert.equal(f.bus.snapshot().continuousSubscribers, population - failed);
  assert.equal(f.os.size, 1);
  f.frame(25);
  assert.ok(arrivals.every((n, id) => n === ([10, 20, 30].includes(id % 40) ? 0 : 1)));
  assert.equal(f.bus.snapshot().continuousSubscribers, 0);
  assert.equal(f.os.size, 0);
  assert.ok(walking.every(v => !v));
  f.staleFrame(40_000);
  assert.equal(f.bus.snapshot().queued, 0);
});

test("200 real native runners at 4x: exceptions in 20 sprite/position callbacks isolate only faulty residents", () => {
  const f = environment();
  const population = 200;
  const walking = Array<boolean>(population).fill(false);
  const arrivals = Array<number>(population).fill(0);
  const positions = Array<number>(population).fill(0);
  const runners = Array.from({ length: population }, (_, id) =>
    new NativeResidentSegmentRunner({
      requestFrame: cb => f.bus.request(cb),
      subscribeFrame: cb => f.bus.subscribeFrame(cb),
      cancelFrame: key => f.bus.cancel(key),
      readTimeScale: () => 4,
      writePositionXY: (x, y) => {
        assert.equal(y, id);
        positions[id] = x;
        if (id % 10 === 0) throw new Error("injected 4x position write error");
      },
      advanceSprite: () => {},
      setWalking: moving => { walking[id] = moving; }
    })
  );
  runners.forEach((runner, id) => runner.start({
    from: { x: 0, y: id }, to: { x: 100, y: id },
    durationMs: 100, startTimestamp: 0,
    onArrival: () => { arrivals[id]!++; }
  }));
  assert.throws(() => f.frame(16), /injected 4x position write error/);
  assert.equal(f.bus.snapshot().continuousSubscribers, 180);
  assert.equal(f.os.size, 1);
  assert.ok(walking.every((moving, id) => moving === (id % 10 !== 0)));
  assert.ok(positions.every(x => x === 64));
  f.gate.setGamePaused(true);
  f.gate.setForeground(false);
  assert.equal(f.os.size, 0);
  f.gate.setGamePaused(false);
  assert.equal(f.os.size, 0);
  f.gate.setForeground(true);
  f.frame(100_000); // suspended time is discarded
  assert.ok(arrivals.every(n => n === 0));
  f.frame(100_016);
  assert.equal(f.bus.snapshot().continuousSubscribers, 0);
  assert.equal(f.os.size, 0);
  assert.ok(arrivals.every((n, id) => n === (id % 10 === 0 ? 0 : 1)));
  assert.ok(walking.every(v => !v));
  f.staleFrame(150_000);
  assert.equal(f.bus.snapshot().queued, 0);
});

test("reentrant replacement survives an old 4x callback that throws after starting the new route", () => {
  const f = environment();
  let runner!: NativeResidentSegmentRunner;
  const arrivals: string[] = [];
  const writes: number[] = [];
  let replaced = false;
  runner = new NativeResidentSegmentRunner({
    requestFrame: cb => f.bus.request(cb),
    subscribeFrame: cb => f.bus.subscribeFrame(cb),
    cancelFrame: key => f.bus.cancel(key),
    readTimeScale: () => 4,
    writePositionXY: x => {
      writes.push(x);
      if (!replaced) {
        replaced = true;
        runner.start({
          from: { x: 500, y: 0 }, to: { x: 600, y: 0 },
          startTimestamp: 25, durationMs: 200,
          onArrival: () => { arrivals.push("replacement"); }
        });
        throw new Error("old route threw after replacing itself");
      }
    },
    advanceSprite: () => {},
    setWalking: () => {}
  });
  runner.start({
    from: { x: 0, y: 0 }, to: { x: 100, y: 0 },
    startTimestamp: 0, durationMs: 100,
    onArrival: () => { arrivals.push("obsolete"); }
  });
  assert.throws(() => f.frame(25), /old route threw after replacing itself/);
  assert.equal(f.bus.snapshot().continuousSubscribers, 1);
  assert.equal(runner.snapshot().active, true);
  f.frame(50);
  f.frame(100);
  assert.deepEqual(arrivals, ["replacement"]);
  assert.equal(writes.at(-1), 600);
  assert.equal(f.bus.snapshot().continuousSubscribers, 0);
  assert.equal(f.os.size, 0);
});

test("200 4x terminal arrival exceptions do not starve healthy residents or leave RAF subscriptions", () => {
  const f = environment();
  const population = 200;
  const arrivals = Array<number>(population).fill(0);
  const runners = Array.from({ length: population }, (_, id) =>
    new NativeResidentSegmentRunner({
      requestFrame: cb => f.bus.request(cb),
      subscribeFrame: cb => f.bus.subscribeFrame(cb),
      cancelFrame: key => f.bus.cancel(key),
      readTimeScale: () => 4,
      writePositionXY: () => {},
      advanceSprite: () => {},
      setWalking: () => {}
    })
  );
  runners.forEach((runner, id) => runner.start({
    from: { x: 0, y: id }, to: { x: 100, y: id },
    durationMs: 100, startTimestamp: 0,
    onArrival: () => {
      arrivals[id]!++;
      if (id % 20 === 0) throw new Error("injected arrival failure");
    }
  }));
  assert.throws(() => f.frame(25), /injected arrival failure/);
  assert.ok(arrivals.every(n => n === 1), "one failing arrival cannot starve 199 other callbacks");
  assert.equal(f.bus.snapshot().continuousSubscribers, 0);
  assert.equal(f.bus.snapshot().queued, 0);
  assert.equal(f.os.size, 0);
  runners.forEach(runner => runner.stop());
  f.staleFrame(300_000);
  assert.ok(arrivals.every(n => n === 1));
});


test("200 mixed one-shot/persistent 4x walkers recover from terminal sprite and walking listener failures", () => {
  const f = environment();
  const population = 200;
  const walking = Array<boolean>(population).fill(false);
  const arrivals = Array<number>(population).fill(0);
  const zeroCalls = Array<number>(population).fill(0);
  const spriteFailed = Array<boolean>(population).fill(false);
  const walkingFailed = Array<boolean>(population).fill(false);
  const runners = Array.from({ length: population }, (_, id) =>
    new NativeResidentSegmentRunner({
      requestFrame: cb => f.bus.request(cb),
      ...(id % 2 === 0 ? { subscribeFrame: (cb: (at: number, resumed: boolean) => void) =>
        f.bus.subscribeFrame(cb) } : {}),
      cancelFrame: key => f.bus.cancel(key),
      readTimeScale: () => 4,
      writePositionXY: () => {},
      advanceSprite: elapsed => {
        if (elapsed !== 0) return;
        zeroCalls[id]!++;
        // Even IDs fail ONLY on the terminal reset, never during start.
        if (id % 2 === 0 && zeroCalls[id] === 2 && !spriteFailed[id]) {
          spriteFailed[id] = true;
          throw new Error("injected terminal sprite reset failure");
        }
      },
      setWalking: moving => {
        if (!moving && id % 2 === 1 && !walkingFailed[id]) {
          walkingFailed[id] = true;
          throw new Error("injected terminal walking reset failure");
        }
        walking[id] = moving;
      }
    })
  );
  const start = (id: number, at: number) => runners[id]!.start({
    from: { x: 0, y: id }, to: { x: 100, y: id },
    durationMs: 100, startTimestamp: at, keepWalkingOnArrival: id % 2 === 0,
    onArrival: () => { arrivals[id]!++; }
  });
  runners.forEach((_, id) => start(id, 0));
  assert.throws(() => f.frame(25), /injected terminal/);
  assert.ok(spriteFailed.every((failed, id) => failed === (id % 2 === 0)));
  assert.ok(walkingFailed.every((failed, id) => failed === (id % 2 === 1)));
  assert.ok(walking.every(active => !active), "failed terminal callbacks cannot leave walking=true");
  assert.ok(arrivals.every(n => n === 0), "failed terminal callbacks do not commit arrivals");
  assert.equal(f.bus.snapshot().queued, 0);
  assert.equal(f.os.size, 0);
  // All residents may safely start again after isolating the bad segment.
  runners.forEach((_, id) => start(id, 25));
  f.frame(50);
  assert.ok(arrivals.every(n => n === 1));
  assert.ok(walking.every(active => !active));
  assert.equal(f.bus.snapshot().queued, 0);
  assert.equal(f.os.size, 0);
});
