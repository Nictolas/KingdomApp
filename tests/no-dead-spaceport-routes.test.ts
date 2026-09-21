import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("Spazioporto legacy non apre più una route rimossa", () => {
  const mapRoutes = readFileSync("src/game/mappaEdificioRoutes.ts", "utf8");
  const buildingRoutes = readFileSync("src/navigation/edificioRoutes.ts", "utf8");

  assert.doesNotMatch(mapRoutes, /\/spazioporto/);
  assert.doesNotMatch(buildingRoutes, /\/spazioporto/);
});
