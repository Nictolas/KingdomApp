import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BOSCO_ID, BOSCO_NORD_LATO, ripristinaBoscoNord, trovaAnchorBoscoNord } from "../src/game/mappaBoscoNord";
import { isAcqua, getIndiciFootprint } from "../src/game/mappaGeometry";
import { buildPhaserBuildings } from "../src/phaser/adapters/buildPhaserMapSnapshot";
import { trovaAnchorEdificioGlobaleSuMappa } from "../src/game/commutePathsMappa";
import type { MappaRuntimeState } from "../src/game/mappaTypes";

const COLS = 50, ROWS = 50;
function mappa(): MappaRuntimeState {
  return {
    edificiInMappa: { [25 * COLS + 25]: { id: 1, nome: "Castello", emoji: "🏰" } },
    terrenoInMappa: {},
    decorazioniInMappa: {},
    residenzeMappa: {}
  };
}

test("il Bosco 5x5 ricompare in alto senza sovrapporsi agli edifici", () => {
  const originale = mappa();
  const dopo = ripristinaBoscoNord(originale, COLS, ROWS);
  const keys = Object.keys(dopo.edificiInMappa).map(Number);
  const anchors = keys.filter(k => dopo.edificiInMappa[k]?.nome === "Bosco" && dopo.edificiInMappa[k]?.footprintRef == null);
  assert.equal(anchors.length, 1);
  const anchor = anchors[0]!;
  assert.ok(Math.floor(anchor / COLS) >= 4 && Math.floor(anchor / COLS) <= 11, "the forest must be in the northern strip, well above the settlement");
  assert.equal(dopo.edificiInMappa[anchor]?.id, BOSCO_ID);
  assert.deepEqual(dopo.edificiInMappa[anchor]?.footprint, { w: 5, h: 5 });
  const cells = getIndiciFootprint(anchor, 5, 5, COLS);
  assert.equal(cells.length, 25);
  for (const idx of cells) {
    assert.equal(dopo.edificiInMappa[idx]?.nome, "Bosco");
    assert.equal(isAcqua(idx, COLS, ROWS), false);
    if (idx !== anchor) assert.equal(dopo.edificiInMappa[idx]?.footprintRef, anchor);
  }
  assert.equal(dopo.edificiInMappa[25 * COLS + 25]?.nome, "Castello");
  assert.equal(originale.edificiInMappa[anchor], undefined, "the source map is not mutated");
});

test("il ripristino e' idempotente e mantiene il bosco presente", () => {
  const prima = ripristinaBoscoNord(mappa(), COLS, ROWS);
  assert.equal(ripristinaBoscoNord(prima, COLS, ROWS), prima);
  const salvata = mappa();
  salvata.edificiInMappa[5 * COLS + 5] = { id: 51, nome: "Bosco", emoji: "🌲", footprint: { w: 5, h: 5 } };
  assert.equal(ripristinaBoscoNord(salvata, COLS, ROWS), salvata);
});

test("non cancella case, strade, decorazioni o fiumi gia' salvati", () => {
  const prima = mappa();
  const previsto = trovaAnchorBoscoNord(prima, COLS, ROWS)!;
  for (const idx of getIndiciFootprint(previsto, BOSCO_NORD_LATO, BOSCO_NORD_LATO, COLS)) {
    prima.terrenoInMappa[idx] = "river";
  }
  prima.edificiInMappa[3 * COLS + 20] = { id: 20, nome: "Capanna", emoji: "🏠" };
  prima.edificiInMappa[3 * COLS + 21] = { id: -1, nome: "Strada", emoji: "" };
  prima.decorazioniInMappa[3 * COLS + 22] = "🌲";
  const vecchio = JSON.stringify(prima);
  const dopo = ripristinaBoscoNord(prima, COLS, ROWS);
  assert.equal(JSON.stringify(prima), vecchio);
  assert.equal(dopo.edificiInMappa[3 * COLS + 20]?.nome, "Capanna");
  assert.equal(dopo.edificiInMappa[3 * COLS + 21]?.nome, "Strada");
  assert.equal(dopo.decorazioniInMappa[3 * COLS + 22], "🌲");
  const bosco = Object.keys(dopo.edificiInMappa).map(Number).find(i => dopo.edificiInMappa[i]?.nome === "Bosco" && !dopo.edificiInMappa[i]?.footprintRef)!;
  assert.notEqual(bosco, previsto);
  for (const cell of getIndiciFootprint(bosco, 5, 5, COLS)) {
    assert.notEqual(dopo.terrenoInMappa[cell], "river");
  }
});

test("se la zona e' occupata non forza alcuna sovrapposizione", () => {
  const piena = mappa();
  for (let r = 1; r < 27; r++) for (let c = 1; c < COLS-1; c++) {
    piena.edificiInMappa[r*COLS+c] = { id: -1, nome: "Strada", emoji: "" };
  }
  assert.equal(trovaAnchorBoscoNord(piena, COLS, ROWS), null);
  assert.equal(ripristinaBoscoNord(piena, COLS, ROWS), piena);
});

