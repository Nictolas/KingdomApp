import type { useRouter } from "expo-router";

type Router = ReturnType<typeof useRouter>;

/**
 * L'unica mappa montata e' la route root /.
 * /mappa e' un alias Redirect verso /; il ritorno dagli edifici
 * deve usare la root senza attraversare altri reindirizzamenti.
 */
export function tornaAllaMappa(router: Pick<Router, "navigate">): void {
  router.navigate("/");
}
