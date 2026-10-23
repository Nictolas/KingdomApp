import assert from "node:assert/strict";
import test from "node:test";
import {
  probabilitaRapinaBosco, possibileAssaltoBanditi, risolviAssaltoBanditi,
  creaRichiestaBanditi, registraIngressoCastello,
  rispondiAReclamoBanditi, parereConsiglierePerRapina
} from "../src/game/banditiBosco";

test("I guardaboschi riducono il rischio senza azzerarlo", () => {
  assert.ok(probabilitaRapinaBosco(2) < probabilitaRapinaBosco(0));
  assert.ok(probabilitaRapinaBosco(100) > 0);
});

test("RNG replicabile, vietato assalto durante viaggio o duplicato nello stesso giorno", () => {
  const input = {
    mondoSeed: 100, giorno: 13, abitanteId: 3,
    staLavorandoNelBosco: true, guardaboschiAttivi: 0, haGiaSubitoEventoOggi: false
  };
  assert.equal(possibileAssaltoBanditi(input), possibileAssaltoBanditi(input));
  assert.equal(possibileAssaltoBanditi({ ...input, staLavorandoNelBosco: false }), false);
  assert.equal(possibileAssaltoBanditi({ ...input, haGiaSubitoEventoOggi: true }), false);
});

test("Sottrae solamente beni posseduti senza crearne", () => {
  const input = { mondoSeed: 2, giorno: 3, abitanteId: 17,
    inventario: [{ itemId: "monete", quantità: 2 }, { itemId: "funghi", quantità: 3 }] };
  const result = risolviAssaltoBanditi(input)!;
  assert.ok(result);
  const oldTotal = input.inventario.reduce((s, v) => s + v.quantità, 0);
  const newTotal = result.inventario.reduce((s, v) => s + v.quantità, 0);
  assert.equal(oldTotal - newTotal, result.evento.rubato.quantità);
  assert.ok(result.inventario.every((v) => v.quantità >= 0));
  assert.deepEqual(risolviAssaltoBanditi(input), result);
  assert.equal(risolviAssaltoBanditi({ ...input, inventario: [] }), null);
});

test("Udienza rapina solo dopo vero ingresso nel Castello", () => {
  const event = {
    id: "bosco-3-17", abitanteId: 17, giorno: 3,
    esito: "rapina" as const, rubato: { itemId: "monete", quantità: 2 },
    dannoSalute: 0
  };
  let q = creaRichiestaBanditi(event, 10)!;
  assert.ok(q);
  assert.equal(q.stato, "verso_castello");
  assert.equal(registraIngressoCastello(q, 17, "Castello", false), q);
  assert.equal(registraIngressoCastello(q, 18, "Castello", true), q);
  assert.equal(registraIngressoCastello(q, 17, "Capanna", true), q);
  assert.equal(rispondiAReclamoBanditi(q, "risarcisci", 100).riuscito, false);
  q = registraIngressoCastello(q, 17, "Castello", true);
  assert.equal(q.stato, "pronta");
  const parere = rispondiAReclamoBanditi(q, "chiedi_al_consigliere", 100);
  assert.equal(parere.mostraParere, true);
  assert.equal(parere.moneteTesoro, 100);
  assert.equal(parere.richiesta, q);
  assert.match(parereConsiglierePerRapina(q).risarcisci, /10 monete/);
  const noFunds = rispondiAReclamoBanditi(q, "risarcisci", 9);
  assert.equal(noFunds.riuscito, false);
  const paid = rispondiAReclamoBanditi(q, "risarcisci", 100);
  assert.equal(paid.moneteTesoro, 90);
  assert.equal(paid.monetePerCittadino, 10);
  assert.equal(paid.richiesta.stato, "chiusa");
  assert.equal(rispondiAReclamoBanditi(paid.richiesta, "risarcisci", 90).riuscito, false);
  const ignored = rispondiAReclamoBanditi(q, "ignora", 100);
  assert.equal(ignored.moneteTesoro, 100);
  assert.equal(ignored.richiesta.scelta, "ignora");
  assert.equal(creaRichiestaBanditi({ ...event, esito: "morte" }, 10), null);
});
