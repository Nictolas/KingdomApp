import React, { useMemo, useState, useSyncExternalStore } from "react";
import { Dimensions, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useGameContext } from "../../src/context/GameContext";
import { computeStatoCielo } from "../../src/game/cicloCielo";
import { abitantiPresentiNelBarOra } from "../../src/game/orariLavoroMappa";
import {
  getBarArrivatiMappaSnapshotForEdificio,
  subscribeBarArrivatiMappa
} from "../../src/game/mappaBarArrivatiStore";
import { formatOrologioGioco } from "../../src/game/orologioGiocoSession";
import { useOrologioGioco } from "../../src/hooks/useOrologioGioco";
import { getServiDellaGlebaPerAssegnazioneEdificio } from "../../src/game/edificiLavoro";
import { getEmojiAbitante } from "../../src/utils/getEmojiAbitante";
import { modalBackdropFullscreen, modalContentFullscreen } from "../../src/ui/modalFullscreenStyles";
import type { Abitante } from "../../src/types";

export default function BarScreenById() {
  const router = useRouter();
  const raw = useLocalSearchParams<{ id: string | string[] }>().id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const edificioId = Number(idStr);

  const { abitanti, edifici, assegnaAbitanteAEdificio, rimuoviAbitanteDaEdificio, setStipendioEdificio } = useGameContext();
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const { minuti: orologioMinuti, inPausa: orologioInPausa, togglePausa: toggleOrologioPausa } =
    useOrologioGioco();
  const statoCielo = computeStatoCielo(orologioMinuti);

  const barArrivatiMappa = useSyncExternalStore(
    subscribeBarArrivatiMappa,
    () => getBarArrivatiMappaSnapshotForEdificio(edificioId),
    () => getBarArrivatiMappaSnapshotForEdificio(edificioId)
  );

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const bar = useMemo(
    () => edifici.find((e) => e.id === edificioId && e.nome === "Bar"),
    [edifici, edificioId]
  );

  const candidatiBar = abitantiPresentiNelBarOra(abitanti, orologioMinuti, statoCielo.buio, edifici);
  const presentiOraDisoccupati =
    barArrivatiMappa.size > 0
      ? candidatiBar.filter((a) => barArrivatiMappa.has(a.id))
      : candidatiBar;
  const addettiIds = bar?.abitantiAssegnati ?? [];
  const visitatoriDisoccupati = presentiOraDisoccupati.filter((a) => !addettiIds.includes(a.id));
  const addetti = addettiIds.map((id) => abitanti.find((a) => a.id === id)).filter((a): a is Abitante => a != null);
  const abitantiDisponibili = useMemo(() => {
    if (!bar) return [];
    return getServiDellaGlebaPerAssegnazioneEdificio(abitanti, edifici, bar);
  }, [abitanti, edifici, bar]);

  if (!Number.isFinite(edificioId) || !bar) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.title}>Bar non trovato</Text>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Indietro
        </Text>
      </SafeAreaView>
    );
  }

  const titoloBar = edificioId === 17 ? "🍺 Bar" : `🍺 Bar (#${edificioId})`;

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>{titoloBar}</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Stato Bar</Text>
          <View style={styles.clockRow}>
            <Text style={styles.clockLine}>
              🕐 Ora di gioco: {formatOrologioGioco(orologioMinuti)}
              {orologioInPausa ? " (in pausa)" : ""}
            </Text>
            <Pressable
              style={[styles.orologioPausaBtn, orologioInPausa && styles.orologioPausaBtnAttivo]}
              onPress={toggleOrologioPausa}
              accessibilityLabel={orologioInPausa ? "Riprendi il tempo" : "Metti in pausa il tempo"}
            >
              <Text style={styles.orologioPausaBtnText}>{orologioInPausa ? "▶️" : "⏸️"}</Text>
            </Pressable>
          </View>
          <Text style={styles.infoText}>
            Addetti: {addetti.length}/{bar.capacità ?? 20}
          </Text>
          <Text style={styles.infoSubtext}>
            Luogo di ritrovo per bere, socializzare e rilassarsi dopo il lavoro.
          </Text>
        </View>

        <View style={styles.visitatoriCard}>
          <Text style={styles.sectionTitle}>Ora al Bar (visitatori)</Text>
          <Text style={styles.infoSubtext}>
            Di giorno, fuori dall’orario di lavoro (es. prima delle 8 o dopo le 17), colonisti e lavoratori
            in pausa si trovano qui; di notte sono a casa.
          </Text>
          {visitatoriDisoccupati.length > 0 ? (
            <View style={styles.cardsContainer}>
              {visitatoriDisoccupati.map((a) => (
                <View key={a.id} style={styles.visitatoreRow}>
                  <Text style={styles.cardEmoji}>{getEmojiAbitante(a)}</Text>
                  <Text style={styles.visitatoreNome} numberOfLines={1}>
                    {a.nome}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyVisitatori}>
              Nessuno in questo momento (notte o nessun disoccupato in visita).
            </Text>
          )}
        </View>

        <View style={styles.stipendioCard}>
          <Text style={styles.stipendioLabel}>Stipendio mensile per lavoratore (crediti)</Text>
          <TextInput
            style={styles.stipendioInput}
            value={String(bar.stipendioPerLavoratore ?? 0)}
            keyboardType="number-pad"
            onChangeText={(text) => {
              const n = parseInt(text.replace(/[^0-9]/g, ""), 10);
              setStipendioEdificio(bar.id, isNaN(n) ? 0 : Math.max(0, n));
            }}
          />
          <Text style={styles.infoSubtext}>
            Totale: {(bar.stipendioPerLavoratore ?? 0) * addettiIds.length} crediti/mese
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Addetti</Text>
          {addettiIds.length < (bar.capacità ?? 20) && (
            <Pressable style={styles.addButton} onPress={() => setDropdownVisible(true)}>
              <Text style={styles.addButtonText}>+ Aggiungi addetto</Text>
            </Pressable>
          )}
          {addetti.length > 0 && (
            <View style={styles.cardsContainer}>
              {addetti.map((a) => (
                <View key={a.id} style={styles.personCard}>
                  <Text style={styles.cardEmoji}>{getEmojiAbitante(a)}</Text>
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{a.nome}</Text>
                    <Text style={styles.cardInfo}>Competenza: {a.competenza}%</Text>
                  </View>
                  <Pressable
                    style={styles.removeButton}
                    onPress={() => rimuoviAbitanteDaEdificio(a.id, bar.id)}
                  >
                    <Text style={styles.removeButtonText}>Rimuovi</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        <Modal visible={dropdownVisible} transparent animationType="fade" onRequestClose={() => setDropdownVisible(false)}>
          <Pressable style={[styles.modalOverlay, isDesktop && modalBackdropFullscreen]} onPress={() => setDropdownVisible(false)}>
            <Pressable style={[styles.modalContent, isDesktop && modalContentFullscreen]} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Seleziona addetto</Text>
                <Pressable onPress={() => setDropdownVisible(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </Pressable>
              </View>
              <ScrollView style={styles.modalScrollView}>
                {abitantiDisponibili.length > 0 ? (
                  abitantiDisponibili.map((a) => (
                    <Pressable
                      key={a.id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        assegnaAbitanteAEdificio(a.id, bar.id);
                        setDropdownVisible(false);
                      }}
                    >
                      <Text style={styles.dropdownItemEmoji}>{getEmojiAbitante(a)}</Text>
                      <View style={styles.dropdownItemTextContainer}>
                        <Text style={styles.dropdownItemNome}>{a.nome}</Text>
                        <Text style={styles.dropdownItemCompetenza}>Competenza: {a.competenza}%</Text>
                      </View>
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.emptyText}>Nessun abitante disponibile</Text>
                )}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      </ScrollView>
      </View>
      <View style={styles.footer}>
        <Text style={styles.back} onPress={() => router.back()}>← Edifici</Text>
      </View>
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
  content: { paddingHorizontal: 12, paddingVertical: 8, paddingBottom: 24 },
  infoCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  infoTitle: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  clockRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6
  },
  clockLine: { flex: 1, color: "rgba(203,213,245,0.85)", fontSize: 10 },
  orologioPausaBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(30,41,59,0.6)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)"
  },
  orologioPausaBtnAttivo: {
    backgroundColor: "rgba(37,99,235,0.35)",
    borderColor: "rgba(96,165,250,0.45)"
  },
  orologioPausaBtnText: { fontSize: 14 },
  infoText: { color: "#ffffff", fontSize: 11, fontWeight: "600", marginBottom: 2 },
  infoSubtext: { color: "rgba(203,213,245,0.7)", fontSize: 9, marginTop: 2 },
  stipendioCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  stipendioLabel: { color: "#93c5fd", fontSize: 10, fontWeight: "600", marginBottom: 4 },
  stipendioInput: {
    backgroundColor: "rgba(30,41,59,0.9)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)",
    borderRadius: 4,
    padding: 6,
    color: "#e5e7eb",
    fontSize: 14,
    minWidth: 80
  },
  visitatoriCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  visitatoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4
  },
  visitatoreNome: { color: "#e5e7eb", fontSize: 11, fontWeight: "600", flex: 1 },
  emptyVisitatori: {
    color: "rgba(203,213,245,0.55)",
    fontSize: 9,
    fontStyle: "italic",
    marginTop: 4
  },
  section: { marginTop: 12 },
  sectionTitle: { color: "#ffffff", fontSize: 11, fontWeight: "700", marginBottom: 6 },
  addButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 4,
    marginBottom: 8,
    alignItems: "center"
  },
  addButtonText: { color: "#ffffff", fontSize: 10, fontWeight: "600" },
  cardsContainer: { gap: 6 },
  personCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  cardEmoji: { fontSize: 22 },
  cardContent: { flex: 1 },
  cardTitle: { color: "#e5e7eb", fontSize: 11, fontWeight: "700", marginBottom: 2 },
  cardInfo: { color: "rgba(203,213,245,0.7)", fontSize: 9 },
  removeButton: { backgroundColor: "#ef4444", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  removeButtonText: { color: "#ffffff", fontSize: 9, fontWeight: "600" },
  emptyText: { color: "rgba(203,213,245,0.5)", fontSize: 10, fontStyle: "italic", textAlign: "center", paddingVertical: 12 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" },
  modalContent: {
    backgroundColor: "#050816",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    width: "80%",
    maxWidth: 400,
    maxHeight: "70%"
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.6)"
  },
  modalTitle: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  modalClose: { color: "rgba(203,213,245,0.7)", fontSize: 18, fontWeight: "700" },
  modalScrollView: { maxHeight: 300 },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.3)"
  },
  dropdownItemEmoji: { fontSize: 20, marginRight: 10 },
  dropdownItemTextContainer: { flex: 1 },
  dropdownItemNome: { color: "#e5e7eb", fontSize: 11, fontWeight: "700", marginBottom: 2 },
  dropdownItemCompetenza: { color: "rgba(203,213,245,0.7)", fontSize: 9 }
});
