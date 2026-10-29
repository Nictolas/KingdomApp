import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { NativeResidentSpawnSampler } from "../src/performance/nativeResidentSpawnSampler";

/** Synthetic Node cold-mount benchmark, never Android/iOS FPS or native GC. */
const COUNT = 200;
const ROUNDS = 7;
function oldMount(totalCells: number): { checksum: number; allocations: number } {
  const claimed = new Set<number>();
  let checksum = 0, allocations = 0;
  for (let i = 0; i < COUNT; i++) {
    const eligible: number[] = [];
    allocations++;
    for (let cell = 0; cell < totalCells; cell++) {
      if (cell % 17 !== 0 && !claimed.has(cell)) eligible.push(cell);
    }
    if (eligible.length === 0) {
      for (let cell = 0; cell < totalCells; cell++) if (cell % 17 !== 0) eligible.push(cell);
    }
    if (!eligible.length) continue;
    const start = ((10000 + i) * 9973) % eligible.length;
    for (let offset = 0; offset < eligible.length; offset++) {
      const cell = eligible[(start + offset) % eligible.length]!;
      if (!claimed.has(cell)) {
        claimed.add(cell);
        checksum += cell;
        break;
      }
    }
  }
  return { checksum, allocations };
}
function newMount(totalCells: number, sampler: NativeResidentSpawnSampler): { checksum: number; allocations: number } {
  const claimed = new Set<number>();
  let checksum = 0;
  for (let i = 0; i < COUNT; i++) {
    const cell = sampler.pick({
      totalCells, instanceId: 10000 + i,
      isWalkable: c => c % 17 !== 0,
      isCellFreeForMe: c => !claimed.has(c),
      tryClaimCell: c => !claimed.has(c) && (claimed.add(c), true)
    });
    if (cell !== null) checksum += cell;
  }
  return { checksum, allocations: sampler.snapshot().nestedAllocations };
}
function median(values: number[]): number {
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
}
for (const totalCells of [400, 10000, 50000]) {
  const sampler = new NativeResidentSpawnSampler();
  assert.equal(oldMount(totalCells).checksum, newMount(totalCells, sampler).checksum);
  const oldMs: number[] = [], newMs: number[] = [];
  for (let round = 0; round < ROUNDS; round++) {
    const startOld = performance.now();
    const old = oldMount(totalCells);
    oldMs.push(performance.now() - startOld);
    const startNew = performance.now();
    const optimized = newMount(totalCells, sampler);
    newMs.push(performance.now() - startNew);
    assert.equal(old.checksum, optimized.checksum);
    assert.equal(old.allocations, COUNT);
    assert.equal(optimized.allocations, 0);
  }
  console.log(JSON.stringify({
    kind: "synthetic-node-cold-mount", residents: COUNT, cells: totalCells,
    rounds: ROUNDS, oldCandidateArraysPerMount: COUNT,
    newCandidateArraysPerMountAfterWarmup: 0,
    sharedTypedBuffersAcrossRounds: sampler.snapshot().sharedBufferAllocations,
    nestedFallbackAllocations: sampler.snapshot().nestedAllocations,
    medianOldMs: Number(median(oldMs).toFixed(3)),
    medianNewMs: Number(median(newMs).toFixed(3)),
    checksum: oldMount(totalCells).checksum,
    caveat: "Node only; not Android/iOS FPS, UI latency, native memory or GC"
  }));
}
