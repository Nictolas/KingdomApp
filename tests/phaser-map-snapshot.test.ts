import assert from "node:assert/strict";
import test from "node:test";

import { OVERWORLD_SHEET_PX, getStradaSheetCoord } from "../src/game/overworldSpritesheetLayout.ts";
import type { MappaRuntimeState } from "../src/game/mappaTypes.ts";
import { buildStradaAssetLookup } from "../src/game/terrainSpriteHelpers.ts";
import {
  buildPhaserBuildings,
  buildPhaserMapSnapshot
} from "../src/phaser/adapters/buildPhaserMapSnapshot.ts";

test("lo snapshot Phaser traduce mare, terra, sabbia e strada reali", () => {
  const state: MappaRuntimeState = {
    edificiInMappa: { 5: { id: -1, nome: "Strada", emoji: "" } },
    terrenoInMappa: { 6: "sabbia" },
    decorazioniInMappa: {},
    residenzeMappa: {}
  };
  const snapshot = buildPhaserMapSnapshot(state, 4, 4, 40, 7);

  assert.equal(snapshot.revision, 7);
  assert.equal(snapshot.tiles.length, 16);
  assert.equal(snapshot.tiles[0].animation, "water");
  assert.equal(snapshot.tiles[0].frameX, OVERWORLD_SHEET_PX.waterAnimX);
  assert.equal(snapshot.tiles[10].animation, undefined);

  const stradaAt = buildStradaAssetLookup(4, 4, state.terrenoInMappa, state.edificiInMappa);
  const stradaCoord = getStradaSheetCoord(stradaAt(5));
  assert.deepEqual(
    { x: snapshot.tiles[5].frameX, y: snapshot.tiles[5].frameY },
    stradaCoord
  );
});

test("gli edifici multicella vengono emessi una sola volta dal loro anchor", () => {
  const state: MappaRuntimeState = {
    edificiInMappa: {
      6: { id: 14, nome: "Dormitorio", emoji: "", footprint: { w: 2, h: 2 } },
      7: { id: 14, nome: "Dormitorio", emoji: "", footprintRef: 6 },
      11: { id: 14, nome: "Dormitorio", emoji: "", footprintRef: 6 },
      12: { id: 14, nome: "Dormitorio", emoji: "", footprintRef: 6 },
      8: { id: -1, nome: "Strada", emoji: "🛤️" },
      18: { id: 2, nome: "Serra", emoji: "🌱" }
    },
    terrenoInMappa: {},
    decorazioniInMappa: {},
    residenzeMappa: {}
  };
  const buildings = buildPhaserBuildings(state, 5);

  assert.equal(buildings.length, 2);
  assert.deepEqual(
    buildings.map(({ anchor, widthCells, heightCells, name }) => ({ anchor, widthCells, heightCells, name })),
    [
      { anchor: 6, widthCells: 2, heightCells: 2, name: "Dormitorio" },
      { anchor: 18, widthCells: 1, heightCells: 1, name: "Serra" }
    ]
  );
  assert.equal(buildings[0].emoji, "🛏️");
  assert.equal(buildings[0].category, "residence");
});

test("costruzione e demolizione cambiano soltanto i descriptor derivati", () => {
  const empty: MappaRuntimeState = {
    edificiInMappa: {},
    terrenoInMappa: {},
    decorazioniInMappa: {},
    residenzeMappa: {}
  };
  const built: MappaRuntimeState = {
    ...empty,
    edificiInMappa: { 12: { id: 99, nome: "Mercato", emoji: "🏪", footprint: { w: 2, h: 2 } } }
  };

  assert.equal(buildPhaserMapSnapshot(empty, 5, 5, 40, 1).buildings.length, 0);
  assert.equal(buildPhaserMapSnapshot(built, 5, 5, 40, 2).buildings[0].name, "Mercato");
  assert.equal(buildPhaserMapSnapshot(empty, 5, 5, 40, 3).buildings.length, 0);
});

test("personaggi e percorsi attraversano il bridge senza entrare nello stato mappa", () => {
  const state: MappaRuntimeState = { edificiInMappa: {}, terrenoInMappa: {}, decorazioniInMappa: {}, residenzeMappa: {} };
  const characters = [{ id: 7, name: "Ada", cell: 6, path: [6, 7, 12], pathToken: 4 }];
  const snapshot = buildPhaserMapSnapshot(state, 5, 5, 40, 1, characters);
  assert.deepEqual(snapshot.characters, characters);
  assert.equal("characters" in state, false);
});

test("una nuova revisione riflette le modifiche del terreno senza stato Phaser salvabile", () => {
  const base: MappaRuntimeState = {
    edificiInMappa: {},
    terrenoInMappa: {},
    decorazioniInMappa: {},
    residenzeMappa: {}
  };
  const first = buildPhaserMapSnapshot(base, 5, 5, 40, 1);
  const next = buildPhaserMapSnapshot(
    { ...base, terrenoInMappa: { 12: "river" } },
    5,
    5,
    40,
    2
  );

  assert.equal(first.tiles[12].animation, undefined);
  assert.equal(next.tiles[12].animation, "water");
  assert.equal(next.revision, 2);
});
