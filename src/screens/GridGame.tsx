import React, { useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { fazioniData, leggiData } from "../kingdomData";
import { useGameContext } from "../context/GameContext";
import type { Risorsa, Abitante } from "../types";
import { CiboConsumoModal } from "../ui/CiboConsumoModal";
import { CreditiModal } from "../ui/CreditiModal";
import { EnergiaModal } from "../ui/EnergiaModal";

export default function GridGame() {
  const router = useRouter();
  const { abitanti, risorse, edifici, mese, anno, isLoading, avanzaMese, calcolaProduzioneConsumo, calcolaDeltaOrdiniMercato, abitantiProposti, punteggioSanzioni } = useGameContext();
  const [showCiboModal, setShowCiboModal] = useState(false);
  const [showCreditiModal, setShowCreditiModal] = useState(false);
  const [showEnergiaModal, setShowEnergiaModal] = useState(false);

  const ministriAttuali = abitanti.filter((a: Abitante) => a.ministero);
  const criminali = abitanti.filter((a: Abitante) => (a.reati?.length ?? 0) > 0);
  const personalitàUniche = Array.from(new Set(abitanti.map((a: Abitante) => a.personalità))).filter(Boolean);
  const fazioni = fazioniData;
  const leggi = leggiData;

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;

  const variazioni = calcolaProduzioneConsumo();
  const deltaOrdini = calcolaDeltaOrdiniMercato();

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
              <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 6 }} />
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

      {/* Risorse */}
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
                    ? () => setShowCiboModal(true)
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
        </View>
      </View>

      <View style={[styles.navRow, isDesktop && styles.navRowCompact]}>
        <Pressable style={[styles.navButton, isDesktop && styles.navButtonCompact]} onPress={() => router.push("/abitanti")}>
          <Text style={styles.navEmoji}>👥</Text>
          <Text style={styles.navLabel}>Abitanti</Text>
          <Text style={styles.navCount}>{abitanti.length} totali</Text>
        </Pressable>
        <Pressable style={[styles.navButton, isDesktop && styles.navButtonCompact]} onPress={() => router.push("/ministri")}>
          <Text style={styles.navEmoji}>🏛️</Text>
          <Text style={styles.navLabel}>Ministri</Text>
          <Text style={styles.navCount}>{ministriAttuali.length} in carica</Text>
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

      <CiboConsumoModal
        visible={showCiboModal}
        abitanti={abitanti}
        edifici={edifici}
        onClose={() => setShowCiboModal(false)}
      />

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
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 2,
    gap: 8
  },
  navButton: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  navEmoji: {
    fontSize: 16,
    marginBottom: 2
  },
  navLabel: {
    color: "#e5e7eb",
    fontSize: 11,
    fontWeight: "700"
  },
  navCount: {
    color: "rgba(148,163,184,0.9)",
    fontSize: 9,
    marginTop: 1
  },
  header: {
    paddingTop: 8,
    paddingBottom: 6,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#050816"
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2
  },
  gameTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800"
  },
  diarioButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)",
    gap: 4
  },
  diarioEmoji: {
    fontSize: 12
  },
  diarioLabel: {
    color: "#e5e7eb",
    fontSize: 10,
    fontWeight: "600"
  },
  subtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    marginTop: 1
  },
  meseLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    marginTop: 2
  },
  skipContainer: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 2
  },
  skipButton: {
    backgroundColor: "rgba(59,130,246,0.9)",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
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
    fontSize: 14,
    marginRight: 6
  },
  skipButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700"
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 8,
    flex: 1
  },
  section: {
    marginBottom: 6
  },
  resourcesSection: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 4
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4
  },
  resourcesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  resourceCard: {
    flex: 1,
    minWidth: "48%",
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)"
  },
  resourceName: {
    color: "#e5e7eb",
    fontSize: 10,
    marginBottom: 2
  },
  resourceEmoji: {
    fontSize: 11,
    marginRight: 2
  },
  resourceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4
  },
  resourceValue: {
    color: "#e5e7eb",
    fontSize: 11,
    fontWeight: "700"
  },
  resourceUnit: {
    color: "rgba(148,163,184,0.9)",
    fontWeight: "500"
  },
  variazione: {
    fontSize: 10,
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

