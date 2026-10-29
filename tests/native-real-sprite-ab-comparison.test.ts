import assert from "node:assert/strict";
import test from "node:test";
import {
  compareNativeRealSpriteABReports,
  parseNativeRealSpriteABReport
} from "../src/performance/nativeRealSpriteABComparison.ts";

function report(options: Partial<{
  platform: string; scene: string; population: number; speed: number;
  samples: number; fps: number; p95: number; lag: number; callbacks: number;
  duration: number; cells: number; duplicate: string;
}> = {}): string {
  const {
    platform = "android", scene = "Sprite abitanti reali in tragitto ripetibile",
    population = 200, speed = 4, samples = 590, fps = 59.1,
    p95 = 17.8, lag = 2.3, callbacks = 700, duration = 10, cells = 400,
    duplicate = ""
  } = options;
  return [
    "MyKingdom - diagnostica prestazioni JS (non GPU/UI FPS)",
    "Piattaforma: " + platform,
    "Scena: " + scene,
    "Elementi: " + population,
    "Velocità simulazione: " + speed + "x",
    "Celle terreno: " + cells,
    "Durata: " + duration + " s",
    "Campioni: " + samples,
    "FPS JS medio: " + fps,
    "Frame medio: 16.9 ms",
    "p95: " + p95 + " ms",
    "Frame oltre 33 ms: 5",
    "Frame oltre 50 ms: 1",
    "Render sprite React: 200",
    "Callback timer residenti: " + callbacks,
    "Batch RAF JS p95: 0.85 ms",
    "Batch timer JS p95: 1.20 ms",
    "Ritardo loop JS p95: " + lag + " ms",
    "Nota: non equivale a FPS del rendering o misura IA completa.",
    duplicate
  ].join("\n");
}

test("compare identical Android 200-resident 4x real-sprite captures and preserve JS-only interpretation", () => {
  const comparison = compareNativeRealSpriteABReports(
    report({ fps: 45.5, p95: 24, lag: 4.2, callbacks: 1000 }),
    report({ fps: 51.5, p95: 20, lag: 3.1, callbacks: 600 })
  );
  assert.equal(comparison.interpretation, "js-only");
  assert.equal(comparison.jsFpsDifference, 6);
  assert.equal(comparison.frameP95DifferenceMs, -4);
  assert.ok(Math.abs(comparison.eventLoopP95DifferenceMs + 1.1) < 1e-9);
  assert.equal(comparison.timerCallbacksDifference, -400);
  assert.equal(comparison.baseline.population, 200);
  assert.equal(comparison.optimized.timeScale, 4);
});

test("same-platform 25/50/100/200 fixture populations and 1x/2x/4x are accepted", () => {
  for (const platform of ["android", "ios"]) {
    for (const population of [25, 50, 100, 200]) {
      for (const speed of [1, 2, 4]) {
        const result = compareNativeRealSpriteABReports(
          report({ platform, population, speed }),
          report({ platform, population, speed })
        );
        assert.equal(result.jsFpsDifference, 0);
      }
    }
  }
});

test("reject mixed device platforms, density, speed, scene and duration", () => {
  const changes = [
    { platform: "ios" }, { population: 100 }, { speed: 2 },
    { scene: "Sprite abitanti reali in movimento" }, { duration: 9 }
  ];
  for (const change of changes) {
    assert.throws(() => compareNativeRealSpriteABReports(report(), report(change)));
  }
});

test("reject synthetic marker baseline and web results", () => {
  assert.throws(() => parseNativeRealSpriteABReport(report({ scene: "Marker animati" })), /marker/i);
  assert.throws(() => parseNativeRealSpriteABReport(report({ platform: "web" })), /Android\/iOS/);
});

test("reject partial, duplicated, corrupted or implausible device samples", () => {
  for (const bad of [
    report({ samples: 0 }),
    report({ samples: 10 }),
    report({ samples: 20000 }),
    report({ fps: -1 }),
    report({ cells: 200 }),
    report({ speed: 0 }),
    report({ duplicate: "Campioni: 200" }),
    report().replace("Batch RAF JS p95: 0.85 ms", ""),
    report().replace("FPS JS medio: 59.1", "FPS JS medio: NaN"),
    report().replace("Frame oltre 50 ms: 1", "Frame oltre 50 ms: 6"),
    report().replace("MyKingdom - diagnostica prestazioni JS (non GPU/UI FPS)", "MyKingdom - GPU 60 FPS")
  ]) assert.throws(() => parseNativeRealSpriteABReport(bad));
});

test("parser never infers GPU/UI FPS or physical touch latency", () => {
  const parsed = parseNativeRealSpriteABReport(report());
  assert.equal("gpuFps" in parsed, false);
  assert.equal("touchLatencyMs" in parsed, false);
  assert.equal(parsed.jsFps, 59.1);
});
