/**
 * Synthetic Node-only lifecycle registration comparison; NOT mobile FPS.
 * The test measures scheduler/lifecycle bookkeeping for many sprites,
 * without any GPU, touch, frame rendering or device clocks.
 */
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { NativeResidentLifecycleBootstrap } from "../src/performance/nativeResidentLifecycleBootstrap.ts";

function workload(residents: number, transitions: number) {
  let foreground = true;
  let paused = false;
  let publications = 0;
  let foregroundSubscriptions = 0;
  let pauseSubscriptions = 0;
  const foregroundListeners = new Set<(next: boolean) => void>();
  const pauseListeners = new Set<() => void>();
  const started = performance.now();
  const lifecycle = new NativeResidentLifecycleBootstrap({
    readForeground: () => foreground,
    readGamePaused: () => paused,
    applyActive: () => { publications++; },
    subscribeForeground: listener => {
      foregroundSubscriptions++;
      foregroundListeners.add(listener);
      return () => { foregroundListeners.delete(listener); };
    },
    subscribeGamePaused: listener => {
      pauseSubscriptions++;
      pauseListeners.add(listener);
      return () => { pauseListeners.delete(listener); };
    }
  });
  // Many resident mounts share the same listener installation; unlike
  // per-sprite listeners, these two counts must be independent of density.
  for (let resident = 0; resident < residents; resident++) lifecycle.ensure();
  for (let cycle = 0; cycle < transitions; cycle++) {
    foreground = false;
    foregroundListeners.forEach(listener => listener(foreground));
    paused = true;
    pauseListeners.forEach(listener => listener());
    foreground = true;
    foregroundListeners.forEach(listener => listener(foreground));
    paused = false;
    pauseListeners.forEach(listener => listener());
    for (let resident = 0; resident < residents; resident++) lifecycle.ensure();
  }
  assert.equal(publications, 1 + transitions * 2);
  assert.equal(foregroundSubscriptions, 1);
  assert.equal(pauseSubscriptions, 1);
  assert.equal(foregroundListeners.size, 1);
  assert.equal(pauseListeners.size, 1);
  lifecycle.dispose();
  assert.equal(foregroundListeners.size, 0);
  assert.equal(pauseListeners.size, 0);
  return {
    residents, transitions, ensureCalls: residents * (transitions + 1),
    nativeForegroundListeners: foregroundSubscriptions,
    gamePauseListeners: pauseSubscriptions,
    lifecyclePublications: publications,
    elapsedNodeMs: Number((performance.now() - started).toFixed(2)),
    note: "Node-only scheduler bookkeeping; not Android/iOS FPS or battery"
  };
}
for (const population of [200, 1000]) {
  console.log(JSON.stringify(workload(population, 240)));
}
