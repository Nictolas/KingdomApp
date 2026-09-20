import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("schermata Obiettivi recuperata e collegata al menu", () => {
  const page = readFileSync("app/obiettivi.tsx", "utf8");
  const menu = readFileSync("src/screens/GridGame.tsx", "utf8");

  assert.match(page, /OBIETTIVI_CATALOGO/);
  assert.match(page, /obiettiviSbloccati/);
  assert.match(page, /obiettiviCompletati/);
  assert.match(page, /modalitaGioco/);
  assert.doesNotMatch(page, /setModalitaGioco/);
  assert.match(menu, /router\.push\("\/obiettivi"\)/);
  assert.match(menu, />Obiettivi</);
});
