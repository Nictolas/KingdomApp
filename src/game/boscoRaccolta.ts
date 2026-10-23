import type { Abitante, Edificio } from "../types";
import { isGiocatore } from "./schiavituCommercio";
import { getCastaAbitante } from "./casta";
import { aggiungiOggettoInventarioAbitante } from "./inventario";
import { probabilitaSuccessoForestale, normalizzaStatoEcosistemaBosco, rigeneraBoscoDopoPrelievi, type RiserveBosco } from "./ecosistemaBosco";
import { SEDE_PER_PROFESSIONE, type ProfessioneForestale } from "./turniForestali";

export type BoscoBottinoDef = {
  itemId: string;
  emoji: string;
  nome: string;
};

export const BOTTINO_BOSCO: readonly BoscoBottinoDef[] = [
  { itemId: "funghi", emoji: "🍄", nome: "Funghi" },
  { itemId: "bacche", emoji: "🫐", nome: "Bacche" },
  { itemId: "frutta-selvatica", emoji: "🍎", nome: "Frutta selvatica" },
  { itemId: "castagne-e-noci", emoji: "🌰", nome: "Castagne e noci" },
  { itemId: "erbe", emoji: "🌿", nome: "Erbe" },
  { itemId: "erbe-medicinali", emoji: "🌱", nome: "Erbe medicinali" },
  { itemId: "legno", emoji: "🪵", nome: "Legno" },
  { itemId: "resina", emoji: "🌲", nome: "Resina" },
  { itemId: "fiori", emoji: "🌼", nome: "Fiori" },
  { itemId: "miele", emoji: "🍯", nome: "Miele" },
  { itemId: "piccoli-animali", emoji: "🐇", nome: "Piccoli animali" },
  { itemId: "selvaggina", emoji: "🦌", nome: "Selvaggina" },
  { itemId: "piume", emoji: "🪶", nome: "Piume" },
  { itemId: "ossa", emoji: "🦴", nome: "Ossa" },
  { itemId: "corna", emoji: "🦌", nome: "Corna" },
  { itemId: "pelli-e-pellicce", emoji: "🐾", nome: "Pelli e pellicce" },
  { itemId: "uova-selvatiche", emoji: "🥚", nome: "Uova selvatiche" },
  { itemId: "nidi", emoji: "🪺", nome: "Nidi" },
  { itemId: "semi", emoji: "🌾", nome: "Semi" },
  { itemId: "pietre", emoji: "🪨", nome: "Pietre" },
  { itemId: "minerali-rari", emoji: "💎", nome: "Minerali rari" },
  { itemId: "ragnatele", emoji: "🕸️", nome: "Ragnatele" },
  { itemId: "lumache", emoji: "🐌", nome: "Lumache" },
  { itemId: "insetti", emoji: "🐛", nome: "Insetti" },
  { itemId: "foglie-ed-erbe-aromatiche", emoji: "🍃", nome: "Foglie ed erbe aromatiche" },
  { itemId: "rami", emoji: "🌳", nome: "Rami" }
] as const;

export const NOME_BOSCO = "Bosco";
export const LAVORO_RACCOGLITORE = "Raccoglitore";
export const CAPACITA_BOSCO = 20;
/** Solo i mestieri produttivi hanno un bottino; Guardaboschi e Silvicoltori
 *  svolgono attività di protezione/ripristino, non generano oggetti a caso.
 *  Le rese sono ancora provvisorie finché non saranno collegate alle riserve.
 */
export const PRODOTTI_PROFESSIONI_FORESTALI: Readonly<Partial<Record<ProfessioneForestale, readonly string[]>>> = {
  Cacciatore: ["piccoli-animali", "selvaggina"],
  Taglialegna: ["legno", "rami"],
  Erborista: ["erbe", "erbe-medicinali"],
  Apicoltore: ["miele"]
};

function prodottiProfessioneForestale(
  lavoro: string, abitanteId: number, giorno: number, minuti: number
): VoceRaccoltoBosco[] {
  if (lavoro === LAVORO_RACCOGLITORE) return raccoltoBoscoDelGiorno(abitanteId, giorno);
  const oggetti = PRODOTTI_PROFESSIONI_FORESTALI[lavoro as ProfessioneForestale];
  if (!oggetti?.length) return [];
  const id = oggetti[Math.abs(abitanteId * 37 + giorno * 17) % oggetti.length];
  const prodotto = BOTTINO_BOSCO.find(x => x.itemId === id);
  if (!prodotto) return [];
  return [{ ...prodotto, quantità: minuti >= 240 ? 2 : 1 }];
}


