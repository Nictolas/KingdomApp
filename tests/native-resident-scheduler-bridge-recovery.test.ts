import assert from "node:assert/strict";
import test from "node:test";
import { NativeResidentActivityGate } from "../src/performance/nativeResidentActivityGate.ts";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";
import { applyNativeResidentSchedulerActivity } from "../src/performance/nativeResidentSchedulerActivity.ts";
import {
  NativeResidentTimerQueue, NATIVE_RESIDENT_TIMER_CALLBACK_BUDGET
} from "../src/performance/nativeResidentTimerQueue.ts";

/**
 * Fault-injected JS platform doubles, not a physical Android/iOS benchmark.
 * Canceled native callbacks are deliberately retained and delivered late:
 * bridge cancellation can throw, and generation guards must still reject them.
 */
test("200 persistent sprites and 1,600 logical waits recover from BOTH failed platform cancels", () => {
  let wall = 0;
  let rafId = 0;
  let timerId = 0;
  let failRafCancel = true;
  let failTimerCancel = true;
  const raf = new Map<number, (now: number) => void>();
  const timers = new Map<number, { callback: () => void; due: number }>();
  const bus = new NativeResidentFrameBus(
    callback => { const id = ++rafId; raf.set(id, callback); return id; },
    id => {
      if (failRafCancel) { failRafCancel = false; throw new Error("RAF bridge cancel"); }
      raf.delete(id);
    }
  );
  const queue = new NativeResidentTimerQueue(
    () => wall,
    (callback, delay) => {
      const id = ++timerId;
      timers.set(id, { callback, due: wall + delay });
      return id;
    },
    id => {
      if (failTimerCancel) { failTimerCancel = false; throw new Error("timer bridge cancel"); }
      timers.delete(id);
    },
    NATIVE_RESIDENT_TIMER_CALLBACK_BUDGET
  );
  const gate = new NativeResidentActivityGate(true, false, active =>
    applyNativeResidentSchedulerActivity(active, a => queue.setActive(a), a => bus.setActive(a))
  );

  let frames = 0;
  let rebases = 0;
  let timerCalls = 0;
  const subscriptions = Array.from({ length: 200 }, () =>
    bus.subscribeFrame((_timestamp, resumed) => {
      frames++;
      if (resumed) rebases++;
    })
  );
  for (let i = 0; i < 1_600; i++) queue.schedule(() => { timerCalls++; }, 100);
  assert.equal(raf.size, 1);
  assert.equal(timers.size, 1);
  const staleRaf = raf.values().next().value!;
  const staleTimer = timers.values().next().value!.callback;

  wall = 20;
  // Both platform cancels fail, but both schedulers still suspend. The
  // coordinator must preserve the first error instead of swallowing it.
  assert.throws(() => gate.setGamePaused(true), /timer bridge cancel/);
  assert.equal(gate.active, false);
  assert.equal(bus.snapshot().active, false);
  assert.equal(queue.snapshot().active, false);
  assert.equal(bus.snapshot().scheduled, false);
  assert.equal(queue.snapshot().scheduled, false);
  assert.equal(queue.snapshot().pending, 1_600);
  staleRaf(20);
  staleTimer();
  assert.equal(frames, 0);
  assert.equal(timerCalls, 0);

  wall = 80_000; // Paused wall time must not advance any logical deadline.
  gate.setGamePaused(false);
  assert.equal(bus.snapshot().scheduled, true);
  assert.equal(queue.snapshot().scheduled, true);
  assert.equal(queue.snapshot().nextDueInMs, 80);
  // Old OS callbacks can arrive after resume. Neither may steal new work.
  staleRaf(wall);
  staleTimer();
  assert.equal(frames, 0);
  assert.equal(timerCalls, 0);

  const freshRafId = Math.max(...raf.keys());
  assert.notEqual(freshRafId, 1);
  const freshRaf = raf.get(freshRafId)!;
  raf.delete(freshRafId);
  freshRaf(wall);
  assert.equal(frames, 200);
  assert.equal(rebases, 200, "every walker must rebase on the first resumed frame");
  assert.equal(bus.snapshot().continuousSubscribers, 200);
  assert.equal(bus.snapshot().scheduled, true);

  wall += 80;
  let wakeups = 0;
  while (queue.snapshot().pending > 0 && wakeups < 60) {
    const freshTimerId = Math.max(...timers.keys());
    assert.ok(freshTimerId > 1);
    const task = timers.get(freshTimerId)!;
    assert.ok(task.due <= wall);
    timers.delete(freshTimerId);
    task.callback();
    wakeups++;
  }
  assert.equal(wakeups, 50, "1,600 due tasks / 32 per cooperative wakeup");
  assert.equal(timerCalls, 1_600);
  assert.equal(queue.snapshot().pending, 0);
  assert.equal(queue.snapshot().scheduled, false);
  assert.equal(queue.snapshot().platformWakeups, 50);

  for (const id of subscriptions) bus.cancel(id);
  assert.equal(bus.snapshot().continuousSubscribers, 0);
  assert.equal(bus.snapshot().scheduled, false);
  staleRaf(wall + 16);
  staleTimer();
  assert.equal(frames, 200);
  assert.equal(timerCalls, 1_600);
});

