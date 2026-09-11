import assert from "node:assert/strict";
import test from "node:test";
import {
  generaProfonditaCostaSud,
  isMareConProfondita,
  MARE_PROFONDITA_MIN,
  setActiveCostaSud
} from "../src/game/mareCosta";
import { isMareCell } from "../src/game/riverGeneration";

test("costa sud: solo mare in basso, profondità variabile", () => {
  const cols = 40;
  const rows = 30;
  let i = 0;
  const random = () => {
    const seq = [0.1, 0.9, 0.4, 0.7, 0.2, 0.55, 0.8, 0.15, 0.6, 0.35];
    return seq[i++ % seq.length]!;
  };
  const depths = generaProfonditaCostaSud(cols, random);
  assert.equal(depths.length, cols);
  assert.ok(depths.some((d) => d !== depths[0]));
  assert.ok(depths.every((d) => d >= 1));

  setActiveCostaSud(depths);

  // Nessuna cella a nord / lati fuori dalla profondità colonna è mare
  for (let col = 0; col < cols; col++) {
    const d = depths[col]!;
    for (let row = 0; row < rows - d; row++) {
      const idx = row * cols + col;
      assert.equal(isMareCell(idx, cols, rows), false);
      assert.equal(isMareConProfondita(idx, cols, rows, depths), false);
    }
    for (let row = rows - d; row < rows; row++) {
      const idx = row * cols + col;
      assert.equal(isMareCell(idx, cols, rows), true);
    }
  }

  // Ultima riga sempre mare
  for (let col = 0; col < cols; col++) {
    assert.equal(isMareCell((rows - 1) * cols + col, cols, rows), true);
  }

  // Colonne 0 e cols-1 in alto non sono mare
  assert.equal(isMareCell(0, cols, rows), false);
  assert.equal(isMareCell(cols - 1, cols, rows), false);
  assert.ok(depths[0]! >= MARE_PROFONDITA_MIN || depths[0]! >= 1);

  setActiveCostaSud(null);
});
