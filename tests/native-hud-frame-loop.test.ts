import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { NativeHudFrameLoop } from "../src/performance/nativeHudFrameLoop.ts";
import { NativeResidentSamplingLifecycle } from "../src/performance/nativeResidentSamplingLifecycle.ts";
import { NativeResidentAppVisibility, observeNativeResidentAppVisibility } from "../src/performance/nativeResidentAppVisibility.ts";

/** Fake OS delivers even canceled callbacks to stress generation protection. */
function fakeHud() {
  let nextId = 0;
  let delivered = 0;
  let stateMutations = 0;
  const outstanding = new Map<number, (at: number) => void>();
  const canceled: Array<(at: number) => void> = [];
  const frameLoop = new NativeHudFrameLoop(
    cb => { const id = ++nextId; outstanding.set(id, cb); return id; },
    id => {
      const previous = outstanding.get(id);
      if (previous) canceled.push(previous);
      outstanding.delete(id);
    },
    () => { delivered++; stateMutations++; }
  );
  const tick = (time: number) => {
    assert.equal(outstanding.size, 1, "HUD must have one or zero native RAFs");
    const [id, cb] = outstanding.entries().next().value!;
    outstanding.delete(id);
    cb(time);
  };
  const drainCanceled = () => {
    for (const cb of canceled.splice(0)) cb(999_999);
  };
  return {
    frameLoop, outstanding, canceled, tick, drainCanceled,
    get delivered() { return delivered; },
    get stateMutations() { return stateMutations; },
    get requests() { return nextId; }
  };
}

test("collapsed HUD does not register an RAF, even through 10,000 gameplay frames", () => {
  const f = fakeHud();
  for (let i = 0; i < 10_000; i++) {
    assert.equal(f.frameLoop.snapshot().scheduled, false);
    assert.equal(f.outstanding.size, 0);
  }
  assert.equal(f.requests, 0);
  assert.equal(f.delivered, 0);
  assert.equal(f.frameLoop.snapshot().delivered, 0);
});

test("expanded HUD creates exactly one RAF and closes it immediately", () => {
  const f = fakeHud();
  f.frameLoop.start();
  assert.equal(f.outstanding.size, 1);
  for (let frame = 0; frame < 600; frame++) {
    f.tick(16 * frame);
    assert.equal(f.outstanding.size, 1);
  }
  assert.equal(f.delivered, 600);
  assert.equal(f.requests, 601);
  f.frameLoop.stop();
  assert.equal(f.outstanding.size, 0);
  assert.equal(f.canceled.length, 1);
  f.drainCanceled();
  assert.equal(f.delivered, 600, "canceled OS callback ran after collapse");
  assert.equal(f.outstanding.size, 0, "stale callback re-armed closed panel");
  assert.equal(f.frameLoop.snapshot().active, false);
});

test("AppState background cancels RAF, foreground resumes with no catch-up", () => {
  const f = fakeHud();
  f.frameLoop.start();
  f.tick(16);
  f.frameLoop.setForeground(false);
  assert.equal(f.outstanding.size, 0);
  f.drainCanceled();
  assert.equal(f.delivered, 1);
  for (let i = 0; i < 500; i++) {
    f.frameLoop.setForeground(false);
    assert.equal(f.outstanding.size, 0);
  }
  f.frameLoop.setForeground(true);
  assert.equal(f.outstanding.size, 1);
  f.tick(100_000); // One new RAF, never a burst for missed background frames.
  assert.equal(f.delivered, 2);
  assert.equal(f.outstanding.size, 1);
  f.frameLoop.stop();
  assert.equal(f.outstanding.size, 0);
});

test("200 expand/collapse cycles neither leak RAFs nor resurrect stale callbacks", () => {
  const f = fakeHud();
  for (let cycle = 0; cycle < 200; cycle++) {
    f.frameLoop.start();
    assert.equal(f.outstanding.size, 1);
    f.tick(cycle);
    f.frameLoop.stop();
    assert.equal(f.outstanding.size, 0);
    f.drainCanceled();
    assert.equal(f.outstanding.size, 0);
  }
  assert.equal(f.delivered, 200);
  assert.equal(f.frameLoop.snapshot().active, false);
  assert.equal(f.frameLoop.snapshot().requested, 400);
});

