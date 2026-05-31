import React, { memo, useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { getWaterSheetCoord } from "../game/overworldSpritesheetLayout";
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

type MapWaterCellsLayerProps = {
  indices: number[];
  cols: number;
  cellSizePx: number;
  /** Mare di bordo: non interattivo salvo modalità Dissalatore. */
  isBorderSea: (index: number) => boolean;
  costruzioneDissalatore: boolean;
  costruzioneActive: boolean;
  onCellPress: (index: number) => void;
  setPreviewCellHover: (index: number | null) => void;
};

/**
 * Layer acqua animata isolato: il tick dei frame non fa re-render della mappa intera.
 */
function MapWaterCellsLayerInner({
  indices,
  cols,
  cellSizePx,
  isBorderSea,
  costruzioneDissalatore,
  costruzioneActive,
  onCellPress,
  setPreviewCellHover
}: MapWaterCellsLayerProps) {
  const [waterAnimFrame, setWaterAnimFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setWaterAnimFrame((n) => (n + 1) % 4), 180);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      {indices.map((cellIndex) => {
        const cellStyle = [
          styles.cella,
          CELLA_SENZA_GRIGLIA,
          styles.cellaFixed,
          { width: cellSizePx, height: cellSizePx },
          cellAbsolutePosition(cellIndex, cols, cellSizePx)
        ];
        const sprite = (
          <TerrainSheetSprite cellSize={cellSizePx} coord={getWaterSheetCoord(waterAnimFrame)} />
        );

        const mareBordo = isBorderSea(cellIndex);
        if (mareBordo && !costruzioneDissalatore) {
          return (
            <View key={`w-${cellIndex}`} style={cellStyle} pointerEvents="none">
              {sprite}
            </View>
          );
        }

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
            key={`w-${cellIndex}`}
            style={cellStyle}
            onPress={() => onCellPress(cellIndex)}
            {...hoverPreviewProps}
          >
            {sprite}
          </Pressable>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  cella: {
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden"
  },
  cellaFixed: {
    boxSizing: "border-box"
  }
});

export const MapWaterCellsLayer = memo(MapWaterCellsLayerInner);
