import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { mappaHaPonteOperativo } from "../src/game/ponteMappa";

test("la valutazione mensile degli obiettivi è collegata al runtime", () => {
  const hook = readFileSync("src/hooks/useGameState.ts", "utf8");
  assert.match(hook, /OBIETTIVI_CATALOGO/);
  assert.match(hook, /obiettiviSbloccati/);
  assert.match(hook, /setObiettiviCompletati/);
  assert.match(hook, /gameMode === "avventura"/);
});

test("un Ponte operativo viene riconosciuto dagli obiettivi", () => {
  const inMappa = {
    7: { id: 53, nome: "Ponte", edificioGlobaleId: 99 }
  } as any;
  const edifici = [
    { id: 99, nome: "Ponte", stato: "Operativo" }
  ] as any;

  assert.equal(mappaHaPonteOperativo(inMappa, edifici), true);
  assert.equal(
    mappaHaPonteOperativo(inMappa, [{ id: 99, nome: "Ponte", stato: "In costruzione" }] as any),
    false
  );
});
