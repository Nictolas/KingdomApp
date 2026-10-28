import assert from "node:assert/strict";
import test from "node:test";
import { NativeResidentTimerQueue } from "../src/performance/nativeResidentTimerQueue.ts";
import { NativeResidentActivityGate } from "../src/performance/nativeResidentActivityGate.ts";
import { PendingCommuteRetry } from "../src/game/pendingCommuteRetry.ts";

function fakeTimers() {
  let now = 0;
  let nextId = 1;
  let created = 0;
  let canceled = 0;
  const scheduled = new Map<number, { at: number; callback: () => void }>();
  const queue = new NativeResidentTimerQueue(
    () => now,
    (callback, delay) => {
      created++;
      const id = nextId++;
      scheduled.set(id, { at: now + delay, callback });
      return id;
    },
    (id) => {
      canceled++;
      scheduled.delete(id);
    }
  );
  return {
    queue, scheduled,
    get now() { return now; },
    get created() { return created; },
    get canceled() { return canceled; },
    at(time: number) { now = time; },
    tick(time: number) {
      now = time;
      assert.equal(scheduled.size, 1, "only one platform timeout may be active");
      const [id, next] = scheduled.entries().next().value!;
      assert.ok(next.at <= now, "platform timeout must be due");
      scheduled.delete(id);
      next.callback();
    }
  };
}

test("200 idle residents share one platform timeout and all wake once", () => {
  const runner = fakeTimers();
  let woke = 0;
  for (let resident = 0; resident < 200; resident++) {
    runner.queue.schedule(() => { woke++; }, 2200);
  }
  assert.equal(runner.created, 1);
  assert.equal(runner.scheduled.size, 1);
  assert.equal(runner.queue.snapshot().pending, 200);
  runner.tick(2200);
  assert.equal(woke, 200);
  assert.equal(runner.queue.snapshot().pending, 0);
  assert.equal(runner.scheduled.size, 0);
});

test("mixed 900ms collision retries and 2200ms wandering preserve deadlines", () => {
  const runner = fakeTimers();
  const order: string[] = [];
  runner.queue.schedule(() => order.push("idle"), 2200);
  runner.queue.schedule(() => order.push("retry-a"), 900);
  runner.queue.schedule(() => order.push("retry-b"), 900);
  runner.tick(900);
  assert.deepEqual(order, ["retry-a", "retry-b"]);
  assert.equal(runner.scheduled.size, 1);
  runner.tick(2200);
  assert.deepEqual(order, ["retry-a", "retry-b", "idle"]);
});

test("pause preserves remaining wait and does not schedule a platform timer", () => {
  const runner = fakeTimers();
  let woke = 0;
  runner.queue.schedule(() => { woke++; }, 2200);
  runner.at(800);
  runner.queue.setActive(false);
  assert.equal(runner.scheduled.size, 0);
  assert.equal(runner.queue.snapshot().pending, 1);
  assert.equal(runner.queue.snapshot().nextDueInMs, null);
  runner.at(100_000);
  assert.equal(woke, 0);
  runner.queue.setActive(true);
  assert.equal(runner.queue.snapshot().nextDueInMs, 1400);
  runner.tick(101_400);
  assert.equal(woke, 1);
});

test("200 resident timers pause and foreground without any pending native timeout", () => {
  const runner = fakeTimers();
  const gate = new NativeResidentActivityGate(true, false, active => runner.queue.setActive(active));
  let completed = 0;
  for (let i = 0; i < 200; i++) runner.queue.schedule(() => completed++, 2200);
  runner.at(1000);
  gate.setForeground(false);
  assert.equal(runner.scheduled.size, 0);
  gate.setGamePaused(true);
  gate.setForeground(true);
  assert.equal(runner.scheduled.size, 0, "foreground cannot override game pause");
  runner.at(5000);
  gate.setGamePaused(false);
  assert.equal(runner.scheduled.size, 1);
  assert.equal(runner.queue.snapshot().nextDueInMs, 1200);
  runner.tick(6200);
  assert.equal(completed, 200);
});

test("a timer created while paused waits its entire duration after resume", () => {
  const runner = fakeTimers();
  runner.queue.setActive(false);
  runner.at(500);
  let called = false;
  runner.queue.schedule(() => { called = true; }, 900);
  assert.equal(runner.scheduled.size, 0);
  runner.at(30_000);
  runner.queue.setActive(true);
  runner.tick(30_900);
  assert.equal(called, true);
});

test("canceling the earliest timer reschedules only next deadline", () => {
  const runner = fakeTimers();
  const calls: string[] = [];
  const first = runner.queue.schedule(() => calls.push("first"), 300);
  runner.queue.schedule(() => calls.push("second"), 500);
  runner.queue.cancel(first);
  assert.equal(runner.queue.snapshot().pending, 1);
  runner.tick(500);
  assert.deepEqual(calls, ["second"]);
});

test("one callback can cancel another task due at the same moment", () => {
  const runner = fakeTimers();
  const events: string[] = [];
  let second = 0;
  runner.queue.schedule(() => {
    events.push("first");
    runner.queue.cancel(second);
  }, 50);
  second = runner.queue.schedule(() => events.push("canceled"), 50);
  runner.tick(50);
  assert.deepEqual(events, ["first"]);
});

