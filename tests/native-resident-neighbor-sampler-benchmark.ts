/**
 * Synthetic JS microbenchmark ONLY. Not React Native, GPU FPS or on-device data.
 * Compares identical seeded selections at 200 residents, with and without
 * per-attempt neighbor/filter arrays. Never gates CI on timing noise.
 */
import { performance } from "node:perf_hooks";
import { NativeResidentNeighborSampler } from "../src/performance/nativeResidentNeighborSampler.ts";

const population = 200, iterations = 2500;
const sampler = Array.from({ length: population }, () => new NativeResidentNeighborSampler());
const walk = (cell: number) => cell % 13 !== 0;
const free = (cell: number) => cell % 7 !== 0;
const claim = (cell: number) => cell % 11 !== 0;
// Stable RNG function: do not accidentally benchmark 500,000 new closures.
const random = () => 0.4;
function reference(from: number): number | null {
  const col = from % 20, row = Math.floor(from / 20);
  const out: number[] = [];
  if (col > 0) out.push(from - 1);
  if (col < 19) out.push(from + 1);
  if (row > 0) out.push(from - 20);
  if (row < 19) out.push(from + 20);
  const cand = out.filter(cell => walk(cell) && free(cell));
  for (let i = cand.length - 1; i > 0; i--) {
    const j = Math.floor(0.4 * (i + 1));
    const t = cand[i]!;
    cand[i] = cand[j]!;
    cand[j] = t;
  }
  for (const cell of cand) if (claim(cell)) return cell;
  return null;
}
function run(mode: "old" | "buffer", cycles: number): { ms: number; checksum: number } {
  let checksum = 0;
  const start = performance.now();
  for (let tick = 0; tick < cycles; tick++) {
    for (let i = 0; i < population; i++) {
      const from = (i * 41 + tick) % 400;
      const cell = mode === "old" ? reference(from) :
        sampler[i]!.pick(from, 20, 20, walk, free, claim, random);
      checksum += cell ?? -1;
    }
  }
  return { ms: performance.now() - start, checksum };
}
run("old", 100); run("buffer", 100);
// Alternate execution order to reduce warm-cache/JIT bias. Report median of
// five rounds, not a single noisy wall-clock sample; never gate on speed.
const oldTimes: number[] = [], bufferedTimes: number[] = [];
let checksum: number | null = null;
for (let round = 0; round < 5; round++) {
  const order: Array<"old" | "buffer"> = round % 2 ? ["buffer", "old"] : ["old", "buffer"];
  const results = order.map(mode => ({ mode, ...run(mode, iterations) }));
  const old = results.find(x => x.mode === "old")!;
  const optimized = results.find(x => x.mode === "buffer")!;
  if (old.checksum !== optimized.checksum ||
    (checksum !== null && checksum !== old.checksum)) {
    throw new Error("Native neighbor benchmark changed selection semantics");
  }
  checksum = old.checksum;
  oldTimes.push(old.ms);
  bufferedTimes.push(optimized.ms);
}
const median = (values: number[]) => [...values].sort((a, b) => a - b)[2]!;
console.log(JSON.stringify({
  scope: "Node synthetic neighbor selection, not native device FPS",
  residents: population, attemptsPerRound: population * iterations, rounds: 5,
  oldMedianMs: Number(median(oldTimes).toFixed(2)),
  bufferedMedianMs: Number(median(bufferedTimes).toFixed(2)),
  oldRangeMs: [Math.min(...oldTimes), Math.max(...oldTimes)].map(x => Number(x.toFixed(2))),
  bufferedRangeMs: [Math.min(...bufferedTimes), Math.max(...bufferedTimes)].map(x => Number(x.toFixed(2))),
  sourceModelTransientNeighborArraysPerAttempt: { old: 2, buffered: 0 },
  checksum,
  result: "non-gating microbenchmark; no Android/iOS claim"
}));
