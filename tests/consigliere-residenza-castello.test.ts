import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { abitantiData } from "../src/data/abitantiData";
import { edificiData } from "../src/data/edificiData";
import { normalizzaResidenzeCastello, rimuoviResidentiCastelloDaCaseMappa } from "../src/game/residenzaCastello";
import { getEdificioAbitazione } from "../src/game/abitanteEdifici";
import { trovaCellaAnchorCasaSuMappa } from "../src/game/residenzaMappa";

const re = { ...abitantiData[0]!, id: 1, lavoro: "Re" };
const consigliere = { ...abitantiData[1]!, id: 2, lavoro: "Consigliere" };
const cittadino = { ...abitantiData[2]!, id: 3, lavoro: "Agricoltore" };
const baseAbitanti = [re, consigliere, cittadino];
const vecchiEdifici = [
  { ...edificiData.find((e) => e.id === 1)!, abitantiAssegnati: [1], occupazione: 1 },
  { ...edificiData.find((e) => e.id === 20)!, abitantiAssegnati: [1, 2, 3], occupazione: 3 },
  { ...edificiData.find((e) => e.id === 14)!, abitantiAssegnati: [2], occupazione: 1 }
];

test("il Consigliere e il Re abitano solo nel Castello anche nei vecchi salvataggi", () => {
  const riparati = normalizzaResidenzeCastello(baseAbitanti, vecchiEdifici);
  assert.deepEqual(riparati[0]?.abitantiAssegnati, [1, 2]);
  assert.deepEqual(riparati[1]?.abitantiAssegnati, [3]);
  assert.deepEqual(riparati[2]?.abitantiAssegnati, []);
  assert.equal(riparati[0]?.occupazione, 2);
  assert.strictEqual(normalizzaResidenzeCastello(baseAbitanti, riparati), riparati);
  assert.equal(getEdificioAbitazione(2, riparati, consigliere)?.nome, "Castello");
});

test("cambiando Consigliere, il nuovo entra nel Castello e non resta nella casa", () => {
  const nuovo = { ...cittadino, lavoro: "Consigliere" };
  const vecchio = { ...consigliere, lavoro: "Disoccupato" };
  const riparati = normalizzaResidenzeCastello([re, vecchio, nuovo], vecchiEdifici);
  assert.deepEqual(riparati[0]?.abitantiAssegnati, [1, 3]);
  assert.ok(!(riparati[1]?.abitantiAssegnati ?? []).includes(3));
});

test("la mappa elimina le vecchie assegnazioni e riconosce il Castello come casa", () => {
  const mappa = { 10: [1, 2, 3], 20: [2] };
  const pulita = rimuoviResidentiCastelloDaCaseMappa(baseAbitanti, mappa);
  assert.deepEqual(pulita, { 10: [3], 20: [] });
  assert.strictEqual(rimuoviResidentiCastelloDaCaseMappa(baseAbitanti, pulita), pulita);
  const edificiInMappa = {
    40: { id: 1, nome: "Castello", emoji: "🏰" },
    10: { id: 20, nome: "Capanna", emoji: "🏠" }
  };
  assert.equal(trovaCellaAnchorCasaSuMappa(2, vecchiEdifici, edificiInMappa, mappa, consigliere), 40);
  assert.equal(trovaCellaAnchorCasaSuMappa(3, vecchiEdifici, edificiInMappa, { 10: [3] }, cittadino), 10);
});

test("inizializzazione, ripristino, profilo e mappa usano il Castello", () => {
  const state = readFileSync("src/hooks/useGameState.ts", "utf8");
  const map = readFileSync("app/mappa.tsx", "utf8");
  const profile = readFileSync("src/ui/AbitanteInfoModal.tsx", "utf8");
  assert.match(state, /residentiCastello = idsResidentiFissiCastello/);
  assert.match(state, /setEdifici\(normalizzaResidenzeCastello\(state.abitanti, state.edifici\)\)/);
  assert.match(map, /rimuoviResidentiCastelloDaCaseMappa/);
  assert.match(map, /trovaCellaAnchorCasaSuMappa\(a.id, edifici, edificiInMappa, residenzeMappa, a\)/);
  assert.match(profile, /getEdificioAbitazione\(abitante.id, edifici, abitante\)/);
});
