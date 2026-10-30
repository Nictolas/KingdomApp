import assert from "node:assert/strict";
import test from "node:test";
import { nativeCaptureHasRequiredProbes } from "../src/performance/nativeCaptureEvidence.ts";
import { NativeResidentDispatchProfiler } from "../src/performance/nativeResidentDispatchProfiler.ts";
import { NativeMeasurementSession, formatNativeMeasurement } from "../src/performance/nativeMeasurementSession.ts";
import type { NativeResidentEventLoopLag } from "../src/performance/nativeResidentEventLoopProbe.ts";

const lag = (samples = 200): NativeResidentEventLoopLag => ({
  samples, observed: samples, dropped: 0, meanMs: 2,
  p95Ms: 5, maxMs: 8, over16Ms: 0, over50Ms: 0
});

test("complete 10-second capture accepts valid probes even with zero resident dispatches", () => {
  const profiler = new NativeResidentDispatchProfiler(() => 0);
  const token = profiler.start();
  const dispatch = profiler.finish(token)!;
  const evidence = lag();
  assert.equal(dispatch.frame.samples, 0);
  assert.equal(nativeCaptureHasRequiredProbes(dispatch, evidence), true);
  const session = new NativeMeasurementSession(0, 10_000, true);
  for (let i = 1; i < 200; i++) assert.equal(session.record(i * 50, 50), null);
  const result = session.record(10_000, 50)!;
  assert.ok(result);
  const report = formatNativeMeasurement(
    result, { platform: "ios", label: "Static A/B scene", residents: 200, timeScale: 1 },
    undefined, undefined, undefined, dispatch, evidence
  );
  assert.match(report, /Ritardo loop JS campioni: 200/);
  assert.match(report, /Batch RAF JS campionati: 0/);
  assert.match(report, /Elementi: 200/);
});

test("a missing probe or zero JS heartbeat samples cannot produce a complete A/B report", () => {
  const profiler = new NativeResidentDispatchProfiler(() => 0);
  const token = profiler.start();
  const report = profiler.finish(token)!;
  assert.equal(nativeCaptureHasRequiredProbes(null, lag()), false);
  assert.equal(nativeCaptureHasRequiredProbes(report, null), false);
  assert.equal(nativeCaptureHasRequiredProbes(report, lag(0)), false);
  assert.equal(nativeCaptureHasRequiredProbes(report, lag(200)), true);
});

test("non-finite or inconsistent lag metrics are rejected rather than exported as valid results", () => {
  const profiler = new NativeResidentDispatchProfiler(() => 0);
  const token = profiler.start();
  const dispatch = profiler.finish(token)!;
  for (const invalid of [
    { ...lag(), p95Ms: NaN },
    { ...lag(), p95Ms: -1 },
    { ...lag(), maxMs: Infinity },
    { ...lag(), maxMs: 1 },
    { ...lag(), samples: -1 },
    { ...lag(), samples: 1.5 }
  ]) assert.equal(nativeCaptureHasRequiredProbes(dispatch, invalid), false);
});

test("1000 capture cycles remain token-isolated and never accept a canceled profiler", () => {
  let now = 0;
  const profiler = new NativeResidentDispatchProfiler(() => now);
  for (let i = 0; i < 1000; i++) {
    const token = profiler.start();
    if (i % 3 === 0) {
      profiler.cancel(token);
      assert.equal(nativeCaptureHasRequiredProbes(profiler.finish(token), lag()), false);
    } else {
      const ticket = profiler.begin("frame");
      now += i % 7;
      profiler.end("frame", ticket);
      assert.equal(nativeCaptureHasRequiredProbes(profiler.finish(token), lag(200)), true);
    }
  }
});
