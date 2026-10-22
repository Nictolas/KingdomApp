import { EDIFICIO_TO_ROUTE } from "../game/mappaEdificioRoutes";

/**
 * L'intero catalogo degli edifici è la fonte unica per mostrare l'uscita.
 * Una nuova pagina edificio registrata in EDIFICIO_TO_ROUTE riceve il pulsante
 * fisso senza dover ricordare di aggiungerlo a ogni schermata.
 */
const buildingPaths = [...new Set(Object.values(EDIFICIO_TO_ROUTE))]
  .filter((path) => path.startsWith("/") && path !== "/");

export function isBuildingRoute(pathname: string): boolean {
  const normalized = pathname.split("?")[0]!.replace(/\/+$/, "") || "/";
  return buildingPaths.some((path) =>
    normalized === path || normalized.startsWith(path + "/")
  );
}
