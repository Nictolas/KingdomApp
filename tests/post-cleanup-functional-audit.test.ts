import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { MINIERA_EDIFICIO } from "../src/game/mappaEdificiStatici.ts";
import { EDIFICIO_TO_ROUTE } from "../src/game/mappaEdificioRoutes.ts";
import { abitanteDeveAndareAlCultoOra } from "../src/game/presenzaLuogoCulto.ts";
import type { MappaRuntimeState } from "../src/game/mappaTypes.ts";
import { buildPhaserBuildings } from "../src/phaser/adapters/buildPhaserMapSnapshot.ts";

test("audit: route fantasy critiche sono coerenti", () => {
  assert.equal(EDIFICIO_TO_ROUTE.Castello, "/castello");
  assert.equal(EDIFICIO_TO_ROUTE.Porto, "/porto");
  assert.equal(EDIFICIO_TO_ROUTE.Miniera, "/miniera");

  for (const legacy of [
    "Spazioporto",
    "Centro di Comando",
    "Centrale Energetica",
    "Raffineria Mineraria"
  ]) {
    assert.equal(EDIFICIO_TO_ROUTE[legacy], undefined);
  }
});

test("audit: il Giacimento viene trasformato nella Miniera canonica", () => {
  assert.deepEqual(MINIERA_EDIFICIO, { id: 3, nome: "Miniera", emoji: "⛏️" });

  const mappa = readFileSync("app/mappa.tsx", "utf8");
  assert.match(mappa, /MINIERA_EDIFICIO/);
  assert.match(mappa, /Trasformare in Miniera/);
  assert.doesNotMatch(mappa, /Raffineria Mineraria|RAFFINERIA_MINERARIA/);
});

test("audit: Phaser usa Castello fantasy e fallback neutro per Porto", () => {
  const state: MappaRuntimeState = {
    edificiInMappa: {
      6: { id: 1, nome: "Castello", emoji: "🏰", footprint: { w: 3, h: 2 } },
      20: { id: 19, nome: "Porto", emoji: "⚓", footprint: { w: 4, h: 3 } },
      40: { id: 31, nome: "Luogo di Culto delle Ombre", emoji: "🌑", footprint: { w: 2, h: 2 } }
    },
    terrenoInMappa: {},
    decorazioniInMappa: {},
    residenzeMappa: {}
  };

  const buildings = buildPhaserBuildings(state, 10, 10);
  const castello = buildings.find((b) => b.name === "Castello");
  const porto = buildings.find((b) => b.name === "Porto");
  const ombre = buildings.find((b) => b.name === "Luogo di Culto delle Ombre");

  assert.equal(castello?.artKey, "castle");
  assert.equal(porto?.artKey, undefined);
  assert.equal(porto?.widthCells, 4);
  assert.equal(porto?.heightCells, 3);
  assert.equal(ombre?.category, "religion");
  assert.equal(ombre?.emoji, "🌑");
});

test("audit: i fedeli delle Ombre partecipano alla fascia di preghiera", () => {
  const ombre = { id: 101, razza: "Umano", religione: "Culto delle Ombre" } as any;
  const sole = { id: 102, razza: "Umano", religione: "Culto del Sole" } as any;
  const senzaCulto = { id: 103, razza: "Umano", religione: "Nessuna" } as any;
  const golem = { id: 104, razza: "Golem", religione: "Culto delle Ombre" } as any;

  assert.equal(abitanteDeveAndareAlCultoOra(ombre, 10 * 60 + 30, 0, []), true);
  assert.equal(abitanteDeveAndareAlCultoOra(sole, 10 * 60 + 30, 0, []), true);
  assert.equal(abitanteDeveAndareAlCultoOra(senzaCulto, 10 * 60 + 30, 0, []), false);
  assert.equal(abitanteDeveAndareAlCultoOra(golem, 10 * 60 + 30, 0, []), false);
});

test("audit: gli asset sci-fi rimossi non sono più presenti", () => {
  assert.equal(existsSync("assets/buildings/spazioporto-4x3.png"), false);
  assert.equal(existsSync("assets/pixel-art/characters/human-colonist.png"), false);
  assert.equal(existsSync("assets/pixel-art/buildings/command-center.png"), false);
  assert.equal(existsSync("assets/pixel-art/buildings/castle.png"), true);
});