test("a last-subscriber RAF cancellation failure never wedges a future resident", () => {
  const frames = new Map<number, (now: number) => void>();
  let nextId = 0;
  let failOnce = true;
  const bus = new NativeResidentFrameBus(
    callback => { const id = ++nextId; frames.set(id, callback); return id; },
    id => {
      if (failOnce) { failOnce = false; throw new Error("cancel failed"); }
      frames.delete(id);
    }
  );
  let callbacks = 0;
  const old = bus.subscribeFrame(() => { callbacks++; });
  const stale = frames.get(1)!;
  assert.throws(() => bus.cancel(old), /cancel failed/);
  assert.equal(bus.snapshot().scheduled, false);
  assert.equal(bus.snapshot().continuousSubscribers, 0);
  const replacement = bus.subscribeFrame(() => { callbacks++; });
  stale(1_000);
  assert.equal(callbacks, 0);
  frames.get(2)!(1_016);
  assert.equal(callbacks, 1);
  bus.cancel(replacement);
  assert.equal(bus.snapshot().scheduled, false);
});

test("platform registration faults do not retain unowned resident subscriptions or timers", () => {
  let rafAttempts = 0;
  const frames = new Map<number, (now: number) => void>();
  const bus = new NativeResidentFrameBus(
    callback => {
      rafAttempts++;
      if (rafAttempts === 1) throw new Error("RAF request failed");
      frames.set(rafAttempts, callback);
      return rafAttempts;
    },
    id => { frames.delete(id); }
  );
  assert.throws(() => bus.subscribeFrame(() => {}), /RAF request failed/);
  assert.equal(bus.snapshot().continuousSubscribers, 0);
  assert.equal(bus.snapshot().scheduled, false);
  let delivered = 0;
  const ids = Array.from({ length: 200 }, () => bus.subscribeFrame(() => { delivered++; }));
  assert.equal(frames.size, 1);
  frames.get(2)!(16);
  assert.equal(delivered, 200);
  ids.forEach(id => bus.cancel(id));
  assert.equal(bus.snapshot().continuousSubscribers, 0);

  let now = 0;
  let attempts = 0;
  const os = new Map<number, () => void>();
  const queue = new NativeResidentTimerQueue(
    () => now,
    callback => {
      attempts++;
      if (attempts === 1) throw new Error("timeout registration failed");
      os.set(attempts, callback);
      return attempts;
    },
    id => { os.delete(id); },
    NATIVE_RESIDENT_TIMER_CALLBACK_BUDGET
  );
  assert.throws(() => queue.schedule(() => {}, 100), /timeout registration failed/);
  assert.equal(queue.snapshot().pending, 0);
  assert.equal(queue.snapshot().scheduled, false);
  let fired = 0;
  for (let i = 0; i < 200; i++) queue.schedule(() => { fired++; }, 100);
  now = 100;
  for (let wakeups = 0; wakeups < 10 && queue.snapshot().pending > 0; wakeups++) {
    const id = Math.max(...os.keys());
    const callback = os.get(id)!;
    os.delete(id);
    callback();
  }
  assert.equal(fired, 200);
  assert.equal(queue.snapshot().pending, 0);
});

test("lifecycle coordinator preserves falsy failures and still attempts both schedulers", () => {
  const calls: string[] = [];
  assert.throws(
    () => applyNativeResidentSchedulerActivity(false,
      () => { calls.push("timer"); throw new Error("first"); },
      () => { calls.push("frame"); throw new Error("second"); }),
    /first/
  );
  assert.deepEqual(calls, ["timer", "frame"]);
  let reached = false;
  try {
    applyNativeResidentSchedulerActivity(false,
      () => { throw 0; },
      () => { reached = true; throw false; }
    );
    assert.fail("falsy platform exception was swallowed");
  } catch (error) {
    assert.equal(error, 0);
  }
  assert.equal(reached, true);
});
