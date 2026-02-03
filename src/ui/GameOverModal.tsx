import React from "react";
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { DESKTOP_MODAL_BREAKPOINT, modalBackdropFullscreen, modalContentFullscreen } from "./modalFullscreenStyles";

type GameOverModalProps = {
  visible: boolean;
  onRestart: () => void;
};

export function GameOverModal({ visible, onRestart }: GameOverModalProps) {
  const { width } = Dimensions.get("window");
  const isDesktop = width > DESKTOP_MODAL_BREAKPOINT;
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={[styles.modalBackdrop, isDesktop && modalBackdropFullscreen]}>
        <View style={[styles.modalCard, isDesktop && modalContentFullscreen]}>
          <View style={styles.accentLine} />
          <Text style={styles.emoji}>💀</Text>
          <Text style={styles.title}>Hai Perso!</Text>
          <View style={styles.titleUnderline} />
          <Text style={styles.description}>
            Il Re è stato catturato dall'Orco.{"\n"}
            Il regno è caduto...
          </Text>
          
          <Pressable style={styles.restartButton} onPress={onRestart}>
            <Text style={styles.restartButtonText}>Ricomincia</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(5, 8, 22, 0.94)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  modalCard: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 32,
    minWidth: 300,
    maxWidth: 420,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    elevation: 12,
    shadowColor: "#7f1d1d",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16
  },
  accentLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "#dc2626",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
    color: "#fca5a5",
    letterSpacing: 0.5
  },
  titleUnderline: {
    width: 56,
    height: 2,
    backgroundColor: "rgba(239, 68, 68, 0.5)",
    marginBottom: 20,
    borderRadius: 1
  },
  description: {
    fontSize: 16,
    color: "#cbd5e1",
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 24
  },
  restartButton: {
    backgroundColor: "#ea580c",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 200,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(251, 146, 60, 0.4)"
  },
  restartButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center"
  }
});
