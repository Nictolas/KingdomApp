import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";
import { NativeResidentSegmentRunner } from "../src/performance/nativeResidentSegmentRunner.ts";

/**
 * Synthetic JS count/CPU benchmark. Does not measure on-device Hermes,
 * GPU/UI frame rate, real Animated.Value bridge costs or touch latency.
 * The optimized path must match logical arrivals and final positions.
 */
function run(population: number, legs: number, speed: 1 | 2 | 4, persistent: boolean) {
  const os = new Map<number, (at: number) => void>();
  let next = 0;
  const bus = new NativeResidentFrameBus(
    cb => { const id = ++next; os.set(id, cb); return id; },
    id => { os.delete(id); }
  );
  let now = 0;
  let writes = 0;
  const completed = Array<number>(population).fill(0);
  const positions = Array<number>(population).fill(0);
  const started = performance.now();
  const runners = Array.from({ length: population }, (_, i) =>
    new NativeResidentSegmentRunner({
      requestFrame: cb => bus.request(cb),
      ...(persistent ? { subscribeFrame: (cb: (at: number, resume: boolean) => void) => bus.subscribeFrame(cb) } : {}),
      cancelFrame: id => bus.cancel(id),
      readTimeScale: () => speed,
      writePositionXY: (x, y) => {
        assert.equal(y, i);
        positions[i] = x;
        writes++;
      },
      advanceSprite: () => {},
      setWalking: () => {}
    })
  );
  const start = (id: number, leg: number): void => runners[id]!.start({
    from: { x: leg * 40, y: id },
    to: { x: (leg + 1) * 40, y: id },
    durationMs: 128,
    startTimestamp: now,
    keepWalkingOnArrival: leg + 1 < legs,
    onArrival: () => {
      completed[id]!++;
      if (leg + 1 < legs) start(id, leg + 1);
    }
  });
  for (let id = 0; id < population; id++) start(id, 0);
  let frames = 0;
  while (os.size && frames < 1000) {
    frames++;
    now += 16;
    const [id, cb] = os.entries().next().value!;
    assert.equal(os.size, 1);
    os.delete(id);
    cb(now);
  }
  assert.ok(frames < 1000, "movement exceeded synthetic frame budget");
  assert.ok(completed.every(value => value === legs));
  assert.ok(positions.every(value => value === legs * 40));
  assert.equal(bus.snapshot().queued, 0);
  const snapshot = bus.snapshot();
  const callbackAllocations = runners.reduce((sum, runner) => sum + runner.snapshot().frameCallbackAllocations, 0);
  const segmentStarts = runners.reduce((sum, runner) => sum + runner.snapshot().segmentStarts, 0);
  assert.equal(segmentStarts, population * legs);
  assert.equal(callbackAllocations, persistent ? 0 : population * legs);
  assert.equal(snapshot.subscriptionAdds, persistent ? population : 0);
  assert.equal(snapshot.oneShotRequests, persistent ? 0 : population * frames);
  return {
    population, legs, speed, scheduling: persistent ? "persistent" : "one-shot",
    segmentStarts, segmentFrameCallbackAllocations: callbackAllocations,
    sharedPlatformFrames: frames, logicalOneShotRequests: snapshot.oneShotRequests,
    persistentSubscriptionAdds: snapshot.subscriptionAdds, positionWrites: writes,
    elapsedNodeMs: Number((performance.now() - started).toFixed(2)),
    note: "Node synthetic timings only, NOT installed Android/iOS FPS or measured heap bytes"
  };
}

for (const [population, legs] of [[200, 20], [1000, 8]] as const) {
  for (const speed of [1, 2, 4] as const) {
    const baseline = run(population, legs, speed, false);
    const optimized = run(population, legs, speed, true);
    assert.equal(baseline.segmentStarts, optimized.segmentStarts);
    assert.equal(baseline.positionWrites, optimized.positionWrites);
    assert.equal(baseline.sharedPlatformFrames, optimized.sharedPlatformFrames);
    console.log(JSON.stringify({ kind: "synthetic_native_segment_dispatch", baseline, optimized }));
  }
}
