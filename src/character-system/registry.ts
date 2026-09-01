import manifestJson from "./generated/lpc-manifest.json";
import { LPC_PACK_ID, generatedLpcSheet } from "./lpcPack";
import type { CharacterAnimationId, CharacterAppearance, CharacterAssetDefinition, CharacterBodyFamily, CharacterLayer, ResolvedCharacterLayer } from "./types";

type ManifestAsset = { id: string; semanticId: string; slot: CharacterLayer; bodyType: string; color: string; colorField?: keyof CharacterAppearance; animation: string; zPos: number; sourceKey: string; required: boolean; attributionId: string };
type Manifest = { options: { bodyTypes: string[]; skinTones: string[]; hairColors: string[]; hairStyles: string[]; beardStyles: string[]; outfits: string[]; fullOutfits?: string[]; headwear: string[] }; assets: ManifestAsset[] };

export const LPC_RUNTIME_MANIFEST = manifestJson as Manifest;
export const CHARACTER_CATALOG_OPTIONS = LPC_RUNTIME_MANIFEST.options;
const familyForBodyType = (bodyType: string): CharacterBodyFamily => bodyType === "child" ? "humanChild" : bodyType === "teen" ? "humanTeen" : "humanAdult";

function semanticForSlot(asset: ManifestAsset, appearance: CharacterAppearance): boolean {
  if (asset.slot === "body") return asset.semanticId === appearance.bodyType && asset.color === appearance.skinTone;
  if (asset.slot === "raceFeatures") return asset.semanticId === "human_head" && asset.color === appearance.skinTone;
  if (asset.slot === "hairFront" || asset.slot === "hairBack") return appearance.hairStyle !== "none" && asset.semanticId === appearance.hairStyle && asset.color === appearance.hairColor;
  if (asset.slot === "beard") return appearance.beardStyle !== "none" && asset.semanticId === appearance.beardStyle && asset.color === appearance.beardColor;
  if (asset.slot === "fullOutfit") return appearance.fullOutfit !== "none" && asset.semanticId === appearance.fullOutfit;
  if (asset.slot === "outfit") return appearance.fullOutfit === "none" && appearance.upperOutfit !== "none" && asset.semanticId === appearance.upperOutfit;
  if (asset.slot === "lowerBody") return appearance.fullOutfit === "none" && appearance.lowerOutfit !== "none" && asset.semanticId === appearance.lowerOutfit;
  if (asset.slot === "headwear") return appearance.headwear !== "none" && asset.semanticId === appearance.headwear;
  return false;
}

export const CHARACTER_ASSETS: readonly CharacterAssetDefinition[] = LPC_RUNTIME_MANIFEST.assets.map((asset) => ({
  id: asset.id, assetPack: LPC_PACK_ID, layer: asset.slot, bodyFamilies: [familyForBodyType(asset.bodyType)], races: ["human"],
  sheetId: `lpc-generated-${asset.animation}`, sourceId: asset.sourceKey, tint: "none", attributionId: asset.attributionId
}));

export function isAssetCompatible(asset: CharacterAssetDefinition, appearance: CharacterAppearance): boolean {
  return asset.bodyFamilies.includes(appearance.bodyFamily) && asset.races.includes(appearance.race);
}

export function resolveCharacterLayers(appearance: CharacterAppearance, animation: CharacterAnimationId, assetPack = LPC_PACK_ID): ResolvedCharacterLayer[] {
  if (assetPack !== LPC_PACK_ID || appearance.race !== "human") return [];
  const sheet = generatedLpcSheet(animation);
  if (!sheet || !LPC_RUNTIME_MANIFEST.options.bodyTypes.includes(appearance.bodyType)) return [];
  const layers = LPC_RUNTIME_MANIFEST.assets
    .filter((asset) => asset.animation === animation && asset.bodyType === appearance.bodyType && semanticForSlot(asset, appearance))
    .sort((a, b) => a.zPos - b.zPos)
    .map((asset): ResolvedCharacterLayer => ({ id: asset.id, assetPack: LPC_PACK_ID, layer: asset.slot, bodyFamilies: [familyForBodyType(asset.bodyType)], races: ["human"], sheetId: sheet.id, sourceId: asset.sourceKey, tint: "none", attributionId: asset.attributionId, sheet }));
  const slots = new Set(layers.map((layer) => layer.layer));
  if (!slots.has("body") || !slots.has("raceFeatures")) return [];
  if (appearance.fullOutfit !== "none" && !slots.has("fullOutfit")) return [];
  if (appearance.fullOutfit === "none" && appearance.upperOutfit !== "none" && !slots.has("outfit")) return [];
  if (appearance.fullOutfit === "none" && appearance.lowerOutfit !== "none" && !slots.has("lowerBody")) return [];
  if (appearance.hairStyle !== "none" && !slots.has("hairFront") && !slots.has("hairBack")) return [];
  if (appearance.beardStyle !== "none" && !slots.has("beard")) return [];
  if (appearance.headwear !== "none" && !slots.has("headwear")) return [];
  return layers;
}

export function canRenderCharacter(appearance: CharacterAppearance, animation: CharacterAnimationId): boolean { return resolveCharacterLayers(appearance, animation).length > 0; }
export function rendererKindFor(appearance: CharacterAppearance, animation: CharacterAnimationId): "sprite" | "legacy" { return canRenderCharacter(appearance, animation) ? "sprite" : "legacy"; }

export function compatibleCatalogOptions(appearance: CharacterAppearance, options: { allowRoyalHeadwear?: boolean } = {}) {
  const bodyAssets = LPC_RUNTIME_MANIFEST.assets.filter((asset) => asset.bodyType === appearance.bodyType);
  const values = (slot: CharacterLayer) => [...new Set(bodyAssets.filter((asset) => asset.slot === slot).map((asset) => asset.semanticId))].sort();
  const hairColors = [...new Set(bodyAssets
    .filter((asset) => (asset.slot === "hairFront" || asset.slot === "hairBack") && asset.semanticId === appearance.hairStyle)
    .map((asset) => asset.color))].sort();
  return {
    skinTones: LPC_RUNTIME_MANIFEST.options.skinTones.filter((tone) => bodyAssets.some((asset) => asset.slot === "body" && asset.color === tone)),
    hairStyles: [...new Set([...values("hairFront"), ...values("hairBack")])].sort(),
    hairColors,
    beardStyles: ["none", ...values("beard")],
    outfits: values("outfit").filter((value) => values("lowerBody").includes(value)),
    upperOutfits: values("outfit"),
    lowerOutfits: values("lowerBody"),
    fullOutfits: values("fullOutfit"),
    headwear: ["none", ...values("headwear").filter((value) => options.allowRoyalHeadwear || value !== "crown")]
  };
}

export function firstCompatibleHairColor(appearance: CharacterAppearance, hairStyle: string): string {
  return LPC_RUNTIME_MANIFEST.assets.find((asset) =>
    asset.bodyType === appearance.bodyType &&
    (asset.slot === "hairFront" || asset.slot === "hairBack") &&
    asset.semanticId === hairStyle
  )?.color ?? appearance.hairColor;
}
