import type { Abitante, Edificio, Risorsa } from "../types";
import { isGiocatore } from "./schiavituCommercio";
import { getCastaAbitante } from "./casta";
import { aggiungiOggettoInventarioAbitante } from "./inventario";
import { getGiornoGiocoSnapshot } from "./orologioGiocoSession";

export type MinieraBottinoDef = {
  itemId: string;
  emoji: string;
  nome: string;
};

export const BOTTINO_MINIERA: readonly MinieraBottinoDef[] = [
  { itemId: "pietre", emoji: "🪨", nome: "Pietre" },
  { itemId: "metallo-grezzo", emoji: "⛏️", nome: "Metallo grezzo" },
  { itemId: "carbone", emoji: "🟫", nome: "Carbone" },
  { itemId: "minerali-rari", emoji: "💎", nome: "Minerali rari" },
  { itemId: "pietre", emoji: "🪨", nome: "Pietre" },
  { itemId: "metallo-grezzo", emoji: "⛏️", nome: "Metallo grezzo" },
  { itemId: "resina", emoji: "🌲", nome: "Resina" },
  { itemId: "ossa", emoji: "🦴", nome: "Ossa" },
  { itemId: "metallo-grezzo", emoji: "⛏️", nome: "Metallo grezzo" },
  { itemId: "pietre", emoji: "🪨", nome: "Pietre" }
] as const;

export const NOME_MINIERA = "Miniera";
export const LAVORO_MINATORE = "Minatore";
export const CAPACITA_MINIERA = 20;

/** Depositi magazzino regno per minatore/giorno (alimentano Zecca e costruzioni). */
export const METALLI_DEPOSITO_PER_MINATORE_GIORNO = 1;
export const MATERIALE_EDILE_DEPOSITO_PER_MINATORE_GIORNO = 1;

export type VoceRaccoltoMiniera = {
  itemId: string;
  emoji: string;
  nome: string;
  quantità: number;
};

export function èMiniera(edificio: Pick<Edificio, "nome">): boolean {
  return edificio.nome === NOME_MINIERA;
}

export function capacitaEffettivaMiniera(edificio: Edificio): number {
  return Math.max(edificio.capacità ?? 0, CAPACITA_MINIERA);
}

export function normalizzaEdificioMiniera(edificio: Edificio): Edificio {
  if (!èMiniera(edificio)) return edificio;
  const cap = capacitaEffettivaMiniera(edificio);
  const ids = [...new Set(edificio.abitantiAssegnati ?? [])];
  return {
    ...edificio,
    capacità: cap,
    abitantiAssegnati: ids,
    occupazione: ids.length,
    stato: "Operativo"
  };
}

export function normalizzaEdificiMiniera(edifici: Edificio[]): Edificio[] {
  return edifici.map(normalizzaEdificioMiniera);
}

export function trovaMinieraOperativa(edifici: Edificio[]): Edificio | undefined {
  return edifici.find((e) => èMiniera(e) && e.stato === "Operativo");
}

export function minieraHaPostoLibero(edifici: Edificio[]): Edificio | undefined {
  return edifici.find((e) => {
    if (!èMiniera(e) || e.stato !== "Operativo") return false;
    return (e.abitantiAssegnati?.length ?? 0) < capacitaEffettivaMiniera(e);
  });
}

export function disoccupatoIdoneoPerMiniera(abitante: Abitante): boolean {
  if (isGiocatore(abitante)) return false;
  if (getCastaAbitante(abitante) === "Nobile") return false;
  if (abitante.lavoro !== "Disoccupato") return false;
  if (abitante.razza === "Golem") return false;
  return true;
}

export function bottinoMinieraPerAbitante(abitanteId: number, giorno: number, slot = 0): MinieraBottinoDef {
  const index = Math.abs(abitanteId * 41 + giorno * 19 + slot * 73) % BOTTINO_MINIERA.length;
  return BOTTINO_MINIERA[index]!;
}

/** 50% deterministico: due oggetti invece di uno. */
export function trovaDueOggettiMiniera(abitanteId: number, giorno: number): boolean {
  return Math.abs(abitanteId * 17 + giorno * 31) % 2 === 0;
}

export function raccoltoMinieraDelGiorno(abitanteId: number, giorno: number): VoceRaccoltoMiniera[] {
  const drops = [bottinoMinieraPerAbitante(abitanteId, giorno, 0)];
  if (trovaDueOggettiMiniera(abitanteId, giorno)) {
    drops.push(bottinoMinieraPerAbitante(abitanteId, giorno, 1));
  }
  const map = new Map<string, VoceRaccoltoMiniera>();
  for (const d of drops) {
    const prev = map.get(d.itemId);
    if (prev) prev.quantità += 1;
    else map.set(d.itemId, { itemId: d.itemId, emoji: d.emoji, nome: d.nome, quantità: 1 });
  }
  return [...map.values()];
}

export function etichettaRaccoltoMiniera(voci: VoceRaccoltoMiniera[]): string {
  return voci.map((v) => `${v.emoji} ${v.nome}${v.quantità > 1 ? ` ×${v.quantità}` : ""}`).join(", ");
}

function applicaBottinoInizialeMinatore(
  abitante: Abitante
): { abitante: Abitante; vociNuove: VoceRaccoltoMiniera[] | null } {
  const giorno = getGiornoGiocoSnapshot();
  if (abitante.ultimoRaccoltoMiniera?.giorno === giorno) {
    return { abitante: { ...abitante, lavoro: LAVORO_MINATORE }, vociNuove: null };
  }
  const voci = raccoltoMinieraDelGiorno(abitante.id, giorno);
  let next: Abitante = { ...abitante, lavoro: LAVORO_MINATORE };
  for (const v of voci) {
    next = aggiungiOggettoInventarioAbitante(next, v.itemId, v.quantità);
  }
  return {
    abitante: { ...next, ultimoRaccoltoMiniera: { giorno, voci } },
    vociNuove: voci
  };
}

