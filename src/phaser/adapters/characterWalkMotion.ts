/**
 * Durata visiva indipendente dalla grandezza delle celle (40px o 64px).
 * I moltiplicatori 1x/2x/4x del tempo di gioco restano gestiti da Phaser.
 */
export const CHARACTER_WALK_SPEED_PX_PER_SECOND = 80;
const CHARACTER_MIN_STEP_MS = 120;

export function characterStepDurationMs(fromX: number, fromY: number, toX: number, toY: number): number {
  const distance = Math.hypot(toX - fromX, toY - fromY);
  return Math.max(CHARACTER_MIN_STEP_MS, Math.round(distance * 1000 / CHARACTER_WALK_SPEED_PX_PER_SECOND));
}

/** La prima riga LPC e' "up"; ogni animazione ha 2 o 9 colonne per direzione. */
export function lpcFrameForRow(directionRow: number, framesPerDirection: number): number {
  return directionRow * framesPerDirection;
}
