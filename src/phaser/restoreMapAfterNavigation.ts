/**
 * Ripristina il ciclo di rendering Phaser dopo una navigazione a una pagina edificio.
 *
 * Il clock di MyKingdom gira fuori da Phaser: può quindi avanzare anche quando
 * Phaser.Game è rimasto in pausa (perdita di focus o route nascosta).
 * Non chiamare start/restart: ricreerebbe sprite, tween, percorso e telecamera.
 */
export type RecoverablePhaserGame = {
  isBooted: boolean;
  isPaused: boolean;
  resume: () => void;
  loop: { running: boolean; wake: () => void };
  scene: {
    getScenes: (isActive?: boolean) => Array<{
      sys: { isPaused: () => boolean; isSleeping: () => boolean };
      scene: { resume: () => void; wake: () => void };
    }>;
  };
};

/**
 * Riattiva solo le parti realmente sospese.
 * La pausa intenzionale del tempo di gioco usa timescale e non Phaser.Game.pause.
 */
export function restoreMapAfterNavigation(game: RecoverablePhaserGame): boolean {
  if (!game.isBooted) return false;
  if (!game.loop.running) game.loop.wake();
  if (game.isPaused) game.resume();
  for (const scene of game.scene.getScenes(false)) {
    if (scene.sys.isSleeping()) scene.scene.wake();
    else if (scene.sys.isPaused()) scene.scene.resume();
  }
  return true;
}
