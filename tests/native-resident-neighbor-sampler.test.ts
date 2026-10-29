import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NativeResidentNeighborSampler } from "../src/performance/nativeResidentNeighborSampler.ts";

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** Exact pre-optimization reference, including two transient arrays. */
function oldPick(
  from: number, cols: number, rows: number,
  walk: (cell: number) => boolean,
  free: ((cell: number) => boolean) | undefined,
  claim: ((cell: number) => boolean) | undefined,
  random: () => number
): number | null {
  const c = from % cols, r = Math.floor(from / cols);
  const out: number[] = [];
  if (c > 0) out.push(from - 1);
  if (c < cols - 1) out.push(from + 1);
  if (r > 0) out.push(from - cols);
  if (r < rows - 1) out.push(from + cols);
  const cand = out.filter(cell => walk(cell) && (free?.(cell) ?? true));
  for (let i = cand.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = cand[i]!;
    cand[i] = cand[j]!;
    cand[j] = tmp;
  }
  for (const cell of cand) if (!claim || claim(cell)) return cell;
  return null;
}

test("native picker preserves old left/right/up/down and seeded shuffle across all 400 cells", () => {
  const picker = new NativeResidentNeighborSampler();
  for (const from of Array.from({ length: 400 }, (_, i) => i)) {
    for (const seed of [1, 19, 4096]) {
      const walk = (cell: number) => cell % 7 !== 0;
      const free = (cell: number) => cell % 5 !== 0;
      const claim = (cell: number) => cell % 11 !== 0;
      const oldRandom = seeded(seed * 400 + from);
      const newRandom = seeded(seed * 400 + from);
      assert.equal(picker.pick(from, 20, 20, walk, free, claim, newRandom),
        oldPick(from, 20, 20, walk, free, claim, oldRandom),
        "cell " + from + " seed " + seed);
      assert.equal(newRandom(), oldRandom(), "RNG consumption must match");
    }
  }
});

test("200 residents × 1200 route attempts at 1x/2x/4x: exact legacy selection and claims", () => {
  for (const speed of [1, 2, 4]) {
    const samplers = Array.from({ length: 200 }, () => new NativeResidentNeighborSampler());
    const oldRng = Array.from({ length: 200 }, (_, i) => seeded(1000 + i + speed * 10000));
    const newRng = Array.from({ length: 200 }, (_, i) => seeded(1000 + i + speed * 10000));
    let claimsOld = 0, claimsNew = 0;
    for (let tick = 0; tick < 1200; tick++) {
      for (let resident = 0; resident < 200; resident++) {
        const from = (resident * 41 + tick * speed) % 400;
        const walk = (cell: number) => (cell + tick) % 13 !== 0;
        const free = (cell: number) => (cell + resident * 3 + tick) % 9 !== 0;
        const oldClaim = (cell: number) => { claimsOld++; return (cell + resident + tick) % 4 !== 0; };
        const newClaim = (cell: number) => { claimsNew++; return (cell + resident + tick) % 4 !== 0; };
        assert.equal(samplers[resident]!.pick(from, 20, 20, walk, free, newClaim, newRng[resident]!),
          oldPick(from, 20, 20, walk, free, oldClaim, oldRng[resident]!));
      }
    }
    assert.equal(claimsNew, claimsOld, "identical atomic-claim attempts at " + speed + "x");
  }
});

test("all blocked, zero walkable, boundary and optional occupancy preserve behavior", () => {
  const picker = new NativeResidentNeighborSampler();
  let draws = 0, claims = 0;
  const random = () => { draws++; return 0.25; };
  assert.equal(picker.pick(0, 20, 20, () => false, undefined, undefined, random), null);
  assert.equal(draws, 0);
  assert.equal(picker.pick(399, 20, 20, () => true, () => false, undefined, random), null);
  assert.equal(draws, 0);
  assert.equal(picker.pick(0, 20, 20, () => true, undefined,
    () => { claims++; return false; }, random), null);
  assert.equal(claims, 2, "corner has exactly two candidate claims");
  assert.equal(picker.pick(0, 20, 20, cell => cell === 1), 1);
});

test("reentrant occupancy predicate cannot overwrite an outer resident scratch buffer", () => {
  const picker = new NativeResidentNeighborSampler();
  let nested = false;
  const actual = picker.pick(21, 20, 20, cell => {
    if (!nested) {
      nested = true;
      assert.equal(picker.pick(399, 20, 20, c => c === 398), 398);
    }
    return cell !== 1;
  }, undefined, undefined, () => 0.999);
  assert.equal(actual, oldPick(21, 20, 20, cell => cell !== 1, undefined, undefined, () => 0.999));
});

test("a throwing claim releases the scratch buffer for subsequent calls", () => {
  const picker = new NativeResidentNeighborSampler();
  assert.throws(() => picker.pick(21, 20, 20, () => true, undefined,
    () => { throw new Error("claim failed"); }), /claim failed/);
  assert.equal(picker.pick(0, 20, 20, cell => cell === 1), 1);
});

test("native renderer uses the sampler; web remains independent and unchanged", () => {
  const native = readFileSync(new URL("../src/components/MapWandererCharacter.native.tsx", import.meta.url), "utf8");
  const web = readFileSync(new URL("../src/components/MapWandererCharacter.tsx", import.meta.url), "utf8");
  assert.match(native, /new NativeResidentNeighborSampler\(\)/);
  assert.match(native, /neighborSampler\.pick\(/);
  assert.doesNotMatch(native, /orthogonalNeighbors\(/);
  assert.doesNotMatch(web, /NativeResidentNeighborSampler/);
});
