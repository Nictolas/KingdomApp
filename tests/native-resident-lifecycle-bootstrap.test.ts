import assert from "node:assert/strict";
import test from "node:test";
import {
  NativeResidentLifecycleBootstrap,
  type NativeResidentLifecycleBindings
} from "../src/performance/nativeResidentLifecycleBootstrap.ts";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";
import { NativeResidentTimerQueue } from "../src/performance/nativeResidentTimerQueue.ts";
import { NativeResidentSegmentProgress } from "../src/performance/nativeResidentSegmentProgress.ts";
import { applyNativeResidentSchedulerActivity } from "../src/performance/nativeResidentSchedulerActivity.ts";

function thrown(fn: () => unknown): { caught: boolean; value: unknown } {
  let caught = false;
  let value: unknown;
  try { fn(); } catch (error) { caught = true; value = error; }
  return { caught, value };
}

/** Fake app clock and foreground buses. No React Native and no persistence. */
function publishers(apply: (active: boolean) => void = () => {}) {
  let foreground = true;
  let paused = false;
  const foregroundListeners = new Set<(value: boolean) => void>();
  const pauseListeners = new Set<() => void>();
  let foregroundRegistrations = 0;
  let pauseRegistrations = 0;
  const bindings: NativeResidentLifecycleBindings = {
    readForeground: () => foreground,
    readGamePaused: () => paused,
    applyActive: apply,
    subscribeForeground: listener => {
      foregroundRegistrations++;
      foregroundListeners.add(listener);
      return () => { foregroundListeners.delete(listener); };
    },
    subscribeGamePaused: listener => {
      pauseRegistrations++;
      pauseListeners.add(listener);
      return () => { pauseListeners.delete(listener); };
    }
  };
  return {
    bindings,
    foregroundListeners, pauseListeners,
    get registrations() { return [foregroundRegistrations, pauseRegistrations]; },
    setForeground(value: boolean) {
      foreground = value;
      for (const listener of [...foregroundListeners]) listener(value);
    },
    setPaused(value: boolean) {
      paused = value;
      for (const listener of [...pauseListeners]) listener();
    }
  };
}

test("200 sprites and 1000 repeated ensure calls still install one AppState and one game-clock listener", () => {
  const states: boolean[] = [];
  const f = publishers(active => { states.push(active); });
  const bootstrap = new NativeResidentLifecycleBootstrap(f.bindings);
  for (let id = 0; id < 200; id++) bootstrap.ensure();
  for (let i = 0; i < 1000; i++) bootstrap.ensure();
  assert.equal(bootstrap.initialized, true);
  assert.deepEqual(f.registrations, [1, 1]);
  assert.equal(f.foregroundListeners.size, 1);
  assert.equal(f.pauseListeners.size, 1);
  f.setPaused(true);
  f.setForeground(false);
  f.setPaused(false);
  f.setForeground(true);
  assert.deepEqual(states, [true, false, true]);
  bootstrap.dispose();
  assert.equal(bootstrap.initialized, false);
  assert.equal(f.foregroundListeners.size, 0);
  assert.equal(f.pauseListeners.size, 0);
});

test("falsy initial scheduler failure is propagated and the next ensure installs cleanly", () => {
  let fail = true;
  const states: boolean[] = [];
  const f = publishers(active => {
    states.push(active);
    if (fail && active) { fail = false; throw undefined; }
  });
  const bootstrap = new NativeResidentLifecycleBootstrap(f.bindings);
  const error = thrown(() => bootstrap.ensure());
  assert.equal(error.caught, true);
  assert.equal(error.value, undefined);
  assert.equal(bootstrap.initialized, false);
  assert.equal(f.foregroundListeners.size, 0);
  assert.equal(f.pauseListeners.size, 0);
  assert.deepEqual(states, [true, false], "failed initialization must fail closed");
  bootstrap.ensure();
  assert.equal(bootstrap.initialized, true);
  assert.deepEqual(states, [true, false, true]);
  assert.equal(f.foregroundListeners.size, 1);
  assert.equal(f.pauseListeners.size, 1);
  bootstrap.dispose();
});

test("a partially installed clock subscription is rolled back if AppState registration fails", () => {
  const f = publishers();
  let fail = true;
  const original = f.bindings.subscribeForeground;
  const bindings: NativeResidentLifecycleBindings = {
    ...f.bindings,
    subscribeForeground: listener => {
      if (fail) { fail = false; throw false; }
      return original(listener);
    }
  };
  const bootstrap = new NativeResidentLifecycleBootstrap(bindings);
  const error = thrown(() => bootstrap.ensure());
  assert.equal(error.caught, true);
  assert.equal(error.value, false);
  assert.equal(bootstrap.initialized, false);
  assert.equal(f.foregroundListeners.size, 0);
  assert.equal(f.pauseListeners.size, 0);
  bootstrap.ensure();
  assert.equal(bootstrap.initialized, true);
  assert.equal(f.foregroundListeners.size, 1);
  assert.equal(f.pauseListeners.size, 1);
  bootstrap.dispose();
});

