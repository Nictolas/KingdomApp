import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizzaPathRepathDaCella,
  scegliAzioneCommuteBloccataLavoro
} from "../src/game/commuteBloccataLavoro.ts";
import {
  attraversaFineFasciaLavoro,
  minutiInFascia
} from "../src/game/orariLavoroMappa.ts";
import type { FasciaOrariaMinuti } from "../src/game/orariLavoroCatalogo.ts";

test("attraversaFineFasciaLavoro: Fabbro esce alle 17, Barista no", () => {
  const fabbro: FasciaOrariaMinuti = { inizio: 8 * 60, fine: 17 * 60 };
  const barista: FasciaOrariaMinuti = { inizio: 11 * 60, fine: 22 * 60 };
  assert.equal(attraversaFineFasciaLavoro(17 * 60 - 1, 17 * 60, fabbro), true);
  assert.equal(attraversaFineFasciaLavoro(17 * 60 - 1, 17 * 60, barista), false);
  assert.equal(minutiInFascia(17 * 60, barista), true);
});

test("attraversaFineFasciaLavoro: fascia notturna Oste 17–1", () => {
  const oste: FasciaOrariaMinuti = { inizio: 17 * 60, fine: 1 * 60 };
  assert.equal(attraversaFineFasciaLavoro(60 - 1, 60, oste), true);
  assert.equal(attraversaFineFasciaLavoro(17 * 60 - 1, 17 * 60, oste), false);
  assert.equal(minutiInFascia(20 * 60, oste), true);
});

test("scegliAzioneCommuteBloccataLavoro: path libero → usa_path", () => {
  const azione = scegliAzioneCommuteBloccataLavoro({
    fromCell: 10,
    blockedCell: 11,
    cols: 10,
    pathEvitandoAltri: [10, 20, 30],
    pathAttraversoAltri: [10, 11, 12],
    giaAllIngresso: false,
    oscillazioniConsecutive: 0
  });
  assert.equal(azione.tipo, "usa_path");
  if (azione.tipo === "usa_path") assert.deepEqual(azione.path, [10, 20, 30]);
});

test("scegliAzioneCommuteBloccataLavoro: collo di bottiglia → attraverso altrimenti completa", () => {
  const azione = scegliAzioneCommuteBloccataLavoro({
    fromCell: 10,
    blockedCell: 11,
    cols: 10,
    pathEvitandoAltri: [10, 11, 12],
    pathAttraversoAltri: [10, 20, 30],
    giaAllIngresso: false,
    oscillazioniConsecutive: 0
  });
  assert.equal(azione.tipo, "usa_path");
  if (azione.tipo === "usa_path") assert.deepEqual(azione.path, [10, 20, 30]);
});

test("scegliAzioneCommuteBloccataLavoro: nessun path → completa (no freeze)", () => {
  const azione = scegliAzioneCommuteBloccataLavoro({
    fromCell: 10,
    blockedCell: 11,
    cols: 10,
    pathEvitandoAltri: null,
    pathAttraversoAltri: null,
    giaAllIngresso: false,
    oscillazioniConsecutive: 2
  });
  assert.equal(azione.tipo, "completa");
});

test("scegliAzioneCommuteBloccataLavoro: già all’ingresso → completa", () => {
  const azione = scegliAzioneCommuteBloccataLavoro({
    fromCell: 10,
    blockedCell: 11,
    cols: 10,
    pathEvitandoAltri: [10, 20],
    pathAttraversoAltri: [10, 20],
    giaAllIngresso: true,
    oscillazioniConsecutive: 0
  });
  assert.equal(azione.tipo, "completa");
});

test("normalizzaPathRepathDaCella taglia dal from corrente", () => {
  assert.deepEqual(normalizzaPathRepathDaCella([5, 6, 7, 8], 7, 10), [7, 8]);
});
