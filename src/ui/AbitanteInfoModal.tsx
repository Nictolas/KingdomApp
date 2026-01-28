import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Abitante } from "../types";

type AbitanteInfoModalProps = {
  visible: boolean;
  abitante: Abitante | null;
  onClose: () => void;
  getAbitanteNome: (id: number) => string;
};

export function AbitanteInfoModal({
  visible,
  abitante,
  onClose,
  getAbitanteNome
}: AbitanteInfoModalProps) {
  if (!abitante) return null;

  const formatPercentuale = (valore: number) => `${valore}%`;
  const formatMonete = (valore: number) => `${valore} crediti`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => undefined}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <Text style={styles.emoji}>{abitante.emoji}</Text>
              <Text style={styles.title}>{abitante.nome}</Text>
              <Text style={styles.lavoro}>{abitante.lavoro}</Text>
            </View>

            {/* Informazioni base */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Informazioni Base</Text>
              <Text style={styles.line}>Età: {abitante.eta} anni</Text>
              <Text style={styles.line}>Fazione: {abitante.fazione}</Text>
              <Text style={styles.line}>Personalità: {abitante.personalità}</Text>
            </View>

            {/* Competenze e stato */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Competenze e Stato</Text>
              <Text style={styles.line}>Competenza: {formatPercentuale(abitante.competenza)}</Text>
              <Text style={styles.line}>Produttività: {formatPercentuale(abitante.produttività)}</Text>
              <Text style={styles.line}>Stanchezza: {formatPercentuale(abitante.stanchezza)}</Text>
              <Text style={styles.line}>Salute: {formatPercentuale(abitante.salute)}</Text>
            </View>

            {/* Relazioni */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Relazioni</Text>
              {abitante.amici.length > 0 ? (
                <Text style={styles.line}>
                  Amici: {abitante.amici.map((id) => getAbitanteNome(id)).join(", ")}
                </Text>
              ) : (
                <Text style={styles.lineMuted}>Nessun amico</Text>
              )}
              {abitante.rivali.length > 0 ? (
                <Text style={styles.line}>
                  Rivali: {abitante.rivali.map((id) => getAbitanteNome(id)).join(", ")}
                </Text>
              ) : (
                <Text style={styles.lineMuted}>Nessun rivale</Text>
              )}
            </View>

            {/* Economia */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Economia</Text>
              <Text style={styles.line}>Crediti: {formatMonete(abitante.crediti)}</Text>
              <Text style={styles.line}>Reddito: {formatMonete(abitante.reddito)}/mese</Text>
              <Text style={styles.line}>Spese: {formatMonete(abitante.spese)}/mese</Text>
              <Text style={styles.line}>
                Saldo mensile: {formatMonete(abitante.reddito - abitante.spese)}
              </Text>
            </View>

            {/* Sentimenti */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Sentimenti</Text>
              <Text style={styles.line}>Lealtà: {formatPercentuale(abitante.lealtà)}</Text>
              <Text style={styles.line}>Paura: {formatPercentuale(abitante.paura)}</Text>
            </View>

            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Chiudi</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center"
  },
  modalCard: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 20,
    minWidth: 320,
    maxWidth: 400,
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)"
  },
  header: {
    alignItems: "center",
    marginBottom: 20
  },
  emoji: {
    fontSize: 64,
    marginBottom: 12
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#e5e7eb",
    marginBottom: 4,
    textAlign: "center"
  },
  lavoro: {
    fontSize: 16,
    color: "#93c5fd",
    textAlign: "center"
  },
  section: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.2)"
  },
  sectionLabel: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  line: {
    color: "#cbd5f5",
    fontSize: 14,
    marginBottom: 6
  },
  lineMuted: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 14,
    marginBottom: 6,
    fontStyle: "italic"
  },
  closeButton: {
    marginTop: 20,
    backgroundColor: "#3b82f6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center"
  },
  closeButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600"
  }
});