export type VoceRaccoltoBosco = {
  itemId: string;
  emoji: string;
  nome: string;
  quantità: number;
};

export function èBosco(edificio: Pick<Edificio, "nome">): boolean {
  return edificio.nome === NOME_BOSCO;
}

export function capacitaEffettivaBosco(edificio: Edificio): number {
  return Math.max(edificio.capacità ?? 0, CAPACITA_BOSCO);
}

export function normalizzaEdificioBosco(edificio: Edificio): Edificio {
  if (!èBosco(edificio)) return edificio;
  const cap = capacitaEffettivaBosco(edificio);
  const ids = [...new Set(edificio.abitantiAssegnati ?? [])];
  return {
    ...edificio,
    capacità: cap,
    abitantiAssegnati: ids,
    occupazione: ids.length,
    stato: "Operativo"
  };
}

export function normalizzaEdificiBosco(edifici: Edificio[]): Edificio[] {
  return edifici.map(normalizzaEdificioBosco);
}

export function trovaBoscoOperativo(edifici: Edificio[]): Edificio | undefined {
  return edifici.find((e) => èBosco(e) && e.stato === "Operativo");
}

export function boscoHaPostoLibero(edifici: Edificio[]): Edificio | undefined {
  return edifici.find((e) => {
    if (!èBosco(e) || e.stato !== "Operativo") return false;
    return (e.abitantiAssegnati?.length ?? 0) < capacitaEffettivaBosco(e);
  });
}

export function disoccupatoIdoneoPerBosco(abitante: Abitante): boolean {
  if (isGiocatore(abitante)) return false;
  if (getCastaAbitante(abitante) === "Nobile") return false;
  if (abitante.lavoro !== "Disoccupato") return false;
  if (abitante.razza === "Golem") return false;
  return true;
}

export function bottinoBoscoPerAbitante(abitanteId: number, giorno: number, slot = 0): BoscoBottinoDef {
  const index = Math.abs(abitanteId * 37 + giorno * 17 + slot * 91) % BOTTINO_BOSCO.length;
  return BOTTINO_BOSCO[index]!;
}

/** 50% deterministico: due oggetti invece di uno. */
export function trovaDueOggettiBosco(abitanteId: number, giorno: number): boolean {
  return Math.abs(abitanteId * 13 + giorno * 29) % 2 === 0;
}

export function raccoltoBoscoDelGiorno(abitanteId: number, giorno: number): VoceRaccoltoBosco[] {
  const drops = [bottinoBoscoPerAbitante(abitanteId, giorno, 0)];
  if (trovaDueOggettiBosco(abitanteId, giorno)) {
    drops.push(bottinoBoscoPerAbitante(abitanteId, giorno, 1));
  }
  const map = new Map<string, VoceRaccoltoBosco>();
  for (const d of drops) {
    const prev = map.get(d.itemId);
    if (prev) prev.quantità += 1;
    else map.set(d.itemId, { itemId: d.itemId, emoji: d.emoji, nome: d.nome, quantità: 1 });
  }
  return [...map.values()];
}

export function etichettaRaccoltoBosco(voci: VoceRaccoltoBosco[]): string {
  return voci.map((v) => `${v.emoji} ${v.nome}${v.quantità > 1 ? ` ×${v.quantità}` : ""}`).join(", ");
}

/**
 * Assumere una persona non equivale a svolgere una giornata di raccolta.
 * Il bottino viene attribuito soltanto da applicaRaccoltaBoscoGiornaliera.
 */
function applicaBottinoInizialeRaccoglitore(
  abitante: Abitante
): { abitante: Abitante; vociNuove: VoceRaccoltoBosco[] | null } {
  return {
    abitante: { ...abitante, lavoro: LAVORO_RACCOGLITORE },
    vociNuove: null
  };
}

export type BottinoBoscoRegistrato = {
  abitanteId: number;
  abitanteNome: string;
  boscoId: number;
  voci: VoceRaccoltoBosco[];
};

