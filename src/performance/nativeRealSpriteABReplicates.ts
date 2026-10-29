import {
  compareNativeRealSpriteABReports,
  type NativeRealSpriteABComparison
} from "./nativeRealSpriteABComparison";

/**
 * Analysis of three or more independent, matched 10-second device captures.
 * JS-only metrics: no GPU/UI FPS, physical touch latency or causal claims.
 * No network, persistence, clock reads or device identifiers.
 */
export type NativeRealSpriteABReplicates = Readonly<{
  pairs: number;
  individual: readonly NativeRealSpriteABComparison[];
  medianJsFpsDifference: number;
  medianFrameP95DifferenceMs: number;
  medianEventLoopP95DifferenceMs: number;
  medianTimerCallbacksDifference: number;
  jsFpsImprovedPairs: number;
  frameP95ImprovedPairs: number;
  jsFpsDifferenceRange: readonly [number, number];
  frameP95DifferenceRangeMs: readonly [number, number];
  interpretation: "js-only-no-causal-claim";
}>;

function median(numbers: readonly number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
function range(numbers: readonly number[]): readonly [number, number] {
  return [Math.min(...numbers), Math.max(...numbers)];
}

/**
 * Pair runs by acquisition round, not by sorting outcomes. The caller must
 * collect A/B on the same physical device with comparable thermal conditions.
 * This function can verify report platform and workload, NOT device identity.
 */
export function compareNativeRealSpriteABReplicates(
  pairs: readonly Readonly<{ baseline: string; optimized: string }>[]
): NativeRealSpriteABReplicates {
  if (pairs.length < 3 || pairs.length > 30) {
    throw new Error("Servono da 3 a 30 coppie A/B indipendenti");
  }
  const individual = pairs.map(pair =>
    compareNativeRealSpriteABReports(pair.baseline, pair.optimized)
  );
  const first = individual[0]!.baseline;
  for (const result of individual) {
    for (const report of [result.baseline, result.optimized]) {
      if (report.platform !== first.platform ||
          report.scene !== first.scene ||
          report.population !== first.population ||
          report.timeScale !== first.timeScale ||
          report.terrainCells !== first.terrainCells) {
        throw new Error("Le ripetizioni A/B devono avere la stessa scena, piattaforma, densità e velocità");
      }
    }
  }
  const fps = individual.map(result => result.jsFpsDifference);
  const p95 = individual.map(result => result.frameP95DifferenceMs);
  const lag = individual.map(result => result.eventLoopP95DifferenceMs);
  const timers = individual.map(result => result.timerCallbacksDifference);
  return {
    pairs: pairs.length,
    individual,
    medianJsFpsDifference: median(fps),
    medianFrameP95DifferenceMs: median(p95),
    medianEventLoopP95DifferenceMs: median(lag),
    medianTimerCallbacksDifference: median(timers),
    jsFpsImprovedPairs: fps.filter(value => value > 0).length,
    frameP95ImprovedPairs: p95.filter(value => value < 0).length,
    jsFpsDifferenceRange: range(fps),
    frameP95DifferenceRangeMs: range(p95),
    interpretation: "js-only-no-causal-claim"
  };
}
