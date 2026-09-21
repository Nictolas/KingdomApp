import { deriveBuildingGeometry, edificioHaIngressoPerimetrale } from "../../game/buildingGeometry";
import {
  getErbaDecorSheetCoord,
  getErbaSheetCoord,
  getErbaSpiaggiaSheetCoord,
  getSpiaggiaSheetCoordForWaterMask,
  getStradaSheetCoord,
  getWaterSheetCoord
} from "../../game/overworldSpritesheetLayout";
import { isTerrenoAcqua } from "../../game/riverGeneration";
import {
  buildCoastalAssetLookups,
  buildErbaAssetLookup,
  buildStradaAssetLookup,
  erbaExtraDecorCasuale,
  sandWaterEdgeMaskAt
} from "../../game/terrainSpriteHelpers";
import type { MappaRuntimeState } from "../../game/mappaTypes";
import type { Edificio } from "../../types";
import type { PhaserMapBuilding, PhaserMapCharacter, PhaserMapSnapshot, PhaserMapTile } from "./mapSceneBridge";

const BUILDING_EMOJI: Record<string, string> = {
  Castello: "🏰",
  Dormitorio: "🛏️",
  Capanna: "⛺",
  Ponte: "🌉",
  Bar: "🍺",
  Tribunale: "⚖️",
  "Ufficio Immigrazione": "🛂",
  "Ufficio Edile": "🏗️",
  Mercato: "🏪",
  Negozio: "🛍️",
  "Mensa Pubblica": "🍲",
  Acquedotto: "💧",
  Porto: "⚓",
  Serra: "🌱",
  "Luogo di Culto del Sole": "☀️",
  "Luogo di Culto delle Ombre": "🌑",
  Carcere: "🔒",
  "Campo di Lavoro": "⛏️",
  "Campo di Sterminio": "☠️",
  Caserma: "🛡️",
  Centrale: "🚓",
  Miniera: "⛏️",
  Fucina: "🔥",
  Emporio: "🧺",
  Bosco: "🌲",
  Falegnameria: "🪚",
  Conceria: "🧴",
  Forno: "🍞",
  Cereria: "🕯️",
  Sartoria: "👕",
  Birrificio: "🍺",
  Taverna: "🍲",
  Spezieria: "⚗️",
  Armeria: "🏹",
  Forgia: "🔨",
  Chiesa: "⛪",
  Lazzaretto: "🏥",
  Scriptorium: "📜",
  Scuola: "📚",
  "Laboratorio Magico": "🧙",
  "Cripta Necromantica": "☠️"
};

function categoryForBuilding(name: string): PhaserMapBuilding["category"] {
  if (["Dormitorio", "Capanna", "Baracca"].includes(name)) return "residence";
  if (
    [
      "Serra",
      "Acquedotto",
      "Miniera",
      "Fucina",
      "Forgia",
      "Falegnameria",
      "Conceria",
      "Forno",
      "Cereria",
      "Sartoria",
      "Birrificio",
      "Spezieria",
      "Armeria",
      "Laboratorio Magico",
      "Cripta Necromantica",
      "Giacimento"
    ].includes(name)
  ) {
    return "industry";
  }
  if (["Emporio", "Mercato", "Negozio", "Taverna", "Lazzaretto", "Scriptorium", "Scuola"].includes(name)) {
    return "service";
  }
  if (["Carcere", "Campo di Lavoro", "Campo di Sterminio", "Caserma", "Centrale"].includes(name)) {
    return "security";
  }
  if (name.includes("Culto") || name === "Chiesa") return "religion";
  if (["Porto", "Castello", "Bosco"].includes(name)) return "special";
  return "service";
}

function artKeyForBuilding(name: string): PhaserMapBuilding["artKey"] {
  if (name === "Castello") return "castle";
  if (name === "Dormitorio") return "dormitory";
  if (name === "Serra") return "greenhouse";
  if (name === "Capanna") return "frontier-hut";
  return undefined;
}