test("tasks created while flushing execute on a later OS tick", () => {
  const runner = fakeTimers();
  const calls: string[] = [];
  runner.queue.schedule(() => {
    calls.push("first");
    runner.queue.schedule(() => calls.push("next"), 0);
  }, 10);
  runner.tick(10);
  assert.deepEqual(calls, ["first"]);
  assert.equal(runner.scheduled.size, 1);
  runner.tick(10);
  assert.deepEqual(calls, ["first", "next"]);
});

test("if pause begins during a callback, remaining due tasks wait until resume", () => {
  const runner = fakeTimers();
  const calls: string[] = [];
  runner.queue.schedule(() => { calls.push("first"); runner.queue.setActive(false); }, 10);
  runner.queue.schedule(() => calls.push("second"), 10);
  runner.tick(10);
  assert.deepEqual(calls, ["first"]);
  assert.equal(runner.scheduled.size, 0);
  runner.at(3000);
  runner.queue.setActive(true);
  runner.tick(3000);
  assert.deepEqual(calls, ["first", "second"]);
});

test("obsolete OS callback delivered after cancellation cannot fire replacement timer", () => {
  const runner = fakeTimers();
  const calls: string[] = [];
  const first = runner.queue.schedule(() => calls.push("first"), 100);
  const obsolete = [...runner.scheduled.values()][0]!.callback;
  runner.queue.cancel(first);
  runner.queue.schedule(() => calls.push("replacement"), 100);
  obsolete();
  assert.deepEqual(calls, []);
  assert.equal(runner.scheduled.size, 1);
  runner.tick(100);
  assert.deepEqual(calls, ["replacement"]);
});

test("unmounting all 200 resident timers during a pause leaves no pending work", () => {
  const runner = fakeTimers();
  const ids = Array.from({ length: 200 }, () => runner.queue.schedule(() => {
    throw new Error("unmounted resident callback ran");
  }, 2200));
  runner.queue.setActive(false);
  ids.forEach(id => runner.queue.cancel(id));
  runner.queue.setActive(true);
  assert.equal(runner.scheduled.size, 0);
  assert.equal(runner.queue.snapshot().pending, 0);
});

test("invalid timer durations are rejected", () => {
  const runner = fakeTimers();
  assert.throws(() => runner.queue.schedule(() => {}, Number.NaN));
  assert.throws(() => runner.queue.schedule(() => {}, -1));
  assert.throws(() => runner.queue.schedule(() => {}, Number.POSITIVE_INFINITY));
});

test("200 idle countdowns preserve remaining waits across repeated foreground changes", () => {
  const runner = fakeTimers();
  const gate = new NativeResidentActivityGate(true, false, active => runner.queue.setActive(active));
  let awakened = 0;
  const ids = Array.from({ length: 200 }, () =>
    runner.queue.schedule(() => { awakened++; }, 2200)
  );
  runner.at(1000);
  gate.setForeground(false);
  runner.at(10_000);
  gate.setForeground(true);
  gate.setGamePaused(true);
  runner.at(20_000);
  gate.setForeground(false);
  gate.setForeground(true);
  assert.equal(runner.scheduled.size, 0, "still manually paused");
  gate.setGamePaused(false);
  assert.equal(runner.queue.snapshot().nextDueInMs, 1200);
  runner.tick(21_200);
  assert.equal(awakened, 200, "each idle countdown fires once, not at every resume");
  ids.forEach(id => runner.queue.cancel(id)); // harmless after dispatch
  assert.equal(runner.queue.snapshot().pending, 0);
});

test("collision claim retries keep the outstanding delay and run once on resume", () => {
  const runner = fakeTimers();
  const gate = new NativeResidentActivityGate(true, false, active => runner.queue.setActive(active));
  const attempts: number[] = [];
  const retries = Array.from({ length: 200 }, () => new PendingCommuteRetry());
  const scheduled = retries.map((retry, index) => {
    retry.hold(() => { attempts.push(index); });
    return runner.queue.schedule(() => retry.take()?.(), 900);
  });
  runner.at(300);
  gate.setGamePaused(true);
  runner.at(40_000);
  gate.setGamePaused(false);
  assert.equal(runner.queue.snapshot().nextDueInMs, 600);
  assert.equal(attempts.length, 0);
  runner.tick(40_600);
  assert.equal(attempts.length, 200);
  assert.equal(new Set(attempts).size, 200);
  retries.forEach(retry => retry.take()?.());
  scheduled.forEach(id => runner.queue.cancel(id));
  assert.equal(attempts.length, 200, "retries were consumed once");
});

test("replacing a commute path while paused cancels the old timer and retry", () => {
  const runner = fakeTimers();
  const gate = new NativeResidentActivityGate(true, false, active => runner.queue.setActive(active));
  const retry = new PendingCommuteRetry();
  const reached: string[] = [];
  retry.hold(() => reached.push("old path"));
  const oldId = runner.queue.schedule(() => retry.take()?.(), 900);
  runner.at(400);
  gate.setGamePaused(true);
  runner.queue.cancel(oldId);
  retry.clear();
  retry.hold(() => reached.push("new path"));
  runner.queue.schedule(() => retry.take()?.(), 900);
  runner.at(10_000);
  gate.setGamePaused(false);
  runner.tick(10_900);
  assert.deepEqual(reached, ["new path"]);
});
