import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("la generazione iniziale usa terminologia Regno/Golem", () => {
  const generazione = readFileSync("src/game/generazionePartita.ts", "utf8");
  const stato = readFileSync("src/hooks/useGameState.ts", "utf8");

  assert.match(generazione, /generaRegnoIniziale/);
  assert.doesNotMatch(generazione, /generaColoniaIniziale|candidatiRobot|\bRobot\b|colonia/i);
  assert.match(stato, /generaRegnoIniziale/);
  assert.doesNotMatch(stato, /generaColoniaIniziale/);
});
