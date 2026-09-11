/** Costanti e helper per l’edificio Chiesa. */

import type { Abitante, Edificio } from "../types";
import {
  emojiReligione,
  puòEssereReligioneTempio,
  RELIGIONE_TEMPIO_DEFAULT,
  type ReligioneCustom
} from "./fedeleCulto";

export const NOME_CHIESA = "Chiesa";

/**
 * Religioni non ammesse come Religione del Tempio (filosofiche / senza culto templare).
 * Alias storici — usare RELIGIONI_ESCLUSE_TEMPIO in fedeleCulto.
 */
export const RELIGIONE_TEMPIO_CHIESA_DEFAULT = RELIGIONE_TEMPIO_DEFAULT;

/** @deprecated Usare religioneTempioDi(edificio). */
export const RELIGIONE_FEDELI_CHIESA = RELIGIONE_TEMPIO_DEFAULT;
/** @deprecated Usare religioneTempioDi(edificio). */
export const ETICHETTA_RELIGIONE_TEMPIO_CHIESA = RELIGIONE_TEMPIO_DEFAULT;
export const EMOJI_CHIESA = "⛪";

export function èChiesa(edificio: Pick<Edificio, "nome">): boolean {
  return edificio.nome === NOME_CHIESA;
}

export function trovaChiesaOperativa(edifici: Edificio[]): Edificio | undefined {
  return edifici.find((e) => èChiesa(e) && e.stato === "Operativo");
}

/** Religione del tempio sull’edificio Chiesa (mai Ateo/Deista/Agnostico). */
export function religioneTempioDi(
  edificio: Pick<Edificio, "religioneTempio"> | null | undefined,
  custom: readonly ReligioneCustom[] = []
): string {
  const raw = (edificio?.religioneTempio ?? "").trim();
  if (raw && puòEssereReligioneTempio(raw, custom)) return raw;
  return RELIGIONE_TEMPIO_DEFAULT;
}

export function conReligioneTempioChiesa(
  edificio: Edificio,
  religione: string,
  custom: readonly ReligioneCustom[] = []
): Edificio {
  if (!èChiesa(edificio)) return edificio;
  const nome = religione.trim();
  if (!puòEssereReligioneTempio(nome, custom)) return edificio;
  if (edificio.religioneTempio === nome) return edificio;
  return { ...edificio, religioneTempio: nome };
}

/** Credenti registrati: abitanti con la stessa religione del tempio. */
export function fedeliRegistratiChiesa(
  abitanti: readonly Abitante[],
  religioneTempio: string
): Abitante[] {
  return abitanti
    .filter((a) => a.razza !== "Golem" && a.religione === religioneTempio)
    .sort((a, b) => a.nome.localeCompare(b.nome, "it"));
}

/** Lavoratori assegnati a questa Chiesa (di norma Sacerdote). */
export function sacerdotiAssegnatiChiesa(
  edificio: Edificio,
  abitanti: readonly Abitante[]
): Abitante[] {
  const ids = new Set(edificio.abitantiAssegnati ?? []);
  return abitanti
    .filter((a) => ids.has(a.id))
    .sort((a, b) => a.nome.localeCompare(b.nome, "it"));
}

export function emojiReligioneAbitante(
  religione: Abitante["religione"] | undefined,
  custom: readonly ReligioneCustom[] = []
): string {
  return emojiReligione(religione ?? "", custom);
}

/** Seed: Chiesa iniziale con religione del tempio di default. */
export function assicuraReligioneTempioChiese(
  edifici: Edificio[],
  custom: readonly ReligioneCustom[] = []
): Edificio[] {
  let changed = false;
  const next = edifici.map((e) => {
    if (!èChiesa(e)) return e;
    const attuale = (e.religioneTempio ?? "").trim();
    if (attuale && puòEssereReligioneTempio(attuale, custom)) return e;
    changed = true;
    return { ...e, religioneTempio: RELIGIONE_TEMPIO_DEFAULT };
  });
  return changed ? next : edifici;
}