export function assumiDisoccupatoNelBosco(
  abitanti: Abitante[],
  edifici: Edificio[],
  abitanteId: number
): {
  abitanti: Abitante[];
  edifici: Edificio[];
  ok: boolean;
  boscoId?: number;
  bottino?: BottinoBoscoRegistrato;
} {
  const ab = abitanti.find((a) => a.id === abitanteId);
  const bosco = boscoHaPostoLibero(edifici) ?? trovaBoscoOperativo(edifici);
  if (!ab || !bosco || !disoccupatoIdoneoPerBosco(ab)) {
    return { abitanti, edifici, ok: false };
  }
  if ((bosco.abitantiAssegnati ?? []).includes(abitanteId)) {
    const applied = applicaBottinoInizialeRaccoglitore(ab);
    const abitantiNext = abitanti.map((a) => (a.id === abitanteId ? applied.abitante : a));
    return {
      abitanti: abitantiNext,
      edifici: normalizzaEdificiBosco(edifici),
      ok: true,
      boscoId: bosco.id,
      bottino: applied.vociNuove
        ? {
            abitanteId,
            abitanteNome: applied.abitante.nome,
            boscoId: bosco.id,
            voci: applied.vociNuove
          }
        : undefined
    };
  }
  const cap = capacitaEffettivaBosco(bosco);
  if ((bosco.abitantiAssegnati ?? []).length >= cap) {
    return { abitanti, edifici, ok: false };
  }
  const edificiNext = edifici.map((e) => {
    if (e.id !== bosco.id) return èBosco(e) ? normalizzaEdificioBosco(e) : e;
    const ids = [...(e.abitantiAssegnati ?? []), abitanteId];
    return normalizzaEdificioBosco({ ...e, abitantiAssegnati: ids, occupazione: ids.length });
  });
  const applied = applicaBottinoInizialeRaccoglitore(ab);
  const abitantiNext = abitanti.map((a) => (a.id === abitanteId ? applied.abitante : a));
  return {
    abitanti: abitantiNext,
    edifici: edificiNext,
    ok: true,
    boscoId: bosco.id,
    bottino: applied.vociNuove
      ? {
          abitanteId,
          abitanteNome: applied.abitante.nome,
          boscoId: bosco.id,
          voci: applied.vociNuove
        }
      : undefined
  };
}

/**
 * Fallback forzato (es. lavoro irraggiungibile): Disoccupato → Raccoglitore nel Bosco,
 * anche oltre capacità se necessario.
 */
export function forzaAssunzioneRaccoglitoreNelBosco(
  abitanti: Abitante[],
  edifici: Edificio[],
  abitanteId: number
): {
  abitanti: Abitante[];
  edifici: Edificio[];
  ok: boolean;
  boscoId?: number;
  bottino?: BottinoBoscoRegistrato;
} {
  const normale = assumiDisoccupatoNelBosco(abitanti, edifici, abitanteId);
  if (normale.ok) return normale;

  const ab = abitanti.find((a) => a.id === abitanteId);
  const bosco = trovaBoscoOperativo(edifici);
  if (!ab || !bosco || isGiocatore(ab) || ab.razza === "Golem") {
    return { abitanti, edifici, ok: false };
  }
  if (ab.lavoro !== "Disoccupato" && ab.lavoro !== LAVORO_RACCOGLITORE) {
    return { abitanti, edifici, ok: false };
  }
  if ((bosco.abitantiAssegnati ?? []).includes(abitanteId)) {
    const applied = applicaBottinoInizialeRaccoglitore(ab);
    return {
      abitanti: abitanti.map((a) => (a.id === abitanteId ? applied.abitante : a)),
      edifici: normalizzaEdificiBosco(edifici),
      ok: true,
      boscoId: bosco.id,
      bottino: applied.vociNuove
        ? {
            abitanteId,
            abitanteNome: applied.abitante.nome,
            boscoId: bosco.id,
            voci: applied.vociNuove
          }
        : undefined
    };
  }
  const edificiNext = edifici.map((e) => {
    if (e.id !== bosco.id) return èBosco(e) ? normalizzaEdificioBosco(e) : e;
    const ids = [...(e.abitantiAssegnati ?? []), abitanteId];
    return normalizzaEdificioBosco({ ...e, abitantiAssegnati: ids, occupazione: ids.length });
  });
  const applied = applicaBottinoInizialeRaccoglitore({ ...ab, lavoro: "Disoccupato" });
  return {
    abitanti: abitanti.map((a) => (a.id === abitanteId ? applied.abitante : a)),
    edifici: edificiNext,
    ok: true,
    boscoId: bosco.id,
    bottino: applied.vociNuove
      ? {
          abitanteId,
          abitanteNome: applied.abitante.nome,
          boscoId: bosco.id,
          voci: applied.vociNuove
        }
      : undefined
  };
}

const FONTI_ANIMALI_BOSCO = new Set(["piccoli-animali", "selvaggina", "piume", "ossa", "corna", "pelli-e-pellicce", "uova-selvatiche", "nidi"]);
const FONTI_ALBERI_BOSCO = new Set(["legno", "rami", "resina"]);
function fonteBosco(itemId: string): keyof RiserveBosco {
  if (FONTI_ANIMALI_BOSCO.has(itemId)) return "fauna";
  if (FONTI_ALBERI_BOSCO.has(itemId)) return "alberi";
  return "vegetazione";
}

