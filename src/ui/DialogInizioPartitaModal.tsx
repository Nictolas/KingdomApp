import React from "react";
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { DESKTOP_MODAL_BREAKPOINT, modalBackdropFullscreen, modalContentFullscreen } from "./modalFullscreenStyles";

type DialogInizioPartitaModalProps = {
  visible: boolean;
  titolo: string;
  messaggio: string;
  onClose: () => void;
};

/** Dialog di inizio partita con estetica del gioco (scuro, bordi, stile Diario/Fazioni). */
export function DialogInizioPartitaModal({
  visible,
  titolo,
  messaggio,
  onClose
}: DialogInizioPartitaModalProps) {
  const { width } = Dimensions.get("window");
  const isDesktop = width > DESKTOP_MODAL_BREAKPOINT;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[styles.modalBackdrop, isDesktop && modalBackdropFullscreen]}
        onPress={onClose}
      >
        <Pressable
          style={[styles.modalCard, isDesktop && modalContentFullscreen]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={styles.emoji}>📜</Text>
            <Text style={styles.title}>{titolo}</Text>
          </View>
          <Text style={styles.messaggio}>{messaggio}</Text>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>OK</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center"
  },
  modalCard: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 24,
    minWidth: 320,
    maxWidth: 420,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  header: {
    alignItems: "center",
    marginBottom: 16
  },
  emoji: {
    fontSize: 48,
    marginBottom: 8
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#e5e7eb",
    textAlign: "center"
  },
  messaggio: {
    color: "#cbd5f5",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "justify",
    marginBottom: 20
  },
  closeButton: {
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
