import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("schermata Serra è ripristinata sopra la logica corrente", () => {
  const page = readFileSync("app/serra.tsx", "utf8");
  const routes = readFileSync("src/game/mappaEdificioRoutes.ts", "utf8");

  assert.match(page, /getColtureSerraDisponibili/);
  assert.match(page, /setColturaSerra/);
  assert.match(page, /coltureSerraSbloccate/);
  assert.match(page, /Agricoltori/);
  assert.match(page, /Pagato dal Tesoro/);
  assert.match(page, /PRODUZIONE_SERRA_GIORNALIERA/);
  assert.match(routes, /"Serra": "\/serra"/);
});
