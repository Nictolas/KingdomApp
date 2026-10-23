import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("la generazione iniziale usa terminologia Regno/Golem", () => {
  const generazione = readFileSync("src/game/generazionePartita.ts", "utf8");
  const stato = readFileSync("src/hooks/useGameState.ts", "utf8");

  assert.match(generazione, /generaRegnoIniziale/);
  // Esiste soltanto l'alias deprecato per i vecchi salvataggi/test.
  assert.match(generazione, /generaColoniaIniziale = generaRegnoIniziale/);
  assert.doesNotMatch(generazione, /candidatiRobot|\bRobot\b/i);
  assert.match(stato, /generaRegnoIniziale/);
  assert.doesNotMatch(stato, /generaColoniaIniziale/);
});
