import assert from "node:assert/strict";
import test from "node:test";

import { generaColoniaIniziale } from "../src/game/generazionePartita.ts";

test("Avventura non applica i seed iniziali esclusivi della Creativa", () => {
  for (let i = 0; i < 25; i += 1) {
    const { abitanti } = generaColoniaIniziale("avventura");

    assert.equal(abitanti.some((a) => a.razza === "Golem"), false);
    assert.equal(abitanti.some((a) => a.fazioni?.includes("Nativi")), false);
    assert.equal(abitanti.some((a) => a.lavoro === "Prigioniero"), false);
    assert.equal(abitanti.some((a) => a.reati?.includes("Ex Sovrano")), false);
    assert.equal(abitanti.some((a) => a.incinta), false);
    assert.equal(abitanti.some((a) => a.lavoro === "Capo Religioso"), false);

    const re = abitanti.find((a) => a.id === 1);
    assert.ok(re?.fazioni?.includes("Rivoluzionari"));
  }
});

test("Creativa conserva i seed iniziali completi", () => {
  const { abitanti } = generaColoniaIniziale("creativa");

  assert.ok(abitanti.some((a) => a.razza === "Golem"));
  assert.ok(abitanti.some((a) => a.fazioni?.includes("Nativi")));
  assert.ok(abitanti.some((a) => a.reati?.includes("Ex Sovrano")));
  assert.ok(abitanti.some((a) => a.incinta));
  assert.ok(abitanti.some((a) => a.lavoro === "Capo Religioso"));
});
