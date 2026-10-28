import assert from "node:assert/strict";
import test from "node:test";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";
import { NativeResidentTimerQueue } from "../src/performance/nativeResidentTimerQueue.ts";
import { NativeResidentSegmentRunner } from "../src/performance/nativeResidentSegmentRunner.ts";
import { NativeResidentActivityGate } from "../src/performance/nativeResidentActivityGate.ts";
import { NativeResidentTapRecognizer } from "../src/performance/nativeResidentTapRecognizer.ts";

/** A fake platform with exactly one OS RAF and timeout, including stale delivery. */
function fixture() {
  let wall = 0, next = 0;
  const frames = new Map<number, (at: number) => void>();
  const timers = new Map<number, { at: number; run: () => void }>();
  const staleFrames: Array<(at: number) => void> = [];
  const staleTimers: Array<() => void> = [];
  const bus = new NativeResidentFrameBus(
    cb => { const id = ++next; frames.set(id, cb); return id; },
    id => { const cb = frames.get(id); if (cb) staleFrames.push(cb); frames.delete(id); }
  );
  const queue = new NativeResidentTimerQueue(
    () => wall,
    (cb, delay) => { const id = ++next; timers.set(id, { at: wall + delay, run: cb }); return id; },
    id => { const task = timers.get(id); if (task) staleTimers.push(task.run); timers.delete(id); },
    32
  );
  const gate = new NativeResidentActivityGate(true, false, active => {
    queue.setActive(active);
    bus.setActive(active);
  });
  return {
    bus, queue, gate, frames, timers, staleFrames, staleTimers,
    setWall(value: number) { assert.ok(value >= wall); wall = value; },
    frame(at: number) {
      assert.equal(frames.size, 1, "one shared OS RAF");
      this.setWall(at);
      const [id, cb] = frames.entries().next().value!;
      frames.delete(id);
      cb(at);
      assert.ok(frames.size <= 1);
    },
    timer() {
      assert.equal(timers.size, 1, "one shared OS timeout");
      const [id, task] = timers.entries().next().value!;
      assert.ok(task.at <= wall, "timeout fired before active-time deadline");
      timers.delete(id);
      task.run();
      assert.ok(timers.size <= 1);
    },
    drainStale() {
      for (const cb of staleFrames.splice(0)) cb(wall);
      for (const cb of staleTimers.splice(0)) cb();
    }
  };
}

