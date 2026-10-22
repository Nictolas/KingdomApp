import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { Abitante, Edificio } from "../src/types.ts";
import { edificiData } from "../src/data/edificiData.ts";
import { capienzaPostiLavoro, normalizzaGiudiciTribunale, normalizzaLavoroEAgricoltura, edificioAccettaDisoccupatoCittadino } from "../src/game/edificiLavoro.ts";
import { sediCercaLavoroDisoccupatoInOrdine } from "../src/game/commutePathsMappa.ts";
import { appearanceForPublicSpace, copriBustoFemminile } from "../src/character-system/appearance.ts";
import { creaCharacterAppearance, aspettoPerVisualizzazioneAbitante } from "../src/game/personaggioAspetto.ts";

const abitante = (id: number, lavoro: string): Abitante => ({
  id, nome: `Persona ${id}`, lavoro, razza: "Umano", sesso: "F", casta: "Cittadino",
  competenza: 85, fazioni: ["Cittadini"], eta: 30, inventario: []
} as unknown as Abitante);
const edificio = (nome: string, id: number, cap: number, ids: number[] = []): Edificio => ({
  id, nome, capacità: cap, abitantiAssegnati: ids, occupazione: ids.length,
  stato: "Operativo", tipo: "Giustizia"
} as Edificio);

test("catalogo Tribunale offre un posto, non dieci", () => {
  assert.equal(edificiData.find(e => e.nome === "Tribunale")?.capacità, 1);
});

test("la migrazione dei salvataggi conserva un Giudice e libera gli altri senza eliminare abitanti", () => {
  const people = [abitante(2, "Giudice"), abitante(3, "Giudice"), abitante(4, "Giudice")];
  const court = edificio("Tribunale", 12, 10, [3, 2, 4]);
  assert.equal(capienzaPostiLavoro(court), 1);
  const normalizzati = normalizzaGiudiciTribunale(people, [court]);
  assert.deepEqual(normalizzati[0]!.abitantiAssegnati, [3]);
  assert.equal(normalizzati[0]!.occupazione, 1);
  assert.equal(normalizzati[0]!.capacità, 1);
  assert.equal(normalizzaGiudiciTribunale(people, normalizzati), normalizzati);
  const updated = normalizzaLavoroEAgricoltura(people, normalizzati);
  assert.equal(updated.abitanti.filter(a => a.lavoro === "Giudice").length, 1);
  assert.equal(updated.abitanti.length, 3);
  assert.equal(updated.abitanti.filter(a => a.lavoro === "Disoccupato").length, 2);
  assert.equal(edificioAccettaDisoccupatoCittadino(abitante(5, "Disoccupato"), normalizzati[0]!, people), false);
});

test("due Tribunali possono avere ciascuno un Giudice", () => {
  const people = [abitante(2, "Giudice"), abitante(3, "Giudice")];
  const courts = [edificio("Tribunale", 12, 10, [2, 3]), edificio("Tribunale", 60, 10, [3])];
  const result = normalizzaGiudiciTribunale(people, courts);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(e => e.abitantiAssegnati), [[2], [3]]);
});

test("il Bosco non resta sempre dietro la Miniera: i disoccupati ripartiscono le candidature", () => {
  const mine = { ...edificio("Miniera", 3, 20), tipo: "Industria" } as Edificio;
  const forest = { ...edificio("Bosco", 51, 20), tipo: "Ambiente" } as Edificio;
  const even = sediCercaLavoroDisoccupatoInOrdine(abitante(2, "Disoccupato"), [mine, forest]);
  const odd = sediCercaLavoroDisoccupatoInOrdine(abitante(3, "Disoccupato"), [mine, forest]);
  assert.deepEqual(even.map(x => x.nome), ["Bosco", "Miniera"]);
  assert.deepEqual(odd.map(x => x.nome), ["Miniera", "Bosco"]);
});

test("una donna ha un busto coperto anche con nudismo attivo e corpo adulto", () => {
  const initial = creaCharacterAppearance("Umano", "female");
  const naked = { ...initial, outfit: "none", upperOutfit: "none", fullOutfit: "none" };
  const actual = appearanceForPublicSpace(naked, {
    isKing: false, nudismoAttivo: true, sesso: "F", lavoro: "Disoccupato", razza: "Umano", seed: 8
  });
  assert.notEqual(actual.upperOutfit, "none");
  assert.equal(naked.upperOutfit, "none");
  const male = copriBustoFemminile(naked, "M");
  assert.equal(male, naked);
});

test("copertura femminile mantenuta anche dopo aggiornamento eta e corpo LPC", () => {
  const result = aspettoPerVisualizzazioneAbitante({
    id: 11, eta: 15, razza: "Umano", sesso: "F", lavoro: "Disoccupato",
    aspetto: {
      coloreCapelli: "#6b3f24", stileCapelli: "lunghi", stileOcchi: "tondi",
      colorePelle: "#e9b38f", vestiti: "viandante", cappello: "nessuno",
      characterAppearance: creaCharacterAppearance("Umano", "female")
    }
  }, { nudismoAttivo: true });
  assert.ok(result?.characterAppearance);
  assert.notEqual(result!.characterAppearance!.upperOutfit, "none");
});

test("i cambi di lavoro sono collegati alla pagina Bosco già esistente", () => {
  const state = readFileSync(new URL("../src/hooks/useGameState.ts", import.meta.url), "utf8");
  assert.match(state, /edificio\\?\\.nome === "Bosco"/);
  assert.match(state, /assumiDisoccupatoNelBosco\\(abitanti, edifici, abitanteId\\)/);
});
