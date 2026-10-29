import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus";
import { NativeResidentSamplingLifecycle } from "../src/performance/nativeResidentSamplingLifecycle";
import {
  beginNativeResidentWorkSampling, endNativeResidentWorkSampling,
  markNativeResidentFrameCallback, markNativeResidentRenderInvocation,
  markNativeResidentWrapperInvocation, markNativeResidentBusCycle,
  takeNativeResidentFrameCallbacks, takeNativeResidentRenderInvocations,
  takeNativeResidentWrapperInvocations, takeNativeResidentBusCycles,
  getNativeResidentRenderTotals, diffNativeResidentRenderTotals
} from "../src/performance/nativeResidentWorkCounters";

const clearIntervals = () => {
  takeNativeResidentFrameCallbacks();
  takeNativeResidentRenderInvocations();
  takeNativeResidentWrapperInvocations();
  takeNativeResidentBusCycles();
};

test("unfocused/closed HUD leaves resident counters inert even under 200 × 240 events", () => {
  clearIntervals();
  const before = getNativeResidentRenderTotals();
  for (let i = 0; i < 200 * 240; i++) {
    markNativeResidentFrameCallback();
    markNativeResidentRenderInvocation();
    markNativeResidentWrapperInvocation();
    markNativeResidentBusCycle();
  }
  assert.equal(takeNativeResidentFrameCallbacks(), 0);
  assert.equal(takeNativeResidentRenderInvocations(), 0);
  assert.equal(takeNativeResidentWrapperInvocations(), 0);
  assert.equal(takeNativeResidentBusCycles(), 0);
  assert.deepEqual(getNativeResidentRenderTotals(), before);
});

test("lease ownership, stale cleanup, cumulative snapshots and per-second resets", () => {
  clearIntervals();
  const before = getNativeResidentRenderTotals();
  const older = beginNativeResidentWorkSampling();
  const newer = beginNativeResidentWorkSampling();
  for (let i = 0; i < 200 * 240; i++) markNativeResidentFrameCallback();
  for (let i = 0; i < 200; i++) {
    markNativeResidentRenderInvocation();
    markNativeResidentWrapperInvocation();
  }
  for (let i = 0; i < 240; i++) markNativeResidentBusCycle();
  endNativeResidentWorkSampling(older);
  endNativeResidentWorkSampling(older); // obsolete cleanup cannot close newer
  markNativeResidentFrameCallback();
  assert.equal(takeNativeResidentFrameCallbacks(), 200 * 240 + 1);
  assert.equal(takeNativeResidentRenderInvocations(), 200);
  assert.equal(takeNativeResidentWrapperInvocations(), 200);
  assert.equal(takeNativeResidentBusCycles(), 240);
  assert.deepEqual(diffNativeResidentRenderTotals(before, getNativeResidentRenderTotals(), 10000), {
    wrappers: 200, bodies: 200, wrappersPerSecond: 20, bodiesPerSecond: 20
  });
  markNativeResidentFrameCallback();
  endNativeResidentWorkSampling(newer);
  assert.equal(takeNativeResidentFrameCallbacks(), 0, "closed HUD discards partial interval");
  const after = getNativeResidentRenderTotals();
  markNativeResidentRenderInvocation();
  markNativeResidentWrapperInvocation();
  assert.deepEqual(getNativeResidentRenderTotals(), after);
  endNativeResidentWorkSampling(newer); // idempotent
  const reopened = beginNativeResidentWorkSampling();
  markNativeResidentFrameCallback();
  assert.equal(takeNativeResidentFrameCallbacks(), 1);
  endNativeResidentWorkSampling(reopened);
});

