import type { Abitante } from "../types";
import { COSTO_BAR_MONETE } from "./economiaPrezzi";

export { COSTO_BAR_MONETE };

/** Bisogni individuali 0–100 (100 = soddisfatto). */
export type BisogniAbitante = {
  fame: number;
  energia: number;
  divertimento: number;
  socialita: number;
  igiene: number;
};

export const BISOGNI_DEFAULT: BisogniAbitante = {
  fame: 75,
  energia: 75,
  divertimento: 70,
  socialita: 70,
  igiene: 75
};

const DECAY_GIORNO: BisogniAbitante = {
  fame: 14,
  energia: 10,
  divertimento: 5,
  socialita: 4,
  igiene: 4
};

export function clampBisogno(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function clampBisogni(b: BisogniAbitante): BisogniAbitante {
  return {
    fame: clampBisogno(b.fame),
    energia: clampBisogno(b.energia),
    divertimento: clampBisogno(b.divertimento),
    socialita: clampBisogno(b.socialita),
    igiene: clampBisogno(b.igiene)
  };
}

export function creaBisogniIniziali(partial?: Partial<BisogniAbitante>): BisogniAbitante {
  return clampBisogni({ ...BISOGNI_DEFAULT, ...partial });
}

export function getBisogniAbitante(abitante: Abitante): BisogniAbitante {
  if (abitante.bisogni) return clampBisogni(abitante.bisogni);
  const energia = clampBisogno(100 - (abitante.stanchezza ?? 25));
  return creaBisogniIniziali({ energia });
}

/** Allinea `stanchezza` a Energia (stanchezza = 100 − energia). */
export function syncStanchezzaDaEnergia(abitante: Abitante, bisogni: BisogniAbitante): Abitante {
  return {
    ...abitante,
    bisogni: clampBisogni(bisogni),
    stanchezza: clampBisogno(100 - bisogni.energia)
  };
}

export function patchBisogni(abitante: Abitante, delta: Partial<BisogniAbitante>): Abitante {
  const cur = getBisogniAbitante(abitante);
  const next = clampBisogni({
    fame: cur.fame + (delta.fame ?? 0),
    energia: cur.energia + (delta.energia ?? 0),
    divertimento: cur.divertimento + (delta.divertimento ?? 0),
    socialita: cur.socialita + (delta.socialita ?? 0),
    igiene: cur.igiene + (delta.igiene ?? 0)
  });
  return syncStanchezzaDaEnergia(abitante, next);
}

export function abitanteUsaBisogniUmani(abitante: Abitante): boolean {
  return abitante.razza !== "Robot";
}

/** Bonus igiene/giorno da qualità residenza (catalogo). */
export function bonusIgieneDaNomeResidenza(nomeResidenza: string | null | undefined): number {
  if (!nomeResidenza) return 0;
  switch (nomeResidenza) {
    case "Villa":
      return 18;
    case "Attico":
      return 14;
    case "Villetta":
      return 10;
    case "Modulo":
      return 7;
    case "Dormitorio":
      return 5;
    case "Capanna":
      return 4;
    case "Baracca":
      return 1;
    default:
      return 3;
  }
}

/** Decay giornaliero; Energia se ha casa; Igiene da qualità abitazione. */
export function applicaDecayBisogniGiornaliero(
  abitante: Abitante,
  opts?: { nomeResidenza?: string | null }
): Abitante {
  const cur = getBisogniAbitante(abitante);
  const haCasa = !(abitante.fazioni ?? []).includes("Senzatetto");
  const èRobot = !abitanteUsaBisogniUmani(abitante);
  const bonusIgiene = haCasa ? bonusIgieneDaNomeResidenza(opts?.nomeResidenza) : 0;

  if (èRobot) {
    const energia = cur.energia - DECAY_GIORNO.energia + (haCasa ? 28 : 0);
    return syncStanchezzaDaEnergia(abitante, {
      fame: 100,
      energia,
      divertimento: 100,
      socialita: 100,
      igiene: 100
    });
  }

  const next: BisogniAbitante = {
    fame: cur.fame - DECAY_GIORNO.fame,
    energia: cur.energia - DECAY_GIORNO.energia + (haCasa ? 32 : 0),
    divertimento: cur.divertimento - DECAY_GIORNO.divertimento,
    socialita: cur.socialita - DECAY_GIORNO.socialita,
    igiene: cur.igiene - DECAY_GIORNO.igiene + bonusIgiene
  };
  return syncStanchezzaDaEnergia(abitante, next);
}

/** Pasto riuscito. */
export function applicaRecuperoFamePasto(abitante: Abitante): Abitante {
  if (!abitanteUsaBisogniUmani(abitante)) return abitante;
  return patchBisogni(abitante, { fame: 45 });
}

/** Arrivo a casa / inizio sonno. */
export function applicaRecuperoEnergiaSonno(
  abitante: Abitante,
  opts?: { nomeResidenza?: string | null }
): Abitante {
  const igieneExtra = Math.floor(bonusIgieneDaNomeResidenza(opts?.nomeResidenza) / 2);
  return patchBisogni(abitante, { energia: 40, igiene: 5 + igieneExtra });
}

/** Visita al bar; `altriPresenti` alza la Socialità. */
export function applicaRecuperoBar(abitante: Abitante, altriPresenti = 0): Abitante {
  if (!abitanteUsaBisogniUmani(abitante)) return abitante;
  const extraSocial = Math.min(15, Math.max(0, altriPresenti) * 3);
  return patchBisogni(abitante, { divertimento: 35, socialita: 20 + extraSocial });
}

/** Preghiera / culto. */
export function applicaRecuperoCulto(abitante: Abitante): Abitante {
  if (!abitanteUsaBisogniUmani(abitante)) return abitante;
  return patchBisogni(abitante, { socialita: 25, divertimento: 8 });
}

/** Produttività effettiva: malus se Fame o Energia critiche. */
export function getProduttivitaEffettiva(abitante: Abitante): number {
  const base = Math.max(0, Math.min(100, abitante.produttività ?? 0));
  const b = getBisogniAbitante(abitante);
  let fattore = 1;
  if (b.energia < 15) fattore *= 0.45;
  else if (b.energia < 30) fattore *= 0.7;
  else if (b.energia < 50) fattore *= 0.9;

  if (abitanteUsaBisogniUmani(abitante)) {
    if (b.fame < 15) fattore *= 0.4;
    else if (b.fame < 30) fattore *= 0.65;
    else if (b.fame < 50) fattore *= 0.85;
  }
  return Math.max(0, Math.min(100, Math.round(base * fattore)));
}

export function normalizzaAbitanteBisogni(abitante: Abitante): Abitante {
  return syncStanchezzaDaEnergia(abitante, getBisogniAbitante(abitante));
}

export const SOGLIA_BISOGNO_AZIONE = 45;
export const SOGLIA_BISOGNO_CRITICO = 28;

export type AzioneTempoLibero = "mensa" | "negozio" | "bar" | "home" | "nessuna";

function deficitSottoSoglia(valore: number, soglia: number): number {
  if (valore >= soglia) return 0;
  return soglia - valore;
}

export function abitanteVuoleBarPerBisogni(abitante: Abitante): boolean {
  if (!abitanteUsaBisogniUmani(abitante)) return false;
  const b = getBisogniAbitante(abitante);
  return b.divertimento < SOGLIA_BISOGNO_AZIONE || b.socialita < SOGLIA_BISOGNO_AZIONE;
}

export function abitanteHaFameUrgente(abitante: Abitante): boolean {
  if (!abitanteUsaBisogniUmani(abitante)) return false;
  return getBisogniAbitante(abitante).fame < SOGLIA_BISOGNO_AZIONE;
}

/** Disoccupato senza monete e con bisogni a pagamento → cerca lavoro. */
export function abitanteCercaLavoroPerSoldi(abitante: Abitante, moneteDisponibili: number): boolean {
  if (!abitanteUsaBisogniUmani(abitante)) return false;
  if (abitante.lavoro !== "Disoccupato") return false;
  if (moneteDisponibili >= COSTO_BAR_MONETE) return false;
  return abitanteVuoleBarPerBisogni(abitante) || getBisogniAbitante(abitante).fame < SOGLIA_BISOGNO_CRITICO;
}

/**
 * Tempo libero: Fame (mensa/negozio) → bar → casa.
 * `puòUsareNegozio` se ha monete e Negozio operativo senza cibo personale.
 */
export function scegliAzioneTempoLibero(
  abitante: Abitante,
  opts: { puòUsareMensa: boolean; puòUsareNegozio?: boolean; haCasa: boolean }
): AzioneTempoLibero {
  if (!abitanteUsaBisogniUmani(abitante)) return "nessuna";
  const b = getBisogniAbitante(abitante);
  const puòNegozio = opts.puòUsareNegozio === true;

  const scoreFameMensa = opts.puòUsareMensa ? deficitSottoSoglia(b.fame, SOGLIA_BISOGNO_AZIONE) : 0;
  const scoreFameNegozio = puòNegozio ? deficitSottoSoglia(b.fame, SOGLIA_BISOGNO_AZIONE) : 0;
  const scoreBar = Math.max(
    deficitSottoSoglia(b.divertimento, SOGLIA_BISOGNO_AZIONE),
    deficitSottoSoglia(b.socialita, SOGLIA_BISOGNO_AZIONE)
  );
  const scoreCasa = opts.haCasa ? deficitSottoSoglia(b.energia, SOGLIA_BISOGNO_AZIONE) : 0;

  if (b.fame < SOGLIA_BISOGNO_CRITICO) {
    if (opts.puòUsareMensa) return "mensa";
    if (puòNegozio) return "negozio";
  }
  if (opts.haCasa && b.energia < SOGLIA_BISOGNO_CRITICO) return "home";

  const bestFame = Math.max(scoreFameMensa, scoreFameNegozio);
  const best = Math.max(bestFame, scoreBar, scoreCasa);
  if (best <= 0) return "nessuna";
  if (bestFame >= scoreBar && bestFame >= scoreCasa) {
    if (scoreFameMensa >= scoreFameNegozio && opts.puòUsareMensa) return "mensa";
    if (puòNegozio) return "negozio";
    if (opts.puòUsareMensa) return "mensa";
  }
  if (scoreBar >= scoreCasa) return "bar";
  return "home";
}

/** Drain Energia extra se lavora (giornaliero). */
export function applicaDrainEnergiaLavoro(abitante: Abitante): Abitante {
  if (abitante.lavoro === "Disoccupato" || abitante.lavoro === "Pensionato" || abitante.lavoro === "Neonato") {
    return abitante;
  }
  if (abitante.lavoro === "Prigioniero") return patchBisogni(abitante, { energia: -6 });
  return patchBisogni(abitante, { energia: -8 });
}
