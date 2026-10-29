import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { NativeResidentSpawnSampler } from "../src/performance/nativeResidentSpawnSampler";

// Literal reference behavior from the pre-optimization native renderer.
function referencePick(input: {
  totalCells: number; instanceId: number; preferredSpawnCell?: number | null;
  isWalkable: (cell: number) => boolean;
  isCellFreeForMe?: (cell: number) => boolean;
  tryClaimCell?: (cell: number) => boolean;
}): number | null {
  const { totalCells, instanceId, preferredSpawnCell = null, isWalkable, isCellFreeForMe, tryClaimCell } = input;
  const provaCella = (c: number): boolean => {
    if (c < 0 || c >= totalCells) return false;
    if (!isWalkable(c)) return false;
    if (!(isCellFreeForMe?.(c) ?? true)) return false;
    return !tryClaimCell || tryClaimCell(c);
  };
  let idx: number | null = null;
  if (preferredSpawnCell != null && provaCella(preferredSpawnCell)) idx = preferredSpawnCell;
  else if (preferredSpawnCell != null && isWalkable(preferredSpawnCell)) {
    tryClaimCell?.(preferredSpawnCell);
    idx = preferredSpawnCell;
  }
  if (idx == null) {
    const ok: number[] = [];
    for (let i = 0; i < totalCells; i++) {
      if (isWalkable(i) && (isCellFreeForMe?.(i) ?? true)) ok.push(i);
    }
    if (ok.length === 0) {
      for (let i = 0; i < totalCells; i++) if (isWalkable(i)) ok.push(i);
    }
    if (ok.length === 0) return null;
    const preferred = (instanceId * 9973) % ok.length;
    for (let offset = 0; offset < ok.length; offset++) {
      const candidate = ok[(preferred + offset) % ok.length]!;
      if (!tryClaimCell || tryClaimCell(candidate)) { idx = candidate; break; }
    }
  }
  return idx;
}
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 0x100000000);
}
test("preferred free, shared home and invalid preferred cell preserve exact predicate and claim order", () => {
  const sampler = new NativeResidentSpawnSampler();
  for (const preferredSpawnCell of [null, 0, 17, 399, -1, 401]) {
    for (const blocked of [false, true]) {
      const trace = (pick: typeof referencePick | NativeResidentSpawnSampler["pick"]) => {
        const calls: string[] = [];
        const args = {
          totalCells: 400, instanceId: 10021, preferredSpawnCell,
          isWalkable: (c: number) => { calls.push("w"+c); return c >= 0 && c < 400 && c % 7 !== 0; },
          isCellFreeForMe: (c: number) => { calls.push("f"+c); return !blocked && c % 5 !== 0; },
          tryClaimCell: (c: number) => { calls.push("c"+c); return c % 11 !== 0; }
        };
        return { cell: pick(args), calls };
      };
      assert.deepEqual(trace((x: Parameters<NativeResidentSpawnSampler["pick"]>[0]) => sampler.pick(x)), trace(referencePick));
    }
  }
  assert.equal(sampler.snapshot().depth, 0);
});
test("200 concurrent initial spawns atomically claim 200 distinct cells with one shared buffer", () => {
  const sampler = new NativeResidentSpawnSampler();
  const ownerByCell = new Map<number, number>();
  for (let id = 0; id < 200; id++) {
    const selected = sampler.pick({
      totalCells: 400, instanceId: 10000 + id,
      isWalkable: c => c >= 0 && c < 400,
      isCellFreeForMe: c => !ownerByCell.has(c),
      tryClaimCell: c => { if (ownerByCell.has(c)) return false; ownerByCell.set(c, id); return true; }
    });
    assert.notEqual(selected, null);
    assert.equal(ownerByCell.get(selected!), id);
  }
  assert.equal(ownerByCell.size, 200);
  assert.deepEqual(sampler.snapshot(), {
    selections: 200, nestedAllocations: 0, bufferCapacity: 400,
    sharedBufferAllocations: 1, depth: 0
  });
});
test("seeded parity: 25/50/100/200 residents on 25–10,000 cells with live occupancy", () => {
  for (const size of [25, 50, 100, 200, 400, 10000]) {
    for (const count of [25, 50, 100, 200]) {
      const rng = seeded(size * 1000 + count);
      const blocked = Array.from({ length: size }, () => rng() < 0.18);
      const walkable = Array.from({ length: size }, () => rng() < 0.89);
      const referenceOwners = new Map<number, number>();
      const actualOwners = new Map<number, number>();
      const sampler = new NativeResidentSpawnSampler();
      for (let i = 0; i < count; i++) {
        const preferred = i % 4 === 0 ? (i * 31) % size : null;
        const args = (owners: Map<number, number>) => ({
          totalCells: size, instanceId: i + 10000, preferredSpawnCell: preferred,
          isWalkable: (cell: number) => walkable[cell] === true,
          isCellFreeForMe: (cell: number) => !owners.has(cell),
          tryClaimCell: (cell: number) => {
            if (blocked[cell] || owners.has(cell)) return false;
            owners.set(cell, i);
            return true;
          }
        });
        assert.equal(sampler.pick(args(actualOwners)), referencePick(args(referenceOwners)), "size "+size+" resident "+i);
        assert.deepEqual([...actualOwners], [...referenceOwners]);
      }
      assert.equal(sampler.snapshot().depth, 0);
    }
  }
});
test("fallback, empty walkability and fully rejected claims", () => {
  const sampler = new NativeResidentSpawnSampler();
  assert.equal(sampler.pick({ totalCells: 4, instanceId: 1, isWalkable: c => c === 2, isCellFreeForMe: () => false, tryClaimCell: c => c === 2 }), 2);
  assert.equal(sampler.pick({ totalCells: 4, instanceId: 1, isWalkable: () => false }), null);
  assert.equal(sampler.pick({ totalCells: 4, instanceId: 1, isWalkable: () => true, tryClaimCell: () => false }), null);
});
test("synchronous nested claim cannot corrupt outer selection", () => {
  const sampler = new NativeResidentSpawnSampler();
  let nested: number | null = null, invoked = false;
  const cell = sampler.pick({
    totalCells: 8, instanceId: 0, isWalkable: () => true,
    tryClaimCell: c => {
      if (!invoked) {
        invoked = true;
        nested = sampler.pick({ totalCells: 6, instanceId: 0, isWalkable: x => x !== 0, tryClaimCell: () => true });
      }
      return c === 3;
    }
  });
  assert.equal(cell, 3);
  assert.equal(nested, 1);
  assert.equal(sampler.snapshot().nestedAllocations, 1);
  assert.equal(sampler.snapshot().depth, 0);
});
test("throwing predicate releases scratch; next spawn is still correct", () => {
  const sampler = new NativeResidentSpawnSampler();
  assert.throws(() => sampler.pick({
    totalCells: 400, instanceId: 1,
    isWalkable: c => { if (c === 200) throw Error("test failure"); return true; }
  }), /test failure/);
  assert.deepEqual(sampler.snapshot(), {
    selections: 0, nestedAllocations: 0, bufferCapacity: 400,
    sharedBufferAllocations: 1, depth: 0
  });
  assert.equal(sampler.pick({ totalCells: 400, instanceId: 1, isWalkable: () => true }), 373);
});
test("20 cold-remount rounds of 200 residents do not allocate per resident", () => {
  const sampler = new NativeResidentSpawnSampler();
  for (let round = 0; round < 20; round++) {
    const claims = new Set<number>();
    for (let resident = 0; resident < 200; resident++) {
      const cell = sampler.pick({
        totalCells: 400, instanceId: 10000 + resident,
        isWalkable: c => c % 19 !== 0,
        isCellFreeForMe: c => !claims.has(c),
        tryClaimCell: c => !claims.has(c) && (claims.add(c), true)
      });
      assert.notEqual(cell, null);
    }
    assert.equal(claims.size, 200);
    assert.equal(sampler.snapshot().depth, 0);
  }
  assert.equal(sampler.snapshot().nestedAllocations, 0);
  assert.equal(sampler.snapshot().sharedBufferAllocations, 1);
  assert.equal(sampler.snapshot().selections, 4000);
});
test("only native resident uses shared spawn sampler, web renderer stays unchanged", () => {
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  const native = read("../src/components/MapWandererCharacter.native.tsx");
  const web = read("../src/components/MapWandererCharacter.tsx");
  assert.match(native, /nativeResidentSpawnSampler\.pick\(/);
  assert.ok(!web.includes("nativeResidentSpawnSampler"));
  assert.ok(!web.includes("nativeResidentSpawnSampler.ts"));
});

test("growing a map expands one shared typed buffer, smaller maps reuse it", () => {
  const sampler = new NativeResidentSpawnSampler();
  for (const size of [400, 10000, 25, 10000, 400]) {
    assert.notEqual(sampler.pick({ totalCells: size, instanceId: 0, isWalkable: () => true }), null);
  }
  assert.equal(sampler.snapshot().bufferCapacity, 10000);
  assert.equal(sampler.snapshot().sharedBufferAllocations, 2);
  assert.equal(sampler.snapshot().nestedAllocations, 0);
});
test("fixture residents with preferred free spawn do not need the fallback buffer", () => {
  const sampler = new NativeResidentSpawnSampler();
  for (let i = 0; i < 200; i++) {
    const cell = Math.floor(i * 400 / 200);
    assert.equal(sampler.pick({
      totalCells: 400, instanceId: 10000 + i, preferredSpawnCell: cell,
      isWalkable: () => true, isCellFreeForMe: () => true,
      tryClaimCell: () => true
    }), cell);
  }
  assert.equal(sampler.snapshot().sharedBufferAllocations, 0);
});