test("200 real segment runners + timer queue + touch recognizers: pause, collision, route replacement, cleanup", () => {
  const f = fixture();
  let speed = 1;
  const positions = Array.from({ length: 200 }, (_, i) => i);
  const arrivals = Array<number>(200).fill(0);
  const collisionRetries = Array<number>(200).fill(0);
  const tap = Array.from({ length: 200 }, () => new NativeResidentTapRecognizer());
  const unsubscribe = tap.map(recognizer => {
    recognizer.setEligibleForDoubleTap(true);
    return f.bus.subscribeActivity(() => recognizer.reset());
  });
  const runners = Array.from({ length: 200 }, (_, i) =>
    new NativeResidentSegmentRunner({
      requestFrame: cb => f.bus.request(cb),
      subscribeFrame: cb => f.bus.subscribeFrame(cb),
      cancelFrame: id => f.bus.cancel(id),
      readTimeScale: () => speed,
      writePositionXY: (x, y) => { assert.equal(y, 0); positions[i] = x; },
      advanceSprite: () => {},
      setWalking: () => {}
    })
  );
  const start = (i: number, at: number, from: number) => runners[i]!.start({
    from: { x: from, y: 0 }, to: { x: i + 100, y: 0 },
    startTimestamp: at, durationMs: 1000,
    onArrival: () => { arrivals[i]!++; }
  });
  const timerIds = Array.from({ length: 200 }, (_, i) =>
    f.queue.schedule(() => { collisionRetries[i]!++; }, 900)
  );
  for (let i = 0; i < 200; i++) start(i, 0, i);
  assert.equal(f.frames.size, 1);
  assert.equal(f.timers.size, 1);
  assert.ok(tap.every(t => t.press(150) === "single"));

  f.frame(100);
  assert.ok(positions.every((x, i) => Math.abs(x - (i + 10)) < 1e-8));
  speed = 2;
  f.frame(200);
  assert.ok(positions.every((x, i) => Math.abs(x - (i + 30)) < 1e-8));

  f.gate.setGamePaused(true);
  f.gate.setForeground(false);
  assert.equal(f.frames.size, 0);
  assert.equal(f.timers.size, 0);
  // Remove 40 residents while paused; no callbacks can resurrect them.
  for (let i = 0; i < 200; i += 5) {
    runners[i]!.cancel();
    f.queue.cancel(timerIds[i]!);
    unsubscribe[i]!();
  }
  assert.equal(f.bus.snapshot().continuousSubscribers, 160);
  assert.equal(f.queue.snapshot().pending, 160);
  f.setWall(10_000);
  f.gate.setGamePaused(false); // foreground still false
  assert.equal(f.frames.size, 0);
  f.gate.setForeground(true);
  const beforeStale = [...positions];
  f.drainStale();
  assert.deepEqual(positions, beforeStale);
  assert.ok(collisionRetries.every(n => n === 0));

  speed = 4;
  f.frame(10_000); // first resumed RAF only rebases, no teleport
  assert.deepEqual(positions, beforeStale);
  // Replace 30 routes while other residents continue. Old arrivals must die.
  const replaced = Array.from({ length: 30 }, (_, k) => 1 + 5 * k);
  replaced.forEach(i => start(i, 10_000, positions[i]!));
  assert.equal(f.frames.size, 1);
  f.frame(10_175);
  assert.equal(arrivals.reduce((sum, n) => sum + n, 0), 130);
  f.frame(10_250);
  assert.equal(arrivals.reduce((sum, n) => sum + n, 0), 160);
  assert.ok(arrivals.every((n, i) => n === (i % 5 === 0 ? 0 : 1)));
  assert.equal(f.frames.size, 0);
  assert.equal(f.bus.snapshot().continuousSubscribers, 0);

  // 700 ms of active time remained on collision timers at pause.
  f.setWall(10_699);
  assert.equal([...f.timers.values()][0]!.at, 10_700);
  f.setWall(10_700);
  let wakes = 0;
  while (f.timers.size) {
    f.timer();
    if (++wakes > 7) throw new Error("timer burst did not drain");
  }
  assert.equal(wakes, 5, "160 callbacks / 32 per wakeup");
  assert.ok(collisionRetries.every((n, i) => n === (i % 5 === 0 ? 0 : 1)));
  assert.equal(f.queue.snapshot().pending, 0);

  for (let i = 0; i < 200; i++) {
    if (i % 5 !== 0) {
      assert.equal(tap[i]!.press(10_010), "single", "pre-pause tap cannot form a double");
      assert.equal(tap[i]!.press(10_040), "double");
      unsubscribe[i]!();
    }
    runners[i]!.cancel();
  }
  assert.equal(f.bus.snapshot().activityListeners, 0);
  assert.equal(f.bus.snapshot().queued, 0);
  f.gate.setForeground(false);
  f.gate.setForeground(true);
  f.drainStale();
  assert.equal(f.frames.size, 0);
  assert.equal(f.timers.size, 0);
});

test("200 actual segment runners sustain 240 shared frames with 600 route replacements", () => {
  const f = fixture();
  let speed = 1, writes = 0;
  const positions = Array.from({ length: 200 }, (_, i) => i);
  const arrivals = Array<number>(200).fill(0);
  const runners = Array.from({ length: 200 }, (_, i) =>
    new NativeResidentSegmentRunner({
      requestFrame: cb => f.bus.request(cb),
      subscribeFrame: cb => f.bus.subscribeFrame(cb),
      cancelFrame: id => f.bus.cancel(id),
      readTimeScale: () => speed,
      writePositionXY: (x, y) => { assert.ok(Number.isFinite(x) && y === 0); positions[i] = x; writes++; },
      advanceSprite: () => {}, setWalking: () => {}
    })
  );
  const start = (i: number, at: number) => runners[i]!.start({
    from: { x: positions[i]!, y: 0 }, to: { x: i + 100, y: 0 },
    startTimestamp: at, durationMs: 100_000,
    onArrival: () => { arrivals[i]!++; }
  });
  for (let i = 0; i < 200; i++) start(i, 0);
  let replacements = 0;
  for (let frame = 1; frame <= 240; frame++) {
    const at = frame * 16;
    speed = [1, 2, 4][frame % 3]!;
    if (frame % 40 === 0) {
      f.gate.setGamePaused(true);
      assert.equal(f.frames.size, 0);
      f.gate.setGamePaused(false);
    }
    if (frame % 4 === 0) {
      for (let k = 0; k < 10; k++) {
        start((frame * 7 + k) % 200, (frame - 1) * 16);
        replacements++;
      }
    }
    f.frame(at);
    assert.equal(f.bus.snapshot().continuousSubscribers, 200);
    assert.equal(f.frames.size, 1);
  }
  assert.equal(replacements, 600);
  assert.ok(writes > 20_000, "real runners did not advance");
  assert.ok(arrivals.every(n => n === 0), "old route unexpectedly completed");
  assert.equal(f.bus.snapshot().dispatchCount, 240);
  runners.forEach(r => r.cancel());
  assert.equal(f.bus.snapshot().continuousSubscribers, 0);
  assert.equal(f.frames.size, 0);
  f.drainStale();
  assert.equal(f.frames.size, 0);
});
