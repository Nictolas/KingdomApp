import type { Abitante } from "../types";

export type CategoriaPeso = "Denutrito" | "Normopeso" | "Sovrappeso" | "Obeso";

/**
 * Categoria di peso in base al valore peso (0-100):
 * Denutrito 0-40, Normopeso 41-80, Sovrappeso 81-95, Obeso 96+
 */
export function getCategoriaPeso(abitante: Abitante): CategoriaPeso {
  const p = abitante.peso ?? 50;
  if (p <= 40) return "Denutrito";
  if (p <= 80) return "Normopeso";
  if (p <= 95) return "Sovrappeso";
  return "Obeso";
}

/** Stato Salute mostrato in UI: "Sano" se Normopeso, altrimenti la categoria peso (Denutrito/Sovrappeso/Obeso). */
export type StatoSalute = "Sano" | "Denutrito" | "Sovrappeso" | "Obeso";

export function getStatoSalute(abitante: Abitante): StatoSalute {
  const cat = getCategoriaPeso(abitante);
  if (cat === "Normopeso") return "Sano";
  return cat;
}

/**
 * Consumo mensile di cibo (razioni) per abitante, deterministico da id e peso.
 * Allineato alle 4 categorie: Denutrito 1-4, Normopeso 2-5, Sovrappeso 4-7, Obeso 5-10.
 */
export function getConsumoCibo(abitante: Abitante): number {
  const seed = abitante.id * 17 + (abitante.peso ?? 50) * 23;
  const cat = getCategoriaPeso(abitante);
  switch (cat) {
    case "Denutrito":
      return 1 + (seed % 4); // 1-4
    case "Normopeso":
      return 2 + (seed % 4); // 2-5
    case "Sovrappeso":
      return 4 + (seed % 4); // 4-7
    case "Obeso":
      return 5 + (seed % 6); // 5-10
    default:
      return 2 + (seed % 4);
  }
}

export const CATEGORIE_PESO: CategoriaPeso[] = ["Denutrito", "Normopeso", "Sovrappeso", "Obeso"];

/** Produzione fissa di cibo per abitante assegnato alla Serra (10-20 razioni/mese). */
export function getProduzioneCiboPerAbitante(abitanteId: number): number {
  const seed = abitanteId * 31;
  return 10 + (seed % 11);
}
