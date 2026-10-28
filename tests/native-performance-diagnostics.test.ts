import assert from "node:assert/strict";
import test from "node:test";

import { NativeFrameWindow } from "../src/performance/nativeFrameMetrics.ts";
import { NativeMeasurementSession, formatNativeMeasurement } from "../src/performance/nativeMeasurementSession.ts";
import { markNativeResidentFrameCallback, takeNativeResidentFrameCallbacks, markNativeResidentRenderInvocation, takeNativeResidentRenderInvocations, markNativeResidentWrapperInvocation, takeNativeResidentWrapperInvocations, getNativeResidentRenderTotals, diffNativeResidentRenderTotals } from "../src/performance/nativeResidentWorkCounters.ts";
import { NATIVE_TEST_POPULATIONS, createNativeSyntheticMarkers } from "../src/performance/nativePopulationFixture.ts";
import { diffNativeResidentFrameBusSnapshots } from "../src/performance/nativeResidentFrameBusDiagnostics.ts";

test("deterministic synthetic populations have unique coordinates, no game state", () => {
  for (const count of NATIVE_TEST_POPULATIONS) {
    const markers = createNativeSyntheticMarkers(count);
    assert.equal(markers.length, count);
    assert.equal(new Set(markers.map((marker) => marker.id)).size, count);
    assert.equal(new Set(markers.map((marker) => `${marker.col},${marker.row}`)).size, count);
    assert.ok(markers.every((marker) => marker.col >= 0 && marker.col < 20 && marker.row >= 0 && marker.row < 10));
    assert.deepEqual(markers, createNativeSyntheticMarkers(count));
  }
  assert.throws(() => createNativeSyntheticMarkers(201 as never));
});

test("frame metrics yield correct mean FPS and p95 without hiding jank", () => {
  const window = new NativeFrameWindow(10);
  [16, 16, 16, 16, 16, 16, 16, 16, 16, 60].forEach((ms) => window.record(ms));
  const snapshot = window.snapshot();
  assert.equal(snapshot.samples, 10);
  assert.equal(snapshot.meanFrameMs, 20.4);
  assert.equal(snapshot.p95FrameMs, 60);
  assert.ok(Math.abs(snapshot.jsFps - 1000 / 20.4) < 0.001);
  assert.equal(snapshot.framesOver33Ms, 1);
  assert.equal(snapshot.framesOver50Ms, 1);
});

test("frame stats bound history and exclude background gaps", () => {
  const window = new NativeFrameWindow(3);
  [16, 33, 50, 2000, 4000, Number.NaN, -1, 25].forEach((ms) => window.record(ms));
  const snapshot = window.snapshot();
  assert.equal(snapshot.samples, 3);
  assert.equal(snapshot.meanFrameMs, 36);
  assert.equal(snapshot.p95FrameMs, 50);
  window.reset();
  assert.equal(window.snapshot().samples, 0);
  assert.throws(() => new NativeFrameWindow(0));
});

test("10-second capture accepts only frames before deadline, then terminates", () => {
  const capture = new NativeMeasurementSession(1000, 100);
  assert.equal(capture.record(1000, 16), null);
  assert.equal(capture.record(1016, 16), null);
  assert.equal(capture.record(1032, 16), null);
  assert.equal(capture.record(1048, 16), null);
  const result = capture.record(1100, 52);
  assert.ok(result);
  assert.equal(result.durationMs, 100);
  assert.equal(result.metrics.samples, 4);
  assert.equal(result.metrics.meanFrameMs, 16);
  assert.equal(capture.record(1116, 16), null, "completed captures do not restart");
});

test("capture rejects invalid parameters and ignores clock glitches", () => {
  assert.throws(() => new NativeMeasurementSession(NaN));
  assert.throws(() => new NativeMeasurementSession(0, -1));
  const capture = new NativeMeasurementSession(100, 100);
  assert.equal(capture.record(90, 16), null);
  assert.equal(capture.record(Infinity, 16), null);
  assert.equal(capture.record(105, 16), null);
  assert.equal(capture.record(200, 95)?.metrics.samples, 1);
});

test("sharing report contains only aggregate local performance data", () => {
  const capture = new NativeMeasurementSession(0, 100);
  capture.record(16, 16);
  const result = capture.record(100, 84)!;
  const text = formatNativeMeasurement(result, { platform: "ios", label: "Marker fermi", residents: 50, terrainCells: 200 });
  assert.match(text, /iOS|ios/);
  assert.match(text, /Elementi: 50/);
  assert.match(text, /FPS JS medio: 62\.5/);
  assert.match(text, /non equivale a FPS/);
});

test("resident work counters report aggregate callbacks and reset between intervals", () => {
  takeNativeResidentFrameCallbacks();
  markNativeResidentFrameCallback();
  markNativeResidentFrameCallback();
  assert.equal(takeNativeResidentFrameCallbacks(), 2);
  assert.equal(takeNativeResidentFrameCallbacks(), 0);
});

test("resident render counters are aggregate and independently reset", () => {
  takeNativeResidentFrameCallbacks();
  takeNativeResidentRenderInvocations();
  markNativeResidentFrameCallback();
  markNativeResidentRenderInvocation();
  markNativeResidentRenderInvocation();
  assert.equal(takeNativeResidentRenderInvocations(), 2);
  assert.equal(takeNativeResidentRenderInvocations(), 0);
  assert.equal(takeNativeResidentFrameCallbacks(), 1);
});

