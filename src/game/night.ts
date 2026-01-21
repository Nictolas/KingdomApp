import { blendHex } from "./color";

export function computeNightOpacity(hours: number, minutes: number) {
  const t = hours * 60 + minutes;
  if (t >= 18 * 60 || t < 6 * 60) {
    if (t >= 18 * 60) {
      const minutesFrom18 = t - 18 * 60;
      const progress = Math.min(1, minutesFrom18 / 60);
      return 0.75 + progress * 0.20; // 0.75 -> 0.95
    }
    const progress = t / (6 * 60);
    return 0.95 * (1 - progress);
  }
  return 0;
}

export function applyNightTint(baseHex: string, nightOpacity: number) {
  if (nightOpacity <= 0) return baseHex;
  let bg = blendHex(baseHex, "#0b1026", nightOpacity);
  bg = blendHex(bg, "#2b1140", nightOpacity * 0.18);
  return bg;
}

