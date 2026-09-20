import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { OGGETTI_CATALOGO } from "../src/data/oggettiCatalogo";

test("catalogo Oggetti recupera materiali e valori di mercato", () => {
  const byId = new Map(OGGETTI_CATALOGO.map((o) => [o.id, o]));

  assert.equal(byId.get("funghi")?.valore, 1);
  assert.equal(byId.get("legno")?.valore, 2);
  assert.equal(byId.get("pelli-e-pellicce")?.valore, 4);
  assert.equal(byId.get("minerali-rari")?.valore, 12);
  assert.equal(byId.get("arma")?.valore, 25);
  assert.equal(byId.get("oggetto-raro-magico")?.valoreAperto, true);
});

test("pagina Oggetti usa il catalogo completo", () => {
  const page = readFileSync("app/oggetti.tsx", "utf8");
  assert.match(page, /OGGETTI_CATALOGO/);
  assert.match(page, /Tipologia/);
  assert.match(page, /Valore/);
  assert.match(page, /formatValoreOggetto/);
});