test("bootstrap catches a snapshot change occurring during listener registration", () => {
  const states: boolean[] = [];
  let foreground = true;
  let paused = false;
  const pauseListeners = new Set<() => void>();
  const foregroundListeners = new Set<(value: boolean) => void>();
  const bootstrap = new NativeResidentLifecycleBootstrap({
    readForeground: () => foreground,
    readGamePaused: () => paused,
    applyActive: active => { states.push(active); },
    subscribeGamePaused: listener => {
      pauseListeners.add(listener);
      paused = true; // state changed silently between snapshot and subscription
      return () => { pauseListeners.delete(listener); };
    },
    subscribeForeground: listener => {
      foregroundListeners.add(listener);
      foreground = false; // second silent state change before reconcile
      return () => { foregroundListeners.delete(listener); };
    }
  });
  bootstrap.ensure();
  assert.deepEqual(states, [true, false]);
  assert.equal(bootstrap.initialized, true);
  assert.equal(foregroundListeners.size, 1);
  assert.equal(pauseListeners.size, 1);
  bootstrap.dispose();
});

test("a canceled native AppState notification cannot control a newer bootstrap", () => {
  const f = publishers();
  const states: boolean[] = [];
  const oldEvents: Array<(value: boolean) => void> = [];
  const bindings: NativeResidentLifecycleBindings = {
    ...f.bindings,
    applyActive: active => { states.push(active); },
    subscribeForeground: listener => {
      oldEvents.push(listener);
      return f.bindings.subscribeForeground(listener);
    }
  };
  const bootstrap = new NativeResidentLifecycleBootstrap(bindings);
  bootstrap.ensure();
  bootstrap.dispose();
  bootstrap.ensure();
  assert.equal(bootstrap.initialized, true);
  assert.deepEqual(states, [true, false, true], "dispose must pause the old scheduler before reinstall");
  oldEvents[0]!(false); // native callback already enqueued before remove()
  assert.deepEqual(states, [true, false, true], "a retired callback must not pause the new generation");
  f.setForeground(false);
  assert.deepEqual(states, [true, false, true, false]);
  bootstrap.dispose();
});

test("a failed foreground resume can be retried by an identical event without duplicating work", () => {
  let resumeFaults = 1;
  const states: boolean[] = [];
  const f = publishers(active => {
    states.push(active);
    if (active && states.length > 1 && resumeFaults-- > 0) throw 0;
  });
  const bootstrap = new NativeResidentLifecycleBootstrap(f.bindings);
  bootstrap.ensure();
  f.setForeground(false);
  const failure = thrown(() => f.setForeground(true));
  assert.equal(failure.caught, true);
  assert.equal(failure.value, 0);
  assert.equal(bootstrap.initialized, true, "listeners stay installed after a transition error");
  f.setForeground(true); // duplicate native state event retries the failed transition
  f.setForeground(true); // once healthy, no redundant scheduler update
  assert.deepEqual(states, [true, false, true, true]);
  bootstrap.dispose();
});

