import type { CharacterAppearance } from "./types";

/** Kimono abiti completi nella scheda Veste (senza longsleeve/oversize). */
export const KIMONO_VESTE_ABITO_IDS = ["kimono", "kimono_split"] as const;
export const KIMONO_VESTE_RIFINITURE_IDS = ["kimono_split_trim", "kimono_trim"] as const;

const KIMONO_TRIM_BY_BASE: Record<string, string> = {
  kimono: "kimono_trim",
  kimono_split: "kimono_split_trim"
};

const KIMONO_BASE_BY_TRIM: Record<string, string> = {
  kimono_trim: "kimono",
  kimono_split_trim: "kimono_split"
};

export function isKimonoVesteAbito(semanticId: string): boolean {
  return (KIMONO_VESTE_ABITO_IDS as readonly string[]).includes(semanticId);
}

export function isKimonoVesteTrim(semanticId: string): boolean {
  return (KIMONO_VESTE_RIFINITURE_IDS as readonly string[]).includes(semanticId);
}

export function kimonoTrimForBase(baseId: string): string | undefined {
  return KIMONO_TRIM_BY_BASE[baseId];
}

export function kimonoBaseForTrim(trimId: string): string | undefined {
  return KIMONO_BASE_BY_TRIM[trimId];
}

export function normalizeKimonoVesteFields(
  value?: Partial<CharacterAppearance>
): Pick<CharacterAppearance, "fullOutfit" | "fullOutfitTrim"> {
  let fullOutfit = value?.fullOutfit ?? "none";
  let fullOutfitTrim = value?.fullOutfitTrim ?? "none";

  if (isKimonoVesteTrim(fullOutfit)) {
    fullOutfitTrim = fullOutfit;
    fullOutfit = kimonoBaseForTrim(fullOutfitTrim) ?? "none";
  }

  if (fullOutfitTrim !== "none") {
    const requiredBase = kimonoBaseForTrim(fullOutfitTrim);
    if (fullOutfit === "none" || fullOutfit !== requiredBase) {
      fullOutfitTrim = "none";
    }
  }

  return { fullOutfit, fullOutfitTrim };
}
