import manifestJson from "./generated/lpc-manifest.json";
import { LPC_PACK_ID, generatedLpcSheet } from "./lpcPack";
import type { CharacterAnimationId, CharacterAppearance, CharacterAssetDefinition, CharacterBodyFamily, CharacterLayer, ResolvedCharacterLayer } from "./types";

const ACTIVE_SPRITE_RACES = ["human", "elf", "dwarf", "halfling", "skeleton", "vampire", "goblin", "orc", "lizard", "felix"] as const;
const requiredHeadStyle = (appearance: CharacterAppearance) => {
  if (appearance.race === "skeleton") return "skeleton";
  if (appearance.race === "vampire") return "vampire";
  if (appearance.race === "goblin") return "goblin";
  if (appearance.race === "orc") return (appearance.bodyType === "female" || appearance.bodyType === "pregnant") ? "orc_female" : "orc_male";
  if (appearance.race === "lizard") return appearance.bodyType === "female" ? "lizard_female" : "lizard_male";
  return "human_head";
};

type ManifestAsset = { id: string; semanticId: string; slot: CharacterLayer; bodyType: string; color: string; colorField?: keyof CharacterAppearance | "footwear" | "capeColor"; animation: string; zPos: number; sourceKey: string; required: boolean; attributionId: string };
type Manifest = { options: { bodyTypes: string[]; skinTones: string[]; hairColors: string[]; hairStyles: string[]; beardStyles: string[]; outfits: string[]; fullOutfits?: string[]; footwear?: string[]; capes?: string[]; headwear: string[] }; assets: ManifestAsset[] };

export const LPC_RUNTIME_MANIFEST = manifestJson as Manifest;
export const CHARACTER_CATALOG_OPTIONS = LPC_RUNTIME_MANIFEST.options;
const familyForBodyType = (bodyType: string): CharacterBodyFamily =>
  bodyType === "child" ? "humanChild" : bodyType === "teen" ? "humanTeen" : "humanAdult";

function colorValueForField(field: ManifestAsset["colorField"], appearance: CharacterAppearance): string {
  if (!field) return "base";
  if (field === "footwear") return appearance.footwearColor;
  if (field === "capeColor") return appearance.capeColor;
  return (appearance[field] as string) ?? "base";
}

function siblingAssets(asset: ManifestAsset, pool: ManifestAsset[]): ManifestAsset[] {
  return pool.filter((other) =>
    other.slot === asset.slot &&
    other.semanticId === asset.semanticId &&
    other.bodyType === asset.bodyType &&
    other.animation === asset.animation &&
    other.colorField === asset.colorField
  );
}

function resolvedColorForAsset(asset: ManifestAsset, appearance: CharacterAppearance, pool: ManifestAsset[], preferredColor?: string): string {
  if (!asset.colorField) return asset.color;
  const desired = preferredColor ?? colorValueForField(asset.colorField, appearance);
  const available = [...new Set(siblingAssets(asset, pool).map((other) => other.color))].sort();
  if (available.includes(desired)) return desired;
  if (available.includes("base")) return "base";
  return available[0] ?? desired;
}

function assetColorMatches(asset: ManifestAsset, appearance: CharacterAppearance, pool: ManifestAsset[], preferredColor?: string): boolean {
  if (!asset.colorField) return asset.color === "base";
  return asset.color === resolvedColorForAsset(asset, appearance, pool, preferredColor);
}