test("real frame bus: 200 persistent subscribers across closed/open/closed HUD epochs", () => {
  clearIntervals();
  const scheduled = new Map<number, (timestamp: number) => void>();
  let nextId = 1;
  const bus = new NativeResidentFrameBus(
    callback => {
      const id = nextId++;
      scheduled.set(id, callback);
      return id;
    },
    id => { scheduled.delete(id); }
  );
  const subscriptions = Array.from({ length: 200 }, () =>
    bus.subscribeFrame(() => markNativeResidentFrameCallback())
  );
  const tick = (timestamp: number) => {
    assert.equal(scheduled.size, 1, "one platform RAF, never 200");
    const [id, callback] = scheduled.entries().next().value!;
    scheduled.delete(id);
    callback(timestamp);
  };
  for (let i = 0; i < 240; i++) tick(i * 16);
  assert.equal(takeNativeResidentFrameCallbacks(), 0);
  const token = beginNativeResidentWorkSampling();
  for (let i = 0; i < 240; i++) tick((i + 240) * 16);
  assert.equal(takeNativeResidentFrameCallbacks(), 48_000);
  endNativeResidentWorkSampling(token);
  for (let i = 0; i < 240; i++) tick((i + 480) * 16);
  assert.equal(takeNativeResidentFrameCallbacks(), 0);
  assert.equal(bus.snapshot().continuousSubscribers, 200);
  subscriptions.forEach(id => bus.cancel(id));
  assert.equal(scheduled.size, 0);
  assert.equal(bus.snapshot().continuousSubscribers, 0);
});

test("200-resident diagnostics stop in background and restart without stale samples", () => {
  clearIntervals();
  const before = getNativeResidentRenderTotals();
  const lifecycle = new NativeResidentSamplingLifecycle(beginNativeResidentWorkSampling, endNativeResidentWorkSampling);
  lifecycle.setForeground(true);
  lifecycle.setForeground(true);
  for (let i = 0; i < 200 * 240; i++) markNativeResidentFrameCallback();
  for (let i = 0; i < 200; i++) {
    markNativeResidentRenderInvocation();
    markNativeResidentWrapperInvocation();
  }
  assert.equal(takeNativeResidentFrameCallbacks(), 48_000);
  lifecycle.setForeground(false); // inactive
  lifecycle.setForeground(false); // background
  for (let i = 0; i < 200 * 240; i++) {
    markNativeResidentFrameCallback();
    markNativeResidentRenderInvocation();
    markNativeResidentWrapperInvocation();
  }
  assert.equal(takeNativeResidentFrameCallbacks(), 0);
  assert.equal(takeNativeResidentRenderInvocations(), 0);
  assert.equal(takeNativeResidentWrapperInvocations(), 0);
  assert.deepEqual(diffNativeResidentRenderTotals(before, getNativeResidentRenderTotals(), 10_000),
    { wrappers: 200, bodies: 200, wrappersPerSecond: 20, bodiesPerSecond: 20 });
  lifecycle.setForeground(true);
  for (let i = 0; i < 200; i++) markNativeResidentFrameCallback();
  assert.equal(takeNativeResidentFrameCallbacks(), 200);
  lifecycle.dispose();
  lifecycle.dispose();
  lifecycle.setForeground(true); // disposed screen cannot reopen sampling
  markNativeResidentFrameCallback();
  assert.equal(takeNativeResidentFrameCallbacks(), 0);
});

test("overlapping HUDs and 200 background/foreground cycles preserve lease ownership", () => {
  clearIntervals();
  const stale = new NativeResidentSamplingLifecycle(beginNativeResidentWorkSampling, endNativeResidentWorkSampling);
  const current = new NativeResidentSamplingLifecycle(beginNativeResidentWorkSampling, endNativeResidentWorkSampling);
  stale.setForeground(true);
  current.setForeground(true);
  stale.dispose();
  markNativeResidentFrameCallback();
  assert.equal(takeNativeResidentFrameCallbacks(), 1, "old HUD cannot disable current HUD");
  for (let cycle = 0; cycle < 200; cycle++) {
    current.setForeground(false);
    for (let resident = 0; resident < 200; resident++) markNativeResidentFrameCallback();
    assert.equal(takeNativeResidentFrameCallbacks(), 0);
    current.setForeground(true);
    for (let resident = 0; resident < 200; resident++) markNativeResidentFrameCallback();
    assert.equal(takeNativeResidentFrameCallbacks(), 200);
  }
  current.dispose();
  markNativeResidentFrameCallback();
  assert.equal(takeNativeResidentFrameCallbacks(), 0);
});


