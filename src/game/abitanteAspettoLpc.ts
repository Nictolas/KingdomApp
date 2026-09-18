import { normalizeCharacterAppearance } from "../character-system/appearance";
import type { CharacterAppearance } from "../character-system/types";
import type { Abitante, Razza } from "../types";
import { creaCharacterAppearance } from "./personaggioAspetto";

type AbitanteAspettoInput = Pick<Abitante, "aspetto" | "razza" | "eta" | "sesso">;

function bodyTypePerAbitante(abitante: AbitanteAspettoInput, razza: Exclude<Razza, "Golem">): string {
  if (razza === "Nano" || abitante.eta < 13) return "child";
  if (abitante.eta < 18) return "teen";
  return abitante.sesso === "F" ? "female" : "male";
}

/**
 * Restituisce sempre l'aspetto Universal LPC per un abitante renderizzabile.
 * I vecchi salvataggi senza characterAppearance vengono migrati in memoria
 * usando razza, età e sesso; i Golem restano rappresentati dalla loro icona.
 */
export function getCharacterAppearanceAbitante(
  abitante: AbitanteAspettoInput
): CharacterAppearance | null {
  if (abitante.razza === "Golem") return null;

  if (abitante.aspetto?.characterAppearance) {
    return normalizeCharacterAppearance(abitante.aspetto.characterAppearance);
  }

  const razza: Exclude<Razza, "Golem"> = abitante.razza ?? "Umano";
  return creaCharacterAppearance(razza, bodyTypePerAbitante(abitante, razza));
}
