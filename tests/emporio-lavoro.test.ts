import assert from "node:assert/strict";
import test from "node:test";

import {
  assumiDisoccupatoInEmporio,
  CAPACITA_COMMERCIANTI_EMPORIO,
  disoccupatoIdoneoPerEmporio,
  emporioHaPostoLibero,
  postiLiberiEmporio
} from "../src/game/emporioLavoro.ts";
import type { Abitante, Edificio } from "../src/types.ts";

function stubAbitante(partial: Partial<Abitante> & Pick<Abitante, "id" | "nome" | "lavoro">): Abitante {
  return {
    eta: 30,
    sesso: "M",
    razza: "Umano",
    felicità: 50,
    paura: 0,
    produttività: 50,
    competenza: 40,
    stanchezza: 0,
    personalità: "Tiepido",
    religione: "Ateo",
    orientamento: "Etero",
    fazioni: [],
    ...partial
  } as Abitante;
}

function stubEmporio(assegnati: number[] = []): Edificio {
  return {
    id: 35,
    nome: "Emporio",
    emoji: "🧺",
    tipo: "Commercio",
    descrizione: "",
    capacità: CAPACITA_COMMERCIANTI_EMPORIO,
    occupazione: assegnati.length,
    abitantiAssegnati: assegnati,
    efficienza: 85,
    manutenzione: 0,
    stato: "Operativo",
    livello: 1
  };
}

test("Emporio ha al massimo 4 posti", () => {
  assert.equal(CAPACITA_COMMERCIANTI_EMPORIO, 4);
  assert.equal(postiLiberiEmporio(stubEmporio([1, 2, 3])), 1);
  assert.equal(postiLiberiEmporio(stubEmporio([1, 2, 3, 4])), 0);
  assert.equal(emporioHaPostoLibero([stubEmporio([1, 2, 3, 4])]), undefined);
});

test("Disoccupato assunto in Emporio diventa Mercante", () => {
  const ab = stubAbitante({ id: 7, nome: "Luca", lavoro: "Disoccupato" });
  assert.equal(disoccupatoIdoneoPerEmporio(ab), true);
  const r = assumiDisoccupatoInEmporio([ab], [stubEmporio()], 7);
  assert.equal(r.ok, true);
  assert.equal(r.abitanti[0]!.lavoro, "Mercante");
  assert.deepEqual(r.edifici[0]!.abitantiAssegnati, [7]);
  assert.equal(r.edifici[0]!.occupazione, 1);
});

test("quinto Disoccupato non entra se Emporio pieno", () => {
  const ab = stubAbitante({ id: 9, nome: "Eva", lavoro: "Disoccupato" });
  const r = assumiDisoccupatoInEmporio([ab], [stubEmporio([1, 2, 3, 4])], 9);
  assert.equal(r.ok, false);
  assert.equal(r.abitanti[0]!.lavoro, "Disoccupato");
});
