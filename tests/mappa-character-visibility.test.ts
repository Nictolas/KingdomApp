import assert from "node:assert/strict";
import test from "node:test";

import { mapCharacterShouldBeVisible } from "../src/game/mappaCharacterVisibility.ts";

test("un abitante libero resta visibile sulla mappa", () => {
  assert.equal(
    mapCharacterShouldBeVisible({
      inCommute: false,
      atWorkNow: false,
      atBarNow: false,
      atCultNow: false
    }),
    true
  );
});

test("un abitante arrivato dentro lavoro, bar o culto viene nascosto", () => {
  for (const location of ["atWorkNow", "atBarNow", "atCultNow"] as const) {
    assert.equal(
      mapCharacterShouldBeVisible({
        inCommute: false,
        atWorkNow: location === "atWorkNow",
        atBarNow: location === "atBarNow",
        atCultNow: location === "atCultNow"
      }),
      false
    );
  }
});

test("la commute mantiene il personaggio visibile anche durante una fascia interna", () => {
  assert.equal(
    mapCharacterShouldBeVisible({
      inCommute: true,
      atWorkNow: true,
      atBarNow: true,
      atCultNow: true
    }),
    true
  );
});