export function buildPhaserBuildings(
  state: MappaRuntimeState,
  cols: number,
  rows?: number,
  edificiGlobali: readonly Pick<Edificio, "id" | "stato" | "progressoCostruzione">[] = []
): PhaserMapBuilding[] {
  const buildings: PhaserMapBuilding[] = [];
  const byId = new Map(edificiGlobali.map((e) => [e.id, e]));
  const effectiveRows =
    rows ?? Math.max(1, ...Object.keys(state.edificiInMappa).map((key) => Math.floor(Number(key) / cols) + 3));
  for (const [indexText, building] of Object.entries(state.edificiInMappa)) {
    if (building.nome === "Strada" || building.footprintRef != null) continue;
    const anchor = Number(indexText);
    const footprint = building.footprint ?? { w: 1, h: 1 };
    const col = anchor % cols;
    if (col + footprint.w > cols) continue;
    const globaleId = building.edificioGlobaleId ?? building.id;
    const globale = byId.get(globaleId);
    const underConstruction = globale?.stato === "In costruzione";
    buildings.push({
      anchor,
      widthCells: footprint.w,
      heightCells: footprint.h,
      name: building.nome,
      emoji: underConstruction ? "🏗️" : building.emoji || BUILDING_EMOJI[building.nome] || "🏢",
      category: categoryForBuilding(building.nome),
      artKey: underConstruction ? undefined : artKeyForBuilding(building.nome),
      geometry: deriveBuildingGeometry(anchor, footprint.w, footprint.h, cols, effectiveRows, {
        ingressoPerimetrale: edificioHaIngressoPerimetrale(building.nome)
      }),
      underConstruction,
      progressoCostruzione: underConstruction ? (globale?.progressoCostruzione ?? 0) : undefined
    });
  }
  return buildings.sort((a, b) => {
    const bottomA = Math.floor(a.anchor / cols) + a.heightCells;
    const bottomB = Math.floor(b.anchor / cols) + b.heightCells;
    return bottomA - bottomB || a.anchor - b.anchor;
  });
}

export function buildPhaserMapSnapshot(
  state: MappaRuntimeState,
  cols: number,
  rows: number,
  cellSize: number,
  revision: number,
  characters: readonly PhaserMapCharacter[] = [],
  edificiGlobali: readonly Pick<Edificio, "id" | "stato" | "progressoCostruzione">[] = []
): PhaserMapSnapshot {
  const stradaAssetAt = buildStradaAssetLookup(cols, rows, state.terrenoInMappa, state.edificiInMappa);
  const erbaAssetAt = buildErbaAssetLookup(
    cols,
    rows,
    state.terrenoInMappa,
    state.edificiInMappa,
    stradaAssetAt
  );
  const { erbaSpiaggiaAssetAt } = buildCoastalAssetLookups(
    cols,
    rows,
    state.terrenoInMappa,
    state.edificiInMappa
  );

  const tiles: PhaserMapTile[] = [];
  for (let index = 0; index < cols * rows; index++) {
    const terreno = state.terrenoInMappa[index] ?? "erba";
    const edificio = state.edificiInMappa[index];
    const strada = edificio?.nome === "Strada";

    if (isTerrenoAcqua(index, state.terrenoInMappa, cols, rows)) {
      const coord = getWaterSheetCoord(0);
      tiles.push({ index, frameX: coord.x, frameY: coord.y, animation: "water" });
      continue;
    }

    if (terreno === "sabbia") {
      const coord = getSpiaggiaSheetCoordForWaterMask(
        sandWaterEdgeMaskAt(index, cols, rows, state.terrenoInMappa)
      );
      tiles.push({ index, frameX: coord.x, frameY: coord.y });
      continue;
    }

    if (strada) {
      const coord = getStradaSheetCoord(stradaAssetAt(index));
      tiles.push({ index, frameX: coord.x, frameY: coord.y });
      continue;
    }

    const coastal = erbaSpiaggiaAssetAt(index);
    const coord = coastal
      ? getErbaSpiaggiaSheetCoord(coastal)
      : getErbaSheetCoord(erbaAssetAt(index) ?? "centro");
    const decor = !edificio && !coastal ? erbaExtraDecorCasuale(index, cols) : null;
    const decorCoord = decor ? getErbaDecorSheetCoord(decor) : null;
    tiles.push({
      index,
      frameX: coord.x,
      frameY: coord.y,
      overlayFrameX: decorCoord?.x,
      overlayFrameY: decorCoord?.y
    });
  }

  return {
    cols,
    rows,
    cellSize,
    tiles,
    buildings: buildPhaserBuildings(state, cols, rows, edificiGlobali),
    characters,
    revision
  };
}
