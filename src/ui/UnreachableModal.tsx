import React from "react";
import { Modal, Pressable, StyleSheet, Text } from "react-native";

type UnreachableModalProps = {
  visible: boolean;
  message: string;
  onClose: () => void;
};

export function UnreachableModal({ visible, message, onClose }: UnreachableModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => undefined}>
          <Text style={styles.modalTitle}>⚠️ Postazione irraggiungibile</Text>
          <Text style={styles.modalSub}>{message}</Text>
          <Text style={styles.modalHint}>Suggerimento: costruisci ponti e libera il percorso da ostacoli.</Text>
          <Pressable style={[styles.btnPrimary, { marginTop: 12 }]} onPress={onClose}>
            <Text style={styles.btnTextPrimary}>Chiudi</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 18 },
  modalCard: {
    width: "100%",
    maxWidth: 460,
    borderRadius: 18,
    backgroundColor: "#0f2b18",
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)"
  },
  modalTitle: { color: "white", fontSize: 18, fontWeight: "900", marginBottom: 8 },
  modalSub: { color: "rgba(255,255,255,0.85)", fontSize: 14, marginBottom: 6 },
  modalHint: { color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 8 },
  btnPrimary: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#2f9e44" },
  btnTextPrimary: { color: "#08210f", fontWeight: "900" }
});
