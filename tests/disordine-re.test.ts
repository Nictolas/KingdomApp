import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Abitante, Edificio } from "../src/types.ts";
import {
  applicaEffettiDisordineMensile,
  applicaMoltiplicatoreProduzione,
  edificioBuffVisitaCorrente,
  reNascostoInEdificio,
  tentaAttentatoAlRe
} from "../src/game/disordineRe.ts";
import { BONUS_PRODUZIONE_VISITA } from "../src/game/reModalita.ts";

function stubAbitante(partial: Partial<Abitante> & Pick<Abitante, "id" | "nome">): Abitante {
  return {
    emoji: "👤",
    eta: 30,
    lavoro: "Disoccupato",
    competenza: 50,
    produttività: 50,
    stanchezza: 0,
    personalità: "Tiepido",
    amici: [],
    rivali: [],
    fazioni: [],
    peso: 50,
    salute: 80,
    reddito: 0,
    spese: 0,
    paura: 20,
    felicità: 50,
    religione: "Ateo",
    ...partial
  };
}

describe("disordineRe", () => {
  it("buff visita solo in modalità in_visita su edificio operativo", () => {
    const edifici: Edificio[] = [
      {
        id: 34,
        nome: "Fucina",
        emoji: "🔥",
        tipo: "Industria",
        descrizione: "",
        capacità: 4,
        occupazione: 0,
        abitantiAssegnati: [],
        efficienza: 80,
        manutenzione: 0,
        stato: "Operativo",
        livello: 1
      }
    ];
    assert.equal(
      edificioBuffVisitaCorrente({ modalitaRe: "in_visita", edificioVisitaReId: 34 }, edifici),
      34
    );
    assert.equal(
      edificioBuffVisitaCorrente({ modalitaRe: "a_giro", edificioVisitaReId: 34 }, edifici),
      null
    );
    assert.equal(applicaMoltiplicatoreProduzione(100, true), Math.floor(100 * BONUS_PRODUZIONE_VISITA));
  });

  it("protesta sottrae monete", () => {
    const r = applicaEffettiDisordineMensile("protesta", 200, [], [], () => 0);
    assert.ok(r.moneteGiocatore < 200);
    assert.ok(r.messaggi.length >= 1);
  });

  it("re nascosto in castello e in visita", () => {
    assert.equal(reNascostoInEdificio("nel_castello"), true);
    assert.equal(reNascostoInEdificio("in_visita"), true);
    assert.equal(reNascostoInEdificio("a_giro"), false);
  });

  it("attentato richiede vulnerabilità e candidati Ostili attentato", () => {
    const re = stubAbitante({ id: 1, nome: "Re", lavoro: "Re", salute: 80 });
    const psico = stubAbitante({
      id: 2,
      nome: "Psico",
      personalità: "Psicopatico",
      modificatoriSoddisfazione: [
        { id: "lutto_familiare", delta: -5, motivo: "x", durata: "permanente" }
      ]
    });
    const nessuno = tentaAttentatoAlRe({
      abitanti: [re, psico],
      edifici: [],
      modalitaRe: "nel_castello",
      giornoGioco: 1,
      mese: 1,
      anno: 1,
      rng: () => 0
    });
    assert.equal(nessuno.esito.tipo, "nessuno");

    const tentato = tentaAttentatoAlRe({
      abitanti: [re, psico],
      edifici: [],
      modalitaRe: "a_giro",
      giornoGioco: 1,
      mese: 1,
      anno: 1,
      rng: () => 0
    });
    assert.notEqual(tentato.esito.tipo, "nessuno");
  });
});
