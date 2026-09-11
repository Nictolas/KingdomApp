import assert from "node:assert/strict";
import test from "node:test";

import {
  calcolaPercorsoVersoAnchorEdificio,
  trovaCellaPortaEdificio,
  type EdificioInCellaLike
} from "../src/game/commutePathsMappa.ts";

const cols = 6;
const rows = 6;

function edificio2x2(anchor: number, nome: string): Record<number, EdificioInCellaLike> {
  return {
    [anchor]: { id: anchor, nome, footprint: { w: 2, h: 2 } },
    [anchor + 1]: { id: anchor, nome, footprintRef: anchor },
    [anchor + cols]: { id: anchor, nome, footprintRef: anchor },
    [anchor + cols + 1]: { id: anchor, nome, footprintRef: anchor }
  };
}

test("la porta è l'unica cella d'ingresso e si trova davanti al centro del footprint", () => {
  const edifici = edificio2x2(7, "Dormitorio");
  const isWalkable = (cell: number) => edifici[cell] == null;

  assert.equal(trovaCellaPortaEdificio(7, edifici, cols, rows, isWalkable), 20);
  const path = calcolaPercorsoVersoAnchorEdificio(24, 7, cols, rows, isWalkable, edifici);
  assert.ok(path);
  assert.equal(path.at(-1), 20);
  assert.notEqual(path.at(-1), 18);
  assert.notEqual(path.at(-1), 21);
});

test("un abitante esce dalla stessa porta e non da un lato casuale", () => {
  const sorgente = edificio2x2(7, "Dormitorio");
  const destinazione = edificio2x2(10, "Serra");
  const edifici = { ...sorgente, ...destinazione };
  const isWalkable = (cell: number) => cell >= 0 && cell < cols * rows && edifici[cell] == null;

  const path = calcolaPercorsoVersoAnchorEdificio(7, 10, cols, rows, isWalkable, edifici);
  assert.ok(path);
  assert.equal(path[0], 20);
  assert.equal(path.at(-1), 23);
});

test("se la cella davanti alla porta è bloccata l'edificio non è accessibile da altri lati", () => {
  const edifici = edificio2x2(7, "Dormitorio");
  const isWalkable = (cell: number) => edifici[cell] == null && cell !== 20;

  assert.equal(trovaCellaPortaEdificio(7, edifici, cols, rows, isWalkable), null);
  assert.equal(calcolaPercorsoVersoAnchorEdificio(24, 7, cols, rows, isWalkable, edifici), null);
});

test("se la porta di partenza è bloccata l'abitante non esce attraversando una parete", () => {
  const sorgente = edificio2x2(7, "Dormitorio");
  const destinazione = edificio2x2(10, "Serra");
  const edifici = { ...sorgente, ...destinazione };
  const isWalkable = (cell: number) =>
    cell >= 0 && cell < cols * rows && edifici[cell] == null && cell !== 20;

  assert.equal(calcolaPercorsoVersoAnchorEdificio(7, 10, cols, rows, isWalkable, edifici), null);
});

test("Bosco striscia nord: ingresso sul bordo sud davanti a sé (non al centro)", () => {
  const boscoCols = 12;
  const boscoRows = 12;
  const anchor = 0;
  const w = boscoCols;
  const h = 2;
  const edifici: Record<number, EdificioInCellaLike> = {
    [anchor]: { id: 51, nome: "Bosco", footprint: { w, h } }
  };
  for (let dr = 0; dr < h; dr++) {
    for (let dc = 0; dc < w; dc++) {
      const i = anchor + dr * boscoCols + dc;
      if (i === anchor) continue;
      edifici[i] = { id: 51, nome: "Bosco", footprintRef: anchor };
    }
  }
  const isWalkable = (cell: number) =>
    cell >= 0 && cell < boscoCols * boscoRows && edifici[cell] == null;

  // Da sud, colonna 2 → entra in colonna 2 (non al centro = col 6)
  const startLeft = 5 * boscoCols + 2;
  const pathLeft = calcolaPercorsoVersoAnchorEdificio(
    startLeft,
    anchor,
    boscoCols,
    boscoRows,
    isWalkable,
    edifici
  );
  assert.ok(pathLeft);
  assert.equal(pathLeft!.at(-1)! % boscoCols, 2);

  // Da sud, colonna 10 → entra in colonna 10
  const startRight = 5 * boscoCols + 10;
  const pathRight = calcolaPercorsoVersoAnchorEdificio(
    startRight,
    anchor,
    boscoCols,
    boscoRows,
    isWalkable,
    edifici
  );
  assert.ok(pathRight);
  assert.equal(pathRight!.at(-1)! % boscoCols, 10);

  // Nessun percorso deve finire al centro (col 6) se si parte da col 2
  assert.notEqual(pathLeft!.at(-1)! % boscoCols, Math.floor(boscoCols / 2));
});
