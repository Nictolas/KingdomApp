import React from "react";
import { StyleSheet, View } from "react-native";
import { lpcSpriteCircleDiameter } from "../character-system/lpcPack";
import { SpriteCharacterRenderer } from "../components/SpriteCharacterRenderer";
import type { CharacterAnimationId, CharacterAppearance, CharacterDirection, CharacterLayer } from "../character-system/types";

const FRAME_BORDER = 4;

export function CircularSpriteFrame({
  appearance,
  size,
  animation = "idle",
  direction = "down",
  animate = true,
  visibleLayers,
  visibleSemanticIds,
  liftPx = 0,
  /** Ritaglia lo sprite sul volto (zoom sulla testa). */
  faceOnly = false
}: {
  appearance: CharacterAppearance;
  size: number;
  animation?: CharacterAnimationId;
  direction?: CharacterDirection;
  animate?: boolean;
  visibleLayers?: readonly CharacterLayer[];
  visibleSemanticIds?: Partial<Record<CharacterLayer, string>>;
  liftPx?: number;
  faceOnly?: boolean;
}) {
  const diameter = lpcSpriteCircleDiameter(size);
  const outer = diameter + FRAME_BORDER * 2;
  // Zoom sul volto: la testa LPC sta nella parte alta del frame 64×64.
  const zoom = faceOnly ? 2.9 : 1;
  const renderSize = Math.round(size * zoom);
  const left = (diameter - renderSize) / 2;
  // Dall'alto: salta lo spazio vuoto sopra i capelli e inquadra la faccia.
  const top = faceOnly ? Math.round(-renderSize * 0.14) : undefined;
  const bottom = faceOnly ? undefined : liftPx;
  return (
    <View style={[styles.outer, { width: outer, height: outer, borderRadius: outer / 2 }]}>
      <View style={[styles.inner, { width: diameter, height: diameter, borderRadius: diameter / 2 }]}>
        <View
          style={[
            styles.spriteSlot,
            { left, width: renderSize, height: renderSize },
            faceOnly ? { top } : { bottom }
          ]}
        >
          <SpriteCharacterRenderer
            appearance={appearance}
            animation={animation}
            direction={direction}
            size={renderSize}
            animate={animate}
            visibleLayers={visibleLayers}
            visibleSemanticIds={visibleSemanticIds}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: "#0b1220",
    padding: FRAME_BORDER,
    alignItems: "center",
    justifyContent: "center"
  },
  inner: {
    backgroundColor: "#243447",
    overflow: "hidden",
    position: "relative"
  },
  spriteSlot: {
    position: "absolute",
    bottom: 0,
    overflow: "visible"
  }
});
