import React, { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

import { PhaserMapSurface } from "../src/components/PhaserMapSurface";
import { getMappaSessione, subscribeMappaSessione } from "../src/game/mappaSessione";
import type { MappaRuntimeState } from "../src/game/mappaTypes";
import { buildPhaserMapSnapshot } from "../src/phaser/adapters/buildPhaserMapSnapshot";
import { useGameContext } from "../src/context/GameContext";

const COLS = 50;
const ROWS = 50;
const CELL_SIZE = 40;
const EMPTY_PREVIEW_MAP: MappaRuntimeState = {
  edificiInMappa: {
    612: { id: 1, nome: "Centro di Comando", emoji: "", footprint: { w: 3, h: 2 } },
    616: { id: 2, nome: "Serra", emoji: "", footprint: { w: 2, h: 1 } },
    712: { id: 14, nome: "Dormitorio", emoji: "", footprint: { w: 2, h: 2 } },
    714: { id: 14, nome: "Dormitorio", emoji: "", footprintRef: 712 },
    762: { id: 14, nome: "Dormitorio", emoji: "", footprintRef: 712 },
    764: { id: 14, nome: "Dormitorio", emoji: "", footprintRef: 712 }
  },
  terrenoInMappa: {},
  decorazioniInMappa: {},
  residenzeMappa: {}
};

/** Route tecnica temporanea per validare il renderer prima del passaggio della mappa principale. */
export default function MappaPhaserPreviewScreen() {
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const { abitanti } = useGameContext();
  const session = useSyncExternalStore(subscribeMappaSessione, getMappaSessione, getMappaSessione);
  const revisionRef = useRef(0);

  const snapshot = useMemo(() => {
    const source = abitanti.length > 0 ? abitanti.slice(0, 24) : [{ id: 1, nome: "Esploratore", razza: "Umano" as const }];
    const characters = source.map((abitante, order) => {
      const start = (6 + Math.floor(order / 6) * 2) * COLS + 3 + (order % 6) * 3;
      return {
        id: abitante.id,
        name: abitante.nome,
        cell: start,
        path: order < 6 ? [start, start + 1, start + 2, start + COLS + 2] : undefined,
        pathToken: 1,
        markerEmoji: abitante.razza === "Robot" ? "🤖" : undefined
      };
    });
    return buildPhaserMapSnapshot(
      session ?? EMPTY_PREVIEW_MAP,
      COLS,
      ROWS,
      CELL_SIZE,
      ++revisionRef.current,
      characters
    );
  }, [session, abitanti]);

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
