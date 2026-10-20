import {
  bodyFamilyFor,
  normalizeCharacterAppearance
} from "../character-system/appearance";
import {
  collectLpcSourceIdsForAppearance,
  warmLpcSourceIds
} from "../character-system/preloadLpcAssets";
import { compatibleCatalogOptions } from "../character-system/registry";
import type { Abitante } from "../types";
import {
  aspettoPerVisualizzazioneAbitante,
  creaCharacterAppearance
} from "./personaggioAspetto";

/** Aspetto Re di default (allineato a CreazioneGiocatoreModal). */
function aspettoReTeenDefault() {
  return normalizeCharacterAppearance({
    ...creaCharacterAppearance("Umano", "teen"),
    race: "human",
    bodyType: "teen",
    ageGroup: "teen",
    bodyFamily: bodyFamilyFor("human", "teen"),
    beardStyle: "none",
    headwear: "crown"
  });
}

/** Stesso aspetto che usa AbitanteAvatarPreview / intro Consigliere. */
export function collectLpcSourceIdsForAbitanteVisual(
  abitante: {
    id: number;
    razza?: string | null;
    aspetto?: Abitante["aspetto"];
    lavoro?: string;
    sesso?: "M" | "F" | null;
    incinta?: boolean;
  }
): string[] {
  const visual = aspettoPerVisualizzazioneAbitante(abitante);
  return collectLpcSourceIdsForAppearance(visual?.characterAppearance, ["idle", "walk"]);
}

export async function warmAbitanteVisualAssets(
  abitante: {
    id: number;
    razza?: string | null;
    aspetto?: Abitante["aspetto"];
    lavoro?: string;
    sesso?: "M" | "F" | null;
    incinta?: boolean;
  }
): Promise<void> {
  await warmLpcSourceIds(collectLpcSourceIdsForAbitanteVisual(abitante));
}

/**
 * Asset LPC da avere pronti prima di Continua / Nuova partita:
 * preview Re, tab Identità (pelli), Consigliere come in UI.
 */
export function collectStartupLpcSourceIds(abitanti?: readonly Abitante[]): string[] {
  const ids = new Set<string>();
  const re = aspettoReTeenDefault();
  for (const id of collectLpcSourceIdsForAppearance(re)) ids.add(id);

  const catalog = compatibleCatalogOptions(re, { allowRoyalHeadwear: true });
  for (const skinTone of catalog.skinTones) {
    for (const id of collectLpcSourceIdsForAppearance(
      normalizeCharacterAppearance({ ...re, skinTone }),
      ["idle"]
    )) {
      ids.add(id);
    }
  }

  const dalSalvataggio = abitanti?.find((a) => a.lavoro === "Consigliere");
  for (const id of collectLpcSourceIdsForAbitanteVisual({
    id: dalSalvataggio?.id ?? 99_001,
    razza: dalSalvataggio?.razza ?? "Umano",
    lavoro: "Consigliere",
    sesso: dalSalvataggio?.sesso === "F" ? "F" : "M",
    aspetto: dalSalvataggio?.aspetto,
    incinta: dalSalvataggio?.incinta
  })) {
    ids.add(id);
  }

  return [...ids];
}

/** Precarica gli sprite usati all’apertura creazione Re e intro Consigliere. */
export async function warmStartupCharacterAssets(abitanti?: readonly Abitante[]): Promise<void> {
  await warmLpcSourceIds(collectStartupLpcSourceIds(abitanti));
}
