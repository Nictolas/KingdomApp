import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { NativeHudFrameLoop } from "../src/performance/nativeHudFrameLoop.ts";

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
  assert.match(source, /frameLoop\.start\(AppState\.currentState === "active"\)/);
  assert.match(source, /frameLoop\?\.setForeground\(nextState === "active"\)/);
  assert.match(source, /frameLoop\?\.stop\(\)/);
  assert.match(source, /\}, \[abortCapture, expanded\]\)\)/);
  assert.doesNotMatch(source, /raf = requestAnimationFrame\(onFrame\)/);
});