test("foreground lifecycle changes and duplicate starts/stops never queue multiple RAFs", () => {
  const f = fakeHud();
  f.frameLoop.start(false);
  assert.equal(f.requests, 0, "a HUD opened in background cannot schedule RAF");
  f.frameLoop.start(true);
  assert.equal(f.requests, 0, "duplicate start cannot bypass foreground gate");
  f.frameLoop.setForeground(true);
  assert.equal(f.outstanding.size, 1);
  f.frameLoop.setForeground(true);
  f.frameLoop.start();
  assert.equal(f.outstanding.size, 1);
  assert.equal(f.requests, 1);
  f.frameLoop.stop();
  f.frameLoop.stop();
  f.drainCanceled();
  assert.equal(f.outstanding.size, 0);
});

test("stale RAF from old focus session cannot affect new expanded HUD session", () => {
  const f = fakeHud();
  f.frameLoop.start();
  f.frameLoop.stop();
  assert.equal(f.canceled.length, 1);
  f.frameLoop.start();
  assert.equal(f.outstanding.size, 1);
  f.drainCanceled();
  assert.equal(f.delivered, 0);
  assert.equal(f.outstanding.size, 1, "old RAF cannot remove replacement");
  f.tick(123);
  assert.equal(f.delivered, 1);
  f.frameLoop.stop();
});

test("re-entrant shutdown inside HUD's onFrame never schedules a phantom RAF", () => {
  let id = 0;
  const outstanding = new Map<number, (at: number) => void>();
  let deliveries = 0;
  let loop: NativeHudFrameLoop;
  loop = new NativeHudFrameLoop(
    cb => { outstanding.set(++id, cb); return id; },
    frameId => { outstanding.delete(frameId); },
    () => { deliveries++; loop.stop(); }
  );
  loop.start();
  const [frameId, callback] = outstanding.entries().next().value!;
  outstanding.delete(frameId);
  callback(16);
  assert.equal(deliveries, 1);
  assert.equal(outstanding.size, 0);
  assert.equal(loop.snapshot().requested, 1);
});

test("re-entrant stop/start on the same RAF does not duplicate the next frame", () => {
  let id = 0;
  const outstanding = new Map<number, (at: number) => void>();
  let calls = 0;
  let loop: NativeHudFrameLoop;
  loop = new NativeHudFrameLoop(
    cb => { outstanding.set(++id, cb); return id; },
    frameId => { outstanding.delete(frameId); },
    () => {
      calls++;
      if (calls === 1) { loop.stop(); loop.start(); }
    }
  );
  loop.start();
  let [frameId, cb] = outstanding.entries().next().value!;
  outstanding.delete(frameId);
  cb(16);
  assert.equal(outstanding.size, 1, "old generation must not rearm after new start");
  [frameId, cb] = outstanding.entries().next().value!;
  outstanding.delete(frameId);
  cb(32);
  assert.equal(calls, 2);
  assert.equal(outstanding.size, 1);
  loop.stop();
});

