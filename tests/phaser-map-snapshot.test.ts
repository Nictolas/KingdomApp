import assert from "node:assert/strict";
import test from "node:test";

import { OVERWORLD_SHEET_PX, getStradaSheetCoord } from "../src/game/overworldSpritesheetLayout.ts";
import type { MappaRuntimeState } from "../src/game/mappaTypes.ts";
import { buildStradaAssetLookup } from "../src/game/terrainSpriteHelpers.ts";
import { buildPhaserMapSnapshot } from "../src/phaser/adapters/buildPhaserMapSnapshot.ts";

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
