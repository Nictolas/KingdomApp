import assert from "node:assert/strict";
import test from "node:test";
import {
  costoCostruzioneMonete,
  edificioSiPagaInMonete,
  EDIFICI_PREZZO_MONETE,
  sezioniFasciaCostruzione
} from "../src/game/edificiPrezzi.ts";
import { costoMaterialeEdilePerFootprint } from "../src/game/costruzioneEdifici.ts";
import { edificiData } from "../src/data/edificiData.ts";

test("tutti i prezzi monete sono presenti nel catalogo edifici", () => {
  for (const p of EDIFICI_PREZZO_MONETE) {
    const row = edificiData.find((e) => e.nome === p.nome);
    assert.ok(row, `manca edificio ${p.nome}`);
    assert.equal(row!.emoji, p.emoji, `emoji ${p.nome}`);
    assert.equal(costoCostruzioneMonete(p.nome), p.prezzoMonete);
    assert.equal(edificioSiPagaInMonete(p.nome), true);
    assert.equal(costoMaterialeEdilePerFootprint(p.nome, 2, 2), 0);
  }
});

test("prezzi chiave della tabella utente", () => {
  assert.equal(costoCostruzioneMonete("Emporio"), 100);
  assert.equal(costoCostruzioneMonete("Falegnameria"), 150);
  assert.equal(costoCostruzioneMonete("Cripta Necromantica"), 2000);
  assert.equal(costoCostruzioneMonete("Scuola"), 1250);
});

test("sezioni fascia 1–5 coperte", () => {
  const sezioni = sezioniFasciaCostruzione();
  assert.equal(sezioni.length, 5);
  assert.deepEqual(
    sezioni.map((s) => s.titolo),
    ["Fascia 1", "Fascia 2", "Fascia 3", "Fascia 4", "Fascia 5"]
  );
});
