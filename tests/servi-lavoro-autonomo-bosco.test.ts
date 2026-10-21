import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  puoCercareLavoroAutonomamente,
  edificioAccettaDisoccupatoCittadino,
  assumiCittadinoDisoccupatoInEdificio,
  getServiDellaGlebaAssegnabili
} from "../src/game/edificiLavoro";
import {
  sediCercaLavoroDisoccupatoInOrdine,
  cercaPercorsoLavoroDisoccupato,
  trovaCellaPortaEdificio
} from "../src/game/commutePathsMappa";
import { assumiDisoccupatoNelBosco } from "../src/game/boscoRaccolta";
import type { Abitante, Edificio } from "../src/types";

const cols = 50, rows = 50;
const servo = {
  id: 77, nome: "Marco Colombo", casta: "Servo della gleba", lavoro: "Disoccupato",
  razza: "Umano", competenza: 100, inventario: []
} as unknown as Abitante;
const cittadino = { ...servo, id: 78, nome: "Luca Colombo", casta: "Cittadino" } as Abitante;
const bosco = {
  id: 51, nome: "Bosco", stato: "Operativo", capacità: 20, occupazione: 0,
  abitantiAssegnati: []
} as unknown as Edificio;
const ospedale = {
  id: 7, nome: "Ospedale", stato: "Operativo", capacità: 4, occupazione: 0,
  abitantiAssegnati: [], tipo: "Sanità"
} as unknown as Edificio;
const boscoAnchor = cols + 20;
const ospedaleAnchor = 15 * cols + 30;
const from = 8 * cols + 22;
const map = {
  [boscoAnchor]: { id: 51, nome: "Bosco", footprint: { w: 5, h: 5 } },
  [ospedaleAnchor]: { id: 7, nome: "Ospedale", footprint: { w: 2, h: 2 } }
};
const walkable = (i: number) => i >= 0 && i < cols * rows &&
  Math.floor(i / cols) >= 6 &&
  !(Math.floor(i / cols) >= 15 && Math.floor(i / cols) <= 16 &&
    i % cols >= 30 && i % cols <= 31);

test("Cittadini e Servi della gleba disoccupati possono cercare qualunque lavoro idoneo", () => {
  assert.equal(puoCercareLavoroAutonomamente(servo), true);
  assert.equal(puoCercareLavoroAutonomamente(cittadino), true);
  assert.equal(edificioAccettaDisoccupatoCittadino(servo, ospedale, [servo]), true);
  assert.equal(puoCercareLavoroAutonomamente({ ...servo, lavoro: "Medico" }), false);
  assert.equal(puoCercareLavoroAutonomamente({ ...servo, casta: "Nobile" }), false);
  assert.equal(puoCercareLavoroAutonomamente({ ...servo, casta: "Schiavo" }), false);
});

test("un Servo disoccupato può essere assunto come Medico senza cambiare casta", () => {
  const result = assumiCittadinoDisoccupatoInEdificio([servo], [ospedale], servo.id, ospedale.id);
  assert.equal(result.ok, true);
  assert.equal(result.abitanti[0]?.lavoro, "Medico");
  assert.equal(result.abitanti[0]?.casta, "Servo della gleba");
  assert.deepEqual(result.edifici[0]?.abitantiAssegnati, [77]);
});

test("il Re può assegnare manualmente i Servi disoccupati, non quelli già occupati", () => {
  const occupato = { ...servo, id: 81, nome: "Paolo", lavoro: "Medico" } as Abitante;
  assert.deepEqual(getServiDellaGlebaAssegnabili([servo, occupato], [ospedale]).map(a => a.id), [77]);
});

test("la ricerca autonoma valuta gli impieghi ordinari prima del Bosco", () => {
  const sedi = sediCercaLavoroDisoccupatoInOrdine(servo, [bosco, ospedale], [servo]);
  assert.equal(sedi[0]?.nome, "Ospedale");
  assert.equal(sedi.at(-1)?.nome, "Bosco");
  const scelta = cercaPercorsoLavoroDisoccupato(servo, from, [bosco, ospedale], map, cols, rows, walkable, [servo]);
  assert.equal(scelta?.edificioId, 7);
  assert.equal(scelta?.path[0], from);
  const soloBosco = cercaPercorsoLavoroDisoccupato(servo, from, [bosco], map, cols, rows, walkable, [servo]);
  assert.equal(soloBosco?.edificioId, 51);
  assert.equal(soloBosco?.path.at(-1), 6 * cols + 22);
});

test("se il Bosco ha un ingresso ostruito i Raccoglitori possono usare quello vicino", () => {
  const blocked = (i: number) => walkable(i) && i !== 6 * cols + 22;
  assert.equal(trovaCellaPortaEdificio(boscoAnchor, map, cols, rows, blocked), 6 * cols + 21);
  const route = cercaPercorsoLavoroDisoccupato(servo, from, [bosco], map, cols, rows, blocked);
  assert.equal(route?.path.at(-1), 6 * cols + 21);
});

test("raggiunto il Bosco un Servo può diventare Raccoglitore, senza teletrasporto", () => {
  const route = cercaPercorsoLavoroDisoccupato(servo, from, [bosco], map, cols, rows, walkable);
  assert.ok(route?.path && route.path.length >= 2);
  const hired = assumiDisoccupatoNelBosco([servo], [bosco], servo.id);
  assert.equal(hired.ok, true);
  assert.equal(hired.abitanti[0]?.lavoro, "Raccoglitore");
  assert.deepEqual(hired.edifici[0]?.abitantiAssegnati, [77]);
  const source = readFileSync(new URL("../app/mappa.tsx", import.meta.url), "utf8");
  assert.match(source, /assumiCittadinoDisoccupatoAEdificio\(abitanteId, lavoroCercaEdificioId\)/);
  assert.match(source, /puoCercareLavoroAutonomamente\(a\)/);
});
