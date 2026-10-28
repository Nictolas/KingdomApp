import assert from "node:assert/strict";
import test from "node:test";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";
import { NativeResidentActivityGate } from "../src/performance/nativeResidentActivityGate.ts";
import { NativeResidentSegmentProgress } from "../src/performance/nativeResidentSegmentProgress.ts";
import { PendingCommuteRetry } from "../src/game/pendingCommuteRetry.ts";
import { NativeResidentTimerQueue, NATIVE_RESIDENT_TIMER_CALLBACK_BUDGET } from "../src/performance/nativeResidentTimerQueue.ts";

function fakeRaf() {
  let nextId = 1;
  let requests = 0;
  let cancels = 0;
  const scheduled = new Map<number, (now: number) => void>();
  const bus = new NativeResidentFrameBus(
    (callback) => {
      requests++;
      const id = nextId++;
      scheduled.set(id, callback);
      return id;
    },
    (id) => {
      cancels++;
      scheduled.delete(id);
    }
  );
  function tick(now: number): void {
    assert.equal(scheduled.size, 1, "exactly one native RAF per active frame");
    const [id, callback] = scheduled.entries().next().value!;
    scheduled.delete(id);
    callback(now);
  }
  return {
    bus, scheduled, tick,
    get requests() { return requests; },
    get cancels() { return cancels; }
  };
}

test("200 native segments preserve 1x/2x/4x progress through pause and background", () => {
  const runner = fakeRaf();
  const gate = new NativeResidentActivityGate(true, false, (active) => runner.bus.setActive(active));
  let speed = 1;
  let callbacks = 0;
  const completed = new Set<number>();
  const progress = Array<number>(200).fill(0);
  for (let i = 0; i < 200; i++) {
    const segment = new NativeResidentSegmentProgress(0, 1000);
    const step = (now: number, resumed: boolean): void => {
      callbacks++;
      const sample = segment.sample(now, speed, resumed);
      if (sample.advance) progress[i] = sample.progress;
      if (sample.complete) {
        assert.equal(completed.has(i), false, "arrival must fire once per segment");
        completed.add(i);
      } else {
        runner.bus.request(step);
      }
    };
    runner.bus.request(step);
  }
  assert.equal(runner.requests, 1);
  runner.tick(100);
  assert.ok(progress.every((p) => Math.abs(p - 0.1) < 1e-8));
  speed = 2;
  runner.tick(200);
  assert.ok(progress.every((p) => Math.abs(p - 0.3) < 1e-8));
  speed = 4;
  runner.tick(300);
  assert.ok(progress.every((p) => Math.abs(p - 0.7) < 1e-8));
  assert.equal(callbacks, 600);

  gate.setGamePaused(true);
  assert.equal(runner.scheduled.size, 0);
  assert.equal(runner.bus.snapshot().queued, 200);
  assert.equal(runner.cancels, 1);
  gate.setForeground(false);
  gate.setGamePaused(false); // Unpausing while backgrounded must not resume.
  assert.equal(runner.scheduled.size, 0);
  assert.equal(callbacks, 600);
  gate.setForeground(true);
  assert.equal(runner.scheduled.size, 1);
  runner.tick(300_000);
  assert.ok(progress.every((p) => Math.abs(p - 0.7) < 1e-8), "first resumed frame must not teleport");
  runner.tick(300_075);
  assert.ok(progress.every((p) => Math.abs(p - 1) < 1e-8));
  assert.equal(completed.size, 200);
  assert.equal(callbacks, 1000);
  assert.equal(runner.scheduled.size, 0);
  assert.equal(runner.bus.snapshot().queued, 0);
  assert.equal(runner.bus.snapshot().dispatchCount, 5);
  assert.equal(runner.requests, 6, "one shared RAF per active frame, plus one canceled at pause");
});

test("a short app suspension also rebases the next segment frame", () => {
  const segment = new NativeResidentSegmentProgress(0, 1000);
  assert.equal(segment.sample(100, 1).progress, 0.1);
  const resumed = segment.sample(500, 4, true);
  assert.equal(resumed.advance, false);
  assert.equal(resumed.progress, 0.1);
  assert.equal(segment.sample(516, 4).progress, 0.164);
});

test("invalid segment durations are rejected and invalid rates do not move", () => {
  assert.throws(() => new NativeResidentSegmentProgress(0, 0), /duration/);
  assert.throws(() => new NativeResidentSegmentProgress(0, Number.NaN), /duration/);
  const segment = new NativeResidentSegmentProgress(100, 1000);
  assert.equal(segment.sample(150, 0).progress, 0);
  assert.equal(segment.sample(200, Number.NaN).advance, false);
  assert.equal(segment.sample(250, -2).progress, 0);
  assert.equal(segment.sample(300, 1).progress, 0.05);
  assert.equal(segment.sample(290, 1).progress, 0.05);
});

