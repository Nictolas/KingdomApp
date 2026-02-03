import React from "react";
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { DESKTOP_MODAL_BREAKPOINT, modalBackdropFullscreen, modalContentFullscreen } from "./modalFullscreenStyles";

type DialogInizioPartitaModalProps = {
  visible: boolean;
  titolo: string;
  messaggio: string;
  onClose: () => void;
  /** Emoji mostrata sopra il titolo (default 📜). */
  emoji?: string;
};

/** Dialog con estetica del gioco: Diario, Emigrazione, ecc. */
export function DialogInizioPartitaModal({
  visible,
  titolo,
  messaggio,
  onClose,
  emoji = "📜"
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
          <View style={styles.accentLine} />
          <View style={styles.header}>
            <View style={styles.emojiWrap}>
              <Text style={styles.emoji}>{emoji}</Text>
            </View>
            <Text style={styles.title}>{titolo}</Text>
            <View style={styles.titleUnderline} />
          </View>
          <View style={styles.messaggioWrap}>
            <Text style={styles.messaggio}>{messaggio}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
            onPress={onClose}
          >
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
    backgroundColor: "rgba(5, 8, 22, 0.92)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  modalCard: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 28,
    minWidth: 320,
    maxWidth: 440,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
    // Ombra
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16
  },
  accentLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "#3b82f6",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20
  },
  header: {
    alignItems: "center",
    marginBottom: 20
  },
  emojiWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12
  },
  emoji: {
    fontSize: 36
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#f1f5f9",
    textAlign: "center",
    letterSpacing: 0.3
  },
  titleUnderline: {
    width: 48,
    height: 2,
    backgroundColor: "rgba(148, 163, 184, 0.4)",
    marginTop: 10,
    borderRadius: 1
  },
  messaggioWrap: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 12,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)"
  },
  messaggio: {
    color: "#cbd5e1",
    fontSize: 15,
    lineHeight: 24,
    textAlign: "justify"
  },
  closeButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)"
  },
  closeButtonPressed: {
    backgroundColor: "#1d4ed8",
    opacity: 0.95
  },
  closeButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5
  }
});
