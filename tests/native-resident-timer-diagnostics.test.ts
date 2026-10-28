import assert from "node:assert/strict";
import test from "node:test";

import { NativeResidentTimerQueue } from "../src/performance/nativeResidentTimerQueue.ts";
import { diffNativeResidentTimerCounters } from "../src/performance/nativeResidentTimerDiagnostics.ts";
import { formatNativeMeasurement } from "../src/performance/nativeMeasurementSession.ts";

function clockFixture() {
  let time = 0;
  let nextId = 1;
  const osTimers = new Map<number, { at: number; callback: () => void }>();
  const queue = new NativeResidentTimerQueue(
    () => time,
    (callback, delay) => {
      const id = nextId++;
      osTimers.set(id, { callback, at: time + delay });
      return id;
    },
    (id) => { osTimers.delete(id); }
  );
  return {
    queue, osTimers,
    set(timeMs: number) { time = timeMs; },
    tick(timeMs: number) {
      time = timeMs;
      assert.equal(osTimers.size, 1);
      const [id, frame] = [...osTimers.entries()][0]!;
      assert.ok(frame.at <= time);
      osTimers.delete(id);
      frame.callback();
    }
  };
}

test("200 logical idle callbacks use one OS timer wakeup and report accurate totals", () => {
  const { queue, tick } = clockFixture();
  const before = queue.snapshot();
  let executed = 0;
  for (let i = 0; i < 200; i++) queue.schedule(() => { executed++; }, 2200);
  assert.equal(queue.snapshot().platformSchedules, 1);
  tick(2200);
  const after = queue.snapshot();
  const delta = diffNativeResidentTimerCounters(before, after, 2200);
  assert.equal(executed, 200);
  assert.equal(delta.platformWakeups, 1);
  assert.equal(delta.logicalCallbacks, 200);
  assert.equal(delta.platformSchedules, 1);
  assert.equal(delta.platformCancellations, 0);
  assert.ok(Math.abs(delta.platformWakeupsPerSecond - 1 / 2.2) < 1e-10);
  assert.ok(Math.abs(delta.logicalCallbacksPerSecond - 200 / 2.2) < 1e-10);
  assert.equal(after.pending, 0);
  assert.equal(after.scheduled, false);
});

test("the shared clock cannot move backwards due to a device time adjustment", () => {
  const fixture = clockFixture();
  let fired = 0;
  fixture.set(200);
  fixture.queue.schedule(() => { fired++; }, 300);
  fixture.set(100); // e.g. wall-clock moved backwards
  assert.equal(fixture.queue.snapshot().nextDueInMs, 300);
  assert.equal(fired, 0);
  fixture.set(250);
  fixture.queue.setActive(false);
  assert.equal(fixture.queue.snapshot().pending, 1);
  assert.equal(fixture.queue.snapshot().scheduled, false);
  fixture.set(240);
  fixture.queue.setActive(true);
  assert.equal(fixture.queue.snapshot().nextDueInMs, 250);
  fixture.tick(500);
  assert.equal(fired, 1);
});

test("stale canceled native wakeups do not count as accepted work", () => {
  const fixture = clockFixture();
  fixture.queue.schedule(() => {}, 900);
  const stale = [...fixture.osTimers.values()][0]!.callback;
  fixture.queue.setActive(false);
  fixture.queue.setActive(true);
  const before = fixture.queue.snapshot();
  stale();
  assert.equal(fixture.queue.snapshot().platformWakeups, before.platformWakeups);
  assert.equal(fixture.osTimers.size, 1);
  fixture.tick(900);
  assert.equal(fixture.queue.snapshot().platformWakeups, 1);
});

test("callback errors do not starve other residents and counters remain accurate", () => {
  const fixture = clockFixture();
  let healthy = 0;
  fixture.queue.schedule(() => { throw Error("resident timer failed"); }, 100);
  fixture.queue.schedule(() => { healthy++; }, 100);
  assert.throws(() => fixture.tick(100), /resident timer failed/);
  const snap = fixture.queue.snapshot();
  assert.equal(healthy, 1);
  assert.equal(snap.logicalCallbacks, 2);
  assert.equal(snap.platformWakeups, 1);
  assert.equal(snap.pending, 0);
});

