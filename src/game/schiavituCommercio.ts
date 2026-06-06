import type { Abitante, Edificio, Risorsa } from "../types";
import { condannaAMortePuro } from "./tribunale";
import { getCastaAbitante, isCastaCoercibile } from "./casta";

/** Prezzo di riferimento per compravendita schiavi (monete). */
export const PREZZO_SCHIAVO_DEFAULT = 500;

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

function getCreditiColonia(risorse: Risorsa[]): number {
  return risorse.find((r) => r.nome === "Crediti")?.quantità ?? 0;
}

function setCreditiColonia(risorse: Risorsa[], quantità: number): Risorsa[] {
  return risorse.map((r) => (r.nome === "Crediti" ? { ...r, quantità: Math.max(0, quantità) } : r));
}

function addebita(
  abitanti: Abitante[],
  risorse: Risorsa[],
  pagatoreId: number | null,
  importo: number
): { ok: boolean; abitanti: Abitante[]; risorse: Risorsa[] } {
  if (importo <= 0) return { ok: true, abitanti, risorse };
  if (pagatoreId === null) {
    const saldo = getCreditiColonia(risorse);
    if (saldo < importo) return { ok: false, abitanti, risorse };
    return { ok: true, abitanti, risorse: setCreditiColonia(risorse, saldo - importo) };
  }
  const pagatore = abitanti.find((a) => a.id === pagatoreId);
  if (!pagatore || pagatore.crediti < importo) return { ok: false, abitanti, risorse };
  return {
    ok: true,
    abitanti: abitanti.map((a) => (a.id === pagatoreId ? { ...a, crediti: a.crediti - importo } : a)),
    risorse
  };
}

function accredita(
  abitanti: Abitante[],
  risorse: Risorsa[],
  beneficiarioId: number | null,
  importo: number
): { abitanti: Abitante[]; risorse: Risorsa[] } {
  if (importo <= 0) return { abitanti, risorse };
  if (beneficiarioId === null) {
    const saldo = getCreditiColonia(risorse);
    return { abitanti, risorse: setCreditiColonia(risorse, saldo + importo) };
  }
  return {
    abitanti: abitanti.map((a) => (a.id === beneficiarioId ? { ...a, crediti: a.crediti + importo } : a)),
    risorse
  };
}

export type TrasferisciProprietaSchiavoInput = {
  abitanti: Abitante[];
  risorse: Risorsa[];
  schiavoId: number;
  /** `null` = colonia/giocatore. */
  nuovoProprietarioId: number | null;
  prezzo: number;
};

/** Compra/vende/trasferisce la proprietà di uno schiavo con pagamento. */
export function trasferisciProprietaSchiavoPuro(
  input: TrasferisciProprietaSchiavoInput
): { ok: boolean; abitanti: Abitante[]; risorse: Risorsa[] } {
  const { schiavoId, nuovoProprietarioId, prezzo } = input;
  let { abitanti, risorse } = input;

  const schiavo = abitanti.find((a) => a.id === schiavoId);
  if (!schiavo || !isSchiavoCommerciabile(schiavo)) return { ok: false, abitanti, risorse };

  const venditoreId = getProprietarioSchiavoId(schiavo);
  if (venditoreId === undefined) return { ok: false, abitanti, risorse };
  if (venditoreId === nuovoProprietarioId) return { ok: false, abitanti, risorse };

  if (nuovoProprietarioId != null && !abitanti.some((a) => a.id === nuovoProprietarioId)) {
    return { ok: false, abitanti, risorse };
  }

  const pagamento = addebita(abitanti, risorse, nuovoProprietarioId, prezzo);
  if (!pagamento.ok) return { ok: false, abitanti, risorse };
  abitanti = pagamento.abitanti;
  risorse = pagamento.risorse;

  const incasso = accredita(abitanti, risorse, venditoreId, prezzo);
  abitanti = incasso.abitanti;
  risorse = incasso.risorse;

  abitanti = abitanti.map((a) =>
    a.id === schiavoId ? applicaProprietaSchiavo(a, nuovoProprietarioId) : a
  );

  return { ok: true, abitanti, risorse };
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
    return { ...a, crediti: a.crediti + bonus };
  });

  return { abitanti: aggiornati, redditoEsclusoDaColonia };
}

export function puoEssereAssegnatoForzatamente(abitante: Abitante): boolean {
  return isCastaCoercibile(getCastaAbitante(abitante));
}
