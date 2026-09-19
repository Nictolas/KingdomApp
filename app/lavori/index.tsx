import React, { useMemo, useState } from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Circle, G, Path } from "react-native-svg";
import { useGameContext } from "../../src/context/GameContext";
import type { Abitante } from "../../src/types";
import { lpcSpriteCircleDiameter } from "../../src/character-system/lpcPack";
import {
  elencoOccupazioniConConteggio,
  etichettaProduceOccupazione,
  etichettaSoloEdificiOccupazione,
  isOccupazioneRimossa
} from "../../src/game/lavoriCatalogo";
import { etichettaOrarioLavoro } from "../../src/game/orariLavoroCatalogo";
import { generaAspettoEsempioOccupazione } from "../../src/game/lavoriAspetto";
import { getCastaAbitante } from "../../src/game/casta";
import {
  getProprietarioSchiavoId,
  ID_GIOCATORE,
  LAVORO_GIOCATORE
} from "../../src/game/schiavituCommercio";
import { AbitanteAvatarPreview } from "../../src/ui/AbitanteAvatarPreview";
import { AbitanteInfoModal } from "../../src/ui/AbitanteInfoModal";
import { CircularSpriteFrame } from "../../src/ui/CircularSpriteFrame";

const AVATAR_SIZE = 36;
const AVATAR_OUTER = lpcSpriteCircleDiameter(AVATAR_SIZE) + 4;
const COLOR_OCCUPATI = "#34d399";
const COLOR_DISOCCUPATI = "#f87171";
const PIE_SIZE = 148;

const COLS = [
  { key: "occupazione", label: "Occupazione", width: 260 },
  { key: "edificio", label: "Edificio", width: 200 },
  { key: "produce", label: "Produce", width: 200 },
  { key: "orario", label: "Orario", width: 110 },
  { key: "persone", label: "Persone", width: 90 }
] as const;

const TABLE_MIN_WIDTH = COLS.reduce((s, c) => s + c.width, 0);

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function slicePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

function OccupazionePieChart({
  occupati,
  disoccupati
}: {
  occupati: number;
  disoccupati: number;
}) {
  const totale = occupati + disoccupati;
  const cx = PIE_SIZE / 2;
  const cy = PIE_SIZE / 2;
  const r = PIE_SIZE / 2 - 4;

  if (totale <= 0) {
    return (
      <View style={styles.pieWrap}>
        <Svg width={PIE_SIZE} height={PIE_SIZE}>
          <Circle cx={cx} cy={cy} r={r} fill="rgba(51,65,85,0.9)" />
        </Svg>
        <Text style={styles.pieEmpty}>Nessun dato</Text>
      </View>
    );
  }

  if (occupati <= 0 || disoccupati <= 0) {
    const color = occupati > 0 ? COLOR_OCCUPATI : COLOR_DISOCCUPATI;
    return (
      <View style={styles.pieWrap}>
        <Svg width={PIE_SIZE} height={PIE_SIZE}>
          <Circle cx={cx} cy={cy} r={r} fill={color} />
        </Svg>
      </View>
    );
  }

  const angleOccupati = (occupati / totale) * 360;
  return (
    <View style={styles.pieWrap}>
      <Svg width={PIE_SIZE} height={PIE_SIZE}>
        <G>
          <Path d={slicePath(cx, cy, r, 0, angleOccupati)} fill={COLOR_OCCUPATI} />
          <Path d={slicePath(cx, cy, r, angleOccupati, 360)} fill={COLOR_DISOCCUPATI} />
        </G>
      </Svg>
    </View>
  );
}

