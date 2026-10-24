import type { Abitante } from "../types";
import type { ReligioneCustom } from "./fedeleCulto";
import type { DogmaReligioso } from "./dogmiReligiosi";
import { normalizzaDogmiReligiosi } from "./dogmiReligiosi";
import type { DottrinaNaturalista } from "./ecosistemaBosco";

/** I modelli sono culti organizzati, non ateismo o posizioni agnostiche. */
export function religioniModelloEresia(religioni: readonly ReligioneCustom[]): string[] {
  return ["Culto del Sole", "Culto delle Ombre", ...religioni.map(r => r.nome)];
}

export function dogmiDalModello(religione: string, custom: readonly ReligioneCustom[]): {
  dogmi: DogmaReligioso[];
  dottrinaNaturalista: DottrinaNaturalista;
  descrizione: string;
} {
  const modello = custom.find(r => r.nome === religione);
  return {
    dogmi: normalizzaDogmiReligiosi(modello?.dogmi ?? []),
    dottrinaNaturalista: {
      forestaSacra: modello?.dottrinaNaturalista?.forestaSacra === true,
      tutelaFauna: modello?.dottrinaNaturalista?.tutelaFauna === true,
      tutelaVegetazione: modello?.dottrinaNaturalista?.tutelaVegetazione === true
    },
    descrizione: modello
      ? "Riforma derivata da " + modello.nome + ". " + modello.descrizione
      : "Riforma derivata da " + religione + "."
  };
}

/** Stabilisce quali abitanti possono aderire inizialmente a uno scisma.
 *  Niente conversioni obbligate, niente reclutamento di chierici già nominati.
 *  L'esito è deterministico e non viene ripetuto ai successivi caricamenti.
 */
export function convertiFedeliInEresia(
  abitanti: readonly Abitante[],
  origineReligione: string | null,
  religioneNuova: string,
  seme: string
): { abitanti: Abitante[]; convertitiIds: number[] } {
  if (!origineReligione || !religioneNuova || religioneNuova === origineReligione) {
    return { abitanti: [...abitanti], convertitiIds: [] };
  }
  const candidati = abitanti.filter(a =>
    a.religione === origineReligione &&
    a.salute > 0 &&
    a.razza !== "Golem" &&
    a.lavoro !== "Capo Religioso" &&
    a.lavoro !== "Sacerdote" &&
    a.lavoro !== "Re" &&
    a.id !== 1
  );
  // Circa il 15% del culto originario, al massimo il 25% in una fondazione.
  const max = candidati.length > 0 ? Math.max(1, Math.floor(candidati.length * 0.25)) : 0;
  if (max === 0) return { abitanti: [...abitanti], convertitiIds: [] };
  const hash = (id: number) => {
    let h = (id * 2654435761) >>> 0;
    for (let i = 0; i < seme.length; i++) {
      h = (Math.imul(h ^ seme.charCodeAt(i), 16777619)) >>> 0;
    }
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const scelti = candidati
    .filter(a => hash(a.id) < 0.15)
    .sort((a, b) => hash(a.id) - hash(b.id) || a.id - b.id)
    .slice(0, max);
  const ids = new Set(scelti.map(a => a.id));
  return {
    abitanti: ids.size
      ? abitanti.map(a => ids.has(a.id) ? { ...a, religione: religioneNuova } : a)
      : [...abitanti],
    convertitiIds: [...ids]
  };
}
