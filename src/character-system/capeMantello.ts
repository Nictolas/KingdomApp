import type { CharacterAppearance } from "./types";

export const CAPE_BASE_IDS = ["solid", "tattered"] as const;
export const CAPE_TRIM_ID = "trim" as const;

export type CapeMantelloSectionLabel = "Cape" | "Cape Trim" | "Solid" | "Tattered";

export function isCapeBase(semanticId: string): boolean {
  return (CAPE_BASE_IDS as readonly string[]).includes(semanticId);
}

export function isCapeTrim(semanticId: string): boolean {
  return semanticId === CAPE_TRIM_ID;
}

export function normalizeCapeFields(
  value?: Partial<CharacterAppearance>
): Pick<CharacterAppearance, "cape" | "capeTrim"> {
  let cape = value?.cape ?? "none";
  let capeTrim = value?.capeTrim ?? "none";

  if (isCapeTrim(cape)) {
    capeTrim = cape;
    cape = "solid";
  }

  if (capeTrim !== "none" && cape === "none") {
    capeTrim = "none";
  }

  return { cape, capeTrim };
}

export type GroupedCapeOptions = {
  label: CapeMantelloSectionLabel;
  options: string[];
};

/** Sezioni scheda Mantello: Cape, Solid, Tattered, Cape Trim. */
export function groupCapeMantelloSections(options: readonly string[], hasBaseCape: boolean): GroupedCapeOptions[] {
  const solid = options.filter((id) => id === "solid");
  const tattered = options.filter((id) => id === "tattered");
  const trim = hasBaseCape ? options.filter((id) => id === "trim") : [];
  const bases = [...solid, ...tattered];

  const sections: GroupedCapeOptions[] = [];
  if (bases.length > 0) sections.push({ label: "Cape", options: bases });
  if (solid.length > 0) sections.push({ label: "Solid", options: solid });
  if (tattered.length > 0) sections.push({ label: "Tattered", options: tattered });
  if (trim.length > 0) sections.push({ label: "Cape Trim", options: trim });
  return sections;
}
