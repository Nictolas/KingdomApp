import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";

test("le vecchie route Energia e Centrale Energetica non esistono più", () => {
  assert.equal(existsSync("app/energia.tsx"), false);
  assert.equal(existsSync("app/centrale-energetica.tsx"), false);

  const mapRoutes = readFileSync("src/game/mappaEdificioRoutes.ts", "utf8");
  const buildingRoutes = readFileSync("src/navigation/edificioRoutes.ts", "utf8");

  assert.doesNotMatch(mapRoutes, /Centrale Energetica|centrale-energetica/);
  assert.doesNotMatch(buildingRoutes, /Centrale Energetica|centrale-energetica|Centro di Comando/);
});
