import React, { useMemo, useState } from "react";
import { Dimensions, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { getServiDellaGlebaPerAssegnazioneEdificio } from "../src/game/edificiLavoro";
import { getEmojiAbitante } from "../src/utils/getEmojiAbitante";
import { modalBackdropFullscreen, modalContentFullscreen } from "../src/ui/modalFullscreenStyles";
import type { Abitante } from "../src/types";

export default function TribunaleScreen() {
  const router = useRouter();
  const {
    abitanti,
    edifici,
    assegnaAbitanteAEdificio,
    rimuoviAbitanteDaEdificio,
    graziaCriminale,
    condannaAMorte,
    penaDiMorteAttiva
  } = useGameContext();
  const [dropdownGiudiceVisible, setDropdownGiudiceVisible] = useState(false);

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const tribunale = edifici.find((e) => e.nome === "Tribunale");
  const giudiceId = tribunale && tribunale.abitantiAssegnati.length > 0 ? tribunale.abitantiAssegnati[0] : null;
  const giudice = giudiceId ? abitanti.find((a) => a.id === giudiceId) : null;
  const criminali = abitanti.filter((a: Abitante) => (a.reati?.length ?? 0) > 0);
  const abitantiDisponibiliGiudice = useMemo(() => {
    if (!tribunale || giudice) return [];
    return getServiDellaGlebaPerAssegnazioneEdificio(abitanti, edifici, tribunale);
  }, [abitanti, edifici, tribunale, giudice]);

  if (!tribunale) return null;

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>⚖️ Tribunale</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Stato Tribunale</Text>
          <Text style={styles.infoText}>
            {giudice ? `Giudice: ${giudice.nome}` : "Nessun giudice assegnato"}
          </Text>
          <Text style={styles.infoSubtext}>Criminali nella colonia: {criminali.length}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Giudice</Text>
          <Pressable style={styles.dropdownButton} onPress={() => setDropdownGiudiceVisible(true)}>
            {giudice ? (
              <View style={styles.dropdownContent}>
                <Text style={styles.dropdownEmoji}>{getEmojiAbitante(giudice)}</Text>
                <View style={styles.dropdownTextContainer}>
                  <Text style={styles.dropdownNome}>{giudice.nome}</Text>
                  <Text style={styles.dropdownCompetenza}>Competenza: {giudice.competenza}%</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.dropdownPlaceholder}>Seleziona Giudice...</Text>
            )}
            <Text style={styles.dropdownArrow}>▼</Text>
          </Pressable>

          {giudice && (
            <Pressable style={styles.removeButton} onPress={() => rimuoviAbitanteDaEdificio(giudice.id, tribunale.id)}>
              <Text style={styles.removeButtonText}>Rimuovi</Text>
            </Pressable>
          )}

          <Modal
            visible={dropdownGiudiceVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setDropdownGiudiceVisible(false)}
          >
            <Pressable style={[styles.modalOverlay, isDesktop && modalBackdropFullscreen]} onPress={() => setDropdownGiudiceVisible(false)}>
              <Pressable style={[styles.modalContent, isDesktop && modalContentFullscreen]} onPress={(e) => e.stopPropagation()}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Seleziona Giudice</Text>
                  <Pressable onPress={() => setDropdownGiudiceVisible(false)}>
                    <Text style={styles.modalClose}>✕</Text>
                  </Pressable>
                </View>
                <ScrollView style={styles.modalScrollView}>
                  {abitantiDisponibiliGiudice.length > 0 ? (
                    abitantiDisponibiliGiudice.map((a: Abitante) => (
                      <Pressable
                        key={a.id}
                        style={styles.dropdownItem}
                        onPress={() => {
                          assegnaAbitanteAEdificio(a.id, tribunale.id);
                          setDropdownGiudiceVisible(false);
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
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Criminali ({criminali.length})</Text>
          <Text style={styles.sectionHint}>
            Graziare: reati azzerati. Il graziato e i suoi Amici +10% Lealtà; i suoi Nemici −10% Lealtà.
          </Text>
          {criminali.length > 0 ? (
            <View style={styles.cardsContainer}>
              {criminali.map((c) => (
                <View key={c.id} style={styles.criminaleCard}>
                  <Text style={styles.cardEmoji}>{getEmojiAbitante(c)}</Text>
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{c.nome}</Text>
                    <Text style={styles.cardInfo}>Età: {c.eta} anni</Text>
                    <Text style={styles.cardInfo}>
                      Reati: <Text style={styles.cardInfoStrong}>{(c.reati ?? []).join(", ")}</Text>
                    </Text>
                  </View>
                  <View style={styles.criminaleButtons}>
                    <Pressable style={styles.graziaButton} onPress={() => graziaCriminale(c.id)}>
                      <Text style={styles.graziaButtonText}>Grazia</Text>
                    </Pressable>
                    {penaDiMorteAttiva && (
                      <Pressable style={styles.condannaButton} onPress={() => condannaAMorte(c.id)}>
                        <Text style={styles.condannaButtonText}>Condanna a Morte</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Nessun criminale nella colonia</Text>
          )}
        </View>
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
  content: { paddingHorizontal: 12, paddingVertical: 4, paddingBottom: 6, gap: 4, flex: 1 },
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
  infoText: { color: "#ffffff", fontSize: 11, fontWeight: "600", marginBottom: 2 },
  infoSubtext: { color: "rgba(203,213,245,0.7)", fontSize: 9, marginTop: 2 },
  section: { marginTop: 4 },
  sectionTitle: { color: "#ffffff", fontSize: 11, fontWeight: "700", marginBottom: 4 },
  sectionHint: { color: "rgba(203,213,245,0.6)", fontSize: 9, marginBottom: 6 },
  cardsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  criminaleCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: "#f97316",
    alignItems: "center",
    width: "48%",
    minWidth: 120
  },
  criminaleButtons: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
    width: "100%",
    justifyContent: "center"
  },
  graziaButton: {
    backgroundColor: "#22c55e",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    flex: 1,
    alignItems: "center"
  },
  graziaButtonText: { color: "#ffffff", fontSize: 10, fontWeight: "700" },
  condannaButton: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    flex: 1,
    alignItems: "center"
  },
  condannaButtonText: { color: "#ffffff", fontSize: 9, fontWeight: "700" },
  cardEmoji: { fontSize: 24, marginBottom: 2 },
  cardContent: { width: "100%", alignItems: "center" },
  cardTitle: { color: "#e5e7eb", fontSize: 11, fontWeight: "700", marginBottom: 1, textAlign: "center" },
  cardInfo: { color: "rgba(203,213,245,0.7)", fontSize: 8, textAlign: "center", marginBottom: 1 },
  cardInfoStrong: { color: "#ffffff", fontWeight: "700" },
  emptyText: { color: "rgba(203,213,245,0.5)", fontSize: 10, fontStyle: "italic", textAlign: "center", paddingVertical: 8 },

  dropdownButton: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6
  },
  dropdownContent: { flexDirection: "row", alignItems: "center", flex: 1 },
  dropdownEmoji: { fontSize: 20, marginRight: 8 },
  dropdownTextContainer: { flex: 1 },
  dropdownNome: { color: "#e5e7eb", fontSize: 11, fontWeight: "700", marginBottom: 2 },
  dropdownCompetenza: { color: "rgba(203,213,245,0.7)", fontSize: 9 },
  dropdownPlaceholder: { color: "rgba(203,213,245,0.5)", fontSize: 11, flex: 1 },
  dropdownArrow: { color: "rgba(203,213,245,0.7)", fontSize: 10 },

  removeButton: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    width: 80,
    alignItems: "center"
  },
  removeButtonText: { color: "#ffffff", fontSize: 9, fontWeight: "600" },

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

