import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  NativeResidentAppVisibility,
  observeNativeResidentAppVisibility
} from "../src/performance/nativeResidentAppVisibility.ts";
import { NativeResidentLifecycleBootstrap } from "../src/performance/nativeResidentLifecycleBootstrap.ts";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus.ts";
import { NativeResidentTimerQueue } from "../src/performance/nativeResidentTimerQueue.ts";
import { NativeResidentSegmentRunner } from "../src/performance/nativeResidentSegmentRunner.ts";
import { applyNativeResidentSchedulerActivity } from "../src/performance/nativeResidentSchedulerActivity.ts";

/** Fake OS bridge, not a physical Android/iOS device benchmark. */
function nativeEvents(android: boolean, initial: string | null = null) {
  let state = initial;
  const visibility = new NativeResidentAppVisibility(state, android);
  const changes = new Set<(state: string) => void>();
  const blurs = new Set<() => void>();
  const focuses = new Set<() => void>();
  const retained: Array<() => void> = [];
  let subscriptions = 0;
  const bindings = {
    readForeground: () => visibility.setAppState(state),
    readGamePaused: () => false,
    applyActive: (_active: boolean) => {},
    subscribeGamePaused: (_cb: () => void) => () => {},
    subscribeForeground: (cb: (active: boolean) => void) =>
      observeNativeResidentAppVisibility(visibility, {
        onChange: handler => {
          subscriptions++;
          changes.add(handler);
          retained.push(() => handler("background"));
          return () => { changes.delete(handler); };
        },
        onBlur: handler => {
          subscriptions++;
          blurs.add(handler);
          retained.push(handler);
          return () => { blurs.delete(handler); };
        },
        onFocus: handler => {
          subscriptions++;
          focuses.add(handler);
          retained.push(handler);
          return () => { focuses.delete(handler); };
        }
      }, cb)
  };
  return {
    visibility, bindings, retained,
    get subscriptions() { return subscriptions; },
    get listenerSizes() { return [changes.size, blurs.size, focuses.size]; },
    change(next: string) {
      state = next;
      for (const callback of [...changes]) callback(next);
    },
    blur() { for (const callback of [...blurs]) callback(); },
    focus() { for (const callback of [...focuses]) callback(); }
  };
}

test("only an explicitly active AppState grants native work; Android blur suppresses active", () => {
  const android = new NativeResidentAppVisibility(null, true);
  const ios = new NativeResidentAppVisibility(undefined, false);
  for (const state of [null, undefined, "unknown", "inactive", "background", "extension"]) {
    assert.equal(android.setAppState(state), false);
    assert.equal(ios.setAppState(state), false);
  }
  assert.equal(android.setAppState("active"), true);
  assert.equal(ios.setAppState("active"), true);
  assert.equal(android.setAndroidFocused(false), false);
  assert.equal(ios.setAndroidFocused(false), true);
  assert.equal(android.setAppState("active"), false, "Android focus loss is independent of AppState");
  assert.equal(android.setAndroidFocused(true), true);
  assert.equal(android.setAppState("inactive"), false);
  assert.equal(android.setAndroidFocused(true), false, "focus never overrides inactive");
});

