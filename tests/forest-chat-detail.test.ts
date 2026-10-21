import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { layoutNorthernForestTrees, ritaglioAlphaAlbero } from "../src/game/forestaSpriteGrid";
import { descriviAzioneCorrenteAbitante, nomeInterlocutoreChiacchiera } from "../src/game/azioneAbitanteMappa";
import type { Abitante } from "../src/types";

test("gli sprite perdono i margini trasparenti ma conservano chiome e tronchi", () => {
  const pixels = new Uint8ClampedArray(6 * 8 * 4);
  for (let y = 2; y <= 6; y++) {
    for (let x = 1; x <= 4; x++) pixels[(y * 6 + x) * 4 + 3] = 255;
  }
  assert.deepEqual(ritaglioAlphaAlbero(pixels, 6, 8), { x: 1, y: 2, width: 4, height: 5 });
  assert.deepEqual(ritaglioAlphaAlbero(new Uint8ClampedArray(6 * 8 * 4), 6, 8), { x: 0, y: 0, width: 6, height: 8 });
});

test("la foresta occupa quasi l'intera altezza senza intersecare i rettangoli degli alberi", () => {
  const trees = layoutNorthernForestTrees(1200, 40);
  assert.ok(trees.length > 20);
  assert.ok(Math.min(...trees.map(t => t.y)) < 1);
  assert.ok(240 - Math.max(...trees.map(t => t.y + t.height)) < 1);
  for (let i = 0; i < trees.length; i++) for (let j = i + 1; j < trees.length; j++) {
    const a = trees[i]!, b = trees[j]!;
    const intersect = a.x < b.x + b.width && a.x + a.width > b.x &&
      a.y < b.y + b.height && a.y + a.height > b.y;
    assert.equal(intersect, false);
  }
});

const giulia = { id: 101, nome: "Giulia Bianchi" } as Abitante;
const marco = { id: 102, nome: "Marco Rossi" } as Abitante;
const others = [giulia, marco];
const active = { 101: 102, 102: 101 };

const options = {
  edifici: [],
  buioCielo: 0,
  orologioMinuti: 720,
  dormonoACasaIds: new Set<number>(),
  lavoroArrivatiIds: new Set<number>(),
  barArrivatiByEdificio: {},
  cultoArrivatiByEdificio: {},
  staChiacchierando: true
};

test("il nome e il cognome sono quelli del vero interlocutore, per entrambi", () => {
  const nomeMarco = nomeInterlocutoreChiacchiera(101, active, others);
  const nomeGiulia = nomeInterlocutoreChiacchiera(102, active, others);
  assert.equal(nomeMarco, "Marco Rossi");
  assert.equal(nomeGiulia, "Giulia Bianchi");
  assert.equal(descriviAzioneCorrenteAbitante(giulia, { ...options, nomeInterlocutoreChiacchiera: nomeMarco }),
    "Sta chiacchierando con Marco Rossi");
  assert.equal(descriviAzioneCorrenteAbitante(marco, { ...options, nomeInterlocutoreChiacchiera: nomeGiulia }),
    "Sta chiacchierando con Giulia Bianchi");
});

test("interlocutore sparito: nessun nome inventato e fallback descrittivo", () => {
  assert.equal(nomeInterlocutoreChiacchiera(101, { 101: 999 }, others), null);
  assert.equal(nomeInterlocutoreChiacchiera(101, {}, others), null);
  assert.equal(nomeInterlocutoreChiacchiera(101, { 101: 101 }, others), null);
  assert.equal(descriviAzioneCorrenteAbitante(giulia, options), "Sta chiacchierando");
});

test("il nome del partner arriva tanto alla scheda rapida quanto a quella dettagliata", () => {
  const map = readFileSync(new URL("../app/mappa.tsx", import.meta.url), "utf8");
  assert.match(map, /nomeInterlocutoreChiacchiera: nomeInterlocutoreChiacchiera\(sintesiMappaAbitante\.id, chiacchieraConById, abitanti\)/);
  assert.match(map, /nomeInterlocutoreChiacchiera: nomeInterlocutoreChiacchiera\(schedaWandererAbitante\.id, chiacchieraConById, abitanti\)/);
});
