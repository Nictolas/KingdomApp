import assert from "node:assert/strict";
import test from "node:test";
import { PauseAwareMotionClock } from "../src/game/pauseAwareMotionClock.ts";
import { NativeResidentSegmentProgress } from "../src/performance/nativeResidentSegmentProgress.ts";
import { NativeResidentSegmentRunner } from "../src/performance/nativeResidentSegmentRunner.ts";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";

test("reusable native clock matches canonical game clock over 200 residents and 64 route resets", () => {
  const reusable = Array.from({ length: 200 }, () => new NativeResidentSegmentProgress(0, 1));
  const references = reusable.map(clock => clock);
  let samples = 0;
  for (let route = 0; route < 64; route++) {
    const start = route * 50_000;
    for (let resident = 0; resident < 200; resident++) {
      const duration = 100 + (resident % 17) * 29;
      const clock = reusable[resident]!;
      assert.strictEqual(clock, references[resident], "route reset must not allocate a new clock");
      clock.reset(start, duration);
      const reference = new PauseAwareMotionClock(start);
      let lastProgress = 0;
      const events: Array<[number, number, boolean]> = [
        [start + 16, 1, false], [start + 32, 2, false],
        [start + 48, 4, false], [start + 64, 0, false],
        [start + 80, Number.NaN, false], [start + 96, 4, false],
        [start + 96, 4, false], [start + 95, 2, false],
        [start + 5_000, 4, true], [start + 5_016, 4, false],
        [start + 5_032, 1, false], [Number.NaN, 1, false],
        [start + 7_500, 2, false], [start + 7_516, 4, false]
      ];
      for (const [now, speed, resumed] of events) {
        const elapsedMs = reference.advanceScaled(now, resumed ? 0 : speed);
        const advance = !resumed && Number.isFinite(speed) && speed > 0;
        if (advance) lastProgress = Math.min(1, elapsedMs / duration);
        const expected = { elapsedMs, progress: lastProgress, advance,
          complete: advance && lastProgress >= 1 };
        assert.deepEqual(clock.sample(now, speed, resumed), expected);
        samples++;
      }
    }
  }
  assert.equal(samples, 179_200);
});

test("reset validates before mutation, resets completion, and preserves immutable sample history", () => {
  const progress = new NativeResidentSegmentProgress(0, 100);
  const first = progress.sample(100, 1);
  assert.equal(first.complete, true);
  assert.throws(() => progress.reset(Number.NaN, 200), /Invalid/);
  assert.throws(() => progress.reset(100, 0), /Invalid/);
  assert.equal(progress.sample(101, 1).complete, true);
  progress.reset(101, 200);
  assert.deepEqual(progress.sample(101, 1), {
    elapsedMs: 0, progress: 0, advance: true, complete: false
  });
  assert.deepEqual(first, { elapsedMs: 100, progress: 1, advance: true, complete: true });
  assert.throws(() => new NativeResidentSegmentProgress(Number.NaN, 1), /Invalid/);
});

test("200 real runners retain one clock each over 64 replacements and clean the shared RAF", () => {
  const frames = new Map<number, (now: number) => void>();
  let next = 0;
  const bus = new NativeResidentFrameBus(
    cb => { const id = ++next; frames.set(id, cb); return id; },
    id => { frames.delete(id); }
  );
  const arrivals = Array<number>(200).fill(0);
  const runners = Array.from({ length: 200 }, (_, resident) =>
    new NativeResidentSegmentRunner({
      requestFrame: cb => bus.request(cb),
      subscribeFrame: cb => bus.subscribeFrame(cb),
      cancelFrame: id => bus.cancel(id),
      readTimeScale: () => 1,
      writePositionXY: (x, y) => { assert.ok(Number.isFinite(x)); assert.equal(y, resident); },
      advanceSprite: () => {},
      setWalking: () => {}
    })
  );
  const clocks = runners.map(r => (r as unknown as {
    segmentProgress: NativeResidentSegmentProgress
  }).segmentProgress);
  assert.equal(new Set(clocks).size, 200);
  for (let route = 0; route < 64; route++) {
    for (let resident = 0; resident < 200; resident++) {
      runners[resident]!.start({
        from: { x: route, y: resident },
        to: { x: route + 1, y: resident },
        startTimestamp: route * 100,
        durationMs: 100,
        onArrival: () => { arrivals[resident]!++; }
      });
      assert.strictEqual((runners[resident] as unknown as {
        segmentProgress: NativeResidentSegmentProgress
      }).segmentProgress, clocks[resident]);
    }
    assert.equal(bus.snapshot().continuousSubscribers, 200);
    assert.equal(frames.size, 1);
  }
  const [id, callback] = frames.entries().next().value!;
  frames.delete(id);
  callback(6400);
  assert.ok(arrivals.every(count => count === 1), "only final route can arrive");
  assert.equal(bus.snapshot().continuousSubscribers, 0);
  assert.equal(bus.snapshot().queued, 0);
  assert.equal(frames.size, 0);
  runners.forEach(r => r.cancel());
});

test("200 runners reuse progress across synchronous 4x arrival chains without changing order", () => {
  const frames = new Map<number, (now: number) => void>();
  let next = 0;
  const bus = new NativeResidentFrameBus(
    cb => { const id = ++next; frames.set(id, cb); return id; },
    id => { frames.delete(id); }
  );
  const arrivals = Array<number>(200).fill(0);
  const runners = Array.from({ length: 200 }, (_, resident) =>
    new NativeResidentSegmentRunner({
      requestFrame: cb => bus.request(cb),
      subscribeFrame: cb => bus.subscribeFrame(cb),
      cancelFrame: id => bus.cancel(id),
      readTimeScale: () => 4,
      writePositionXY: () => {},
      advanceSprite: () => {},
      setWalking: () => {}
    })
  );
  const start = (resident: number, segment: number): void => {
    runners[resident]!.start({
      from: { x: segment, y: resident },
      to: { x: segment + 1, y: resident },
      durationMs: 64,
      startTimestamp: segment * 16,
      keepWalkingOnArrival: segment < 15,
      onArrival: () => {
        assert.equal(arrivals[resident], segment, "arrival order must be sequential");
        arrivals[resident]!++;
        if (segment < 15) start(resident, segment + 1);
      }
    });
  };
  for (let resident = 0; resident < 200; resident++) start(resident, 0);
  for (let frame = 1; frame <= 16; frame++) {
    assert.equal(frames.size, 1);
    const [id, callback] = frames.entries().next().value!;
    frames.delete(id);
    callback(frame * 16);
  }
  assert.ok(arrivals.every(count => count === 16));
  assert.equal(bus.snapshot().continuousSubscribers, 0);
  assert.equal(frames.size, 0);
});
