import React, { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { PhaserMapSurface } from "../src/components/PhaserMapSurface";
import { getMappaSessione, subscribeMappaSessione } from "../src/game/mappaSessione";
import type { MappaRuntimeState } from "../src/game/mappaTypes";
import { buildPhaserMapSnapshot } from "../src/phaser/adapters/buildPhaserMapSnapshot";
import { useGameContext } from "../src/context/GameContext";
import type { PhaserMapInteraction } from "../src/phaser/adapters/mapSceneBridge";

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
  const [hoverCell, setHoverCell] = useState<number | null>(null);
  const [mode, setMode] = useState<PhaserMapInteraction["mode"]>("select");
  const [demoMap, setDemoMap] = useState<MappaRuntimeState>(EMPTY_PREVIEW_MAP);
  const [dragging, setDragging] = useState(false);
  const { abitanti } = useGameContext();
  const session = useSyncExternalStore(subscribeMappaSessione, getMappaSessione, getMappaSessione);
  const revisionRef = useRef(0);

  const activeMap = session ?? demoMap;
  const interaction = useMemo<PhaserMapInteraction>(() => {
    if (hoverCell == null || mode === "select") {
      return { mode, hoverCell, affectedCells: hoverCell == null ? [] : [hoverCell], valid: hoverCell != null };
    }
    if (mode === "demolish") {
      const target = activeMap.edificiInMappa[hoverCell];
      const anchor = target?.footprintRef ?? hoverCell;
      const building = activeMap.edificiInMappa[anchor];
      return {
        mode,
        hoverCell,
        affectedCells: building
          ? Object.entries(activeMap.edificiInMappa)
              .filter(([index, value]) => Number(index) === anchor || value.footprintRef === anchor)
              .map(([index]) => Number(index))
          : [hoverCell],
        valid: Boolean(building)
      };
    }
    const col = hoverCell % COLS;
    const row = Math.floor(hoverCell / COLS);
    const cells = [hoverCell, hoverCell + 1, hoverCell + COLS, hoverCell + COLS + 1];
    const valid = col < COLS - 1 && row < ROWS - 1 && cells.every((cell) => !activeMap.edificiInMappa[cell]);
    return { mode, hoverCell, affectedCells: cells.filter((cell) => cell < COLS * ROWS), valid };
  }, [activeMap, hoverCell, mode]);

  const handleCellPress = useCallback((cell: number) => {
    setSelectedCell(cell);
    if (session || mode === "select" || !interaction.valid) return;
    if (mode === "demolish") {
      setDemoMap((current) => {
        const target = current.edificiInMappa[cell];
        const anchor = target?.footprintRef ?? cell;
        if (!current.edificiInMappa[anchor]) return current;
        const edificiInMappa = { ...current.edificiInMappa };
        for (const [index, value] of Object.entries(edificiInMappa)) {
          if (Number(index) === anchor || value.footprintRef === anchor) delete edificiInMappa[Number(index)];
        }
        return { ...current, edificiInMappa };
      });
      return;
    }
    setDemoMap((current) => {
      const occupied = interaction.affectedCells;
      if (occupied.some((index) => current.edificiInMappa[index])) return current;
      const edificiInMappa = { ...current.edificiInMappa };
      edificiInMappa[cell] = { id: Date.now(), nome: "Avamposto Phaser", emoji: "🏗️", footprint: { w: 2, h: 2 } };
      for (const index of occupied.slice(1)) {
        edificiInMappa[index] = { id: edificiInMappa[cell].id, nome: "Avamposto Phaser", emoji: "🏗️", footprintRef: cell };
      }
      return { ...current, edificiInMappa };
    });
  }, [interaction, mode, session]);

  const characters = useMemo(() => {
    const source = abitanti.length > 0 ? abitanti.slice(0, 24) : [{ id: 1, nome: "Esploratore", razza: "Umano" as const }];
    return source.map((abitante, order) => {
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
  }, [abitanti]);
  const baseSnapshot = useMemo(() => buildPhaserMapSnapshot(
      activeMap,
      COLS,
      ROWS,
      CELL_SIZE,
      ++revisionRef.current
    ), [activeMap]);
  const snapshot = useMemo(
    () => ({ ...baseSnapshot, characters, interaction }),
    [baseSnapshot, characters, interaction]
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
      <View style={styles.toolbar}>
        {(["select", "build", "demolish"] as const).map((item) => (
          <Pressable key={item} onPress={() => setMode(item)} style={[styles.tool, mode === item && styles.toolActive]}>
            <Text style={styles.toolText}>{item === "select" ? "👆 Seleziona" : item === "build" ? "🏗️ Costruisci 2×2" : "🧨 Demolisci"}</Text>
          </Pressable>
        ))}
        {session ? <Text style={styles.readOnly}>Mappa reale: anteprima sola lettura</Text> : null}
      </View>
      <View style={styles.map}>
        <PhaserMapSurface
          snapshot={snapshot}
          onCellPress={handleCellPress}
          onCellHover={setHoverCell}
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
  map: { flex: 1, minHeight: 200, position: "relative", overflow: "hidden" },
  toolbar: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#0f172a", alignItems: "center" },
  tool: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: "#1e293b" },
  toolActive: { backgroundColor: "#2563eb" },
  toolText: { color: "#f8fafc", fontSize: 12, fontWeight: "700" },
  readOnly: { color: "#fbbf24", fontSize: 11 }
});