test("200 RAF subscribers and 200 idle timers recover from one failed OS RAF after resume", () => {
  let wall = 0;
  let nextId = 0;
  let failNextRequest = false;
  const frames = new Map<number, (at: number) => void>();
  const alarms = new Map<number, { due: number; fn: () => void }>();
  const bus = new NativeResidentFrameBus(
    cb => {
      if (failNextRequest) { failNextRequest = false; throw new Error("RAF resume transient"); }
      const id = ++nextId; frames.set(id, cb); return id;
    },
    id => { frames.delete(id); }
  );
  const queue = new NativeResidentTimerQueue(
    () => wall,
    (cb, delay) => {
      const id = ++nextId; alarms.set(id, { due: wall + delay, fn: cb }); return id;
    },
    id => { alarms.delete(id); },
    32
  );
  const f = publishers(active =>
    applyNativeResidentSchedulerActivity(
      active,
      isActive => queue.setActive(isActive),
      isActive => bus.setActive(isActive)
    )
  );
  const bootstrap = new NativeResidentLifecycleBootstrap(f.bindings);
  bootstrap.ensure();
  const framesSeen = Array<number>(200).fill(0);
  const timersSeen = Array<number>(200).fill(0);
  const resumed = Array<boolean>(200).fill(false);
  const frameIds = Array.from({ length: 200 }, (_, i) =>
    bus.subscribeFrame((_at, rebase) => { framesSeen[i]!++; resumed[i] = rebase; })
  );
  const timerIds = Array.from({ length: 200 }, (_, i) =>
    queue.schedule(() => { timersSeen[i]!++; }, 900)
  );
  wall = 100;
  f.setForeground(false);
  assert.equal(frames.size, 0);
  assert.equal(alarms.size, 0);
  wall = 60_000;
  failNextRequest = true;
  const failure = thrown(() => f.setForeground(true));
  assert.equal(failure.caught, true);
  assert.match(String(failure.value), /RAF resume transient/);
  assert.equal(bus.snapshot().active, true);
  assert.equal(bus.snapshot().scheduled, false);
  assert.equal(queue.snapshot().active, true);
  assert.equal(alarms.size, 1);
  f.setForeground(true); // retry identical state
  assert.equal(frames.size, 1);
  const [frameId, callback] = frames.entries().next().value!;
  frames.delete(frameId);
  callback(wall);
  assert.equal(framesSeen.reduce((a, b) => a + b, 0), 200);
  assert.ok(resumed.every(Boolean));
  assert.equal(timersSeen.reduce((a, b) => a + b, 0), 0);
  wall += 800;
  for (let turn = 0; turn < 7; turn++) {
    assert.equal(alarms.size, 1);
    const [id, alarm] = alarms.entries().next().value!;
    assert.ok(alarm.due <= wall);
    alarms.delete(id);
    alarm.fn();
  }
  assert.equal(timersSeen.reduce((a, b) => a + b, 0), 200);
  frameIds.forEach(id => bus.cancel(id));
  timerIds.forEach(id => queue.cancel(id));
  assert.equal(frames.size, 0);
  assert.equal(alarms.size, 0);
  bootstrap.dispose();
});

test("1,000 lifecycle retries, 200 app-state transitions and false callback values never leak listeners", () => {
  let failures = 0;
  const f = publishers(active => {
    if (active && failures++ < 3) throw null;
  });
  const bootstrap = new NativeResidentLifecycleBootstrap(f.bindings);
  for (let i = 0; i < 5; i++) {
    const attempt = thrown(() => bootstrap.ensure());
    if (!attempt.caught) break;
    assert.equal(attempt.value, null);
  }
  assert.equal(bootstrap.initialized, true);
  for (let i = 0; i < 200; i++) {
    f.setForeground(false);
    f.setForeground(true);
    bootstrap.ensure();
  }
  assert.deepEqual(f.registrations, [1, 1]);
  assert.equal(f.foregroundListeners.size, 1);
  assert.equal(f.pauseListeners.size, 1);
  bootstrap.dispose();
  assert.equal(f.foregroundListeners.size, 0);
  assert.equal(f.pauseListeners.size, 0);
});


test("teardown freezes 200 RAF subscribers and 200 timers across 100 dispose/reinstall cycles", () => {
  let wall = 0;
  let nextId = 0;
  const frames = new Map<number, (timestamp: number) => void>();
  const alarms = new Map<number, () => void>();
  const bus = new NativeResidentFrameBus(
    cb => { const id = ++nextId; frames.set(id, cb); return id; },
    id => { frames.delete(id); }
  );
  const queue = new NativeResidentTimerQueue(
    () => wall,
    (cb, _delay) => { const id = ++nextId; alarms.set(id, cb); return id; },
    id => { alarms.delete(id); },
    32
  );
  const f = publishers(active => applyNativeResidentSchedulerActivity(
    active, value => queue.setActive(value), value => bus.setActive(value)
  ));
  const owner = new NativeResidentLifecycleBootstrap(f.bindings);
  owner.ensure();
  let frameCalls = 0;
  let timerCalls = 0;
  const frameIds = Array.from({ length: 200 }, () =>
    bus.subscribeFrame(() => { frameCalls++; })
  );
  const timerIds = Array.from({ length: 200 }, () =>
    queue.schedule(() => { timerCalls++; }, 900)
  );
  for (let cycle = 0; cycle < 100; cycle++) {
    assert.equal(frames.size, 1);
    assert.equal(alarms.size, 1);
    const lateFrame = frames.values().next().value!;
    const lateAlarm = alarms.values().next().value!;
    owner.dispose();
    assert.equal(bus.snapshot().active, false);
    assert.equal(queue.snapshot().active, false);
    assert.equal(frames.size, 0);
    assert.equal(alarms.size, 0);
    assert.equal(f.foregroundListeners.size, 0);
    assert.equal(f.pauseListeners.size, 0);
    lateFrame(wall + 10_000);
    lateAlarm();
    assert.equal(frameCalls, 0);
    assert.equal(timerCalls, 0);
    owner.ensure();
    assert.equal(frames.size, 1);
    assert.equal(alarms.size, 1);
    assert.equal(bus.snapshot().continuousSubscribers, 200);
    assert.equal(queue.snapshot().pending, 200);
  }
  assert.deepEqual(f.registrations, [101, 101],
    "one shared listener of each kind per deliberate reinstall, never per resident");
  frameIds.forEach(id => bus.cancel(id));
  timerIds.forEach(id => queue.cancel(id));
  owner.dispose();
  assert.equal(frames.size, 0);
  assert.equal(alarms.size, 0);
  assert.equal(bus.snapshot().queued, 0);
  assert.equal(queue.snapshot().pending, 0);
});

