import React, { useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { fazioniData, leggiData } from "../kingdomData";
import { useGameContext } from "../context/GameContext";
import type { Risorsa, Abitante } from "../types";
import { CreditiModal } from "../ui/CreditiModal";
import { EnergiaModal } from "../ui/EnergiaModal";

export default function GridGame() {
  const router = useRouter();
  const { abitanti, risorse, edifici, mese, anno, isLoading, avanzaMese, calcolaProduzioneConsumo, calcolaDeltaOrdiniMercato, calcolaFelicitàModificata, abitantiProposti, punteggioSanzioni } = useGameContext();
  const [showCreditiModal, setShowCreditiModal] = useState(false);
  const [showEnergiaModal, setShowEnergiaModal] = useState(false);

  const criminali = abitanti.filter((a: Abitante) => (a.reati?.length ?? 0) > 0);
  const personalitàUniche = Array.from(new Set(abitanti.map((a: Abitante) => a.personalità))).filter(Boolean);
  const fazioni = fazioniData;
  const leggi = leggiData;

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;

  const variazioni = calcolaProduzioneConsumo();
  const deltaOrdini = calcolaDeltaOrdiniMercato();

  const n = abitanti.length;
  const felicitàMedia = n ? Math.round(abitanti.reduce((s, a) => s + calcolaFelicitàModificata(a), 0) / n) : 0;
  const lealtàMedia = n ? Math.round(abitanti.reduce((s, a) => s + a.lealtà, 0) / n) : 0;
  const pauraMedia = n ? Math.round(abitanti.reduce((s, a) => s + a.paura, 0) / n) : 0;

  return (
    <View style={styles.container}>
      {/* Header + Skip su una riga compatta su PC */}
      <View style={[styles.header, isDesktop && styles.headerCompact]}>
        <View style={[styles.titleRow, isDesktop && styles.titleRowCompact]}>
          <Text style={[styles.gameTitle, isDesktop && styles.gameTitleCompact]}>MyKingdom</Text>
          <Pressable style={[styles.diarioButton, isDesktop && styles.diarioButtonCompact]} onPress={() => router.push("/diario")}>
            <Text style={styles.diarioEmoji}>📖</Text>
            <Text style={[styles.diarioLabel, isDesktop && styles.diarioLabelCompact]}>Diario</Text>
          </Pressable>
          {isDesktop && (
            <Text style={styles.meseLabel}>Mese {mese} - Anno {anno}</Text>
          )}
        </View>
        {!isDesktop && (
          <View>
            <Text style={styles.subtitle}>Gestisci la tua colonia</Text>
            <Text style={styles.meseLabel}>Mese {mese} - Anno {anno}</Text>
          </View>
        )}
        <Pressable
          style={[styles.skipButton, isLoading && styles.skipButtonDisabled]}
          onPress={avanzaMese}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 4 }} />
              <Text style={styles.skipButtonText}>Caricamento...</Text>
            </>
          ) : (
            <>
              <Text style={styles.skipEmoji}>⏭️</Text>
              <Text style={styles.skipButtonText}>Skip Mese</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Risorse + Indicatori (Felicità/Lealtà/Paura medie) */}
      <View style={[styles.section, styles.resourcesSection, isDesktop && styles.sectionCompact]}>
        <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleCompact]}>Risorse</Text>
        <View style={[styles.resourcesGrid, isDesktop && styles.resourcesGridCompact]}>
          {risorse.map((r: Risorsa) => {
            const variazione = (variazioni[r.nome] || 0) + (deltaOrdini[r.nome] ?? 0);
            const isCibo = r.nome.toLowerCase().includes("cibo");
            const isCrediti = r.nome.toLowerCase().includes("crediti");
            const isEnergia = r.nome.toLowerCase().includes("energia");
            const isAcqua = r.nome.toLowerCase().includes("acqua");
            const isMaterialeEdile = r.nome.toLowerCase().includes("materiale edile");
            const isMedicine = r.nome.toLowerCase().includes("medicine");
            const isCombustibile = r.nome.toLowerCase().includes("combustibile");
            const isRifiuti = r.nome.toLowerCase().includes("rifiuti");
            const emoji =
              isCrediti
                ? "💰"
                : isCibo
                ? "🍱"
                : isEnergia
                ? "⚡"
                : isAcqua
                ? "💧"
                : isMaterialeEdile
                ? "🧱"
                : isMedicine
                ? "💊"
                : isCombustibile
                ? "⛽"
                : isRifiuti
                ? "🗑️"
                : "⛏️";
            return (
              <Pressable
                key={r.id}
                style={[styles.resourceCard, isDesktop && styles.resourceCardCompact]}
                onPress={
                  isCibo
                    ? () => router.push("/cibo")
                    : isCrediti
                    ? () => setShowCreditiModal(true)
                    : isEnergia
                    ? () => setShowEnergiaModal(true)
                    : undefined
                }
                disabled={!isCibo && !isCrediti && !isEnergia}
              >
                <Text style={styles.resourceName}>
                  <Text style={styles.resourceEmoji}>{emoji} </Text>
                  {r.nome}
                </Text>
                <View style={styles.resourceRow}>
                  <Text style={styles.resourceValue}>
                    {r.quantità} <Text style={styles.resourceUnit}>{r.unità}</Text>
                  </Text>
                  {variazione !== 0 && (
                    <Text style={[styles.variazione, variazione > 0 ? styles.variazionePositiva : styles.variazioneNegativa]}>
                      {variazione > 0 ? "+" : ""}{variazione}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}
          <View style={[styles.resourceCard, styles.resourceCardMedia, isDesktop && styles.resourceCardCompact]}>
            <Text style={styles.resourceName}>
              <Text style={styles.resourceEmoji}>😊 </Text>
              Felicità Media
            </Text>
            <Text style={styles.resourceValue}>{felicitàMedia}%</Text>
          </View>
          <View style={[styles.resourceCard, styles.resourceCardMedia, isDesktop && styles.resourceCardCompact]}>
            <Text style={styles.resourceName}>
              <Text style={styles.resourceEmoji}>❤️ </Text>
              Lealtà Media
            </Text>
            <Text style={styles.resourceValue}>{lealtàMedia}%</Text>
          </View>
          <View style={[styles.resourceCard, styles.resourceCardMedia, isDesktop && styles.resourceCardCompact]}>
            <Text style={styles.resourceName}>
              <Text style={styles.resourceEmoji}>😨 </Text>
              Paura Media
            </Text>
            <Text style={styles.resourceValue}>{pauraMedia}%</Text>
          </View>
        </View>
      </View>

      <View style={[styles.navRow, isDesktop && styles.navRowCompact]}>
        <Pressable style={[styles.navButton, isDesktop && styles.navButtonCompact]} onPress={() => router.push("/abitanti")}>
          <Text style={styles.navEmoji}>👥</Text>
          <Text style={styles.navLabel}>Abitanti</Text>
          <Text style={styles.navCount}>{abitanti.length} totali</Text>
        </Pressable>
      </View>
      <View style={[styles.navRow, isDesktop && styles.navRowCompact]}>
        <Pressable style={[styles.navButton, isDesktop && styles.navButtonCompact]} onPress={() => router.push("/fazioni")}>
          <Text style={styles.navEmoji}>⚔️</Text>
          <Text style={styles.navLabel}>Fazioni</Text>
          <Text style={styles.navCount}>{fazioni.length} attive</Text>
        </Pressable>
        <Pressable style={[styles.navButton, isDesktop && styles.navButtonCompact]} onPress={() => router.push("/leggi")}>
          <Text style={styles.navEmoji}>📜</Text>
          <Text style={styles.navLabel}>Leggi</Text>
          <Text style={styles.navCount}>{leggi.length} totali</Text>
        </Pressable>
      </View>
      <View style={[styles.navRow, isDesktop && styles.navRowCompact]}>
        <Pressable style={[styles.navButton, isDesktop && styles.navButtonCompact]} onPress={() => router.push("/edifici")}>
          <Text style={styles.navEmoji}>🏗️</Text>
          <Text style={styles.navLabel}>Edifici</Text>
          <Text style={styles.navCount}>{edifici.length} strutture</Text>
        </Pressable>
        <Pressable style={[styles.navButton, isDesktop && styles.navButtonCompact]} onPress={() => router.push("/immigrazione")}>
          <Text style={styles.navEmoji}>🚀</Text>
          <Text style={styles.navLabel}>Immigrazione</Text>
          <Text style={styles.navCount}>
            {abitantiProposti.length > 0 ? `${abitantiProposti.length} candidati` : "Nessuno"}
          </Text>
        </Pressable>
        <Pressable style={[styles.navButton, isDesktop && styles.navButtonCompact]} onPress={() => router.push("/sanzioni")}>
          <Text style={styles.navEmoji}>⚠️</Text>
          <Text style={styles.navLabel}>Sanzioni</Text>
          <Text style={[styles.navCount, punteggioSanzioni >= 5 && styles.navCountWarning]}>
            {punteggioSanzioni}/10
          </Text>
        </Pressable>
      </View>

      <View style={[styles.navRow, isDesktop && styles.navRowCompact]}>
        <Pressable style={[styles.navButton, isDesktop && styles.navButtonCompact]} onPress={() => router.push("/crimine")}>
          <Text style={styles.navEmoji}>🕵️</Text>
          <Text style={styles.navLabel}>Crimine</Text>
          <Text style={styles.navCount}>{criminali.length} criminali</Text>
        </Pressable>
        <Pressable style={[styles.navButton, isDesktop && styles.navButtonCompact]} onPress={() => router.push("/personalita")}>
          <Text style={styles.navEmoji}>🧠</Text>
          <Text style={styles.navLabel}>Personalità</Text>
          <Text style={styles.navCount}>{personalitàUniche.length} tipi</Text>
        </Pressable>
        <Pressable style={[styles.navButton, isDesktop && styles.navButtonCompact]} onPress={() => router.push("/competenze")}>
          <Text style={styles.navEmoji}>📊</Text>
          <Text style={styles.navLabel}>Competenze</Text>
          <Text style={styles.navCount}>Catalogo</Text>
        </Pressable>
        <Pressable style={[styles.navButton, isDesktop && styles.navButtonCompact]} onPress={() => router.push("/mercato")}>
          <Text style={styles.navEmoji}>🏪</Text>
          <Text style={styles.navLabel}>Mercato</Text>
          <Text style={styles.navCount}>Compra / Vendi</Text>
        </Pressable>
        <Pressable style={[styles.navButton, isDesktop && styles.navButtonCompact]} onPress={() => router.push("/eventi")}>
          <Text style={styles.navEmoji}>📌</Text>
          <Text style={styles.navLabel}>Eventi</Text>
          <Text style={styles.navCount}>Possibili / In corso</Text>
        </Pressable>
        <Pressable style={[styles.navButton, isDesktop && styles.navButtonCompact]} onPress={() => router.push("/pianeti")}>
          <Text style={styles.navEmoji}>🪐</Text>
          <Text style={styles.navLabel}>Pianeti</Text>
          <Text style={styles.navCount}>Razze / Origini</Text>
        </Pressable>
      </View>

      <CreditiModal
        visible={showCreditiModal}
        abitanti={abitanti}
        edifici={edifici}
        onClose={() => setShowCreditiModal(false)}
      />

      <EnergiaModal
        visible={showEnergiaModal}
        edifici={edifici}
        onClose={() => setShowEnergiaModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050816"
  },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 16 },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 1,
    gap: 4
  },
  navRowCompact: {
    paddingHorizontal: 6,
    paddingTop: 1,
    paddingBottom: 0,
    gap: 4
  },
  navButton: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  navButtonCompact: {
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderRadius: 4
  },
  navEmoji: {
    fontSize: 14,
    marginBottom: 0
  },
  navLabel: {
    color: "#e5e7eb",
    fontSize: 10,
    fontWeight: "700"
  },
  navCount: {
    color: "rgba(148,163,184,0.9)",
    fontSize: 8,
    marginTop: 0
  },
  header: {
    paddingTop: 4,
    paddingBottom: 4,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#050816"
  },
  headerCompact: {
    paddingTop: 2,
    paddingBottom: 2,
    paddingHorizontal: 6
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 1
  },
  titleRowCompact: {
    gap: 6,
    marginBottom: 0
  },
  gameTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800"
  },
  gameTitleCompact: {
    fontSize: 13
  },
  diarioButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)",
    gap: 2
  },
  diarioButtonCompact: {
    paddingVertical: 2,
    paddingHorizontal: 4
  },
  diarioEmoji: {
    fontSize: 11
  },
  diarioLabel: {
    color: "#e5e7eb",
    fontSize: 9,
    fontWeight: "600"
  },
  diarioLabelCompact: {
    fontSize: 9
  },
  subtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    marginTop: 0
  },
  meseLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 9,
    marginTop: 0
  },
  skipContainer: {
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 1
  },
  skipButton: {
    backgroundColor: "rgba(59,130,246,0.9)",
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)"
  },
  skipButtonDisabled: {
    backgroundColor: "rgba(59,130,246,0.5)",
    opacity: 0.7
  },
  skipEmoji: {
    fontSize: 12,
    marginRight: 4
  },
  skipButtonText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700"
  },
  scrollContent: {
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 4,
    flex: 1
  },
  section: {
    marginBottom: 3
  },
  sectionCompact: {
    marginBottom: 2
  },
  resourcesSection: {
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 2
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2
  },
  sectionTitleCompact: {
    fontSize: 10,
    marginBottom: 1
  },
  resourcesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  resourcesGridCompact: {
    gap: 4
  },
  resourceCard: {
    flex: 1,
    minWidth: "47%",
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 4,
    padding: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)"
  },
  resourceCardCompact: {
    padding: 4,
    borderRadius: 4,
    minWidth: "15%",
    maxWidth: "20%"
  },
  resourceCardMedia: {
    minWidth: "47%"
  },
  resourceName: {
    color: "#e5e7eb",
    fontSize: 9,
    marginBottom: 1
  },
  resourceEmoji: {
    fontSize: 10,
    marginRight: 1
  },
  resourceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 2
  },
  resourceValue: {
    color: "#e5e7eb",
    fontSize: 10,
    fontWeight: "700"
  },
  resourceUnit: {
    color: "rgba(148,163,184,0.9)",
    fontWeight: "500"
  },
  variazione: {
    fontSize: 9,
    fontWeight: "700"
  },
  variazionePositiva: {
    color: "#4ade80"
  },
  variazioneNegativa: {
    color: "#ef4444"
  },
  navCountWarning: {
    color: "#ef4444",
    fontWeight: "700"
  }
});

