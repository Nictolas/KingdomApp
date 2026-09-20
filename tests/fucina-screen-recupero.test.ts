import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("Fucina usa la schermata Impresa ed è collegata alla mappa", () => {
  const screen = readFileSync("src/ui/ImpresaScreen.tsx", "utf8");
  const fucina = readFileSync("app/fucina.tsx", "utf8");
  const generic = readFileSync("app/impresa/[id].tsx", "utf8");
  const routes = readFileSync("src/game/mappaEdificioRoutes.ts", "utf8");

  assert.match(screen, /Cassa Impresa/);
  assert.match(screen, /getFatturatoMeseImpresa/);
  assert.match(screen, /setStipendioEdificio/);
  assert.match(screen, /assegnaServoDellaGlebaAEdificio/);
  assert.match(screen, /def\.produce/);
  assert.match(screen, /def\.compra/);
  assert.match(fucina, /nomeAtteso="Fucina"/);
  assert.match(generic, /ImpresaScreen/);
  assert.match(routes, /"Fucina": "\/fucina"/);
});
