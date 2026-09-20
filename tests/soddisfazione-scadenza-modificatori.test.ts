import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { pulisciModificatoriScaduti } from "../src/game/soddisfazione";
import type { Abitante } from "../src/types";

const base = {
  id: 2,
  nome: "Test",
  emoji: "🙂",
  eta: 30,
  lavoro: "Disoccupato",
  competenza: 50,
  produttività: 50,
  stanchezza: 0,
  personalità: "Pragmatico",
  amici: [],
  rivali: [],
  fazioni: [],
  peso: 50,
  salute: 100,
  reddito: 0,
  spese: 0,
  lealtà: 50,
  paura: 0,
  felicità: 50,
  religione: "Ateo"
} as Abitante;

test("rimuove modificatori giornalieri scaduti ma conserva i permanenti", () => {
  const abitante: Abitante = {
    ...base,
    modificatoriSoddisfazione: [
      {
        id: "pasto_giorno",
        delta: 1,
        motivo: "Ha mangiato",
        durata: "giornaliero",
        scadeGiorno: 5
      },
      {
        id: "lutto_familiare",
        delta: -1,
        motivo: "Morte di un familiare",
        durata: "permanente"
      }
    ]
  };

  const pulito = pulisciModificatoriScaduti(abitante, 5, 1, 0);
  assert.equal(pulito.modificatoriSoddisfazione?.some((m) => m.id === "pasto_giorno"), false);
  assert.equal(pulito.modificatoriSoddisfazione?.some((m) => m.id === "lutto_familiare"), true);
});

test("rimuove il malus mensile quando arriva il mese di scadenza", () => {
  const abitante: Abitante = {
    ...base,
    modificatoriSoddisfazione: [
      {
        id: "prelievo_forzoso",
        delta: -3,
        motivo: "Prelievo forzoso",
        durata: "mensile",
        scadeMese: 2,
        scadeAnno: 0
      }
    ]
  };

  assert.equal(
    pulisciModificatoriScaduti(abitante, 30, 1, 0).modificatoriSoddisfazione?.length,
    1
  );
  assert.equal(
    pulisciModificatoriScaduti(abitante, 31, 2, 0).modificatoriSoddisfazione,
    undefined
  );
});

test("la pulizia è collegata sia al giorno sia al cambio mese automatico", () => {
  const source = readFileSync("src/hooks/useGameState.ts", "utf8");

  assert.match(
    source,
    /pulisciModificatoriScaduti\(a, giorno, meseRef\.current, annoRef\.current\)/
  );
  assert.match(
    source,
    /pulisciModificatoriScaduti\(a, giornoGioco, result\.nuovoMese, result\.nuovoAnno\)/
  );
});
