import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  visible: boolean;
  titolo: string;
  messaggio: string;
  emoji?: string;
  onOk: () => void;
  onVediObiettivi: () => void;
};

/** Dialog riutilizzabile quando si sblocca un obiettivo. */
export function ObiettivoSbloccatoModal({
  visible,
  titolo,
  messaggio,
  emoji = "🏆",
  onOk,
  onVediObiettivi
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onOk}>
      <Pressable style={styles.backdrop} onPress={onOk}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.accentLine} />
          <View style={styles.emojiWrap}>
            <Text style={styles.emoji}>{emoji}</Text>
          </View>
          <Text style={styles.titolo}>{titolo}</Text>
          <Text style={styles.messaggio}>{messaggio}</Text>
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.btnPressed]}
              onPress={onVediObiettivi}
            >
              <Text style={styles.secondaryBtnText}>Vedi gli altri Obiettivi</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
              onPress={onOk}
            >
              <Text style={styles.primaryBtnText}>Ok</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(5, 8, 22, 0.92)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
    alignItems: "center",
    gap: 12,
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
    backgroundColor: "#eab308",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20
  },
  emojiWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4
  },
  emoji: { fontSize: 36 },
  titolo: {
    color: "#f1f5f9",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0.3
  },
  messaggio: {
    color: "#cbd5e1",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 8
  },
  actions: {
    width: "100%",
    gap: 10,
    marginTop: 4
  },
  primaryBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)"
  },
  secondaryBtn: {
    backgroundColor: "#334155",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)"
  },
  btnPressed: { opacity: 0.92 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondaryBtnText: { color: "#e2e8f0", fontSize: 15, fontWeight: "700" }
});
