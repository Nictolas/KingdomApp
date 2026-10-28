import assert from "node:assert/strict";
import test from "node:test";
import { NativeResidentActivityGate } from "../src/performance/nativeResidentActivityGate.ts";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";
import { NativeResidentSegmentProgress } from "../src/performance/nativeResidentSegmentProgress.ts";
import {
  NativeResidentTimerQueue,
  NATIVE_RESIDENT_TIMER_CALLBACK_BUDGET,
  NATIVE_RESIDENT_TIMER_TIME_BUDGET_MS
} from "../src/performance/nativeResidentTimerQueue.ts";

/**
 * Model-based scheduler soak. Seeded interleavings combine real public APIs,
 * not mocks of the queue/bus: 200 native residents, active-time collision/idle
 * deadlines, persistent animation, route changes, unmount/respawn, app pause,
 * game pause, obsolete platform callbacks and 1x/2x/4x motion.
 *
 * Fake OS callbacks and clocks only. No Android/iOS FPS assertions.
 */
function makeEnvironment(seed: number) {
  let randomState = seed >>> 0;
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  };
  let wall = 0;
  let osId = 0;
  let frameCount = 0;
  let timerCount = 0;
  let transitions = 0;
  let staleCallbacks = 0;
  const frames = new Map<number, (at: number) => void>();
  const alarms = new Map<number, { due: number; callback: () => void }>();
  const obsoleteFrames: Array<(at: number) => void> = [];
  const obsoleteAlarms: Array<() => void> = [];
  const bus = new NativeResidentFrameBus(
    cb => { const id = ++osId; frames.set(id, cb); return id; },
    id => { const cb = frames.get(id); if (cb) obsoleteFrames.push(cb); frames.delete(id); }
  );
  const queue = new NativeResidentTimerQueue(
    () => wall,
    (callback, delay) => {
      const id = ++osId;
      alarms.set(id, { due: wall + delay, callback });
      return id;
    },
    id => { const alarm = alarms.get(id); if (alarm) obsoleteAlarms.push(alarm.callback); alarms.delete(id); },
    NATIVE_RESIDENT_TIMER_CALLBACK_BUDGET,
    NATIVE_RESIDENT_TIMER_TIME_BUDGET_MS
  );
  const gate = new NativeResidentActivityGate(true, false, active => {
    queue.setActive(active);
    bus.setActive(active);
    transitions++;
  });
  let speed = 1;
  type Resident = {
    alive: boolean;
    frameId: number | null;
    timerId: number | null;
    progress: NativeResidentSegmentProgress;
    previousProgress: number;
    frameCalls: number;
    timerCalls: number;
  };
  const residents: Resident[] = [];
  const create = (i: number) => {
    const r: Resident = {
      alive: true, frameId: null, timerId: null,
      progress: new NativeResidentSegmentProgress(wall, 20_000),
      previousProgress: 0, frameCalls: 0, timerCalls: 0
    };
    residents[i] = r;
    r.frameId = bus.subscribeFrame((timestamp, resumed) => {
      assert.equal(r.alive, true, "unmounted resident received RAF");
      assert.equal(gate.active, true, "resident RAF ran in background/pause");
      const sample = r.progress.sample(timestamp, speed, resumed);
      assert.ok(sample.progress >= r.previousProgress - 1e-8, "resident moved backwards");
      assert.ok(sample.progress <= 1, "resident exceeded its segment");
      if (resumed) assert.equal(sample.advance, false, "resident teleported on resume");
      r.previousProgress = sample.progress;
      r.frameCalls++;
      frameCount++;
    });
    const schedule = () => {
      const delay = random() < 0.5 ? 900 : 2200;
      r.timerId = queue.schedule(() => {
        assert.equal(r.alive, true, "unmounted resident received timer");
        assert.equal(gate.active, true, "resident timer fired while suspended");
        r.timerId = null;
        r.timerCalls++;
        timerCount++;
        schedule();
      }, delay);
    };
    schedule();
  };
  const remove = (i: number) => {
    const r = residents[i]!;
    if (!r.alive) return;
    r.alive = false;
    if (r.frameId !== null) bus.cancel(r.frameId);
    if (r.timerId !== null) queue.cancel(r.timerId);
    r.frameId = null;
    r.timerId = null;
  };
  for (let i = 0; i < 200; i++) create(i);

  function check() {
    const living = residents.filter(r => r.alive).length;
    assert.equal(bus.snapshot().continuousSubscribers, living, "persistent RAF leak");
    assert.equal(queue.snapshot().pending, living, "logical timer leak");
    assert.ok(frames.size <= 1, "more than one native RAF outstanding");
    assert.ok(alarms.size <= 1, "more than one platform timer outstanding");
    assert.equal(bus.snapshot().active, gate.active);
    assert.equal(queue.snapshot().active, gate.active);
    if (!gate.active) {
      assert.equal(frames.size, 0, "RAF remained armed while paused");
      assert.equal(alarms.size, 0, "timer remained armed while backgrounded");
    } else {
      assert.equal(frames.size, living ? 1 : 0);
      assert.equal(alarms.size, living ? 1 : 0);
    }
  }

  function advance(delta: number) {
    const target = wall + delta;
    let wakes = 0;
    while (gate.active && alarms.size) {
      const [id, alarm] = [...alarms].sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0]!;
      if (alarm.due > target) break;
      wall = Math.max(wall, alarm.due);
      alarms.delete(id);
      alarm.callback();
      if (++wakes > 10000) throw new Error("unbounded native timer backlog");
    }
    wall = target;
    if (gate.active && frames.size) {
      const [id, cb] = frames.entries().next().value!;
      frames.delete(id);
      cb(wall);
    }
    check();
  }
  function injectStale() {
    const priorFrames = frameCount;
    const priorTimers = timerCount;
    // Deliver a canceled native callback after the platform reports success.
    for (const callback of obsoleteFrames.splice(0)) {
      callback(wall);
      staleCallbacks++;
    }
    for (const callback of obsoleteAlarms.splice(0)) {
      callback();
      staleCallbacks++;
    }
    assert.equal(frameCount, priorFrames, "stale RAF performed resident work");
    assert.equal(timerCount, priorTimers, "stale OS timeout performed resident work");
    check();
  }

  return {
    random, gate, bus, queue, residents, create, remove, advance, check, injectStale,
    setSpeed(value: number) { speed = value; },
    get frameCount() { return frameCount; },
    get timerCount() { return timerCount; },
    get transitions() { return transitions; },
    get staleCallbacks() { return staleCallbacks; },
    get wall() { return wall; }
  };
}

