import React, { useMemo, useState } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

import { PhaserMapSurface } from "../src/components/PhaserMapSurface";
import { OVERWORLD_SHEET_PX } from "../src/game/overworldSpritesheetLayout";
import type { PhaserMapSnapshot } from "../src/phaser/adapters/mapSceneBridge";

const COLS = 50;
const ROWS = 50;
const CELL_SIZE = 40;

/** Route tecnica temporanea per validare il renderer prima del passaggio della mappa principale. */
export default function MappaPhaserPreviewScreen() {
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const snapshot = useMemo<PhaserMapSnapshot>(() => {
    const tiles = Array.from({ length: COLS * ROWS }, (_, index) => {
      const col = index % COLS;
      const row = Math.floor(index / COLS);
      const border = col === 0 || row === 0 || col === COLS - 1 || row === ROWS - 1;
      return {
        index,
        frameX: border ? OVERWORLD_SHEET_PX.waterAnimX : 64,
        frameY: border ? OVERWORLD_SHEET_PX.waterAnimY : 128
      };
    });
    return { cols: COLS, rows: ROWS, cellSize: CELL_SIZE, tiles, revision: 1 };
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Anteprima renderer Phaser/WebGL</Text>
        <Text style={styles.status}>
          {dragging ? "Camera in movimento" : selectedCell == null ? "Seleziona una cella" : `Cella ${selectedCell}`}
        </Text>
      </View>
      <View style={styles.map}>
        <PhaserMapSurface
          snapshot={snapshot}
          onCellPress={setSelectedCell}
          onDragStateChange={setDragging}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050816" },
  header: {
    minHeight: 64,
    paddingHorizontal: 18,
    paddingVertical: 10,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.25)"
  },
  title: { color: "#f8fafc", fontSize: 18, fontWeight: "800" },
  status: { color: "#93c5fd", fontSize: 13, marginTop: 3 },
  map: { flex: 1, minHeight: 200, position: "relative", overflow: "hidden" }
});
