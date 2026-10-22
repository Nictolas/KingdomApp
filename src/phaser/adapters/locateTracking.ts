import type { PhaserMapBuilding } from "./mapSceneBridge";

export type LocateWorldPoint = { x: number; y: number };

export type LocateTrackingPosition = {
  /** Punto esatto da tenere al centro della telecamera. */
  focus: LocateWorldPoint;
  /** Freccia sopra l'abitante, oppure sopra il tetto dell'edificio. */
  arrow: LocateWorldPoint;
  buildingAnchor: number | null;
};

type LocateBuilding = Pick<PhaserMapBuilding, "anchor" | "name" | "artKey" | "geometry">;

/**
 * Distingue un abitante che cammina all'aperto da uno all'interno di un edificio
 * usando le posizioni animate Phaser, non la sola cella finale del percorso.
 */
export function locateBuildingAtPoint(
  point: LocateWorldPoint,
  buildings: readonly LocateBuilding[],
  cellSize: number
): LocateBuilding | undefined {
  return buildings.find((building) => {
    // Bosco e Ponte sono attraversabili e non hanno un tetto da evidenziare.
    if (building.name === "Bosco" || building.name === "Ponte") return false;
    const footprint = building.geometry.footprint;
    const left = footprint.col * cellSize;
    const top = footprint.row * cellSize;
    return point.x >= left &&
      point.x < left + footprint.width * cellSize &&
      point.y >= top &&
      point.y < top + footprint.height * cellSize;
  });
}

export function resolveLocateTrackingPosition(
  characterWorldPosition: LocateWorldPoint | null,
  fallbackCell: number,
  cols: number,
  cellSize: number,
  buildings: readonly LocateBuilding[]
): LocateTrackingPosition {
  const focus = characterWorldPosition ?? {
    x: ((fallbackCell % cols) + 0.5) * cellSize,
    y: (Math.floor(fallbackCell / cols) + 0.5) * cellSize
  };

  const building = locateBuildingAtPoint(focus, buildings, cellSize);
  if (!building) {
    return {
      focus,
      arrow: { x: focus.x, y: focus.y - cellSize * 0.95 },
      buildingAnchor: null
    };
  }

  const { col, row, width } = building.geometry.footprint;
  // Gli edifici con artKey possono avere un tetto che sporge fino a ~0,75
  // celle sopra il footprint. Posizioniamo la freccia sopra l'immagine.
  const roofOverflow = building.artKey ? 0.75 * cellSize : 0;
  const arrowY = Math.max(
    cellSize * 0.35,
    row * cellSize - roofOverflow - cellSize * 0.27
  );
  return {
    // La camera segue la persona, non il tetto.
    focus,
    arrow: { x: (col + width / 2) * cellSize, y: arrowY },
    buildingAnchor: building.anchor
  };
}