for (const seed of [7, 1024, 20261028]) {
  test("200-resident native randomized lifecycle and scheduling soak seed=" + seed, () => {
    const f = makeEnvironment(seed);
    let expectedActiveFrames = 0;
    for (let step = 0; step < 1600; step++) {
      const choice = f.random();
      if (choice < 0.08) f.gate.setForeground(false);
      else if (choice < 0.16) f.gate.setForeground(true);
      else if (choice < 0.24) f.gate.setGamePaused(true);
      else if (choice < 0.32) f.gate.setGamePaused(false);
      else if (choice < 0.47) f.setSpeed([1, 2, 4][Math.floor(f.random() * 3)]!);
      else if (choice < 0.67) {
        const i = Math.floor(f.random() * 200);
        if (f.residents[i]!.alive) f.remove(i);
        else f.create(i);
      }
      const activeBefore = f.gate.active;
      if (activeBefore && f.residents.some(r => r.alive)) expectedActiveFrames++;
      f.advance(Math.floor(f.random() * 250) + 1);
      if (step % 41 === 0) f.injectStale();
    }
    f.gate.setGamePaused(false);
    f.gate.setForeground(true);
    f.advance(5000);
    f.injectStale();
    assert.ok(f.frameCount >= expectedActiveFrames, "resident RAF work unexpectedly stalled");
    assert.ok(f.timerCount > 0, "no resident timer callback executed");
    assert.ok(f.transitions > 10, "stress did not exercise lifecycle");
    assert.ok(f.staleCallbacks > 0, "stress did not test obsolete platform callbacks");
    assert.ok(f.queue.snapshot().platformWakeups > 0);
    for (let i = 0; i < 200; i++) f.remove(i);
    f.check();
    assert.equal(f.bus.snapshot().queued, 0);
    assert.equal(f.queue.snapshot().pending, 0);
    f.gate.setForeground(false);
    f.gate.setForeground(true);
    f.advance(10000);
    assert.equal(f.bus.snapshot().queued, 0);
    assert.equal(f.queue.snapshot().pending, 0);
  });
}