test("Android lifecycle: 200 native runners and 200 timers freeze on null/blur and rebase on focus at 1x/2x/4x", () => {
  for (const speed of [1, 2, 4]) {
    const events = nativeEvents(true, null);
    let wall = 0;
    let nextId = 0;
    const frames = new Map<number, (at: number) => void>();
    const alarms = new Map<number, { at: number; cb: () => void }>();
    const bus = new NativeResidentFrameBus(
      cb => { const id = ++nextId; frames.set(id, cb); return id; },
      id => { frames.delete(id); }
    );
    const queue = new NativeResidentTimerQueue(
      () => wall,
      (cb, delay) => {
        const id = ++nextId;
        alarms.set(id, { at: wall + delay, cb });
        return id;
      },
      id => { alarms.delete(id); },
      32
    );
    let timerCalls = 0;
    const positions = Array<number>(200).fill(0);
    const arrivals = Array<number>(200).fill(0);
    const runners = Array.from({ length: 200 }, (_, i) => new NativeResidentSegmentRunner({
      requestFrame: cb => bus.request(cb),
      subscribeFrame: cb => bus.subscribeFrame(cb),
      cancelFrame: id => bus.cancel(id),
      readTimeScale: () => speed,
      writePositionXY: x => { positions[i] = x; },
      advanceSprite: () => {},
      setWalking: () => {}
    }));
    const boot = new NativeResidentLifecycleBootstrap({
      ...events.bindings,
      applyActive: active => applyNativeResidentSchedulerActivity(
        active, value => queue.setActive(value), value => bus.setActive(value)
      )
    });
    boot.ensure();
    assert.deepEqual(events.listenerSizes, [1, 1, 1]);
    assert.equal(bus.snapshot().active, false);
    assert.equal(queue.snapshot().active, false);
    for (let i = 0; i < 200; i++) {
      queue.schedule(() => { timerCalls++; }, 900);
      runners[i]!.start({
        from: { x: 0, y: i }, to: { x: 100, y: i },
        startTimestamp: 0, durationMs: 2000,
        onArrival: () => { arrivals[i]!++; }
      });
    }
    assert.equal(bus.snapshot().continuousSubscribers, 200);
    assert.equal(queue.snapshot().pending, 200);
    assert.equal(frames.size, 0);
    assert.equal(alarms.size, 0);
    wall = 60_000;
    events.change("background");
    events.change("unknown");
    assert.equal(frames.size, 0);
    events.change("active");
    assert.equal(frames.size, 1);
    assert.equal(alarms.size, 1);
    const tick = (at: number) => {
      assert.equal(frames.size, 1);
      const [id, cb] = frames.entries().next().value!;
      frames.delete(id);
      cb(at);
    };
    tick(wall); // first frame after unknown/background resumes without catch-up
    assert.ok(positions.every(x => x === 0));
    wall += 100;
    tick(wall);
    assert.ok(positions.every(x => x > 0 && x <= 20));
    const before = [...positions];
    const lateFrame = frames.values().next().value!;
    const lateTimer = alarms.values().next().value!.cb;
    events.blur(); // Android notification shade: AppState stays active
    assert.equal(frames.size, 0);
    assert.equal(alarms.size, 0);
    wall += 90_000;
    lateFrame(wall);
    lateTimer();
    assert.deepEqual(positions, before);
    assert.equal(timerCalls, 0);
    events.change("active"); // repeated AppState change must NOT override blur
    assert.equal(frames.size, 0);
    events.focus();
    assert.equal(frames.size, 1);
    assert.equal(alarms.size, 1);
    lateFrame(wall);
    lateTimer();
    assert.deepEqual(positions, before);
    tick(wall); // first frame after focus is an explicit rebase
    assert.deepEqual(positions, before);
    wall += 16;
    tick(wall);
    assert.ok(positions.every((x, i) => x > before[i]!));
    wall += 784;
    let wakeups = 0;
    while (alarms.size > 0) {
      const [id, alarm] = alarms.entries().next().value!;
      assert.ok(alarm.at <= wall);
      alarms.delete(id);
      alarm.cb();
      if (++wakeups > 10) throw new Error("timer did not drain within ten bounded batches");
    }
    assert.equal(timerCalls, 200);
    assert.equal(queue.snapshot().pending, 0);
    assert.deepEqual(arrivals, Array<number>(200).fill(0));
    runners.forEach(runner => runner.stop());
    assert.equal(frames.size, 0);
    assert.equal(bus.snapshot().continuousSubscribers, 0);
    boot.dispose();
    assert.deepEqual(events.listenerSizes, [0, 0, 0]);
    const priorSchedules = nextId;
    for (const late of events.retained) late();
    assert.equal(nextId, priorSchedules, "old observers cannot resurrect work");
  }
});

test("one Android lifecycle owner, 200 subscribers and 100 blur/focus cycles create no extra OS subscriptions", () => {
  const f = nativeEvents(true, "active");
  let foregroundTransitions = 0;
  const bootstrap = new NativeResidentLifecycleBootstrap({
    ...f.bindings,
    applyActive: () => { foregroundTransitions++; }
  });
  for (let i = 0; i < 200; i++) bootstrap.ensure();
  assert.equal(f.subscriptions, 3);
  assert.deepEqual(f.listenerSizes, [1, 1, 1]);
  for (let cycle = 0; cycle < 100; cycle++) {
    f.blur();
    f.focus();
    bootstrap.ensure();
  }
  assert.equal(f.subscriptions, 3);
  assert.equal(foregroundTransitions, 201);
  bootstrap.dispose();
  assert.deepEqual(f.listenerSizes, [0, 0, 0]);
});

