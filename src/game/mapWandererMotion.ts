/** Movimenti e animazioni degli abitanti sulla mappa (senza dipendenze React). */
export type WanderDirection = "n" | "s" | "e" | "w";

/** Tempi per attraversare una casella. Sulle strade si cammina un po' più velocemente. */
export const MOVE_DURATION_MS = 1000;
export const MOVE_DURATION_ROAD_MS = 750;

/** Cadenza costante del ciclo di tre frame, indipendente dalla durata del passo. */
export const WALK_FRAME_INTERVAL_MS = 180;

export function segmentMoveDurationMs(
  from: number,
  to: number,
  isRoadCell?: (cellIndex: number) => boolean
): number {
  return isRoadCell?.(from) || isRoadCell?.(to) ? MOVE_DURATION_ROAD_MS : MOVE_DURATION_MS;
}

/**
 * character.png è composto da 4 terne di frame:
 * 0–2 fronte, 3–5 tre quarti verso l'alto, 6–8 schiena, 9–11 tre quarti verso il basso.
 * Le camminate orizzontali devono usare 9–11 (non 3–5, che fa sembrare che guardino in su).
 * Per ovest lo stesso gruppo viene specchiato orizzontalmente dal componente.
 */
export function frameGroupStart(direction: WanderDirection): number {
  switch (direction) {
    case "s": return 0;
    case "n": return 6;
    case "e":
    case "w": return 9;
  }
}

/** Non invertire il ciclo a ovest: lo specchiamento basta, l'inversione creava uno scatto. */
export function walkIndexInGroup(_direction: WanderDirection, walkFrame: number, isMoving: boolean): number {
  if (!isMoving) return 0;
  return Math.max(0, Math.floor(walkFrame)) % 3;
}

/** I frame avanzano a circa 5,6 fps, anche quando il movimento tra caselle è lento. */
export function walkFrameFromElapsedMs(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.floor(elapsedMs / WALK_FRAME_INTERVAL_MS) % 3;
}
