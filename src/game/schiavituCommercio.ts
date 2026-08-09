import type { Abitante, Edificio } from "../types";
import { condannaAMortePuro } from "./tribunale";
import { getCastaAbitante, isCastaCoercibile } from "./casta";
import {
  aggiungiMoneteInventarioAbitante,
  provaSpendiMoneteInventarioAbitante
} from "./inventario";
import { PREZZO_SCHIAVO_DEFAULT as PREZZO_SCHIAVO_CANONICO } from "./economiaPrezzi";

/** Prezzo di riferimento per compravendita schiavi (monete). */
export const PREZZO_SCHIAVO_DEFAULT = PREZZO_SCHIAVO_CANONICO;

/** ID del giocatore (Re) per azioni sulla colonia. */
export const ID_GIOCATORE = 1;
/** @deprecated Usa ID_GIOCATORE */
export const ID_COMANDANTE = ID_GIOCATORE;
export const LAVORO_GIOCATORE = "Re";
export const ETA_GIOCATORE_INIZIALE = 10;

export function isGiocatore(abitante: Abitante): boolean {
  return abitante.id === ID_GIOCATORE || abitante.lavoro === LAVORO_GIOCATORE;
}

export function isSchiavoCommerciabile(abitante: Abitante): boolean {
  const casta = getCastaAbitante(abitante);
  return casta === "Schiavo" || casta === "Servo della gleba";
}

/** Restituisce l'id del proprietario: `null` = colonia/giocatore, `number` = abitante, `undefined` = non schiavo. */
export function getProprietarioSchiavoId(schiavo: Abitante): number | null | undefined {
  if (!isSchiavoCommerciabile(schiavo)) return undefined;
  if (getCastaAbitante(schiavo) === "Servo della gleba") return null;
  return schiavo.schiavistaId ?? undefined;
}

/** Schiavi nell'inventario di un proprietario (colonia se `proprietarioId === null`). */
export function getSchiaviDiProprietario(abitanti: Abitante[], proprietarioId: number | null): Abitante[] {
  return abitanti.filter((a) => {
    const prop = getProprietarioSchiavoId(a);
    if (prop === undefined) return false;
    return prop === proprietarioId;
  });
}

/** Schiavi nella colonia (Servi della gleba). */
export function getSchiaviColonia(abitanti: Abitante[]): Abitante[] {
  return getSchiaviDiProprietario(abitanti, null);
}

/** Schiavi privati di un abitante. */
export function getSchiaviPrivatiDi(abitanti: Abitante[], schiavistaId: number): Abitante[] {
  return getSchiaviDiProprietario(abitanti, schiavistaId);
}

export function applicaProprietaSchiavo(schiavo: Abitante, nuovoProprietarioId: number | null): Abitante {
  const fazioniBase = (schiavo.fazioni ?? []).filter((f) => f !== "Cittadini");
  const fazioni = fazioniBase.includes("Schiavi") ? fazioniBase : [...fazioniBase, "Schiavi"];
  return {
    ...schiavo,
    ruoloSchiavitu: "schiavo",
    schiavistaId: nuovoProprietarioId ?? undefined,
    casta: nuovoProprietarioId === null ? "Servo della gleba" : "Schiavo",
    fazioni,
    crediti: 0,
    spese: 0
  };
}

function addebita(
  abitanti: Abitante[],
  moneteGiocatore: number,
  pagatoreId: number | null,
  importo: number
): { ok: boolean; abitanti: Abitante[]; moneteGiocatore: number } {
  if (importo <= 0) return { ok: true, abitanti, moneteGiocatore };
  if (pagatoreId === null) {
    if (moneteGiocatore < importo) return { ok: false, abitanti, moneteGiocatore };
    return { ok: true, abitanti, moneteGiocatore: moneteGiocatore - importo };
  }
  const pagatore = abitanti.find((a) => a.id === pagatoreId);
  if (!pagatore) return { ok: false, abitanti, moneteGiocatore };
  const dopoSpesa = provaSpendiMoneteInventarioAbitante(pagatore, importo);
  if (!dopoSpesa) return { ok: false, abitanti, moneteGiocatore };
  return {
    ok: true,
    abitanti: abitanti.map((a) => (a.id === pagatoreId ? dopoSpesa : a)),
    moneteGiocatore
  };
}

function accredita(
  abitanti: Abitante[],
  moneteGiocatore: number,
  beneficiarioId: number | null,
  importo: number
): { abitanti: Abitante[]; moneteGiocatore: number } {
  if (importo <= 0) return { abitanti, moneteGiocatore };
  if (beneficiarioId === null) {
    return { abitanti, moneteGiocatore: moneteGiocatore + importo };
  }
  return {
    abitanti: abitanti.map((a) =>
      a.id === beneficiarioId ? aggiungiMoneteInventarioAbitante(a, importo) : a
    ),
    moneteGiocatore
  };
}

export type TrasferisciProprietaSchiavoInput = {
  abitanti: Abitante[];
  moneteGiocatore: number;
  schiavoId: number;
  /** `null` = colonia/giocatore. */
  nuovoProprietarioId: number | null;
  prezzo: number;
};

