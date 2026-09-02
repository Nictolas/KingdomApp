import creditsJson from "./generated/lpc-credits.json";
import manifestJson from "./generated/lpc-manifest.json";
import {
  isKimonoVesteAbito,
  isKimonoVesteTrim,
  KIMONO_VESTE_ABITO_IDS,
  KIMONO_VESTE_RIFINITURE_IDS,
  kimonoBaseForTrim
} from "./kimonoVeste";
type ManifestAsset = {
  semanticId: string;
  slot: string;
  bodyType: string;
  attributionId: string;
};

const credits = creditsJson as Record<string, { definition: string }>;
const manifestAssets = (manifestJson as { assets: ManifestAsset[] }).assets;

const definitionByAttribution = Object.fromEntries(
  Object.entries(credits).map(([id, entry]) => [id, entry.definition])
);

const semanticDefinitionCache = new Map<string, Map<string, string>>();

function semanticDefinitionsFor(bodyType: string, slot: string): Map<string, string> {
  const key = `${bodyType}:${slot}`;
  const cached = semanticDefinitionCache.get(key);
  if (cached) return cached;

  const map = new Map<string, string>();
  for (const asset of manifestAssets) {
    if (asset.bodyType !== bodyType || asset.slot !== slot) continue;
    const definition = definitionByAttribution[asset.attributionId];
    if (!definition || map.has(asset.semanticId)) continue;
    map.set(asset.semanticId, definition);
  }
  semanticDefinitionCache.set(key, map);
  return map;
}

export type LpcCatalogSection = {
  label: string;
  match: (definition: string) => boolean;
};

/** Sezioni gambe · pantaloni (LPC legs/pants). */
export const LPC_PANTS_SECTIONS: readonly LpcCatalogSection[] = [
  { label: "Pants", match: (definition) => definition.startsWith("legs/pants/") }
];

/** Sezioni gambe · gonne (LPC legs/skirts). */
export const LPC_SKIRTS_SECTIONS: readonly LpcCatalogSection[] = [
  { label: "Skirts", match: (definition) => definition.startsWith("legs/skirts/") }
];

/** @deprecated Usare LPC_PANTS_SECTIONS / LPC_SKIRTS_SECTIONS */
export const LPC_LEGS_SECTIONS: readonly LpcCatalogSection[] = [
  ...LPC_PANTS_SECTIONS,
  ...LPC_SKIRTS_SECTIONS
];

/** Kimono abiti completi nella scheda Veste (senza longsleeve/oversize). */
export {
  KIMONO_VESTE_ABITO_IDS,
  KIMONO_VESTE_RIFINITURE_IDS,
  isKimonoVesteAbito,
  isKimonoVesteTrim,
  kimonoBaseForTrim,
  kimonoTrimForBase
} from "./kimonoVeste";

export function groupKimonoVesteSections(options: readonly string[], activeBase?: string): GroupedCatalogOptions[] {
  const abito = options.filter((id) => isKimonoVesteAbito(id));
  const rifiniture = options.filter((id) => isKimonoVesteTrim(id) && activeBase != null && kimonoBaseForTrim(id) === activeBase);  const sections: GroupedCatalogOptions[] = [];
  if (abito.length > 0) sections.push({ label: "Abito", options: [...abito] });
  if (rifiniture.length > 0) sections.push({ label: "Rifiniture", options: [...rifiniture] });
  const assigned = new Set([...abito, ...rifiniture]);
  const rest = options.filter((id) => !assigned.has(id));
  if (rest.length > 0) sections.push({ label: "Altro", options: rest });
  return sections;
}

/** @deprecated Usare groupKimonoVesteSections */
export const LPC_KIMONO_VESTE_SECTIONS: readonly LpcCatalogSection[] = [
  {
    label: "Kimono",
    match: (definition) =>
      definition.startsWith("torso/dresses/kimono/") &&
      !definition.includes("longsleeve") &&
      !definition.includes("oversize")
  }
];

/** Kimono con maniche lunghe / oversize → scheda Maniche. */
export const LPC_KIMONO_MANICHE_SECTIONS: readonly LpcCatalogSection[] = [
  { label: "Kimono · Longsleeve Trim", match: (definition) => definition.includes("dress_kimono_longsleeve_trim.json") },
  { label: "Kimono · Longsleeve", match: (definition) => definition.includes("dress_kimono_longsleeve.json") },
  { label: "Kimono · Oversize Trim", match: (definition) => definition.includes("dress_kimono_oversize_trim.json") },
  { label: "Kimono · Oversize", match: (definition) => definition.includes("dress_kimono_oversize.json") }
];

/** @deprecated Usare LPC_KIMONO_VESTE_SECTIONS */
export const LPC_KIMONO_SECTIONS: readonly LpcCatalogSection[] = LPC_KIMONO_VESTE_SECTIONS;

