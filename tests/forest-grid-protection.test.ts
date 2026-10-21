import assert from "node:assert/strict";
import test from "node:test";
import { layoutNorthernForestTrees } from "../src/game/forestaSpriteGrid";
import { cellaNellaForestaNord, footprintIntersecaForestaNord } from "../src/game/mappaForestaConfine";
import { isAcqua } from "../src/game/mappaGeometry";
import { isMareCell } from "../src/game/riverGeneration";
import { puòPiazzareFootprintConCuscino } from "../src/game/mappaPiazzamentoFootprint";
import { footprintStrada2x2Valido } from "../src/game/stradaFootprint";
import { calcolaAnchorEdificioMultiCella, edificioRispettaCriteriPiazzamento, footprintTerreno2x2Valido } from "../src/game/mappaCostruzioneAnteprima";
import { ripristinaBoscoNord } from "../src/game/mappaBoscoNord";
import { buildPhaserMapSnapshot } from "../src/phaser/adapters/buildPhaserMapSnapshot";
import type { MappaRuntimeState } from "../src/game/mappaTypes";

const cols = 50, rows = 50;
const empty = (): MappaRuntimeState => ({ edificiInMappa: {}, terrenoInMappa: {}, decorazioniInMappa: {}, residenzeMappa: {} });

test("alberi stile Pokémon/Zelda affiancati, tre file ordinate senza intersezioni", () => {
  const w = cols * 40, trees = layoutNorthernForestTrees(w, 40);
  assert.ok(trees.length > 60);
  assert.equal(trees.length % 3, 0);
  assert.equal(Math.min(...trees.map(t => t.x)) >= 0, true);
  assert.equal(Math.min(...trees.map(t => t.y)) >= 0, true);
  assert.ok(Math.max(...trees.map(t => t.x + t.width)) <= w);
  assert.ok(Math.max(...trees.map(t => t.y + t.height)) <= 6 * 40);
  for (let i = 0; i < trees.length; i++) {
    for (let j = i + 1; j < trees.length; j++) {
      const a = trees[i], b = trees[j];
      const overlaps = a.x < b.x + b.width && a.x + a.width > b.x &&
        a.y < b.y + b.height && a.y + a.height > b.y;
      assert.equal(overlaps, false, "due alberi non devono sovrapporsi");
    }
  }
});

test("la prima riga da ovest a est appartiene al bosco e non è mare", () => {
  for (let col = 0; col < cols; col++) {
    assert.equal(cellaNellaForestaNord(col, cols, rows), true);
    assert.equal(isAcqua(col, cols, rows), false);
    assert.equal(isMareCell(col, cols, rows), false);
  }
  assert.equal(cellaNellaForestaNord(5 * cols + 49, cols, rows), true);
  assert.equal(cellaNellaForestaNord(6 * cols + 20, cols, rows), false);
  assert.equal(isMareCell(6 * cols, cols, rows), true);
});

test("Bosco 5x5 di raccolta protetto, righe 1-5, ingresso da sud e migrazione idempotente", () => {
  const state = empty();
  const next = ripristinaBoscoNord(state, cols, rows);
  const entries = Object.entries(next.edificiInMappa);
  assert.equal(entries.length, 25);
  const root = entries.find(([, e]) => !!e.footprint);
  assert.ok(root);
  assert.equal(Math.floor(Number(root[0]) / cols), 1);
  assert.equal(ripristinaBoscoNord(next, cols, rows), next);
});

test("il giocatore non può edificare, tracciare strade o modificare terreno in foresta", () => {
  const north = 5 * cols + 20, south = 6 * cols + 20;
  assert.equal(footprintIntersecaForestaNord(north, 2, 2, cols, rows), true);
  assert.equal(footprintIntersecaForestaNord(south, 2, 2, cols, rows), false);
  assert.equal(puòPiazzareFootprintConCuscino(north, 2, 1, cols, rows, new Set(), new Set()), false);
  assert.equal(edificioRispettaCriteriPiazzamento("Capanna", north, 2, 1, {}, {}, cols, rows), false);
  assert.equal(calcolaAnchorEdificioMultiCella(north, "Capanna", {}, {}, cols, rows).anchor, null);
  assert.equal(footprintStrada2x2Valido(north, cols, rows, {}, {}), false);
  for (const kind of ["acqua", "erba", "spiaggia"] as const) {
    assert.equal(footprintTerreno2x2Valido(kind, north, cols, rows, {}, {}), false);
  }
  assert.equal(puòPiazzareFootprintConCuscino(south, 2, 1, cols, rows, new Set(), new Set()), true);
});

test("il rendering non mostra vecchi fiumi e mare sopra la foresta", () => {
  const withBosco = ripristinaBoscoNord(empty(), cols, rows);
  const state = { ...withBosco, terrenoInMappa: { 0: "river" as const, 1: "sabbia" as const } };
  const snapshot = buildPhaserMapSnapshot(state, cols, rows, 40, 1);
  assert.equal(snapshot.tiles[0]?.animation, undefined);
  assert.equal(snapshot.tiles[1]?.animation, undefined);
  assert.equal(snapshot.tiles[0]?.frameX, snapshot.tiles[1]?.frameX);
  assert.equal(snapshot.tiles[0]?.frameY, snapshot.tiles[1]?.frameY);
});
