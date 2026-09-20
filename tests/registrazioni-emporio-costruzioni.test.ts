import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  formatRegistrazioneScambio,
  voceRegistrazioneCostruzione
} from "../src/game/registrazioniScambi";

test("costruzione è rappresentabile nel registro anche senza costo in monete", () => {
  const voce = {
    ...voceRegistrazioneCostruzione({
      reId: 1,
      reNome: "Aldo",
      itemId: "edificio-35",
      itemNome: "Emporio",
      itemEmoji: "🧺",
      prezzoMonete: 0
    }),
    id: "c1",
    giorno: 2,
    minutiDaMezzanotte: 600
  };
  assert.equal(voce.tipo, "costruzione");
  assert.match(formatRegistrazioneScambio(voce), /ha costruito Emporio/);
});

test("runtime registra scambi Emporio e costruzioni", () => {
  const hook = readFileSync("src/hooks/useGameState.ts", "utf8");
  const pasti = readFileSync("src/game/pastoGiornaliero.ts", "utf8");
  const emporio = readFileSync("src/game/emporioVendita.ts", "utf8");
  const context = readFileSync("src/context/GameContext.tsx", "utf8");

  assert.match(emporio, /EmporioScambio/);
  assert.match(pasti, /scambiEmporio/);
  assert.match(hook, /result\.scambiEmporio/);
  assert.match(hook, /luogoNome: "Emporio"/);
  assert.match(hook, /voceRegistrazioneCostruzione/);
  assert.match(hook, /costoMonete/);
  assert.match(hook, /seedCassaImpresaSeMancante/);
  assert.match(context, /costoMonete\?: number/);
});
