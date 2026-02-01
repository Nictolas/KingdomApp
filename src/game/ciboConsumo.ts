import type { Abitante } from "../types";

export type CategoriaPeso = "Denutrito" | "Sano" | "Sovrappeso" | "Obeso";

/**
 * Categoria di peso in base alla salute (0-100):
 * Denutrito < 25, Sano 25-60, Sovrappeso 60-80, Obeso > 80
 */
export function getCategoriaPeso(abitante: Abitante): CategoriaPeso {
  const s = abitante.salute;
  if (s < 25) return "Denutrito";
  if (s <= 60) return "Sano";
  if (s <= 80) return "Sovrappeso";
  return "Obeso";
}

/**
 * Consumo mensile di cibo (razioni) per abitante, deterministico da id e salute.
 * Allineato alle 4 categorie: Denutrito 1-4, Sano 2-5, Sovrappeso 4-7, Obeso 5-10.
 */
export function getConsumoCibo(abitante: Abitante): number {
  const seed = abitante.id * 17 + abitante.salute * 23;
  const cat = getCategoriaPeso(abitante);
  switch (cat) {
    case "Denutrito":
      return 1 + (seed % 4); // 1-4
    case "Sano":
      return 2 + (seed % 4); // 2-5
    case "Sovrappeso":
      return 4 + (seed % 4); // 4-7
    case "Obeso":
      return 5 + (seed % 6); // 5-10
    default:
      return 2 + (seed % 4);
  }
}

export const CATEGORIE_PESO: CategoriaPeso[] = ["Denutrito", "Sano", "Sovrappeso", "Obeso"];

/** Produzione fissa di cibo per abitante assegnato alla Serra (10-20 razioni/mese). */
export function getProduzioneCiboPerAbitante(abitanteId: number): number {
  const seed = abitanteId * 31;
  return 10 + (seed % 11);
}
