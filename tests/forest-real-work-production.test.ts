import assert from "node:assert/strict";
import test from "node:test";
import { iniziaTurnoForestale, segnalaArrivoTurnoForestale, aggiornaTurnoForestale } from "../src/game/turniForestali";
import { applicaRaccoltaBoscoGiornaliera } from "../src/game/boscoRaccolta";
import type { Abitante, Edificio } from "../src/types";

const bosco = { id: 51, nome: "Bosco", stato: "Operativo", abitantiAssegnati: [17], capacità: 20 } as Edificio;
const persona = {
  id: 17, nome: "Test", lavoro: "Raccoglitore", casta: "Cittadino",
  personalità: "Paziente", competenza: 100,
  inventario: [{ itemId: "monete", quantità: 0 }]
} as Abitante;

test("La distanza reale consuma il turno: arrivo tardivo non paga bottino", () => {
  let turno = iniziaTurnoForestale({
    abitanteId: 17, giorno: 1, lavoro: "Raccoglitore", sedeId: null, minuto: 390
  });
  // I minuti del viaggio (390 → 890) non vengono contabilizzati.
  turno = segnalaArrivoTurnoForestale(turno, "bosco", 890);
  turno = aggiornaTurnoForestale(turno, 920, 900);
  assert.equal(turno.minutiNelBosco, 10);
  const p = {
    ...persona, ultimoIngressoBoscoGiorno: 1,
    ultimoLavoroBosco: { giorno: 1, minuti: turno.minutiNelBosco }
  };
  assert.equal(applicaRaccoltaBoscoGiornaliera([p], [bosco], 2, 1).bottini.length, 0);
});

test("Un turno completo, dopo l'arrivo reale, può produrre il bottino", () => {
  let turno = iniziaTurnoForestale({
    abitanteId: 17, giorno: 1, lavoro: "Raccoglitore", sedeId: null, minuto: 390
  });
  turno = segnalaArrivoTurnoForestale(turno, "bosco", 420);
  turno = aggiornaTurnoForestale(turno, 780, 930);
  assert.equal(turno.minutiNelBosco, 360);
  const p = {
    ...persona, ultimoIngressoBoscoGiorno: 1,
    ultimoLavoroBosco: { giorno: 1, minuti: turno.minutiNelBosco }
  };
  assert.ok(applicaRaccoltaBoscoGiornaliera([p], [bosco], 2, 1).bottini.length > 0);
});

test("Il componente mappa salva i minuti derivati dal turno e non dalla sola assunzione", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync("app/mappa.tsx", "utf8");
  assert.match(source, /ultimoLavoroBosco:\s*\{\s*giorno,\s*minuti:\s*progredito\.minutiNelBosco\s*\}/);
  assert.match(source, /segnalaArrivoTurnoForestale\(iniziale, "bosco", orologioMinuti\)/);
});