function semanticForSlot(asset: ManifestAsset, appearance: CharacterAppearance, pool: ManifestAsset[]): boolean {
  if (asset.slot === "body") return asset.semanticId === appearance.bodyType && asset.color === appearance.skinTone;
  if (asset.slot === "raceFeatures") {
    // Le teste d'orco LPC sono già verdi nella variante olive; il nuovo corpo
    // orc_green riusa quelle teste anziché sovrapporre una testa umana marrone.
    const matchesGreenOrcHead =
      (appearance.race === "orc" || appearance.race === "goblin") && appearance.skinTone === "orc_green" && asset.color === "olive";
    return asset.semanticId === appearance.headStyle &&
      (asset.color === "base" || asset.color === appearance.skinTone || matchesGreenOrcHead);
  }
  if (asset.slot === "ears") return appearance.race === "felix" &&
    (asset.semanticId === "cat_ears" || asset.semanticId === "cat_ears_skintone") &&
    assetColorMatches(asset, appearance, pool);
  if (asset.slot === "hairFront" || asset.slot === "hairBack") return appearance.hairStyle !== "none" && asset.semanticId === appearance.hairStyle && asset.color === appearance.hairColor;
  if (asset.slot === "beard") return appearance.beardStyle !== "none" && asset.semanticId === appearance.beardStyle && asset.color === appearance.beardColor;
  if (asset.slot === "fullOutfit") {
    if (appearance.fullOutfit === "none") return false;
    const matchesBase = asset.semanticId === appearance.fullOutfit;
    const matchesTrim = appearance.fullOutfitTrim !== "none" && asset.semanticId === appearance.fullOutfitTrim;
    if (!matchesBase && !matchesTrim) return false;
    return assetColorMatches(asset, appearance, pool);
  }
  if (asset.slot === "outfit") {
    const isBusto = appearance.fullOutfit === "none" && appearance.upperOutfit !== "none" && asset.semanticId === appearance.upperOutfit;
    const isManiche = appearance.sleeveOutfit !== "none" && asset.semanticId === appearance.sleeveOutfit;
    if (!isBusto && !isManiche) return false;
    // Entrambi gli elementi usano il layer LPC "outfit", ma hanno ID e colori indipendenti.
    return assetColorMatches(asset, appearance, pool, isManiche && !isBusto ? appearance.sleeveColor : undefined);
  }
  if (asset.slot === "lowerBody") {
    if (appearance.fullOutfit !== "none") return false;
    if (appearance.lowerOutfit === "none") return false;
    if (asset.semanticId !== appearance.lowerOutfit) return false;
    return assetColorMatches(asset, appearance, pool);
  }
  if (asset.slot === "footwear") {
    if (appearance.footwear === "none") return false;
    if (asset.semanticId !== appearance.footwear) return false;
    return assetColorMatches(asset, appearance, pool);
  }
  if (asset.slot === "headwear") return appearance.headwear !== "none" &&
    asset.semanticId === appearance.headwear && assetColorMatches(asset, appearance, pool);
  if (asset.slot === "neck") return appearance.neckwear !== "none" &&
    asset.semanticId === appearance.neckwear && assetColorMatches(asset, appearance, pool);
  if (asset.slot === "facialMask") return appearance.facialMask !== "none" &&
    asset.semanticId === appearance.facialMask && assetColorMatches(asset, appearance, pool);
  if (asset.slot === "facialEyes") return appearance.facialEyes !== "none" &&
    asset.semanticId === appearance.facialEyes && assetColorMatches(asset, appearance, pool);
  if (asset.slot === "cape") {
    if (appearance.cape === "none") return false;
    const matchesBase = asset.semanticId === appearance.cape;
    const matchesTrim = appearance.capeTrim !== "none" && asset.semanticId === appearance.capeTrim;
    if (!matchesBase && !matchesTrim) return false;
    return assetColorMatches(asset, appearance, pool);
  }
  if (asset.slot === "accessory") {
    return appearance.accessory !== "none" && asset.semanticId === appearance.accessory;
  }
  return false;
}

export const CHARACTER_ASSETS: readonly CharacterAssetDefinition[] = LPC_RUNTIME_MANIFEST.assets.map((asset) => ({
  id: asset.id, assetPack: LPC_PACK_ID, layer: asset.slot, semanticId: asset.semanticId, bodyFamilies: [familyForBodyType(asset.bodyType)], races: ACTIVE_SPRITE_RACES,
  sheetId: `lpc-generated-${asset.animation}`, sourceId: asset.sourceKey, tint: "none", attributionId: asset.attributionId
}));

export function isAssetCompatible(asset: CharacterAssetDefinition, appearance: CharacterAppearance): boolean {
  // Gli sprite LPC condividono le stesse basi corporee per più razze:
  // Orchi/Goblin/Elfi ecc. differiscono tramite i layer raceFeatures, non tramite
  // una sprite-body family separata. La compatibilità runtime deve quindi
  // seguire il bodyType effettivamente renderizzato, come resolveCharacterLayers.
  const runtimeBodyFamily = familyForBodyType(appearance.bodyType);
  return asset.bodyFamilies.includes(runtimeBodyFamily) && asset.races.includes(appearance.race);
}

