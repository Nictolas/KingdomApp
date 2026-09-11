import {
  appearanceForPublicSpace,
  normalizeCharacterAppearance
} from "../character-system/appearance";
import { LAVORO_GIOCATORE } from "./schiavituCommercio";
import type { AspettoPersonaggio } from "./personaggioAspetto";
import {
  applicaAspettoCapoReligioso,
  creaCharacterAppearance,
  generaAspettoCasuale
} from "./personaggioAspetto";

function randomFromSeed(seed: number): () => number {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function seedFromSlug(slug: string): number {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h = Math.imul(h ^ slug.charCodeAt(i), 16777619);
  }
  return h >>> 0 || 1;
}

/** Aspetto umano dimostrativo per le card Occupati in /lavori (come Razze). */
export function generaAspettoEsempioOccupazione(lavoro: string, slug: string): AspettoPersonaggio {
  const seed = seedFromSlug(slug);
  const random = randomFromSeed(seed);
  const sesso = random() > 0.45 ? "F" : "M";
  const base = generaAspettoCasuale("Umano", random, { sesso, professione: lavoro });
  const isKing = lavoro === LAVORO_GIOCATORE;

  let characterAppearance = appearanceForPublicSpace(
    base.characterAppearance ?? creaCharacterAppearance("Umano", sesso === "F" ? "female" : "male"),
    {
      isKing,
      nudismoAttivo: false,
      lavoro: isKing ? LAVORO_GIOCATORE : lavoro,
      seed
    }
  );

  if (lavoro === "Capo Religioso" || lavoro === "Capo Spirituale") {
    const conKimono = applicaAspettoCapoReligioso(
      { ...base, characterAppearance },
      randomFromSeed(seed + 17)
    );
    characterAppearance = normalizeCharacterAppearance(conKimono.characterAppearance);
  }

  return { ...base, characterAppearance };
}