export function applicaRaccoltaBoscoGiornaliera(
  abitanti: Abitante[],
  edifici: Edificio[],
  giornoCorrente: number,
  giorni: number
): { abitanti: Abitante[]; edifici: Edificio[]; messaggi: string[]; bottini: BottinoBoscoRegistrato[] } {
  const bosco = trovaBoscoOperativo(edifici);
  if (!bosco || giorni <= 0) return { abitanti, edifici, messaggi: [], bottini: [] };
  let stato = normalizzaStatoEcosistemaBosco(bosco.ecosistemaBosco, giornoCorrente - giorni - 1);
  if (stato.ultimoGiornoAggiornato >= giornoCorrente - 1) {
    return { abitanti, edifici, messaggi: [], bottini: [] };
  }
  // Recupera la rigenerazione dei giorni senza attività prima dell'ultimo.
  for (let gg = stato.ultimoGiornoAggiornato + 1; gg < giornoCorrente - 1; gg++) {
    const trimestre = Math.floor(((gg % 360) + 360) % 360 / 90);
    const stagione = (["primavera", "estate", "autunno", "inverno"] as const)[trimestre]!;
    stato = { ...stato, riserve: rigeneraBoscoDopoPrelievi(
      stato.riserve, { alberi: 0, fauna: 0, vegetazione: 0 }, 0, stagione
    ), ultimoGiornoAggiornato: gg };
  }
  const disponibili: RiserveBosco = { ...stato.riserve };
  const prelevati: RiserveBosco = { alberi: 0, fauna: 0, vegetazione: 0 };
  let cacciatoriOggi = 0;
  let silvicoltoriOggi = 0;
  const raccoglitori = new Set(bosco.abitantiAssegnati ?? []);

  const messaggi: string[] = [];
  const bottini: BottinoBoscoRegistrato[] = [];
  const abitantiNext = abitanti.map((a) => {
    const sedeRichiesta = SEDE_PER_PROFESSIONE[a.lavoro as ProfessioneForestale];
    const èRaccoglitore = a.lavoro === LAVORO_RACCOGLITORE && raccoglitori.has(a.id);
    const èSpecialista = !!sedeRichiesta &&
      edifici.some(e =>
        e.nome === sedeRichiesta &&
        e.stato === "Operativo" &&
        (e.abitantiAssegnati ?? []).includes(a.id)
      );
    if (!èRaccoglitore && !èSpecialista) return a;
    let next = a;
    for (let g = 0; g < giorni; g++) {
      // La raccolta si contabilizza alla mezzanotte SUCCESSIVA alla presenza reale.
      const giorno = giornoCorrente - giorni + g;
      if (next.ultimoIngressoBoscoGiorno !== giorno) continue;
      if (next.ultimoRaccoltoBosco?.giorno === giorno) continue;
      // Entrare nel Bosco non equivale a lavorare: servono minuti realmente
      // trascorsi sul posto e salvati durante i tick di movimento.
      const tempo = next.ultimoLavoroBosco;
      if (tempo?.giorno !== giorno || tempo.minuti < 30) continue;
      const competenza = Number.isFinite(next.competenza) ? next.competenza : 0;
      const bonusTratti = /osservator|pazient|attent/i.test(next.personalità ?? "") ? 10 : 0;
      const probabilità = probabilitaSuccessoForestale(100, competenza + bonusTratti, tempo.minuti);
      // Esito deterministico fra ricaricamenti, senza nuove estrazioni a ogni render.
      const lancio = (((a.id * 9301 + giorno * 49297) >>> 0) % 500000) / 500000;
      if (lancio >= probabilità) continue;
      const voci = prodottiProfessioneForestale(a.lavoro, a.id, giorno, tempo.minuti);
      if (!voci.length) continue;
      for (const v of voci) {
        next = aggiungiOggettoInventarioAbitante(next, v.itemId, v.quantità);
      }
      next = { ...next, ultimoRaccoltoBosco: { giorno, voci } };
      bottini.push({
        abitanteId: a.id,
        abitanteNome: a.nome,
        boscoId: bosco.id,
        voci
      });
      if (g === giorni - 1) {
        messaggi.push(`${a.nome} ha ${èRaccoglitore ? "trovato" : "prodotto"} ${etichettaRaccoltoBosco(voci)} nel Bosco.`);
      }
    }
    return next;
  });
  return { abitanti: abitantiNext, messaggi, bottini };
}
