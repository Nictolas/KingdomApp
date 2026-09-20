import assert from "node:assert/strict";
import test from "node:test";

import {
  modificatoreAncoraAttivo,
  upsertModificatore
} from "../src/game/soddisfazione";
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
} satisfies Abitante;

test("il modificatore mensile del prelievo resta attivo fino al mese di scadenza", () => {
  const mod = {
    id: "prelievo_forzoso",
    delta: -3,
    motivo: "Prelievo forzoso",
    durata: "mensile" as const,
    scadeMese: 3,
    scadeAnno: 1
  };

  assert.equal(modificatoreAncoraAttivo(mod, 0, 2, 1), true);
  assert.equal(modificatoreAncoraAttivo(mod, 0, 3, 1), false);
});

test("upsertModificatore sostituisce un modificatore con lo stesso id", () => {
  const conVecchio = upsertModificatore(base, {
    id: "prelievo_forzoso",
    delta: -3,
    motivo: "Prelievo",
    durata: "mensile",
    scadeMese: 2,
    scadeAnno: 1
  });

  const aggiornato = upsertModificatore(conVecchio, {
    id: "prelievo_forzoso",
    delta: -3,
    motivo: "Nuovo prelievo",
    durata: "mensile",
    scadeMese: 4,
    scadeAnno: 1
  });

  const mods = aggiornato.modificatoriSoddisfazione ?? [];
  assert.equal(mods.length, 1);
  assert.equal(mods[0]?.motivo, "Nuovo prelievo");
  assert.equal(mods[0]?.scadeMese, 4);
});
