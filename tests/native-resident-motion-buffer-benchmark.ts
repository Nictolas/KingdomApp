import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  NativeResidentSegmentProgress,
  type NativeResidentSegmentSampleBuffer
} from "../src/performance/nativeResidentSegmentProgress.ts";

/**
 * Node-only model of the motion hot path. Not React Native, not bridge work,
 * not GPU FPS, and not a direct measurement of GC. Times are informational;
 * semantic equality and analytical allocation counts are the only asserts.
 */
const RESIDENTS = 200;
const FRAMES = 240;
const ROUNDS = 5;
type Sample = Readonly<{ progress: number; completed: boolean; x: number; y: number }>;

function benchmark(reused: boolean) {
  const started = performance.now();
  let samples = 0;
  let elapsedAllocations = 0;
  const finals: Sample[] = [];
  for (let round = 0; round < ROUNDS; round++) {
    const movements = Array.from({ length: RESIDENTS }, () =>
      new NativeResidentSegmentProgress(0, 30_000)
    );
    const scratches: NativeResidentSegmentSampleBuffer[] = Array.from(
      { length: RESIDENTS }, () => ({ elapsedMs: 0, progress: 0, advance: false, complete: false })
    );
    const points = Array.from({ length: RESIDENTS }, () => ({ x: 0, y: 0 }));
    for (let frame = 1; frame <= FRAMES; frame++) {
      const now = frame <= 120 ? frame * 16 : 30_000 + (frame - 120) * 16;
      const scale = frame <= 80 ? 1 : frame <= 160 ? 2 : 4;
      const resumed = frame === 121;
      for (let resident = 0; resident < RESIDENTS; resident++) {
        const progress = movements[resident]!;
        const point = points[resident]!;
        let fraction: number;
        let shouldWrite: boolean;
        if (reused) {
          const scratch = scratches[resident]!;
          progress.sampleInto(now, scale, resumed, scratch);
          fraction = scratch.progress;
          shouldWrite = scratch.advance;
        } else {
          const sample = progress.sample(now, scale, resumed);
          fraction = sample.progress;
          shouldWrite = sample.advance;
          // The original path allocated an immutable sample on *every*
          // frame, and a point object on every advancing frame.
          elapsedAllocations++;
        }
        if (!shouldWrite) continue;
        const x = resident * 10 + 100 * fraction;
        const y = resident * 10;
        if (reused) {
          // One retained point per resident; native Animated.ValueXY reads it
          // synchronously and does not retain the input object reference.
          point.x = x;
          point.y = y;
        } else {
          const newPoint = { x, y };
          elapsedAllocations++;
          points[resident] = newPoint;
        }
        samples++;
      }
    }
    finals.push(...movements.map((_, i) => {
      const p = points[i]!;
      return { progress: (p.x - i * 10) / 100, completed: p.x >= i * 10 + 100, x: p.x, y: p.y };
    }));
  }
  return {
    mode: reused ? "recycled_scratch_and_point" : "immutable_per_raf",
    elapsedMs: Number((performance.now() - started).toFixed(3)),
    residents: RESIDENTS,
    frames: FRAMES,
    rounds: ROUNDS,
    framesTimesResidents: RESIDENTS * FRAMES * ROUNDS,
    logicalPositionWrites: samples,
    transientMotionObjects: elapsedAllocations,
    finals
  };
}

const reference = benchmark(false);
const optimized = benchmark(true);
assert.deepEqual(optimized.finals, reference.finals, "native scratch sampling changed the movement model");
assert.equal(optimized.logicalPositionWrites, reference.logicalPositionWrites);
assert.equal(reference.transientMotionObjects,
  RESIDENTS * FRAMES * ROUNDS + reference.logicalPositionWrites);
assert.equal(optimized.transientMotionObjects, 0);
assert.ok(optimized.finals.every(x => x.progress >= 0 && x.progress <= 1));
console.log(JSON.stringify({
  kind: "node_synthetic_resident_motion_object_allocation_not_device_fps",
  residents: RESIDENTS,
  frames: FRAMES,
  rounds: ROUNDS,
  logicalPositionWrites: optimized.logicalPositionWrites,
  beforeTransientMotionObjects: reference.transientMotionObjects,
  afterTransientMotionObjects: optimized.transientMotionObjects,
  allocationReductionCount: reference.transientMotionObjects,
  referenceElapsedNodeMs: reference.elapsedMs,
  optimizedElapsedNodeMs: optimized.elapsedMs,
  note: "The benchmark counts explicit JS objects; it does not prove improved device FPS, bridge latency, heap use, or GC."
}));
