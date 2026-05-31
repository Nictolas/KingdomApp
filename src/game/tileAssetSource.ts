/** Restituisce l’id asset React Native o `null` se il file non esiste (→ tile rosso). */
export function optionalTileAsset(loader: () => number): number | null {
  try {
    return loader();
  } catch {
    return null;
  }
}

export function tileAssetFromMap<K extends string>(
  assets: Partial<Record<K, number | null>>,
  key: K
): number | null {
  const source = assets[key];
  return source ?? null;
}
