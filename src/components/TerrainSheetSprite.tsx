import React, { memo } from "react";
import { View, Image, StyleSheet } from "react-native";
import { OVERWORLD_SHEET_PX } from "../game/overworldSpritesheetLayout";
import type { SandWaterDirection } from "../game/terrainSpriteHelpers";

const SPRITESHEET = require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/spritesheet-full.png");

type Props =
  | { cellSize: number; terrain: "water"; frame: number }
  | { cellSize: number; terrain: "grass" }
  | { cellSize: number; terrain: "sand"; waterDirection: SandWaterDirection };

/**
 * Ritaglia una tile 64×64 dallo spritesheet e la scala alla cella (overflow hidden).
 * Sabbia: orientamento in base a dove si trova l’acqua (tile shoreWest / shoreEast + rotazione per N/S).
 */
function TerrainSheetSpriteInner(props: Props) {
  const { w: sw, h: sh, tile: t } = OVERWORLD_SHEET_PX;
  const scale = props.cellSize / t;
  const imgW = sw * scale;
  const imgH = sh * scale;

  let ox: number;
  let oy: number;
  let rotationDeg = 0;

  if (props.terrain === "water") {
    const f = ((props.frame % OVERWORLD_SHEET_PX.waterFrames) + OVERWORLD_SHEET_PX.waterFrames) % OVERWORLD_SHEET_PX.waterFrames;
    ox = OVERWORLD_SHEET_PX.waterAnimX + f * t;
    oy = OVERWORLD_SHEET_PX.waterAnimY;
  } else if (props.terrain === "grass") {
    ox = OVERWORLD_SHEET_PX.grassFill.x;
    oy = OVERWORLD_SHEET_PX.grassFill.y;
  } else {
    const d = props.waterDirection;
    const east = OVERWORLD_SHEET_PX.sandShoreEast;
    const west = OVERWORLD_SHEET_PX.sandShoreWest;
    // shoreEast = schiuma a destra nel PNG → acqua a est della cella
    // shoreWest = schiuma a sinistra nel PNG → acqua a ovest della cella
    if (d === "e") {
      ox = east.x;
      oy = east.y;
    } else if (d === "w") {
      ox = west.x;
      oy = west.y;
    } else if (d === "n") {
      // shoreWest ha schiuma a sinistra: ruotando +90° il bordo acqua va a nord
      ox = west.x;
      oy = west.y;
      rotationDeg = 90;
    } else {
      ox = west.x;
      oy = west.y;
      rotationDeg = -90;
    }
  }

  const left = -ox * scale;
  const top = -oy * scale;

  const imageEl = (
    <Image source={SPRITESHEET} style={[styles.sheet, { width: imgW, height: imgH, left, top }]} resizeMode="stretch" />
  );

  return (
    <View style={[styles.clip, { width: props.cellSize, height: props.cellSize }]} pointerEvents="none">
      {rotationDeg !== 0 ? (
        <View
          style={[
            styles.rotateBox,
            {
              width: props.cellSize,
              height: props.cellSize,
              transform: [{ rotate: `${rotationDeg}deg` }]
            }
          ]}
        >
          {imageEl}
        </View>
      ) : (
        imageEl
      )}
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
  rotateBox: {
    overflow: "hidden"
  },
  sheet: {
    position: "absolute"
  }
});

export const TerrainSheetSprite = memo(TerrainSheetSpriteInner);
