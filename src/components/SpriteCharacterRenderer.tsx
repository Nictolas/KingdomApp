import React, { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, View } from "react-native";

import { resolveCharacterLayers } from "../character-system/registry";
import { lpcIdleBobPx } from "../character-system/lpcPack";
import { LPC_ASSET_SOURCES } from "../character-system/generated/lpcAssetSources";
import type {
  CharacterAnimationId,
  CharacterAppearance,
  CharacterDirection,
  CharacterLayer,
  ResolvedCharacterLayer
} from "../character-system/types";

const LAYER_ORDER: readonly CharacterLayer[] = [
  "hairBack",
  "body",
  "lowerBody",
  "outfit",
  "fullOutfit",
  "footwear",
  "raceFeatures",
  "ears",
  "beard",
  "cape",
  "hairFront",
  "headwear",
  "neck",
  "facialMask",
  "facialEyes",
  "accessory"
];

function sourceFor(layer: ResolvedCharacterLayer) { return LPC_ASSET_SOURCES[layer.sourceId]; }

export function SpriteCharacterRenderer({
  appearance,
  animation = "idle",
  direction = "down",
  size = 128,
  visibleLayers,
  visibleSemanticIds,
  animate = true,
  offsetY = 0,
  onAssetError,
  onAssetLoad,
  debug = false
}: {
  appearance: CharacterAppearance;
  animation?: CharacterAnimationId;
  direction?: CharacterDirection;
  size?: number;
  visibleLayers?: readonly CharacterLayer[];
  /** Mostra solo l'asset con questo semanticId per ogni layer indicato. */
  visibleSemanticIds?: Partial<Record<CharacterLayer, string>>;
  /** When false, keeps the first idle/walk frame (no bobbing). */
  animate?: boolean;
  /** Shifts the sheet vertically inside the clip; keep within one direction row. */
  offsetY?: number;
  /** The calling portrait can show a race fallback if a network asset fails. */
  onAssetError?: () => void;
  /** Every actual LPC image reports its successful decode. */
  onAssetLoad?: (sourceId: string) => void;
  debug?: boolean;
}) {
  const layers = useMemo(
    () => resolveCharacterLayers(appearance, animation)
      .filter((layer) => {
        if (visibleLayers && !visibleLayers.includes(layer.layer)) return false;
        const semanticId = visibleSemanticIds?.[layer.layer];
        if (semanticId && layer.semanticId !== semanticId) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.zPos !== b.zPos) return a.zPos - b.zPos;
        return LAYER_ORDER.indexOf(a.layer) - LAYER_ORDER.indexOf(b.layer);
      }),
    [appearance, animation, visibleLayers, visibleSemanticIds]
  );
  const definition = layers[0]?.sheet.animations[animation];
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    setFrame(0);
    if (!animate || !definition || !definition.loop || definition.frames < 2) return;
    const timer = setInterval(() => setFrame((value) => (value + 1) % definition.frames), definition.frameDurationMs);
    return () => clearInterval(timer);
  }, [animate, animation, direction, definition]);

  if (!definition || layers.length === 0) return null;
  const frameWidth = layers[0]!.sheet.frameWidth;
  const scale = size / frameWidth;
  const animatedColumn = definition.columns?.[frame] ?? frame;
  const row = definition.directionRows[direction];
  const useTransformIdleBob = animation === "idle" && definition.frames >= 2;
  const idleDownColumn = definition.columns?.[1] ?? definition.columns?.[0] ?? 0;
  const sheetColumn = useTransformIdleBob ? idleDownColumn : animatedColumn;
  const bobOffsetY = useTransformIdleBob && animate && frame === 0
    ? -lpcIdleBobPx(size, frameWidth)
    : 0;

  return (
    <View
      style={[styles.clip, { width: size, height: size }]}
      accessibilityLabel={`Personaggio ${appearance.race}, ${animation}, direzione ${direction}`}
      accessibilityHint={debug ? `lpc; frame ${frame}; ${appearance.bodyFamily}` : undefined}
    >
      <View style={{ transform: [{ translateY: bobOffsetY }] }}>
        {layers.map((layer) => {
          const source = sourceFor(layer);
          if (!source) return null;
          return (
            <Image
              key={`${layer.id}-${layer.layer}`}
              source={source}
              onError={onAssetError}
              onLoad={() => onAssetLoad?.(layer.sourceId)}
              resizeMode="stretch"
              style={{
                position: "absolute",
                width: layer.sheet.columns * layer.sheet.frameWidth * scale,
                height: layer.sheet.rows * layer.sheet.frameHeight * scale,
                left: -sheetColumn * size,
                top: -row * size + offsetY
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { position: "relative", overflow: "hidden" }
});
