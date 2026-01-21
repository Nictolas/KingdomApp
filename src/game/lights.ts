import type { Light } from "../types";

export function isLightAt(lights: Light[], x: number, y: number) {
  return lights.some((l) => l.x === x && l.y === y);
}

// 3x3 intorno a una luce: 3 sopra, 3 al centro, 3 sotto
export function isIlluminatedByAnyLight(lights: Light[], x: number, y: number) {
  for (const light of lights) {
    if (y >= light.y - 1 && y <= light.y + 1 && x >= light.x - 1 && x <= light.x + 1) return true;
  }
  return false;
}

