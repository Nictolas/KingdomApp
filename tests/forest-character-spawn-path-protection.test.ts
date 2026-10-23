import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { cellaNellaForestaNord } from "../src/game/mappaForestaConfine.ts";
import { assignUniqueCharacterCells } from "../src/game/characterCellOccupancy.ts";
import { ripristinaBoscoNord } from "../src/game/mappaBoscoNord.ts";
import { trovaCellaPortaEdificio } from "../src/game/commutePathsMappa.ts";
import { trovaPercorsoVersoCelle } from "../src/game/mappaPathfinding.ts";
import type { MappaRuntimeState } from "../src/game/mappaTypes.ts";

const cols = 50;
const rows = 50;
const forest = (cell: number) => cellaNellaForestaNord(cell, cols, rows);
const walkable = (cell: number) => cell >= 0 && cell < cols * rows && !forest(cell);
const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("lo spawn di un residente mai posizionato e di un vecchio salvataggio avviene fuori dalle sei righe di Bosco", () => {
  const previous = [
    { id: 1, cell: 2 * cols + 8 },
    { id: 2, cell: 5 * cols + 12 },
    { id: 3, cell: 0 },
    { id: 4, cell: 7 * cols + 12 }
  ];
  const result = assignUniqueCharacterCells(previous, cols, rows, walkable, forest);
  assert.equal(result.length, 4);
  assert.deepEqual(result.map((c) => c.id), [1, 2, 3, 4]);
  for (const character of result) {
    assert.equal(forest(character.cell), false, `abitante ${character.id} sul Bosco`);
    assert.ok(walkable(character.cell));
  }
  assert.ok(result[0]!.cell >= 6 * cols);
  assert.ok(result[1]!.cell >= 6 * cols);
  assert.ok(result[2]!.cell >= 6 * cols);
  assert.equal(previous[0]!.cell, 2 * cols + 8, "la correzione non muta i dati salvati");
});

test("niente spawn multiplo sulla stessa casella fuori dal Bosco", () => {
  const previous = Array.from({ length: 35 }, (_, i) => ({
    id: i + 1,
    cell: 2 * cols + 20
  }));
  const result = assignUniqueCharacterCells(previous, cols, rows, walkable, forest);
  assert.equal(new Set(result.map((c) => c.cell)).size, result.length);
  assert.ok(result.every((c) => !forest(c.cell)));
});

test("un vecchio percorso che attraversa il bosco viene annullato e non riparte in cima agli alberi", () => {
  const saved = {
    id: 50,
    cell: 3 * cols + 18,
    path: [3 * cols + 18, 4 * cols + 18, 5 * cols + 18, 6 * cols + 18]
  };
  const [safe] = assignUniqueCharacterCells([saved], cols, rows, walkable, forest);
  assert.ok(safe);
  assert.equal(forest(safe!.cell), false);
  assert.equal(safe!.path, undefined);
  assert.equal(saved.path.length, 4);
});

test("anche un percorso che inizia fuori ma attraversa il Bosco viene interrotto", () => {
  const cell = 7 * cols + 11;
  const [safe] = assignUniqueCharacterCells([
    { id: 60, cell, path: [cell, cell - cols, cell - 2 * cols, cell + 1] }
  ], cols, rows, walkable, forest);
  assert.equal(safe!.cell, cell);
  assert.equal(safe!.path, undefined);
});

test("le normali uscite da edifici rimangono animate come prima", () => {
  const inside = 12 * cols + 12;
  const outside = 13 * cols + 12;
  const hasBuilding = (cell: number) => cell === inside;
  const characters = [
    { id: 8, cell: inside, path: [inside, outside], pathToken: 43 }
  ];
  const [character] = assignUniqueCharacterCells(
    characters, cols, rows,
    (cell) => walkable(cell) && !hasBuilding(cell), forest
  );
  assert.deepEqual(character, characters[0]);
  assert.equal(character?.pathToken, 43);
});

test("i Raccoglitori raggiungono l'ingresso del Bosco da sud senza entrare nella foresta", () => {
  const empty: MappaRuntimeState = {
    edificiInMappa: {}, terrenoInMappa: {}, decorazioniInMappa: {}, residenzeMappa: {}
  };
  const mappa = ripristinaBoscoNord(empty, cols, rows);
  const entry = Object.entries(mappa.edificiInMappa).find(([, e]) =>
    e.nome === "Bosco" && e.footprint != null
  );
  assert.ok(entry);
  const anchor = Number(entry![0]);
  const porta = trovaCellaPortaEdificio(anchor, mappa.edificiInMappa, cols, rows, walkable);
  assert.ok(porta != null);
  assert.equal(Math.floor(porta! / cols), 6);
  assert.equal(forest(porta!), false);
  const path = trovaPercorsoVersoCelle(13 * cols + 27, new Set([porta!]), cols, rows, walkable);
  assert.ok(path);
  assert.ok(path!.every((cell) => !forest(cell)));
});

test("la mappa blocca foresta come terreno non percorribile, anche per i passi verso interni", () => {
  const source = read("app/mappa.tsx");
  assert.match(source, /const isWalkableCell = useCallback\([\s\S]*?if \(cellaNellaForestaNord\(i, cols, rows\)\) return false;/);
  assert.match(source, /const tryPhaserCharacterStep = useCallback\([\s\S]*?if \(cellaNellaForestaNord\(toCell, cols, rows\)\) return false;/);
  assert.match(source, /assignUniqueCharacterCells\([\s\S]*?\(cell\) => cellaNellaForestaNord\(cell, cols, rows\)/);
  assert.match(source, /info\.path\.some\(\(cell\) => cellaNellaForestaNord\(cell, cols, rows\)\)/);
  assert.match(source, /ultimaCellaAbitanteRef\.current\.set\(character\.id, character\.cell\)/);
  assert.match(source, /commutePath=\{infoCommute\?\.path\?\.some\(/);
  assert.match(source, /fixedCell=\{fixedCellNotte != null && cellaNellaForestaNord/);
});

test("la compatibilità resta invariata per una griglia di test senza Bosco settentrionale", () => {
  const smallCols = 6, smallRows = 6;
  const isAllowed = (cell: number) => !cellaNellaForestaNord(cell, smallCols, smallRows);
  const result = assignUniqueCharacterCells([{ id: 1, cell: 2 }], smallCols, smallRows, isAllowed);
  assert.equal(result[0]!.cell, 2);
});
