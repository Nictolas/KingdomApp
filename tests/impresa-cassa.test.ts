import assert from "node:assert/strict";
import test from "node:test";

import { isEdificioImpresa, isEdificioPubblicoConPostazioniLavoro } from "../src/game/edificiLavoro.ts";
import type { Edificio } from "../src/types.ts";

test("Bosco è impresa ma non posto pubblico", () => {
  const bosco = {
    id: 51,
    nome: "Bosco",
    emoji: "🌲",
    tipo: "Ambiente",
    descrizione: "",
    capacità: 20,
    occupazione: 0,
    abitantiAssegnati: [1],
    efficienza: 100,
    manutenzione: 0,
    stato: "Operativo",
    livello: 1
  } as Edificio;
  assert.equal(isEdificioImpresa(bosco), true);
  assert.equal(isEdificioPubblicoConPostazioniLavoro(bosco), false);
});