test("counter snapshots reject negative rates after reset and invalid intervals", () => {
  const a = { platformSchedules: 50, platformCancellations: 10, platformWakeups: 20, logicalCallbacks: 400, budgetYields: 50, timeBudgetYields: 20 };
  const b = { platformSchedules: 3, platformCancellations: 1, platformWakeups: 2, logicalCallbacks: 20, budgetYields: 3, timeBudgetYields: 1 };
  const delta = diffNativeResidentTimerCounters(a, b, 0);
  assert.deepEqual(delta, {
    platformSchedules: 0, platformCancellations: 0,
    platformWakeups: 0, logicalCallbacks: 0, budgetYields: 0, timeBudgetYields: 0,
    platformWakeupsPerSecond: 0, logicalCallbacksPerSecond: 0, budgetYieldsPerSecond: 0, timeBudgetYieldsPerSecond: 0
  });
  assert.equal(diffNativeResidentTimerCounters(b, a, Number.NaN).logicalCallbacksPerSecond, 0);
});

test("the 10-second shareable report includes aggregate timers without personal information", () => {
  const result = {
    durationMs: 10_000,
    metrics: {
      samples: 100, jsFps: 60, meanFrameMs: 16.6, p95FrameMs: 21,
      framesOver33Ms: 3, framesOver50Ms: 1
    }
  };
  const timerDelta = diffNativeResidentTimerCounters(
    { platformSchedules: 0, platformCancellations: 0, platformWakeups: 0, logicalCallbacks: 0, budgetYields: 0, timeBudgetYields: 0 },
    { platformSchedules: 25, platformCancellations: 3, platformWakeups: 20, logicalCallbacks: 200, budgetYields: 5, timeBudgetYields: 2 },
    10_000
  );
  const report = formatNativeMeasurement(result, {
    platform: "android", label: "Mappa residente", residents: 200, terrainCells: 800
  }, timerDelta);
  assert.match(report, /Wakeup timeout nativo: 20/);
  assert.match(report, /Yield backlog timer: 5/);
  assert.match(report, /Yield per budget temporale JS: 2/);
  assert.match(report, /Yield per budget temporale JS\/s: 0\.2/);
  assert.match(report, /Yield backlog timer\/s: 0\.5/);
  assert.match(report, /Callback timer residenti: 200/);
  assert.match(report, /Wakeup timeout nativo\/s: 2\.0/);
  assert.match(report, /Callback timer residenti\/s: 20\.0/);
  assert.match(report, /non GPU\/UI FPS/);
  assert.doesNotMatch(report, /email|access_token|token FCM|utente ID/i);
});

test("1000 mixed deadlines and cancellations preserve one OS timer at a time", () => {
  const fixture = clockFixture();
  const executed = new Set<number>();
  const ids = Array.from({ length: 1000 }, (_, i) => fixture.queue.schedule(() => {
    assert.equal(executed.has(i), false);
    executed.add(i);
  }, (i % 10 + 1) * 100));
  const canceled = new Set<number>();
  for (let i = 0; i < 1000; i += 7) {
    fixture.queue.cancel(ids[i]!);
    canceled.add(i);
  }
  fixture.queue.setActive(false);
  fixture.set(10_000);
  assert.equal(fixture.osTimers.size, 0);
  fixture.queue.setActive(true);
  for (let deadline = 100; deadline <= 1000; deadline += 100) {
    fixture.tick(10_000 + deadline);
    assert.ok(fixture.osTimers.size <= 1, "at most one OS timer scheduled");
  }
  assert.equal(executed.size, 1000 - canceled.size);
  for (const i of canceled) assert.equal(executed.has(i), false);
  assert.equal(fixture.queue.snapshot().logicalCallbacks, 1000 - canceled.size);
  assert.equal(fixture.queue.snapshot().platformWakeups, 10);
  assert.equal(fixture.queue.snapshot().pending, 0);
});

