import assert from "node:assert/strict";
import test from "node:test";
import {
  applicaRaccoltaBoscoGiornaliera
} from "../src/game/boscoRaccolta";
import {
  normalizzaStatoEcosistemaBosco,
  aggiornaLeggeCacciaBosco,
  RISERVE_BOSCO_INIZIALI
} from "../src/game/ecosistemaBosco";
import type { Abitante, Edificio } from "../src/types";

const animale = (id: number, lavoro: string) => ({
  id, nome: "Foresta " + id, lavoro, competenza: 100,
  personalità: "Paziente", casta: "Cittadino",
  ultimoIngressoBoscoGiorno: 1,
  ultimoLavoroBosco: { giorno: 1, minuti: 360 },
  inventario: [{ itemId: "monete", quantità: 5 }]
}) as Abitante;
const sede = (id: number, nome: string, lavoratori: number[]) => ({
  id, nome, stato: "Operativo", abitantiAssegnati: lavoratori, capacità: 10
}) as Edificio;
function bosco(stato?: Edificio["ecosistemaBosco"]): Edificio {
  return {
    ...sede(51, "Bosco", []), ecosistemaBosco: stato
  };
}

test("La foresta salva riserve e giorno lavorato; chiamate duplicate sono innocue", () => {
  const r = applicaRaccoltaBoscoGiornaliera([], [bosco()], 2, 1);
  const salvato = r.edifici[0]!.ecosistemaBosco!;
  assert.equal(salvato.ultimoGiornoAggiornato, 1);
  assert.ok(salvato.riserve.alberi > RISERVE_BOSCO_INIZIALI.alberi);
  assert.ok(Object.values(salvato.riserve).every(v => v >= 0 && v <= 100));
  const duplicato = applicaRaccoltaBoscoGiornaliera([], r.edifici, 2, 1);
  assert.equal(duplicato.edifici, r.edifici);
  assert.equal(duplicato.bottini.length, 0);
});

test("La quota zero vieta la caccia, anche con Cacciatori già assunti", () => {
  const legge = aggiornaLeggeCacciaBosco(
    normalizzaStatoEcosistemaBosco(undefined, 0), 0, "spietata"
  );
  const r = applicaRaccoltaBoscoGiornaliera(
    [animale(21, "Cacciatore")],
    [bosco(legge), sede(54, "Capanna del Cacciatore", [21])], 2, 1
  );
  assert.equal(r.bottini.length, 0);
  assert.equal(r.edifici[0]!.ecosistemaBosco!.quotaMassimaCacciatori, 0);
  assert.equal(r.edifici[0]!.ecosistemaBosco!.intensitaCaccia, "spietata");
});

test("La fauna esaurita non genera selvaggina prima della rigenerazione", () => {
  const vuota = normalizzaStatoEcosistemaBosco(undefined, 0);
  vuota.riserve.fauna = 0;
  const r = applicaRaccoltaBoscoGiornaliera(
    [animale(21, "Cacciatore")],
    [bosco(vuota), sede(54, "Capanna del Cacciatore", [21])], 2, 1
  );
  assert.equal(r.bottini.length, 0);
  assert.ok(r.edifici[0]!.ecosistemaBosco!.riserve.fauna >= 0);
});

test("I silvicoltori attivi aumentano la rigenerazione, non creano inventario", () => {
  const base = normalizzaStatoEcosistemaBosco(undefined, 0);
  base.riserve.alberi = 15;
  const semplice = applicaRaccoltaBoscoGiornaliera([], [bosco(base)], 2, 1);
  const colVivaio = applicaRaccoltaBoscoGiornaliera(
    [animale(31, "Silvicoltore")],
    [bosco(base), sede(59, "Vivaio forestale", [31])], 2, 1
  );
  assert.ok(colVivaio.edifici[0]!.ecosistemaBosco!.riserve.alberi >
    semplice.edifici[0]!.ecosistemaBosco!.riserve.alberi);
  assert.equal(colVivaio.bottini.length, 0);
});

test("Il prelievo riduce le scorte e si mantiene fra salvataggi", () => {
  const prima = normalizzaStatoEcosistemaBosco(undefined, 0);
  const r = applicaRaccoltaBoscoGiornaliera(
    [animale(21, "Cacciatore")],
    [bosco(prima), sede(54, "Capanna del Cacciatore", [21])], 2, 1
  );
  assert.ok(r.bottini.length > 0);
  assert.ok(r.edifici[0]!.ecosistemaBosco!.riserve.fauna < prima.riserve.fauna);
  assert.ok(r.bottini.every(b => b.voci.every(v => v.quantità > 0)));
});
