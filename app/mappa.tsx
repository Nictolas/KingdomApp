import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { useGameContext } from "../src/context/GameContext";
import type { Edificio, Risorsa } from "../src/types";

const GRIGLIA_COLONNE = 24;
const GRIGLIA_RIGHE = 24;
const PADDING = 12;
const GAP = 2;
const MIN_CELL_SIZE = 14;
const DOPPIO_TAP_MS = 400;
const STRADA_SPESSORE = 6;
const STRADA_COLORE = "#78716c";
const STRADA_CERCHIO_RAGGIO = 5;

/** Indice della cella occupata dal Centro di Comando (centro griglia). */
const CENTRO_COMANDO_INDEX = Math.floor(GRIGLIA_COLONNE * GRIGLIA_RIGHE / 2) - Math.floor(GRIGLIA_COLONNE / 2);
/** Cella occupata dallo Spazioporto (a destra del Centro di Comando). */
const SPAZIOPORTO_INDEX = CENTRO_COMANDO_INDEX + 1;
/** Cella occupata dal Tribunale (sotto il Centro di Comando). */
const TRIBUNALE_INDEX = CENTRO_COMANDO_INDEX + GRIGLIA_COLONNE;
/** Cella occupata dalla Serra (a sinistra del Centro di Comando). */
const SERRA_INDEX = CENTRO_COMANDO_INDEX - 1;
/** Celle occupate dai tre Dormitori. */
const DORMITORIO_1_INDEX = CENTRO_COMANDO_INDEX + 2;
const DORMITORIO_2_INDEX = CENTRO_COMANDO_INDEX - GRIGLIA_COLONNE;
const DORMITORIO_3_INDEX = CENTRO_COMANDO_INDEX + GRIGLIA_COLONNE + 1;

