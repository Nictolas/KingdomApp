import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { applicaLuttoFamiliareERimuoviMorti } from "../src/game/soddisfazione";
import type { Abitante } from "../src/types";

function abitante(id: number, nome: string, extra: Partial<Abitante> = {}): Abitante {
  return {
    id,
    nome,
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
    religione: "Ateo",
    ...extra
  } as Abitante;
}

test("un omicidio applica il lutto ai familiari e rimuove la vittima", () => {
  const vittima = abitante(2, "Vittima", {
    coniugeId: 3,
    genitoriIds: [4],
    figliIds: [5]
  });
  const coniuge = abitante(3, "Coniuge");
  const genitore = abitante(4, "Genitore", { figliIds: [2, 6] });
  const figlio = abitante(5, "Figlio", { genitoriIds: [2] });
  const fratello = abitante(6, "Fratello", { genitoriIds: [4] });

  const result = applicaLuttoFamiliareERimuoviMorti(
    [vittima, coniuge, genitore, figlio, fratello],
    new Set([2])
  );

  assert.equal(result.some((a) => a.id === 2), false);
  for (const id of [3, 4, 5, 6]) {
    const superstite = result.find((a) => a.id === id)!;
    const lutto = superstite.modificatoriSoddisfazione?.find((m) => m.id === "lutto_familiare");
    assert.equal(lutto?.delta, -1);
    assert.equal(lutto?.durata, "permanente");
  }
});

test("avanzaMese collega gli omicidi al lutto familiare", () => {
  const source = readFileSync("src/game/avanzaMese.ts", "utf8");
  assert.match(source, /applicaLuttoFamiliareERimuoviMorti\(abitantiConReatiOmicidio, idsVittime\)/);
});
