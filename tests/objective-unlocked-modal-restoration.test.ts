import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("il completamento del Primo Ponte apre il popup obiettivo", () => {
  const mappa = readFileSync("app/mappa.tsx", "utf8");
  const modal = readFileSync("src/ui/ObiettivoSbloccatoModal.tsx", "utf8");

  assert.match(mappa, /obiettiviCompletatiPrevRef/);
  assert.match(mappa, /primo_ponte/);
  assert.match(mappa, /Il tuo primo Ponte è pronto e attraversabile!/);
  assert.match(mappa, /ObiettivoSbloccatoModal/);
  assert.match(mappa, /router\.push\("\/obiettivi"\)/);
  assert.match(modal, /Vedi gli altri Obiettivi/);
});
