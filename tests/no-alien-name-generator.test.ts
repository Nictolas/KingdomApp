import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";

test("la generazione dei nomi usa terminologia fantasy e non aliena", () => {
  assert.equal(existsSync("src/game/nomiFantasy.ts"), true);
  assert.equal(existsSync("src/game/nomiAlieni.ts"), false);

  const generazione = readFileSync("src/game/generazionePartita.ts", "utf8");
  const immigrazione = readFileSync("src/game/immigrazione.ts", "utf8");
  const nomi = readFileSync("src/game/nomiFantasy.ts", "utf8");

  assert.match(generazione, /generaNomeFantasy/);
  assert.match(generazione, /RAZZE_NON_UMANE/);
  assert.match(immigrazione, /generaNomeFantasy/);
  assert.match(nomi, /export function generaNomeFantasy/);

  for (const source of [generazione, immigrazione, nomi]) {
    assert.doesNotMatch(source, /generaNomeAlieno|nomiAlieni|RAZZE_ALIENE/);
  }
});
