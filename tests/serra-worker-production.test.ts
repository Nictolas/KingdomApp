import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { PRODUZIONE_SERRA_GIORNALIERA } from "../src/game/colturaSerra";
import {
  applicaProduzioneSerraGiornaliera,
  calcolaProduzioneSerraMensile
} from "../src/game/produzioneSerra";
import type { Abitante, Edificio } from "../src/types";

const agricoltore = {
  id: 10,
  nome: "Ada",
  lavoro: "Agricoltore",
  casta: "Cittadino",
  razza: "Umano",
  personalità: "Neutrale",
  inventario: [
    { itemId: "monete", quantità: 5 },
    { itemId: "mela", quantità: 1 }
  ]
} as Abitante;

const serra = {
  id: 2,
  nome: "Serra",
  stato: "Operativo",
  capacità: 5,
  occupazione: 1,
  abitantiAssegnati: [10],
  colturaItemId: "mela"
} as Edificio;

test("Serra mantiene la produzione mensile nel calendario di cinque giorni", () => {
  assert.equal(PRODUZIONE_SERRA_GIORNALIERA, 12);
  const result = applicaProduzioneSerraGiornaliera([agricoltore], [serra], 2, 1);
  const ada = result.abitanti[0]!;
  assert.equal(
    ada.inventario?.find((v) => v.itemId === "mela")?.quantità,
    13
  );
  assert.equal(ada.ultimoRaccoltoSerra?.giorno, 2);
  assert.equal(ada.ultimoRaccoltoSerra?.voci[0]?.quantità, 12);
});

test("produzione mensile Serra dipende dal numero di Agricoltori", () => {
  assert.equal(calcolaProduzioneSerraMensile([serra]), 60);
  assert.equal(
    calcolaProduzioneSerraMensile([{ ...serra, abitantiAssegnati: [10, 11], occupazione: 2 }]),
    120
  );
});

test("runtime e schermata usano inventario personale Agricoltore", () => {
  const hook = readFileSync("src/hooks/useGameState.ts", "utf8");
  const page = readFileSync("app/serra.tsx", "utf8");

  assert.match(hook, /applicaProduzioneSerraGiornaliera/);
  assert.doesNotMatch(hook, /applicaProduzioneSerraInventarioGiocatore\(prev/);
  assert.match(page, /inventario personale/);
  assert.match(page, /produzionePerAgricoltore/);
});
