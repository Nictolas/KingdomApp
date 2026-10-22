import type { useRouter } from "expo-router";

type Router = ReturnType<typeof useRouter>;

/**
 * La sola route che monta MappaScreen/Phaser è /mappa.
 * Tornare a / creava una nuova schermata Index distinta dalla vecchia /mappa,
 * producendo due scene WebGL nello stack dopo la visita a un edificio.
 * navigate riprende la route canonica già presente, oppure la apre una volta.
 */
export function tornaAllaMappa(router: Pick<Router, "navigate">): void {
  router.navigate("/mappa");
}
