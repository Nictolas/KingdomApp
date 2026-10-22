import type { useRouter } from "expo-router";

type Router = ReturnType<typeof useRouter>;

/**
 * Le schede aperte dalla mappa sono push: la chiusura deve fare pop,
 * riprendendo la STESSA schermata/canvas Phaser lasciati nello stack.
 * Se una scheda viene aperta direttamente da URL, torna alla root /
 * (che monta la mappa) invece di cercare una route inesistente.
 */
export function tornaAllaMappa(router: Pick<Router, "back" | "canGoBack" | "replace">): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/");
  }
}
