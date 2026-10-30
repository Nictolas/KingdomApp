import assert from "node:assert/strict";
import test from "node:test";
import { compareNativeRealSpriteABReplicates } from "../src/performance/nativeRealSpriteABReplicates.ts";

function capture(fps: number, p95: number, platform = "android", population = 200, speed = 4) {
  return [
    "MyKingdom - diagnostica prestazioni JS (non GPU/UI FPS)",
    "Piattaforma: " + platform,
    "Scena: Sprite abitanti reali in tragitto ripetibile",
    "Elementi: " + population,
    "Velocità simulazione: " + speed + "x",
    "Celle terreno: 400",
    "Durata: 10 s",
    "Campioni: 500",
    "FPS JS medio: " + fps,
    "Frame medio: 20 ms",
    "p95: " + p95 + " ms",
    "Frame oltre 33 ms: 10",
    "Frame oltre 50 ms: 2",
    "Render sprite React: 200",
    "Callback timer residenti: 600",
    "Batch RAF JS p95: 1 ms",
    "Batch timer JS p95: 2 ms",
    "Ritardo loop JS p95: 3 ms"
  ].join("\n");
}
function pair(a: number, b: number, p95a = 25, p95b = 20) {
  return { baseline: capture(a, p95a), optimized: capture(b, p95b) };
}
test("median and range of three matched 200-resident runs resist one large outlier", () => {
  const result = compareNativeRealSpriteABReplicates([
    pair(40, 44, 26, 22),
    pair(42, 47, 25, 20),
    pair(40, 95, 30, 5)
  ]);
  assert.equal(result.pairs, 3);
  assert.equal(result.medianJsFpsDifference, 5);
  assert.equal(result.medianFrameP95DifferenceMs, -5);
  assert.deepEqual(result.jsFpsDifferenceRange, [4, 55]);
  assert.deepEqual(result.frameP95DifferenceRangeMs, [-25, -4]);
  assert.equal(result.jsFpsImprovedPairs, 3);
  assert.equal(result.frameP95ImprovedPairs, 3);
  assert.equal(result.interpretation, "js-only-no-causal-claim");
});
test("an even number of captures uses median midpoint, not the mean", () => {
  const result = compareNativeRealSpriteABReplicates([
    pair(40, 41), pair(40, 42), pair(40, 43), pair(40, 100)
  ]);
  assert.equal(result.medianJsFpsDifference, 2.5);
  assert.equal(result.jsFpsImprovedPairs, 4);
});
test("zero or negative JS deltas are not counted as improvements", () => {
  const result = compareNativeRealSpriteABReplicates([
    pair(50, 50, 20, 20), pair(50, 48, 20, 22), pair(50, 52, 20, 19)
  ]);
  assert.equal(result.jsFpsImprovedPairs, 1);
  assert.equal(result.frameP95ImprovedPairs, 1);
  assert.equal(result.medianJsFpsDifference, 0);
});
test("reject incomplete sets, excess samples and invalid reports", () => {
  assert.throws(() => compareNativeRealSpriteABReplicates([]), /3 a 30/);
  assert.throws(() => compareNativeRealSpriteABReplicates([pair(40, 44)]), /3 a 30/);
  assert.throws(() => compareNativeRealSpriteABReplicates(Array.from({ length: 31 }, () => pair(40, 44))), /3 a 30/);
  assert.throws(() => compareNativeRealSpriteABReplicates([
    pair(40, 44), pair(40, 44), { baseline: capture(40, 25), optimized: "bad" }
  ]), /report diagnostico/);
});
test("reject a mixture of devices, populations and simulation speeds across repeats", () => {
  for (const variant of [capture(40, 25, "ios"), capture(40, 25, "android", 100), capture(40, 25, "android", 200, 2)]) {
    assert.throws(() => compareNativeRealSpriteABReplicates([
      pair(40, 44), pair(40, 44), { baseline: variant, optimized: variant }
    ]), /stessa scena/);
  }
});
test("all 24 platform/population/speed combinations support three repeated A/B captures", () => {
  for (const platform of ["android", "ios"]) {
    for (const population of [25, 50, 100, 200]) {
      for (const speed of [1, 2, 4]) {
        const baseline = capture(40, 25, platform, population, speed);
        const optimized = capture(45, 20, platform, population, speed);
        const result = compareNativeRealSpriteABReplicates(
          Array.from({ length: 3 }, () => ({ baseline, optimized }))
        );
        assert.equal(result.pairs, 3);
        assert.equal(result.medianJsFpsDifference, 5);
      }
    }
  }
});