/** Compra/vende/trasferisce la proprietà di uno schiavo con pagamento. */
export function trasferisciProprietaSchiavoPuro(
  input: TrasferisciProprietaSchiavoInput
): { ok: boolean; abitanti: Abitante[]; moneteGiocatore: number } {
  const { schiavoId, nuovoProprietarioId, prezzo } = input;
  let { abitanti, moneteGiocatore } = input;

  const schiavo = abitanti.find((a) => a.id === schiavoId);
  if (!schiavo || !isSchiavoCommerciabile(schiavo)) {
    return { ok: false, abitanti, moneteGiocatore };
  }

  const venditoreId = getProprietarioSchiavoId(schiavo);
  if (venditoreId === undefined) return { ok: false, abitanti, moneteGiocatore };
  if (venditoreId === nuovoProprietarioId) return { ok: false, abitanti, moneteGiocatore };

  if (nuovoProprietarioId != null && !abitanti.some((a) => a.id === nuovoProprietarioId)) {
    return { ok: false, abitanti, moneteGiocatore };
  }

  const pagamento = addebita(abitanti, moneteGiocatore, nuovoProprietarioId, prezzo);
  if (!pagamento.ok) return { ok: false, abitanti, moneteGiocatore };
  abitanti = pagamento.abitanti;
  moneteGiocatore = pagamento.moneteGiocatore;

  const incasso = accredita(abitanti, moneteGiocatore, venditoreId, prezzo);
  abitanti = incasso.abitanti;
  moneteGiocatore = incasso.moneteGiocatore;

  abitanti = abitanti.map((a) =>
    a.id === schiavoId ? applicaProprietaSchiavo(a, nuovoProprietarioId) : a
  );

  return { ok: true, abitanti, moneteGiocatore };
}

/** L'uccisione di un proprio schiavo non genera reati. Il Re può uccidere i Servi della gleba senza reato. */
export function isOmicidioSchiavoImmune(uccisore: Abitante, vittima: Abitante): boolean {
  if (!isSchiavoCommerciabile(vittima)) return false;
  const casta = getCastaAbitante(vittima);
  if (casta === "Schiavo" && vittima.schiavistaId === uccisore.id) return true;
  if (casta === "Servo della gleba" && uccisore.id === ID_COMANDANTE) return true;
  return false;
}

export function puoUccidereSchiavo(
  uccisoreId: number | null,
  schiavo: Abitante,
  abitanti: Abitante[]
): boolean {
  if (!isSchiavoCommerciabile(schiavo)) return false;
  const prop = getProprietarioSchiavoId(schiavo);
  if (prop === undefined) return false;
  if (uccisoreId === null) return prop === null;
  return prop === uccisoreId;
}

export type UccidiSchiavoInput = {
  abitanti: Abitante[];
  edifici: Edificio[];
  uccisoreId: number | null;
  schiavoId: number;
};

export function uccidiSchiavoPuro(
  input: UccidiSchiavoInput
): { ok: boolean; abitanti: Abitante[]; edifici: Edificio[] } {
  const schiavo = input.abitanti.find((a) => a.id === input.schiavoId);
  if (!schiavo || !puoUccidereSchiavo(input.uccisoreId, schiavo, input.abitanti)) {
    return { ok: false, abitanti: input.abitanti, edifici: input.edifici };
  }
  const { nuoviAbitanti, nuoviEdifici } = condannaAMortePuro(
    input.abitanti,
    input.edifici,
    input.schiavoId
  );
  return { ok: true, abitanti: nuoviAbitanti, edifici: nuoviEdifici };
}

/** Applica il reddito degli schiavi privati al padrone e restituisce il reddito da escludere dal bilancio colonia. */
export function applicaRedditoSchiaviAlPadroni(
  abitanti: Abitante[]
): { abitanti: Abitante[]; redditoEsclusoDaColonia: number } {
  const redditoPerPadrone = new Map<number, number>();
  let redditoEsclusoDaColonia = 0;

  for (const a of abitanti) {
    if (getCastaAbitante(a) !== "Schiavo" || a.schiavistaId == null) continue;
    if (a.lavoro === "Disoccupato" || a.lavoro === "Pensionato" || a.reddito <= 0) continue;
    redditoPerPadrone.set(a.schiavistaId, (redditoPerPadrone.get(a.schiavistaId) ?? 0) + a.reddito);
    redditoEsclusoDaColonia += a.reddito;
  }

  if (redditoPerPadrone.size === 0) {
    return { abitanti, redditoEsclusoDaColonia: 0 };
  }

  const aggiornati = abitanti.map((a) => {
    const bonus = redditoPerPadrone.get(a.id);
    if (!bonus) return a;
    return aggiungiMoneteInventarioAbitante(a, bonus);
  });

  return { abitanti: aggiornati, redditoEsclusoDaColonia };
}

export function puoEssereAssegnatoForzatamente(abitante: Abitante): boolean {
  return isCastaCoercibile(getCastaAbitante(abitante));
}
