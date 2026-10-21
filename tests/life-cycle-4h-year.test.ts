import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Abitante, Edificio } from "../src/types";
import {
  GIORNI_PER_MESE_GIOCO,
  MINUTI_GIOCO_PER_SECONDO_REALE,
  ORE_REALI_PER_ANNO_1X,
  FATTORE_ECONOMIA_GIORNALIERA
} from "../src/game/tempoSimulazioneConfig";
import { indiceMeseDaGiornoGioco, offsetMesiPerCalendarioSalvato } from "../src/game/calendarioGioco";
import {
  getOrologioMinutiSnapshot,
  restoreOrologioGioco,
  setOrologioGiocoBloccatoDallaFase,
  setOrologioGiocoSospesoDallApp,
  syncOrologioGiocoDaWallClock
} from "../src/game/orologioGiocoSession";
import { GIORNI_PRODUZIONE_SERRA_PER_MESE, PRODUZIONE_SERRA_GIORNALIERA } from "../src/game/colturaSerra";
import {
  applicaCicloVitaAnnuale,
  faseVita,
  lavoroDopoCrescita,
  probabilitaMorteVecchiaia
} from "../src/game/cicloVitaAnnuale";

function resident(id: number, age: number, changes: Partial<Abitante> = {}): Abitante {
  return {
    id, eta: age, nome: "Abitante " + id, emoji: "🙂",
    lavoro: "Disoccupato", competenza: 40, produttività: 40, stanchezza: 0,
    personalità: "Tiepido", amici: [], rivali: [], fazioni: ["Cittadini"],
    peso: 60, salute: 80, reddito: 0, spese: 0,
    lealtà: 60, paura: 0, felicità: 70, religione: "Ateo",
    ...changes
  };
}
function building(ids: number[]): Edificio {
  return {
    id: 7, nome: "Ufficio Edile", tipo: "Lavoro", stato: "Operativo",
    abitantiAssegnati: ids, occupazione: ids.length
  } as unknown as Edificio;
}

test("4 real hours per fantasy year; four minutes per day and five days per month", () => {
  assert.equal(MINUTI_GIOCO_PER_SECONDO_REALE, 6);
  assert.equal(GIORNI_PER_MESE_GIOCO, 5);
  assert.equal(ORE_REALI_PER_ANNO_1X, 4);
  assert.equal(FATTORE_ECONOMIA_GIORNALIERA, 6);
  assert.equal(indiceMeseDaGiornoGioco(5), 0);
  assert.equal(indiceMeseDaGiornoGioco(6), 1);
  assert.equal(indiceMeseDaGiornoGioco(61), 12);
});

test("legacy saves keep their month and year, without jumping forwards", () => {
  const giornoVecchio = 91, meseSalvato = 4, annoSalvato = 9;
  const offset = offsetMesiPerCalendarioSalvato(giornoVecchio, meseSalvato, annoSalvato);
  assert.equal(indiceMeseDaGiornoGioco(giornoVecchio, offset), annoSalvato * 12 + meseSalvato - 1);
});

test("child grows from infant through child and teen without being employed as adult", () => {
  assert.equal(faseVita(0), "neonato");
  assert.equal(faseVita(3), "bambino");
  assert.equal(faseVita(13), "adolescente");
  assert.equal(faseVita(18), "adulto");
  assert.equal(lavoroDopoCrescita(resident(3, 3, { lavoro: "Neonato" })), "Bambino");
  assert.equal(lavoroDopoCrescita(resident(3, 13, { lavoro: "Bambino" })), "Adolescente");
  assert.equal(lavoroDopoCrescita(resident(3, 18, { lavoro: "Adolescente" })), "Disoccupato");
  assert.equal(lavoroDopoCrescita(resident(3, 20, { lavoro: "Agricoltore" })), "Agricoltore");
});

test("races have different longevity and Golems never die of biological old age", () => {
  assert.equal(probabilitaMorteVecchiaia(40, "Umano"), 0);
  assert.equal(probabilitaMorteVecchiaia(110, "Umano"), 1);
  assert.equal(probabilitaMorteVecchiaia(80, "Elfo"), 0);
  assert.equal(probabilitaMorteVecchiaia(200, "Elfo"), 1);
  assert.equal(probabilitaMorteVecchiaia(999, "Golem"), 0);
  assert.ok(probabilitaMorteVecchiaia(90, "Umano") > probabilitaMorteVecchiaia(75, "Umano"));
});

test("natural death removes NPC workers, but not the Golem", () => {
  const workers = [
    resident(1, 35, { lavoro: "Re" }),
    resident(2, 110, { lavoro: "Agricoltore" }),
    resident(3, 999, { razza: "Golem" })
  ];
  const out = applicaCicloVitaAnnuale(workers, [building([2, 3])], 42, () => 0.999);
  assert.deepEqual(out.abitanti.map(a => a.id), [1, 3]);
  assert.deepEqual(out.mortiVecchiaia.map(a => a.id), [2]);
  assert.deepEqual(out.edifici[0].abitantiAssegnati, [3]);
});

