import type { Router } from "expo-router";
import type { Edificio } from "../types";
import {
  impostaAperturaResidenzaAnchor,
  impostaAperturaResidenzaPerAbitante
} from "../game/mappaAperturaPending";
import { getMappaSessione } from "../game/mappaSessione";
import { NOMI_RESIDENZE_MAPPA, risolviAnchorCasaAbitante } from "../game/residenzaMappa";
import { getRouteForEdificio } from "./edificioRoutes";

/** True se la residenza ha edifici sulla mappa (Capanna, Dormitorio, Baracca). */
export function isResidenzaSuMappa(nome: string): boolean {
  return NOMI_RESIDENZE_MAPPA.has(nome);
}

/**
 * Apre la residenza specifica dell'abitante sulla mappa (es. la sua Capanna).
 * Fallback: schermata catalogo `/residenze` se non mappabile.
 */
export function apriResidenzaAbitante(
  router: Router,
  abitanteId: number,
  edificio: Edificio,
  edifici: Edificio[],
  onCloseProfilo: () => void,
  onApriResidenzaMappa?: (anchor: number) => void
): void {
  if (edificio.tipo !== "Residenza" || !isResidenzaSuMappa(edificio.nome)) {
    const route = getRouteForEdificio(edificio);
    if (route) {
      onCloseProfilo();
      router.push(route);
    }
    return;
  }

  const session = getMappaSessione();
  if (session) {
    const anchor = risolviAnchorCasaAbitante(
      abitanteId,
      edifici,
      session.edificiInMappa,
      session.residenzeMappa
    );
    if (anchor != null) {
      onCloseProfilo();
      if (onApriResidenzaMappa) {
        onApriResidenzaMappa(anchor);
        return;
      }
      impostaAperturaResidenzaAnchor(anchor);
      router.navigate("/");
      return;
    }
  }

  onCloseProfilo();
  impostaAperturaResidenzaPerAbitante(abitanteId);
  router.navigate("/");
}
