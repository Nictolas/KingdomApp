import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type BuildMenuModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelectLight: () => void;
  onSelectBridge: () => void;
  onCancel: () => void;
};

export function BuildMenuModal({ visible, onClose, onSelectLight, onSelectBridge, onCancel }: BuildMenuModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => undefined}>
          <Text style={styles.modalTitle}>💡 Costruisci</Text>
          <Text style={styles.modalHint}>Seleziona cosa vuoi costruire:</Text>
          <View style={{ marginTop: 12, gap: 8 }}>
            <Pressable style={[styles.btnPrimary, { marginTop: 0 }]} onPress={onSelectLight}>
              <Text style={styles.btnTextPrimary}>💡 Luce (sull'erba)</Text>
            </Pressable>
            <Pressable style={[styles.btnPrimary, { marginTop: 0 }]} onPress={onSelectBridge}>
              <Text style={styles.btnTextPrimary}>🌉 Ponte (sul fiume)</Text>
            </Pressable>
            <Pressable style={[styles.btn, { marginTop: 8 }]} onPress={onCancel}>
              <Text style={styles.btnText}>Annulla</Text>
            </Pressable>
          </View>
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
  modalHint: { color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 8 },
  btnPrimary: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#2f9e44" },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)"
  },
  btnText: { color: "white", fontWeight: "700" },
  btnTextPrimary: { color: "#08210f", fontWeight: "900" }
});
