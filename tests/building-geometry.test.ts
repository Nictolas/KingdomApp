import assert from "node:assert/strict";
import test from "node:test";

import { deriveBuildingGeometry, isBuildingInteriorCell } from "../src/game/buildingGeometry.ts";

test("la geometria edificio separa porta interna e ingresso esterno", () => {
  const geometry = deriveBuildingGeometry(7, 2, 2, 6, 6);
  assert.deepEqual(geometry.footprint, { col: 1, row: 1, width: 2, height: 2 });
  assert.equal(geometry.doorCell, 14);
  assert.equal(geometry.entryPoint.cell, 20);
  assert.equal(geometry.interiorSpawnPoint.cell, 14);
  assert.ok(geometry.collisionAreas.every((area) =>
    area.col + area.width <= geometry.doorway.col || area.col >= geometry.doorway.col + geometry.doorway.width || area.row !== geometry.doorway.row
  ));
});

test("isBuildingInteriorCell riconosce porta e footprint", () => {
  const geometry = deriveBuildingGeometry(6, 2, 2, 5, 5);
  assert.equal(isBuildingInteriorCell(geometry.doorCell, geometry, 5), true);
  assert.equal(isBuildingInteriorCell(geometry.entryPoint.cell, geometry, 5), false);
  assert.equal(isBuildingInteriorCell(6, geometry, 5), true);
});

test("un edificio sul bordo sud non produce coordinate fuori mappa", () => {
  const geometry = deriveBuildingGeometry(13, 2, 2, 5, 3);
  assert.ok(geometry.entryPoint.cell >= 0 && geometry.entryPoint.cell < 15);
  assert.ok(geometry.footprint.height >= 1);
});
