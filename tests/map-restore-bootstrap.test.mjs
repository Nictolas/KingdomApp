import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getMappaSessione, setMappaSessione } from "../src/game/mappaSessione.ts";

function readRepoFile(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `marker iniziale non trovato: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `marker finale non trovato: ${endMarker}`);
  return source.slice(start, end);
}

function assertBefore(source, firstMarker, secondMarker) {
  const first = source.indexOf(firstMarker);
  const second = source.indexOf(secondMarker);
  assert.notEqual(first, -1, `marker non trovato: ${firstMarker}`);
  assert.notEqual(second, -1, `marker non trovato: ${secondMarker}`);
  assert.ok(first < second, `${firstMarker} deve precedere ${secondMarker}`);
}

test("la mappa ripristinata resta la sessione runtime corrente", () => {
  const restoredMap = { __bk013Marker: "restored-map" };
  try {
    setMappaSessione(restoredMap);
    assert.equal(getMappaSessione(), restoredMap);
  } finally {
    setMappaSessione(null);
  }
});

test("Continua ripristina lo stato prima di rendere attiva l'app", () => {
  const source = readRepoFile("src/context/GameContext.tsx");
  const continua = sliceBetween(source, "const continua = useCallback", "const nuovaPartita");

  assertBefore(
    continua,
    "gameState.restorePersistableState(gameSaveV1ToGameState(loaded.save.payload))",
    'setStartup("active")'
  );
});

test("il restore installa la mappa salvata prima di tornare alla fase di gioco", () => {
  const source = readRepoFile("src/hooks/useGameState.ts");
  const restore = sliceBetween(source, "const restorePersistableState", "const createPersistableState");

  assertBefore(restore, "setMappaSessione(state.mappa)", "setTimeout(() => setGamePhase");
});

test("MappaScreen con una sessione esistente parte ready e non genera una nuova mappa", () => {
  const source = readRepoFile("app/mappa.tsx");
  const screen = source.slice(source.indexOf("export function MappaScreen()"));

  assertBefore(screen, "const session = getMappaSessione()", 'return { status: "ready", state: normalizeMappaSessione(session) }');
  assertBefore(screen, 'if (boot.status === "ready") return;', "buildInitialMappa(");
});


test("Nuova Partita azzera la sessione mappa prima di riattivare l'app", () => {
  const gameStateSource = readRepoFile("src/hooks/useGameState.ts");
  const startNewGame = sliceBetween(gameStateSource, "const startNewGame = useCallback", "const configuraGiocatore");
  assertBefore(startNewGame, "setMappaSessione(null)", 'setGamePhase("commander-creation")');

  const contextSource = readRepoFile("src/context/GameContext.tsx");
  const avvia = sliceBetween(contextSource, "const avviaNuovaPartita = useCallback", "const annullaSceltaModalita");
  assertBefore(avvia, "gameState.startNewGame(mode)", 'setStartup("active")');
});
