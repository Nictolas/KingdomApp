import assert from "node:assert/strict";
import test from "node:test";
import { NativeMeasurementSession, formatNativeMeasurement } from "../src/performance/nativeMeasurementSession.ts";

/**
 * Pure fake-RAF diagnostics, not mobile UI/GPU FPS. The HUD supplies both
 * timestamp and interval from the same real requestAnimationFrame callback.
 */
test("an initial 9-second blind spot must not masquerade as a 10-second A/B capture", () => {
  const session = new NativeMeasurementSession(0, 10_000, true);
  assert.equal(session.record(9_000, 16), null);
  assert.equal(session.isInvalidated(), true);
  assert.equal(session.record(9_016, 16), null);
  assert.equal(session.record(10_000, 16), null);
});

test("a first callback exactly two seconds late fails, but normal initial HUD activation is allowed", () => {
  const late = new NativeMeasurementSession(100, 10_000, true);
  assert.equal(late.record(2_100, 16), null);
  assert.equal(late.isInvalidated(), true);

  const good = new NativeMeasurementSession(100, 100, true);
  assert.equal(good.record(105, 16), null, "interval crossing start is discarded");
  assert.equal(good.record(121, 16), null);
  assert.equal(good.record(137, 16), null);
  const completed = good.record(201, 64);
  assert.ok(completed);
  assert.equal(completed.metrics.samples, 2, "deadline interval excluded");
  assert.equal(good.isInvalidated(), false);
});

test("missing frames hidden behind a small reported interval invalidate, even below two seconds", () => {
  for (const missing of [40, 250, 1_500]) {
    const session = new NativeMeasurementSession(0, 10_000, true);
    session.record(16, 16);
    assert.equal(session.record(16 + missing, 16), null);
    assert.equal(session.isInvalidated(), true, `hidden ${missing} ms must not bias p95`);
  }
});

test("true 60-ms jank remains measurable, rather than being mistaken for missing callbacks", () => {
  const session = new NativeMeasurementSession(0, 160, true);
  session.record(16, 16);
  session.record(76, 60);
  session.record(92, 16);
  session.record(108, 16);
  session.record(124, 16);
  session.record(140, 16);
  const result = session.record(172, 32)!;
  assert.ok(result);
  assert.equal(result.metrics.samples, 6);
  assert.equal(result.metrics.p95FrameMs, 60);
  assert.equal(result.metrics.framesOver50Ms, 1);
  assert.equal(session.isInvalidated(), false);
});

test("invalid deltas, repeated timestamps and negative/zero frame intervals fail closed", () => {
  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
    const session = new NativeMeasurementSession(0, 10_000, true);
    assert.equal(session.record(16, bad), null);
    assert.equal(session.isInvalidated(), true);
  }
  const repeated = new NativeMeasurementSession(0, 10_000, true);
  repeated.record(16, 16);
  repeated.record(16, 16);
  assert.equal(repeated.isInvalidated(), true);
  const backward = new NativeMeasurementSession(0, 10_000, true);
  backward.record(16, 16);
  backward.record(15, 16);
  assert.equal(backward.isInvalidated(), true);
});

test("strict measurement never shares a zero-frame report", () => {
  const zero = new NativeMeasurementSession(0, 100, true);
  assert.equal(zero.record(100, 100), null);
  assert.equal(zero.isInvalidated(), true);
  const none = new NativeMeasurementSession(0, 10_000, true);
  assert.equal(none.record(10_000, 16), null);
  assert.equal(none.isInvalidated(), true);
});

test("200 resident simulated work, 250 consecutive 40-ms RAF intervals, three speed metadata labels", () => {
  for (const speed of [1, 2, 4]) {
    const session = new NativeMeasurementSession(0, 10_000, true);
    const residentUpdates = Array<number>(200).fill(0);
    let result: ReturnType<NativeMeasurementSession["record"]> = null;
    for (let frame = 1; frame <= 250; frame++) {
      for (let id = 0; id < 200; id++) residentUpdates[id]!++;
      result = session.record(frame * 40, 40);
      assert.equal(session.isInvalidated(), false);
      if (frame < 250) assert.equal(result, null);
    }
    assert.ok(result);
    assert.equal(result.durationMs, 10_000);
    assert.equal(result.metrics.samples, 249);
    assert.equal(result.metrics.p95FrameMs, 40);
    assert.ok(residentUpdates.every(count => count === 250));
    const report = formatNativeMeasurement(result, {
      platform: "ios", label: "Fixture real sprite A/B", residents: 200, timeScale: speed
    });
    assert.match(report, new RegExp(`Velocità simulazione: ${speed}x`));
    assert.match(report, /Campioni: 249/);
    assert.match(report, /Elementi: 200/);
    assert.ok(!report.includes("residentId"));
  }
});

test("ordinary non-strict callers retain their historical permissive behavior", () => {
  const session = new NativeMeasurementSession(0, 10_000);
  session.record(9_000, 16);
  session.record(9_016, 16);
  const done = session.record(10_000, 984)!;
  assert.ok(done, "strict A/B guards must not silently alter other callers");
  assert.equal(session.isInvalidated(), false);
});
