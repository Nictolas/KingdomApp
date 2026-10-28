import assert from "node:assert/strict";
import test from "node:test";
import {
  NativeResidentTimerQueue,
  NATIVE_RESIDENT_TIMER_CALLBACK_BUDGET
} from "../src/performance/nativeResidentTimerQueue.ts";

function fixture(limit = NATIVE_RESIDENT_TIMER_CALLBACK_BUDGET) {
  let wall = 0;
  let osId = 0;
  const os = new Map<number, { at: number; callback: () => void }>();
  const queue = new NativeResidentTimerQueue(
    () => wall,
    (callback, delay) => {
      const id = ++osId;
      os.set(id, { at: wall + delay, callback });
      return id;
    },
    id => { os.delete(id); },
    limit
  );
  let wakes = 0;
  return {
    queue, os,
    get wall() { return wall; },
    get wakes() { return wakes; },
    setWall(next: number) { assert.ok(next >= wall); wall = next; },
    tick() {
      assert.equal(os.size, 1, "only one OS timer can be armed");
      const [id, timer] = [...os.entries()].sort((a, b) => a[1].at - b[1].at)[0]!;
      os.delete(id);
      wall = Math.max(wall, timer.at);
      timer.callback();
      wakes++;
      assert.ok(os.size <= 1);
    },
    drain(maxWakeups = 1000) {
      let count = 0;
      while (os.size) {
        if (++count > maxWakeups) throw new Error("timer backlog failed to drain");
        this.tick();
      }
      return count;
    }
  };
}

test("200 simultaneous idle residents yield to JS after 32 callbacks per OS turn", () => {
  const f = fixture();
  const executed: number[] = [];
  for (let i = 0; i < 200; i++) f.queue.schedule(() => executed.push(i), 2200);
  assert.equal(f.queue.snapshot().callbackBudget, 32);
  assert.equal(f.os.size, 1);
  f.tick();
  assert.equal(f.wall, 2200);
  assert.deepEqual(executed, Array.from({ length: 32 }, (_, i) => i));
  assert.equal(f.queue.snapshot().pending, 168);
  assert.equal(f.queue.snapshot().backlogDue, true);
  assert.equal(f.queue.snapshot().budgetYields, 1);
  assert.equal(f.os.size, 1, "the next batch is scheduled on a new JS task");
  f.drain();
  assert.deepEqual(executed, Array.from({ length: 200 }, (_, i) => i));
  assert.equal(f.wakes, 7);
  assert.equal(f.queue.snapshot().platformWakeups, 7);
  assert.equal(f.queue.snapshot().budgetYields, 6);
  assert.equal(f.queue.snapshot().pending, 0);
  assert.equal(f.queue.snapshot().backlogDue, false);
});

test("a callback cancels siblings both inside the batch and still in the heap", () => {
  const f = fixture();
  const ids: number[] = [];
  const executed: number[] = [];
  for (let i = 0; i < 200; i++) {
    ids.push(f.queue.schedule(() => {
      executed.push(i);
      if (i === 0) {
        f.queue.cancel(ids[1]!); // already extracted into ready
        f.queue.cancel(ids[33]!); // still in heap
        f.queue.cancel(ids[199]!);
      }
    }, 100));
  }
  f.tick();
  assert.equal(executed.length, 31);
  assert.equal(f.queue.snapshot().pending, 166);
  f.drain();
  assert.equal(executed.length, 197);
  assert.equal(new Set(executed).size, 197);
  for (const removed of [1, 33, 199]) assert.ok(!executed.includes(removed));
  assert.deepEqual(executed, Array.from({ length: 200 }, (_, i) => i)
    .filter(i => ![1, 33, 199].includes(i)));
});

test("pause mid-batch retains 187 unfinished callbacks and ignores canceled stale wakeups", () => {
  const f = fixture();
  const executed: number[] = [];
  for (let i = 0; i < 200; i++) {
    f.queue.schedule(() => {
      executed.push(i);
      if (i === 12) f.queue.setActive(false);
    }, 100);
  }
  f.tick();
  assert.equal(executed.length, 13);
  assert.equal(f.queue.snapshot().pending, 187);
  assert.equal(f.os.size, 0);
  f.setWall(100_000);
  f.queue.setActive(true);
  assert.equal(f.queue.snapshot().nextDueInMs, 0);
  const stale = [...f.os.values()][0]!.callback;
  f.queue.setActive(false);
  f.queue.setActive(true);
  stale(); // OS callback from the prior generation must be ignored.
  assert.equal(executed.length, 13);
  f.drain();
  assert.deepEqual(executed, Array.from({ length: 200 }, (_, i) => i));
  assert.equal(f.queue.snapshot().logicalCallbacks, 200);
  assert.equal(f.queue.snapshot().pending, 0);
});

test("new zero-delay callbacks never overtake the already-due resident backlog", () => {
  const f = fixture();
  const order: number[] = [];
  for (let i = 0; i < 200; i++) {
    f.queue.schedule(() => {
      order.push(i);
      if (i === 0) f.queue.schedule(() => order.push(999), 0);
    }, 10);
  }
  f.drain();
  assert.deepEqual(order, [...Array.from({ length: 200 }, (_, i) => i), 999]);
});

test("10,000 simultaneous tasks with distributed cancellations drain in bounded chunks", () => {
  const f = fixture();
  const count = 10_000;
  const executed: number[] = [];
  const ids = Array.from({ length: count }, (_, i) =>
    f.queue.schedule(() => executed.push(i), 100)
  );
  const canceled = new Set<number>();
  for (let i = 0; i < count; i += 11) {
    f.queue.cancel(ids[i]!);
    canceled.add(i);
  }
  const expected = Array.from({ length: count }, (_, i) => i).filter(i => !canceled.has(i));
  let last = 0;
  while (f.os.size) {
    f.tick();
    const completedThisWake = executed.length - last;
    assert.ok(completedThisWake >= 1 && completedThisWake <= 32);
    last = executed.length;
  }
  assert.deepEqual(executed, expected);
  assert.equal(f.queue.snapshot().pending, 0);
  assert.equal(f.wakes, Math.ceil(expected.length / 32));
  assert.equal(f.queue.snapshot().budgetYields, f.wakes - 1);
});

test("unbounded reference queue is unchanged; invalid budgets are rejected", () => {
  const unlimited = fixture(Number.POSITIVE_INFINITY);
  for (let i = 0; i < 200; i++) unlimited.queue.schedule(() => {}, 100);
  unlimited.tick();
  assert.equal(unlimited.wakes, 1);
  assert.equal(unlimited.queue.snapshot().budgetYields, 0);
  for (const invalid of [0, -1, 1.5, Number.NaN, Number.NEGATIVE_INFINITY]) {
    assert.throws(() => fixture(invalid), /callback budget/);
  }
});
