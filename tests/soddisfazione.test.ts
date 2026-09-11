import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Abitante, Edificio } from "../src/types.ts";
import {
  applicaLuttoFamiliareERimuoviMorti,
  calcolaPunteggioSoddisfazione,
  deltaCasaSituazionale,
  deltaPastoPerBisogni,
  fasciaDaPunteggio,
  snapshotSoddisfazioneAbitante
} from "../src/game/soddisfazione.ts";
import {
  SOGLIA_PROTESTA_OSTILI,
  SOGLIA_RIBELLIONE_OSTILI,
  tickModalitaReMensile,
  valutaFaseDisordine,
  STATO_RE_DEFAULT
} from "../src/game/reModalita.ts";

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

function stubCasa(nome: string, assegnati: number[]): Edificio {
  return {
    id: 100,
    nome,
    emoji: "🏠",
    tipo: "Residenza",
    descrizione: "",
    capacità: 10,
    occupazione: assegnati.length,
    abitantiAssegnati: assegnati,
    efficienza: 80,
    manutenzione: 0,
    stato: "Operativo",
    livello: 1
  };
}

describe("soddisfazione", () => {
  it("fasce da punteggio", () => {
    assert.equal(fasciaDaPunteggio(5), "Devoto");
    assert.equal(fasciaDaPunteggio(2), "Soddisfatto");
    assert.equal(fasciaDaPunteggio(0), "Neutrale");
    assert.equal(fasciaDaPunteggio(-2), "Insoddisfatto");
    assert.equal(fasciaDaPunteggio(-5), "Ostile");
  });

  it("casa: cittadino +1 in Capanna, nobile solo Attico/Villa", () => {
    const cittadino = stubAbitante({ id: 2, nome: "C", casta: "Cittadino" });
    const nobile = stubAbitante({ id: 3, nome: "N", casta: "Nobile" });
    const capanna = stubCasa("Capanna", [2, 3]);
    assert.equal(deltaCasaSituazionale(cittadino, [capanna]), 1);
    assert.equal(deltaCasaSituazionale(nobile, [capanna]), 0);
    const villa = stubCasa("Villa", [3]);
    assert.equal(deltaCasaSituazionale(nobile, [villa]), 1);
  });

  it("pasto: nobile vuole carne, vegano vegetali", () => {
    const nobile = stubAbitante({ id: 2, nome: "N", casta: "Nobile" });
    const vegano = stubAbitante({
      id: 3,
      nome: "V",
      casta: "Cittadino",
      alimentazione: "Vegano"
    });
    assert.equal(deltaPastoPerBisogni(nobile, "bistecca").delta, 1);
    assert.equal(deltaPastoPerBisogni(nobile, "mela").delta, 0);
    assert.equal(deltaPastoPerBisogni(vegano, "mela").delta, 1);
    assert.equal(deltaPastoPerBisogni(vegano, "bistecca").delta, 0);
  });

  it("lutto familiare permanente -1 e rimozione morto", () => {
    const padre = stubAbitante({ id: 10, nome: "Padre", figliIds: [11] });
    const figlio = stubAbitante({ id: 11, nome: "Figlio", genitoriIds: [10] });
    const next = applicaLuttoFamiliareERimuoviMorti([padre, figlio], new Set([11]));
    assert.equal(next.length, 1);
    assert.equal(next[0]!.id, 10);
    const lutto = next[0]!.modificatoriSoddisfazione?.find((m) => m.id === "lutto_familiare");
    assert.ok(lutto);
    assert.equal(lutto!.delta, -1);
    assert.equal(lutto!.durata, "permanente");
    assert.equal(calcolaPunteggioSoddisfazione(next[0]!, [], 1, 1, 1), -1);
  });

  it("snapshot fascia Ostile con lutto multiplo", () => {
    const a = stubAbitante({
      id: 2,
      nome: "X",
      modificatoriSoddisfazione: [
        { id: "lutto_familiare", delta: -5, motivo: "lutto", durata: "permanente" }
      ]
    });
    const snap = snapshotSoddisfazioneAbitante(a, [], 1, 1, 1);
    assert.equal(snap.fascia, "Ostile");
    assert.equal(snap.punti, -5);
  });
});

describe("reModalita / disordine", () => {
  it("a giro aumenta popolarità", () => {
    const tick = tickModalitaReMensile(
      { ...STATO_RE_DEFAULT, modalitaRe: "a_giro", popolaritaRe: 50 },
      []
    );
    assert.equal(tick.stato.popolaritaRe, 52);
  });

  it("castello prolungato cala popolarità e avvisa", () => {
    const tick = tickModalitaReMensile(
      {
        ...STATO_RE_DEFAULT,
        modalitaRe: "nel_castello",
        mesiConsecutiviNelCastello: 2,
        popolaritaRe: 50,
        avvisoReAssenteEmesso: false
      },
      []
    );
    assert.equal(tick.stato.mesiConsecutiviNelCastello, 3);
    assert.equal(tick.stato.popolaritaRe, 47);
    assert.ok(tick.avvisoDiario);
  });

  it("soglie protesta 5% e ribellione 10%", () => {
    assert.equal(SOGLIA_PROTESTA_OSTILI, 0.05);
    assert.equal(SOGLIA_RIBELLIONE_OSTILI, 0.1);

    const popol = Array.from({ length: 20 }, (_, i) =>
      stubAbitante({
        id: i + 2,
        nome: `A${i}`,
        modificatoriSoddisfazione:
          i < 2
            ? [{ id: "lutto_familiare", delta: -5, motivo: "x", durata: "permanente" }]
            : undefined
      })
    );
    // 2/20 = 10% → ribellione
    const snap = valutaFaseDisordine("nessuna", popol, [], 1, 1, 1);
    assert.equal(snap.numOstili, 2);
    assert.equal(snap.fase, "ribellione");
  });
});
