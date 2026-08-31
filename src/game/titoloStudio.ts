import type { Abitante, TitoloDiStudio } from "../types";

/** Titolo di studio da mostrare; null solo per Robot senza istruzione. */
export function getTitoloStudioAbitante(
  abitante: Abitante,
  etaMinimaLavoro: number
): TitoloDiStudio | null {
  if (abitante.titoloStudio) return abitante.titoloStudio;
  if (abitante.razza === "Golem") return null;

  const eta = abitante.eta;
  if (eta < 6) return "Asilo";
  if (eta < 12) return "Elementare";
  if (eta < etaMinimaLavoro) return "Superiore";
  if (abitante.competenza >= 55) return "Università";
  return "Superiore";
}

/** Assegna `titoloStudio` in base all'età (generazione partita / nuovi coloni). */
export function inferTitoloStudioPerEta(eta: number, etaMinimaLavoro: number, razza?: Abitante["razza"]): TitoloDiStudio | undefined {
  if (razza === "Golem") return undefined;
  if (eta < 6) return "Asilo";
  if (eta < 12) return "Elementare";
  if (eta < etaMinimaLavoro) return "Superiore";
  if (eta >= 22 && eta >= etaMinimaLavoro) return "Università";
  return "Superiore";
}
