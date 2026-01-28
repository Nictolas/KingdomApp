import React, { useState } from "react";
import { Dimensions, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import type { Abitante } from "../src/types";

export default function OspedaleScreen() {
  const router = useRouter();
  const { abitanti, edifici, assegnaAbitanteAEdificio, rimuoviAbitanteDaEdificio } = useGameContext();
  const [dropdownDottoreVisible, setDropdownDottoreVisible] = useState(false);

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  // Trova l'Ospedale
  const ospedale = edifici.find((e) => e.nome === "Ospedale Coloniale");
  if (!ospedale) {
    return null;
  }

  // Il dottore è il primo (e unico) abitante assegnato all'ospedale
  const dottoreId = ospedale.abitantiAssegnati.length > 0 ? ospedale.abitantiAssegnati[0] : null;
  const dottore = dottoreId ? abitanti.find((a) => a.id === dottoreId) : null;

  // I malati sono tutti gli abitanti con salute > 70 (Obesi)
  const malati = abitanti.filter((a) => a.salute > 70);

  // Abitanti disponibili per essere dottore (non già dottore)
  const abitantiDisponibiliDottore = abitanti.filter((a) => a.id !== dottoreId);

  const puòAssegnareDottore = abitantiDisponibiliDottore.length > 0 && !dottore;

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Edifici
        </Text>
        <Text style={styles.title}>🏥 Ospedale Coloniale</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Informazioni */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Stato Ospedale</Text>
          <Text style={styles.infoText}>
            {dottore ? `Dottore: ${dottore.nome}` : "Nessun dottore assegnato"}
          </Text>
          <Text style={styles.infoSubtext}>
            Malati nella colonia: {malati.length}
          </Text>
        </View>

        {/* Dottore */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dottore</Text>
          <Pressable
            style={styles.dropdownButton}
            onPress={() => setDropdownDottoreVisible(true)}
          >
            {dottore ? (
              <View style={styles.dropdownContent}>
                <Text style={styles.dropdownEmoji}>{dottore.emoji}</Text>
                <View style={styles.dropdownTextContainer}>
                  <Text style={styles.dropdownNome}>{dottore.nome}</Text>
                  <Text style={styles.dropdownCompetenza}>Competenza: {dottore.competenza}%</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.dropdownPlaceholder}>Seleziona Dottore...</Text>
            )}
            <Text style={styles.dropdownArrow}>▼</Text>
          </Pressable>
          {dottore && (
            <Pressable
              style={styles.removeButton}
              onPress={() => rimuoviAbitanteDaEdificio(dottore.id, ospedale.id)}
            >
              <Text style={styles.removeButtonText}>Rimuovi</Text>
            </Pressable>
          )}

          {/* Modal dropdown */}
          <Modal
            visible={dropdownDottoreVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setDropdownDottoreVisible(false)}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setDropdownDottoreVisible(false)}
            >
              <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Seleziona Dottore</Text>
                  <Pressable onPress={() => setDropdownDottoreVisible(false)}>
                    <Text style={styles.modalClose}>✕</Text>
                  </Pressable>
                </View>
                <ScrollView style={styles.modalScrollView}>
                  {abitantiDisponibiliDottore.length > 0 ? (
                    abitantiDisponibiliDottore.map((a: Abitante) => (
                      <Pressable
                        key={a.id}
                        style={styles.dropdownItem}
                        onPress={() => {
                          assegnaAbitanteAEdificio(a.id, ospedale.id);
                          setDropdownDottoreVisible(false);
                        }}
                      >
                        <Text style={styles.dropdownItemEmoji}>{a.emoji}</Text>
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

        {/* Lista Malati */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Malati ({malati.length})</Text>
          {malati.length > 0 ? (
            <View style={styles.cardsContainer}>
              {malati.map((malato: Abitante) => (
                <View key={malato.id} style={styles.malatoCard}>
                  <Text style={styles.cardEmoji}>{malato.emoji}</Text>
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{malato.nome}</Text>
                    <Text style={styles.cardInfo}>Età: {malato.eta} anni</Text>
                    <Text style={styles.cardInfo}>Salute: {malato.salute}% (Obeso)</Text>
                    <Text style={styles.cardInfo}>Felicità: {malato.felicità}/100</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Nessun malato nella colonia</Text>
          )}
        </View>
      </ScrollView>
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
  dottoreCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "#ef4444",
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
  malatoCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: "#f97316",
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