export type BottinoMinieraRegistrato = {
  abitanteId: number;
  abitanteNome: string;
  minieraId: number;
  voci: VoceRaccoltoMiniera[];
};

function depositaRisorseMiniera(
  risorse: Risorsa[],
  minatori: number,
  giorni: number
): Risorsa[] {
  if (minatori <= 0 || giorni <= 0) return risorse;
  const metalli = minatori * giorni * METALLI_DEPOSITO_PER_MINATORE_GIORNO;
  const materiale = minatori * giorni * MATERIALE_EDILE_DEPOSITO_PER_MINATORE_GIORNO;
  return risorse.map((r) => {
    if (r.nome === "Metalli") return { ...r, quantità: r.quantità + metalli };
    if (r.nome === "Materiale Edile") return { ...r, quantità: r.quantità + materiale };
    return r;
  });
}

export function assumiDisoccupatoNellaMiniera(
  abitanti: Abitante[],
  edifici: Edificio[],
  abitanteId: number
): {
  abitanti: Abitante[];
  edifici: Edificio[];
  ok: boolean;
  minieraId?: number;
  bottino?: BottinoMinieraRegistrato;
} {
  const ab = abitanti.find((a) => a.id === abitanteId);
  const miniera = minieraHaPostoLibero(edifici) ?? trovaMinieraOperativa(edifici);
  if (!ab || !miniera || !disoccupatoIdoneoPerMiniera(ab)) {
    return { abitanti, edifici, ok: false };
  }
  if ((miniera.abitantiAssegnati ?? []).includes(abitanteId)) {
    const applied = applicaBottinoInizialeMinatore(ab);
    const abitantiNext = abitanti.map((a) => (a.id === abitanteId ? applied.abitante : a));
    return {
      abitanti: abitantiNext,
      edifici: normalizzaEdificiMiniera(edifici),
      ok: true,
      minieraId: miniera.id,
      bottino: applied.vociNuove
        ? {
            abitanteId,
            abitanteNome: applied.abitante.nome,
            minieraId: miniera.id,
            voci: applied.vociNuove
          }
        : undefined
    };
  }
  const cap = capacitaEffettivaMiniera(miniera);
  if ((miniera.abitantiAssegnati ?? []).length >= cap) {
    return { abitanti, edifici, ok: false };
  }
  const edificiNext = edifici.map((e) => {
    if (e.id !== miniera.id) return èMiniera(e) ? normalizzaEdificioMiniera(e) : e;
    const ids = [...(e.abitantiAssegnati ?? []), abitanteId];
    return normalizzaEdificioMiniera({ ...e, abitantiAssegnati: ids, occupazione: ids.length });
  });
  const applied = applicaBottinoInizialeMinatore(ab);
  const abitantiNext = abitanti.map((a) => (a.id === abitanteId ? applied.abitante : a));
  return {
    abitanti: abitantiNext,
    edifici: edificiNext,
    ok: true,
    minieraId: miniera.id,
    bottino: applied.vociNuove
      ? {
          abitanteId,
          abitanteNome: applied.abitante.nome,
          minieraId: miniera.id,
          voci: applied.vociNuove
        }
      : undefined
  };
}

export function applicaRaccoltaMinieraGiornaliera(
  abitanti: Abitante[],
  edifici: Edificio[],
  risorse: Risorsa[],
  giornoCorrente: number,
  giorni: number
): {
  abitanti: Abitante[];
  risorse: Risorsa[];
  messaggi: string[];
  bottini: BottinoMinieraRegistrato[];
} {
  const miniera = trovaMinieraOperativa(edifici);
  if (!miniera || giorni <= 0) {
    return { abitanti, risorse, messaggi: [], bottini: [] };
  }
  const minatori = new Set(miniera.abitantiAssegnati ?? []);
  if (minatori.size === 0) {
    return { abitanti, risorse, messaggi: [], bottini: [] };
  }

  const messaggi: string[] = [];
  const bottini: BottinoMinieraRegistrato[] = [];
  let minatoriAttivi = 0;
  const abitantiNext = abitanti.map((a) => {
    if (!minatori.has(a.id) || a.lavoro !== LAVORO_MINATORE) return a;
    minatoriAttivi += 1;
    let next = a;
    for (let g = 0; g < giorni; g++) {
      const giorno = giornoCorrente - giorni + g + 1;
      if (next.ultimoRaccoltoMiniera?.giorno === giorno) continue;
      const voci = raccoltoMinieraDelGiorno(a.id, giorno);
      for (const v of voci) {
        next = aggiungiOggettoInventarioAbitante(next, v.itemId, v.quantità);
      }
      next = { ...next, ultimoRaccoltoMiniera: { giorno, voci } };
      bottini.push({
        abitanteId: a.id,
        abitanteNome: a.nome,
        minieraId: miniera.id,
        voci
      });
      if (g === giorni - 1) {
        messaggi.push(`${a.nome} ha estratto ${etichettaRaccoltoMiniera(voci)} in Miniera.`);
      }
    }
    return next;
  });

  const risorseNext = depositaRisorseMiniera(risorse, minatoriAttivi, giorni);
  return { abitanti: abitantiNext, risorse: risorseNext, messaggi, bottini };
}