test("lifecycle lease transitions are exactly-once even under duplicate AppState notifications", () => {
  let next = 0;
  const active = new Set<number>();
  const begun: number[] = [];
  const ended: number[] = [];
  const owner = new NativeResidentSamplingLifecycle(
    () => { const token = next++; active.add(token); begun.push(token); return token; },
    token => { assert.ok(active.delete(token), "cannot end an unowned lease twice"); ended.push(token); }
  );
  owner.setForeground(false);
  owner.setForeground(true);
  owner.setForeground(true);
  assert.deepEqual(begun, [0], "token zero is a valid lease and foreground is idempotent");
  owner.setForeground(false);
  owner.setForeground(false);
  assert.deepEqual(ended, [0], "inactive/background must release only once");
  owner.setForeground(true);
  assert.deepEqual(begun, [0, 1], "resume must own a new lease, not reuse a stale token");
  owner.dispose();
  owner.dispose();
  owner.setForeground(true);
  assert.deepEqual(ended, [0, 1]);
  assert.equal(active.size, 0);
});

test("200 real frame-bus subscriptions stay intact across background/resume without diagnostic work", () => {
  clearIntervals();
  const scheduled = new Map<number, (timestamp: number) => void>();
  let id = 1;
  const bus = new NativeResidentFrameBus(
    callback => { const token = id++; scheduled.set(token, callback); return token; },
    token => { scheduled.delete(token); }
  );
  let actualResidentFrames = 0;
  const subscriptions = Array.from({ length: 200 }, () =>
    bus.subscribeFrame(() => {
      actualResidentFrames++;
      markNativeResidentFrameCallback();
    })
  );
  const owner = new NativeResidentSamplingLifecycle(
    beginNativeResidentWorkSampling, endNativeResidentWorkSampling
  );
  const runFrames = (start: number) => {
    for (let frame = 0; frame < 240; frame++) {
      assert.equal(scheduled.size, 1, "one platform RAF for all 200 residents");
      const [token, callback] = scheduled.entries().next().value!;
      scheduled.delete(token);
      callback((start + frame) * 16);
    }
  };
  owner.setForeground(true);
  runFrames(0);
  assert.equal(takeNativeResidentFrameCallbacks(), 48_000);
  owner.setForeground(false); // background: the game bus still moves, HUD work stops
  runFrames(240);
  assert.equal(takeNativeResidentFrameCallbacks(), 0);
  assert.equal(bus.snapshot().continuousSubscribers, 200);
  owner.setForeground(true); // foreground: capture begins with a fresh interval
  runFrames(480);
  assert.equal(takeNativeResidentFrameCallbacks(), 48_000);
  assert.equal(actualResidentFrames, 144_000, "diagnostic sampling must not modify movement scheduling");
  owner.dispose();
  subscriptions.forEach(subscription => bus.cancel(subscription));
  assert.equal(bus.snapshot().continuousSubscribers, 0);
  assert.equal(scheduled.size, 0);
});

test("native-only HUD owns sampling; native renderer and RAF avoid unnecessary hot-path allocations", () => {
  const hud = readFileSync(new URL("../src/performance/NativePerformanceHud.tsx", import.meta.url), "utf8");
  const native = readFileSync(new URL("../src/components/MapWandererCharacter.native.tsx", import.meta.url), "utf8");
  const bus = readFileSync(new URL("../src/performance/nativeResidentFrameBus.ts", import.meta.url), "utf8");
  const web = readFileSync(new URL("../src/components/MapWandererCharacter.tsx", import.meta.url), "utf8");
  assert.match(hud, /new NativeResidentSamplingLifecycle/);
  assert.match(hud, /samplingLifecycle\.setForeground\(nextState === "active"\)/);
  assert.match(hud, /samplingLifecycle\.dispose\(\)/);
  assert.match(native, /onFrame: __DEV__ \? markNativeResidentFrameCallback : undefined/);
  assert.doesNotMatch(bus, /this\.due \?\? \[\]/);
  assert.doesNotMatch(web, /beginNativeResidentWorkSampling|endNativeResidentWorkSampling/);
  assert.doesNotMatch(native, /AsyncStorage|setOrologioGiocoVelocita\(/);
});
