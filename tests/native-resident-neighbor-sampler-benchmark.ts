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
        sampler[i]!.pick(from, 20, 20, walk, free, claim, () => 0.4);
      checksum += cell ?? -1;
    }
  }
  return { ms: performance.now() - start, checksum };
}
run("old", 100); run("buffer", 100);
const old = run("old", iterations);
const optimized = run("buffer", iterations);
if (old.checksum !== optimized.checksum) throw new Error("Native neighbor benchmark changed selection semantics");
console.log(JSON.stringify({
  scope: "Node synthetic neighbor selection, not native device FPS",
  residents: population, attempts: population * iterations,
  oldMs: Number(old.ms.toFixed(2)), bufferedMs: Number(optimized.ms.toFixed(2)),
  checksum: old.checksum,
  result: "non-gating microbenchmark; no Android/iOS claim"
}));
