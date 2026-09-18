/**
 * Decisioni pure per una commute di lavoro bloccata da occupancy.
 * Evita il freeze permanente: un `return` silenzioso ferma Phaser (token invariato)
 * e il tick lavoro non ripianifica le commute `purpose === "work"`.
 */

export type AzioneCommuteBloccataLavoro =
  | { tipo: "usa_path"; path: number[] }
  | { tipo: "completa" }
  | { tipo: "attendi_e_riprova"; path: number[] };

export function normalizzaPathRepathDaCella(
  path: number[],
  from: number,
  cols: number
): number[] | null {
  const idxFrom = path.indexOf(from);
  const path0 = path[0]!;
  const fromAdj =
    from === path0 ||
    from === path0 - 1 ||
    from === path0 + 1 ||
    from === path0 - cols ||
    from === path0 + cols;
  const pathNorm = idxFrom >= 0 ? path.slice(idxFrom) : fromAdj ? [from, ...path] : path;
  return pathNorm.length >= 2 ? pathNorm : pathNorm.length === 1 ? pathNorm : null;
}

/**
 * Sceglie come sbloccare un lavoratore fermo.
 * - Se il repath evita gli altri ed è diverso dalla cella bloccata → usalo.
 * - Se oscillerebbe (passo = blockedCell) o fallisce → prova path «attraverso gli altri».
 * - Se già all’ingresso / path di 1 cella → completa.
 * - Altrimenti completa comunque (teleporto in sede) piuttosto che restare congelato.
 */
export function scegliAzioneCommuteBloccataLavoro(opts: {
  fromCell: number;
  blockedCell: number;
  cols: number;
  pathEvitandoAltri: number[] | null;
  pathAttraversoAltri: number[] | null;
  giaAllIngresso: boolean;
  oscillazioniConsecutive: number;
}): AzioneCommuteBloccataLavoro {
  const {
    fromCell,
    blockedCell,
    cols,
    pathEvitandoAltri,
    pathAttraversoAltri,
    giaAllIngresso,
    oscillazioniConsecutive
  } = opts;

  if (giaAllIngresso) return { tipo: "completa" };

  const prova = (raw: number[] | null): number[] | null => {
    if (raw == null || raw.length < 1) return null;
    if (raw.length === 1) return raw;
    return normalizzaPathRepathDaCella(raw, fromCell, cols);
  };

  const evit = prova(pathEvitandoAltri);
  if (evit != null && evit.length === 1) return { tipo: "completa" };
  if (evit != null && evit.length >= 2) {
    const next = evit[1]!;
    if (next !== blockedCell && oscillazioniConsecutive < 2) {
      return { tipo: "usa_path", path: evit };
    }
    // Stesso collo di bottiglia o già oscillato: non restare in attesa infinita.
  }

  const thru = prova(pathAttraversoAltri);
  if (thru != null && thru.length === 1) return { tipo: "completa" };
  if (thru != null && thru.length >= 2) {
    const next = thru[1]!;
    // Se anche questo ripropone solo il passo bloccato, attendi un retry (nuovo token)
    // una sola volta: al tick successivo l’occupante potrebbe essersi mosso.
    if (next === blockedCell && oscillazioniConsecutive < 1) {
      return { tipo: "attendi_e_riprova", path: thru };
    }
    if (next !== blockedCell || oscillazioniConsecutive >= 1) {
      return { tipo: "usa_path", path: thru };
    }
  }

  return { tipo: "completa" };
}