/** Route per edificio (come in app/edifici). */
const EDIFICIO_TO_ROUTE: Record<string, string> = {
  "Centro di Comando": "/amministrazione",
  "Serra": "/serra",
  "Centrale Energetica": "/centrale-energetica",
  "Raffineria Mineraria": "/raffineria-mineraria",
  "Impianto di Riciclo": "/impianto-riciclo",
  "Baracca": "/residenze",
  "Capanna": "/residenze",
  "Dormitorio": "/residenze",
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

/** Cella è acqua (blu) se true, altrimenti erba (verde). Bordi della mappa = mare. */
function isAcqua(index: number): boolean {
  const row = Math.floor(index / GRIGLIA_COLONNE);
  const col = index % GRIGLIA_COLONNE;
  return (
    row === 0 ||
    row === GRIGLIA_RIGHE - 1 ||
    col === 0 ||
    col === GRIGLIA_COLONNE - 1
  );
}

const GIACIMENTO: EdificioInCella = { id: 0, nome: "Giacimento", emoji: "⛰️" };
const RAFFINERIA_MINERARIA: EdificioInCella = { id: 3, nome: "Raffineria Mineraria", emoji: "⚙️" };
/** Opzione "Strada" per il dialog costruzione (cella diventa lastricato strada). */
const STRADA_OPZIONE: EdificioInCella = { id: -1, nome: "Strada", emoji: "🛤️" };

const DORMITORIO: EdificioInCella = { id: 14, nome: "Dormitorio", emoji: "🛏️" };
const CAPANNA: EdificioInCella = { id: 20, nome: "Capanna", emoji: "⛺" };

const edificiIniziali: Record<number, EdificioInCella> = {
  [CENTRO_COMANDO_INDEX]: { id: 1, nome: "Centro di Comando", emoji: "🏛️" },
  [SPAZIOPORTO_INDEX]: { id: 19, nome: "Spazioporto", emoji: "🚀" },
  [TRIBUNALE_INDEX]: { id: 12, nome: "Tribunale", emoji: "⚖️" },
  [SERRA_INDEX]: { id: 2, nome: "Serra", emoji: "🌱" },
  [DORMITORIO_1_INDEX]: DORMITORIO,
  [DORMITORIO_2_INDEX]: DORMITORIO,
  [DORMITORIO_3_INDEX]: DORMITORIO
};

const TOTALE_CELLE = GRIGLIA_COLONNE * GRIGLIA_RIGHE;

/** Restituisce lo stato iniziale della mappa con 5–9 Capanne e 2–5 Giacimenti casuali su erba libera. */
function getInitialEdificiInMappa(): Record<number, EdificioInCella> {
  const occupate = new Set<number>(Object.keys(edificiIniziali).map(Number));
  const erbaLibera: number[] = [];
  for (let i = 0; i < TOTALE_CELLE; i++) {
    if (!isAcqua(i) && !occupate.has(i)) erbaLibera.push(i);
  }
  const shuffled = [...erbaLibera].sort(() => Math.random() - 0.5);
  const nCapanne = 5 + Math.floor(Math.random() * 5); // 5–9
  const nGiacimento = 2 + Math.floor(Math.random() * 4);
  const celleCapanne = shuffled.slice(0, Math.min(nCapanne, shuffled.length));
  const celleGiacimento = shuffled.slice(nCapanne, nCapanne + Math.min(nGiacimento, Math.max(0, shuffled.length - nCapanne)));
  const capanne: Record<number, EdificioInCella> = {};
  celleCapanne.forEach((i) => (capanne[i] = CAPANNA));
  const giacimenti: Record<number, EdificioInCella> = {};
  celleGiacimento.forEach((i) => (giacimenti[i] = GIACIMENTO));
  return { ...edificiIniziali, ...capanne, ...giacimenti };
}

/** Coppie [indiceA, indiceB] di celle tra cui disegnare una strada (centro → centro). */
const STRADE_INIZIALI: [number, number][] = [
  [CENTRO_COMANDO_INDEX, SPAZIOPORTO_INDEX],
  [CENTRO_COMANDO_INDEX, TRIBUNALE_INDEX],
  [CENTRO_COMANDO_INDEX, SERRA_INDEX]
];

function getCellCenter(cellIndex: number, size: number): { x: number; y: number } {
  const col = cellIndex % GRIGLIA_COLONNE;
  const row = Math.floor(cellIndex / GRIGLIA_COLONNE);
  const x = PADDING + col * (size + GAP) + size / 2;
  const y = PADDING + row * (size + GAP) + size / 2;
  return { x, y };
}

/** Vicini ortogonali (su, giù, sinistra, destra) con controlli sui bordi. */
function getViciniOrtogonali(index: number): number[] {
  const col = index % GRIGLIA_COLONNE;
  const row = Math.floor(index / GRIGLIA_COLONNE);
  const out: number[] = [];
  if (row > 0) out.push(index - GRIGLIA_COLONNE);
  if (row < GRIGLIA_RIGHE - 1) out.push(index + GRIGLIA_COLONNE);
  if (col > 0) out.push(index - 1);
  if (col < GRIGLIA_COLONNE - 1) out.push(index + 1);
  return out;
}

function getResourceEmoji(r: Risorsa): string {
  const n = r.nome.toLowerCase();
  if (n.includes("crediti")) return "💰";
  if (n.includes("cibo")) return "🍱";
  if (n.includes("energia")) return "⚡";
  if (n.includes("acqua")) return "💧";
  if (n.includes("materiale edile")) return "🧱";
  if (n.includes("medicine")) return "💊";
  if (n.includes("combustibile")) return "⛽";
  if (n.includes("rifiuti")) return "🗑️";
  return "⛏️";
}

function getResourceRoute(r: Risorsa): string | null {
  const n = r.nome.toLowerCase();
  if (n.includes("cibo")) return "/cibo";
  if (n.includes("crediti")) return "/crediti";
  if (n.includes("energia")) return "/energia";
  if (n.includes("acqua")) return "/acqua";
  if (n.includes("rifiuti")) return "/rifiuti";
  return null;
}

export default function MappaScreen() {
  const router = useRouter();
  const { risorse, abitanti, mese, anno, isLoading, avanzaMese, calcolaProduzioneConsumo, calcolaDeltaOrdiniMercato, calcolaFelicitàModificata } = useGameContext();
  const variazioni = calcolaProduzioneConsumo();
  const deltaOrdini = calcolaDeltaOrdiniMercato();

  const abitantiConFelicità = abitanti.filter((a) => a.razza !== "Robot");
  const nConFelicità = abitantiConFelicità.length;
  const felicitàMedia = nConFelicità ? Math.round(abitantiConFelicità.reduce((s, a) => s + calcolaFelicitàModificata(a), 0) / nConFelicità) : 0;
  const nConLealtàPaura = abitantiConFelicità.length;
  const lealtàMedia = nConLealtàPaura ? Math.round(abitantiConFelicità.reduce((s, a) => s + a.lealtà, 0) / nConLealtàPaura) : 0;
  const pauraMedia = nConLealtàPaura ? Math.round(abitantiConFelicità.reduce((s, a) => s + a.paura, 0) / nConLealtàPaura) : 0;

  const [edificiInMappa, setEdificiInMappa] = useState<Record<number, EdificioInCella>>(
    getInitialEdificiInMappa
  );
  const [selectedCellForDialog, setSelectedCellForDialog] = useState<number | null>(null);
  const [selectedCellForTransformDialog, setSelectedCellForTransformDialog] = useState<number | null>(
    null
  );
  const [isDragging, setIsDragging] = useState(false);
  const lastTapCell = useRef<number | null>(null);
  const lastTapTime = useRef<number>(0);

  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
        document.documentElement.style.overflow = "";
      };
    }
  }, []);

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
          if (edificio.nome === "Giacimento") {
            setSelectedCellForTransformDialog(cellIndex);
          } else {
            openRouteForEdificio(edificio.nome);
          }
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

  const handleTrasformaGiacimento = useCallback((cellIndex: number) => {
    setEdificiInMappa((prev) => ({
      ...prev,
      [cellIndex]: RAFFINERIA_MINERARIA
    }));
    setSelectedCellForTransformDialog(null);
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Indietro
        </Text>
        <Text style={styles.title}>Mappa</Text>
        <Pressable style={styles.menuBtn} onPress={() => router.push("/menu")}>
          <Text style={styles.menuBtnText}>Menu</Text>
        </Pressable>
      </View>

      {/* Banner in alto: MyKingdom a sinistra + Mese/Anno, Diario, Skip Mese, Felicità, Lealtà, Paura */}
      <View style={styles.topBanner}>
        <View style={styles.topBannerInner}>
          <View style={styles.bannerTitleBlock}>
            <Text style={styles.bannerTitleEmoji}>🏰</Text>
            <View>
              <Text style={styles.bannerTitle}>MyKingdom</Text>
              <Text style={styles.bannerSubtitle}>Gestisci la tua colonia</Text>
            </View>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>📅 Mese {mese}</Text>
            <Text style={styles.badgeText}>· Anno {anno}</Text>
          </View>
          <Pressable style={styles.diarioBtn} onPress={() => router.push("/diario")}>
            <Text style={styles.diarioBtnEmoji}>📖</Text>
            <Text style={styles.diarioBtnLabel}>Diario</Text>
          </Pressable>
          <Pressable
            style={[styles.skipBtn, isLoading && styles.skipBtnDisabled]}
            onPress={avanzaMese}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.skipBtnText}>Caricamento...</Text>
              </>
            ) : (
              <>
                <Text style={styles.skipBtnEmoji}>⏭️</Text>
                <Text style={styles.skipBtnText}>Skip Mese</Text>
              </>
            )}
          </Pressable>
          <Pressable style={styles.indCard} onPress={() => router.push("/felicita")}>
            <Text style={styles.indEmoji}>😊</Text>
            <Text style={styles.indLabel}>Felicità</Text>
            <Text style={styles.indValue}>{felicitàMedia}%</Text>
          </Pressable>
          <Pressable style={styles.indCard} onPress={() => router.push("/lealta")}>
            <Text style={styles.indEmoji}>❤️</Text>
            <Text style={styles.indLabel}>Lealtà</Text>
            <Text style={styles.indValue}>{lealtàMedia}%</Text>
          </Pressable>
          <Pressable style={styles.indCard} onPress={() => router.push("/paura")}>
            <Text style={styles.indEmoji}>😨</Text>
            <Text style={styles.indLabel}>Paura</Text>
            <Text style={styles.indValue}>{pauraMedia}%</Text>
          </Pressable>
        </View>
      </View>

      {/* Contenitore mappa: occupa esattamente lo spazio tra banner superiore e inferiore */}
      <View style={styles.mapContainer}>
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
            <View style={[styles.griglia, styles.grigliaTerreno, { gap: GAP, width: gridWidth }]}>
              {Array.from({ length: totaleCelle }, (_, i) => {
                const acqua = isAcqua(i);
                const edificio = edificiInMappa[i];
                const hasEdificio = !!edificio;
                const èStrada = edificio?.nome === "Strada";
                const cellStyle = [
                  styles.cella,
                  acqua ? styles.cellaAcqua : styles.cellaErba,
                  { width: size, height: size },
                  hasEdificio && !èStrada && styles.cellaEdificio
                ];
                if (acqua) {
                  return <View key={i} style={cellStyle} />;
                }
                return (
                  <Pressable key={i} style={cellStyle} onPress={() => onCellPress(i)} />
                );
              })}
            </View>
            <View
              style={[
                styles.roadsLayer,
                styles.roadsLayerSopra,
                { width: contentWidth, height: contentHeight }
              ]}
              pointerEvents="none"
            >
              {STRADE_INIZIALI.filter(
                ([a, b]) => edificiInMappa[a] && edificiInMappa[b]
              ).map(([from, to]) => {
                const c1 = getCellCenter(from, size);
                const c2 = getCellCenter(to, size);
                const dx = c2.x - c1.x;
                const dy = c2.y - c1.y;
                const length = Math.sqrt(dx * dx + dy * dy) || 1;
                const midX = (c1.x + c2.x) / 2;
                const midY = (c1.y + c2.y) / 2;
                const angle = Math.atan2(dy, dx);
                return (
                  <View
                    key={`strada-${from}-${to}`}
                    style={[
                      styles.stradaLinea,
                      {
                        width: length,
                        height: STRADA_SPESSORE,
                        left: midX - length / 2,
                        top: midY - STRADA_SPESSORE / 2,
                        transform: [{ rotate: `${angle}rad` }]
                      }
                    ]}
                  />
                );
              })}
              {(() => {
                const drawnEdges = new Set<string>();
                const segmenti: [number, number][] = [];
                const celleIsolate: number[] = [];
                Object.keys(edificiInMappa)
                  .map(Number)
                  .filter((i) => edificiInMappa[i]?.nome === "Strada")
                  .forEach((i) => {
                    const vicini = getViciniOrtogonali(i).filter(
                      (n) => edificiInMappa[n]
                    );
                    if (vicini.length === 0) {
                      celleIsolate.push(i);
                    } else {
                      vicini.forEach((n) => {
                        const key = `${Math.min(i, n)}-${Math.max(i, n)}`;
                        if (!drawnEdges.has(key)) {
                          drawnEdges.add(key);
                          segmenti.push([i, n]);
                        }
                      });
                    }
                  });
                return (
                  <>
                    {segmenti.map(([from, to]) => {
                      const c1 = getCellCenter(from, size);
                      const c2 = getCellCenter(to, size);
                      const dx = c2.x - c1.x;
                      const dy = c2.y - c1.y;
                      const length = Math.sqrt(dx * dx + dy * dy) || 1;
                      const midX = (c1.x + c2.x) / 2;
                      const midY = (c1.y + c2.y) / 2;
                      const angle = Math.atan2(dy, dx);
                      return (
                        <View
                          key={`strada-cell-${from}-${to}`}
                          style={[
                            styles.stradaLinea,
                            {
                              width: length,
                              height: STRADA_SPESSORE,
                              left: midX - length / 2,
                              top: midY - STRADA_SPESSORE / 2,
                              transform: [{ rotate: `${angle}rad` }]
                            }
                          ]}
                        />
                      );
                    })}
                    {celleIsolate.map((i) => {
                      const c = getCellCenter(i, size);
                      const r = STRADA_CERCHIO_RAGGIO;
                      return (
                        <View
                          key={`strada-cerchio-${i}`}
                          style={[
                            styles.stradaCerchio,
                            {
                              width: r * 2,
                              height: r * 2,
                              left: c.x - r,
                              top: c.y - r,
                              borderRadius: r
                            }
                          ]}
                        />
                      );
                    })}
                  </>
                );
              })()}
            </View>
            <View
              style={[styles.griglia, styles.grigliaEmoji, { gap: GAP, width: gridWidth }]}
              pointerEvents="none"
            >
              {Array.from({ length: totaleCelle }, (_, i) => {
                const edificio = edificiInMappa[i];
                const emoji = edificio?.emoji ?? null;
                const èStrada = edificio?.nome === "Strada";
                const mostraEmoji = !!edificio && !èStrada && emoji;
                return (
                  <View key={i} style={[styles.cella, { width: size, height: size }]}>
                    {mostraEmoji ? (
                      <Text
                        style={[
                          styles.edificioEmoji,
                          { fontSize: Math.max(10, Math.min(22, size - 4)) }
                        ]}
                      >
                        {emoji}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
          </ScrollView>
        </ScrollView>
        </View>
      </View>

      {/* Menu fisso in basso: Risorse (ancorato al fondo schermo) */}
      <View style={styles.bottomBar} pointerEvents="box-none">
        <View style={styles.bottomBarInner}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.risorseRow}
          >
            {risorse.map((r: Risorsa) => {
              const delta = (variazioni[r.nome] || 0) + (deltaOrdini[r.nome] ?? 0);
              const route = getResourceRoute(r);
              return (
                <Pressable
                  key={r.id}
                  style={[styles.risorseCard, route && styles.risorseCardClickable]}
                  onPress={route ? () => router.push(route) : undefined}
                  disabled={!route}
                >
                  <Text style={styles.risorseEmoji}>{getResourceEmoji(r)}</Text>
                  <Text style={styles.risorseName} numberOfLines={1}>{r.nome}</Text>
                  <View style={styles.risorseValueRow}>
                    <Text style={styles.risorseValue}>{r.quantità}</Text>
                    <Text style={styles.risorseUnit}> {r.unità}</Text>
                  </View>
                  {delta !== 0 && (
                    <Text style={[styles.risorseDelta, delta > 0 ? styles.risorseDeltaPos : styles.risorseDeltaNeg]}>
                      {delta > 0 ? "+" : ""}{delta}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
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
              <Pressable
                style={styles.modalOption}
                onPress={() =>
                  selectedCellForDialog !== null &&
                  handleScegliEdificio(selectedCellForDialog, STRADA_OPZIONE as unknown as Edificio)
                }
              >
                <Text style={styles.modalOptionEmoji}>{STRADA_OPZIONE.emoji}</Text>
                <Text style={styles.modalOptionNome}>{STRADA_OPZIONE.nome}</Text>
              </Pressable>
              {edificiData
                .filter((e) => e.nome !== "Centro di Comando")
                .map((e) => (
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

      <Modal
        visible={selectedCellForTransformDialog !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedCellForTransformDialog(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSelectedCellForTransformDialog(null)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Trasformare in Raffineria Mineraria?</Text>
            <Text style={styles.modalSubtitle}>
              Vuoi trasformare questo Giacimento ⛰️ nell'edificio Raffineria Mineraria ⚙️?
            </Text>
            <View style={styles.modalButtonsRow}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setSelectedCellForTransformDialog(null)}
              >
                <Text style={styles.modalButtonText}>Annulla</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={() =>
                  selectedCellForTransformDialog !== null &&
                  handleTrasformaGiacimento(selectedCellForTransformDialog)
                }
              >
                <Text style={styles.modalButtonText}>Conferma</Text>
              </Pressable>
            </View>
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
    userSelect: "none",
    overflow: "hidden"
  },
  topBanner: {
    zIndex: 999,
    paddingHorizontal: 0,
    paddingVertical: 8,
    width: "100%",
    backgroundColor: "#050816"
  },
  topBannerInner: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 12
  },
  bannerTitleBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  bannerTitleEmoji: {
    fontSize: 28,
    textShadowColor: "rgba(251,191,36,0.3)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f8fafc",
    letterSpacing: 0.3
  },
  bannerSubtitle: {
    fontSize: 11,
    color: "rgba(248,250,252,0.65)",
    marginTop: 1
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30,41,59,0.8)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    gap: 4
  },
  badgeText: {
    fontSize: 11,
    color: "rgba(248,250,252,0.85)",
    fontWeight: "600"
  },
  diarioBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(51,65,85,0.6)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    gap: 6
  },
  diarioBtnEmoji: { fontSize: 14 },
  diarioBtnLabel: { fontSize: 12, fontWeight: "600", color: "#e2e8f0" },
  skipBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.5)"
  },
  skipBtnDisabled: {
    backgroundColor: "rgba(37,99,235,0.5)",
    opacity: 0.9
  },
  skipBtnEmoji: { fontSize: 18 },
  skipBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  mapContainer: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden"
  },
  indCard: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.85)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)"
  },
  indEmoji: { fontSize: 22, marginBottom: 4 },
  indLabel: { fontSize: 10, color: "rgba(248,250,252,0.8)", marginBottom: 2 },
  indValue: { fontSize: 14, fontWeight: "800", color: "#f8fafc" },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    width: "100%",
    paddingVertical: 0,
    paddingHorizontal: 0
  },
  bottomBarInner: {
    width: "100%",
    minHeight: 56,
    backgroundColor: "rgba(5,8,22,0.92)",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "rgba(148,163,184,0.25)",
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  risorseRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingHorizontal: 0
  },
  risorseCard: {
    minWidth: 72,
    backgroundColor: "rgba(15,23,42,0.8)",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.15)"
  },
  risorseCardClickable: {
    borderColor: "rgba(59,130,246,0.3)"
  },
  risorseEmoji: { fontSize: 18, marginBottom: 2 },
  risorseName: { fontSize: 9, color: "rgba(248,250,252,0.85)", marginBottom: 1 },
  risorseValueRow: { flexDirection: "row", alignItems: "baseline" },
  risorseValue: { fontSize: 13, fontWeight: "800", color: "#f8fafc" },
  risorseUnit: { fontSize: 9, color: "rgba(148,163,184,0.8)", marginLeft: 1 },
  risorseDelta: { fontSize: 9, fontWeight: "700", marginTop: 1 },
  risorseDeltaPos: { color: "#4ade80" },
  risorseDeltaNeg: { color: "#f87171" },
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
  menuBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "rgba(59,130,246,0.4)",
    borderWidth: 1,
    borderColor: "rgba(147,197,253,0.5)"
  },
  menuBtnText: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "600"
  },
  viewport: {
    flex: 1,
    minHeight: 0,
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
    alignContent: "flex-start",
    position: "relative"
  },
  grigliaTerreno: {
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: 0
  },
  roadsLayer: {
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: 0
  },
  roadsLayerSopra: {
    zIndex: 1
  },
  grigliaEmoji: {
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: 2
  },
  stradaLinea: {
    position: "absolute",
    backgroundColor: STRADA_COLORE,
    borderRadius: STRADA_SPESSORE / 2
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
  cellaEdificio: {},
  stradaCerchio: {
    position: "absolute",
    backgroundColor: STRADA_COLORE
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
  modalSubtitle: {
    color: "rgba(203,213,245,0.9)",
    fontSize: 13,
    marginBottom: 16,
    textAlign: "center"
  },
  modalButtonsRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center"
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
    alignItems: "center"
  },
  modalButtonCancel: {
    backgroundColor: "rgba(148,163,184,0.3)"
  },
  modalButtonConfirm: {
    backgroundColor: "#3b82f6"
  },
  modalButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600"
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
