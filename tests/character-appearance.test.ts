import assert from "node:assert/strict";
import test from "node:test";

import { generaColoniaIniziale } from "../src/game/generazionePartita.ts";
import {
  COLORI_CAPELLI,
  STILI_CAPELLI,
  STILI_OCCHI,
  VESTITI_PERSONAGGIO,
  generaAspettoCasuale,
  COLORE_PELLE_ORCO
} from "../src/game/personaggioAspetto.ts";

test("il generatore usa soltanto i pezzi disponibili nell'editor", () => {
  const values = [0, 0.24, 0.49, 0.74, 0.99];
  let index = 0;
  const aspetto = generaAspettoCasuale("Elfo", () => values[index++ % values.length]!);

  assert.ok(COLORI_CAPELLI.includes(aspetto.coloreCapelli));
  assert.ok(STILI_CAPELLI.includes(aspetto.stileCapelli));
  assert.ok(STILI_OCCHI.includes(aspetto.stileOcchi));
  assert.ok(VESTITI_PERSONAGGIO.includes(aspetto.vestiti));
  assert.notEqual(aspetto.cappello, "corona");
  assert.notEqual(aspetto.colorePelle, "#79a86b");
});

test("Orchi e Goblin ricevono tonalità di pelle fantasy", () => {
  const orco = generaAspettoCasuale("Orco", () => 0);
  const goblin = generaAspettoCasuale("Goblin", () => 0.99);

  assert.equal(orco.colorePelle, COLORE_PELLE_ORCO);
  assert.ok(["#79a86b", "#668f58", "#8aa66b"].includes(goblin.colorePelle));
});

test("ogni abitante iniziale non Golem nasce con un aspetto completo", () => {
  const { abitanti } = generaColoniaIniziale();

  assert.ok(abitanti.length >= 15);
  assert.ok(abitanti.filter((a) => a.razza !== "Golem").every((a) => a.aspetto != null));
  assert.ok(abitanti.filter((a) => a.razza === "Golem").every((a) => a.aspetto == null));
});
