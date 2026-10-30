import assert from "node:assert/strict";
import test from "node:test";
import { NativeResidentTimerQueue } from "../src/performance/nativeResidentTimerQueue.ts";

type NativeAlarm = { at: number; callback: () => void };

/**
 * Reference model intentionally uses slow Map scans, entirely separate from
 * the indexed heap implementation. It is only a correctness oracle.
 */
test("seeded model comparison: thousands of inserts, cancels, pauses and wakeups", () => {
  let wallNow = 0;
  let activeNow = 0;
  let lastModelWall = 0;
  let modelActive = true;
  let nextAlarmId = 1;
  const nativeAlarms = new Map<number, NativeAlarm>();
  const model = new Map<number, number>();
  const actual: number[] = [];
  const expected: number[] = [];
  const queue = new NativeResidentTimerQueue(
    () => wallNow,
    (callback, delay) => {
      const id = nextAlarmId++;
      nativeAlarms.set(id, { at: wallNow + delay, callback });
      return id;
    },
    (id) => { nativeAlarms.delete(id); }
  );

  function modelSample(): void {
    const delta = Math.max(0, wallNow - lastModelWall);
    if (modelActive) activeNow += delta;
    lastModelWall = Math.max(lastModelWall, wallNow);
  }

  function validate(): void {
    const snap = queue.snapshot();
    assert.equal(snap.pending, model.size);
    assert.equal(snap.active, modelActive);
    assert.ok(nativeAlarms.size <= 1, "only one platform alarm may exist");
    if (!modelActive || model.size === 0) {
      assert.equal(snap.nextDueInMs, null);
      assert.equal(nativeAlarms.size, 0);
    } else {
      const nextDue = Math.min(...model.values());
      assert.equal(snap.nextDueInMs, Math.max(0, nextDue - activeNow));
      assert.equal(nativeAlarms.size, 1);
    }
  }

  function advanceTo(target: number): void {
    assert.ok(target >= wallNow);
    while (nativeAlarms.size) {
      const next = [...nativeAlarms.entries()].sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0]!;
      if (next[1].at > target) break;
      nativeAlarms.delete(next[0]);
      wallNow = next[1].at;
      modelSample();
      const due = [...model.entries()]
        .filter(([, deadline]) => deadline <= activeNow)
        .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
      for (const [id] of due) {
        model.delete(id);
        expected.push(id);
      }
      next[1].callback();
    }
    wallNow = target;
    modelSample();
    validate();
    assert.deepEqual(actual, expected);
  }

  // LCG instead of Math.random: reproduce failures across CI runs.
  let random = 0x1234abcd;
  const draw = (): number => {
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    return random;
  };

  for (let op = 0; op < 4000; op++) {
    const kind = draw() % 100;
    if (kind < 47) {
      const duration = 1 + draw() % 1500;
      modelSample();
      let id = -1;
      id = queue.schedule(() => { actual.push(id); }, duration);
      model.set(id, activeNow + duration);
    } else if (kind < 72) {
      const ids = [...model.keys()];
      if (ids.length) {
        const id = ids[draw() % ids.length]!;
        queue.cancel(id);
        model.delete(id);
      }
    } else if (kind < 91) {
      advanceTo(wallNow + 1 + draw() % 250);
    } else {
      modelSample();
      modelActive = !modelActive;
      queue.setActive(modelActive);
    }
    validate();
  }

  if (!modelActive) {
    modelSample();
    modelActive = true;
    queue.setActive(true);
  }
  advanceTo(wallNow + 20_000);
  assert.equal(model.size, 0);
  assert.equal(queue.snapshot().pending, 0);
  assert.deepEqual(actual, expected);
  assert.equal(new Set(actual).size, actual.length, "no duplicate resident callback");
});
