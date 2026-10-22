import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { deriveBuildingGeometry } from "../src/game/buildingGeometry.ts";
import {
  locateBuildingAtPoint,
  resolveLocateTrackingPosition
} from "../src/phaser/adapters/locateTracking.ts";
import type { PhaserMapBuilding } from "../src/phaser/adapters/mapSceneBridge.ts";

const cols = 15;
const cellSize = 64;
const anchor = 7 * cols + 3;
const geometry = deriveBuildingGeometry(anchor, 2, 2, cols, 18);
const bar: PhaserMapBuilding = {
  anchor, geometry, widthCells: 2, heightCells: 2,
  name: "Bar", category: "service", emoji: "🍺"
};

test("Individua segue la posizione tween fra due celle, non soltanto la cella logica", () => {
  const initial = resolveLocateTrackingPosition({ x: 64, y: 128 }, 16, cols, cellSize, []);
  const moving = resolveLocateTrackingPosition({ x: 91.5, y: 136.25 }, 16, cols, cellSize, []);
  assert.deepEqual(moving.focus, { x: 91.5, y: 136.25 });
  assert.deepEqual(moving.arrow, { x: 91.5, y: 136.25 - cellSize * 0.95 });
  assert.notDeepEqual(moving.focus, initial.focus);
  assert.equal(moving.buildingAnchor, null);
});

test("nel Bar la freccia è centrata sopra il tetto, non vicino alla porta inferiore", () => {
  const inside = {
    x: (geometry.footprint.col + 1.5) * cellSize,
    y: (geometry.footprint.row + 1.65) * cellSize
  };
  const target = resolveLocateTrackingPosition(inside, geometry.doorCell, cols, cellSize, [bar]);
  assert.equal(target.buildingAnchor, anchor);
  assert.deepEqual(target.focus, inside, "la camera segue ancora il personaggio");
  assert.equal(target.arrow.x, (geometry.footprint.col + 1) * cellSize);
  assert.ok(target.arrow.y < geometry.footprint.row * cellSize, "freccia sopra il tetto");
});

test("all'uscita dal Bar la freccia riprende a seguire direttamente il personaggio", () => {
  const outside = {
    x: (geometry.footprint.col + 1.5) * cellSize,
    y: (geometry.footprint.row + 2.4) * cellSize
  };
  const target = resolveLocateTrackingPosition(outside, geometry.doorCell, cols, cellSize, [bar]);
  assert.equal(target.buildingAnchor, null);
  assert.equal(target.arrow.x, outside.x);
  assert.equal(target.arrow.y, outside.y - cellSize * 0.95);
});

test("la freccia della residenza illustrata resta sopra anche ai tetti sporgenti", () => {
  const dormitory = { ...bar, name: "Dormitorio", artKey: "dormitory" as const };
  const normal = resolveLocateTrackingPosition(
    { x: 3.5 * cellSize, y: 8.1 * cellSize }, geometry.doorCell, cols, cellSize, [bar]
  );
  const illustrated = resolveLocateTrackingPosition(
    { x: 3.5 * cellSize, y: 8.1 * cellSize }, geometry.doorCell, cols, cellSize, [dormitory]
  );
  assert.equal(illustrated.buildingAnchor, anchor);
  assert.ok(illustrated.arrow.y < normal.arrow.y);
});

test("un edificio illustrato usa il bordo reale del tetto, non l'offset stimato", () => {
  const greenhouse = { ...bar, name: "Serra", artKey: "greenhouse" as const };
  const inside = {
    x: (geometry.footprint.col + 1.5) * cellSize,
    y: (geometry.footprint.row + 1.5) * cellSize
  };

  // Esempio realistico: lo sprite è alto più del footprint e sporge
  // di 2,2 celle. Il vecchio offset di 0,75 celle cadeva sulla facciata.
  const roofTop = geometry.footprint.row * cellSize - cellSize * 2.2;
  const measured = resolveLocateTrackingPosition(
    inside,
    geometry.doorCell,
    cols,
    cellSize,
    [greenhouse],
    new Map([[anchor, roofTop]])
  );
  const previousEstimate = resolveLocateTrackingPosition(
    inside,
    geometry.doorCell,
    cols,
    cellSize,
    [greenhouse]
  );
  assert.equal(measured.buildingAnchor, anchor);
  assert.ok(measured.arrow.y < roofTop, "la freccia deve stare sopra il vero tetto");
  assert.ok(previousEstimate.arrow.y > roofTop, "la vecchia posizione finiva sull'edificio");
  assert.deepEqual(measured.focus, inside, "il tracking della camera non deve cambiare");
});

test("il tetto misurato viene aggiornato se l'edificio cambia dimensione o posizione", () => {
  const inside = {
    x: (geometry.footprint.col + 0.5) * cellSize,
    y: (geometry.footprint.row + 0.5) * cellSize
  };
  const firstRoof = 3 * cellSize;
  const secondRoof = 2.5 * cellSize;
  const roofs = new Map([[anchor, firstRoof]]);
  const first = resolveLocateTrackingPosition(inside, geometry.doorCell, cols, cellSize, [bar], roofs);
  roofs.set(anchor, secondRoof);
  const second = resolveLocateTrackingPosition(inside, geometry.doorCell, cols, cellSize, [bar], roofs);
  assert.equal(second.arrow.y - first.arrow.y, secondRoof - firstRoof);
});

