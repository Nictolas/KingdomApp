import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  indiceCalendarioGioco,
  indiceMeseDaGiornoGioco,
  offsetMesiPerCalendarioSalvato
} from "../src/game/calendarioGioco";

test("il calendario cambia mese ogni 5 giorni dell'orologio continuo", () => {
  assert.equal(indiceMeseDaGiornoGioco(1), 0);
  assert.equal(indiceMeseDaGiornoGioco(5), 0);
  assert.equal(indiceMeseDaGiornoGioco(6), 1);
  assert.equal(indiceMeseDaGiornoGioco(10), 1);
  assert.equal(indiceMeseDaGiornoGioco(11), 2);
  assert.equal(indiceMeseDaGiornoGioco(61), 12);
  assert.equal(indiceCalendarioGioco(1, 1), 12);
});

test("i salvataggi legacy mantengono mese e anno già raggiunti", () => {
  const offset = offsetMesiPerCalendarioSalvato(15, 5, 0);
  assert.equal(indiceMeseDaGiornoGioco(15, offset), 4);
  assert.equal(indiceMeseDaGiornoGioco(20, offset), 5);
});

test("la mappa non espone più Skip Mese e il cambio mese è automatico", () => {
  const mappa = readFileSync("app/mappa.tsx", "utf8");
  const hook = readFileSync("src/hooks/useGameState.ts", "utf8");
  const context = readFileSync("src/context/GameContext.tsx", "utf8");
  const regole = readFileSync("app/regole.tsx", "utf8");

  assert.doesNotMatch(mappa, /Skip Mese/);
  assert.doesNotMatch(mappa, /onPress=\{avanzaMese\}/);
  assert.doesNotMatch(context, /avanzaMese:\s*\(\)/);
  assert.match(hook, /processaCambioMeseAutomatico/);
  assert.match(hook, /indiceMeseDaGiornoGioco\(giornoGioco/);
  assert.doesNotMatch(regole, /regole-skip|Regole Skip|skippi il mese/);
});
