import assert from "node:assert/strict";
import test from "node:test";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";
import { NativeResidentTimerQueue } from "../src/performance/nativeResidentTimerQueue.ts";
import { NativeResidentActivityGate } from "../src/performance/nativeResidentActivityGate.ts";
import { applyNativeResidentSchedulerActivity } from "../src/performance/nativeResidentSchedulerActivity.ts";

/**
 * Native bridge failure injection with 200 simulated residents.
 * These are correctness tests in Node, not physical FPS or device tests.
 */
function capture(fn: () => unknown): { caught: boolean; value: unknown } {
  let caught = false;
  let value: unknown;
  try { fn(); } catch (error) { caught = true; value = error; }
  return { caught, value };
}

function environment() {
  let wall = 0;
  let nextId = 0;
  let failRafRequest: unknown = null;
  let failRafCancel: unknown = null;
  let failTimerRequest: unknown = null;
  let failTimerCancel: unknown = null;
  // Boolean flags are separate because JavaScript also allows throw null.
  let rejectNextRaf = false;
  let rejectNextRafCancel = false;
  let rejectNextTimer = false;
  let rejectNextTimerCancel = false;
  const frames = new Map<number, (at: number) => void>();
  const alarms = new Map<number, { due: number; fn: () => void }>();
  const staleFrames: Array<(at: number) => void> = [];
  const staleAlarms: Array<() => void> = [];
  const bus = new NativeResidentFrameBus(
    callback => {
      if (rejectNextRaf) {
        rejectNextRaf = false;
        // The OS may have queued a callback before its API throws; the bus
        // must ignore it even when there was no returned cancellation handle.
        staleFrames.push(callback);
        throw failRafRequest;
      }
      const id = ++nextId;
      frames.set(id, callback);
      return id;
    },
    id => {
      const callback = frames.get(id);
      frames.delete(id);
      if (rejectNextRafCancel) {
        rejectNextRafCancel = false;
        if (callback) staleFrames.push(callback);
        throw failRafCancel;
      }
    }
  );
  const queue = new NativeResidentTimerQueue(
    () => wall,
    (fn, delay) => {
      if (rejectNextTimer) {
        rejectNextTimer = false;
        staleAlarms.push(fn);
        throw failTimerRequest;
      }
      const id = ++nextId;
      alarms.set(id, { due: wall + delay, fn });
      return id;
    },
    id => {
      const alarm = alarms.get(id);
      alarms.delete(id);
      if (rejectNextTimerCancel) {
        rejectNextTimerCancel = false;
        if (alarm) staleAlarms.push(alarm.fn);
        throw failTimerCancel;
      }
    },
    32,
    6
  );
  const gate = new NativeResidentActivityGate(
    true, false,
    active => applyNativeResidentSchedulerActivity(active, a => queue.setActive(a), a => bus.setActive(a))
  );
  return {
    bus, queue, gate, frames, alarms, staleFrames, staleAlarms,
    get wall() { return wall; },
    advance(ms: number) { assert.ok(ms >= 0); wall += ms; },
    failFrameRequest(value: unknown) { failRafRequest = value; rejectNextRaf = true; },
    failFrameCancel(value: unknown) { failRafCancel = value; rejectNextRafCancel = true; },
    failTimerSchedule(value: unknown) { failTimerRequest = value; rejectNextTimer = true; },
    failTimerCancellation(value: unknown) { failTimerCancel = value; rejectNextTimerCancel = true; },
    frame() {
      assert.equal(frames.size, 1, "only one platform RAF across 200 residents");
      const [id, fn] = frames.entries().next().value!;
      frames.delete(id);
      fn(wall);
    },
    wake() {
      assert.equal(alarms.size, 1, "only one platform alarm across 200 residents");
      const [id, alarm] = alarms.entries().next().value!;
      assert.ok(alarm.due <= wall, "alarm cannot fire before its active-time deadline");
      alarms.delete(id);
      alarm.fn();
    },
    drain(limit = 16) {
      let turns = 0;
      while (alarms.size) {
        if (++turns > limit) throw new Error("alarm backlog did not drain");
        this.wake();
      }
      return turns;
    },
    deliverStale() {
      for (const cb of staleFrames.splice(0)) cb(wall);
      for (const cb of staleAlarms.splice(0)) cb();
    }
  };
}