export default function LavoriScreen() {
  const router = useRouter();
  const { abitanti, edifici, calcolaFelicitàModificata, etaMinimaLavoro, modalitaGioco } =
    useGameContext();
  const [selectedAbitante, setSelectedAbitante] = useState<Abitante | null>(null);

  const abitantiAttivi = useMemo(
    () => abitanti.filter((a) => a.razza !== "Golem"),
    [abitanti]
  );

  const { disoccupati, occupatiTotali, cardOccupazioni } = useMemo(() => {
    const dis = abitantiAttivi.filter(
      (a) => a.lavoro === "Disoccupato" || isOccupazioneRimossa(a.lavoro)
    );
    dis.sort((a, b) => a.nome.localeCompare(b.nome, "it"));
    const cards = elencoOccupazioniConConteggio(abitantiAttivi);
    const cardsVisibili =
      modalitaGioco === "avventura" ? cards.filter((c) => c.count > 0) : cards;
    const occupatiTotali = cardsVisibili.reduce((sum, c) => sum + c.count, 0);
    return {
      disoccupati: dis,
      occupatiTotali,
      cardOccupazioni: cardsVisibili
    };
  }, [abitantiAttivi, modalitaGioco]);

  const giocatore = useMemo(
    () => abitanti.find((a) => a.id === ID_GIOCATORE) ?? null,
    [abitanti]
  );

  const esempiOccupazione = useMemo(() => {
    const map = new Map<string, ReturnType<typeof generaAspettoEsempioOccupazione>>();
    for (const card of cardOccupazioni) {
      if (card.lavoro === LAVORO_GIOCATORE) continue;
      if (!map.has(card.lavoro)) {
        map.set(card.lavoro, generaAspettoEsempioOccupazione(card.lavoro, card.slug));
      }
    }
    return map;
  }, [cardOccupazioni]);

  const getAbitanteNome = (id: number) => abitanti.find((a) => a.id === id)?.nome ?? `ID ${id}`;

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;
  const stack = width < 900;

  return (
    <SafeAreaView style={[styles.safe, maxHeight != null ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>💼 Lavori</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
          <View style={[styles.mainRow, stack && styles.mainRowStack]}>
            <View style={[styles.rightCol, stack && styles.colFull]}>
              <Text style={styles.sectionTitle}>Occupati ({occupatiTotali})</Text>
              {cardOccupazioni.length === 0 ? (
                <View style={styles.listCard}>
                  <Text style={styles.listEmpty}>Nessuna occupazione</Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator
                  nestedScrollEnabled
                  style={styles.tableScroll}
                >
                  <View style={[styles.table, { minWidth: TABLE_MIN_WIDTH }]}>
                    <View style={[styles.row, styles.headerRow]}>
                      {COLS.map((col) => (
                        <View key={col.key} style={[styles.cell, { width: col.width }]}>
                          <Text style={styles.headerCellText}>{col.label}</Text>
                        </View>
                      ))}
                    </View>
                    {cardOccupazioni.map((card, index) => (
                      <Pressable
                        key={card.slug}
                        style={[styles.row, index % 2 === 1 && styles.rowAlt]}
                        onPress={() => router.push(`/lavori/${card.slug}`)}
                      >
                        <View style={[styles.cell, styles.occupazioneCellWrap, { width: COLS[0].width }]}>
                          <View style={[styles.avatarWrap, { width: AVATAR_OUTER, height: AVATAR_OUTER }]}>
                            {card.lavoro === LAVORO_GIOCATORE && giocatore?.aspetto ? (
                              <AbitanteAvatarPreview abitante={giocatore} size={AVATAR_SIZE} liftPx={0} />
                            ) : (
                              <CircularSpriteFrame
                                appearance={
                                  (
                                    card.lavoro === LAVORO_GIOCATORE
                                      ? generaAspettoEsempioOccupazione(LAVORO_GIOCATORE, card.slug)
                                      : esempiOccupazione.get(card.lavoro)!
                                  ).characterAppearance!
                                }
                                size={AVATAR_SIZE}
                                animate={false}
                              />
                            )}
                          </View>
                          <Text style={styles.occupazioneCell} numberOfLines={2}>
                            {card.lavoro}
                          </Text>
                        </View>
                        <View style={[styles.cell, { width: COLS[1].width }]}>
                          <Text style={styles.cellText}>{etichettaSoloEdificiOccupazione(card.lavoro)}</Text>
                        </View>
                        <View style={[styles.cell, { width: COLS[2].width }]}>
                          <Text style={styles.cellText}>{etichettaProduceOccupazione(card.lavoro)}</Text>
                        </View>
                        <View style={[styles.cell, { width: COLS[3].width }]}>
                          <Text style={styles.orarioCell}>{etichettaOrarioLavoro(card.lavoro)}</Text>
                        </View>
                        <View style={[styles.cell, { width: COLS[4].width }]}>
                          <Text style={styles.countCell}>{card.count}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              )}
            </View>

            <View style={[styles.leftCol, stack && styles.colFull]}>
              <View style={styles.pieCard}>
                <OccupazionePieChart occupati={occupatiTotali} disoccupati={disoccupati.length} />
                <View style={styles.legend}>
                  <View style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: COLOR_OCCUPATI }]} />
                    <Text style={styles.legendText}>Occupati: {occupatiTotali}</Text>
                  </View>
                  <View style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: COLOR_DISOCCUPATI }]} />
                    <Text style={styles.legendText}>Disoccupati: {disoccupati.length}</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Disoccupati ({disoccupati.length})</Text>
              <View style={styles.listCard}>
                {disoccupati.length === 0 ? (
                  <Text style={styles.listEmpty}>Nessun disoccupato</Text>
                ) : (
                  disoccupati.map((a) => {
                    const casta = getCastaAbitante(a);
                    const propId = getProprietarioSchiavoId(a);
                    const propLabel =
                      propId === undefined
                        ? null
                        : propId === null
                          ? "Regno"
                          : getAbitanteNome(propId);
                    return (
                      <Pressable key={a.id} style={styles.riga} onPress={() => setSelectedAbitante(a)}>
                        <AbitanteAvatarPreview abitante={a} />
                        <View style={styles.rigaTesto}>
                          <Text style={[styles.nomeLink, styles.rigaDisoccupato]} numberOfLines={1}>
                            {a.nome}
                          </Text>
                          <Text style={styles.metaDisoccupato} numberOfLines={1}>
                            {casta}
                            {propLabel != null ? ` · Prop. ${propLabel}` : ""}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Home
        </Text>
      </View>

      <AbitanteInfoModal
        visible={selectedAbitante !== null}
        abitante={selectedAbitante}
        edifici={edifici}
        onClose={() => setSelectedAbitante(null)}
        getAbitanteNome={getAbitanteNome}
        calcolaFelicitàModificata={calcolaFelicitàModificata}
        etaMinimaLavoro={etaMinimaLavoro}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050816" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.6)"
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.6)"
  },
  back: { color: "#93c5fd", fontSize: 12 },
  title: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  content: { padding: 16, paddingBottom: 24 },
  mainRow: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  mainRowStack: { flexDirection: "column" },
  leftCol: { width: 260, flexShrink: 0 },
  rightCol: { flex: 1, minWidth: 0 },
  colFull: { width: "100%" },
  pieCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
    alignItems: "center"
  },
  pieWrap: { alignItems: "center", justifyContent: "center" },
  pieEmpty: {
    position: "absolute",
    color: "rgba(203,213,245,0.55)",
    fontSize: 11
  },
  legend: { marginTop: 10, gap: 6, alignSelf: "stretch" },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: "#e2e8f0", fontSize: 12, fontWeight: "600" },
  sectionTitle: { color: "#ffffff", fontSize: 13, fontWeight: "700", marginBottom: 8 },
  tableScroll: { marginBottom: 4 },
  table: {
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "rgba(15,23,42,0.95)"
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.35)"
  },
  rowAlt: {
    backgroundColor: "rgba(30,41,59,0.55)"
  },
  headerRow: {
    backgroundColor: "rgba(30,41,59,0.95)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.55)"
  },
  cell: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    justifyContent: "center",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "rgba(148,163,184,0.25)"
  },
  occupazioneCellWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  avatarWrap: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  headerCellText: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3
  },
  occupazioneCell: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
    minWidth: 0
  },
  cellText: {
    color: "#e2e8f0",
    fontSize: 11,
    lineHeight: 15
  },
  countCell: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center"
  },
  orarioCell: {
    color: "#fde68a",
    fontSize: 11,
    fontWeight: "600",
    fontVariant: ["tabular-nums"]
  },
  listCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)"
  },
  listEmpty: {
    color: "rgba(203,213,245,0.45)",
    fontSize: 11,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 12
  },
  riga: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.2)"
  },
  rigaTesto: { flex: 1, minWidth: 0 },
  nomeLink: { color: "#93c5fd", fontSize: 12, fontWeight: "600", flex: 1, minWidth: 0 },
  rigaDisoccupato: { color: "#fca5a5", flex: 0 },
  metaDisoccupato: {
    color: "rgba(203,213,245,0.65)",
    fontSize: 10,
    marginTop: 1
  }
});