test("10,000 mixed resident deadlines use a bounded heap and deliver exactly once", () => {
  const fixture = clockFixture();
  const count = 10_000;
  const executed: number[] = [];
  const ids = Array.from({ length: count }, (_, i) =>
    fixture.queue.schedule(() => executed.push(i), (i % 100 + 1) * 10)
  );
  const canceled = new Set<number>();
  // Cancel across heap positions, not just the earliest event.
  for (let i = 0; i < count; i += 7) {
    fixture.queue.cancel(ids[i]!);
    canceled.add(i);
  }
  assert.equal(fixture.queue.snapshot().pending, count - canceled.size);
  assert.equal(fixture.osTimers.size, 1);
  fixture.queue.setActive(false);
  assert.equal(fixture.osTimers.size, 0);
  fixture.set(50_000);
  fixture.queue.setActive(true);
  assert.equal(fixture.queue.snapshot().nextDueInMs, 10);

  // Heap must preserve the exact ordering of 10k independently registered
  // logical events, even after cancellations and suspension.
  for (let tick = 1; tick <= 100; tick++) fixture.tick(50_000 + tick * 10);
  assert.equal(fixture.queue.snapshot().pending, 0);
  assert.equal(fixture.osTimers.size, 0);
  assert.equal(executed.length, count - canceled.size);
  assert.equal(new Set(executed).size, count - canceled.size);
  assert.equal(fixture.queue.snapshot().platformWakeups, 100);
  assert.equal(fixture.queue.snapshot().logicalCallbacks, count - canceled.size);
  let lastDeadline = 0;
  let lastId = -1;
  for (const index of executed) {
    assert.ok(!canceled.has(index));
    const due = (index % 100 + 1) * 10;
    assert.ok(due >= lastDeadline, "wakeups must preserve deadline order");
    if (due === lastDeadline) assert.ok(index > lastId, "ties preserve registration order");
    lastDeadline = due;
    lastId = index;
  }
});

test("indexed heap remains consistent when callbacks cancel peers and schedule next wakeups", () => {
  const fixture = clockFixture();
  const calls: number[] = [];
  const ids: number[] = [];
  for (let i = 0; i < 250; i++) {
    ids.push(fixture.queue.schedule(() => {
      calls.push(i);
      if (i === 0) {
        fixture.queue.cancel(ids[1]!);
        fixture.queue.cancel(ids[200]!);
        fixture.queue.schedule(() => calls.push(999), 0);
      }
    }, 50));
  }
  fixture.tick(50);
  assert.equal(calls.length, 248);
  assert.equal(calls[0], 0);
  assert.ok(!calls.includes(1));
  assert.ok(!calls.includes(200));
  assert.equal(fixture.queue.snapshot().pending, 1);
  fixture.tick(50);
  assert.equal(calls.length, 249);
  assert.equal(calls[248], 999);
  assert.equal(fixture.queue.snapshot().pending, 0);
});

test("the indexed heap replays only unfinished due tasks after a mid-flush pause", () => {
  const fixture = clockFixture();
  const calls: string[] = [];
  for (let i = 0; i < 200; i++) {
    fixture.queue.schedule(() => {
      calls.push(String(i));
      if (i === 13) fixture.queue.setActive(false);
    }, 50);
  }
  fixture.tick(50);
  assert.equal(calls.length, 14);
  assert.equal(fixture.queue.snapshot().pending, 186);
  assert.equal(fixture.osTimers.size, 0);
  fixture.set(10_000);
  fixture.queue.setActive(true);
  fixture.tick(10_000);
  assert.equal(calls.length, 200);
  assert.equal(new Set(calls).size, 200);
  assert.deepEqual(calls, Array.from({ length: 200 }, (_, i) => String(i)));
});