test("registration failures roll back previous subscriptions and keep first falsy error", () => {
  const v = new NativeResidentAppVisibility("active", true);
  const calls: string[] = [];
  const stale: Array<(status: string) => void> = [];
  let observed = false;
  try {
    observeNativeResidentAppVisibility(v, {
      onChange: handler => {
        stale.push(handler);
        calls.push("change add");
        return () => { calls.push("change remove"); };
      },
      onBlur: _handler => { calls.push("blur add"); throw 0; },
      onFocus: _handler => { throw new Error("must never install focus after failed blur"); }
    }, () => {});
  } catch (error) { observed = true; assert.equal(error, 0); }
  assert.equal(observed, true);
  assert.deepEqual(calls, ["change add", "blur add", "change remove"]);
  // The platform may deliver a callback that was queued before removal.
  assert.equal(stale.length, 1);
  stale[0]!("background");
  assert.equal(v.foreground, true, "disposed callback must not change shared visibility");
});

test("repeat foreground after transient bridge fault remains observable; teardown attempts all removals", () => {
  const v = new NativeResidentAppVisibility("active", true);
  const live = { change: (_state: string) => {}, blur: () => {}, focus: () => {} };
  const removals: string[] = [];
  let repeated = 0;
  const unsubscribe = observeNativeResidentAppVisibility(v, {
    onChange: cb => { live.change = cb; return () => { removals.push("change"); }; },
    onBlur: cb => { live.blur = cb; return () => { removals.push("blur"); throw false; }; },
    onFocus: cb => { live.focus = cb; return () => { removals.push("focus"); }; }
  }, active => { if (active) repeated++; });
  live.change("active");
  live.focus();
  assert.equal(repeated, 2, "idempotent events must reach failed-scheduler retry gate");
  let observed = false;
  try { unsubscribe(); } catch (error) { observed = true; assert.equal(error, false); }
  assert.equal(observed, true);
  assert.deepEqual(removals, ["focus", "blur", "change"]);
  live.blur();
  live.focus();
  assert.equal(repeated, 2);
  unsubscribe(); // idempotent even after the first removal threw
});

test("Android focus wiring is native-only and the web map remains independently implemented", () => {
  const native = readFileSync(new URL("../src/performance/nativeResidentFrameLifecycle.native.ts", import.meta.url), "utf8");
  const web = readFileSync(new URL("../src/components/MapViewportTransform.web.tsx", import.meta.url), "utf8");
  assert.ok(native.includes("observeNativeResidentAppVisibility("));
  assert.ok(native.includes('AppState.addEventListener("blur"'));
  assert.ok(native.includes('AppState.addEventListener("focus"'));
  assert.ok(native.includes("visibility.setAppState(AppState.currentState)"));
  assert.ok(web.includes("react-zoom-pan-pinch"));
  assert.ok(!web.includes("NativeResidentAppVisibility"));
});

test("null initial native state resolves without an AppState change event via bounded boot probe", () => {
  let current: string | null = null;
  let next = 0;
  const os = new Map<number, () => void>();
  const stale: Array<() => void> = [];
  const states: boolean[] = [];
  const visibility = new NativeResidentAppVisibility(null, false);
  const stop = observeNativeResidentAppVisibility(visibility, {
    onChange: () => () => {},
    bootProbe: {
      read: () => current,
      schedule: cb => { os.set(++next, cb); stale.push(cb); return next; },
      cancel: id => { os.delete(id); }
    }
  }, value => states.push(value));
  const tick = () => {
    assert.equal(os.size, 1);
    const [id, cb] = os.entries().next().value!;
    os.delete(id);
    cb();
  };
  assert.equal(os.size, 1);
  tick(); // still null; a second bounded attempt
  assert.deepEqual(states, []);
  current = "active"; // bridge resolves without emitting change
  tick();
  assert.deepEqual(states, [true]);
  assert.equal(os.size, 0);
  stale.forEach(cb => cb());
  assert.deepEqual(states, [true], "old timers cannot duplicate a resume");
  stop();
});

test("boot probe never polls indefinitely, and known states need zero extra timeouts", () => {
  for (const state of ["active", "inactive", "background"]) {
    let schedules = 0;
    const stop = observeNativeResidentAppVisibility(
      new NativeResidentAppVisibility(state, false), {
        onChange: () => () => {},
        bootProbe: {
          read: () => state,
          schedule: () => { schedules++; return 1; },
          cancel: () => {}
        }
      }, () => {}
    );
    assert.equal(schedules, 0);
    stop();
  }
  let schedules = 0;
  const os = new Map<number, () => void>();
  let onChange: (state: string) => void = () => {};
  const values: boolean[] = [];
  const visibility = new NativeResidentAppVisibility("unknown", false);
  const stop = observeNativeResidentAppVisibility(visibility, {
    onChange: cb => { onChange = cb; return () => {}; },
    bootProbe: {
      read: () => "unknown",
      schedule: cb => { const id = ++schedules; os.set(id, cb); return id; },
      cancel: id => { os.delete(id); }
    }
  }, value => values.push(value));
  for (let i = 0; i < 4; i++) {
    assert.equal(os.size, 1);
    const [id, cb] = os.entries().next().value!;
    os.delete(id);
    cb();
  }
  assert.equal(schedules, 4);
  assert.equal(os.size, 0);
  assert.deepEqual(values, []);
  assert.equal(visibility.foreground, false);
  onChange("active");
  assert.deepEqual(values, [true], "later authoritative events still work");
  stop();
});

