import type { Abitante, Alimentazione } from "../types";

export const ALIMENTAZIONI: Alimentazione[] = ["Onnivoro", "Vegetariano", "Vegano"];

/** Restituisce sempre un regime valido e supporta i vecchi salvataggi. */
export function getAlimentazioneAbitante(abitante: Abitante): Alimentazione {
  if (abitante.alimentazione && ALIMENTAZIONI.includes(abitante.alimentazione)) return abitante.alimentazione;
  if (abitante.personalità === "Vegetariano" || abitante.personalità === "Vegano") return abitante.personalità;
  return "Onnivoro";
}

export function alimentazioneCasuale(): Alimentazione {
  const r = Math.random();
  if (r < 0.1) return "Vegetariano";
  if (r < 0.15) return "Vegano";
  return "Onnivoro";
}
