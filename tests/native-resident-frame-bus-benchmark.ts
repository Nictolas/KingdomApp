import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";

/**
 * Synthetic JS scheduling benchmark, NOT native UI-thread FPS or device CPU.
 * Compare exactly the same logical work with the legacy one-shot registration
 * path and the new persistent subscription path. No wall-clock thresholds.
 */
function measure(population: number, frames: number, persistent: boolean) {
  let nextPlatformId = 1;
  let platformRequests = 0;
  const os = new Map<number, (timestamp: number) => void>();
  const bus = new NativeResidentFrameBus(
    fn => {
      const id = nextPlatformId++;
      platformRequests++;
      os.set(id, fn);
      return id;
    },
    id => { os.delete(id); }
  );
  let registrations = 0;
  let callbacks = 0;
  const handles: number[] = [];
  const started = performance.now();
  for (let resident = 0; resident < population; resident++) {
    const step = () => { callbacks++; };
    if (persistent) {
      registrations++;
      handles.push(bus.subscribeFrame(step));
    } else {
      let seen = 0;
      const once = () => {
        step();
        seen++;
        if (seen < frames) {
          registrations++;
          handles[resident] = bus.request(once);
        }
      };
      registrations++;
      handles.push(bus.request(once));
    }
  }
  const setupMs = performance.now() - started;
  const startDispatch = performance.now();
  for (let frame = 1; frame <= frames; frame++) {
    assert.equal(os.size, 1, "only one OS RAF per simulated frame");
    const [id, callback] = os.entries().next().value!;
    os.delete(id);
    callback(frame * 16);
  }
  const dispatchMs = performance.now() - startDispatch;
  assert.equal(callbacks, population * frames);
  if (persistent) handles.forEach(id => bus.cancel(id));
  assert.equal(os.size, 0);
  assert.equal(bus.snapshot().queued, 0);
  assert.equal(platformRequests, frames);
  assert.equal(bus.snapshot().dispatchCount, frames);
  assert.equal(registrations, persistent ? population : population * frames);
  return {
    population, frames, mode: persistent ? "persistent" : "one_shot",
    callbacks, registrations, platformRequests,
    setupMs: +setupMs.toFixed(3),
    dispatchMs: +dispatchMs.toFixed(3),
    totalMs: +(setupMs + dispatchMs).toFixed(3)
  };
}

for (const [population, frames] of [[200, 240], [1000, 120]]) {
  const before = measure(population, frames, false);
  const after = measure(population, frames, true);
  console.log(JSON.stringify({
    kind: "node_synthetic_raf_registration_not_device_fps",
    before, after,
    registrationsAvoided: before.registrations - after.registrations
  }));
}