test("Phaser misura lo sprite scalato e passa il tetto reale al calcolo Individua", () => {
  const source = readFileSync(new URL("../src/phaser/scenes/KingdomMapScene.ts", import.meta.url), "utf8");
  assert.match(source, /renderedRoofTopByAnchor = new Map<number, number>\(\)/);
  assert.match(source, /this\.renderedRoofTopByAnchor\.clear\(\)/);
  assert.match(source, /this\.renderedRoofTopByAnchor\.set\(building\.anchor, y \+ height - image\.displayHeight\)/);
  assert.match(source, /snapshot\.buildings,\s*this\.renderedRoofTopByAnchor\s*\)/);
});

test("lavoratore nascosto: freccia sopra la Serra nonostante la vecchia cella fuori dall'edificio", () => {
  const serra = { ...bar, name: "Serra", artKey: "greenhouse" as const };
  const staleCell = geometry.doorCell + cols * 2;
  const rooftop = geometry.footprint.row * cellSize - 1.2 * cellSize;
  const target = resolveLocateTrackingPosition(
    null,
    staleCell,
    cols,
    cellSize,
    [serra],
    new Map([[anchor, rooftop]]),
    anchor
  );
  assert.equal(target.buildingAnchor, anchor);
  assert.ok(target.arrow.y < rooftop);
  assert.equal(target.arrow.x, (geometry.footprint.col + geometry.footprint.width / 2) * cellSize);
  assert.deepEqual(target.focus, {
    x: (geometry.footprint.col + geometry.footprint.width / 2) * cellSize,
    y: (geometry.footprint.row + geometry.footprint.height / 2) * cellSize
  }, "la camera inquadra la Serra mentre il lavoratore è nascosto");
});

test("sede confermata prevale sulla posizione animata residua fuori dal perimetro", () => {
  const staleSprite = { x: (geometry.footprint.col + 3) * cellSize, y: (geometry.footprint.row + 2) * cellSize };
  const target = resolveLocateTrackingPosition(staleSprite, geometry.doorCell, cols, cellSize, [bar], undefined, anchor);
  assert.equal(target.buildingAnchor, anchor);
  assert.ok(target.arrow.y < geometry.footprint.row * cellSize);
});

test("quando il lavoratore riparte, la freccia torna sul personaggio e non sulla sede", () => {
  const outside = { x: (geometry.footprint.col + 3) * cellSize, y: (geometry.footprint.row + 2) * cellSize };
  const target = resolveLocateTrackingPosition(outside, geometry.doorCell, cols, cellSize, [bar], undefined, null);
  assert.equal(target.buildingAnchor, null);
  assert.equal(target.arrow.x, outside.x);
});

test("la mappa collega l'occupazione lavorativa all'edificio, anche con sprite nascosto", () => {
  const source = readFileSync(new URL("../app/mappa.tsx", import.meta.url), "utf8");
  const phaser = readFileSync(new URL("../src/phaser/scenes/KingdomMapScene.ts", import.meta.url), "utf8");
  assert.match(source, /lavoroArrivatiIds\.has\(locateAbitanteId\)/);
  assert.match(source, /primoEdificioLavoroOrarioPerAbitante\(/);
  assert.match(source, /trovaAnchorEdificioGlobaleSuMappa\(/);
  assert.match(source, /buildingAnchor: occupiedBuildingAnchor \?\? undefined/);
  assert.match(phaser, /this\.locateBuildingAnchor = marker\.buildingAnchor \?\? null/);
  assert.match(phaser, /this\.renderedRoofTopByAnchor,\s*this\.locateBuildingAnchor/);
});

test("un edificio sul bordo nord non fa uscire la freccia fuori dalla mappa", () => {
  const top = { ...bar, anchor: 3, geometry: deriveBuildingGeometry(3, 2, 2, cols, 18) };
  const target = resolveLocateTrackingPosition({ x: 4 * cellSize, y: cellSize }, 3, cols, cellSize, [top]);
  assert.equal(target.buildingAnchor, 3);
  assert.ok(target.arrow.y >= cellSize * 0.35);
});

test("Bosco e Ponte non vengono trattati come edifici con un tetto", () => {
  for (const name of ["Bosco", "Ponte"]) {
    assert.equal(locateBuildingAtPoint({ x: 4 * cellSize, y: 8 * cellSize }, [{ ...bar, name }], cellSize), undefined);
  }
});

test("quando lo sprite manca temporaneamente il fallback usa la cella e la geometria", () => {
  const target = resolveLocateTrackingPosition(null, geometry.doorCell, cols, cellSize, [bar]);
  assert.equal(target.buildingAnchor, anchor);
  assert.equal(target.focus.x, (geometry.doorCell % cols + 0.5) * cellSize);
  assert.ok(target.arrow.y < geometry.footprint.row * cellSize);
});

test("il loop Phaser segue il personaggio ogni frame e lascia il drag libero", () => {
  const source = readFileSync(new URL("../src/phaser/scenes/KingdomMapScene.ts", import.meta.url), "utf8");
  const update = source.match(/update\(time: number, delta: number\): void \{([\s\S]*?)\n    if \(this\.perfEnabled\)/)?.[1] ?? "";
  assert.match(update, /this\.syncLocateArrowPosition\(cellSize\)/);
  assert.match(update, /this\.followLocatedCharacter\(tracking\.focus, cellSize\)/);
  assert.match(source, /private followLocatedCharacter\([\s\S]*?this\.dragPointerId != null/);
  assert.match(source, /camera\.centerOn\(position\.x, position\.y\)/);
  assert.match(source, /this\.lastLocateCameraCullPosition = null/);
  assert.match(source, /this\.characterVisibilityDirty = true/);
});
