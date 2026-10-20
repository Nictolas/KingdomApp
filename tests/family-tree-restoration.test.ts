import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  applicaAdozione,
  buildAlberoDiscendente,
  getFigliAdottatiIds,
  getFigliBiologiciIds,
  haGenitoriVivi,
  snapshotFamiglia
} from "../src/game/famiglia";
import type { Abitante } from "../src/types";

function abitante(id: number, nome: string, extra: Partial<Abitante> = {}): Abitante {
  return {
    id,
    nome,
    emoji: "👤",
    eta: 30,
    lavoro: "Disoccupato",
    competenza: 50,
    produttività: 50,
    stanchezza: 0,
    personalità: "Normale",
    amici: [],
    rivali: [],
    fazioni: [],
    peso: 50,
    salute: 100,
    reddito: 0,
    spese: 0,
    religione: "Ateo",
    lealtà: 50,
    paura: 0,
    felicità: 50,
    ...extra
  };
}

test("separa figli biologici e adottati", () => {
  const genitore = abitante(1, "A", { figliIds: [2, 3], figliAdottatiIds: [3] });
  assert.deepEqual(getFigliBiologiciIds(genitore), [2]);
  assert.deepEqual(getFigliAdottatiIds(genitore), [3]);
});

test("adozione aggiorna entrambi i lati della parentela", () => {
  const genitore = abitante(1, "A");
  const figlio = abitante(2, "B");
  const next = applicaAdozione(genitore, figlio);
  assert.deepEqual(next.adottante.figliIds, [2]);
  assert.deepEqual(next.adottante.figliAdottatiIds, [2]);
  assert.deepEqual(next.figlio.genitoriAdottiviIds, [1]);
});

test("snapshot famiglia espone coniuge, genitori, figli e adottivi", () => {
  const lista = [
    abitante(1, "A", { coniugeId: 2, figliIds: [3, 4], figliAdottatiIds: [4] }),
    abitante(2, "B"),
    abitante(3, "C", { genitoriIds: [1, 2] }),
    abitante(4, "D", { genitoriAdottiviIds: [1] })
  ];
  const s = snapshotFamiglia(lista[0]!, lista);
  assert.equal(s.coniuge?.id, 2);
  assert.deepEqual(s.figli.map((x) => x.id), [3]);
  assert.deepEqual(s.figliAdottati.map((x) => x.id), [4]);
});

test("albero discendente evita cicli", () => {
  const lista = [
    abitante(10, "A", { figliIds: [11] }),
    abitante(11, "B", { figliIds: [10], genitoriIds: [10] })
  ];
  const tree = buildAlberoDiscendente(10, lista, 8);
  assert.ok(tree);
  assert.equal(tree!.figli.length, 1);
  assert.equal(tree!.figli[0]!.figli.length, 0);
});

test("haGenitoriVivi considera anche genitori adottivi", () => {
  const lista = [abitante(1, "A"), abitante(2, "B", { genitoriAdottiviIds: [1] })];
  assert.equal(haGenitoriVivi(lista[1]!, lista), true);
});

test("scheda abitante collega famiglia, albero, adozione e individua", () => {
  const modal = readFileSync("src/ui/AbitanteInfoModal.tsx", "utf8");
  const tree = readFileSync("src/ui/FamigliaAlberoModal.tsx", "utf8");
  const state = readFileSync("src/hooks/useGameState.ts", "utf8");
  const map = readFileSync("app/mappa.tsx", "utf8");

  assert.match(modal, /FamigliaDettaglioModal/);
  assert.match(modal, /FamigliaAlberoModal/);
  assert.match(modal, /onIndividua/);
  assert.match(tree, /Albero genealogico/);
  assert.match(tree, /adottaFiglio/);
  assert.match(state, /const adottaFiglio/);
  assert.match(map, /setLocateAbitanteId\(id\)/);
});
