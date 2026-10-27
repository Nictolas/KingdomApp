import assert from "node:assert/strict";
import test from "node:test";

import { NativeFrameWindow } from "../src/performance/nativeFrameMetrics.ts";
import { NativeMeasurementSession, formatNativeMeasurement } from "../src/performance/nativeMeasurementSession.ts";
import { NATIVE_TEST_POPULATIONS, createNativeSyntheticMarkers } from "../src/performance/nativePopulationFixture.ts";

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
