import assert from "node:assert/strict";
import test from "node:test";

import { sediCercaLavoroDisoccupatoInOrdine } from "../src/game/commutePathsMappa.ts";
import type { Abitante, Edificio } from "../src/types.ts";

function stubAb(partial: Partial<Abitante> & Pick<Abitante, "id" | "nome" | "lavoro">): Abitante {
  return {
    eta: 25,
    sesso: "M",
    razza: "Umano",
    felicità: 50,
    paura: 0,
    produttività: 50,
    competenza: 50,
    stanchezza: 0,
    personalità: "Tiepido",
    religione: "Ateo",
    orientamento: "Etero",
    fazioni: ["Cittadini"],
    casta: "Cittadino",
    inventario: [{ itemId: "monete", quantità: 5 }],
    reddito: 0,
    spese: 0,
    peso: 50,
    salute: 80,
    emoji: "🧑",
    amici: [],
    rivali: [],
    ...partial
  } as Abitante;
}

function stubEd(partial: Partial<Edificio> & Pick<Edificio, "id" | "nome">): Edificio {
  return {
    emoji: "🏢",
    tipo: "Commercio",
    descrizione: "",
    capacità: 4,
    occupazione: 0,
    abitantiAssegnati: [],
    efficienza: 80,
    manutenzione: 0,
    stato: "Operativo",
    livello: 1,
    ...partial
  };
}

test("Bosco è sempre dopo le altre Imprese nella cerca lavoro", () => {
  const ab = stubAb({ id: 10, nome: "D", lavoro: "Disoccupato" });
  const edifici = [
    stubEd({ id: 51, nome: "Bosco", tipo: "Ambiente", capacità: 20 }),
    stubEd({ id: 35, nome: "Emporio", categoriaEconomica: "Impresa", capacità: 4 }),
    stubEd({ id: 17, nome: "Bar", categoriaEconomica: "Impresa", tipo: "Svago", capacità: 20 })
  ];
  const sedi = sediCercaLavoroDisoccupatoInOrdine(ab, edifici, [ab]);
  const nomi = sedi.map((e) => e.nome);
  assert.ok(nomi.includes("Emporio") || nomi.includes("Bar"));
  const idxBosco = nomi.indexOf("Bosco");
  assert.ok(idxBosco >= 0, "Bosco resta disponibile");
  assert.equal(idxBosco, nomi.length - 1, "Bosco deve essere ultima scelta");
  for (let i = 0; i < idxBosco; i++) {
    assert.notEqual(nomi[i], "Bosco");
  }
});

test("se Emporio è pieno si va al Bar prima del Bosco", () => {
  const ab = stubAb({ id: 11, nome: "E", lavoro: "Disoccupato" });
  const edifici = [
    stubEd({
      id: 35,
      nome: "Emporio",
      categoriaEconomica: "Impresa",
      capacità: 4,
      abitantiAssegnati: [1, 2, 3, 4],
      occupazione: 4
    }),
    stubEd({ id: 17, nome: "Bar", categoriaEconomica: "Impresa", tipo: "Svago", capacità: 20 }),
    stubEd({ id: 51, nome: "Bosco", tipo: "Ambiente", capacità: 20 })
  ];
  const sedi = sediCercaLavoroDisoccupatoInOrdine(ab, edifici, [ab]);
  assert.equal(sedi[0]?.nome, "Bar");
  assert.equal(sedi[sedi.length - 1]?.nome, "Bosco");
});
