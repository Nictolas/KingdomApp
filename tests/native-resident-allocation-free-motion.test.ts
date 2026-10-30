import assert from "node:assert/strict";
import test from "node:test";
import { NativeResidentActivityGate } from "../src/performance/nativeResidentActivityGate.ts";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";
import {
  NativeResidentSegmentProgress,
  type NativeResidentSegmentSampleBuffer
} from "../src/performance/nativeResidentSegmentProgress.ts";
import { NativeResidentSegmentRunner, type NativeResidentPoint } from "../src/performance/nativeResidentSegmentRunner.ts";

/** Deterministic fake OS: no hardware/GPU/React bridge is exercised. */
function frameEnvironment() {
  const callbacks = new Map<number, (timestamp: number) => void>();
  let platformId = 0;
  let platformRequests = 0;
  const bus = new NativeResidentFrameBus(
    cb => {
      platformRequests++;
      const id = ++platformId;
      callbacks.set(id, cb);
      return id;
    },
    id => { callbacks.delete(id); }
  );
  return {
    bus, callbacks,
    get platformRequests() { return platformRequests; },
    frame(timestamp: number) {
      assert.equal(callbacks.size, 1, "all residents share one native RAF");
      const [id, cb] = callbacks.entries().next().value!;
      callbacks.delete(id);
      cb(timestamp);
      assert.ok(callbacks.size <= 1);
    }
  };
}

test("mutable sample buffer matches immutable snapshot API at 1x/2x/4x and across pause/background", () => {
  const snapshotModel = new NativeResidentSegmentProgress(0, 20_000);
  const bufferModel = new NativeResidentSegmentProgress(0, 20_000);
  const output: NativeResidentSegmentSampleBuffer = {
    elapsedMs: -1, progress: -1, advance: false, complete: false
  };
  const originalBuffer = output;
  const historical = [];
  const sequence: Array<[number, number, boolean]> = [
    [100, 1, false],
    [200, 2, false],
    [300, 4, false],
    [400, 0, false],
    [40_000, 4, true],
    [40_016, 4, false],
    [40_032, 1, false],
    [40_048, 2, false],
    [40_048, 2, false],
    [39_999, 2, false],
    [60_000, Number.NaN, true],
    [60_016, 1, false]
  ];
  for (const [now, scale, resumed] of sequence) {
    const immutable = snapshotModel.sample(now, scale, resumed);
    historical.push({ immutable, copied: { ...immutable } });
    bufferModel.sampleInto(now, scale, resumed, output);
    assert.strictEqual(output, originalBuffer);
    assert.deepEqual(output, immutable);
  }
  for (const entry of historical) assert.deepEqual(entry.immutable, entry.copied,
    "previously returned sample() snapshots must not be mutated by later samples");
});

test("200 persistent native residents update 48,000 frames with one scratch sample and XY writer each", () => {
  const f = frameEnvironment();
  const gate = new NativeResidentActivityGate(true, false, active => f.bus.setActive(active));
  let scale = 1;
  let writes = 0;
  let calls = 0;
  let arrivals = 0;
  const positions = Array.from({ length: 200 }, () => ({ x: 0, y: 0 }));
  const runners: NativeResidentSegmentRunner[] = [];
  const buffers: object[] = [];
  for (let i = 0; i < 200; i++) {
    const value = positions[i]!;
    const runner = new NativeResidentSegmentRunner({
      requestFrame: cb => f.bus.request(cb),
      subscribeFrame: cb => f.bus.subscribeFrame(cb),
      cancelFrame: id => f.bus.cancel(id),
      readTimeScale: () => scale,
      writePositionXY: (x, y) => {
        // This is the same retained-object pattern used for Animated.ValueXY.
        value.x = x;
        value.y = y;
        writes++;
      },
      advanceSprite: () => {},
      setWalking: () => {},
      onFrame: () => { calls++; }
    });
    const scratch = (runner as unknown as { frameSample: object }).frameSample;
    buffers.push(scratch);
    runners.push(runner);
    runner.start({
      from: { x: 0, y: i * 10 },
      to: { x: 100, y: i * 10 },
      startTimestamp: 0,
      durationMs: 30_000,
      onArrival: () => { arrivals++; }
    });
  }
  assert.equal(new Set(buffers).size, 200, "scratch samples are per-resident, not shared globally");
  assert.equal(f.callbacks.size, 1);
  let now = 0;
  for (let frame = 1; frame <= 240; frame++) {
    if (frame === 61) {
      const oldPositions = positions.map(p => p.x);
      const oldWrites = writes;
      gate.setForeground(false);
      assert.equal(f.callbacks.size, 0);
      gate.setGamePaused(true);
      gate.setForeground(true);
      assert.equal(f.callbacks.size, 0, "manual pause must still gate resume");
      now += 40_000;
      gate.setGamePaused(false);
      f.frame(now); // the very first resumed frame only rebases
      assert.equal(writes, oldWrites);
      assert.deepEqual(positions.map(p => p.x), oldPositions);
      continue;
    }
    scale = frame <= 80 ? 1 : frame <= 160 ? 2 : 4;
    now += 16;
    f.frame(now);
    assert.equal(f.callbacks.size, 1);
    assert.equal(f.bus.snapshot().continuousSubscribers, 200);
    assert.equal(f.bus.snapshot().oneShotRequests, 0);
    assert.ok(buffers.every((buffer, i) =>
      (runners[i] as unknown as { frameSample: object }).frameSample === buffer
    ), "RAF scratch object allocated/replaced while frames progressed");
    assert.ok(positions.every((value, i) => value.y === i * 10));
  }
  assert.equal(calls, 200 * 240);
  assert.equal(writes, 200 * 239, "resume rebase never writes another point");
  assert.equal(arrivals, 0);
  assert.equal(f.bus.snapshot().subscriptionAdds, 200);
  assert.equal(f.bus.snapshot().oneShotBufferSwaps, 0);
  assert.equal(f.platformRequests, 242, "240 frames, one initial RAF and one replacement after background");
  runners.forEach(r => r.cancel());
  assert.equal(f.callbacks.size, 0);
  assert.equal(f.bus.snapshot().continuousSubscribers, 0);
});

