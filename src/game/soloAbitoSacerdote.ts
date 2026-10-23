import type { CharacterAppearance } from "../character-system/types";
import type { AspettoPersonaggio } from "./personaggioAspetto";

/** Only clothing and wearable accessories may be changed by the priest outfit editor. */
export const CAMPI_ABITO_SACERDOTE = [
  "outfit", "upperOutfit", "lowerOutfit", "fullOutfit", "fullOutfitTrim",
  "outfitPrimaryColor", "outfitSecondaryColor",
  "footwear", "footwearColor",
  "headwear", "headwearColor",
  "neckwear", "neckwearColor",
  "facialMask", "facialMaskColor", "facialEyes", "facialEyesColor",
  "cape", "capeTrim", "capeColor", "accessory"
] as const satisfies readonly (keyof CharacterAppearance)[];

/** Preserve the template's identity, body, face and hair even if an editor sends unrelated fields. */
export function applicaSoloAbitoSacerdote(
  originale: AspettoPersonaggio,
  modificato: AspettoPersonaggio
): AspettoPersonaggio {
  const originaleLpc = originale.characterAppearance;
  const modificatoLpc = modificato.characterAppearance;
  if (!originaleLpc || !modificatoLpc) return originale;
  const abiti: Partial<CharacterAppearance> = {};
  for (const campo of CAMPI_ABITO_SACERDOTE) {
    Object.assign(abiti, { [campo]: modificatoLpc[campo] });
  }
  return {
    ...originale,
    characterAppearance: { ...originaleLpc, ...abiti }
  };
}

/** Defend state changes even when the editor is switched between create and outfit modes. */
export function soloCampiAbitoSacerdote(
  patch: Partial<CharacterAppearance>
): Partial<CharacterAppearance> {
  const filtrato: Partial<CharacterAppearance> = {};
  for (const campo of CAMPI_ABITO_SACERDOTE) {
    if (Object.prototype.hasOwnProperty.call(patch, campo)) {
      Object.assign(filtrato, { [campo]: patch[campo] });
    }
  }
  return filtrato;
}
