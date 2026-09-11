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

/** Stato Salute mostrato in UI: "Incinta", "Sano" se Normopeso, altrimenti la categoria peso. */
export type StatoSalute = "Sano" | "Denutrito" | "Sovrappeso" | "Obeso" | "Incinta";

export function getStatoSalute(abitante: Abitante): StatoSalute {
  if (abitante.incinta) return "Incinta";
  const cat = getCategoriaPeso(abitante);
  if (cat === "Normopeso") return "Sano";
  return cat;
}

/**
 * Consumo mensile di cibo (razioni) per abitante, deterministico da id e peso.
 * Regola fissa per categoria:
 * - Denutrito: 0-5 razioni/mese
 * - Sano (Normopeso): 6-10 razioni/mese
 * - Sovrappeso: 11-15 razioni/mese
 * - Obeso: 16-20 razioni/mese
 */
export function getConsumoCibo(abitante: Abitante): number {
  const seed = abitante.id * 17 + (abitante.peso ?? 50) * 23;
  const cat = getCategoriaPeso(abitante);
  switch (cat) {
    case "Denutrito":
      return seed % 6; // 0-5
    case "Normopeso":
      return 6 + (seed % 5); // 6-10
    case "Sovrappeso":
      return 11 + (seed % 5); // 11-15
    case "Obeso":
      return 16 + (seed % 5); // 16-20
    default:
      return 6 + (seed % 5);
  }
}

export const CATEGORIE_PESO: CategoriaPeso[] = ["Denutrito", "Normopeso", "Sovrappeso", "Obeso"];

/** Produzione fissa di cibo per abitante assegnato alla Serra (10-20 razioni/mese). */
export function getProduzioneCiboPerAbitante(abitanteId: number): number {
  const seed = abitanteId * 31;
  return 10 + (seed % 11);
}