test("il Bosco e' un edificio Phaser selezionabile e raggiungibile dai Raccoglitori", () => {
  const recuperata = ripristinaBoscoNord(mappa(), COLS, ROWS);
  const anchor = trovaAnchorEdificioGlobaleSuMappa(51, recuperata.edificiInMappa);
  assert.ok(anchor != null);
  const world = buildPhaserBuildings(recuperata, COLS, ROWS, [{ id: 51, stato: "Operativo" }]);
  const bosco = world.find(b => b.name === "Bosco");
  assert.ok(bosco);
  assert.equal(bosco.anchor, anchor);
  assert.equal(bosco.widthCells, 5);
  assert.equal(bosco.heightCells, 5);
  assert.ok((bosco.geometry.entryPoints?.length ?? 0) >= 2, "southern entry cells exist");
  for (const entrance of bosco.geometry.entryPoints ?? []) {
    assert.equal(Math.floor(entrance.cell / COLS), Math.floor(anchor! / COLS) + 5);
    assert.equal(recuperata.edificiInMappa[entrance.cell], undefined);
  }
});

test("la mappa nuova e la sessione ripristinata usano entrambe il recupero del Bosco", () => {
  const source = readFileSync(new URL("../app/mappa.tsx", import.meta.url), "utf8");
  assert.match(source, /const edificiIniziali = ripristinaBoscoNord\(/);
  assert.match(source, /function normalizeMappaSessione[\s\S]*return ripristinaBoscoNord\(coerente, FIXED_MAP_COLS, FIXED_MAP_ROWS\)/);
  assert.match(source, /normalizeMappaSessione\(getMappaSessione\(\) \?\? initialMappaState\)/);
});

test("un Bosco 5x5 creato nella precedente posizione centrale si sposta a nord senza perdere edifici", () => {
  const prior = mappa();
  const oldAnchor = 20 * COLS + 22;
  const originalCells = getIndiciFootprint(oldAnchor, 5, 5, COLS);
  for (const i of originalCells) prior.edificiInMappa[i] = i === oldAnchor
    ? { id: BOSCO_ID, nome: "Bosco", emoji: "🌲", footprint: { w: 5, h: 5 } }
    : { id: BOSCO_ID, nome: "Bosco", emoji: "", footprintRef: oldAnchor };
  prior.edificiInMappa[19 * COLS + 17] = { id: 20, nome: "Capanna", emoji: "🏠" };
  const result = ripristinaBoscoNord(prior, COLS, ROWS);
  assert.notEqual(result, prior);
  const newAnchor = Object.keys(result.edificiInMappa).map(Number)
    .find(i => result.edificiInMappa[i]?.nome === "Bosco" &&
      result.edificiInMappa[i]?.footprintRef == null)!;
  assert.ok(newAnchor !== oldAnchor);
  assert.ok(Math.floor(newAnchor / COLS) >= 4 && Math.floor(newAnchor / COLS) <= 11);
  assert.equal(result.edificiInMappa[25 * COLS + 25]?.nome, "Castello");
  assert.equal(result.edificiInMappa[19 * COLS + 17]?.nome, "Capanna");
  for (const i of originalCells) assert.equal(result.edificiInMappa[i], undefined);
  assert.equal(result.edificiInMappa[newAnchor]?.id, BOSCO_ID);
  assert.equal(ripristinaBoscoNord(result, COLS, ROWS), result);
});

test("un bosco centrale precedente rimane al suo posto se non c'e' spazio sicuro a nord", () => {
  const prior = mappa();
  const oldAnchor = 20 * COLS + 22;
  for (const i of getIndiciFootprint(oldAnchor, 5, 5, COLS)) {
    prior.edificiInMappa[i] = i === oldAnchor
      ? { id: BOSCO_ID, nome: "Bosco", emoji: "🌲", footprint: { w: 5, h: 5 } }
      : { id: BOSCO_ID, nome: "Bosco", emoji: "", footprintRef: oldAnchor };
  }
  for (let r = 4; r <= 16; r++)
    for (let c = 1; c < COLS - 1; c++)
      prior.edificiInMappa[r * COLS + c] = { id: -1, nome: "Strada", emoji: "" };
  const result = ripristinaBoscoNord(prior, COLS, ROWS);
  assert.equal(result, prior);
  assert.equal(result.edificiInMappa[oldAnchor]?.nome, "Bosco");
});

test("un Bosco gia' nella zona nord non viene riportato verso il centro", () => {
  const prior = mappa();
  const anchor = 2 * COLS + 22;
  for (const i of getIndiciFootprint(anchor, 5, 5, COLS)) {
    prior.edificiInMappa[i] = i === anchor
      ? { id: BOSCO_ID, nome: "Bosco", emoji: "🌲", footprint: { w: 5, h: 5 } }
      : { id: BOSCO_ID, nome: "Bosco", emoji: "", footprintRef: anchor };
  }
  assert.equal(ripristinaBoscoNord(prior, COLS, ROWS), prior);
});

test("migrazione del Bosco centrale e' idempotente e non duplica il footprint", () => {
  const prior = mappa();
  const oldAnchor = 18 * COLS + 20;
  for (const i of getIndiciFootprint(oldAnchor, 5, 5, COLS)) {
    prior.edificiInMappa[i] = i === oldAnchor
      ? { id: BOSCO_ID, nome: "Bosco", emoji: "🌲", footprint: { w: 5, h: 5 } }
      : { id: BOSCO_ID, nome: "Bosco", emoji: "", footprintRef: oldAnchor };
  }
  const result = ripristinaBoscoNord(prior, COLS, ROWS);
  const anchors = Object.keys(result.edificiInMappa).map(Number).filter(
    i => result.edificiInMappa[i]?.nome === "Bosco" && result.edificiInMappa[i]?.footprintRef == null
  );
  assert.equal(anchors.length, 1);
  assert.ok(Math.floor(anchors[0]! / COLS) <= 11);
  assert.equal(Object.values(result.edificiInMappa).filter(e => e.nome === "Bosco").length, 25);
  assert.equal(ripristinaBoscoNord(result, COLS, ROWS), result);
});
