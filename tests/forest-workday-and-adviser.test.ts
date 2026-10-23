import assert from "node:assert/strict";
import test from "node:test";
import { generaRegnoIniziale } from "../src/game/generazionePartita";
import {
  SEDI_FORESTALI, SEDE_PER_PROFESSIONE, iniziaTurnoForestale,
  segnalaArrivoTurnoForestale, aggiornaTurnoForestale,
  destinazioneTurnoForestale, sospendiTurnoForestale
} from "../src/game/turniForestali";

test("Re di 10 anni e Consigliere umano iniziale sempre presenti (entrambe le modalità)", () => {
  for (const modalita of ["creativa", "avventura"] as const) {
    for (let i = 0; i < 120; i++) {
      const { abitanti } = generaRegnoIniziale(modalita);
      const consiglieri = abitanti.filter((x) => x.lavoro === "Consigliere");
      assert.equal(abitanti.find((x) => x.id === 1)?.eta, 10);
      assert.equal(consiglieri.length, 1);
      assert.equal(consiglieri[0]?.razza, "Umano");
      assert.equal(consiglieri[0]?.eta, 60);
      assert.equal(consiglieri[0]?.ruoloSchiavitu, undefined);
      assert.ok(!consiglieri[0]?.fazioni?.includes("Schiavi"));
      assert.ok(!abitanti.some((a) => a.lavoro === "Prigioniero" && a.id === consiglieri[0]?.id));
    }
  }
});

test("otto professioni, sette sedi senza obbligo geografico", () => {
  assert.equal(Object.keys(SEDE_PER_PROFESSIONE).length, 8);
  assert.equal(SEDI_FORESTALI.length, 7);
  assert.equal(SEDE_PER_PROFESSIONE.Raccoglitore, null);
  assert.equal(SEDE_PER_PROFESSIONE.Cacciatore, "Capanna del Cacciatore");
  assert.throws(() => iniziaTurnoForestale({
    abitanteId: 3, giorno: 1, lavoro: "Cacciatore", sedeId: null, minuto: 420
  }));
});

test("Cacciatore visita realmente sede, Bosco, sede, casa", () => {
  let t = iniziaTurnoForestale({
    abitanteId: 3, giorno: 12, lavoro: "Cacciatore",
    sedeId: 60, minuto: 420, minutiPreparazione: 60, minutiDeposito: 20
  });
  assert.equal(destinazioneTurnoForestale(t), "sede");
  assert.equal(segnalaArrivoTurnoForestale(t, "bosco", 430), t); // niente teleport
  t = segnalaArrivoTurnoForestale(t, "sede", 440);
  assert.equal(t.fase, "preparazione");
  t = aggiornaTurnoForestale(t, 499, 900);
  assert.equal(t.fase, "preparazione");
  t = aggiornaTurnoForestale(t, 500, 900);
  assert.equal(destinazioneTurnoForestale(t), "bosco");
  t = segnalaArrivoTurnoForestale(t, "bosco", 520);
  t = aggiornaTurnoForestale(t, 700, 900);
  assert.equal(t.minutiNelBosco, 180);
  t = aggiornaTurnoForestale(t, 920, 900);
  assert.equal(t.minutiNelBosco, 380);
  assert.equal(destinazioneTurnoForestale(t), "sede");
  t = segnalaArrivoTurnoForestale(t, "sede", 935);
  t = aggiornaTurnoForestale(t, 956, 900);
  assert.equal(destinazioneTurnoForestale(t), "casa");
  t = segnalaArrivoTurnoForestale(t, "casa", 980);
  assert.equal(t.fase, "finito");
});

test("Raccoglitore va direttamente nel Bosco; rapina sospende il turno", () => {
  let t = iniziaTurnoForestale({
    abitanteId: 8, giorno: 1, lavoro: "Raccoglitore", sedeId: null, minuto: 390
  });
  assert.equal(destinazioneTurnoForestale(t), "bosco");
  t = segnalaArrivoTurnoForestale(t, "bosco", 420);
  t = aggiornaTurnoForestale(t, 470, 900);
  assert.equal(t.minutiNelBosco, 50);
  t = sospendiTurnoForestale(t);
  assert.equal(t.fase, "sospeso");
  assert.equal(destinazioneTurnoForestale(t), null);
  assert.equal(aggiornaTurnoForestale(t, 480, 900), t);
});

test("Preparazione lunga oltre la fine turno: rientra senza produrre", () => {
  let t = iniziaTurnoForestale({
    abitanteId: 11, giorno: 9, lavoro: "Taglialegna",
    sedeId: 70, minuto: 880, minutiPreparazione: 45
  });
  t = segnalaArrivoTurnoForestale(t, "sede", 890);
  t = aggiornaTurnoForestale(t, 940, 900);
  assert.equal(t.fase, "ritorno_casa");
  assert.equal(t.minutiNelBosco, 0);
});