test("reentrant disposal during foreground registration invalidates the incomplete bootstrap", () => {
  const states: boolean[] = [];
  const f = publishers(active => { states.push(active); });
  let disposeDuringRegistration = true;
  let owner!: NativeResidentLifecycleBootstrap;
  const bindings: NativeResidentLifecycleBindings = {
    ...f.bindings,
    subscribeForeground: listener => {
      const remove = f.bindings.subscribeForeground(listener);
      if (disposeDuringRegistration) {
        disposeDuringRegistration = false;
        owner.dispose();
      }
      return remove;
    }
  };
  owner = new NativeResidentLifecycleBootstrap(bindings);
  assert.match(String(thrown(() => owner.ensure()).value), /installation invalidated/);
  assert.equal(owner.initialized, false);
  assert.equal(f.foregroundListeners.size, 0);
  assert.equal(f.pauseListeners.size, 0);
  assert.equal(states.at(-1), false, "an invalidated bootstrap must fail closed");
  owner.ensure();
  assert.equal(owner.initialized, true);
  assert.equal(f.foregroundListeners.size, 1);
  assert.equal(f.pauseListeners.size, 1);
  owner.dispose();
  assert.equal(states.at(-1), false);
});

test("teardown still pauses schedulers if a native unsubscribe throws a falsy value", () => {
  const states: boolean[] = [];
  const f = publishers(active => { states.push(active); });
  const owner = new NativeResidentLifecycleBootstrap({
    ...f.bindings,
    subscribeForeground: listener => {
      const remove = f.bindings.subscribeForeground(listener);
      return () => { remove(); throw false; };
    }
  });
  owner.ensure();
  const failure = thrown(() => owner.dispose());
  assert.equal(failure.caught, true);
  assert.equal(failure.value, false);
  assert.equal(states.at(-1), false);
  assert.equal(f.foregroundListeners.size, 0);
  assert.equal(f.pauseListeners.size, 0);
  owner.dispose(); // repeated cleanup must not rethrow or rearm work
  assert.equal(states.at(-1), false);
});


/**
 * End-to-end scheduler/clock matrix under a deterministic fake native OS.
 * Counts are JS-only; neither frames nor timers represent measured device FPS.
 * The 8 logical waits per resident deliberately model burst pressure without
 * using GameContext, persistence, web rendering or real React Native bridges.
 */
