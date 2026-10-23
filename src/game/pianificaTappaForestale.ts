import type { Edificio } from "../types";
import {
  pianificaCommuteVersoEdificioGlobaleDaCella,
  type EdificioInCellaLike
} from "./commutePathsMappa";
import {
  destinazioneTurnoForestale,
  SEDE_PER_PROFESSIONE,
  type TurnoForestale,
  type DestinazioneForestale
} from "./turniForestali";

/**
 * Ponte fra la macchina a stati forestale e i percorsi reali della mappa.
 * La funzione NON avanza il turno: l'arrivo deve essere confermato dal
 * callback di movimento, mai dalla semplice creazione del percorso.
 * Nessun requisito di vicinanza della sede al Bosco.
 */
export function pianificaTappaTurnoForestale(input: {
  turno: TurnoForestale;
  cellaCorrente: number;
  casaEdificioId: number | null;
  edifici: readonly Edificio[];
  edificiInMappa: Record<number, EdificioInCellaLike>;
  cols: number;
  rows: number;
  isWalkable: (cella: number) => boolean;
}): { destinazione: DestinazioneForestale; edificioId: number; path: number[] } | null {
  const {
    turno, cellaCorrente, casaEdificioId,
    edifici, edificiInMappa, cols, rows, isWalkable
  } = input;
  const destinazione = destinazioneTurnoForestale(turno);
  if (!destinazione) return null;
  let edificioId: number | null = null;
  if (destinazione === "casa") {
    edificioId = casaEdificioId;
  } else if (destinazione === "sede") {
    const sede = edifici.find(e => e.id === turno.sedeId);
    if (!sede || sede.nome !== SEDE_PER_PROFESSIONE[turno.lavoro] ||
        !(sede.abitantiAssegnati ?? []).includes(turno.abitanteId) ||
        sede.stato !== "Operativo") return null;
    edificioId = sede.id;
  } else {
    edificioId = edifici.find(e => e.nome === "Bosco" && e.stato === "Operativo")?.id ?? null;
  }
  if (edificioId == null) return null;
  const percorso = pianificaCommuteVersoEdificioGlobaleDaCella(
    cellaCorrente, edificioId, edificiInMappa, cols, rows, isWalkable
  );
  // Anche un percorso di una cella richiede conferma fisica di arrivo.
  if (!percorso?.length) return null;
  return { destinazione, edificioId, path: percorso };
}
