import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  fasciaTerraEdificiIniziali,
  preservaTerraIntornoEdificiIniziali
} from "../src/game/mappaDistanzaAcquaEdificiIniziali";
import { scegliAnchorComplessoAmministrativo, puòPiazzareFootprintConCuscino } from "../src/game/mappaPiazzamentoFootprint";
import { aggiungiDormitorioFootprint } from "../src/game/mappaEdificiInizialiPiazzamento";
import { getIndiciFootprint, getVicini8, isAcqua, riverSetDaTerreno } from "../src/game/mappaGeometry";
import { generateRivers, buildTerrenoFromRivers, applyTerrenoGrassAndSandContinuity, isTerrenoAcqua } from "../src/game/riverGeneration";
import type { EdificioInCellaMappa } from "../src/game/mappaTypes";

const cols = 50, rows = 50;

test("il generatore di nuove partite produce prima acqua, poi edifici e infine strade", () => {
  const full = readFileSync(new URL("../app/mappa.tsx", import.meta.url), "utf8");
  const source = full.slice(full.indexOf("async function buildInitialMappa("), full.indexOf("const CIELO_ALPHA_NOTTE_MAX"));
  const order = [
    "generateRivers({",
    "buildTerrenoFromRivers(riverIndices, sandIndices)",
    "riverSetDaTerreno(terrenoInMappa)",
    "scegliAnchorComplessoAmministrativo(cols, rows, riverSet)",
    "getInitialEdificiInMappa(cols, rows, riverSet, adminAnchor, terrenoInMappa)",
    "piazzaStradeInizialiTraEdifici(",
    "applicaRegoleConfineTerreno("
  ];
  let last = -1;
  for (const token of order) {
    const at = source.indexOf(token);
    assert.ok(at > last, `ordine errato: ${token}`);
    last = at;
  }
  assert.ok(source.includes("preservaTerraIntornoEdificiIniziali("));
});

test("la fascia protegge tutte le celle di un edificio iniziale, comprese le diagonali", () => {
  const dorm: Record<number, EdificioInCellaMappa> = {
    22: { id: 14, nome: "Dormitorio", emoji: "", footprint: { w: 2, h: 2 } },
    23: { id: 14, nome: "Dormitorio", emoji: "", footprintRef: 22 },
    32: { id: 14, nome: "Dormitorio", emoji: "", footprintRef: 22 },
    33: { id: 14, nome: "Dormitorio", emoji: "", footprintRef: 22 },
    70: { id: -1, nome: "Strada", emoji: "" },
    80: { id: 51, nome: "Bosco", emoji: "" }
  };
  const fascia = fasciaTerraEdificiIniziali(dorm, 10, 10);
  for (const i of [11, 12, 13, 14, 21, 22, 23, 24, 31, 32, 33, 34, 41, 42, 43, 44]) {
    assert.ok(fascia.has(i), `manca cuscino alla cella ${i}`);
  }
  assert.equal(fascia.has(70), false);
  assert.equal(fascia.has(80), false);
});

test("le rifiniture della costa non trasformano in fiume il cuscino di un edificio iniziale", () => {
  const edifici: Record<number, EdificioInCellaMappa> = { 55: { id: 14, nome: "Dormitorio", emoji: "" } };
  const fascia = fasciaTerraEdificiIniziali(edifici, 10, 10);
  const terrain = { 45: "river" as const, 44: "river" as const, 5: "river" as const, 65: "sabbia" as const };
  preservaTerraIntornoEdificiIniziali(terrain, fascia, 10, 10);
  assert.equal(terrain[45], undefined);
  assert.equal(terrain[44], undefined);
  assert.equal(terrain[5], "river");
  assert.equal(terrain[65], "sabbia");
});

test("per molti terreni con fiumi, castello e dormitorio iniziali restano lontani dall'acqua", () => {
  let exploredWithRiver = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const forbidden = new Set<number>();
    for (let i = 0; i < cols * rows; i++) {
      if (isAcqua(i, cols, rows) || Math.floor(i / cols) < 6) forbidden.add(i);
    }
    const { riverIndices, sandIndices } = generateRivers({
      cols, rows, numSources: 3, maxLength: 60, bifurcationProbability: 0.1,
      forbiddenIndices: forbidden, seed
    });
    const terrain = buildTerrenoFromRivers(riverIndices, sandIndices);
    applyTerrenoGrassAndSandContinuity(terrain, cols, rows);
    const rivers = riverSetDaTerreno(terrain);
    if (rivers.size) exploredWithRiver++;
    const castle = scegliAnchorComplessoAmministrativo(cols, rows, rivers);
    assert.equal(puòPiazzareFootprintConCuscino(castle, 3, 2, cols, rows, rivers, new Set()), true, `seed ${seed}: castle`);
    const placed: Record<number, EdificioInCellaMappa> = {};
    const vietato = new Set<number>(getIndiciFootprint(castle, 3, 2, cols));
    aggiungiDormitorioFootprint(cols, rows, rivers, vietato, placed, 23 * cols + 23);
    for (const i of [...getIndiciFootprint(castle, 3, 2, cols), ...Object.keys(placed).map(Number)]) {
      assert.equal(isTerrenoAcqua(i, terrain, cols, rows), false, `seed ${seed}: building in water ${i}`);
      for (const n of getVicini8(i, cols, rows)) {
        assert.equal(isTerrenoAcqua(n, terrain, cols, rows), false, `seed ${seed}: neighbor ${n} near building ${i}`);
      }
    }
  }
  assert.ok(exploredWithRiver >= 5, `poche mappe con fiumi: ${exploredWithRiver}`);
});

test("la regola vale solo per l'inizio: costruzioni manuali permesse accanto all'acqua", async () => {
  const { edificioRispettaCriteriPiazzamento, calcolaAnchorEdificioMultiCella } =
    await import("../src/game/mappaCostruzioneAnteprima");
  const a = 16 * cols + 16;
  const fiume = a - 1;
  const terreno = { [fiume]: "river" as const };
  assert.equal(puòPiazzareFootprintConCuscino(a, 1, 1, cols, rows, new Set([fiume]), new Set()), false);
  assert.equal(edificioRispettaCriteriPiazzamento("Bar", a, 1, 1, {}, terreno, cols, rows), true);
  assert.equal(calcolaAnchorEdificioMultiCella(a, "Capanna", {}, terreno, cols, rows).anchor, a);
  assert.equal(edificioRispettaCriteriPiazzamento("Bar", fiume, 1, 1, {}, terreno, cols, rows), false);
  const vicinoCosta = 22 * cols + 1;
  assert.equal(edificioRispettaCriteriPiazzamento("Bar", vicinoCosta, 1, 1, {}, {}, cols, rows), true);
  assert.equal(edificioRispettaCriteriPiazzamento("Bar", vicinoCosta - 1, 1, 1, {}, {}, cols, rows), false);
  assert.equal(edificioRispettaCriteriPiazzamento("Bar", cols + 15, 1, 1, {}, {}, cols, rows), false);
});
