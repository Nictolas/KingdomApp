import type { useRouter } from "expo-router";
import { markBuildingExitForMapRecovery } from "./mapReturnRecovery";

type Router = ReturnType<typeof useRouter>;

/**
 * Le schede aperte dalla mappa sono push: la chiusura deve fare pop,
 * riprendendo la STESSA schermata/canvas Phaser lasciati nello stack.
 * Se una scheda viene aperta direttamente da URL, torna alla root /
 * (che monta la mappa) invece di cercare una route inesistente.
 */
export function tornaAllaMappa(router: Pick<Router, "back" | "canGoBack" | "replace">): void {
  if (router.canGoBack()) {
    // Segnala alla mappa che il canvas touch va ricreato al prossimo focus,
    // conservando lo stato di gioco e l'inquadratura della telecamera.
    markBuildingExitForMapRecovery();
    router.back();
  } else {
    router.replace("/");
  }
}
