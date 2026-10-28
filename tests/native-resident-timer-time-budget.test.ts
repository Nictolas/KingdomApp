import assert from "node:assert/strict";
import test from "node:test";
import {
  NativeResidentTimerQueue,
  NATIVE_RESIDENT_TIMER_CALLBACK_BUDGET,
  NATIVE_RESIDENT_TIMER_TIME_BUDGET_MS
} from "../src/performance/nativeResidentTimerQueue.ts";
import { NativeResidentActivityGate } from "../src/performance/nativeResidentActivityGate.ts";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";
import { NativeResidentSegmentRunner } from "../src/performance/nativeResidentSegmentRunner.ts";

/** Fake single-threaded OS: callback cost advances a monotonic wall clock. */
function environment(
  maxCount = NATIVE_RESIDENT_TIMER_CALLBACK_BUDGET,
  maxMs = NATIVE_RESIDENT_TIMER_TIME_BUDGET_MS
) {
  let wall = 0;
  let nextId = 1;
  const alarms = new Map<number, { due: number; callback: () => void }>();
  const frames = new Map<number, (time: number) => void>();
  const queue = new NativeResidentTimerQueue(
    () => wall,
    (callback, delay) => {
      const id = nextId++;
      alarms.set(id, { due: wall + delay, callback });
      return id;
    },
    id => { alarms.delete(id); },
    maxCount, maxMs
  );
  const bus = new NativeResidentFrameBus(
    callback => {
      const id = nextId++;
      frames.set(id, callback);
      return id;
    },
    id => { frames.delete(id); }
  );
  let maxWorkMs = 0;
  let maxCallbacks = 0;
  let turns = 0;
  return {
    queue, bus, alarms, frames,
    get wall() { return wall; },
    get turns() { return turns; },
    get maxWorkMs() { return maxWorkMs; },
    get maxCallbacks() { return maxCallbacks; },
    work(ms: number) { wall += ms; },
    setWall(value: number) { assert.ok(value >= wall); wall = value; },
    wake() {
      assert.equal(alarms.size, 1, "only one native alarm may be armed");
      const [id, alarm] = alarms.entries().next().value!;
      alarms.delete(id);
      wall = Math.max(wall, alarm.due);
      const before = wall;
      const callbacks = queue.snapshot().logicalCallbacks;
      try {
        alarm.callback();
      } finally {
        // A failing callback still consumed a JS turn and simulated work.
        maxWorkMs = Math.max(maxWorkMs, wall - before);
        maxCallbacks = Math.max(maxCallbacks, queue.snapshot().logicalCallbacks - callbacks);
        turns++;
        assert.ok(alarms.size <= 1);
      }
    },
    frame() {
      assert.equal(frames.size, 1);
      const [id, cb] = frames.entries().next().value!;
      frames.delete(id);
      cb(wall);
    },
    drain(maxTurns = 2000) {
      while (alarms.size) {
        if (turns >= maxTurns) throw new Error("timer backlog did not terminate");
        this.wake();
      }
    }
  };
}

test("200 expensive callbacks yield at 6ms instead of monopolizing a 32-callback turn", () => {
  const f = environment();
  const order: number[] = [];
  const simulatedInputBetweenTurns: number[] = [];
  for (let i = 0; i < 200; i++) {
    f.queue.schedule(() => {
      f.work(2);
      order.push(i);
    }, 100);
  }
  f.setWall(100);
  while (f.alarms.size) {
    f.wake();
    // This represents a separately scheduled JS input handler getting a turn;
    // it is NOT a measurement of actual native touch event latency.
    simulatedInputBetweenTurns.push(order.length);
  }
  assert.deepEqual(order, Array.from({ length: 200 }, (_, i) => i));
  assert.equal(f.turns, 67);
  assert.equal(f.maxCallbacks, 3);
  assert.equal(f.maxWorkMs, 6);
  assert.equal(simulatedInputBetweenTurns[0], 3);
  assert.equal(f.queue.snapshot().timeBudgetYields, 66);
  assert.equal(f.queue.snapshot().budgetYields, 66);
  assert.equal(f.queue.snapshot().pending, 0);
});

test("10,000 timers: bounded work, stable FIFO and no duplicate callbacks", () => {
  const f = environment();
  const executed: number[] = [];
  const ids = Array.from({ length: 10_000 }, (_, i) =>
    f.queue.schedule(() => { f.work(0.5); executed.push(i); }, 100)
  );
  for (let i = 0; i < ids.length; i += 17) f.queue.cancel(ids[i]!);
  f.setWall(100);
  f.drain(1000);
  const expected = Array.from({ length: 10_000 }, (_, i) => i).filter(i => i % 17 !== 0);
  assert.deepEqual(executed, expected);
  assert.equal(new Set(executed).size, expected.length);
  assert.ok(f.maxWorkMs <= 6, "each callback costs only 0.5ms");
  assert.ok(f.maxCallbacks <= 12);
  assert.equal(f.queue.snapshot().pending, 0);
  assert.equal(f.queue.snapshot().logicalCallbacks, expected.length);
});

