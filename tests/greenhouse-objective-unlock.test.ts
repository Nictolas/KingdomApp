import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  COLTURE_SERRA,
  COLTURA_SERRA_DEFAULT,
  getColtureSerraDisponibili,
  normalizzaColtureSerraSbloccate
} from "../src/game/colturaSerra";

test("in Avventura la Serra espone solo le colture sbloccate", () => {
  const disponibili = getColtureSerraDisponibili([COLTURA_SERRA_DEFAULT], "avventura");
  assert.deepEqual(disponibili.map((c) => c.id), [COLTURA_SERRA_DEFAULT]);
});

test("raccolto_serra sblocca tutte le colture e Creativa le ha sempre tutte", () => {
  const sbloccate = normalizzaColtureSerraSbloccate({
    sbloccate: [COLTURA_SERRA_DEFAULT],
    modalitaGioco: "avventura",
    obiettiviCompletati: ["raccolto_serra"]
  });
  assert.equal(sbloccate.length, COLTURE_SERRA.length);
  assert.equal(getColtureSerraDisponibili([], "creativa").length, COLTURE_SERRA.length);
});

test("UI e runtime rispettano la lista colture sbloccate", () => {
  const screen = readFileSync("app/serra/[id].tsx", "utf8");
  const hook = readFileSync("src/hooks/useGameState.ts", "utf8");
  const mapping = readFileSync("src/persistence/gameStateMapping.ts", "utf8");

  assert.match(screen, /getColtureSerraDisponibili/);
  assert.match(screen, /coltureDisponibili\.map/);
  assert.match(hook, /!coltureSerraSbloccate\.includes\(colturaItemId\)/);
  assert.match(hook, /obiettiviCompletati\.includes\("raccolto_serra"\)/);
  assert.match(mapping, /coltureSerraSbloccate: state\.coltureSerraSbloccate/);
});
