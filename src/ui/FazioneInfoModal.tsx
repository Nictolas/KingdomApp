import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Fazione } from "../types";

type FazioneInfoModalProps = {
  visible: boolean;
  fazione: Fazione | null;
  onClose: () => void;
};

export function FazioneInfoModal({ visible, fazione, onClose }: FazioneInfoModalProps) {
  if (!fazione) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => undefined}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <Text style={styles.emoji}>{fazione.emoji}</Text>
              <Text style={styles.title}>{fazione.nome}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Descrizione</Text>
              <Text style={styles.descrizione}>{fazione.descrizione}</Text>
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
    textAlign: "center"
  },
  section: {
    marginTop: 12
  },
  sectionLabel: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  descrizione: {
    color: "#cbd5f5",
    fontSize: 15,
    lineHeight: 22
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