test("HUD source only activates polling when details are expanded and terminates on background", () => {
  const source = readFileSync(new URL("../src/performance/NativePerformanceHud.tsx", import.meta.url), "utf8");
  assert.match(source, /if \(!expanded\) \{\s+if \(capture\.current\) abortCapture\(\);\s+return;/);
  assert.match(source, /frameLoop\.start\(visibility\.foreground\)/);
  assert.match(source, /new NativeHudFrameLoop\(requestAnimationFrame, cancelAnimationFrame, onFrame, \(\) =>/);
  assert.match(source, /samplingLifecycle\.setForeground\(false\)/);
  assert.match(source, /frameLoop\?\.setForeground\(foreground\)/);
  assert.match(source, /observeNativeResidentAppVisibility\(visibility/);
  assert.match(source, /AppState\.addEventListener\("blur"/);
  assert.match(source, /AppState\.addEventListener\("focus"/);
  assert.match(source, /if \(visibility\.foreground\)/);
  assert.match(source, /if \(!hudForeground\.current\)/);
  assert.match(source, /stopVisibility\(\)/);
  assert.match(source, /frameLoop\?\.stop\(\)/);
  assert.match(source, /\}, \[abortCapture, expanded\]\)\)/);
  assert.doesNotMatch(source, /raf = requestAnimationFrame\(onFrame\)/);
});

/** Simulated RN lifecycle, not a device measurement or physical UI FPS test. */
function focusedHudHarness(android: boolean, initial: string | null = "active") {
  const f = fakeHud();
  const visibility = new NativeResidentAppVisibility(initial, android);
  const change = new Set<(state: string) => void>();
  const blur = new Set<() => void>();
  const focus = new Set<() => void>();
  let leases = 0;
  let released = 0;
  let invalidations = 0;
  let foreground = visibility.foreground;
  const sampling = new NativeResidentSamplingLifecycle(
    () => ++leases,
    () => { released++; }
  );
  sampling.setForeground(foreground);
  f.frameLoop.start(foreground);
  const stop = observeNativeResidentAppVisibility(visibility, {
    onChange: cb => { change.add(cb); return () => { change.delete(cb); }; },
    onBlur: cb => { blur.add(cb); return () => { blur.delete(cb); }; },
    onFocus: cb => { focus.add(cb); return () => { focus.delete(cb); }; }
  }, next => {
    if (next === foreground) return;
    foreground = next;
    sampling.setForeground(next);
    f.frameLoop.setForeground(next);
    if (!next) invalidations++;
  });
  return {
    f, visibility,
    get foreground() { return foreground; },
    get leases() { return leases; },
    get released() { return released; },
    get invalidations() { return invalidations; },
    get listeners() { return [change.size, blur.size, focus.size]; },
    change: (state: string) => { for (const cb of [...change]) cb(state); },
    blur: () => { for (const cb of [...blur]) cb(); },
    focus: () => { for (const cb of [...focus]) cb(); },
    dispose: () => { stop(); f.frameLoop.stop(); sampling.dispose(); }
  };
}

test("Android shade blur stops opt-in HUD RAF, releases sampling and invalidates A/B window", () => {
  const h = focusedHudHarness(true);
  assert.deepEqual(h.listeners, [1, 1, 1]);
  assert.equal(h.f.outstanding.size, 1);
  h.f.tick(16);
  const before = h.f.delivered;
  h.blur(); // Android may keep AppState 'active' under notification shade.
  assert.equal(h.foreground, false);
  assert.equal(h.invalidations, 1);
  assert.equal(h.released, 1);
  assert.equal(h.f.outstanding.size, 0);
  h.f.drainCanceled(); // stale OS RAF must never publish a mixed frame.
  assert.equal(h.f.delivered, before);
  h.change("active"); // duplicate active must not bypass the focus gate.
  assert.equal(h.f.outstanding.size, 0);
  assert.equal(h.invalidations, 1);
  h.focus();
  assert.equal(h.foreground, true);
  assert.equal(h.leases, 2);
  assert.equal(h.f.outstanding.size, 1);
  h.f.tick(120_000);
  assert.equal(h.f.delivered, before + 1); // no catch-up RAF burst
  h.dispose();
  assert.deepEqual(h.listeners, [0, 0, 0]);
  assert.equal(h.f.outstanding.size, 0);
  assert.equal(h.released, 2);
});

test("iOS HUD follows inactive/background/active but never installs Android blur observers", () => {
  const h = focusedHudHarness(false);
  assert.deepEqual(h.listeners, [1, 0, 0]);
  h.change("inactive");
  assert.equal(h.f.outstanding.size, 0);
  h.change("background");
  assert.equal(h.invalidations, 1, "duplicate nonforeground event must not invalidate twice");
  h.change("active");
  assert.equal(h.f.outstanding.size, 1);
  assert.equal(h.leases, 2);
  h.dispose();
  assert.deepEqual(h.listeners, [0, 0, 0]);
});

test("200 Android blur/focus cycles never leak HUD RAFs, sampling leases or observers", () => {
  const h = focusedHudHarness(true);
  for (let i = 0; i < 200; i++) {
    h.f.tick(16 * (i + 1));
    h.blur();
    assert.equal(h.f.outstanding.size, 0);
    h.f.drainCanceled();
    h.change("active");
    assert.equal(h.f.outstanding.size, 0);
    h.focus();
    assert.equal(h.f.outstanding.size, 1);
    assert.deepEqual(h.listeners, [1, 1, 1]);
  }
  assert.equal(h.invalidations, 200);
  assert.equal(h.leases, 201);
  assert.equal(h.released, 200);
  h.dispose();
  assert.equal(h.released, 201);
  assert.deepEqual(h.listeners, [0, 0, 0]);
  assert.equal(h.f.outstanding.size, 0);
});

/** Bridge-fault injection is synthetic Node testing, never a phone FPS measurement. */
test("HUD request failure fails closed and does not retry on duplicate foreground events", () => {
  let attempts = 0;
  const faults: unknown[] = [];
  const loop = new NativeHudFrameLoop(
    () => { attempts++; throw 0; },
    () => assert.fail("no RAF ID was issued"),
    () => assert.fail("no frame should be delivered"),
    error => faults.push(error)
  );
  loop.start();
  assert.deepEqual(faults, [0], "even a falsy native bridge error is reported");
  assert.deepEqual(loop.snapshot(), {
    active: false, foreground: false, scheduled: false, delivered: 0, requested: 1
  });
  loop.setForeground(true);
  loop.start(false);
  loop.setForeground(true); // explicit new session is allowed to try once
  assert.equal(attempts, 2);
  assert.deepEqual(faults, [0, 0]);
  loop.stop();
});

test("HUD frame callback failure retires its RAF generation without affecting other work", () => {
  const callbacks = new Map<number, (at: number) => void>();
  let next = 0;
  let gameplayFrames = 0;
  const faults: unknown[] = [];
  const loop = new NativeHudFrameLoop(
    cb => { callbacks.set(++next, cb); return next; },
    id => { callbacks.delete(id); },
    () => { gameplayFrames++; throw new Error("diagnostic state update failed"); },
    error => faults.push(error)
  );
  loop.start();
  const callback = callbacks.values().next().value!;
  callbacks.clear();
  callback(16);
  assert.equal(gameplayFrames, 1);
  assert.equal(faults.length, 1);
  assert.equal(loop.snapshot().active, false);
  assert.equal(loop.snapshot().scheduled, false);
  callback(32); // queued stale OS delivery must be ignored
  assert.equal(gameplayFrames, 1);
  assert.equal(callbacks.size, 0);
});

test("200 background/resume cycles survive cancel failures and stale RAF deliveries", () => {
  let id = 0;
  let cancelAttempts = 0;
  let deliveries = 0;
  const pending = new Map<number, (at: number) => void>();
  const stale: Array<(at: number) => void> = [];
  const loop = new NativeHudFrameLoop(
    cb => { pending.set(++id, cb); return id; },
    token => {
      const callback = pending.get(token);
      if (callback) stale.push(callback);
      pending.delete(token);
      if (++cancelAttempts % 3 === 0) throw false;
    },
    () => { deliveries++; }
  );
  loop.start();
  for (let cycle = 0; cycle < 200; cycle++) {
    assert.equal(pending.size, 1);
    loop.setForeground(false);
    assert.equal(pending.size, 0);
    for (const callback of stale.splice(0)) callback(cycle * 1000);
    assert.equal(deliveries, 0, "canceled native RAF never mutates diagnostic state");
    loop.setForeground(true);
    assert.equal(pending.size, 1, "resume arms exactly one RAF");
  }
  loop.stop();
  assert.equal(pending.size, 0);
  assert.equal(loop.snapshot().active, false);
  assert.equal(cancelAttempts, 201);
});

test("200 independent HUD sessions recover from intermittent request and frame faults", () => {
  let successes = 0;
  let failures = 0;
  for (let cycle = 0; cycle < 200; cycle++) {
    const pending = new Map<number, (at: number) => void>();
    let id = 0;
    const faults: unknown[] = [];
    const requestFault = cycle % 5 === 0;
    const frameFault = cycle % 7 === 0;
    const loop = new NativeHudFrameLoop(
      cb => {
        if (requestFault) throw new Error("native RAF unavailable");
        pending.set(++id, cb);
        return id;
      },
      token => { pending.delete(token); },
      () => { if (frameFault) throw false; successes++; },
      error => { faults.push(error); failures++; }
    );
    loop.start();
    if (!requestFault) {
      const callback = pending.values().next().value!;
      pending.clear();
      callback(cycle * 16);
    }
    assert.equal(faults.length, requestFault || frameFault ? 1 : 0);
    if (faults.length) {
      assert.equal(loop.snapshot().active, false);
      assert.equal(pending.size, 0);
    } else {
      assert.equal(pending.size, 1);
    }
    loop.stop();
    assert.equal(pending.size, 0);
  }
  assert.ok(successes > 100);
  assert.ok(failures > 40);
});

test("HUD error reporting itself cannot throw into the gameplay RAF callback", () => {
  const loop = new NativeHudFrameLoop(
    () => { throw new Error("RAF"); },
    () => {},
    () => {},
    () => { throw new Error("broken diagnostic error UI"); }
  );
  assert.doesNotThrow(() => loop.start());
  assert.equal(loop.snapshot().active, false);
});