test("memo effectiveness counters are independent of HUD one-second resets", () => {
  takeNativeResidentWrapperInvocations();
  takeNativeResidentRenderInvocations();
  const start = getNativeResidentRenderTotals();
  for (let i = 0; i < 200; i++) markNativeResidentWrapperInvocation();
  for (let i = 0; i < 12; i++) markNativeResidentRenderInvocation();
  assert.equal(takeNativeResidentWrapperInvocations(), 200);
  assert.equal(takeNativeResidentRenderInvocations(), 12);
  assert.equal(takeNativeResidentWrapperInvocations(), 0);
  assert.equal(takeNativeResidentRenderInvocations(), 0);
  const delta = diffNativeResidentRenderTotals(start, getNativeResidentRenderTotals(), 10_000);
  assert.deepEqual(delta, { wrappers: 200, bodies: 12, wrappersPerSecond: 20, bodiesPerSecond: 1.2 });
  assert.throws(() => diffNativeResidentRenderTotals(start, start, 0));
  assert.throws(() => diffNativeResidentRenderTotals(start, start, Infinity));
});

test("10-second report labels native render invocation rates without claiming GPU measurements", () => {
  const capture = new NativeMeasurementSession(0, 10_000);
  capture.record(16, 16);
  const result = capture.record(10_000, 16)!;
  const report = formatNativeMeasurement(result, { platform: "android", label: "Mappa reale", residents: 200 },
    undefined, { wrappers: 2000, bodies: 40, wrappersPerSecond: 200, bodiesPerSecond: 4 });
  assert.match(report, /Wrapper abitanti: 2000/);
  assert.match(report, /Render sprite React: 40/);
  assert.match(report, /Wrapper abitanti\/s: 200\.0/);
  assert.match(report, /Render sprite React\/s: 4\.0/);
  assert.match(report, /non equivale a FPS/);
});

test("persistent RAF metrics report only aggregate registrations and avoid misleading FPS claims", () => {
  const before = {
    queued: 200, scheduled: true, active: true, dispatchCount: 120,
    activityListeners: 200, continuousSubscribers: 200,
    subscriptionAdds: 200, oneShotRequests: 5
  };
  const after = {
    ...before, dispatchCount: 720, continuousSubscribers: 150,
    queued: 150, subscriptionAdds: 240, oneShotRequests: 8
  };
  const delta = diffNativeResidentFrameBusSnapshots(before, after, 10_000);
  assert.deepEqual(delta, {
    persistentRegistrations: 40,
    oneShotRegistrations: 3,
    platformFrameDispatches: 600,
    persistentRegistrationsPerSecond: 4,
    oneShotRegistrationsPerSecond: 0.3,
    platformFrameDispatchesPerSecond: 60,
    continuousSubscribersAtEnd: 150,
    queuedAtEnd: 150
  });
  const session = new NativeMeasurementSession(0, 10_000);
  session.record(16, 16);
  const result = session.record(10_000, 16)!;
  const report = formatNativeMeasurement(result,
    { platform: "android", label: "200 abitanti", residents: 200 },
    undefined, undefined, delta);
  assert.match(report, /Sottoscrizioni RAF persistenti nuove: 40/);
  assert.match(report, /Registrazioni RAF one-shot nuove: 3/);
  assert.match(report, /Sottoscrizioni RAF persistenti attive: 150/);
  assert.match(report, /non equivale a FPS/);
  assert.ok(!report.includes("residentId"));
  assert.ok(!report.includes("cellIndex"));
  assert.equal(diffNativeResidentFrameBusSnapshots(after, before, 0).persistentRegistrations, 0);
  assert.equal(diffNativeResidentFrameBusSnapshots(after, before, Number.NaN).platformFrameDispatchesPerSecond, 0);
});

test("10-second report exposes measured JS batch costs without claiming GPU FPS or touch latency", () => {
  let now = 0;
  const { NativeResidentDispatchProfiler } = require("../src/performance/nativeResidentDispatchProfiler.ts") as
    typeof import("../src/performance/nativeResidentDispatchProfiler.ts");
  const profiler = new NativeResidentDispatchProfiler(() => now, 8);
  const token = profiler.start();
  for (const ms of [4, 8, 12, 17]) {
    const ticket = profiler.begin("frame");
    now += ms;
    profiler.end("frame", ticket);
  }
  const timer = profiler.begin("timer");
  now += 19;
  profiler.end("timer", timer);
  const result = new NativeMeasurementSession(0, 10_000);
  result.record(16, 16);
  const completed = result.record(10_000, 16)!;
  const text = formatNativeMeasurement(
    completed, { platform: "android", label: "200 residenti", residents: 200 },
    undefined, undefined, undefined, profiler.finish(token)!
  );
  assert.match(text, /Batch RAF JS campionati: 4/);
  assert.match(text, /Batch RAF JS p95: 17\.00 ms/);
  assert.match(text, /Batch timer JS massimo: 19\.00 ms/);
  assert.match(text, /Batch RAF JS >8\/>16 ms: 2\/1/);
  assert.match(text, /NON FPS GPU\/UI, latenza touch o utilizzo CPU/);
  assert.ok(!text.includes("residentId"));
  assert.ok(!text.includes("cellIndex"));
});
