import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  RIGHE_ERBA_SOTTO_FORESTA,
  cellaNellaFasciaErbaSottoForesta,
  cellaNellaForestaNord,
  proteggiFasciaErbaSottoForesta,
  rimuoviStradeInizialiDallaFasciaErba
} from "../src/game/mappaForestaConfine.ts";
import { isAcqua } from "../src/game/mappaGeometry.ts";
import { generateRivers, isMareCell, isTerrenoAcqua } from "../src/game/riverGeneration.ts";
import {
  puòPiazzareFootprintConCuscino,
  puòPiazzareFootprintManualeVicinoAcqua
} from "../src/game/mappaPiazzamentoFootprint.ts";
import { elencoAncoreEdificiNonStrada } from "../src/game/roadConnectivity.ts";

const cols = 50, rows = 50;
const buffer = (index: number) => cellaNellaFasciaErbaSottoForesta(index, cols, rows);

test("due righe di prato continue su tutte le colonne sotto le sei righe del Bosco", () => {
  assert.equal(RIGHE_ERBA_SOTTO_FORESTA, 2);
  for (let col = 0; col < cols; col++) {
    for (const row of [6, 7]) {
      const index = row * cols + col;
      assert.equal(buffer(index), true);
      assert.equal(isAcqua(index, cols, rows), false);
      assert.equal(isMareCell(index, cols, rows), false);
      assert.equal(isTerrenoAcqua(index, {}, cols, rows), false);
    }
    assert.equal(buffer(5 * cols + col), false);
    assert.equal(buffer(8 * cols + col), false);
  }
  assert.equal(buffer(-1), false);
  assert.equal(buffer(cols * rows), false);
  assert.equal(cellaNellaFasciaErbaSottoForesta(3, 10, 10), false);
});

test("fiumi e sabbia non restano nella fascia verde, senza cancellare il resto", () => {
  const terreno: Record<number, "erba" | "river" | "sabbia"> = {};
  for (let col = 0; col < cols; col++) {
    terreno[6 * cols + col] = "river";
    terreno[7 * cols + col] = "sabbia";
  }
  terreno[8 * cols + 12] = "river";
  terreno[9 * cols + 12] = "sabbia";
  proteggiFasciaErbaSottoForesta(terreno, cols, rows);
  for (let col = 0; col < cols; col++) {
    assert.equal(terreno[6 * cols + col] ?? "erba", "erba");
    assert.equal(terreno[7 * cols + col] ?? "erba", "erba");
  }
  assert.equal(terreno[8 * cols + 12], "river");
  assert.equal(terreno[9 * cols + 12], "sabbia");
});

test("le sorgenti e i percorsi dei fiumi non invadono la cintura erbosa", () => {
  const forbidden = new Set<number>();
  for (let i = 0; i < cols * rows; i++) {
    if (isAcqua(i, cols, rows) || cellaNellaForestaNord(i, cols, rows) || buffer(i)) forbidden.add(i);
  }
  for (const seed of [1, 8, 31, 42, 77]) {
    const { riverIndices, sandIndices } = generateRivers({
      cols, rows, numSources: 3, maxLength: 60, bifurcationProbability: 0.1, forbiddenIndices: forbidden, seed
    });
    assert.ok(riverIndices.every(i => !buffer(i)), "fiume troppo vicino al Bosco");
    assert.ok(sandIndices.every(i => !buffer(i)), "sabbia troppo vicina al Bosco");
  }
});

test("gli edifici iniziali non occupano il prato, ma le costruzioni manuali restano possibili", () => {
  for (const row of [6, 7]) {
    assert.equal(puòPiazzareFootprintConCuscino(row * cols + 20, 2, 1, cols, rows, new Set(), new Set()), false);
  }
  assert.equal(puòPiazzareFootprintConCuscino(8 * cols + 20, 2, 1, cols, rows, new Set(), new Set()), true);
  assert.equal(puòPiazzareFootprintManualeVicinoAcqua(6 * cols + 20, 2, 1, cols, rows, new Set(), new Set()), true);
});

test("le strade prodotte dai passaggi finali non coprono la fascia verde", () => {
  const edifici: Record<number, { nome: string }> = {
    [6 * cols]: { nome: "Strada" },
    [7 * cols + 25]: { nome: "Strada" },
    [7 * cols + 26]: { nome: "Casa" },
    [8 * cols + 25]: { nome: "Strada" }
  };
  rimuoviStradeInizialiDallaFasciaErba(edifici, cols, rows);
  assert.equal(edifici[6 * cols], undefined);
  assert.equal(edifici[7 * cols + 25], undefined);
  assert.equal(edifici[7 * cols + 26]?.nome, "Casa");
  assert.equal(edifici[8 * cols + 25]?.nome, "Strada");
});

test("il Bosco non impone di costruire una strada sulla cintura erbosa", () => {
  assert.deepEqual(elencoAncoreEdificiNonStrada({
    50: { id: 51, nome: "Bosco", emoji: "🌲", footprint: { w: 5, h: 5 } },
    850: { id: 1, nome: "Castello", emoji: "🏰" },
    950: { id: 2, nome: "Strada", emoji: "" }
  }), [850]);
});

test("la generazione protegge l'erba prima degli edifici e dopo l'ultima rifinitura", () => {
  const source = readFileSync(new URL("../app/mappa.tsx", import.meta.url), "utf8");
  assert.match(source, /generateRivers\([\s\S]*?forbiddenIndices: borderIndices/);
  assert.match(source, /applyTerrenoGrassAndSandContinuity\(terrenoInMappa, cols, rows\);\s*proteggiFasciaErbaSottoForesta\(terrenoInMappa, cols, rows\);/);
  assert.match(source, /preservaTerraIntornoEdificiIniziali\([\s\S]*?proteggiFasciaErbaSottoForesta\(terrenoInMappa, cols, rows\);/);
  assert.ok(source.includes("rimuoviStradeInizialiDallaFasciaErba(edificiInMappa, cols, rows)"));
  assert.match(source, /cellaNellaFasciaErbaSottoForesta\(i, cols, rows\).*?borderIndices\.add\(i\)/);
});
