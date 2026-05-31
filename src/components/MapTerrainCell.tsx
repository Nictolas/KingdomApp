import React, { memo } from "react";
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { TerrenoType } from "../game/riverGeneration";
import {
  getErbaDecorSheetCoord,
  getErbaSheetCoord,
  getErbaSpiaggiaSheetCoord,
  getSpiaggiaSheetCoord,
  getStradaSheetCoord
} from "../game/overworldSpritesheetLayout";
import type {
  ErbaExtraDecorKind,
  ErbaSpiaggiaTileAsset1x1,
  ErbaTileAsset1x1,
  SpiaggiaTileAsset1x1,
  StradaTileAsset1x1
} from "../game/terrainSpriteHelpers";
import { MissingTile1x1 } from "./MissingTile1x1";
import { TerrainSheetSprite } from "./TerrainSheetSprite";

const CELLA_SENZA_GRIGLIA: ViewStyle = Platform.select<ViewStyle>({
  web: {
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 0,
    outlineWidth: 0,
    outlineStyle: "none",
    boxShadow: "none"
  },
  default: {
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 0
  }
}) as ViewStyle;

function cellAbsolutePosition(index: number, cols: number, cellPx: number): ViewStyle {
  return {
    position: "absolute",
    left: (index % cols) * cellPx,
    top: Math.floor(index / cols) * cellPx
  };
}

type EdificioInCella = {
  nome: string;
  emoji: string;
  footprintRef?: number;
  footprint?: { w: number; h: number };
};

export type MapTerrainCellProps = {
  cellIndex: number;
  cols: number;
  cellSizePx: number;
  terreno: TerrenoType;
  edificio: EdificioInCella | undefined;
  overlayEmoji: string | null;
  erbaAsset: ErbaTileAsset1x1 | undefined;
  erbaSpiaggiaAsset: ErbaSpiaggiaTileAsset1x1 | undefined;
  stradaAsset: StradaTileAsset1x1 | undefined;
  spiaggiaAsset: SpiaggiaTileAsset1x1 | undefined;
  erbaDecor: ErbaExtraDecorKind | null;
  mostraGrigliaMappa: boolean;
  costruzioneActive: boolean;
  onCellPress: (index: number) => void;
  setPreviewCellHover: (index: number | null) => void;
};

function MapTerrainCellInner({
  cellIndex,
  cols,
  cellSizePx,
  terreno,
  edificio,
  overlayEmoji,
  erbaAsset,
  erbaSpiaggiaAsset,
  stradaAsset,
  spiaggiaAsset,
  erbaDecor,
  mostraGrigliaMappa,
  costruzioneActive,
  onCellPress,
  setPreviewCellHover
}: MapTerrainCellProps) {
  const èStrada = edificio?.nome === "Strada";
  const hasEdificio = !!edificio;

  const cellStyle = [
    styles.cella,
    Platform.OS === "web"
      ? CELLA_SENZA_GRIGLIA
      : mostraGrigliaMappa
        ? styles.cellaGrigliaOn
        : CELLA_SENZA_GRIGLIA,
    styles.cellaFixed,
    styles.cellaTextureTerreno,
    { width: cellSizePx, height: cellSizePx },
    hasEdificio && !èStrada && styles.cellaEdificio,
    cellAbsolutePosition(cellIndex, cols, cellSizePx)
  ];

  const spriteTerreno =
    terreno === "sabbia" ? (
      <TerrainSheetSprite
        cellSize={cellSizePx}
        coord={getSpiaggiaSheetCoord(spiaggiaAsset ?? "centro")}
      />
    ) : èStrada && stradaAsset ? (
      <TerrainSheetSprite cellSize={cellSizePx} coord={getStradaSheetCoord(stradaAsset)} />
    ) : erbaSpiaggiaAsset ? (
      <TerrainSheetSprite cellSize={cellSizePx} coord={getErbaSpiaggiaSheetCoord(erbaSpiaggiaAsset)} />
    ) : terreno === "erba" && !èStrada ? (
      <>
        <TerrainSheetSprite
          cellSize={cellSizePx}
          coord={getErbaSheetCoord(erbaAsset ?? "centro")}
        />
        {erbaDecor ? (
          <View style={[styles.decorWrap, { width: cellSizePx, height: cellSizePx }]} pointerEvents="none">
            <TerrainSheetSprite
              cellSize={cellSizePx * 0.88}
              coord={getErbaDecorSheetCoord(erbaDecor)}
            />
          </View>
        ) : null}
      </>
    ) : (
      <MissingTile1x1 cellSize={cellSizePx} />
    );

  const emojiEl = overlayEmoji ? (
    <Text
      style={[styles.edificioEmoji, { fontSize: Math.max(10, Math.min(22, cellSizePx - 4)) }]}
      pointerEvents="none"
    >
      {overlayEmoji}
    </Text>
  ) : null;

  const hoverPreviewProps =
    costruzioneActive && Platform.OS === "web"
      ? {
          onPressIn: () => setPreviewCellHover(cellIndex),
          onPointerEnter: () => setPreviewCellHover(cellIndex)
        }
      : costruzioneActive
        ? { onPressIn: () => setPreviewCellHover(cellIndex) }
        : {};

  return (
    <Pressable
      style={cellStyle}
      onPress={() => onCellPress(cellIndex)}
      {...hoverPreviewProps}
    >
      {spriteTerreno}
      {emojiEl}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cella: {
    justifyContent: "center",
    alignItems: "center"
  },
  cellaGrigliaOn: {
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.15)"
  },
  cellaFixed: {
    boxSizing: "border-box"
  },
  cellaTextureTerreno: {
    backgroundColor: "transparent",
    overflow: "hidden",
    position: "relative"
  },
  cellaEdificio: {},
  edificioEmoji: {
    position: "absolute",
    zIndex: 2,
    fontSize: 18
  },
  decorWrap: {
    position: "absolute",
    left: 0,
    top: 0,
    justifyContent: "flex-end",
    alignItems: "center",
    zIndex: 1
  }
});

export const MapTerrainCell = memo(MapTerrainCellInner);