test("native population matrix: 25/50/100/200 residents at 1x/2x/4x preserve motion, 8 waits each and background isolation", () => {
  for (const population of [25, 50, 100, 200]) {
    for (const speed of [1, 2, 4]) {
      let wall = 0;
      let nextId = 0;
      const frames = new Map<number, (at: number) => void>();
      const alarms = new Map<number, { due: number; callback: () => void }>();
      const bus = new NativeResidentFrameBus(
        cb => { const id = ++nextId; frames.set(id, cb); return id; },
        id => { frames.delete(id); }
      );
      const queue = new NativeResidentTimerQueue(
        () => wall,
        (cb, delay) => {
          const id = ++nextId;
          alarms.set(id, { due: wall + delay, callback: cb });
          return id;
        },
        id => { alarms.delete(id); },
        32
      );
      const subscriptions = publishers(active => applyNativeResidentSchedulerActivity(
        active, a => queue.setActive(a), a => bus.setActive(a)
      ));
      const owner = new NativeResidentLifecycleBootstrap(subscriptions.bindings);
      owner.ensure();
      const motion = Array.from({ length: population }, () => ({
        clock: new NativeResidentSegmentProgress(0, 2000),
        sample: { elapsedMs: 0, progress: 0, advance: false, complete: false },
        updates: 0
      }));
      const handles = motion.map(state => bus.subscribeFrame((at, rebase) => {
        state.clock.sampleInto(at, speed, rebase, state.sample);
        if (state.sample.advance) state.updates++;
      }));
      const fired = Array<number>(population).fill(0);
      const waits: number[] = [];
      for (let i = 0; i < population; i++) {
        for (let n = 0; n < 8; n++) {
          waits.push(queue.schedule(() => { fired[i]!++; }, 1000));
        }
      }
      const emitFrame = (): void => {
        assert.equal(frames.size, 1, "one OS RAF shared by all resident sprites");
        const [id, callback] = frames.entries().next().value!;
        frames.delete(id);
        callback(wall);
      };
      const startFrame = frames.values().next().value!;
      const startTimer = alarms.values().next().value!.callback;
      wall = 100;
      emitFrame();
      assert.ok(motion.every(m => Math.abs(m.sample.progress - speed * 0.05) < 1e-9));
      subscriptions.setForeground(false);
      subscriptions.setPaused(true);
      assert.equal(frames.size, 0);
      assert.equal(alarms.size, 0);
      wall = 90_000;
      startFrame(wall);
      startTimer();
      assert.ok(motion.every(m => m.updates === 1));
      assert.ok(fired.every(n => n === 0));
      subscriptions.setForeground(true);
      assert.equal(frames.size, 0, "foreground must not override an explicit game pause");
      subscriptions.setPaused(false);
      assert.equal(frames.size, 1);
      assert.equal(alarms.size, 1);
      emitFrame(); // rebase: ignore the 89.9 s of suspended wall time
      assert.ok(motion.every(m => m.updates === 1 && Math.abs(m.sample.progress - speed * 0.05) < 1e-9));
      wall += 50;
      emitFrame();
      assert.ok(motion.every(m => m.updates === 2 && Math.abs(m.sample.progress - speed * 0.075) < 1e-9));
      wall = 91_000;
      let wakes = 0;
      while (alarms.size) {
        assert.ok(++wakes <= Math.ceil(population * 8 / 32) + 1, "timer backlog must drain");
        const [id, alarm] = alarms.entries().next().value!;
        assert.ok(alarm.due <= wall, "active-time deadline must elapse");
        alarms.delete(id);
        alarm.callback();
      }
      assert.deepEqual(fired, Array<number>(population).fill(8), "each logical idle/collision wait runs once");
      assert.equal(queue.snapshot().logicalCallbacks, population * 8);
      assert.equal(queue.snapshot().pending, 0);
      assert.equal(wakes, Math.ceil(population * 8 / 32));
      assert.equal(bus.snapshot().continuousSubscribers, population);
      owner.dispose();
      assert.equal(frames.size, 0);
      assert.equal(alarms.size, 0);
      assert.equal(subscriptions.foregroundListeners.size, 0);
      assert.equal(subscriptions.pauseListeners.size, 0);
      handles.forEach(id => bus.cancel(id));
      waits.forEach(id => queue.cancel(id));
      assert.equal(bus.snapshot().continuousSubscribers, 0);
      assert.equal(queue.snapshot().pending, 0);
    }
  }
});

test("100 native lifecycle generations reject all delayed AppState callbacks and retain exactly two listeners", () => {
  const events: boolean[] = [];
  const f = publishers(active => { events.push(active); });
  const retired: Array<(active: boolean) => void> = [];
  const owner = new NativeResidentLifecycleBootstrap({
    ...f.bindings,
    subscribeForeground: listener => {
      retired.push(listener);
      return f.bindings.subscribeForeground(listener);
    }
  });
  owner.ensure();
  for (let cycle = 0; cycle < 100; cycle++) {
    const retiredAt = retired.length;
    owner.dispose();
    assert.equal(f.foregroundListeners.size, 0);
    assert.equal(f.pauseListeners.size, 0);
    owner.ensure();
    const before = events.length;
    for (let old = 0; old < retiredAt; old++) {
      retired[old]!(false);
      retired[old]!(true);
    }
    assert.equal(events.length, before, "retired OS callbacks must be inert");
    assert.equal(f.foregroundListeners.size, 1);
    assert.equal(f.pauseListeners.size, 1);
    assert.equal(owner.initialized, true);
  }
  assert.equal(events.length, 201, "101 starts and 100 fail-closed disposals");
  owner.dispose();
  assert.equal(events.at(-1), false);
  assert.equal(f.foregroundListeners.size, 0);
  assert.equal(f.pauseListeners.size, 0);
});