test("RAF registration faults roll back both unowned one-shots and persistent walkers", () => {
  const f = environment();
  f.failFrameRequest(undefined);
  const a = capture(() => f.bus.subscribeFrame(() => { throw Error("ghost walker"); }));
  assert.equal(a.caught, true);
  assert.equal(a.value, undefined);
  assert.equal(f.bus.snapshot().queued, 0);
  assert.equal(f.bus.snapshot().continuousSubscribers, 0);
  assert.equal(f.bus.snapshot().subscriptionAdds, 0);
  f.failFrameRequest(false);
  const b = capture(() => f.bus.request(() => { throw Error("ghost one-shot"); }));
  assert.equal(b.caught, true);
  assert.equal(b.value, false);
  assert.equal(f.bus.snapshot().oneShotRequests, 0);
  assert.equal(f.bus.snapshot().queued, 0);
  let received = 0;
  const ids = Array.from({ length: 200 }, () => f.bus.subscribeFrame(() => { received++; }));
  f.deliverStale();
  assert.equal(received, 0);
  f.advance(16);
  f.frame();
  assert.equal(received, 200);
  ids.forEach(id => f.bus.cancel(id));
  assert.equal(f.frames.size, 0);
  assert.equal(f.bus.snapshot().queued, 0);
});

test("cancellation failure must not retain stale RAF ownership or block later residents", () => {
  const f = environment();
  const first = f.bus.subscribeFrame(() => { throw Error("disposed frame"); });
  f.failFrameCancel(0);
  const failure = capture(() => f.bus.cancel(first));
  assert.equal(failure.caught, true);
  assert.equal(failure.value, 0);
  assert.equal(f.bus.snapshot().queued, 0);
  assert.equal(f.bus.snapshot().scheduled, false);
  let runs = 0;
  const ids = Array.from({ length: 200 }, () => f.bus.subscribeFrame(() => { runs++; }));
  f.deliverStale();
  assert.equal(runs, 0);
  f.advance(16);
  f.frame();
  assert.equal(runs, 200);
  ids.forEach(id => f.bus.cancel(id));
  assert.equal(f.frames.size, 0);
});

test("timer registration failure cannot leak a logical wait whose owner never received an ID", () => {
  const f = environment();
  f.failTimerSchedule(null);
  const failed = capture(() => f.queue.schedule(() => { throw Error("ghost timer"); }, 900));
  assert.equal(failed.caught, true);
  assert.equal(failed.value, null);
  assert.equal(f.queue.snapshot().pending, 0);
  assert.equal(f.queue.snapshot().scheduled, false);
  const completed: number[] = [];
  for (let id = 0; id < 200; id++) f.queue.schedule(() => { completed.push(id); }, 900);
  f.deliverStale();
  assert.equal(completed.length, 0);
  f.advance(900);
  assert.equal(f.drain(), 7, "200 timers must still yield in 32-callback turns");
  assert.deepEqual(completed, Array.from({ length: 200 }, (_, i) => i));
  assert.equal(f.queue.snapshot().pending, 0);
});

test("replacing an earlier deadline recovers the former 200 timers if scheduling throws", () => {
  const f = environment();
  const output: number[] = [];
  for (let i = 0; i < 200; i++) f.queue.schedule(() => { output.push(i); }, 900);
  f.failTimerSchedule(Error("native setTimeout unavailable"));
  const failed = capture(() => f.queue.schedule(() => output.push(999), 10));
  assert.equal(failed.caught, true);
  assert.match(String(failed.value), /setTimeout unavailable/);
  assert.equal(f.queue.snapshot().pending, 200);
  f.deliverStale();
  assert.equal(output.length, 0);
  f.advance(900);
  f.drain();
  assert.deepEqual(output, Array.from({ length: 200 }, (_, i) => i));
  assert.equal(f.queue.snapshot().pending, 0);
});

