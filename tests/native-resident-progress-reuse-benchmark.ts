import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { NativeResidentSegmentProgress } from "../src/performance/nativeResidentSegmentProgress.ts";

/** Synthetic allocation-work comparison; never interpret as Android/iOS FPS. */
const residents = 200, routes = 600;
const run = (reuse: boolean) => {
  const clocks = Array.from({ length: residents }, () => new NativeResidentSegmentProgress(0, 100));
  let constructors = residents, checksum = 0;
  const started = performance.now();
  for (let route = 0; route < routes; route++) {
    for (let i = 0; i < residents; i++) {
      const start = route * 100;
      let clock: NativeResidentSegmentProgress;
      if (reuse) {
        clock = clocks[i]!;
        clock.reset(start, 100);
      } else {
        clock = new NativeResidentSegmentProgress(start, 100);
        constructors++;
      }
      const sample = clock.sample(start + 25, 4);
      checksum += sample.elapsedMs + sample.progress;
    }
  }
  return { constructors, checksum, elapsedMs: Math.round((performance.now() - started) * 100) / 100 };
};
const reference = run(false);
const candidate = run(true);
assert.equal(reference.checksum, candidate.checksum);
assert.equal(reference.constructors, residents * (routes + 1));
assert.equal(candidate.constructors, residents);
console.log(JSON.stringify({
  label: "synthetic Node allocation model, NOT native FPS or memory/GC measurement",
  residents, routes, segments: residents * routes,
  reference, candidate, avoidedClockConstructors: reference.constructors - candidate.constructors
}));
