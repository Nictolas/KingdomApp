import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  assumiDisoccupatoNelBosco,
  boscoHaPostoLibero
} from "../src/game/boscoRaccolta";
import type { Abitante, Edificio } from "../src/types";

const disoccupato = {
  id: 21,
  nome: "Milo",
  lavoro: "Disoccupato",
  casta: "Cittadino",
  razza: "Umano",
  personalità: "Neutrale",
  inventario: [
    { itemId: "monete", quantità: 4 },
    { itemId: "mela", quantità: 1 }
  ]
} as Abitante;

const bosco = {
  id: 51,
  nome: "Bosco",
  stato: "Operativo",
  capacità: 20,
  occupazione: 0,
  abitantiAssegnati: []
} as unknown as Edificio;

test("Bosco con posto libero è destinazione valida", () => {
  assert.equal(boscoHaPostoLibero([bosco])?.id, 51);
});

test("arrivo al Bosco assume il disoccupato come Raccoglitore", () => {
  const result = assumiDisoccupatoNelBosco([disoccupato], [bosco], 21);
  assert.equal(result.ok, true);
  assert.equal(result.abitanti[0]?.lavoro, "Raccoglitore");
  assert.deepEqual(result.edifici[0]?.abitantiAssegnati, [21]);
  assert.ok(result.bottino?.voci.length);
});

test("mappa include Bosco nella cerca lavoro e GameState usa la logica speciale", () => {
  const map = readFileSync("app/mappa.tsx", "utf8");
  const commute = readFileSync("src/game/commutePathsMappa.ts", "utf8");
  const hook = readFileSync("src/hooks/useGameState.ts", "utf8");

  assert.match(commute, /boscoHaPostoLibero/);
  assert.match(commute, /disoccupatoIdoneoPerBosco/);
  assert.match(map, /cercaPercorsoLavoroDisoccupato\(/);
  assert.match(map, /puoCercareLavoroAutonomamente\(a\)/);
  assert.match(hook, /edificio\?\.nome === "Bosco"/);
  assert.match(hook, /assumiDisoccupatoNelBosco/);
  assert.match(hook, /etichettaRaccoltoBosco/);
});
