import assert from "node:assert/strict";
import test from "node:test";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";

function fakeScheduler() {
  let nextPlatformId = 1;
  let requested = 0;
  let cancelled = 0;
  const frames = new Map<number, (timestamp: number) => void>();
  const bus = new NativeResidentFrameBus(
    (callback) => {
      const id = nextPlatformId++;
      requested++;
      frames.set(id, callback);
      return id;
    },
    (id) => {
      cancelled++;
      frames.delete(id);
    }
  );
  const tick = (timestamp: number) => {
    assert.equal(frames.size, 1, "exactly one OS RAF must be pending");
    const [[id, callback]] = frames.entries();
    frames.delete(id);
    callback(timestamp);
  };
  return {
    bus, frames, tick,
    get requested() { return requested; },
    get cancelled() { return cancelled; }
  };
}

test("200 simultaneous moving residents share one platform RAF per frame", () => {
  const runner = fakeScheduler();
  const residentCount = 200;
  const totalFrames = 120;
  let callbacks = 0;
  const firstFrameTimestamps: number[] = [];
  for (let resident = 0; resident < residentCount; resident++) {
    let drawn = 0;
    const step = (timestamp: number): void => {
      callbacks++;
      drawn++;
      if (drawn === 1) firstFrameTimestamps.push(timestamp);
      if (drawn < totalFrames) runner.bus.request(step);
    };
    runner.bus.request(step);
  }
  assert.equal(runner.requested, 1);
  for (let frame = 1; frame <= totalFrames; frame++) {
    runner.tick(frame * 16);
    assert.equal(runner.bus.snapshot().dispatchCount, frame);
    assert.equal(runner.requested, Math.min(frame + 1, totalFrames));
  }
  assert.equal(callbacks, residentCount * totalFrames);
  assert.equal(runner.requested, totalFrames, "one OS RAF per frame, not 200");
  assert.ok(firstFrameTimestamps.every((value) => value === 16));
  assert.equal(runner.bus.snapshot().queued, 0);
  assert.equal(runner.frames.size, 0);
});

test("unmounting one resident leaves siblings active, last cancellation stops platform RAF", () => {
  const runner = fakeScheduler();
  const calls: number[] = [];
  const a = runner.bus.request(() => calls.push(1));
  const b = runner.bus.request(() => calls.push(2));
  runner.bus.cancel(a);
  assert.equal(runner.frames.size, 1);
  runner.tick(16);
  assert.deepEqual(calls, [2]);
  assert.equal(runner.bus.snapshot().queued, 0);
  const c = runner.bus.request(() => calls.push(3));
  runner.bus.cancel(c);
  assert.equal(runner.frames.size, 0);
  assert.equal(runner.cancelled, 1);
  runner.bus.cancel(b); // harmless after dispatch
});

test("a callback may cancel a sibling already in the current frame batch", () => {
  const runner = fakeScheduler();
  const calls: string[] = [];
  let second = 0;
  runner.bus.request(() => {
    calls.push("first");
    runner.bus.cancel(second);
  });
  second = runner.bus.request(() => calls.push("second"));
  runner.tick(16);
  assert.deepEqual(calls, ["first"]);
  assert.equal(runner.bus.snapshot().queued, 0);
});

test("new callbacks registered by a moving resident start next frame, never this one", () => {
  const runner = fakeScheduler();
  const frames: number[] = [];
  runner.bus.request(() => {
    frames.push(1);
    runner.bus.request(() => frames.push(2));
  });
  runner.tick(16);
  assert.deepEqual(frames, [1]);
  assert.equal(runner.requested, 2);
  runner.tick(32);
  assert.deepEqual(frames, [1, 2]);
});

test("a broken resident does not prevent healthy residents from updating", () => {
  const runner = fakeScheduler();
  let healthy = 0;
  runner.bus.request(() => { throw new Error("broken sprite"); });
  runner.bus.request(() => { healthy += 1; });
  assert.throws(() => runner.tick(16), /broken sprite/);
  assert.equal(healthy, 1);
  assert.equal(runner.bus.snapshot().queued, 0);
});

test("RAF bus remains idle with no moving residents", () => {
  const runner = fakeScheduler();
  assert.equal(runner.frames.size, 0);
  assert.equal(runner.requested, 0);
  const first = runner.bus.request(() => {});
  runner.bus.cancel(first);
  assert.equal(runner.frames.size, 0);
  assert.equal(runner.bus.snapshot().queued, 0);
});
