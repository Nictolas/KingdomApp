import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { BOTTINO_BOSCO } from "../src/game/boscoRaccolta";

test("schermata Bosco mostra raccolta e ultimo bottino", () => {
  const page = readFileSync("app/bosco.tsx", "utf8");
  const routes = readFileSync("src/game/mappaEdificioRoutes.ts", "utf8");

  assert.ok(BOTTINO_BOSCO.length >= 26);
  assert.match(page, /Raccolta spontanea/);
  assert.match(page, /1 o 2 oggetti naturali/);
  assert.match(page, /ultimoRaccoltoBosco/);
  assert.match(page, /Possibili bottini/);
  assert.match(page, /raggiungono fisicamente il Bosco/);
  assert.doesNotMatch(page, /Cassa Impresa/);
  assert.doesNotMatch(page, /Stipendio dal Tesoro/);
  assert.match(routes, /"Bosco": "\/bosco"/);
});
