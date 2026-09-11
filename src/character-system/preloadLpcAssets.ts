import { Asset } from "expo-asset";
import { Image, Platform } from "react-native";

import { LPC_ASSET_SOURCES } from "./generated/lpcAssetSources";
import { canRenderCharacter, resolveCharacterLayers } from "./registry";
import type { CharacterAppearance } from "./types";

export function collectLpcSourceIdsForAppearance(
  appearance: CharacterAppearance | undefined | null,
  animations: readonly ("idle" | "walk")[] = ["idle", "walk"]
): string[] {
  if (!appearance) return [];
  const ids = new Set<string>();
  for (const animation of animations) {
    if (!canRenderCharacter(appearance, animation)) continue;
    for (const layer of resolveCharacterLayers(appearance, animation)) ids.add(layer.sourceId);
  }
  return [...ids];
}

/** Su web, forza decode in cache browser (stesso URL usato da RN Image). */
function preloadUriInBrowser(uri: string): Promise<void> {
  if (Platform.OS !== "web" || typeof window === "undefined") return Promise.resolve();
  const BrowserImage = window.Image;
  if (!BrowserImage) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new BrowserImage();
    img.decoding = "async";
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = uri;
  });
}

export async function warmLpcSourceIds(sourceIds: readonly string[]): Promise<void> {
  await Promise.all(
    sourceIds.map(async (sourceId) => {
      const source = LPC_ASSET_SOURCES[sourceId as keyof typeof LPC_ASSET_SOURCES];
      if (!source) return;
      const asset = Asset.fromModule(source);
      try {
        await asset.downloadAsync();
      } catch {
        /* ok */
      }
      const uri = asset.localUri ?? asset.uri;
      if (!uri) return;
      // Stesso pipeline di React Native Image (web/native).
      if (typeof Image.prefetch === "function") {
        try {
          await Image.prefetch(uri);
        } catch {
          /* ok */
        }
      }
      await preloadUriInBrowser(uri);
    })
  );
}
