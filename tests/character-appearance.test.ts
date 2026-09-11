import assert from "node:assert/strict";
import test from "node:test";

import { generaColoniaIniziale } from "../src/game/generazionePartita.ts";
import {
  COLORI_CAPELLI,
  STILI_CAPELLI,
  STILI_OCCHI,
  VESTITI_PERSONAGGIO,
  generaAspettoCasuale
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

  assert.ok(["#79a86b", "#668f58", "#8aa66b"].includes(orco.colorePelle));
  assert.ok(["#79a86b", "#668f58", "#8aa66b"].includes(goblin.colorePelle));
});

test("ogni abitante iniziale non Golem nasce con un aspetto completo", () => {
  const { abitanti } = generaColoniaIniziale("creativa");

  assert.ok(abitanti.length >= 20);
  assert.ok(abitanti.filter((a) => a.razza !== "Golem").every((a) => a.aspetto != null));
  assert.ok(abitanti.filter((a) => a.razza === "Golem").every((a) => a.aspetto == null));
});

test("a inizio partita ogni razza attiva ha almeno 1 adulto M e 1 adulta F", () => {
  const razze = ["Nano", "Scheletro", "Vampiro", "Goblin", "Orco", "Lucertoloide"] as const;
  for (let i = 0; i < 8; i++) {
    const { abitanti } = generaColoniaIniziale("creativa");
    for (const razza of razze) {
      assert.ok(
        abitanti.some((a) => a.razza === razza && a.sesso === "M" && a.eta >= 18),
        `manca ${razza} maschio adulto`
      );
      assert.ok(
        abitanti.some((a) => a.razza === razza && a.sesso === "F" && a.eta >= 18),
        `manca ${razza} femmina adulta`
      );
    }
  }
});

test("Avventura parte con pochi abitanti e ruoli essenziali", () => {
  for (let i = 0; i < 5; i++) {
    const { abitanti } = generaColoniaIniziale("avventura");
    assert.ok(abitanti.length >= 5 && abitanti.length <= 8);
    assert.ok(abitanti.some((a) => a.id === 1));
    assert.ok(abitanti.some((a) => a.lavoro === "Consigliere"));
    assert.ok(abitanti.some((a) => a.lavoro === "Agricoltore"));
    assert.equal(abitanti.filter((a) => a.lavoro === "Prigioniero").length, 0);
  }
});
