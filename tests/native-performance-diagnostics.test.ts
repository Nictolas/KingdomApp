import assert from "node:assert/strict";
import test from "node:test";

import { NativeFrameWindow } from "../src/performance/nativeFrameMetrics.ts";
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
