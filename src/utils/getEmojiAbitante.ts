import type { Abitante } from "../types";
import { getEmojiRazza } from "../kingdomData";

/**
 * Emoji da mostrare per un abitante: gli alieni hanno sempre l'emoji della propria razza.
 * Gli umani usano l'emoji personale (abitante.emoji).
 */
export function getEmojiAbitante(abitante: Abitante): string {
  const razza = abitante.razza ?? "Umano";
  if (razza !== "Umano") return getEmojiRazza(razza);
  return abitante.emoji;
}