test("an adult heir takes the permanent player slot and preserves dynastic history", () => {
  const king = resident(1, 110, { nome: "Vecchio Re", lavoro: "Re", figliIds: [7] });
  const prince = resident(7, 31, { nome: "Nuovo Re", lavoro: "Agricoltore", genitoriIds: [1], figliIds: [9] });
  const grandchild = resident(9, 4, { lavoro: "Bambino", genitoriIds: [7] });
  const out = applicaCicloVitaAnnuale([king, prince, grandchild], [building([7])], 45, () => 0.99);
  assert.equal(out.successione?.erede, "Nuovo Re");
  assert.equal(out.successione?.eredeMinorenne, false);
  assert.equal(out.abitanti.find(a => a.id === 1)?.nome, "Nuovo Re");
  assert.equal(out.abitanti.find(a => a.id === 1)?.lavoro, "Re");
  assert.equal(out.abitanti.some(a => a.id === 7), false);
  assert.deepEqual(out.abitanti.find(a => a.id === 1)?.storiaSovrani, [
    { nome: "Vecchio Re", eta: 110, anno: 45, causa: "vecchiaia" }
  ]);
  assert.deepEqual(out.abitanti.find(a => a.id === 9)?.genitoriIds, [1]);
  assert.deepEqual(out.edifici[0].abitantiAssegnati, []);
});

test("minor heir succeeds with a regency notice; absent heir keeps existing game over", () => {
  const father = resident(1, 110, { nome: "Re", lavoro: "Re", figliIds: [8] });
  const small = resident(8, 10, { nome: "Erede", lavoro: "Bambino" });
  const regent = applicaCicloVitaAnnuale([father, small], [], 11);
  assert.equal(regent.successione?.eredeMinorenne, true);
  assert.equal(regent.abitanti.find(a => a.id === 1)?.eta, 10);

  const last = applicaCicloVitaAnnuale([father], [], 11);
  assert.equal(last.successione, null);
  assert.equal(last.abitanti.find(a => a.id === 1)?.salute, 0);
});

test("hidden webapp freezes game clock and save remains a manual-pause snapshot", () => {
  const clock = readFileSync(new URL("../src/game/orologioGiocoSession.ts", import.meta.url), "utf8");
  const context = readFileSync(new URL("../src/context/GameContext.tsx", import.meta.url), "utf8");
  const monthly = readFileSync(new URL("../src/game/avanzaMese.ts", import.meta.url), "utf8");
  assert.match(clock, /setOrologioGiocoSospesoDallApp\(/);
  assert.match(clock, /orologioGiocoSospesoDallApp/);
  assert.match(context, /document\.visibilityState === "hidden"/);
  assert.match(context, /setOrologioGiocoSospesoDallApp\(sospesa\)/);
  assert.match(context, /if \(sospesa && !eraSospesa && latestStateRef\.current\.simulationEnabled\)/);
  assert.match(monthly, /applicaCicloVitaAnnuale\(abitantiEv, edificiEv, nuovoAnno\)/);
  assert.match(monthly, /mesiTrascorsi < 9/);
});

test("an hour spent offline never advances the clock, and does not create manual pause", () => {
  const originalNow = Date.now;
  let now = 1_000_000;
  try {
    Date.now = () => now;
    restoreOrologioGioco({ giorno: 1, minutiDaMezzanotte: 360, pausaManuale: false });
    setOrologioGiocoBloccatoDallaFase(false);
    now += 1000;
    syncOrologioGiocoDaWallClock();
    assert.equal(getOrologioMinutiSnapshot(), 366);
    setOrologioGiocoSospesoDallApp(true);
    now += 3_600_000;
    syncOrologioGiocoDaWallClock();
    assert.equal(getOrologioMinutiSnapshot(), 366);
    setOrologioGiocoSospesoDallApp(false);
    now += 1000;
    syncOrologioGiocoDaWallClock();
    assert.equal(getOrologioMinutiSnapshot(), 372);
  } finally {
    Date.now = originalNow;
    setOrologioGiocoSospesoDallApp(false);
    setOrologioGiocoBloccatoDallaFase(true);
  }
});

test("daily farming output still matches prior monthly farming after calendar change", () => {
  assert.equal(GIORNI_PRODUZIONE_SERRA_PER_MESE, 5);
  assert.equal(PRODUZIONE_SERRA_GIORNALIERA * GIORNI_PRODUZIONE_SERRA_PER_MESE, 60);
});

test("grandchild inherits even when a direct royal child died earlier", () => {
  const king = resident(1, 110, { nome: "Re", lavoro: "Re", figliIds: [6] });
  const grandchild = resident(10, 22, { nome: "Nipote", genitoriIds: [6] });
  const output = applicaCicloVitaAnnuale([king, grandchild], [], 15);
  assert.equal(output.abitanti.find(a => a.id === 1)?.nome, "Nipote");
  assert.equal(output.successione?.erede, "Nipote");
});
