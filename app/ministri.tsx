import React, { useState } from "react";
import { Dimensions, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { ministeriDisponibili } from "../src/kingdomData";
import { getEmojiAbitante } from "../src/utils/getEmojiAbitante";
import { modalBackdropFullscreen, modalContentFullscreen } from "../src/ui/modalFullscreenStyles";
import type { Abitante } from "../src/types";

export default function MinistriScreen() {
  const router = useRouter();
  const { abitanti, nominaMinistro, rimuoviMinistro } = useGameContext();
  const [showNominaModal, setShowNominaModal] = useState(false);
  const [selectedAbitante, setSelectedAbitante] = useState<Abitante | null>(null);
  const [selectedMinistero, setSelectedMinistero] = useState<string>("");

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const getAssegnatario = (ministero: string) => abitanti.find((a) => a.ministero === ministero);

  const handleApriAssegna = (ministero: string) => {
    setSelectedMinistero(ministero);
    setSelectedAbitante(getAssegnatario(ministero) ?? null);
    setShowNominaModal(true);
  };

  const handleNomina = () => {
    if (selectedAbitante && selectedMinistero) {
      nominaMinistro(selectedAbitante.id, selectedMinistero);
      setShowNominaModal(false);
      setSelectedAbitante(null);
      setSelectedMinistero("");
    }
  };

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Fazioni
        </Text>
        <Text style={styles.title}>Ministri</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.grid}>
          {ministeriDisponibili.map((ministero) => {
            const assegnatario = getAssegnatario(ministero);
            const èAgricoltura = ministero === "Ministero dell'Agricoltura";
            const bonusPolliceVerde = èAgricoltura && assegnatario?.personalità === "Pollice Verde";
            return (
              <View key={ministero} style={styles.card}>
                <Text style={styles.cardMinistero}>{ministero}</Text>
                {assegnatario ? (
                  <>
                    <Text style={styles.cardEmoji}>{assegnatario.emoji}</Text>
                    <Text style={styles.cardTitle}>{assegnatario.nome}</Text>
                    <Text style={styles.line}>Personalità: {assegnatario.personalità}</Text>
                    {bonusPolliceVerde && (
                      <Text style={styles.bonusText}>+10% produzione Cibo (Skip Mese)</Text>
                    )}
                    <View style={styles.cardButtons}>
                      <Pressable style={styles.cambiaButton} onPress={() => handleApriAssegna(ministero)}>
                        <Text style={styles.cambiaButtonText}>Cambia</Text>
                      </Pressable>
                      <Pressable style={styles.removeButton} onPress={() => rimuoviMinistro(assegnatario.id)}>
                        <Text style={styles.removeButtonText}>Rimuovi</Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.nonAssegnato}>Non assegnato</Text>
                    <Pressable style={styles.assegnaButton} onPress={() => handleApriAssegna(ministero)}>
                      <Text style={styles.assegnaButtonText}>Assegna abitante</Text>
                    </Pressable>
                  </>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Modal per nominare un nuovo ministro */}
      <Modal
        visible={showNominaModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNominaModal(false)}
      >
        <Pressable style={[styles.modalBackdrop, isDesktop && modalBackdropFullscreen]} onPress={() => setShowNominaModal(false)}>
          <Pressable style={[styles.modalCard, isDesktop && modalContentFullscreen]} onPress={() => undefined}>
            <Text style={styles.modalTitle}>Nomina Ministro</Text>

            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Seleziona Abitante</Text>
              <ScrollView style={styles.abitantiList} nestedScrollEnabled>
                {abitanti.map((a: Abitante) => (
                  <Pressable
                    key={a.id}
                    style={[
                      styles.abitanteOption,
                      selectedAbitante?.id === a.id && styles.abitanteOptionSelected
                    ]}
                    onPress={() => setSelectedAbitante(a)}
                  >
                    <Text style={styles.abitanteEmoji}>{getEmojiAbitante(a)}</Text>
                    <View style={styles.abitanteInfo}>
                      <Text style={styles.abitanteNome}>{a.nome}</Text>
                      <Text style={styles.abitanteLavoro}>{a.lavoro}</Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Ministero</Text>
              <Text style={styles.modalMinisteroValue}>{selectedMinistero || "—"}</Text>
            </View>

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowNominaModal(false)}
              >
                <Text style={styles.modalButtonText}>Annulla</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalButton,
                  styles.modalButtonConfirm,
                  (!selectedAbitante || !selectedMinistero) && styles.modalButtonDisabled
                ]}
                onPress={handleNomina}
                disabled={!selectedAbitante || !selectedMinistero}
              >
                <Text style={styles.modalButtonText}>{selectedMinistero ? "Conferma" : "Nomina"}</Text>
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
  addButton: {
    color: "#3b82f6",
    fontSize: 12,
    fontWeight: "600"
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    paddingBottom: 8,
    flex: 1
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    alignItems: "center",
    width: "48%",
    minWidth: 140
  },
  cardEmoji: {
    fontSize: 32,
    marginBottom: 4
  },
  cardTitle: {
    color: "#e5e7eb",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
    textAlign: "center"
  },
  line: {
    color: "#cbd5f5",
    fontSize: 10,
    marginBottom: 1,
    textAlign: "center"
  },
  removeButton: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginTop: 6,
    width: "100%",
    alignItems: "center"
  },
  removeButtonText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600"
  },
  cardMinistero: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.3
  },
  cardButtons: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
    width: "100%",
    justifyContent: "center"
  },
  cambiaButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    flex: 1,
    alignItems: "center"
  },
  cambiaButtonText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600"
  },
  assegnaButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 6,
    width: "100%",
    alignItems: "center"
  },
  assegnaButtonText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600"
  },
  nonAssegnato: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 11,
    fontStyle: "italic",
    marginBottom: 6
  },
  bonusText: {
    color: "#4ade80",
    fontSize: 9,
    marginTop: 2,
    fontStyle: "italic"
  },
  modalMinisteroValue: {
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center"
  },
  modalCard: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 16,
    minWidth: 300,
    maxWidth: 450,
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)"
  },
  modalTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center"
  },
  modalSection: {
    marginBottom: 12
  },
  modalLabel: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  abitantiList: {
    maxHeight: 120
  },
  abitanteOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 6,
    marginBottom: 4,
    backgroundColor: "rgba(15,23,42,0.6)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)"
  },
  abitanteOptionSelected: {
    backgroundColor: "rgba(59,130,246,0.2)",
    borderColor: "#3b82f6"
  },
  abitanteEmoji: {
    fontSize: 20,
    marginRight: 8
  },
  abitanteInfo: {
    flex: 1
  },
  abitanteNome: {
    color: "#e5e7eb",
    fontSize: 12,
    fontWeight: "600"
  },
  abitanteLavoro: {
    color: "#93c5fd",
    fontSize: 10
  },
  ministeriList: {
    maxHeight: 150
  },
  ministeroOption: {
    padding: 8,
    borderRadius: 6,
    marginBottom: 4,
    backgroundColor: "rgba(15,23,42,0.6)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)"
  },
  ministeroOptionSelected: {
    backgroundColor: "rgba(59,130,246,0.2)",
    borderColor: "#3b82f6"
  },
  modalButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8
  },
  modalButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center"
  },
  modalButtonCancel: {
    backgroundColor: "rgba(148,163,184,0.2)"
  },
  modalButtonConfirm: {
    backgroundColor: "#3b82f6"
  },
  modalButtonDisabled: {
    backgroundColor: "rgba(59,130,246,0.3)",
    opacity: 0.5
  },
  modalButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600"
  }
});