test("boot probe cancellation errors do not skip app observers' teardown", () => {
  const visibility = new NativeResidentAppVisibility(null, false);
  const removals: string[] = [];
  const callbacks: Array<() => void> = [];
  const stop = observeNativeResidentAppVisibility(visibility, {
    onChange: () => () => { removals.push("change"); },
    bootProbe: {
      read: () => null,
      schedule: cb => { callbacks.push(cb); return 42; },
      cancel: () => { removals.push("probe"); throw false; }
    }
  }, () => assert.fail("disposed observer delivered a callback"));
  let caught = false;
  try { stop(); }
  catch (e) { caught = true; assert.equal(e, false); }
  assert.equal(caught, true);
  assert.deepEqual(removals, ["probe", "change"]);
  callbacks[0]!(); // stale OS callback delivered after failed cancel
  assert.equal(visibility.foreground, false);
  stop(); // idempotent
});


test("transient asynchronous AppState read failure retries within the bounded boot budget", () => {
  let reads = 0;
  let scheduled = 0;
  const os = new Map<number, () => void>();
  const retained: Array<() => void> = [];
  const values: boolean[] = [];
  const visibility = new NativeResidentAppVisibility(null, true);
  let change: (state: string) => void = () => {};
  const stop = observeNativeResidentAppVisibility(visibility, {
    onChange: cb => { change = cb; return () => {}; },
    onBlur: () => () => {},
    onFocus: () => () => {},
    bootProbe: {
      read: () => {
        reads++;
        if (reads === 2) throw false; // first asynchronous bridge read
        return reads >= 3 ? "active" : null;
      },
      schedule: cb => {
        const id = ++scheduled;
        os.set(id, cb);
        retained.push(cb);
        return id;
      },
      cancel: id => { os.delete(id); }
    }
  }, active => values.push(active));
  assert.equal(os.size, 1);
  const tick = () => {
    const [id, cb] = os.entries().next().value!;
    os.delete(id);
    cb();
  };
  tick(); // throws internally; must remain paused and schedule attempt 2
  assert.equal(visibility.foreground, false);
  assert.deepEqual(values, []);
  assert.equal(os.size, 1);
  tick(); // bridge now resolves without an AppState event
  assert.equal(visibility.foreground, true);
  assert.deepEqual(values, [true]);
  assert.equal(scheduled, 2);
  assert.equal(os.size, 0);
  retained.forEach(cb => cb()); // late OS callbacks cannot double-resume
  assert.deepEqual(values, [true]);
  change("background");
  assert.deepEqual(values, [true, false]);
  stop();
});

test("permanent asynchronous AppState read faults exhaust four checks and fail closed", () => {
  let reads = 0;
  let scheduled = 0;
  const os = new Map<number, () => void>();
  let change: (state: string) => void = () => {};
  const values: boolean[] = [];
  const visibility = new NativeResidentAppVisibility(null, false);
  const stop = observeNativeResidentAppVisibility(visibility, {
    onChange: cb => { change = cb; return () => {}; },
    bootProbe: {
      read: () => {
        reads++;
        if (reads > 1) throw new Error("transient native bridge unavailable");
        return null;
      },
      schedule: cb => { const id = ++scheduled; os.set(id, cb); return id; },
      cancel: id => { os.delete(id); }
    }
  }, active => values.push(active));
  for (let attempt = 0; attempt < 4; attempt++) {
    assert.equal(os.size, 1);
    const [id, cb] = os.entries().next().value!;
    os.delete(id);
    cb();
  }
  assert.equal(scheduled, 4);
  assert.equal(os.size, 0, "no indefinite retries or background polling");
  assert.equal(visibility.foreground, false);
  assert.deepEqual(values, []);
  change("active"); // a later authoritative event still recovers
  assert.deepEqual(values, [true]);
  stop();
});
