import assert from "node:assert/strict";
import test from "node:test";

import {
  ALIMENTAZIONI,
  alimentazioneCasuale,
  getAlimentazioneAbitante
} from "../src/game/alimentazione.ts";
import {
  ID_ZIO_PATERNO_DECEDUTO_RE,
  getGenitoriDecedutiRe,
  getZioZiaDecedutoCuginoRe,
  latoCuginoDaGenitoriIds
} from "../src/game/reGenitoriDeceduti.ts";

test("alimentazione supporta i tre regimi previsti e il fallback legacy", () => {
  assert.deepEqual(ALIMENTAZIONI, ["Onnivoro", "Vegetariano", "Vegano"]);
  assert.equal(getAlimentazioneAbitante({ alimentazione: "Vegano" } as any), "Vegano");
  assert.equal(getAlimentazioneAbitante({ personalità: "Vegetariano" } as any), "Vegetariano");
  assert.equal(getAlimentazioneAbitante({ personalità: "Tiepido" } as any), "Onnivoro");

  for (let i = 0; i < 50; i += 1) {
    assert.ok(ALIMENTAZIONI.includes(alimentazioneCasuale()));
  }
});

test("i parenti deceduti del Re sono stabili e identificano il ramo paterno del cugino", () => {
  const re = { id: 1, nome: "Nicolas Rossi" };
  const first = getGenitoriDecedutiRe(re);
  const second = getGenitoriDecedutiRe(re);

  assert.deepEqual(second, first);

  const zio = getZioZiaDecedutoCuginoRe(re, "paterno");
  assert.equal(zio.id, ID_ZIO_PATERNO_DECEDUTO_RE);
  assert.equal(latoCuginoDaGenitoriIds([zio.id]), "paterno");
});