test("single slow callback can exceed a soft time budget; errors and cancellations are isolated", () => {
  const f = environment(32, 6);
  const events: number[] = [];
  const ids: number[] = [];
  for (let i = 0; i < 200; i++) {
    ids.push(f.queue.schedule(() => {
      events.push(i);
      if (i === 0) {
        f.queue.cancel(ids[1]!); // already extracted
        f.queue.cancel(ids[150]!); // still in the heap
        f.work(12); // non-preemptible slow callback
        throw new Error("synthetic slow resident");
      }
      f.work(2);
    }, 100));
  }
  f.setWall(100);
  assert.throws(() => f.wake(), /synthetic slow resident/);
  assert.deepEqual(events, [0]);
  assert.equal(f.maxWorkMs, 12);
  assert.equal(f.queue.snapshot().pending, 197);
  f.drain();
  assert.deepEqual(events, Array.from({ length: 200 }, (_, i) => i)
    .filter(i => i !== 1 && i !== 150));
  assert.equal(f.queue.snapshot().logicalCallbacks, 198);
  assert.equal(f.queue.snapshot().pending, 0);
});

test("pause inside time-sliced callback preserves 199 deadlines across background", () => {
  const f = environment();
  const order: number[] = [];
  for (let i = 0; i < 200; i++) {
    f.queue.schedule(() => {
      order.push(i);
      f.work(2);
      if (i === 0) f.queue.setActive(false);
    }, 900);
  }
  f.setWall(900);
  f.wake();
  assert.deepEqual(order, [0]);
  assert.equal(f.queue.snapshot().pending, 199);
  assert.equal(f.alarms.size, 0);
  f.setWall(100_000);
  f.queue.setActive(true);
  assert.equal(f.queue.snapshot().nextDueInMs, 0);
  f.drain();
  assert.deepEqual(order, Array.from({ length: 200 }, (_, i) => i));
  assert.equal(f.queue.snapshot().pending, 0);
});

test("invalid time budgets rejected, infinite budget preserves count-only behavior", () => {
  for (const ms of [0, -1, Number.NaN, Number.NEGATIVE_INFINITY]) {
    assert.throws(() => environment(32, ms), /time budget/);
  }
  const f = environment(32, Number.POSITIVE_INFINITY);
  for (let i = 0; i < 200; i++) f.queue.schedule(() => f.work(2), 100);
  f.setWall(100);
  f.drain();
  assert.equal(f.turns, 7);
  assert.equal(f.maxCallbacks, 32);
  assert.equal(f.queue.snapshot().timeBudgetYields, 0);
});

test("200 residents: timer time-slicing and persistent RAF share pause and speed transitions", () => {
  const f = environment();
  const gate = new NativeResidentActivityGate(true, false, active => {
    f.queue.setActive(active);
    f.bus.setActive(active);
  });
  let speed = 1;
  const positions = Array<number>(200).fill(0);
  const arrivals = Array<number>(200).fill(0);
  const retries = Array<number>(200).fill(0);
  const runners = Array.from({ length: 200 }, (_, i) =>
    new NativeResidentSegmentRunner({
      requestFrame: cb => f.bus.request(cb),
      subscribeFrame: cb => f.bus.subscribeFrame(cb),
      cancelFrame: id => f.bus.cancel(id),
      readTimeScale: () => speed,
      writePosition: point => { positions[i] = point.x; },
      advanceSprite: () => {},
      setWalking: () => {}
    })
  );
  runners.forEach((runner, i) => runner.start({
    from: { x: 0, y: i }, to: { x: 100, y: i },
    durationMs: 1000, startTimestamp: 0,
    onArrival: () => { arrivals[i]!++; }
  }));
  for (let i = 0; i < 200; i++) f.queue.schedule(() => {
    f.work(2);
    retries[i]!++;
  }, 500);
  f.setWall(100);
  f.frame();
  assert.ok(positions.every(x => x === 10));
  gate.setGamePaused(true);
  assert.equal(f.frames.size, 0);
  assert.equal(f.alarms.size, 0);
  f.setWall(50_000);
  gate.setGamePaused(false);
  f.frame(); // rebase, no teleport
  assert.ok(positions.every(x => x === 10));
  speed = 2;
  f.setWall(50_200);
  f.frame();
  assert.ok(positions.every(x => x === 50));
  f.setWall(50_300);
  f.drain();
  assert.ok(retries.every(n => n === 1));
  assert.ok(f.queue.snapshot().timeBudgetYields > 0);
  speed = 4;
  f.frame();
  assert.ok(arrivals.every(n => n === 1));
  assert.ok(positions.every(x => x === 100));
  runners.forEach(runner => runner.cancel());
  assert.equal(f.frames.size, 0);
  assert.equal(f.alarms.size, 0);
});
