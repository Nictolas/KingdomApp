import React, { useMemo, useState } from "react";
import { Dimensions, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { getServiDellaGlebaPerAssegnazioneEdificio } from "../src/game/edificiLavoro";
import { getEmojiAbitante } from "../src/utils/getEmojiAbitante";
import { modalBackdropFullscreen, modalContentFullscreen } from "../src/ui/modalFullscreenStyles";
import type { Abitante } from "../src/types";

export default function ScuolaScreen() {
  const router = useRouter();
  const { abitanti, edifici, etaMinimaLavoro, assegnaAbitanteAEdificio, rimuoviAbitanteDaEdificio, setStipendioEdificio } = useGameContext();
  const [dropdownProfessoreVisible, setDropdownProfessoreVisible] = useState(false);

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const scuola = edifici.find((e) => e.nome === "Scuola");
  const professoreId = scuola && scuola.abitantiAssegnati.length > 0 ? scuola.abitantiAssegnati[0] : null;
  const professore = professoreId ? abitanti.find((a) => a.id === professoreId) : null;
  const bambini = abitanti.filter((a) => a.eta < etaMinimaLavoro);

  const abitantiDisponibiliProfessore = useMemo(() => {
    if (!scuola || professore) return [];
    return getServiDellaGlebaPerAssegnazioneEdificio(abitanti, edifici, scuola).filter(
      (a) => a.eta >= etaMinimaLavoro
    );
  }, [abitanti, edifici, scuola, professore, etaMinimaLavoro]);

  const puòAssegnareProfessore = abitantiDisponibiliProfessore.length > 0 && !professore;

  if (!scuola) {
    return null;
  }

  return (
    <SafeAreaView style={[styles.safe, maxHeight ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>📚 Scuola</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Informazioni */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Stato Scuola</Text>
          <Text style={styles.infoText}>
            {professore ? `Professore: ${professore.nome}` : "Nessun professore assegnato"}
          </Text>
          <Text style={styles.infoSubtext}>
            Bambini iscritti: {bambini.length}
          </Text>
          <Text style={styles.infoSubtext}>
            Età minima lavoro: {etaMinimaLavoro} anni
          </Text>
        </View>

        <View style={styles.stipendioCard}>
          <Text style={styles.stipendioLabel}>Stipendio mensile per lavoratore (monete)</Text>
          <TextInput
            style={styles.stipendioInput}
            value={String(scuola.stipendioPerLavoratore ?? 0)}
            keyboardType="number-pad"
            onChangeText={(text) => {
              const n = parseInt(text.replace(/[^0-9]/g, ""), 10);
              setStipendioEdificio(scuola.id, isNaN(n) ? 0 : Math.max(0, n));
            }}
          />
          <Text style={styles.infoSubtext}>
            Totale: {(scuola.stipendioPerLavoratore ?? 0) * (scuola.abitantiAssegnati?.length ?? 0)} monete/mese
          </Text>
        </View>

        {/* Professore */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Professore</Text>
          <Pressable
            style={styles.dropdownButton}
            onPress={() => setDropdownProfessoreVisible(true)}
          >
            {professore ? (
              <View style={styles.dropdownContent}>
                <Text style={styles.dropdownEmoji}>{getEmojiAbitante(professore)}</Text>
                <View style={styles.dropdownTextContainer}>
                  <Text style={styles.dropdownNome}>{professore.nome}</Text>
                  <Text style={styles.dropdownCompetenza}>Competenza: {professore.competenza}%</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.dropdownPlaceholder}>Seleziona Professore...</Text>
            )}
            <Text style={styles.dropdownArrow}>▼</Text>
          </Pressable>
          {professore && (
            <Pressable
              style={styles.removeButton}
              onPress={() => rimuoviAbitanteDaEdificio(professore.id, scuola.id)}
            >
              <Text style={styles.removeButtonText}>Rimuovi</Text>
            </Pressable>
          )}

          {/* Modal dropdown */}
          <Modal
            visible={dropdownProfessoreVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setDropdownProfessoreVisible(false)}
          >
            <Pressable
              style={[styles.modalOverlay, isDesktop && modalBackdropFullscreen]}
              onPress={() => setDropdownProfessoreVisible(false)}
            >
              <Pressable style={[styles.modalContent, isDesktop && modalContentFullscreen]} onPress={(e) => e.stopPropagation()}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Seleziona Professore</Text>
                  <Pressable onPress={() => setDropdownProfessoreVisible(false)}>
                    <Text style={styles.modalClose}>✕</Text>
                  </Pressable>
                </View>
                <ScrollView style={styles.modalScrollView}>
                  {abitantiDisponibiliProfessore.length > 0 ? (
                    abitantiDisponibiliProfessore.map((a: Abitante) => (
                      <Pressable
                        key={a.id}
                        style={styles.dropdownItem}
                        onPress={() => {
                          assegnaAbitanteAEdificio(a.id, scuola.id);
                          setDropdownProfessoreVisible(false);
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

        {/* Lista Bambini */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bambini ({bambini.length})</Text>
          {bambini.length > 0 ? (
            <View style={styles.cardsContainer}>
              {bambini.map((bambino: Abitante) => (
                <View key={bambino.id} style={styles.bambinoCard}>
                  <Text style={styles.cardEmoji}>{getEmojiAbitante(bambino)}</Text>
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{bambino.nome}</Text>
                    <Text style={styles.cardInfo}>Età: {bambino.eta} anni</Text>
                    <Text style={styles.cardInfo}>Felicità: {bambino.razza === "Golem" ? "—" : `${bambino.felicità}/100`}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Nessun bambino nel regno</Text>
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
  safe: {
    flex: 1,
    backgroundColor: "#050816"
  },
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
  back: {
    color: "#93c5fd",
    fontSize: 12
  },
  title: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700"
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    paddingBottom: 6,
    gap: 4,
    flex: 1
  },
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
  infoText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2
  },
  infoSubtext: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9,
    marginTop: 2
  },
  stipendioCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  stipendioLabel: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4
  },
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
  section: {
    marginTop: 4
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4
  },
  subsection: {
    marginTop: 6
  },
  subsectionTitle: {
    color: "rgba(203,213,245,0.8)",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4
  },
  professoreCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "#3b82f6",
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  cardsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    alignItems: "center",
    width: "48%",
    minWidth: 120
  },
  bambinoCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: "#3b82f6",
    alignItems: "center",
    width: "48%",
    minWidth: 120
  },
  cardEmoji: {
    fontSize: 24,
    marginBottom: 2
  },
  cardContent: {
    width: "100%",
    alignItems: "center"
  },
  cardTitle: {
    color: "#e5e7eb",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 1,
    textAlign: "center"
  },
  cardLavoro: {
    color: "#93c5fd",
    fontSize: 9,
    marginBottom: 1,
    textAlign: "center"
  },
  cardInfo: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 8,
    textAlign: "center",
    marginBottom: 1
  },
  addButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
    width: "100%",
    alignItems: "center"
  },
  addButtonText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "600"
  },
  removeButton: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    width: 80,
    alignItems: "center"
  },
  removeButtonText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "600"
  },
  emptyText: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 10,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 8
  },
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
  dropdownContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1
  },
  dropdownEmoji: {
    fontSize: 20,
    marginRight: 8
  },
  dropdownTextContainer: {
    flex: 1
  },
  dropdownNome: {
    color: "#e5e7eb",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2
  },
  dropdownCompetenza: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9
  },
  dropdownPlaceholder: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 11,
    flex: 1
  },
  dropdownArrow: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center"
  },
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
  modalTitle: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700"
  },
  modalClose: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 18,
    fontWeight: "700"
  },
  modalScrollView: {
    maxHeight: 300
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.3)"
  },
  dropdownItemEmoji: {
    fontSize: 20,
    marginRight: 10
  },
  dropdownItemTextContainer: {
    flex: 1
  },
  dropdownItemNome: {
    color: "#e5e7eb",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2
  },
  dropdownItemCompetenza: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9
  }
});
