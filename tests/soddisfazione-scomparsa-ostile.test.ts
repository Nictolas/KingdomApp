import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { applicaScomparsaOstileMensile } from "../src/game/disordineSoddisfazione";
import type { Abitante, Edificio } from "../src/types";

function abitante(
  id: number,
  personalità: string,
  ostile: boolean,
  extra: Partial<Abitante> = {}
): Abitante {
  return {
    id,
    nome: `Abitante ${id}`,
    emoji: "🙂",
    eta: 30,
    lavoro: "Disoccupato",
    competenza: 50,
    produttività: 50,
    stanchezza: 0,
    personalità,
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
    religione: "Ateo",
    modificatoriSoddisfazione: ostile
      ? [
          {
            id: "test_ostile",
            delta: -5,
            motivo: "Test",
            durata: "permanente"
          }
        ]
      : undefined,
    ...extra
  } as Abitante;
}

function edificio(assegnati: number[]): Edificio {
  return {
    id: 10,
    nome: "Officina",
    tipo: "Produzione",
    stato: "Operativo",
    efficienza: 80,
    capacità: 10,
    occupazione: assegnati.length,
    abitantiAssegnati: assegnati
  } as Edificio;
}

test("un Ostile Depresso scompare senza generare lutto", () => {
  const scomparso = abitante(2, "Depresso", true, { coniugeId: 3 });
  const coniuge = abitante(3, "Pragmatico", false, { coniugeId: 2 });

  const result = applicaScomparsaOstileMensile(
    [scomparso, coniuge],
    [edificio([2, 3])],
    31,
    2,
    0,
    () => 0
  );

  assert.equal(result.scomparsoId, 2);
  assert.equal(result.abitanti.some((a) => a.id === 2), false);

  const superstite = result.abitanti.find((a) => a.id === 3)!;
  assert.equal(superstite.coniugeId, undefined);
  assert.equal(
    superstite.modificatoriSoddisfazione?.some((m) => m.id === "lutto_familiare") ?? false,
    false
  );

  assert.deepEqual(result.edifici[0]?.abitantiAssegnati, [3]);
  assert.equal(result.edifici[0]?.occupazione, 1);
  assert.match(result.messaggio ?? "", /Scomparsa/);
});

test("un Depresso non Ostile non scompare", () => {
  const abitanti = [abitante(2, "Depresso", false)];
  const edifici = [edificio([2])];

  const result = applicaScomparsaOstileMensile(
    abitanti,
    edifici,
    31,
    2,
    0,
    () => 0
  );

  assert.equal(result.scomparsoId, null);
  assert.equal(result.abitanti.length, 1);
  assert.deepEqual(result.edifici[0]?.abitantiAssegnati, [2]);
});

test("il cambio mese automatico salva la scomparsa e la registra nel Diario", () => {
  const source = readFileSync("src/hooks/useGameState.ts", "utf8");

  assert.match(source, /applicaScomparsaOstileMensile/);
  assert.match(source, /setAbitanti\(scomparsa\.abitanti\)/);
  assert.match(source, /scomparsa\.messaggio/);
});
