import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  DEFAULT_GAME_MODE,
  GAME_MODE_OPTIONS,
  normalizeGameMode
} from "../src/game/gameMode";

test("new game exposes the Adventure and Creative choices", () => {
  assert.deepEqual(
    GAME_MODE_OPTIONS.map((option) => option.label),
    ["Avventura", "Creativa"]
  );
});

test("legacy saves without a game mode migrate to Adventure", () => {
  assert.equal(normalizeGameMode(undefined), DEFAULT_GAME_MODE);
  assert.equal(normalizeGameMode(null), "adventure");
  assert.equal(normalizeGameMode("creative"), "creative");
  assert.equal(normalizeGameMode("adventure"), "adventure");
});

test("new-game startup must pass through the mode-choice screen", () => {
  const contextSource = readFileSync(
    resolve(process.cwd(), "src/context/GameContext.tsx"),
    "utf8"
  );
  const modeScreenSource = readFileSync(
    resolve(process.cwd(), "src/ui/GameModeSelectionScreen.tsx"),
    "utf8"
  );

  assert.equal(contextSource.includes('"mode-choice"'), true);
  assert.equal(contextSource.includes("GameModeSelectionScreen"), true);
  assert.equal(contextSource.includes("startNewGame(mode)"), true);
  assert.equal(modeScreenSource.includes("Avventura"), false);
  assert.equal(modeScreenSource.includes("GAME_MODE_OPTIONS"), true);
});
