import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NativeResidentFrameBus } from "../src/performance/nativeResidentFrameBus";
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

test("native-only HUD owns sampling; native renderer and RAF avoid unnecessary hot-path allocations", () => {
  const hud = readFileSync(new URL("../src/performance/NativePerformanceHud.tsx", import.meta.url), "utf8");
  const native = readFileSync(new URL("../src/components/MapWandererCharacter.native.tsx", import.meta.url), "utf8");
  const bus = readFileSync(new URL("../src/performance/nativeResidentFrameBus.ts", import.meta.url), "utf8");
  const web = readFileSync(new URL("../src/components/MapWandererCharacter.tsx", import.meta.url), "utf8");
  assert.match(hud, /const workSamplingLease = beginNativeResidentWorkSampling\(\)/);
  assert.match(hud, /endNativeResidentWorkSampling\(workSamplingLease\)/);
  assert.match(native, /onFrame: __DEV__ \? markNativeResidentFrameCallback : undefined/);
  assert.doesNotMatch(bus, /this\.due \?\? \[\]/);
  assert.doesNotMatch(web, /beginNativeResidentWorkSampling|endNativeResidentWorkSampling/);
  assert.doesNotMatch(native, /AsyncStorage|setOrologioGiocoVelocita\(/);
});
