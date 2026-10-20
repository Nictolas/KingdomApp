import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("Porto è ripristinato e collegato alla mappa", () => {
  const page = readFileSync("app/porto.tsx", "utf8");
  const routes = readFileSync("src/game/mappaEdificioRoutes.ts", "utf8");

  assert.match(page, /⚓ Porto/);
  assert.match(page, /router\.push\("\/mercato"\)/);
  assert.match(page, /router\.push\("\/immigrazione"\)/);
  assert.match(page, /router\.push\("\/regni"\)/);
  assert.match(page, /Regni|Terre lontane/);
  assert.match(routes, /"Porto": "\/porto"/);
});