export function resolveCharacterLayers(appearance: CharacterAppearance, animation: CharacterAnimationId, assetPack = LPC_PACK_ID): ResolvedCharacterLayer[] {
  if (assetPack !== LPC_PACK_ID || !ACTIVE_SPRITE_RACES.includes(appearance.race as typeof ACTIVE_SPRITE_RACES[number]) || appearance.headStyle !== requiredHeadStyle(appearance)) return [];
  const sheet = generatedLpcSheet(animation);
  if (!sheet || !LPC_RUNTIME_MANIFEST.options.bodyTypes.includes(appearance.bodyType)) return [];
  const pool = LPC_RUNTIME_MANIFEST.assets.filter((asset) => asset.animation === animation && asset.bodyType === appearance.bodyType);
  const isManicheAsset = (asset: ManifestAsset) => asset.slot === "outfit" &&
    appearance.sleeveOutfit !== "none" && asset.semanticId === appearance.sleeveOutfit &&
    asset.semanticId !== appearance.upperOutfit;
  const garmentSlot = appearance.fullOutfit !== "none" ? "fullOutfit" : "outfit";
  const garmentId = appearance.fullOutfit !== "none" ? appearance.fullOutfit : appearance.upperOutfit;
  const garmentTop = Math.max(-Infinity, ...pool
    .filter((asset) => asset.slot === garmentSlot && asset.semanticId === garmentId)
    .map((asset) => asset.zPos));
  // Garantisce che le maniche siano disegnate sopra il busto, senza alterare l'ordine degli altri strati LPC.
  const layerZ = (asset: ManifestAsset) => isManicheAsset(asset)
    ? Math.max(asset.zPos, garmentTop + 0.01) : asset.zPos;
  const layers = pool
    .filter((asset) => semanticForSlot(asset, appearance, pool))
    .sort((a, b) => layerZ(a) - layerZ(b))
    .map((asset): ResolvedCharacterLayer => ({ id: asset.id, assetPack: LPC_PACK_ID, layer: asset.slot, semanticId: asset.semanticId, zPos: layerZ(asset), bodyFamilies: [familyForBodyType(asset.bodyType)], races: ACTIVE_SPRITE_RACES, sheetId: sheet.id, sourceId: asset.sourceKey, tint: "none", attributionId: asset.attributionId, sheet }));

  // L'asset LPC guard_chainmail esiste per male/female/teen ma non per
  // child/pregnant. Le Guardie Nane mantengono il corpo child e ricevono
  // lo strato militare teen, senza alterare razza o aspetto persistito.
  if (appearance.fullOutfit === "none" &&
      appearance.upperOutfit === "guard" &&
      !layers.some((layer) => layer.layer === "outfit" && layer.semanticId === "guard")) {
    const guardOverlay = LPC_RUNTIME_MANIFEST.assets.filter((asset) =>
      asset.animation === animation &&
      asset.bodyType === "teen" &&
      asset.slot === "outfit" &&
      asset.semanticId === "guard"
    );
    layers.push(...guardOverlay.map((asset): ResolvedCharacterLayer => ({
      id: asset.id,
      assetPack: LPC_PACK_ID,
      layer: asset.slot,
      semanticId: asset.semanticId,
      zPos: asset.zPos,
      bodyFamilies: [familyForBodyType(appearance.bodyType)],
      races: ACTIVE_SPRITE_RACES,
      sheetId: sheet.id,
      sourceId: asset.sourceKey,
      tint: "none",
      attributionId: asset.attributionId,
      sheet
    })));
    layers.sort((a, b) => a.zPos - b.zPos);
  }

  if (appearance.accessory !== "none" && !layers.some((layer) => layer.layer === "accessory")) {
    const toolAnimation = animation === "idle" ? "walk" : animation;
    const toolSheet = generatedLpcSheet(toolAnimation);
    if (toolSheet) {
      const toolPool = LPC_RUNTIME_MANIFEST.assets.filter(
        (asset) => asset.animation === toolAnimation && asset.bodyType === appearance.bodyType && asset.slot === "accessory"
      );
      const toolLayers = toolPool
        .filter((asset) => semanticForSlot(asset, appearance, toolPool))
        .map((asset): ResolvedCharacterLayer => ({
          id: asset.id,
          assetPack: LPC_PACK_ID,
          layer: asset.slot,
          semanticId: asset.semanticId,
          zPos: asset.zPos,
          bodyFamilies: [familyForBodyType(asset.bodyType)],
          races: ACTIVE_SPRITE_RACES,
          sheetId: toolSheet.id,
          sourceId: asset.sourceKey,
          tint: "none",
          attributionId: asset.attributionId,
          sheet: toolSheet
        }));
      layers.push(...toolLayers);
      layers.sort((a, b) => a.zPos - b.zPos);
    }
  }

  const slots = new Set(layers.map((layer) => layer.layer));
  if (!slots.has("body") || !slots.has("raceFeatures")) return [];
  if (appearance.race === "felix" && (
    layers.filter(x => x.layer === "ears" && x.semanticId === "cat_ears").length !== 2 ||
    layers.filter(x => x.layer === "ears" && x.semanticId === "cat_ears_skintone").length !== 2
  )) return [];
  if (appearance.fullOutfit !== "none" && !slots.has("fullOutfit")) return [];
  if (appearance.fullOutfit === "none" && appearance.upperOutfit !== "none" && !slots.has("outfit")) return [];
  if (appearance.sleeveOutfit !== "none" && !layers.some((layer) => layer.layer === "outfit" && layer.semanticId === appearance.sleeveOutfit)) return [];
  if (appearance.fullOutfit === "none" && appearance.lowerOutfit !== "none" && !slots.has("lowerBody")) return [];
  if (appearance.hairStyle !== "none" && !slots.has("hairFront") && !slots.has("hairBack")) return [];
  if (appearance.beardStyle !== "none" && !slots.has("beard")) return [];
  if (appearance.headwear !== "none" && !slots.has("headwear")) return [];
  if (appearance.footwear !== "none" && !slots.has("footwear")) return [];
  return layers;
}

