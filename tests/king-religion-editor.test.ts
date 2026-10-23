import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { Abitante } from "../src/types";
import { ID_GIOCATORE } from "../src/game/schiavituCommercio";
import {
  provaCreaReligioneCustom,
  normalizzaReligioniCustom,
  modificaDogmiReligioneCustom
} from "../src/game/fedeleCulto";
import { dogmiDalModello, religioniModelloEresia, convertiFedeliInEresia } from "../src/game/eresieReligiose";
import { OBIETTIVI_BY_ID } from "../src/data/obiettiviCatalogo";

const create = (name: string, extra: Record<string, unknown> = {}) => {
  const r = provaCreaReligioneCustom({
    nome: name, fondatoreReId: ID_GIOCATORE, ...extra
  }, [], () => "test-" + name);
  assert.equal(r.ok, true);
  if (!r.ok) throw new Error(r.errore);
  return r.religione;
};

test("Originale: fondazione senza culto padre, zero conversioni iniziali", () => {
  const fede = create("Cammino Stellare");
  assert.equal(fede.fondatoreReId, ID_GIOCATORE);
  assert.equal(fede.origineReligione, undefined);
  const abitanti = [
    { id: 12, nome: "Ada", religione: "Culto del Sole", salute: 100 },
    { id: 13, nome: "Enzo", religione: "Culto del Sole", salute: 100 }
  ] as Abitante[];
  const r = convertiFedeliInEresia(abitanti, null, fede.nome, fede.id);
  assert.deepEqual(r.convertitiIds, []);
  assert.deepEqual(r.abitanti, abitanti);
});

test("Eresia: culto padre reale, conversioni iniziali piccole e stabili", () => {
  const fede = create("Nuovo Sole", {
    origineReligione: "Culto del Sole",
    dogmi: [{ tipo: "sovrano_rappresentante_divino" }]
  });
  assert.equal(fede.origineReligione, "Culto del Sole");
  const candidati = Array.from({ length: 200 }, (_, i) => ({
    id: i + 10, nome: "Cittadino " + i, religione: "Culto del Sole",
    salute: 100, lavoro: "Disoccupato"
  })) as Abitante[];
  const capo = { ...candidati[0]!, id: 500, lavoro: "Capo Religioso" };
  const sacerdote = { ...candidati[0]!, id: 501, lavoro: "Sacerdote" };
  const re = { ...candidati[0]!, id: ID_GIOCATORE, lavoro: "Re" };
  const tutti = [...candidati, capo, sacerdote, re];
  const a = convertiFedeliInEresia(tutti, "Culto del Sole", fede.nome, fede.id);
  const b = convertiFedeliInEresia(tutti, "Culto del Sole", fede.nome, fede.id);
  assert.deepEqual(a, b);
  assert.ok(a.convertitiIds.length > 0 && a.convertitiIds.length <= 50);
  assert.equal(a.abitanti.length, tutti.length);
  for (const id of [500, 501, ID_GIOCATORE]) {
    assert.equal(a.abitanti.find(x => x.id === id)?.religione, "Culto del Sole");
  }
});

test("Le fedi del gioco sono modelli, ma ateismo e agnosticismo non sono eresie", () => {
  const custom = create("Luna Antica", {
    dottrinaNaturalista: { forestaSacra: true, tutelaFauna: false, tutelaVegetazione: true },
    dogmi: [{ tipo: "sovrano_rappresentante_divino" }]
  });
  const modelli = religioniModelloEresia([custom]);
  assert.ok(modelli.includes("Culto del Sole"));
  assert.ok(modelli.includes("Culto delle Ombre"));
  assert.ok(modelli.includes(custom.nome));
  assert.ok(!modelli.includes("Ateo"));
  const copia = dogmiDalModello(custom.nome, [custom]);
  assert.equal(copia.dottrinaNaturalista.forestaSacra, true);
  assert.equal(copia.dogmi[0]?.tipo, "sovrano_rappresentante_divino");
});

test("Save legacy ed evoluzione: origine, fondatore e versioni rimangono intatti", () => {
  const fede = create("Nuovo Sole", { origineReligione: "Culto del Sole" });
  const normalizzata = normalizzaReligioniCustom([fede]);
  assert.equal(normalizzata[0]?.origineReligione, "Culto del Sole");
  const cambiata = modificaDogmiReligioneCustom(normalizzata, fede.id, [
    { tipo: "sovrano_rappresentante_divino" }
  ]);
  assert.equal(cambiata[0]?.versioneDogmi, 2);
  assert.equal(cambiata[0]?.fondatoreReId, ID_GIOCATORE);
  assert.equal(cambiata[0]?.origineReligione, "Culto del Sole");
  assert.deepEqual(normalizzaReligioniCustom([{ id: "old", nome: "Vecchia" }])[0]?.dogmi, undefined);
});

test("Teocrazia si sblocca solo con fede del re, dogma divino e religione di Stato", () => {
  const obj = OBIETTIVI_BY_ID.get("teocrazia");
  assert.ok(obj);
  const fede = create("Legge Divina", {
    dogmi: [{ tipo: "sovrano_rappresentante_divino" }]
  });
  const game = {
    abitanti: [{ id: ID_GIOCATORE, salute: 100 }] as Abitante[],
    edifici: [], risorse: [], mese: 1, anno: 1,
    moneteGiocatore: 100, completati: new Set<string>(),
    religioniCustom: [fede],
    religioneDiStato: fede.nome
  };
  assert.equal(obj.condizione(game), true);
  assert.equal(obj.condizione({ ...game, religioneDiStato: "Culto del Sole" }), false);
  assert.equal(obj.condizione({ ...game, religioniCustom: [
    { ...fede, dogmi: [] }
  ] }), false);
  assert.equal(obj.condizione({ ...game, abitanti: [] }), false);
});

test("Una sezione religioni sola mantiene politica, culti, editor e le vecchie rotte", () => {
  const ui = readFileSync("app/religioni.tsx", "utf8");
  const legacy = readFileSync("app/religione.tsx", "utf8");
  for (const text of [
    "Governo e fede", "Religione di Stato", "Ateismo di Stato",
    "Libertà di culto", "Editor della religione del Re", "Da zero",
    "Da un culto (eresia)", "Modifica dogmi", "ReligionePieChart",
    "ReligioneFedeliModal"
  ]) assert.ok(ui.includes(text), text);
  assert.match(legacy, /<Redirect href="\/religioni"/);
});
