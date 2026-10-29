import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { nativeResidentNeedsTouchRender } from "../src/performance/nativeResidentTouchRenderGate";

test("first mount always renders; unchanged policy does not rerender every cell", () => {
  assert.equal(nativeResidentNeedsTouchRender(null, 0), true);
  assert.equal(nativeResidentNeedsTouchRender(null, 0, () => true), true);
  assert.equal(nativeResidentNeedsTouchRender(0, 1), false);
  assert.equal(nativeResidentNeedsTouchRender(0, 0, () => true), false);
  assert.equal(nativeResidentNeedsTouchRender(0, 1, () => false), false);
  assert.equal(nativeResidentNeedsTouchRender(0, 1, () => true), false);
  const footprint = (cell: number) => cell >= 10 && cell < 20;
  assert.equal(nativeResidentNeedsTouchRender(9, 10, footprint), true);
  assert.equal(nativeResidentNeedsTouchRender(10, 11, footprint), false);
  assert.equal(nativeResidentNeedsTouchRender(19, 20, footprint), true);
});

test("200 residents × 240 native arrivals: touch eligibility matches per-cell baseline", () => {
  const passThrough = (cell: number) => cell % 40 < 3;
  let oldRenders = 0, gatedRenders = 0, eligibilityChanges = 0;
  for (let resident = 0; resident < 200; resident++) {
    const spawn = resident * 2; // 200 nonoverlapping 2-cell horizontal lanes.
    let cell: number | null = null;
    let renderedEligibility: boolean | null = null;
    for (let leg = 0; leg <= 240; leg++) {
      const next = leg % 2 === 0 ? spawn : spawn + 1;
      const mustRender = nativeResidentNeedsTouchRender(cell, next, passThrough);
      if (mustRender) {
        renderedEligibility = passThrough(next);
        gatedRenders++;
      }
      oldRenders++;
      if (cell !== null && passThrough(cell) !== passThrough(next)) eligibilityChanges++;
      assert.equal(renderedEligibility, passThrough(next), "touch policy must never lag behind live cell");
      cell = next;
    }
  }
  assert.equal(oldRenders, 200 * 241);
  assert.equal(gatedRenders, 200 + eligibilityChanges);
  assert.ok(gatedRenders < oldRenders, "pure model must suppress same-policy React commits");
});

test("prop updates after a skipped cell commit evaluate live ref, not stale state", () => {
  const first = (cell: number) => cell === 2;
  const second = (cell: number) => cell === 3;
  assert.equal(nativeResidentNeedsTouchRender(null, 1, first), true);
  assert.equal(nativeResidentNeedsTouchRender(1, 3, first), false);
  // A changed callback is a normal memo prop update. It must evaluate cell 3.
  assert.equal(second(3), true);
  assert.equal(second(1), false);
  const native = readFileSync(new URL("../src/components/MapWandererCharacter.native.tsx", import.meta.url), "utf8");
  assert.match(native, /passTouchesToMapOnCell\(cellRef\.current \?\? logicalCell\)/);
  assert.match(native, /nativeResidentNeedsTouchRender\(previousCell, nextCell, passTouchesRef\.current\)/);
  assert.doesNotMatch(native, /cellRef\.current = logicalCell/);
  assert.equal((native.match(/setLogicalCell\(/g) ?? []).length, 1);
});

test("the native optimization is isolated from the web renderer and gameplay", () => {
  const native = readFileSync(new URL("../src/components/MapWandererCharacter.native.tsx", import.meta.url), "utf8");
  assert.match(native, /publishCell\(dest\)/);
  assert.match(native, /publishCell\(to\)/);
  assert.match(native, /publishCell\(start\)/);
  assert.match(native, /publishCell\(fixedCell\)/);
  assert.match(native, /publishCell\(prevHome\)/);
  assert.match(native, /publishCell\(idx\)/);
  assert.doesNotMatch(native, /setOrologioGiocoVelocita\(|AsyncStorage|\bfetch\s*\(/);
});
