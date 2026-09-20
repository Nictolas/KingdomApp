import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  normalizzaPathRepathDaCella,
  scegliAzioneCommuteBloccataLavoro
} from "../src/game/commuteBloccataLavoro";

test("normalizza il repath partendo dalla cella corrente", () => {
  assert.deepEqual(normalizzaPathRepathDaCella([10, 11, 12], 10, 20), [10, 11, 12]);
  assert.deepEqual(normalizzaPathRepathDaCella([11, 12], 10, 20), [10, 11, 12]);
});

test("preferisce un percorso che evita la cella bloccata", () => {
  const result = scegliAzioneCommuteBloccataLavoro({
    fromCell: 10,
    blockedCell: 11,
    cols: 20,
    pathEvitandoAltri: [10, 30, 31],
    pathAttraversoAltri: [10, 11, 12],
    giaAllIngresso: false,
    oscillazioniConsecutive: 0
  });
  assert.equal(result.tipo, "usa_path");
  if (result.tipo === "usa_path") assert.deepEqual(result.path, [10, 30, 31]);
});

test("se il collo di bottiglia persiste non congela il lavoratore", () => {
  const result = scegliAzioneCommuteBloccataLavoro({
    fromCell: 10,
    blockedCell: 11,
    cols: 20,
    pathEvitandoAltri: [10, 11, 12],
    pathAttraversoAltri: [10, 11, 12],
    giaAllIngresso: false,
    oscillazioniConsecutive: 1
  });
  assert.equal(result.tipo, "usa_path");
});

test("se non esiste alcun percorso completa la commute invece di lasciarla sospesa", () => {
  const result = scegliAzioneCommuteBloccataLavoro({
    fromCell: 10,
    blockedCell: 11,
    cols: 20,
    pathEvitandoAltri: null,
    pathAttraversoAltri: null,
    giaAllIngresso: false,
    oscillazioniConsecutive: 3
  });
  assert.equal(result.tipo, "completa");
});

test("mappa usa il recupero anti-freeze per le commute di lavoro", () => {
  const map = readFileSync("app/mappa.tsx", "utf8");
  assert.match(map, /scegliAzioneCommuteBloccataLavoro/);
  assert.match(map, /blocchiLavoroRef/);
  assert.match(map, /handleCommuteFinita\(abitanteId, "work"\)/);
});
