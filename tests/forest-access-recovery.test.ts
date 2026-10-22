import assert from "node:assert/strict";
import test from "node:test";

import type { MappaRuntimeState } from "../src/game/mappaTypes.ts";
import { assicuraAccessoPedonaleBosco } from "../src/game/mappaBoscoAccesso.ts";
import { calcolaPercorsoVersoAnchorEdificio, celleIngressoBoscoWalkable } from "../src/game/commutePathsMappa.ts";
import { cellaNellaForestaNord } from "../src/game/mappaForestaConfine.ts";
import { isAcqua } from "../src/game/mappaGeometry.ts";

const cols = 14, rows = 24, forest = cols + 4, castle = 16 * cols + 6;
const make = (): MappaRuntimeState => ({
  edificiInMappa: {
    [forest]: { id: 51, nome: "Bosco", emoji: "🌲", footprint: { w: 5, h: 5 } },
    [castle]: { id: 1, nome: "Castello", emoji: "🏰" }
  },
  terrenoInMappa: {},
  decorazioniInMappa: {},
  residenzeMappa: {}
});

const walkable = (state: MappaRuntimeState) => (i: number): boolean =>
  !isAcqua(i, cols, rows) && !cellaNellaForestaNord(i, cols, rows) &&
  state.terrenoInMappa[i] !== "river" &&
  !state.decorazioniInMappa[i] &&
  (!state.edificiInMappa[i] || state.edificiInMappa[i]?.nome === "Strada");

test("recupero: scava un solo guado se il fiume separa Bosco e Castello", () => {
  const s = make();
  for (let col = 1; col < cols - 1; col++) s.terrenoInMappa[9 * cols + col] = "river";
  const before = calcolaPercorsoVersoAnchorEdificio(14 * cols + 6, forest, cols, rows, walkable(s), s.edificiInMappa);
  assert.equal(before, null);
  const next = assicuraAccessoPedonaleBosco(s, cols, rows);
  assert.notEqual(next, s);
  assert.equal(Object.values(next.terrenoInMappa).filter(v => v === "river").length, cols - 3);
  assert.equal(Object.values(s.terrenoInMappa).filter(v => v === "river").length, cols - 2);
  assert.equal(next.edificiInMappa, s.edificiInMappa);
  assert.equal(next.decorazioniInMappa, s.decorazioniInMappa);
  const after = calcolaPercorsoVersoAnchorEdificio(14 * cols + 6, forest, cols, rows, walkable(next), next.edificiInMappa);
  assert.ok(after && after.length >= 2);
  assert.equal(assicuraAccessoPedonaleBosco(next, cols, rows), next);
});

test("non cambia terreno se Bosco e abitato sono già collegati", () => {
  const s = make();
  assert.equal(assicuraAccessoPedonaleBosco(s, cols, rows), s);
});

test("le entrate laterali permettono ai Raccoglitori di arrivare anche con porta centrale isolata", () => {
  const s = make();
  const blocked = [6 * cols + 5, 6 * cols + 7, 7 * cols + 6];
  for (const i of blocked) s.terrenoInMappa[i] = "river";
  const accessi = celleIngressoBoscoWalkable(forest, s.edificiInMappa, cols, rows, walkable(s));
  assert.ok(accessi.includes(6 * cols + 4));
  assert.ok(accessi.includes(6 * cols + 6));
  const result = calcolaPercorsoVersoAnchorEdificio(13 * cols + 4, forest, cols, rows, walkable(s), s.edificiInMappa);
  assert.ok(result && result.length >= 2);
  assert.notEqual(result.at(-1), 6 * cols + 6);
});

test("nessun recupero senza Castello o Bosco: evita trasformazioni arbitrarie", () => {
  const s = make();
  delete s.edificiInMappa[castle];
  assert.equal(assicuraAccessoPedonaleBosco(s, cols, rows), s);
});