test("legacy point writer preserves immutable point history for existing consumers", () => {
  const f = frameEnvironment();
  const positions: NativeResidentPoint[] = [];
  const runner = new NativeResidentSegmentRunner({
    requestFrame: cb => f.bus.request(cb),
    cancelFrame: id => f.bus.cancel(id),
    readTimeScale: () => 1,
    writePosition: point => positions.push(point),
    advanceSprite: () => {},
    setWalking: () => {}
  });
  runner.start({
    from: { x: 0, y: 5 }, to: { x: 100, y: 5 },
    startTimestamp: 0, durationMs: 1000, onArrival: () => {}
  });
  for (const timestamp of [100, 200, 300]) f.frame(timestamp);
  assert.deepEqual(positions, [
    { x: 10, y: 5 },
    { x: 20, y: 5 },
    { x: 30, y: 5 }
  ]);
  assert.notStrictEqual(positions[0], positions[1]);
  assert.notStrictEqual(positions[1], positions[2]);
  runner.cancel();
  assert.equal(f.callbacks.size, 0);
});

test("native XY writer can synchronously replace a route without resurrecting obsolete arrival", () => {
  const f = frameEnvironment();
  const seen: number[] = [];
  const arrivals: string[] = [];
  let runner!: NativeResidentSegmentRunner;
  runner = new NativeResidentSegmentRunner({
    requestFrame: cb => f.bus.request(cb),
    subscribeFrame: cb => f.bus.subscribeFrame(cb),
    cancelFrame: id => f.bus.cancel(id),
    readTimeScale: () => 1,
    writePositionXY: x => {
      seen.push(x);
      if (x === 50) {
        runner.start({
          from: { x: 200, y: 0 }, to: { x: 300, y: 0 },
          startTimestamp: 50, durationMs: 100,
          onArrival: () => arrivals.push("new")
        });
      }
    },
    advanceSprite: () => {},
    setWalking: () => {}
  });
  runner.start({
    from: { x: 0, y: 0 }, to: { x: 100, y: 0 },
    startTimestamp: 0, durationMs: 100,
    onArrival: () => arrivals.push("obsolete")
  });
  f.frame(50);
  assert.deepEqual(seen, [50]);
  assert.equal(f.bus.snapshot().continuousSubscribers, 1);
  f.frame(150);
  assert.deepEqual(seen, [50, 300]);
  assert.deepEqual(arrivals, ["new"]);
  assert.equal(f.callbacks.size, 0);
  assert.equal(f.bus.snapshot().continuousSubscribers, 0);
});

test("XY writer: 5000 route replacements remain bounded and stale frames are ignored", () => {
  const f = frameEnvironment();
  const writes: number[] = [];
  let arrivals = 0;
  const runner = new NativeResidentSegmentRunner({
    requestFrame: cb => f.bus.request(cb),
    subscribeFrame: cb => f.bus.subscribeFrame(cb),
    cancelFrame: id => f.bus.cancel(id),
    readTimeScale: () => 1,
    writePositionXY: x => { writes.push(x); },
    advanceSprite: () => {},
    setWalking: () => {}
  });
  for (let i = 0; i < 5000; i++) {
    runner.start({
      from: { x: i, y: 0 }, to: { x: i + 100, y: 0 },
      durationMs: 100, startTimestamp: 0, onArrival: () => { arrivals++; }
    });
    assert.equal(f.bus.snapshot().continuousSubscribers, 1);
    assert.equal(f.callbacks.size, 1);
  }
  f.frame(100);
  assert.deepEqual(writes, [5099]);
  assert.equal(arrivals, 1);
  assert.equal(runner.snapshot().completed, 1);
  assert.equal(f.bus.snapshot().continuousSubscribers, 0);
});