test("a throwing timer cancellation still pauses both schedulers for 200 residents", () => {
  const f = environment();
  const frameCounts = Array<number>(200).fill(0);
  const timerCounts = Array<number>(200).fill(0);
  const resumed = Array<boolean>(200).fill(false);
  const frameIds = Array.from({ length: 200 }, (_, i) =>
    f.bus.subscribeFrame((_at, rebase) => { frameCounts[i]!++; resumed[i] = rebase; })
  );
  for (let i = 0; i < 200; i++) f.queue.schedule(() => { timerCounts[i]!++; }, 900);
  f.advance(100);
  f.failTimerCancellation(false);
  const error = capture(() => f.gate.setForeground(false));
  assert.equal(error.caught, true);
  assert.equal(error.value, false);
  assert.equal(f.queue.snapshot().active, false);
  assert.equal(f.bus.snapshot().active, false);
  assert.equal(f.alarms.size, 0);
  assert.equal(f.frames.size, 0);
  f.advance(100_000);
  f.deliverStale();
  assert.equal(timerCounts.reduce((sum, count) => sum + count, 0), 0);
  assert.equal(frameCounts.reduce((sum, count) => sum + count, 0), 0);
  f.gate.setForeground(true);
  f.frame();
  assert.ok(frameCounts.every(count => count === 1));
  assert.ok(resumed.every(Boolean), "first frame must rebase, not teleport");
  f.advance(799);
  assert.equal(f.alarms.size, 1);
  f.advance(1);
  assert.equal(f.drain(), 7);
  assert.ok(timerCounts.every(count => count === 1));
  frameIds.forEach(id => f.bus.cancel(id));
  assert.equal(f.bus.snapshot().queued, 0);
  assert.equal(f.queue.snapshot().pending, 0);
});

test("a throwing RAF cancellation still pauses timer retries, and late OS frame remains inert", () => {
  const f = environment();
  const positions = Array<number>(200).fill(0);
  const ids = Array.from({ length: 200 }, (_, i) =>
    f.bus.subscribeFrame(() => { positions[i]!++; })
  );
  const alarms = Array.from({ length: 200 }, () => f.queue.schedule(() => {}, 900));
  f.failFrameCancel(undefined);
  const failed = capture(() => f.gate.setGamePaused(true));
  assert.equal(failed.caught, true);
  assert.equal(failed.value, undefined);
  assert.equal(f.bus.snapshot().scheduled, false);
  assert.equal(f.queue.snapshot().scheduled, false);
  f.advance(30_000);
  f.deliverStale();
  assert.equal(positions.reduce((sum, value) => sum + value, 0), 0);
  f.gate.setGamePaused(false);
  f.advance(16);
  f.frame();
  assert.ok(positions.every(v => v === 1));
  ids.forEach(id => f.bus.cancel(id));
  alarms.forEach(id => f.queue.cancel(id));
  assert.equal(f.frames.size, 0);
  assert.equal(f.alarms.size, 0);
});

test("coordinated gate delivers both transitions and preserves the first falsy exception", () => {
  const order: string[] = [];
  const failure = capture(() => applyNativeResidentSchedulerActivity(
    false,
    () => { order.push("timer"); throw null; },
    () => { order.push("frame"); throw Error("second error"); }
  ));
  assert.equal(failure.caught, true);
  assert.equal(failure.value, null);
  assert.deepEqual(order, ["timer", "frame"]);
  for (const active of [false, true]) {
    const states: string[] = [];
    applyNativeResidentSchedulerActivity(
      active,
      state => { states.push("timer-" + state); },
      state => { states.push("frame-" + state); }
    );
    assert.deepEqual(states, ["timer-" + active, "frame-" + active]);
  }
});

test("20 pause cycles with 200 walkers/idle timers and intermittent bridge faults never leave ghost work", () => {
  const f = environment();
  let frames = 0;
  let timers = 0;
  const handles = Array.from({ length: 200 }, () =>
    f.bus.subscribeFrame(() => { frames++; })
  );
  const timersByResident = Array.from({ length: 200 }, () =>
    f.queue.schedule(() => { timers++; }, 2_200)
  );
  for (let cycle = 0; cycle < 20; cycle++) {
    f.advance(16);
    f.frame();
    assert.equal(frames, (cycle + 1) * 200);
    if (cycle % 4 === 0) f.failTimerCancellation(0);
    else if (cycle % 4 === 1) f.failFrameCancel("");
    const failure = capture(() => f.gate.setGamePaused(true));
    assert.equal(failure.caught, cycle % 4 <= 1);
    assert.equal(f.frames.size, 0);
    assert.equal(f.alarms.size, 0);
    f.advance(50_000);
    f.deliverStale();
    assert.equal(frames, (cycle + 1) * 200);
    assert.equal(timers, 0);
    f.gate.setGamePaused(false);
    assert.equal(f.frames.size, 1);
    assert.equal(f.alarms.size, 1);
    assert.equal(f.queue.snapshot().pending, 200);
  }
  timersByResident.forEach(id => f.queue.cancel(id));
  handles.forEach(id => f.bus.cancel(id));
  assert.equal(f.queue.snapshot().pending, 0);
  assert.equal(f.bus.snapshot().queued, 0);
  assert.equal(f.frames.size, 0);
  assert.equal(f.alarms.size, 0);
  f.deliverStale();
  assert.equal(timers, 0);
});
