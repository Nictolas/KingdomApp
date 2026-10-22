import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  restoreMapAfterNavigation,
  type RecoverablePhaserGame
} from "../src/phaser/restoreMapAfterNavigation.ts";

function fakeGame(options: {
  booted?: boolean;
  paused?: boolean;
  loopRunning?: boolean;
  sleeping?: boolean;
  scenePaused?: boolean;
} = {}) {
  const actions: string[] = [];
  let paused = options.paused ?? true;
  let loopRunning = options.loopRunning ?? false;
  let sleeping = options.sleeping ?? true;
  let scenePaused = options.scenePaused ?? false;
  const game: RecoverablePhaserGame = {
    isBooted: options.booted ?? true,
    get isPaused() { return paused; },
    resume: () => { actions.push("resume game"); paused = false; },
    loop: {
      get running() { return loopRunning; },
      wake: () => { actions.push("wake loop"); loopRunning = true; }
    },
    scene: {
      getScenes: () => [{
        sys: { isSleeping: () => sleeping, isPaused: () => scenePaused },
        scene: {
          wake: () => { actions.push("wake scene"); sleeping = false; },
          resume: () => { actions.push("resume scene"); scenePaused = false; }
        }
      }]
    }
  };
  return { game, actions };
}

test("rientro da Bar: riattiva il loop, il gioco e la scena senza ricreare la mappa", () => {
  const { game, actions } = fakeGame();
  assert.equal(restoreMapAfterNavigation(game), true);
  assert.deepEqual(actions, ["wake loop", "resume game", "wake scene"]);
  assert.equal(game.isPaused, false);
  assert.equal(game.loop.running, true);
});

test("rientro da altri edifici: riprende la scena in pausa conservando Game attivo", () => {
  const { game, actions } = fakeGame({
    paused: false, loopRunning: true, sleeping: false, scenePaused: true
  });
  restoreMapAfterNavigation(game);
  assert.deepEqual(actions, ["resume scene"]);
});

test("mappa gia' attiva: nessuna ripartenza o reset della scena", () => {
  const { game, actions } = fakeGame({
    paused: false, loopRunning: true, sleeping: false, scenePaused: false
  });
  restoreMapAfterNavigation(game);
  restoreMapAfterNavigation(game);
  assert.deepEqual(actions, []);
});

test("prima del boot di Phaser non forza la riattivazione", () => {
  const { game, actions } = fakeGame({ booted: false });
  assert.equal(restoreMapAfterNavigation(game), false);
  assert.deepEqual(actions, []);
});

test("tutte le route edificio condividono il recupero, senza perdere la sessione", () => {
  const surface = readFileSync(
    new URL("../src/components/PhaserMapSurface.web.tsx", import.meta.url), "utf8"
  );
  const map = readFileSync(new URL("../app/mappa.tsx", import.meta.url), "utf8");
  const nav = readFileSync(new URL("../src/navigation/tornaAllaMappa.ts", import.meta.url), "utf8");
  assert.ok(surface.includes("restoreMapAfterNavigation(runtime.game)"));
  assert.ok(surface.includes('window.addEventListener("focus", recoverVisibleMap)'));
  assert.ok(surface.includes('window.addEventListener("pageshow", recoverVisibleMap)'));
  assert.ok(surface.includes("resizeObserver.observe(host)"));
  assert.ok(map.includes("phaserMapRef.current?.resumeInteractions()"));
  assert.ok(map.includes("phaserMapRef.current?.refreshViewport()"));
  assert.ok(nav.includes('router.navigate("/")'));
});
