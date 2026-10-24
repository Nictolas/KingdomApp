import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  provaCreaReligioneCustom, normalizzaReligioniCustom
} from "../src/game/fedeleCulto";
import {
  aggiornaSoddisfazioneReligioniNaturaliste, ID_MALUS_RELIGIOSO_BOSCO
} from "../src/game/reazioneReligioniBosco";
import {
  normalizzaStatoEcosistemaBosco, RISERVE_BOSCO_INIZIALI
} from "../src/game/ecosistemaBosco";
import { calcolaPunteggioSoddisfazione } from "../src/game/soddisfazione";
import type { Abitante, Edificio } from "../src/types";

const dottrina = { forestaSacra: true, tutelaFauna: true, tutelaVegetazione: true };
const created = provaCreaReligioneCustom({
  nome: "Custodi del Bosco", emoji: "🌳",
  dottrinaNaturalista: dottrina
}, [], () => "custom-1");
if (!created.ok) throw new Error(created.errore);
const culto = created.religione;
const fedele = { id: 34, nome: "Elda", religione: "Custodi del Bosco",
  lavoro: "Raccoglitore", salute: 100 } as Abitante;
const ateo = { ...fedele, id: 35, religione: "Ateo" };

function foresta(scorte = RISERVE_BOSCO_INIZIALI): Edificio {
  return {
    id: 51, nome: "Bosco", stato: "Operativo",
    ecosistemaBosco: {
      ...normalizzaStatoEcosistemaBosco(undefined, 0),
      riserve: { ...scorte }
    }
  } as Edificio;
}

test("Dottrine naturaliste esplicite e persistenti (anche dopo normalizzazione save)", () => {
  assert.deepEqual(culto.dottrinaNaturalista, dottrina);
  assert.deepEqual(normalizzaReligioniCustom([culto])[0]?.dottrinaNaturalista, dottrina);
  const vecchia = normalizzaReligioniCustom([{
    id: "legacy", nome: "Culto Antico", descrizione: "Senza dottrine"
  }])[0];
  assert.equal(vecchia?.dottrinaNaturalista, undefined);
});

test("Nessuna penalità alla condizione iniziale di un Bosco sano", () => {
  const residenti = [fedele, ateo];
  assert.equal(aggiornaSoddisfazioneReligioniNaturaliste(
    residenti, [foresta()], [culto]
  ), residenti);
});

test("Degrado: malus solo al fedele; ricalcolo non accumula penalità", () => {
  const danneggiata = foresta({ alberi: 3, fauna: 0, vegetazione: 2 });
  const base = [fedele, ateo];
  const aggiornati = aggiornaSoddisfazioneReligioniNaturaliste(base, [danneggiata], [culto]);
  const mod = aggiornati[0]!.modificatoriSoddisfazione!.find(
    m => m.id === ID_MALUS_RELIGIOSO_BOSCO
  )!;
  assert.ok(mod.delta < 0 && mod.delta >= -10);
  assert.equal(aggiornati[1], ateo);
  assert.equal(aggiornaSoddisfazioneReligioniNaturaliste(
    aggiornati, [danneggiata], [culto]
  ), aggiornati);
  assert.equal(aggiornati[0]!.modificatoriSoddisfazione!.length, 1);
  assert.equal(calcolaPunteggioSoddisfazione(
    aggiornati[0]!, [danneggiata], 2, 1, 0
  ), mod.delta);
});

test("Rigenerazione: la penalità si riduce e alla guarigione scompare", () => {
  const danneggiata = foresta({ alberi: 1, fauna: 1, vegetazione: 1 });
  const a = aggiornaSoddisfazioneReligioniNaturaliste(
    [fedele], [danneggiata], [culto]
  );
  const b = aggiornaSoddisfazioneReligioniNaturaliste(
    a, [foresta({ alberi: 50, fauna: 50, vegetazione: 50 })], [culto]
  );
  assert.ok(b[0]!.modificatoriSoddisfazione![0]!.delta >
    a[0]!.modificatoriSoddisfazione![0]!.delta);
  const c = aggiornaSoddisfazioneReligioniNaturaliste(b, [foresta()], [culto]);
  assert.equal(c[0]!.modificatoriSoddisfazione, undefined);
  assert.equal(aggiornaSoddisfazioneReligioniNaturaliste(c, [foresta()], [culto]), c);
});

test("UI della creazione offre le tre convinzioni e il gioco ricalcola nel tempo", () => {
  const ui = readFileSync("app/religioni.tsx", "utf8");
  const hook = readFileSync("src/hooks/useGameState.ts", "utf8");
  assert.match(ui, /dottrinaNaturalista: dottrinaNuova/);
  for (const key of ["forestaSacra", "tutelaFauna", "tutelaVegetazione"]) {
    assert.match(ui, new RegExp(key));
  }
  assert.match(hook, /aggiornaSoddisfazioneReligioniNaturaliste/);
});
