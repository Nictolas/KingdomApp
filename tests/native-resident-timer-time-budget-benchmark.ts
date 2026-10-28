import assert from "node:assert/strict";
import { NativeResidentTimerQueue } from "../src/performance/nativeResidentTimerQueue.ts";

/**
 * Deterministic JS-turn workload model, NOT measured CPU, UI/GPU FPS,
 * battery usage or native touch latency. Each logical callback advances
 * a fake monotonic clock by 2ms; no busy waiting or real OS scheduling.
 */
function scenario(residents: number, timeBudgetMs: number) {
  let clock = 0;
  let nextId = 1;
  const alarms = new Map<number, { due: number; callback: () => void }>();
  const order: number[] = [];
  const queue = new NativeResidentTimerQueue(
    () => clock,
    (callback, delay) => {
      const id = nextId++;
      alarms.set(id, { due: clock + delay, callback });
      return id;
    },
    id => { alarms.delete(id); },
    32, timeBudgetMs
  );
  for (let i = 0; i < residents; i++) {
    queue.schedule(() => { clock += 2; order.push(i); }, 900);
  }
  let turns = 0;
  let maxWorkPerTurnMs = 0;
  let maxCallbacksPerTurn = 0;
  while (alarms.size) {
    assert.equal(alarms.size, 1);
    const [id, alarm] = alarms.entries().next().value!;
    alarms.delete(id);
    clock = Math.max(clock, alarm.due);
    const start = clock;
    const before = order.length;
    alarm.callback();
    maxWorkPerTurnMs = Math.max(maxWorkPerTurnMs, clock - start);
    maxCallbacksPerTurn = Math.max(maxCallbacksPerTurn, order.length - before);
    turns++;
    assert.ok(turns <= residents + 1);
  }
  assert.deepEqual(order, Array.from({ length: residents }, (_, i) => i));
  assert.equal(queue.snapshot().pending, 0);
  return {
    residents, callbackCountLimit: 32,
    simulatedCallbackCostMs: 2,
    softTimeBudgetMs: Number.isFinite(timeBudgetMs) ? timeBudgetMs : null,
    jsTurns: turns, maxCallbacksPerTurn, maxSimulatedWorkPerTurnMs: maxWorkPerTurnMs,
    timeBudgetYields: queue.snapshot().timeBudgetYields
  };
}

for (const residents of [200, 10_000]) {
  const countOnly = scenario(residents, Number.POSITIVE_INFINITY);
  const countAndTime = scenario(residents, 6);
  assert.equal(countOnly.maxCallbacksPerTurn, 32);
  assert.equal(countOnly.maxSimulatedWorkPerTurnMs, 64);
  assert.equal(countAndTime.maxCallbacksPerTurn, 3);
  assert.equal(countAndTime.maxSimulatedWorkPerTurnMs, 6);
  assert.ok(countAndTime.jsTurns > countOnly.jsTurns);
  console.log(JSON.stringify({ type: "synthetic-resident-timer-turn-model", countOnly, countAndTime }));
}
