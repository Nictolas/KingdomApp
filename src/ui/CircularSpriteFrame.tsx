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
  liftPx = 0
}: {
  appearance: CharacterAppearance;
  size: number;
  animation?: CharacterAnimationId;
  direction?: CharacterDirection;
  animate?: boolean;
  visibleLayers?: readonly CharacterLayer[];
  visibleSemanticIds?: Partial<Record<CharacterLayer, string>>;
  liftPx?: number;
}) {
  const diameter = lpcSpriteCircleDiameter(size);
  const outer = diameter + FRAME_BORDER * 2;
  return (
    <View style={[styles.outer, { width: outer, height: outer, borderRadius: outer / 2 }]}>
      <View style={[styles.inner, { width: diameter, height: diameter, borderRadius: diameter / 2 }]}>
        <View style={[styles.spriteSlot, { left: (diameter - size) / 2, width: size, bottom: liftPx }]}>
          <SpriteCharacterRenderer
            appearance={appearance}
            animation={animation}
            direction={direction}
            size={size}
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
