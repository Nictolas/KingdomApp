import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  appendRegistrazioneScambio,
  formatRegistrazioneScambio,
  MAX_REGISTRAZIONI_SCAMBI,
  voceRegistrazioneRaccoltaBosco
} from "../src/game/registrazioniScambi";

test("registro conserva al massimo le ultime 200 voci", () => {
  let righe: any[] = [];
  for (let i = 0; i < MAX_REGISTRAZIONI_SCAMBI + 5; i++) {
    righe = appendRegistrazioneScambio(righe, {
      id: String(i),
      giorno: i + 1,
      minutiDaMezzanotte: 0,
      luogoEdificioId: 51,
      luogoNome: "Bosco",
      daId: null,
      daNome: "Bosco",
      aId: 10,
      aNome: "Ada",
      itemId: "legno",
      itemNome: "Legno",
      itemEmoji: "🪵",
      prezzoMonete: 0,
      tipo: "raccolta"
    });
  }
  assert.equal(righe.length, MAX_REGISTRAZIONI_SCAMBI);
  assert.equal(righe[0]?.id, "5");
});

test("raccolta Bosco produce una descrizione leggibile", () => {
  const voce = {
    ...voceRegistrazioneRaccoltaBosco({
      abitanteId: 10,
      abitanteNome: "Ada",
      boscoId: 51,
      itemId: "legno",
      itemNome: "Legno",
      itemEmoji: "🪵",
      quantità: 2
    }),
    id: "x",
    giorno: 3,
    minutiDaMezzanotte: 600
  };
  assert.match(formatRegistrazioneScambio(voce), /Ada ha trovato Legno ×2 nel Bosco/);
});

test("runtime, salvataggio e menu espongono Registrazioni", () => {
  const hook = readFileSync("src/hooks/useGameState.ts", "utf8");
  const mapping = readFileSync("src/persistence/gameStateMapping.ts", "utf8");
  const context = readFileSync("src/context/GameContext.tsx", "utf8");
  const grid = readFileSync("src/screens/GridGame.tsx", "utf8");
  const page = readFileSync("app/registrazioni.tsx", "utf8");

  assert.match(hook, /voceRegistrazioneRaccoltaSerra/);
  assert.match(hook, /voceRegistrazioneRaccoltaBosco/);
  assert.match(hook, /voceRegistrazioneRaccoltaMiniera/);
  assert.match(mapping, /registrazioniScambi/);
  assert.match(context, /registrazioniScambi/);
  assert.match(grid, /router\.push\("\/registrazioni"\)/);
  assert.match(page, /MAX_REGISTRAZIONI_SCAMBI/);
});
