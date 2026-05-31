import React, { memo } from "react";
import { View, Image, StyleSheet, Platform } from "react-native";
import { OVERWORLD_SHEET_PX } from "../game/overworldSpritesheetLayout";

const SPRITESHEET = require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/spritesheet-full.png");

type Props = {
  cellSize: number;
  terrain: "water";
  frame: number;
};

/** Acqua animata dallo spritesheet (unico terreno ancora sul foglio). */
function TerrainSheetSpriteInner({ cellSize, frame }: Props) {
  const { w: sw, h: sh, tile: t } = OVERWORLD_SHEET_PX;
  const scale = cellSize / t;
  const imgW = sw * scale;
  const imgH = sh * scale;

  const f =
    ((frame % OVERWORLD_SHEET_PX.waterFrames) + OVERWORLD_SHEET_PX.waterFrames) %
    OVERWORLD_SHEET_PX.waterFrames;
  const ox = OVERWORLD_SHEET_PX.waterAnimX + f * t;
  const oy = OVERWORLD_SHEET_PX.waterAnimY;

  const left = -ox * scale;
  const top = -oy * scale;

  /**
   * Web + zoom CSS: piccole fessure tra celle o campionamento bilineare sul bordo dello sheet
   * possono mostrare righe scure. Leggero zoom della texture (stesso clip) copre i seam.
   */
  const webBleedK = Platform.OS === "web" ? (cellSize + 2) / cellSize : 1;
  const imgWb = imgW * webBleedK;
  const imgHb = imgH * webBleedK;
  const leftB = left * webBleedK;
  const topB = top * webBleedK;

  return (
    <View style={[styles.clip, { width: cellSize, height: cellSize }]} pointerEvents="none">
      <Image
        source={SPRITESHEET}
        style={[styles.sheet, { width: imgWb, height: imgHb, left: leftB, top: topB }]}
        resizeMode="stretch"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: "hidden",
    position: "absolute",
    left: 0,
    top: 0
  },
  sheet: {
    position: "absolute"
  }
});

export const TerrainSheetSprite = memo(TerrainSheetSpriteInner);
