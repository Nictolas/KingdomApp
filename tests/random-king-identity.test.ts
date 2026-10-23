import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  COGNOMI_UMANI,
  NOMI_UMANI_CON_SESSO,
  generaIdentitaReCasuale
} from "../src/game/nomiUmani.ts";

test("Sorprendimi genera tutti i dati di identità, coerenti con il nome", () => {
  const first = generaIdentitaReCasuale(() => 0);
  assert.deepEqual(first, {
    nome: "Marco",
    cognome: "Rossi",
    sesso: "M",
    orientamento: "Etero"
  });

  const last = generaIdentitaReCasuale(() => 0.999);
  assert.deepEqual(last, {
    nome: "Laura",
    cognome: "Ricci",
    sesso: "F",
    orientamento: "Asessuale"
  });
});

test("ogni nome casuale mantiene il sesso registrato e un cognome valido", () => {
  for (let i = 0; i < NOMI_UMANI_CON_SESSO.length; i++) {
    const valori = [(i + 0.5) / NOMI_UMANI_CON_SESSO.length, 0.5, 0.4];
    let index = 0;
    const identita = generaIdentitaReCasuale(() => valori[index++]!);
    assert.equal(identita.nome, NOMI_UMANI_CON_SESSO[i]!.nome);
    assert.equal(identita.sesso, NOMI_UMANI_CON_SESSO[i]!.sesso);
    assert.ok(COGNOMI_UMANI.includes(identita.cognome));
    assert.equal(identita.orientamento, "Omo");
  }
});

test("tutti i quattro orientamenti possono essere estratti", () => {
  const orientamenti = ["Etero", "Omo", "Bi", "Asessuale"];
  for (let i = 0; i < orientamenti.length; i++) {
    const valori = [0, 0, (i + 0.5) / orientamenti.length];
    let index = 0;
    assert.equal(generaIdentitaReCasuale(() => valori[index++]!).orientamento, orientamenti[i]);
  }
});

test("Sorprendimi completa l'identità soltanto durante la creazione, preservando modifica e abiti", () => {
  const ui = readFileSync(new URL("../src/ui/CreazioneGiocatoreModal.tsx", import.meta.url), "utf8");
  assert.match(ui, /mode === "create" \? generaIdentitaReCasuale\(\) : null/);
  for (const campo of ["Nome", "Cognome", "Sesso", "Orientamento"]) {
    assert.match(ui, new RegExp(`set${campo}\\(identita\\.${campo.toLowerCase() === "sesso" ? "sesso" : campo.toLowerCase()}\\)`));
  }
  assert.match(ui, /sesso: identita\?\.sesso \?\? sesso \?\? undefined/);
});
