import React, { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, View } from "react-native";

import { resolveCharacterLayers } from "../character-system/registry";
import { CHILD_BEARD_OFFSET_Y_PX, lpcIdleBobPx } from "../character-system/lpcPack";
import { LPC_ASSET_SOURCES } from "../character-system/generated/lpcAssetSources";
import type {
  CharacterAnimationId,
  CharacterAppearance,
  CharacterDirection,
  CharacterLayer,
  ResolvedCharacterLayer,
  SpriteAnimationDefinition
} from "../character-system/types";

const LAYER_ORDER = ["hairBack", "body", "lowerBody", "outfit", "fullOutfit", "footwear", "raceFeatures", "beard", "cape", "hairFront", "headwear", "accessory"] as const;

function sourceFor(layer: ResolvedCharacterLayer) { return LPC_ASSET_SOURCES[layer.sourceId]; }

/** Offset layer in coordinate sheet (prima dello scale). */
function layerSheetOffsetY(appearance: CharacterAppearance, layer: CharacterLayer): number {
  if (layer === "beard" && appearance.bodyType === "child") return CHILD_BEARD_OFFSET_Y_PX;
  return 0;
}

function layerAnimationId(
  layer: ResolvedCharacterLayer,
  animation: CharacterAnimationId
): CharacterAnimationId | null {
  if (layer.sheet.animations[animation]) return animation;
  if (animation === "idle" && layer.sheet.animations.walk) return "walk";
  return null;
}

function primaryAnimationLayer(layers: ResolvedCharacterLayer[], animation: CharacterAnimationId): ResolvedCharacterLayer | undefined {
  return layers.find((layer) => layer.layer === "body" && layerAnimationId(layer, animation))
    ?? layers.find((layer) => layerAnimationId(layer, animation));
}

function sheetColumnForLayer(
  layerAnimation: CharacterAnimationId,
  requestedAnimation: CharacterAnimationId,
  layerDef: SpriteAnimationDefinition,
  frame: number,
  animate: boolean
): number {
  if (layerAnimation === "idle" && requestedAnimation === "idle") {
    const idleDownColumn = layerDef.columns?.[1] ?? layerDef.columns?.[0] ?? 0;
    const useTransformIdleBob = layerDef.frames >= 2;
    return useTransformIdleBob && !animate ? idleDownColumn : (layerDef.columns?.[frame] ?? frame);
  }
  if (layerAnimation === "walk" && requestedAnimation === "idle") {
    return layerDef.columns?.[1] ?? layerDef.columns?.[0] ?? 0;
  }
  return layerDef.columns?.[frame] ?? frame;
}

export function SpriteCharacterRenderer({
  appearance,
  animation = "idle",
  direction = "down",
  size = 128,
  visibleLayers,
  visibleSemanticIds,
  animate = true,
  offsetY = 0,
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
  const primaryLayer = primaryAnimationLayer(layers, animation);
  const primaryAnimId = primaryLayer ? layerAnimationId(primaryLayer, animation) : null;
  const definition = primaryAnimId ? primaryLayer!.sheet.animations[primaryAnimId] : undefined;
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    setFrame(0);
    if (!animate || !definition || !definition.loop || definition.frames < 2) return;
    const timer = setInterval(() => setFrame((value) => (value + 1) % definition.frames), definition.frameDurationMs);
    return () => clearInterval(timer);
  }, [animate, animation, direction, definition]);

  if (!definition || layers.length === 0) return null;
  const frameWidth = primaryLayer!.sheet.frameWidth;
  const scale = size / frameWidth;
  const row = definition.directionRows[direction];
  const useTransformIdleBob = animation === "idle" && primaryAnimId === "idle" && definition.frames >= 2;
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
          const layerAnimId = layerAnimationId(layer, animation);
          const layerDef = layerAnimId ? layer.sheet.animations[layerAnimId] : undefined;
          if (!source || !layerDef) return null;
          const sheetColumn = sheetColumnForLayer(layerAnimId!, animation, layerDef, frame, animate);
          const beardNudgePx = layerSheetOffsetY(appearance, layer.layer) * scale;
          const imageStyle = {
            position: "absolute" as const,
            width: layer.sheet.columns * layer.sheet.frameWidth * scale,
            height: layer.sheet.rows * layer.sheet.frameHeight * scale,
            left: -sheetColumn * size,
            top: -row * size + offsetY
          };
          const image = (
            <Image source={source} resizeMode="stretch" style={imageStyle} />
          );
          // translateY positivo abbassa il layer (Winter Beard sul corpo child).
          if (beardNudgePx === 0) {
            return <React.Fragment key={`${layer.id}-${layer.layer}`}>{image}</React.Fragment>;
          }
          return (
            <View
              key={`${layer.id}-${layer.layer}`}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: size,
                height: size,
                transform: [{ translateY: beardNudgePx }]
              }}
            >
              {image}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { position: "relative", overflow: "hidden" }
});
