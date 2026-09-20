import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { Abitante } from "../types";
import { AbitanteAvatarPreview } from "./AbitanteAvatarPreview";

type ConsigliereIntroModalProps = {
  visible: boolean;
  consigliere: Abitante | null | undefined;
  messaggio: string;
  onClose: () => void;
};

/** Intro del Consigliere: faccia + nuvoletta con le sue parole (sempre card centrata, non fullscreen). */
export function ConsigliereIntroModal({
  visible,
  consigliere,
  messaggio,
  onClose
}: ConsigliereIntroModalProps) {
  const nome = consigliere?.nome?.trim() || "Consigliere";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <View style={styles.accentLine} />
          <Text style={styles.title}>Il Consigliere</Text>

          <View style={styles.dialogRow}>
            <View style={styles.speakerCol}>
              <View style={styles.avatarRing}>
                {consigliere ? (
                  <AbitanteAvatarPreview abitante={consigliere} size={80} liftPx={0} faceOnly />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarFallbackText}>📜</Text>
                  </View>
                )}
              </View>
              <Text style={styles.speakerName} numberOfLines={2}>
                {nome}
              </Text>
              <Text style={styles.speakerRole}>Consigliere</Text>
            </View>

            <View style={styles.bubbleCol}>
              <View style={styles.bubbleTail} />
              <View style={styles.bubble}>
                <Text style={styles.bubbleText}>{messaggio}</Text>
              </View>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>Ok</Text>
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
    padding: 24,
    minWidth: 320,
    maxWidth: 520,
    width: "100%",
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
    backgroundColor: "#3b82f6",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f1f5f9",
    textAlign: "center",
    marginBottom: 18,
    letterSpacing: 0.3
  },
  dialogRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    marginBottom: 22
  },
  speakerCol: {
    alignItems: "center",
    width: 132,
    paddingTop: 4
  },
  avatarRing: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    borderWidth: 2,
    borderColor: "rgba(147, 197, 253, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 8
  },
  avatarFallback: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(30, 41, 59, 0.9)"
  },
  avatarFallbackText: {
    fontSize: 40
  },
  speakerName: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center"
  },
  speakerRole: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
    textAlign: "center"
  },
  bubbleCol: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    minWidth: 0,
    paddingTop: 8
  },
  bubbleTail: {
    width: 0,
    height: 0,
    marginTop: 28,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderRightWidth: 14,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderRightColor: "#1e293b",
    marginRight: -1
  },
  bubble: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 18,
    borderTopLeftRadius: 6,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.28)",
    minHeight: 100
  },
  bubbleText: {
    color: "#e2e8f0",
    fontSize: 15,
    lineHeight: 24
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
