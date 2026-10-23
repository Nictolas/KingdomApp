import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { normalizzaStatoSociale, propensioneRibellione, timoreAbitante } from "../src/game/statoSociale";
import { applicaLuttoFamiliareERimuoviMorti, pulisciModificatoriScaduti } from "../src/game/soddisfazione";
import { valutaFaseDisordineSoddisfazione } from "../src/game/disordineSoddisfazione";
import { condannaAMortePuro } from "../src/game/tribunale";
import type { Abitante } from "../src/types";

function residente(id: number, extra: Partial<Abitante> = {}): Abitante {
  return {
    id, nome: "Abitante " + id, emoji: "👤", eta: 30, lavoro: id === 1 ? "Re" : "Disoccupato",
    competenza: 50, produttività: 50, stanchezza: 0, personalità: "Tiepido",
    amici: [], rivali: [], fazioni: [], peso: 50, salute: 100, reddito: 0, spese: 0,
    religione: "Ateo", timore: 0, ...extra
  } as Abitante;
}

test("il vecchio salvataggio converte Felicità/Lealtà in Soddisfazione una sola volta", () => {
  const old = residente(2, { timore: undefined, paura: 85, felicità: 90, lealtà: 70 });
  const converted = normalizzaStatoSociale(old);
  assert.equal(converted.felicità, undefined);
  assert.equal(converted.lealtà, undefined);
  assert.equal(converted.paura, undefined);
  assert.equal(converted.timore, 85);
  assert.equal(converted.modificatoriSoddisfazione?.find(m => m.id === "consenso_legacy")?.delta, 2);
  assert.deepEqual(normalizzaStatoSociale(converted), converted);
  assert.equal(old.paura, 85);
});

test("Timore frena la ribellione ma non la rende impossibile", () => {
  assert.equal(timoreAbitante(residente(2, { timore: 130 })), 100);
  assert.equal(propensioneRibellione(residente(2, { timore: 0 })), 1);
  assert.equal(propensioneRibellione(residente(2, { timore: 100 })), 0.25);
  const regno = Array.from({length: 11}, (_, i) => residente(i + 1,
    i === 1 ? { modificatoriSoddisfazione: [{ id: "lutto_test", delta: -5, durata: "permanente", motivo: "Lutto" }] } : {}
  ));
  const low = valutaFaseDisordineSoddisfazione("nessuna", regno, [], 1, 1, 0);
  const high = valutaFaseDisordineSoddisfazione("nessuna", regno.map(a => a.id === 2 ? { ...a, timore: 100 } : a), [], 1, 1, 0);
  assert.equal(low.fase, "ribellione");
  assert.equal(high.fase, "nessuna");
  assert.equal(high.numOstili, 1);
});

test("uccisione ordinata dal Re: familiare -3, amico -1, mai due volte per la stessa vittima", () => {
  const vittima = residente(2, { coniugeId: 3, amici: [{id: 4, punteggio: 50},{id: 3, punteggio: 50}] });
  const coniuge = residente(3, {coniugeId: 2, amici: [{id: 2, punteggio: 50}]});
  const amico = residente(4, {amici: [{id: 2, punteggio: 50}]});
  const other = residente(5);
  const after = applicaLuttoFamiliareERimuoviMorti([vittima,coniuge,amico,other],new Set([2]),{responsabilitaRe: true});
  assert.equal(after.length,3);
  const family = after.find(a => a.id === 3)!;
  const friend = after.find(a => a.id === 4)!;
  assert.equal(family.modificatoriSoddisfazione?.find(m => m.id === "lutto_2")?.delta,-3);
  assert.equal(friend.modificatoriSoddisfazione?.find(m => m.id === "lutto_2")?.delta,-1);
  assert.equal(family.modificatoriSoddisfazione?.filter(m => m.id === "lutto_2").length,1);
  assert.equal(after.find(a => a.id === 5)?.modificatoriSoddisfazione,undefined);
  assert.equal(pulisciModificatoriScaduti(friend,999,12,999).modificatoriSoddisfazione?.find(m => m.id === "lutto_2")?.delta,-1);
});

test("esecuzione dal Re: lutto permanente e aumento del Timore", () => {
  const v = residente(2,{ coniugeId: 3 });
  const f = residente(3,{ coniugeId: 2, timore: 10 });
  const a = condannaAMortePuro([v,f],[],2);
  assert.equal(a.nuoviAbitanti[0]?.timore,20);
  assert.equal(a.nuoviAbitanti[0]?.modificatoriSoddisfazione?.find(m => m.id === "lutto_2")?.delta,-3);
  const privateOwner = condannaAMortePuro([v,f],[],2,false);
  assert.equal(privateOwner.nuoviAbitanti[0]?.timore,10);
  assert.equal(privateOwner.nuoviAbitanti[0]?.modificatoriSoddisfazione?.find(m => m.id === "lutto_2")?.delta,-1);
});

test("la mappa mantiene Menu e Diario e sposta Demolisci dentro Costruisci", () => {
  const source = readFileSync("app/mappa.tsx","utf8");
  assert.match(source,/router\.push\("\/menu"\)/);
  assert.match(source,/router\.push\("\/diario"\)/);
  assert.match(source,/title="Soddisfazione e Timore"|Soddisfazione \{soddisfazioneMediaRegno\}/);
  assert.match(source,/Cosa vuoi costruire\?|Costruisci o demolisci/);
  assert.match(source,/onPress=\{onDemolisciPress\}/);
  assert.doesNotMatch(source,/setMostraGrigliaMappa\(\(v\) => !v\)/);
  assert.match(source,/Platform\.OS === "web" \? 26 : 10/);
});
