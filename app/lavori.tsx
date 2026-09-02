import React, { useMemo, useState } from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import type { Abitante } from "../src/types";
import { appearanceForPublicSpace } from "../src/character-system/appearance";
import { lpcSpriteCircleDiameter } from "../src/character-system/lpcPack";
import { isGiocatore, LAVORO_GIOCATORE } from "../src/game/schiavituCommercio";
import { AbitanteInfoModal } from "../src/ui/AbitanteInfoModal";
import { PixelAvatarPreview } from "../src/ui/PixelAvatarPreview";

const AVATAR_SIZE = 40;
const AVATAR_FRAME = lpcSpriteCircleDiameter(AVATAR_SIZE) + 8;
const AVATAR_LIFT = 6;

function lavoroEtichetta(abitante: Abitante): string {
  return isGiocatore(abitante) ? LAVORO_GIOCATORE : abitante.lavoro;
}

function aspettoLista(abitante: Abitante) {
  if (!abitante.aspetto?.characterAppearance || abitante.razza === "Golem") return abitante.aspetto;
  return {
    ...abitante.aspetto,
    characterAppearance: appearanceForPublicSpace(abitante.aspetto.characterAppearance, {
      isKing: abitante.id === 1,
      nudismoAttivo: false,
      incinta: abitante.incinta === true,
      lavoro: abitante.lavoro
    })
  };
}

function AvatarAbitante({ abitante }: { abitante: Abitante }) {
  const aspetto = aspettoLista(abitante);
  if (aspetto && abitante.razza !== "Golem") {
    return (
      <View style={styles.avatarWrap}>
        <PixelAvatarPreview
          razza={abitante.razza ?? "Umano"}
          aspetto={aspetto}
          size={AVATAR_SIZE}
          animate={false}
          liftPx={AVATAR_LIFT}
        />
      </View>
    );
  }
  return (
    <View style={styles.avatarFallback}>
      <Text style={styles.avatarFallbackText}>👤</Text>
    </View>
  );
}

export default function LavoriScreen() {
  const router = useRouter();
  const { abitanti, edifici, calcolaFelicitàModificata, etaMinimaLavoro } = useGameContext();
  const [selectedAbitante, setSelectedAbitante] = useState<Abitante | null>(null);

  const abitantiAttivi = useMemo(
    () => abitanti.filter((a) => a.razza !== "Golem"),
    [abitanti]
  );

  const { occupati, disoccupati, disoccupazionePercent } = useMemo(() => {
    const dis = abitantiAttivi.filter((a) => a.lavoro === "Disoccupato");
    const occ = abitantiAttivi.filter((a) => a.lavoro !== "Disoccupato");
    occ.sort((a, b) => {
      const cmp = lavoroEtichetta(a).localeCompare(lavoroEtichetta(b), "it");
      return cmp !== 0 ? cmp : a.nome.localeCompare(b.nome, "it");
    });
    dis.sort((a, b) => a.nome.localeCompare(b.nome, "it"));
    const n = abitantiAttivi.length;
    const pct = n ? Math.round((dis.length / n) * 100) : 0;
    return { occupati: occ, disoccupati: dis, disoccupazionePercent: pct };
  }, [abitantiAttivi]);

  const getAbitanteNome = (id: number) => abitanti.find((a) => a.id === id)?.nome ?? `ID ${id}`;

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>💼 Lavori</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Disoccupazione</Text>
            <Text style={styles.summaryValue}>{disoccupazionePercent}%</Text>
            <Text style={styles.summarySubtext}>
              {disoccupati.length} disoccupati su {abitantiAttivi.length} abitanti
            </Text>
          </View>

          <View style={[styles.mainRow, !isDesktop && styles.mainRowStack]}>
            <View style={[styles.col, !isDesktop && styles.colFull]}>
              <Text style={styles.sectionTitle}>Occupati ({occupati.length})</Text>
              <View style={styles.listCard}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.headerCell, styles.colOccupazione]}>Occupazione</Text>
                  <Text style={[styles.headerCell, styles.colAbitante]}>Abitante</Text>
                </View>
                {occupati.length === 0 ? (
                  <Text style={styles.listEmpty}>Nessuno occupato</Text>
                ) : (
                  occupati.map((a) => (
                    <View key={a.id} style={styles.tableRow}>
                      <Text style={[styles.cellOccupazione, styles.colOccupazione]} numberOfLines={2}>
                        {lavoroEtichetta(a)}
                      </Text>
                      <Pressable
                        style={[styles.cellAbitante, styles.colAbitante]}
                        onPress={() => setSelectedAbitante(a)}
                      >
                        <AvatarAbitante abitante={a} />
                        <Text style={styles.nomeLink} numberOfLines={1}>
                          {a.nome}
                        </Text>
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            </View>

            <View style={[styles.col, !isDesktop && styles.colFull]}>
              <Text style={styles.sectionTitle}>Disoccupati ({disoccupati.length})</Text>
              <View style={styles.listCard}>
                {disoccupati.length === 0 ? (
                  <Text style={styles.listEmpty}>Nessun disoccupato</Text>
                ) : (
                  disoccupati.map((a) => (
                    <Pressable key={a.id} style={styles.riga} onPress={() => setSelectedAbitante(a)}>
                      <AvatarAbitante abitante={a} />
                      <Text style={[styles.nomeLink, styles.rigaDisoccupato]} numberOfLines={1}>
                        {a.nome}
                      </Text>
                    </Pressable>
                  ))
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <Text style={styles.back} onPress={() => router.back()}>← Home</Text>
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
  summaryCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
    alignItems: "center"
  },
  summaryLabel: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  summaryValue: { color: "#fbbf24", fontSize: 26, fontWeight: "700", marginBottom: 4 },
  summarySubtext: { color: "rgba(203,213,245,0.7)", fontSize: 10, textAlign: "center" },
  mainRow: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  mainRowStack: { flexDirection: "column" },
  col: { flex: 1, minWidth: 0 },
  colFull: { width: "100%" },
  sectionTitle: { color: "#ffffff", fontSize: 13, fontWeight: "700", marginBottom: 8 },
  listCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)"
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.35)"
  },
  headerCell: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.2)"
  },
  colOccupazione: { flex: 1, minWidth: 0, paddingRight: 8 },
  colAbitante: { flex: 1.2, minWidth: 0 },
  cellOccupazione: { color: "#cbd5e1", fontSize: 12, fontWeight: "500" },
  cellAbitante: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0
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
  avatarWrap: {
    width: AVATAR_FRAME,
    height: AVATAR_FRAME,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  avatarFallback: {
    width: AVATAR_FRAME,
    height: AVATAR_FRAME,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: AVATAR_FRAME / 2,
    backgroundColor: "rgba(30,41,59,0.9)"
  },
  avatarFallbackText: { fontSize: 18 },
  nomeLink: { color: "#93c5fd", fontSize: 12, fontWeight: "600", flex: 1, minWidth: 0 },
  rigaDisoccupato: { color: "#fca5a5" }
});
