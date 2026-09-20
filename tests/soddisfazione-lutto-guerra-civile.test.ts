import assert from "node:assert/strict";
import test from "node:test";

import { eventoGuerraCivile } from "../src/game/eventi/guerraCivile";
import type { Abitante, Edificio, Risorsa } from "../src/types";

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

test("una vittima della Guerra Civile applica il lutto ai familiari", () => {
  const vittima = abitante(2, "Vittima", {
    fazioni: ["Lealisti"],
    coniugeId: 3
  });
  const coniuge = abitante(3, "Coniuge", {
    coniugeId: 2
  });
  const abitanti = [vittima, coniuge];
  const edifici: Edificio[] = [];
  const risorse: Risorsa[] = [];

  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    eventoGuerraCivile.applicaMensile(risorse, abitanti, edifici);
  } finally {
    Math.random = originalRandom;
  }

  assert.equal(abitanti.some((a) => a.id === 2), false);
  const superstite = abitanti.find((a) => a.id === 3)!;
  const lutto = superstite.modificatoriSoddisfazione?.find((m) => m.id === "lutto_familiare");
  assert.equal(lutto?.delta, -1);
  assert.equal(lutto?.durata, "permanente");
});
