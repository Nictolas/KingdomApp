import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  NativeResidentTimerQueue,
  NATIVE_RESIDENT_TIMER_CALLBACK_BUDGET
} from "../src/performance/nativeResidentTimerQueue.ts";

/**
 * Synthetic CPU/latency diagnostic, not a React Native or device benchmark.
 * Reproducible single-threaded fake OS, no real timers or rendering.
 * Do not use absolute timings as CI pass/fail thresholds.
 */
function benchmark(population: number, callbackBudget: number) {
  let wall = 0;
  let nextId = 1;
  const os = new Map<number, { at: number; callback: () => void }>();
  const queue = new NativeResidentTimerQueue(
    () => wall,
    (callback, delay) => {
      const id = nextId++;
      os.set(id, { at: wall + delay, callback });
      return id;
    },
    id => { os.delete(id); },
    callbackBudget
  );
  const completed: number[] = [];
  const begin = performance.now();
  for (let i = 0; i < population; i++) {
    queue.schedule(() => completed.push(i), 2200);
  }
  const insertionMs = performance.now() - begin;
  let maxCallbackCountPerWake = 0;
  let maxWakeCpuMs = 0;
  let wakes = 0;
  const drainStart = performance.now();
  while (os.size) {
    assert.ok(wakes < population + 2, "backlog must terminate");
    assert.equal(os.size, 1, "single native timeout");
    const [id, alarm] = os.entries().next().value!;
    os.delete(id);
    wall = Math.max(wall, alarm.at);
    const beforeCount = completed.length;
    const before = performance.now();
    alarm.callback();
    maxWakeCpuMs = Math.max(maxWakeCpuMs, performance.now() - before);
    maxCallbackCountPerWake = Math.max(maxCallbackCountPerWake, completed.length - beforeCount);
    wakes++;
  }
  const drainMs = performance.now() - drainStart;
  assert.deepEqual(completed, Array.from({ length: population }, (_, i) => i));
  assert.equal(queue.snapshot().logicalCallbacks, population);
  assert.equal(queue.snapshot().pending, 0);
  assert.equal(wakes, callbackBudget === Number.POSITIVE_INFINITY ? 1 : Math.ceil(population / callbackBudget));
  return {
    population, callbackBudget, wakes,
    budgetYields: queue.snapshot().budgetYields,
    maxCallbackCountPerWake,
    insertionMs: +insertionMs.toFixed(3),
    drainMs: +drainMs.toFixed(3),
    maxWakeCpuMs: +maxWakeCpuMs.toFixed(3)
  };
}

const results = [200, 10_000].flatMap(population => [
  benchmark(population, Number.POSITIVE_INFINITY),
  benchmark(population, NATIVE_RESIDENT_TIMER_CALLBACK_BUDGET)
]);
for (const result of results) {
  console.log(JSON.stringify({
    kind: "node_synthetic_timer_burst_not_device_fps",
    ...result,
    callbackBudget: Number.isFinite(result.callbackBudget) ? result.callbackBudget : "unbounded"
  }));
}
