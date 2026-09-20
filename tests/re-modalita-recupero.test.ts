import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  STATO_RE_DEFAULT,
  applicaMoltiplicatoreProduzione,
  edificioBuffVisitaCorrente,
  setModalitaRePuro,
  tickModalitaReMensile,
  vulnerabileAttentato
} from "../src/game/reModalita";
import type { Edificio } from "../src/types";

const castello = {
  id: 1,
  nome: "Castello",
  tipo: "Amministrazione",
  stato: "Operativo",
  efficienza: 100,
  capacità: 24,
  occupazione: 1,
  abitantiAssegnati: [1]
} as Edificio;

const serra = {
  id: 2,
  nome: "Serra",
  tipo: "Agricoltura",
  stato: "Operativo",
  efficienza: 80,
  capacità: 4,
  occupazione: 0,
  abitantiAssegnati: []
} as Edificio;

test("il Re parte A giro con popolarità 50", () => {
  assert.equal(STATO_RE_DEFAULT.modalitaRe, "a_giro");
  assert.equal(STATO_RE_DEFAULT.popolaritaRe, 50);
});

test("A giro aumenta la popolarità di 2 al mese", () => {
  const result = tickModalitaReMensile(STATO_RE_DEFAULT, [castello, serra]);
  assert.equal(result.stato.popolaritaRe, 52);
  assert.equal(result.stato.mesiConsecutiviNelCastello, 0);
});

test("dopo tre mesi nel Castello cala la popolarità", () => {
  const stato = {
    ...STATO_RE_DEFAULT,
    modalitaRe: "nel_castello" as const,
    mesiConsecutiviNelCastello: 2
  };
  const result = tickModalitaReMensile(stato, [castello, serra]);
  assert.equal(result.stato.mesiConsecutiviNelCastello, 3);
  assert.equal(result.stato.popolaritaRe, 47);
  assert.match(result.avvisoDiario ?? "", /Castello/);
});

test("In visita seleziona l'edificio e segnala il buff storico", () => {
  const visita = setModalitaRePuro(STATO_RE_DEFAULT, "in_visita", 2);
  const result = tickModalitaReMensile(visita, [castello, serra]);
  assert.equal(result.stato.modalitaRe, "in_visita");
  assert.equal(result.edificioBuffId, 2);
  assert.equal(result.stato.popolaritaRe, 51);
});

test("il bonus visita è +15% solo sull'edificio operativo visitato", () => {
  const visita = setModalitaRePuro(STATO_RE_DEFAULT, "in_visita", 2);
  assert.equal(edificioBuffVisitaCorrente(visita, [castello, serra]), 2);
  assert.equal(applicaMoltiplicatoreProduzione(100, true), 114);
  assert.equal(applicaMoltiplicatoreProduzione(100, false), 100);
  assert.equal(
    edificioBuffVisitaCorrente(
      visita,
      [castello, { ...serra, stato: "Danneggiato" } as Edificio]
    ),
    null
  );
});

test("nel Castello il Re non è vulnerabile agli attentati", () => {
  assert.equal(vulnerabileAttentato("nel_castello"), false);
  assert.equal(vulnerabileAttentato("a_giro"), true);
  assert.equal(vulnerabileAttentato("in_visita"), true);
});

test("Castello e stato del Re sono ricollegati al gameplay", () => {
  const hook = readFileSync("src/hooks/useGameState.ts", "utf8");
  const context = readFileSync("src/context/GameContext.tsx", "utf8");
  const routes = readFileSync("src/game/mappaEdificioRoutes.ts", "utf8");
  const castlePage = readFileSync("app/castello.tsx", "utf8");

  assert.match(hook, /tickModalitaReMensile/);
  assert.match(hook, /setModalitaRe/);
  assert.match(hook, /popolaritaRe/);
  assert.match(hook, /edificioBuffVisitaCorrente/);
  assert.match(hook, /edificioBuffVisitaId: buffId/);
  assert.match(context, /modalitaRe: ModalitaRe/);
  assert.match(routes, /"Castello": "\/castello"/);
  assert.match(castlePage, /Modalità presenza/);
  assert.match(castlePage, /Popolarità:/);
});