export function canRenderCharacter(appearance: CharacterAppearance, animation: CharacterAnimationId): boolean { return resolveCharacterLayers(appearance, animation).length > 0; }
export function rendererKindFor(appearance: CharacterAppearance, animation: CharacterAnimationId): "sprite" | "legacy" { return canRenderCharacter(appearance, animation) ? "sprite" : "legacy"; }

function catalogColors(bodyAssets: ManifestAsset[], colorField: ManifestAsset["colorField"]): string[] {
  return [...new Set(bodyAssets.filter((asset) => asset.colorField === colorField).map((asset) => asset.color))].sort();
}

export function compatibleCatalogOptions(appearance: CharacterAppearance, options: { allowRoyalHeadwear?: boolean } = {}) {
  const bodyAssets = LPC_RUNTIME_MANIFEST.assets.filter((asset) => asset.bodyType === appearance.bodyType);
  const values = (slot: CharacterLayer) => [...new Set(bodyAssets.filter((asset) => asset.slot === slot).map((asset) => asset.semanticId))].sort();
  const hairColors = [...new Set(bodyAssets
    .filter((asset) => (asset.slot === "hairFront" || asset.slot === "hairBack") && asset.semanticId === appearance.hairStyle)
    .map((asset) => asset.color))].sort();
  return {
    skinTones: appearance.race === "orc" || appearance.race === "goblin"
      ? ["orc_green"]
      : LPC_RUNTIME_MANIFEST.options.skinTones.filter((tone) => bodyAssets.some((asset) => asset.slot === "body" && asset.color === tone)),
    hairStyles: [...new Set([...values("hairFront"), ...values("hairBack")])].sort(),
    hairColors,
    beardStyles: ["none", ...values("beard")],
    outfits: values("outfit").filter((value) => values("lowerBody").includes(value)),
    upperOutfits: values("outfit"),
    lowerOutfits: values("lowerBody"),
    fullOutfits: values("fullOutfit"),
    footwear: values("footwear"),
    capes: values("cape"),
    outfitPrimaryColors: catalogColors(bodyAssets, "outfitPrimaryColor"),
    outfitSecondaryColors: catalogColors(bodyAssets, "outfitSecondaryColor"),
    footwearColors: catalogColors(bodyAssets, "footwear"),
    capeColors: catalogColors(bodyAssets, "capeColor"),
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

export function compatibleColorsForField(
  appearance: CharacterAppearance,
  colorField: NonNullable<ManifestAsset["colorField"]>,
  slot: CharacterLayer,
  semanticId: string
): string[] {
  return [...new Set(LPC_RUNTIME_MANIFEST.assets
    .filter((asset) => asset.bodyType === appearance.bodyType && asset.slot === slot && asset.semanticId === semanticId && asset.colorField === colorField)
    .map((asset) => asset.color))].sort();
}

export function firstCompatibleColorForField(
  appearance: CharacterAppearance,
  colorField: NonNullable<ManifestAsset["colorField"]>,
  slot: CharacterLayer,
  semanticId: string
): string {
  const available = compatibleColorsForField(appearance, colorField, slot, semanticId);
  const desired = colorValueForField(colorField, appearance);
  if (available.includes(desired)) return desired;
  if (available.includes("base")) return "base";
  return available[0] ?? desired;
}
