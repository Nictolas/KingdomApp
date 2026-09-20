import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("schermata Miniera mostra produzione pubblica e ultimo bottino", () => {
  const page = readFileSync("app/miniera.tsx", "utf8");
  const routes = readFileSync("src/game/mappaEdificioRoutes.ts", "utf8");

  assert.match(page, /Produzione del Regno/);
  assert.match(page, /Stipendio dal Tesoro/);
  assert.match(page, /METALLI_DEPOSITO_PER_MINATORE_GIORNO/);
  assert.match(page, /MATERIALE_EDILE_DEPOSITO_PER_MINATORE_GIORNO/);
  assert.match(page, /ultimoRaccoltoMiniera/);
  assert.match(page, /raggiungono fisicamente la Miniera/);
  assert.doesNotMatch(page, /Cassa Impresa/);
  assert.match(routes, /"Miniera": "\/miniera"/);
});
