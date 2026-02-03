import React from "react";
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { DESKTOP_MODAL_BREAKPOINT, modalBackdropFullscreen, modalContentFullscreen } from "./modalFullscreenStyles";

type UnreachableModalProps = {
  visible: boolean;
  message: string;
  onClose: () => void;
};

export function UnreachableModal({ visible, message, onClose }: UnreachableModalProps) {
  const { width } = Dimensions.get("window");
  const isDesktop = width > DESKTOP_MODAL_BREAKPOINT;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.modalBackdrop, isDesktop && modalBackdropFullscreen]} onPress={onClose}>
        <Pressable style={[styles.modalCard, isDesktop && modalContentFullscreen]} onPress={() => undefined}>
          <View style={styles.accentLine} />
          <View style={styles.header}>
            <View style={styles.emojiWrap}>
              <Text style={styles.emoji}>⚠️</Text>
            </View>
            <Text style={styles.modalTitle}>Postazione irraggiungibile</Text>
            <View style={styles.titleUnderline} />
          </View>
          <View style={styles.messaggioWrap}>
            <Text style={styles.modalSub}>{message}</Text>
            <Text style={styles.modalHint}>Suggerimento: costruisci ponti e libera il percorso da ostacoli.</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPrimaryPressed]}
            onPress={onClose}
          >
            <Text style={styles.btnTextPrimary}>Chiudi</Text>
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
    alignItems: "center",
    justifyContent: "center",
    padding: 20
  },
  modalCard: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 20,
    backgroundColor: "#0f172a",
    padding: 28,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
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
    backgroundColor: "#f59e0b",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20
  },
  header: { alignItems: "center", marginBottom: 20 },
  emojiWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12
  },
  emoji: { fontSize: 32 },
  modalTitle: {
    color: "#f1f5f9",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center"
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
  modalSub: {
    color: "#cbd5e1",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10
  },
  modalHint: {
    color: "rgba(203, 213, 225, 0.75)",
    fontSize: 13,
    lineHeight: 20
  },
  btnPrimary: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    backgroundColor: "#2563eb",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)"
  },
  btnPrimaryPressed: { backgroundColor: "#1d4ed8", opacity: 0.95 },
  btnTextPrimary: { color: "#ffffff", fontSize: 16, fontWeight: "700" }
});
