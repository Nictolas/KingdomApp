import assert from "node:assert/strict";
import test from "node:test";

import { generaColoniaIniziale } from "../src/game/generazionePartita.ts";

test("Avventura e Creativa generano popolazioni iniziali diverse", () => {
  for (let i = 0; i < 25; i += 1) {
    const avventura = generaColoniaIniziale("avventura");
    const creativa = generaColoniaIniziale("creativa");

    assert.ok(
      avventura.abitanti.length >= 10 && avventura.abitanti.length <= 11,
      `Avventura deve avere 10-11 abitanti totali (7-8 base + cugino + 2 Schiavi), trovati ${avventura.abitanti.length}`
    );
    assert.ok(
      creativa.abitanti.length >= 20 && creativa.abitanti.length <= 28,
      `Creativa deve avere 20-28 abitanti, trovati ${creativa.abitanti.length}`
    );
  }
});
