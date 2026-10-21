import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  applicaRaccoltaMinieraGiornaliera,
  assumiDisoccupatoNellaMiniera,
  BOTTINO_MINIERA
} from "../src/game/minieraRaccolta";
import { OGGETTI_INVENTARIO } from "../src/game/inventario";
import type { Abitante, Edificio, Risorsa } from "../src/types";

const disoccupato = {
  id: 31,
  nome: "Bran",
  lavoro: "Disoccupato",
  casta: "Cittadino",
  razza: "Umano",
  personalità: "Neutrale",
  inventario: [
    { itemId: "monete", quantità: 3 },
    { itemId: "mela", quantità: 1 }
  ]
} as Abitante;

const minatore = { ...disoccupato, lavoro: "Minatore" } as Abitante;

const miniera = {
  id: 50,
  nome: "Miniera",
  stato: "Operativo",
  capacità: 20,
  occupazione: 1,
  abitantiAssegnati: [31]
} as Edificio;

const risorse = [
  { id: 1, nome: "Metalli", quantità: 5 },
  { id: 2, nome: "Materiale Edile", quantità: 7 }
] as Risorsa[];

test("tutti i bottini Miniera sono oggetti inventario validi", () => {
  for (const drop of BOTTINO_MINIERA) {
    assert.ok(OGGETTI_INVENTARIO[drop.itemId], drop.itemId);
  }
});

test("Minatore produce bottino personale e deposita risorse del Regno", () => {
  const result = applicaRaccoltaMinieraGiornaliera(
    [minatore],
    [miniera],
    risorse,
    2,
    1
  );
  assert.equal(result.bottini.length, 1);
  assert.equal(result.abitanti[0]?.ultimoRaccoltoMiniera?.giorno, 2);
  assert.equal(result.risorse.find((r) => r.nome === "Metalli")?.quantità, 11);
  assert.equal(result.risorse.find((r) => r.nome === "Materiale Edile")?.quantità, 13);
});

test("arrivo fisico in Miniera assume il disoccupato come Minatore", () => {
  const result = assumiDisoccupatoNellaMiniera(
    [disoccupato],
    [{ ...miniera, occupazione: 0, abitantiAssegnati: [] }],
    31
  );
  assert.equal(result.ok, true);
  assert.equal(result.abitanti[0]?.lavoro, "Minatore");
  assert.deepEqual(result.edifici[0]?.abitantiAssegnati, [31]);
  assert.ok(result.bottino?.voci.length);
});

test("runtime e mappa includono Miniera", () => {
  const hook = readFileSync("src/hooks/useGameState.ts", "utf8");
  const map = readFileSync("app/mappa.tsx", "utf8");

  assert.match(hook, /applicaRaccoltaMinieraGiornaliera/);
  assert.match(hook, /ultimoGiornoRaccoltaMinieraRef/);
  assert.match(hook, /edificio\?\.nome === "Miniera"/);
  assert.match(map, /cercaPercorsoLavoroDisoccupato/);
  assert.match(readFileSync("src/game/commutePathsMappa.ts", "utf8"), /minieraHaPostoLibero/);
});
