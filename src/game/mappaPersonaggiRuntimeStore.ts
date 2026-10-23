/**
 * Stato runtime personaggi mappa (commute, celle, arrivi).
 * Sopravvive al remount di `/mappa` quando si apre Castello o altre schede.
 */

import type { RapinaTarget } from "./rapina";
import type { TurnoForestale } from "./turniForestali";

export type CommutePurposeMappa =
  | "work"
  | "bar"
  | "home"
  | "mensa"
  | "culto"
  | "negozio"
  | "rapina"
  | "udienza_banditi"
  | "cerca_lavoro"
  | "vende_emporio"
  | "re_uscita";

export type CommuteInfoMappa = {
  path: number[];
  token: number;
  purpose: CommutePurposeMappa;
  barEdificioId?: number;
  mensaEdificioId?: number;
  cultoEdificioId?: number;
  negozioEdificioId?: number;
  lavoroCercaEdificioId?: number;
  /** Destinazione del commute «work» (sede o cantiere). */
  lavoroEdificioId?: number;
  emporioVenditaEdificioId?: number;
  rapinaTarget?: RapinaTarget;
  udienzaCastelloEdificioId?: number;
};

export type MappaPersonaggiRuntimeState = {
  ultimaCellaByAbitanteId: Record<number, number>;
  commuteByAbitanteId: Record<number, CommuteInfoMappa>;
  lavoroArrivatiIds: number[];
  /** Edificio in cui risulta arrivato al lavoro (sede o cantiere). */
  lavoroArrivoEdificioByAbitanteId: Record<number, number>;
  /** Turni forestali pendenti conservati fra aperture e chiusure della mappa. */
  turniForestaliByAbitanteId: Record<number, TurnoForestale>;
  barArrivatiByEdificio: Record<number, number[]>;
  /** Visitatori Emporio (venditori / cercatori non ancora assunti). */
  emporioArrivatiByEdificio: Record<number, number[]>;
  cultoArrivatiByEdificio: Record<number, number[]>;
  dormonoACasaIds: number[];
  esitoRapinaByAbitanteId: Record<number, string>;
  prevBuioNotte: boolean | undefined;
  orologioPrevTick: number | undefined;
};

function emptyState(): MappaPersonaggiRuntimeState {
  return {
    ultimaCellaByAbitanteId: {},
    commuteByAbitanteId: {},
    lavoroArrivatiIds: [],
    lavoroArrivoEdificioByAbitanteId: {},
    turniForestaliByAbitanteId: {},
    barArrivatiByEdificio: {},
    emporioArrivatiByEdificio: {},
    cultoArrivatiByEdificio: {},
    dormonoACasaIds: [],
    esitoRapinaByAbitanteId: {},
    prevBuioNotte: undefined,
    orologioPrevTick: undefined
  };
}

let runtime: MappaPersonaggiRuntimeState = emptyState();

export function getMappaPersonaggiRuntime(): MappaPersonaggiRuntimeState {
  return runtime;
}

export function setMappaPersonaggiRuntime(next: MappaPersonaggiRuntimeState): void {
  runtime = next;
}

export function patchMappaPersonaggiRuntime(
  partial: Partial<MappaPersonaggiRuntimeState>
): void {
  runtime = { ...runtime, ...partial };
}

export function setUltimaCellaAbitanteRuntime(abitanteId: number, cell: number): void {
  runtime = {
    ...runtime,
    ultimaCellaByAbitanteId: {
      ...runtime.ultimaCellaByAbitanteId,
      [abitanteId]: cell
    }
  };
}

/** Taglia il path così riparte dalla cella corrente (commute a metà dopo remount). */
export function trimCommutePathFromCell(path: number[], cell: number): number[] {
  if (path.length < 2) return path;
  const i = path.lastIndexOf(cell);
  if (i < 0) return path;
  if (i >= path.length - 1) return path.slice(-2);
  return path.slice(i);
}

export function hydrateCommutesFromRuntime(
  commute: Record<number, CommuteInfoMappa>,
  ultimaCella: Record<number, number>
): Record<number, CommuteInfoMappa> {
  const out: Record<number, CommuteInfoMappa> = {};
  for (const [idStr, info] of Object.entries(commute)) {
    const id = Number(idStr);
    const cell = ultimaCella[id];
    if (cell == null) {
      out[id] = info;
      continue;
    }
    const path = trimCommutePathFromCell(info.path, cell);
    if (path.length < 2) continue;
    out[id] = { ...info, path, token: info.token };
  }
  return out;
}

export function resetMappaPersonaggiRuntime(seed?: {
  lavoroArrivatiIds?: readonly number[];
  lavoroArrivoEdificioByAbitanteId?: Readonly<Record<number, number>>;
}): void {
  runtime = emptyState();
  if (seed?.lavoroArrivatiIds && seed.lavoroArrivatiIds.length > 0) {
    const ids = [...new Set(seed.lavoroArrivatiIds.map((id) => Math.trunc(id)))];
    const arrivo: Record<number, number> = {};
    if (seed.lavoroArrivoEdificioByAbitanteId) {
      for (const id of ids) {
        const edId = seed.lavoroArrivoEdificioByAbitanteId[id];
        if (edId != null) arrivo[id] = Math.trunc(edId);
      }
    }
    runtime = {
      ...runtime,
      lavoroArrivatiIds: ids,
      lavoroArrivoEdificioByAbitanteId: arrivo
    };
  }
}
