import assert from "node:assert/strict";
import test from "node:test";
import { NativeResidentTimerQueue } from "../src/performance/nativeResidentTimerQueue.ts";

/**
 * Deterministic fake platform timer. These are JS correctness/stress tests,
 * not measurements of Android/iOS frames, GPU work or physical touch.
 */
function platform() {
  let wall = 0;
  let nextAlarm = 1;
  const alarms = new Map<number, { due: number; callback: () => void }>();
  const canceled: Array<() => void> = [];
  const queue = new NativeResidentTimerQueue(
    () => wall,
    (callback, delay) => {
      const id = nextAlarm++;
      alarms.set(id, { due: wall + delay, callback });
      return id;
    },
    id => {
      const previous = alarms.get(id);
      if (previous) canceled.push(previous.callback);
      alarms.delete(id);
    },
    32,
    6
  );
  return {
    queue, alarms, canceled,
    work(ms: number) { wall += ms; },
    wake() {
      assert.equal(alarms.size, 1, "at most one OS timer");
      const [id, task] = alarms.entries().next().value!;
      alarms.delete(id);
      wall = Math.max(wall, task.due);
      task.callback();
      assert.ok(alarms.size <= 1);
    },
    drain(limit = 1000) {
      for (let turn = 0; alarms.size; turn++) {
        assert.ok(turn < limit, "scheduler failed to drain");
        this.wake();
      }
    }
  };
}

test("200 residents: falsy callback failures propagate, preserve FIFO and drain all siblings", () => {
  for (const thrown of [null, undefined, false, 0, "", Number.NaN]) {
    const f = platform();
    const order: number[] = [];
    for (let i = 0; i < 200; i++) {
      f.queue.schedule(() => {
        order.push(i);
        f.work(2);
        if (i === 0) throw thrown;
        if (i === 1) throw new Error("secondary failure");
      }, 100);
    }
    let caught = false;
    let actual: unknown;
    try {
      f.wake();
    } catch (error) {
      caught = true;
      actual = error;
    }
    assert.equal(caught, true, "a falsy throw must not disappear");
    assert.ok(Object.is(actual, thrown), "the first thrown value must win");
    assert.deepEqual(order, [0, 1, 2]);
    assert.equal(f.queue.snapshot().pending, 197);
    f.drain();
    assert.deepEqual(order, Array.from({ length: 200 }, (_, i) => i));
    assert.equal(f.queue.snapshot().logicalCallbacks, 200);
    assert.equal(f.queue.snapshot().pending, 0);
    assert.equal(f.alarms.size, 0);
    assert.ok(f.queue.snapshot().timeBudgetYields > 0);
  }
});

test("200 residents: reentrant pause/resume and canceled OS wakeups never duplicate tasks", () => {
  const f = platform();
  const order: number[] = [];
  const ids: number[] = [];
  for (let i = 0; i < 200; i++) {
    ids.push(f.queue.schedule(() => {
      order.push(i);
      f.work(2);
      if (i === 0) {
        f.queue.setActive(false);
        f.work(30_000);
        f.queue.setActive(true);
      }
      if (i === 1) f.queue.cancel(ids[150]!);
    }, 100));
  }
  // Force an OS cancellation before the first wake; the canceled callback
  // may still arrive later through a native bridge race.
  f.queue.setActive(false);
  assert.equal(f.canceled.length, 1);
  f.queue.setActive(true);
  f.wake();
  assert.deepEqual(order, [0], "reentrant activity change stops the current flush");
  assert.equal(f.queue.snapshot().pending, 199);
  f.drain();
  const expected = Array.from({ length: 200 }, (_, i) => i).filter(i => i !== 150);
  assert.deepEqual(order, expected);
  assert.equal(new Set(order).size, 199);
  assert.equal(f.queue.snapshot().pending, 0);
  assert.equal(f.alarms.size, 0);
  for (const stale of f.canceled) stale();
  assert.deepEqual(order, expected, "stale native callbacks must remain inert");
  assert.equal(f.queue.snapshot().logicalCallbacks, 199);
});
