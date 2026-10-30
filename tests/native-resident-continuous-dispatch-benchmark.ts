import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";

/**
 * Node-only microbenchmark. Compares Map traversal strategies and the actual
 * frame bus, NOT GPU/UI frames, touch latency, or Android/iPhone performance.
 * Times are observations of this CI/Node host, not release thresholds.
 */
function run(population: number, frames: number) {
  const callbacks = new Map<number, (timestamp: number) => void>();
  let count = 0;
  for (let i = 0; i < population; i++) callbacks.set(i, () => { count++; });
  const visit = (callback: (timestamp: number) => void) => callback(16);

  // Warm both paths before measuring; order can still influence results.
  for (let frame = 0; frame < 20; frame++) {
    for (const [, callback] of callbacks) callback(16);
    callbacks.forEach(visit);
  }
  count = 0;
  const startEntries = performance.now();
  for (let frame = 0; frame < frames; frame++) {
    for (const [, callback] of callbacks) callback(16);
  }
  const entriesMs = performance.now() - startEntries;
  assert.equal(count, population * frames);

  count = 0;
  const startForEach = performance.now();
  for (let frame = 0; frame < frames; frame++) callbacks.forEach(visit);
  const forEachMs = performance.now() - startForEach;
  assert.equal(count, population * frames);

  count = 0;
  let nextId = 0;
  const pending = new Map<number, (timestamp: number) => void>();
  const bus = new NativeResidentFrameBus(
    cb => { const id = ++nextId; pending.set(id, cb); return id; },
    id => { pending.delete(id); }
  );
  const ids = Array.from({ length: population }, () =>
    bus.subscribeFrame(() => { count++; })
  );
  const startBus = performance.now();
  for (let frame = 0; frame < frames; frame++) {
    assert.equal(pending.size, 1);
    const [id, cb] = pending.entries().next().value!;
    pending.delete(id);
    cb(frame * 16);
  }
  const busMs = performance.now() - startBus;
  assert.equal(count, population * frames);
  assert.equal(bus.snapshot().dispatchCount, frames);
  assert.equal(bus.snapshot().oneShotBufferSwaps, 0);
  ids.forEach(id => bus.cancel(id));
  assert.equal(pending.size, 0);

  return {
    population, frames, callbacks: population * frames,
    oldMapEntriesTraversalMs: +entriesMs.toFixed(3),
    stableMapForEachTraversalMs: +forEachMs.toFixed(3),
    actualNativeFrameBusMs: +busMs.toFixed(3),
    platformFrames: frames,
    note: "Node synthetic traversal/dispatch, NOT physical Android/iOS FPS or measured allocations"
  };
}
for (const [population, frames] of [[200, 1200], [1000, 500]] as const) {
  console.log(JSON.stringify({ kind: "node_native_persistent_dispatch_microbenchmark", ...run(population, frames) }));
}
