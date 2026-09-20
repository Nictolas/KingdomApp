import type { Abitante, Edificio, Risorsa } from "../types";
import { costoCostruzioneMonete, edificioSiPagaInMonete } from "./edificiPrezzi";

export const NOME_UFFICIO_EDILE = "Ufficio Edile";
export const NOME_RISORSA_MATERIALE_EDILE = "Materiale Edile";
export const PROGRESSO_COSTRUZIONE_COMPLETO = 100;

export { costoCostruzioneMonete, edificioSiPagaInMonete };

/** Punti di avanzamento per ogni Edile, ogni ora di gioco, sul cantiere attivo. */
export const PUNTI_PER_EDILE_PER_ORA = 1;

/**
 * Edifici piazzati già operativi (niente cantiere):
 * - Ufficio Edile: serve subito per assumere gli edili
 * - Capanna: alloggi precoci (si paga in monete, niente cantiere)
 */
const NOMI_COSTRUZIONE_ISTANTANEA = new Set<string>([NOME_UFFICIO_EDILE, "Capanna"]);

export function edificioParteInCostruzione(nome: string): boolean {
  return !NOMI_COSTRUZIONE_ISTANTANEA.has(nome);
}

/** Costo in Materiale Edile al piazzamento (Capanna = 0; edifici a monete = 0). */
export function costoMaterialeEdilePerFootprint(nome: string, w: number, h: number): number {
  if (nome === "Capanna") return 0;
  if (edificioSiPagaInMonete(nome)) return 0;
  return Math.max(5, Math.floor(w) * Math.floor(h) * 8);
}

export function quantitaMaterialeEdile(risorse: Risorsa[]): number {
  return risorse.find((r) => r.nome === NOME_RISORSA_MATERIALE_EDILE)?.quantità ?? 0;
}

export function haMaterialeEdileSufficiente(risorse: Risorsa[], costo: number): boolean {
  if (costo <= 0) return true;
  return quantitaMaterialeEdile(risorse) >= costo;
}

export function consumaMaterialeEdile(risorse: Risorsa[], costo: number): Risorsa[] {
  if (costo <= 0) return risorse;
  return risorse.map((r) =>
    r.nome === NOME_RISORSA_MATERIALE_EDILE
      ? { ...r, quantità: Math.max(0, r.quantità - costo) }
      : r
  );
}

/** Conta gli edili assegnati a Uffici Edili operativi. */
export function contaEdiliAssegnati(edifici: Edificio[]): number {
  let n = 0;
  for (const e of edifici) {
    if (e.nome !== NOME_UFFICIO_EDILE || e.stato !== "Operativo") continue;
    n += (e.abitantiAssegnati ?? []).length;
  }
  return n;
}

/** Edifici ancora in cantiere (per UI Ufficio Edile). Primo = destinazione attuale degli edili. */
export function elencoCantieri(edifici: Edificio[]): Edificio[] {
  return edifici
    .filter((e) => e.stato === "In costruzione")
    .sort((a, b) => (a.progressoCostruzione ?? 0) - (b.progressoCostruzione ?? 0) || a.id - b.id);
}

export type AvanzaCostruzioniResult = {
  edifici: Edificio[];
  completati: { id: number; nome: string }[];
};

/**
 * Gli edili dell'Ufficio Edile avanzano il cantiere su cui stanno lavorando
 * (il primo di {@link elencoCantieri}): +{@link PUNTI_PER_EDILE_PER_ORA} per edile, per ogni ora.
 * Se un cantiere si completa a metà delle ore, il resto va al successivo.
 */
export function avanzaCostruzioniEdifici(
  edifici: Edificio[],
  _abitanti?: Abitante[],
  orePassate = 1
): AvanzaCostruzioniResult {
  let oreRimanenti = Math.max(0, Math.floor(orePassate));
  if (oreRimanenti <= 0) return { edifici, completati: [] };

  const nEdili = contaEdiliAssegnati(edifici);
  if (nEdili <= 0) return { edifici, completati: [] };

  const puntiPerOra = nEdili * PUNTI_PER_EDILE_PER_ORA;
  if (puntiPerOra <= 0) return { edifici, completati: [] };

  let next = edifici;
  const completati: { id: number; nome: string }[] = [];
  let changed = false;

  while (oreRimanenti > 0) {
    const attivo = elencoCantieri(next)[0];
    if (!attivo) break;

    const progressoAttuale = attivo.progressoCostruzione ?? 0;
    const manca = PROGRESSO_COSTRUZIONE_COMPLETO - progressoAttuale;
    if (manca <= 0) {
      // Stato inconsistente: forza completamento.
      changed = true;
      completati.push({ id: attivo.id, nome: attivo.nome });
      next = next.map((e) =>
        e.id === attivo.id
          ? { ...e, stato: "Operativo" as const, progressoCostruzione: undefined }
          : e
      );
      continue;
    }

    const orePerFinire = Math.ceil(manca / puntiPerOra);
    const oreUsate = Math.min(oreRimanenti, orePerFinire);
    const punti = oreUsate * puntiPerOra;
    const progresso = Math.min(PROGRESSO_COSTRUZIONE_COMPLETO, progressoAttuale + punti);
    oreRimanenti -= oreUsate;
    changed = true;

    if (progresso >= PROGRESSO_COSTRUZIONE_COMPLETO) {
      completati.push({ id: attivo.id, nome: attivo.nome });
      next = next.map((e) =>
        e.id === attivo.id
          ? { ...e, stato: "Operativo" as const, progressoCostruzione: undefined }
          : e
      );
    } else {
      next = next.map((e) =>
        e.id === attivo.id ? { ...e, progressoCostruzione: progresso } : e
      );
      break;
    }
  }

  return { edifici: changed ? next : edifici, completati };
}
