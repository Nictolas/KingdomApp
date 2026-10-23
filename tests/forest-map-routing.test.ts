import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  getMappaPersonaggiRuntime,
  patchMappaPersonaggiRuntime,
  resetMappaPersonaggiRuntime,
  setMappaPersonaggiRuntime
} from "../src/game/mappaPersonaggiRuntimeStore";
import {
  iniziaTurnoForestale, segnalaArrivoTurnoForestale,
  aggiornaTurnoForestale, type TurnoForestale
} from "../src/game/turniForestali";

test("Fasi del Cacciatore sopravvivono al remount della mappa", () => {
  const original = getMappaPersonaggiRuntime();
  try {
    resetMappaPersonaggiRuntime();
    let turno = iniziaTurnoForestale({
      abitanteId: 101, giorno: 5, lavoro: "Cacciatore",
      sedeId: 56, minuto: 360
    });
    turno = segnalaArrivoTurnoForestale(turno, "sede", 390);
    patchMappaPersonaggiRuntime({ turniForestaliByAbitanteId: { 101: turno } });
    assert.equal(getMappaPersonaggiRuntime().turniForestaliByAbitanteId[101]?.fase, "preparazione");

    // Simula l'ingresso in un edificio che smonta e rimonta /mappa.
    const reload = getMappaPersonaggiRuntime().turniForestaliByAbitanteId[101]!;
    const attivato = aggiornaTurnoForestale(reload, 451, 900);
    assert.equal(attivato.fase, "verso_bosco");
    assert.equal(attivato.minutiNelBosco, 0);
    resetMappaPersonaggiRuntime();
    assert.deepEqual(getMappaPersonaggiRuntime().turniForestaliByAbitanteId, {});
  } finally {
    setMappaPersonaggiRuntime(original);
  }
});

test("Mappa usa davvero le transizioni, non genera bottino durante i tragitti", () => {
  const code = readFileSync("app/mappa.tsx", "utf8");
  const raccolta = readFileSync("src/game/boscoRaccolta.ts", "utf8");
  assert.match(code, /salvaTurnoForestaleMappa/);
  assert.match(code, /segnalaArrivoTurnoForestale\(turno, "bosco"/);
  assert.match(code, /aggiornaTurnoForestale\(turno, orologioMinuti, fascia\.fine\)/);
  assert.match(code, /pianificaCommuteVersoEdificioGlobaleDaCella\(/);
  assert.match(code, /SEDI_FORESTALI\.includes\(lav\.nome\)/);
  assert.match(code, /turno\.fase === "verso_bosco"/);
  assert.match(raccolta, /next\.ultimoIngressoBoscoGiorno !== giorno/);
  assert.match(raccolta, /giornoCorrente - giorni \+ g/);
});
