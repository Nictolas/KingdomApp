import React, { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

import { PhaserMapSurface } from "../src/components/PhaserMapSurface";
import { getMappaSessione, subscribeMappaSessione } from "../src/game/mappaSessione";
import type { MappaRuntimeState } from "../src/game/mappaTypes";
import { buildPhaserMapSnapshot } from "../src/phaser/adapters/buildPhaserMapSnapshot";

const COLS = 50;
const ROWS = 50;
const CELL_SIZE = 40;
const EMPTY_PREVIEW_MAP: MappaRuntimeState = {
  edificiInMappa: {},
  terrenoInMappa: {},
  decorazioniInMappa: {},
  residenzeMappa: {}
};

/** Route tecnica temporanea per validare il renderer prima del passaggio della mappa principale. */
export default function MappaPhaserPreviewScreen() {
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const session = useSyncExternalStore(subscribeMappaSessione, getMappaSessione, getMappaSessione);
  const revisionRef = useRef(0);

  const snapshot = useMemo(
    () => buildPhaserMapSnapshot(session ?? EMPTY_PREVIEW_MAP, COLS, ROWS, CELL_SIZE, ++revisionRef.current),
    [session]
  );

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Anteprima renderer Phaser/WebGL</Text>
        <Text style={styles.status}>
          {dragging
            ? "Camera in movimento"
            : selectedCell == null
              ? session
                ? "Mappa reale collegata · seleziona una cella"
                : "Mappa dimostrativa · seleziona una cella"
              : `Cella ${selectedCell}`}
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
