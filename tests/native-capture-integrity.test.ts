import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { nativeCaptureContextChanged, type NativeCaptureContext } from "../src/performance/nativeCaptureIntegrity.ts";
import { NativeMeasurementSession, formatNativeMeasurement } from "../src/performance/nativeMeasurementSession.ts";

const initial: NativeCaptureContext = {
  platform: "android", label: "Marker animati", residents: 200,
  terrainCells: 200, timeScale: 1
};

test("pure capture context stays valid across ticks with no scenario changes", () => {
  for (let frame = 0; frame < 10_000; frame++) {
    assert.equal(nativeCaptureContextChanged(initial, { ...initial }), false);
  }
  assert.equal(nativeCaptureContextChanged(initial, initial), false);
});

test("native benchmark invalidates every dimension that would poison baseline A/B results", () => {
  for (const change of [
    { platform: "ios" }, { label: "Marker fermi" }, { residents: 100 },
    { terrainCells: 199 }, { timeScale: 2 }, { timeScale: 4 },
    { timeScale: 0 }, { timeScale: Number.NaN },
    { residents: Number.NaN }, { residents: -1 }, { residents: 1.5 },
    { terrainCells: -1 }, { terrainCells: 1.5 }
  ]) {
    assert.equal(nativeCaptureContextChanged(initial, { ...initial, ...change }), true,
      "accepted a mixed or invalid scenario: " + JSON.stringify(change));
  }
});

test("absent terrain stays comparable only if it remains absent", () => {
  const noTerrain = { ...initial, terrainCells: undefined };
  assert.equal(nativeCaptureContextChanged(noTerrain, { ...noTerrain }), false);
  assert.equal(nativeCaptureContextChanged(noTerrain, initial), true);
});

test("the native 10-second share report records speed without exposing game state or IDs", () => {
  const session = new NativeMeasurementSession(0, 10_000);
  session.record(16, 16);
  const complete = session.record(10_000, 16)!;
  const text = formatNativeMeasurement(complete, initial);
  assert.match(text, /Velocità simulazione: 1x/);
  assert.match(text, /Scena: Marker animati/);
  assert.match(text, /Elementi: 200/);
  assert.ok(!text.includes("residentId"));
  assert.ok(!text.includes("cellIndex"));
  const legacy = formatNativeMeasurement(complete,
    { platform: "android", label: "Baseline", residents: 200 });
  assert.ok(!legacy.includes("Velocità simulazione"), "legacy report API remains valid");
});

test("HUD only captures in foreground, rejects changing scene and game speed and closes both probes", () => {
  const hud = readFileSync(new URL("../src/performance/NativePerformanceHud.tsx", import.meta.url), "utf8");
  const session = readFileSync(new URL("../src/performance/nativeMeasurementSession.ts", import.meta.url), "utf8");
  assert.match(hud, /nativeCaptureContextChanged\(/);
  assert.match(hud, /getOrologioSimTimeScaleSnapshot\(\)/);
  assert.match(hud, /subscribeOrologioGiocoInPausa\(onClockChange\)/);
  assert.match(hud, /subscribeOrologioGiocoVelocita\(onClockChange\)/);
  assert.match(hud, /React\.useLayoutEffect\(/);
  assert.match(hud, /cancelNativeResidentDispatchCapture\(active\.dispatchToken\)/);
  assert.match(hud, /cancelNativeResidentEventLoopProbe\(active\.lagToken\)/);
  assert.match(hud, /setCaptureWarning\(reason\)/);
  assert.match(hud, /active\.session\.isInvalidated\(\)/);
  assert.match(session, /Velocità simulazione:/);
  assert.ok(!hud.includes("AsyncStorage"), "no diagnostic persistence");
  assert.ok(!hud.includes("fetch("), "no diagnostic upload");
});

test("a >=2-second JS stall invalidates capture instead of disappearing from its p95", () => {
  const session = new NativeMeasurementSession(0, 10_000);
  assert.equal(session.record(16, 16), null);
  assert.equal(session.record(8_000, 1_999), null);
  assert.equal(session.record(10_000, 2_000), null);
  assert.equal(session.isInvalidated(), true);
  assert.equal(session.record(10_016, 16), null, "an incomplete capture must never finish later");
});

test("a normal post-deadline sample is not counted in a valid 10-second capture", () => {
  const session = new NativeMeasurementSession(0, 10_000);
  session.record(16, 16);
  session.record(8_000, 1_999);
  const done = session.record(10_000, 16)!;
  assert.equal(session.isInvalidated(), false);
  assert.equal(done.metrics.samples, 2);
  assert.equal(done.durationMs, 10_000);
});


test("10-second capture ignores first frame interval that started before user pressed Measure", () => {
  const session = new NativeMeasurementSession(5000, 10_000);
  assert.equal(session.record(5001, 120), null, "the first 120ms mostly preceded capture");
  assert.equal(session.isInvalidated(), false);
  assert.equal(session.record(5017, 16), null);
  assert.equal(session.record(5033, 16), null);
  const result = session.record(15000, 16)!;
  assert.equal(result.metrics.samples, 2);
  assert.equal(result.metrics.meanFrameMs, 16);
});

test("pre-start OS suspension is not mislabeled as an in-capture long JS stall", () => {
  const session = new NativeMeasurementSession(5000, 10_000);
  assert.equal(session.record(5001, 2500), null);
  assert.equal(session.isInvalidated(), false);
  assert.equal(session.record(5017, 16), null);
  assert.equal(session.record(7000, 1983), null);
  assert.equal(session.record(15000, 16)?.metrics.samples, 2);
});

test("a >=2s long frame fully inside a capture still invalidates that run", () => {
  const session = new NativeMeasurementSession(5000, 10_000);
  session.record(5016, 16);
  session.record(7016, 2000);
  assert.equal(session.isInvalidated(), true);
  assert.equal(session.record(15000, 16), null);
});

test("strict on-device capture rejects missing RAF intervals, backward samples and invalid deltas", () => {
  const skipped = new NativeMeasurementSession(0, 10_000, true);
  skipped.record(16, 16);
  assert.equal(skipped.record(9000, 16), null);
  assert.equal(skipped.isInvalidated(), true, "a 9s hole cannot become a valid report");
  assert.equal(skipped.record(10_000, 16), null);

  const backwards = new NativeMeasurementSession(0, 10_000, true);
  backwards.record(16, 16);
  backwards.record(16, 16);
  assert.equal(backwards.isInvalidated(), true);

  const invalid = new NativeMeasurementSession(0, 10_000, true);
  invalid.record(16, 16);
  invalid.record(32, Number.NaN);
  assert.equal(invalid.isInvalidated(), true);

  const partial = new NativeMeasurementSession(5000, 10_000, true);
  partial.record(5001, 120); // first interval started before capture
  assert.equal(partial.isInvalidated(), false);
  partial.record(5017, 16);
  assert.equal(partial.isInvalidated(), false);

  const valid = new NativeMeasurementSession(0, 10_000, true);
  for (let timestamp = 16; timestamp < 10_000; timestamp += 16) {
    assert.equal(valid.record(timestamp, 16), null);
  }
  const result = valid.record(10_000, 16);
  assert.equal(valid.isInvalidated(), false);
  assert.ok(result && result.metrics.samples > 600);
  assert.equal(result?.durationMs, 10_000);
  const hud = readFileSync(new URL("../src/performance/NativePerformanceHud.tsx", import.meta.url), "utf8");
  assert.match(hud, /new NativeMeasurementSession\(performance\.now\(\), 10_000, true\)/);
});
