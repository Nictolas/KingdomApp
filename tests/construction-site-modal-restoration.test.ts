import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("la mappa apre la scheda dei cantieri in costruzione", () => {
  const mappa = readFileSync("app/mappa.tsx", "utf8");
  const modal = readFileSync("src/ui/CantiereModal.tsx", "utf8");

  assert.match(mappa, /CantiereModal/);
  assert.match(mappa, /globale\?\.stato !== "In costruzione"/);
  assert.match(mappa, /setCantiereSelezionatoId\(globale\.id\)/);
  assert.match(mappa, /router\.push\("\/ufficio-edile"\)/);
  assert.match(modal, /progressoCostruzione/);
  assert.match(modal, /Lavoratori al cantiere/);
});
