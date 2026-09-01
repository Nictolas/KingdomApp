import React, { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, View } from "react-native";

import { resolveCharacterLayers } from "../character-system/registry";
import { LPC_ASSET_SOURCES } from "../character-system/generated/lpcAssetSources";
import type {
  CharacterAnimationId,
  CharacterAppearance,
  CharacterDirection,
  ResolvedCharacterLayer
} from "../character-system/types";

const LAYER_ORDER = ["hairBack", "body", "lowerBody", "outfit", "raceFeatures", "beard", "hairFront", "headwear", "accessory"] as const;

function sourceFor(layer: ResolvedCharacterLayer) { return LPC_ASSET_SOURCES[layer.sourceId]; }

export function SpriteCharacterRenderer({
  appearance,
  animation = "idle",
  direction = "down",
  size = 128,
  debug = false
}: {
  appearance: CharacterAppearance;
  animation?: CharacterAnimationId;
  direction?: CharacterDirection;
  size?: number;
  debug?: boolean;
}) {
  const layers = useMemo(
    () => resolveCharacterLayers(appearance, animation).sort((a, b) => LAYER_ORDER.indexOf(a.layer) - LAYER_ORDER.indexOf(b.layer)),
    [appearance, animation]
  );
  const definition = layers[0]?.sheet.animations[animation];
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    setFrame(0);
    if (!definition || !definition.loop || definition.frames < 2) return;
    const timer = setInterval(() => setFrame((value) => (value + 1) % definition.frames), definition.frameDurationMs);
    return () => clearInterval(timer);
  }, [definition]);

  if (!definition || layers.length === 0) return null;
  const scale = size / layers[0]!.sheet.frameWidth;
  const column = definition.columns?.[frame] ?? frame;
  const row = definition.directionRows[direction];

  return (
    <View
      style={[styles.clip, { width: size, height: size }]}
      accessibilityLabel={`Personaggio ${appearance.race}, ${animation}, direzione ${direction}`}
      accessibilityHint={debug ? `lpc; frame ${frame}; ${appearance.bodyFamily}` : undefined}
    >
      {layers.map((layer) => {
        const source = sourceFor(layer);
        if (!source) return null;
        return (
          <Image
            key={`${layer.id}-${layer.layer}`}
            source={source}
            resizeMode="stretch"
            style={{
              position: "absolute",
              width: layer.sheet.columns * layer.sheet.frameWidth * scale,
              height: layer.sheet.rows * layer.sheet.frameHeight * scale,
              left: -column * size,
              top: -row * size
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { position: "relative", overflow: "hidden" }
});
