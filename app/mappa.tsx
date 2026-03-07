import React, { useCallback, useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { edificiData } from "../src/data/edificiData";
import type { Edificio } from "../src/types";

const GRIGLIA_COLONNE = 24;
const GRIGLIA_RIGHE = 24;
const PADDING = 12;
const GAP = 2;
const MIN_CELL_SIZE = 14;
const DOPPIO_TAP_MS = 400;

/** Indice della cella occupata dal Centro di Comando (centro griglia). */
const CENTRO_COMANDO_INDEX = Math.floor(GRIGLIA_COLONNE * GRIGLIA_RIGHE / 2) - Math.floor(GRIGLIA_COLONNE / 2);
/** Cella occupata dallo Spazioporto (a destra del Centro di Comando). */
const SPAZIOPORTO_INDEX = CENTRO_COMANDO_INDEX + 1;

/** Route per edificio (come in app/edifici). */
const EDIFICIO_TO_ROUTE: Record<string, string> = {
  "Centro di Comando": "/ministri",
  "Serra": "/serra",
  "Centrale Energetica": "/centrale-energetica",
  "Raffineria Mineraria": "/raffineria-mineraria",
  "Impianto di Riciclo": "/impianto-riciclo",
  "Baracca": "/residenze",
  "Scuola": "/scuola",
  "Ospedale Coloniale": "/ospedale",
  "Centrale": "/centrale",
  "Tribunale": "/tribunale",
  "Dissalatore": "/dissalatore",
  "Laboratorio di Ricerca": "/laboratorio",
  "Bar": "/bar",
  "Caserma": "/caserma",
  "Spazioporto": "/spazioporto"
};

type EdificioInCella = { id: number; nome: string; emoji: string };

/** Cella è acqua (blu) se true, altrimenti erba (verde). Per ora solo erba; si può espandere con mappa terreno. */
function isAcqua(_index: number): boolean {
  return false;
}

const edificiIniziali: Record<number, EdificioInCella> = {
  [CENTRO_COMANDO_INDEX]: { id: 1, nome: "Centro di Comando", emoji: "🏛️" },
  [SPAZIOPORTO_INDEX]: { id: 19, nome: "Spazioporto", emoji: "🚀" }
};

export default function MappaScreen() {
  const router = useRouter();
  const [edificiInMappa, setEdificiInMappa] = useState<Record<number, EdificioInCella>>(() => ({
    ...edificiIniziali
  }));
  const [selectedCellForDialog, setSelectedCellForDialog] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const lastTapCell = useRef<number | null>(null);
  const lastTapTime = useRef<number>(0);

  const hScrollRef = useRef<ScrollView>(null);
  const vScrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(0);
  const scrollY = useRef(0);
  const viewportW = useRef(0);
  const viewportH = useRef(0);
  const dragStart = useRef<{ x: number; y: number; scrollX: number; scrollY: number } | null>(null);
  const pointerDownTarget = useRef<HTMLElement | null>(null);
  const didDragThisGesture = useRef(false);

  const { width } = Dimensions.get("window");
  const rawSize = (width - PADDING * 2 - GAP * (GRIGLIA_COLONNE - 1)) / GRIGLIA_COLONNE;
  const size = Math.max(MIN_CELL_SIZE, Math.floor(rawSize));

  const totaleCelle = GRIGLIA_COLONNE * GRIGLIA_RIGHE;
  const gridWidth = GRIGLIA_COLONNE * size + (GRIGLIA_COLONNE - 1) * GAP;
  const gridHeight = GRIGLIA_RIGHE * size + (GRIGLIA_RIGHE - 1) * GAP;
  const contentWidth = gridWidth + PADDING * 2;
  const contentHeight = gridHeight + PADDING * 2;

  const onViewportLayout = useCallback((e: { nativeEvent: { layout: { width: number; height: number } } }) => {
    viewportW.current = e.nativeEvent.layout.width;
    viewportH.current = e.nativeEvent.layout.height;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (Platform.OS !== "web") return;
      didDragThisGesture.current = false;
      pointerDownTarget.current = e.target as HTMLElement;
      const el = e.currentTarget as HTMLElement;
      if (el?.setPointerCapture) el.setPointerCapture(e.pointerId);
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        scrollX: scrollX.current,
        scrollY: scrollY.current
      };
    },
    []
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (Platform.OS !== "web" || !dragStart.current) return;
      didDragThisGesture.current = true;
      setIsDragging(true);
      e.preventDefault();
      const dx = dragStart.current.x - e.clientX;
      const dy = dragStart.current.y - e.clientY;
      const maxX = Math.max(0, contentWidth - viewportW.current);
      const maxY = Math.max(0, contentHeight - viewportH.current);
      const newX = Math.max(0, Math.min(maxX, dragStart.current.scrollX + dx));
      const newY = Math.max(0, Math.min(maxY, dragStart.current.scrollY + dy));
      scrollX.current = newX;
      scrollY.current = newY;
      hScrollRef.current?.scrollTo({ x: newX, animated: false });
      vScrollRef.current?.scrollTo({ y: newY, animated: false });
    },
    [contentWidth, contentHeight]
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (Platform.OS !== "web") return;
    const el = e.currentTarget as HTMLElement;
    if (el?.releasePointerCapture) el.releasePointerCapture(e.pointerId);
    if (!didDragThisGesture.current && pointerDownTarget.current) {
      pointerDownTarget.current.click();
    }
    pointerDownTarget.current = null;
    dragStart.current = null;
    didDragThisGesture.current = false;
    setIsDragging(false);
  }, []);

  const onPointerLeave = useCallback(() => {
    dragStart.current = null;
    setIsDragging(false);
  }, []);

  const openRouteForEdificio = useCallback(
    (nome: string) => {
      const route = EDIFICIO_TO_ROUTE[nome];
      if (route) router.push(route);
    },
    [router]
  );

  const onCellPress = useCallback(
    (cellIndex: number) => {
      const now = Date.now();
      const edificio = edificiInMappa[cellIndex];
      const isDoubleTap = lastTapCell.current === cellIndex && now - lastTapTime.current < DOPPIO_TAP_MS;
      if (isDoubleTap) {
        lastTapCell.current = null;
        if (edificio) {
          openRouteForEdificio(edificio.nome);
        } else {
          setSelectedCellForDialog(cellIndex);
        }
        return;
      }
      lastTapCell.current = cellIndex;
      lastTapTime.current = now;
    },
    [edificiInMappa, openRouteForEdificio]
  );

  const handleScegliEdificio = useCallback(
    (cellIndex: number, e: Edificio) => {
      setEdificiInMappa((prev) => ({
        ...prev,
        [cellIndex]: { id: e.id, nome: e.nome, emoji: e.emoji }
      }));
      setSelectedCellForDialog(null);
    },
    []
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Indietro
        </Text>
        <Text style={styles.title}>Mappa</Text>
        <View style={{ width: 60 }} />
      </View>

      <View
        style={[
          styles.viewport,
          Platform.OS === "web" && (isDragging ? styles.viewportWebGrabbing : styles.viewportWeb)
        ]}
        onLayout={onViewportLayout}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
      >
        <ScrollView
          ref={hScrollRef}
          style={styles.viewport}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ width: contentWidth, height: "100%" }}
          onScroll={(e) => { scrollX.current = e.nativeEvent.contentOffset.x; }}
          scrollEventThrottle={16}
        >
          <ScrollView
            ref={vScrollRef}
            style={[styles.viewportInner, { width: contentWidth }]}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ width: contentWidth, height: contentHeight }}
            bounces={false}
            onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
            scrollEventThrottle={16}
          >
          <View style={[styles.contentWrap, { padding: PADDING }]}>
            <View style={[styles.griglia, { gap: GAP, width: gridWidth }]}>
            {Array.from({ length: totaleCelle }, (_, i) => {
              const acqua = isAcqua(i);
              const edificio = edificiInMappa[i];
              const emoji = edificio?.emoji ?? null;
              const hasEdificio = !!edificio;
              const cellStyle = [
                styles.cella,
                acqua ? styles.cellaAcqua : styles.cellaErba,
                { width: size, height: size },
                hasEdificio && styles.cellaEdificio
              ];
              const content = emoji ? (
                <Text style={[styles.edificioEmoji, { fontSize: Math.max(10, Math.min(22, size - 4)) }]}>
                  {emoji}
                </Text>
              ) : null;
              if (acqua) {
                return <View key={i} style={cellStyle} />;
              }
              return (
                <Pressable key={i} style={cellStyle} onPress={() => onCellPress(i)}>
                  {content}
                </Pressable>
              );
            })}
            </View>
          </View>
          </ScrollView>
        </ScrollView>
      </View>

      <Modal
        visible={selectedCellForDialog !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedCellForDialog(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedCellForDialog(null)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Quale edificio vuoi inserire qui?</Text>
            <ScrollView style={styles.modalList} nestedScrollEnabled>
              {edificiData.map((e) => (
                <Pressable
                  key={e.id}
                  style={styles.modalOption}
                  onPress={() => selectedCellForDialog !== null && handleScegliEdificio(selectedCellForDialog, e)}
                >
                  <Text style={styles.modalOptionEmoji}>{e.emoji}</Text>
                  <Text style={styles.modalOptionNome}>{e.nome}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.modalCancel} onPress={() => setSelectedCellForDialog(null)}>
              <Text style={styles.modalCancelText}>Annulla</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#2d5a27",
    userSelect: "none"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.6)",
    backgroundColor: "#050816"
  },
  back: {
    color: "#93c5fd",
    fontSize: 12
  },
  title: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700"
  },
  viewport: {
    flex: 1,
    backgroundColor: "#2d5a27"
  },
  viewportWeb: {
    cursor: "grab"
  },
  viewportWebGrabbing: {
    cursor: "grabbing"
  },
  viewportInner: {
    flex: 1
  },
  contentWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "flex-start"
  },
  griglia: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "flex-start"
  },
  cella: {
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.15)",
    justifyContent: "center",
    alignItems: "center"
  },
  cellaErba: {
    backgroundColor: "#3d7c47"
  },
  cellaAcqua: {
    backgroundColor: "#2c5282"
  },
  cellaEdificio: {
    backgroundColor: "rgba(234,179,8,0.25)",
    borderColor: "rgba(234,179,8,0.7)"
  },
  edificioEmoji: {
    fontSize: 18
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24
  },
  modalContent: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 16,
    maxWidth: 400,
    width: "100%",
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)"
  },
  modalTitle: {
    color: "#e5e7eb",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center"
  },
  modalList: {
    maxHeight: 320
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: "rgba(15,23,42,0.8)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)"
  },
  modalOptionEmoji: {
    fontSize: 22,
    marginRight: 10
  },
  modalOptionNome: {
    color: "#e5e7eb",
    fontSize: 14,
    fontWeight: "600",
    flex: 1
  },
  modalCancel: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: "center"
  },
  modalCancelText: {
    color: "#93c5fd",
    fontSize: 14
  }
});