export const KIMONO_MANICHE_FULL_OUTFIT_IDS = [
  "kimono_longsleeve",
  "kimono_longsleeve_trim",
  "kimono_oversize",
  "kimono_oversize_trim"
] as const;

export function isKimonoManicheFullOutfit(semanticId: string): boolean {
  return (KIMONO_MANICHE_FULL_OUTFIT_IDS as readonly string[]).includes(semanticId);
}

/** Maniche · capi «longsleeves» separati (LPC torso/shirts/sleeves). */
export const LPC_MANICHE_TORSO_SECTIONS: readonly LpcCatalogSection[] = [
  { label: "Longsleeves", match: (definition) => definition.includes("/sleeves/") && definition.includes("longsleeve") }
];

/** @deprecated Usare LPC_MANICHE_TORSO_SECTIONS */
export const LPC_LONGSLEEVE_SECTIONS: readonly LpcCatalogSection[] = LPC_MANICHE_TORSO_SECTIONS;

/** Sezioni Torso come nell'albero LPC (sheet_definitions/torso), senza kimono. */
export const LPC_TORSO_SECTIONS: readonly LpcCatalogSection[] = [
  { label: "Longsleeve", match: (definition) => definition.includes("/longsleeve/") },
  { label: "Shirts · Shortsleeve", match: (definition) => definition.includes("/shortsleeve/") },
  { label: "Shirts · Sleeveless", match: (definition) => definition.includes("/sleeveless/") },
  {
    label: "Shirts · Sleeves",
    match: (definition) =>
      definition.includes("/sleeves/") &&
      !definition.includes("longsleeve") &&
      !definition.includes("/shortsleeve/") &&
      !definition.includes("/sleeveless/")
  },
  { label: "Shirts · Tunic", match: (definition) => definition.includes("tunic") },
  { label: "Apron", match: (definition) => definition.includes("/aprons/") },
  { label: "Chainmail", match: (definition) => definition.includes("chainmail") }
];

export type GroupedCatalogOptions = {
  label: string;
  options: string[];
};

export function groupCatalogOptionsByLpcSections(
  options: readonly string[],
  bodyType: string,
  slot: "outfit" | "lowerBody" | "fullOutfit",
  sections: readonly LpcCatalogSection[]
): GroupedCatalogOptions[] {
  const definitions = semanticDefinitionsFor(bodyType, slot);
  const grouped: GroupedCatalogOptions[] = [];
  const assigned = new Set<string>();

  for (const section of sections) {
    const sectionOptions = options.filter((option) => {
      const definition = definitions.get(option);
      return definition != null && section.match(definition) && !assigned.has(option);
    });
    sectionOptions.forEach((option) => assigned.add(option));
    if (sectionOptions.length > 0) {
      grouped.push({ label: section.label, options: sectionOptions });
    }
  }

  const remaining = options.filter((option) => !assigned.has(option));
  if (remaining.length > 0) {
    grouped.push({ label: "Altro", options: [...remaining] });
  }

  return grouped;
}

export function filterTorsoOutfitOptions(options: readonly string[], bodyType: string): string[] {
  const definitions = semanticDefinitionsFor(bodyType, "outfit");
  return options.filter((option) => definitions.get(option)?.startsWith("torso/") ?? false);
}

export function isManicheLongsleevesTorsoOption(_semanticId: string, definition: string): boolean {
  return definition.includes("/sleeves/") && definition.includes("longsleeve");
}

/** @deprecated Usare isManicheLongsleevesTorsoOption */
export function isLongsleeveTorsoOption(semanticId: string, definition: string): boolean {
  return isManicheLongsleevesTorsoOption(semanticId, definition);
}

export function partitionLongsleeveTorsoOptions(options: readonly string[], bodyType: string): {
  manicheSleeves: string[];
  rest: string[];
} {
  const definitions = semanticDefinitionsFor(bodyType, "outfit");
  const manicheSleeves: string[] = [];
  const rest: string[] = [];
  for (const option of options) {
    const definition = definitions.get(option) ?? "";
    if (isManicheLongsleevesTorsoOption(option, definition)) {
      manicheSleeves.push(option);
    } else {
      rest.push(option);
    }
  }
  return { manicheSleeves, rest };
}

export function filterLegsOptions(options: readonly string[], bodyType: string): string[] {
  const definitions = semanticDefinitionsFor(bodyType, "lowerBody");
  return options.filter((option) => definitions.get(option)?.startsWith("legs/") ?? false);
}

export function filterPantsOptions(options: readonly string[], bodyType: string): string[] {
  const definitions = semanticDefinitionsFor(bodyType, "lowerBody");
  return options.filter((option) => definitions.get(option)?.startsWith("legs/pants/") ?? false);
}

export function filterSkirtsOptions(options: readonly string[], bodyType: string): string[] {
  const definitions = semanticDefinitionsFor(bodyType, "lowerBody");
  return options.filter((option) => definitions.get(option)?.startsWith("legs/skirts/") ?? false);
}
