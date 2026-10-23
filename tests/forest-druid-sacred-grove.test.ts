import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { edificiData } from "../src/data/edificiData";
import { getLavoroPerEdificio } from "../src/game/edificiLavoro";
import { filtraEdificiInizialiPerModalita } from "../src/game/edificiInizialiModalita";
import { SEDE_PER_PROFESSIONE } from "../src/game/turniForestali";
import { scegliLuogoSacroBosco, normalizzaStatoEcosistemaBosco } from "../src/game/ecosistemaBosco";
import { applicaRaccoltaBoscoGiornaliera } from "../src/game/boscoRaccolta";
import type { Abitante, Edificio } from "../src/types";

const culti = [{
  id: "cult-1", nome: "Custodi della Foresta",
  dottrinaNaturalista: { forestaSacra: true, tutelaFauna: true, tutelaVegetazione: true }
}, { id: "cult-2", nome: "Culto senza tutela" }];

function sede(nome: string, id: number, lavoratori: number[]): Edificio {
  return { id, nome, stato: "Operativo", capacità: 5,
    occupazione: lavoratori.length, abitantiAssegnati: lavoratori } as Edificio;
}
const bosco = sede("Bosco", 51, []);
const cerchio = sede("Cerchio dei Druidi", 60, [21]);
const druido = (religione = "Custodi della Foresta", minuti = 360): Abitante =>
  ({ id: 21, nome: "Elda", lavoro: "Druido", religione, salute: 100,
    competenza: 80, ultimoIngressoBoscoGiorno: 1,
    ultimoLavoroBosco: { giorno: 1, minuti },
    inventario: [{ itemId: "monete", quantità: 5 }] }) as Abitante;

test("Druido: nuova professione e Cerchio costruibile con turni e senza sede iniziale", () => {
  const template = edificiData.find(e => e.nome === "Cerchio dei Druidi");
  assert.ok(template);
  assert.equal(getLavoroPerEdificio(template), "Druido");
  assert.equal(SEDE_PER_PROFESSIONE.Druido, "Cerchio dei Druidi");
  assert.ok(!filtraEdificiInizialiPerModalita(edificiData, "avventura")
    .some(e => e.nome === "Cerchio dei Druidi"));
});

test("Consacrazione solo a una religione che ha realmente una dottrina naturalista", () => {
  const s = normalizzaStatoEcosistemaBosco(undefined, 0);
  assert.equal(scegliLuogoSacroBosco(s, "Fede inesistente", culti, 1), s);
  assert.equal(scegliLuogoSacroBosco(s, "Culto senza tutela", culti, 1), s);
  const c = scegliLuogoSacroBosco(s, "Custodi della Foresta", culti, 1);
  assert.equal(c.luogoSacro?.religione, "Custodi della Foresta");
  assert.equal(normalizzaStatoEcosistemaBosco(c, 0).luogoSacro?.consacratoGiorno, 1);
  assert.equal(scegliLuogoSacroBosco(c, "Custodi della Foresta", culti, 2), c);
  const revocato = scegliLuogoSacroBosco(c, null, culti, 3);
  assert.equal(revocato.luogoSacro, undefined);
  assert.deepEqual(revocato.riserve, s.riserve);
});

test("Il Druido lavora nella foresta consacrata e favorisce vegetazione senza bottino", () => {
  const stato = scegliLuogoSacroBosco(
    normalizzaStatoEcosistemaBosco(undefined, 0),
    "Custodi della Foresta", culti, 1
  );
  const senzaDruido = applicaRaccoltaBoscoGiornaliera([], [
    { ...bosco, ecosistemaBosco: stato }, cerchio
  ], 2, 1);
  const conDruido = applicaRaccoltaBoscoGiornaliera([druido()], [
    { ...bosco, ecosistemaBosco: stato }, cerchio
  ], 2, 1);
  assert.equal(conDruido.bottini.length, 0);
  assert.ok(conDruido.edifici[0]!.ecosistemaBosco!.riserve.vegetazione >
    senzaDruido.edifici[0]!.ecosistemaBosco!.riserve.vegetazione);
  assert.deepEqual(conDruido.abitanti[0]!.inventario, druido().inventario);
  // Ripetere lo stesso giorno non crea un secondo rituale.
  const dupe = applicaRaccoltaBoscoGiornaliera(conDruido.abitanti, conDruido.edifici, 2, 1);
  assert.equal(dupe.edifici, conDruido.edifici);
});

test("Niente potenziamento senza culto corrispondente o ore effettive", () => {
  const stato = scegliLuogoSacroBosco(
    normalizzaStatoEcosistemaBosco(undefined, 0),
    "Custodi della Foresta", culti, 1
  );
  const f = { ...bosco, ecosistemaBosco: stato };
  const base = applicaRaccoltaBoscoGiornaliera([], [f, cerchio], 2, 1);
  for (const a of [druido("Culto senza tutela"), druido("Custodi della Foresta", 0)]) {
    const x = applicaRaccoltaBoscoGiornaliera([a], [f, cerchio], 2, 1);
    assert.equal(x.edifici[0]!.ecosistemaBosco!.riserve.vegetazione,
      base.edifici[0]!.ecosistemaBosco!.riserve.vegetazione);
  }
});

test("La pagina Bosco permette la consacrazione senza inventare un edificio sul bosco", () => {
  const ui = readFileSync("app/bosco.tsx", "utf8");
  assert.match(ui, /scegliLuogoSacroBosco/);
  assert.match(ui, /religioniNaturaliste/);
  assert.match(ui, /Revoca consacrazione/);
  assert.match(ui, /dottrinaNaturalista/);
});
