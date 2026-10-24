import assert from "node:assert/strict";
import test from "node:test";
import {
  RISERVE_BOSCO_INIZIALI, aggiornaEcosistemaBosco,
  modificatoreSoddisfazioneBosco, probabilitaSuccessoForestale
} from "../src/game/ecosistemaBosco";

const base = {
  raccoglitori: 0, cacciatori: 0, taglialegna: 0, silvicoltori: 0,
  quotaMassimaCacciatori: 10, intensitaCaccia: "ordinaria" as const,
  stagione: "primavera" as const
};

test("Scorte sempre finite e mai negative, anche nello sfruttamento estremo", () => {
  let scorte = { ...RISERVE_BOSCO_INIZIALI };
  for (let i = 0; i < 300; i++) {
    scorte = aggiornaEcosistemaBosco(scorte, {
      ...base, cacciatori: 50, taglialegna: 60, raccoglitori: 70,
      quotaMassimaCacciatori: 50, intensitaCaccia: "spietata"
    }).scorte;
    assert.ok(Object.values(scorte).every(x => x >= 0 && x <= 100));
  }
  assert.ok(scorte.alberi < 25);
  assert.ok(scorte.fauna < 25);
});

test("Divieto di caccia impedisce prelievi da parte dei Cacciatori", () => {
  const result = aggiornaEcosistemaBosco(RISERVE_BOSCO_INIZIALI, {
    ...base, cacciatori: 8, quotaMassimaCacciatori: 0
  });
  assert.equal(result.raccolto.selvaggina, 0);
});

test("Silvicoltori migliorano recupero, gli alberi sostengono fauna e flora", () => {
  const scarso = { alberi: 10, fauna: 40, vegetazione: 30 };
  const sano = { alberi: 90, fauna: 40, vegetazione: 30 };
  const senza = aggiornaEcosistemaBosco(scarso, base).scorte;
  const conSilvicoltori = aggiornaEcosistemaBosco(scarso, { ...base, silvicoltori: 4 }).scorte;
  const conHabitat = aggiornaEcosistemaBosco(sano, base).scorte;
  assert.ok(conSilvicoltori.alberi > senza.alberi);
  assert.ok(conHabitat.fauna > senza.fauna);
  assert.ok(conHabitat.vegetazione > senza.vegetazione);
});

test("Dottrina religiosa reagisce allo stato corrente senza cumuli giornalieri", () => {
  const culto = { forestaSacra: true, tutelaFauna: true, tutelaVegetazione: true };
  const degradata = { alberi: 5, fauna: 5, vegetazione: 5 };
  const malus = modificatoreSoddisfazioneBosco(culto, degradata);
  assert.ok(malus < 0 && malus >= -10);
  assert.equal(modificatoreSoddisfazioneBosco(culto, degradata), malus);
  assert.equal(modificatoreSoddisfazioneBosco({
    forestaSacra: false, tutelaFauna: false, tutelaVegetazione: false
  }, degradata), 0);
});

test("Non si raccoglie in viaggio o senza riserva", () => {
  assert.equal(probabilitaSuccessoForestale(80, 100, 0), 0);
  assert.equal(probabilitaSuccessoForestale(0, 100, 360), 0);
  assert.ok(probabilitaSuccessoForestale(90, 90, 360) > probabilitaSuccessoForestale(20, 90, 360));
});
