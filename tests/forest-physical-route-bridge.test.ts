import assert from "node:assert/strict";
import test from "node:test";
import { iniziaTurnoForestale, segnalaArrivoTurnoForestale, aggiornaTurnoForestale } from "../src/game/turniForestali";
import { pianificaTappaTurnoForestale } from "../src/game/pianificaTappaForestale";
import type { Edificio } from "../src/types";

const crea = (id: number, nome: string, lavoratori: number[] = []): Edificio => ({
  id, nome, emoji: "🌲", tipo: "Servizi", descrizione: "",
  capacità: 4, occupazione: lavoratori.length, abitantiAssegnati: lavoratori,
  efficienza: 100, manutenzione: 0, stato: "Operativo", livello: 1
});
const edifici = [crea(1, "Capanna"), crea(60, "Capanna del Cacciatore", [3]), crea(51, "Bosco")];
const mappa = {
  11: { id: 1, nome: "Capanna", edificioGlobaleId: 1 },
  14: { id: 60, nome: "Capanna del Cacciatore", edificioGlobaleId: 60 },
  18: { id: 51, nome: "Bosco", edificioGlobaleId: 51 }
};
const opzioni = { edifici, edificiInMappa: mappa, cols: 10, rows: 10, isWalkable: (i: number) => i >= 0 && i < 100 && !Object.prototype.hasOwnProperty.call(mappa, i), casaEdificioId: 1 };
test("Il Cacciatore compie tappe su edifici realmente costruiti, senza generare coordinate finte", () => {
  let turno = iniziaTurnoForestale({ abitanteId: 3, giorno: 2, lavoro: "Cacciatore", sedeId: 60, minuto: 420 });
  const versoSede = pianificaTappaTurnoForestale({ ...opzioni, turno, cellaCorrente: 21 });
  assert.equal(versoSede?.edificioId, 60);
  assert.equal(versoSede?.destinazione, "sede");
  assert.ok(versoSede?.path.length);
  assert.equal(turno.fase, "verso_sede"); // Creare il percorso non significa arrivare.
  turno = segnalaArrivoTurnoForestale(turno, "sede", 430);
  turno = aggiornaTurnoForestale(turno, 490, 900);
  const versoBosco = pianificaTappaTurnoForestale({ ...opzioni, turno, cellaCorrente: 24 });
  assert.equal(versoBosco?.edificioId, 51);
  turno = segnalaArrivoTurnoForestale(turno, "bosco", 500);
  turno = aggiornaTurnoForestale(turno, 901, 900);
  const ritornoSede = pianificaTappaTurnoForestale({ ...opzioni, turno, cellaCorrente: 28 });
  assert.equal(ritornoSede?.edificioId, 60);
});
test("Non accetta sedi sbagliate, non costruite o non operative", () => {
  const turno = iniziaTurnoForestale({ abitanteId: 3, giorno: 2, lavoro: "Cacciatore", sedeId: 60, minuto: 420 });
  assert.equal(pianificaTappaTurnoForestale({ ...opzioni, turno, edifici: edifici.filter(e => e.id !== 60), cellaCorrente: 21 }), null);
  assert.equal(pianificaTappaTurnoForestale({ ...opzioni, turno, edifici: edifici.map(e => e.id === 60 ? { ...e, stato: "In costruzione" as const } : e), cellaCorrente: 21 }), null);
});