test("200 suspended collision retries are resumed once, not while backgrounded", () => {
  const runner = fakeRaf();
  const gate = new NativeResidentActivityGate(true, false, (active) => runner.bus.setActive(active));
  const retries = Array.from({ length: 200 }, () => new PendingCommuteRetry());
  const resumed = Array<number>(200).fill(0);
  const unsubscribes = retries.map((retry, i) => runner.bus.subscribeActivity((active) => {
    if (active) retry.take()?.();
  }));
  retries.forEach((retry, i) => retry.hold(() => { resumed[i]++; }));
  gate.setForeground(false);
  gate.setGamePaused(true);
  gate.setForeground(true);
  assert.equal(resumed.filter((n) => n !== 0).length, 0, "manual pause still blocks retries");
  gate.setGamePaused(false);
  assert.ok(resumed.every((n) => n >= 1));
  gate.setGamePaused(true);
  gate.setGamePaused(false);
  assert.ok(resumed.every((n) => n >= 1 && n <= 1), "continuations must not replay");
  unsubscribes.forEach((unsubscribe) => unsubscribe());
  retries.forEach((retry) => retry.hold(() => { throw new Error("unmounted retry ran"); }));
  gate.setGamePaused(true);
  gate.setGamePaused(false);
});

test("activity listener errors do not starve sibling listeners or frame scheduling", () => {
  const runner = fakeRaf();
  const events: boolean[] = [];
  runner.bus.request(() => events.push(true));
  runner.bus.subscribeActivity(() => { throw new Error("listener failed"); });
  runner.bus.subscribeActivity((active) => events.push(active));
  assert.throws(() => runner.bus.setActive(false), /listener failed/);
  assert.deepEqual(events, [false]);
  assert.equal(runner.scheduled.size, 0);
  assert.throws(() => runner.bus.setActive(true), /listener failed/);
  assert.deepEqual(events, [false, true]);
  assert.equal(runner.scheduled.size, 1);
  runner.tick(16);
  assert.deepEqual(events, [false, true, true]);
});

test("200 native idle residents: pause/background preserves remaining delays and unmount cleanup", () => {
  let wall = 0;
  let nextPlatformId = 1;
  const os = new Map<number, { at: number; callback: () => void }>();
  const timers = new NativeResidentTimerQueue(
    () => wall,
    (callback, delay) => {
      const id = nextPlatformId++;
      os.set(id, { at: wall + delay, callback });
      return id;
    },
    id => { os.delete(id); },
    NATIVE_RESIDENT_TIMER_CALLBACK_BUDGET
  );
  const runner = fakeRaf();
  const gate = new NativeResidentActivityGate(true, false, active => {
    timers.setActive(active);
    runner.bus.setActive(active);
  });
  const pending = Array<number | null>(200).fill(null);
  const alive = Array(200).fill(true);
  const fired = Array(200).fill(0);
  const routes = Array.from({ length: 200 }, (_, i) => i);
  const seenRoute = Array(200).fill(-1);
  const schedule = (i: number) => {
    if (pending[i] != null) return;
    pending[i] = timers.schedule(() => {
      pending[i] = null;
      assert.equal(alive[i], true, "unmounted resident fired a timer");
      fired[i]++;
      seenRoute[i] = routes[i]!;
    }, 1000);
  };
  const unsubscribe = Array.from({ length: 200 }, (_, i) =>
    runner.bus.subscribeActivity(active => {
      if (active && alive[i]) schedule(i);
    })
  );
  for (let i = 0; i < 200; i++) schedule(i);
  assert.equal(os.size, 1);
  assert.equal(runner.bus.snapshot().activityListeners, 200);

  wall = 400;
  gate.setGamePaused(true);
  assert.equal(os.size, 0);
  assert.equal(timers.snapshot().pending, 200);

  // A parent may update routes without changing the stable activity handler.
  for (let i = 0; i < 1000; i++) routes[i % 200] = 1000 + i;
  assert.equal(runner.bus.snapshot().activityListeners, 200);

  // Unmount 50 while paused: neither listener nor timer may survive.
  for (let i = 0; i < 200; i += 4) {
    alive[i] = false;
    unsubscribe[i]!();
    timers.cancel(pending[i]!);
    pending[i] = null;
  }
  assert.equal(timers.snapshot().pending, 150);
  assert.equal(runner.bus.snapshot().activityListeners, 150);

  wall = 80_000;
  gate.setForeground(false);
  gate.setGamePaused(false);
  assert.equal(os.size, 0, "unpause in background must not schedule platform timers");
  gate.setForeground(true);
  assert.equal(os.size, 1);
  assert.equal(timers.snapshot().pending, 150, "no duplicate timer on resume");
  assert.equal([...os.values()][0]!.at, wall + 600, "paused time must not catch up");

  function advance(target: number): void {
    while (os.size) {
      const [id, next] = [...os.entries()]
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0]!;
      if (next.at > target) break;
      os.delete(id);
      wall = next.at;
      next.callback();
    }
    wall = target;
  }
  advance(80_599);
  assert.equal(fired.reduce((a, b) => a + b, 0), 0);
  advance(80_600);
  assert.equal(fired.reduce((a, b) => a + b, 0), 150);
  assert.equal(new Set(seenRoute.filter((_, i) => alive[i])).size, 150);
  assert.ok(seenRoute.every((v, i) => alive[i] ? v === routes[i] : v === -1));
  assert.ok(fired.every((count, i) => count === (alive[i] ? 1 : 0)));
  assert.ok(timers.snapshot().budgetYields >= 4, "cooperative 32-callback budget must yield");
  assert.equal(timers.snapshot().pending, 0);
  assert.equal(os.size, 0);

  for (let i = 0; i < 200; i++) {
    if (alive[i]) unsubscribe[i]!();
  }
  assert.equal(runner.bus.snapshot().activityListeners, 0);
  gate.setGamePaused(true);
  gate.setGamePaused(false);
  assert.equal(os.size, 0);
  assert.equal(fired.reduce((a, b) => a + b, 0), 150);
});
