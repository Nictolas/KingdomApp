import type { Router } from "expo-router";

/**
 * Torna alla mappa senza rimontarla da zero.
 * `navigate("/")` riprende la route già in stack (niente nuovo push → niente reload Phaser).
 */
export function tornaAllaMappa(router: Pick<Router, "navigate">): void {
  router.navigate("/");
}
