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
          <Text style={styles.emoji}>💀</Text>
          <Text style={styles.title}>Hai Perso!</Text>
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
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center"
  },
  modalCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 20,
    padding: 32,
    minWidth: 300,
    maxWidth: 400,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ff0000"
  },
  emoji: {
    fontSize: 80,
    marginBottom: 20
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#ff0000"
  },
  description: {
    fontSize: 18,
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 30,
    lineHeight: 24
  },
  restartButton: {
    backgroundColor: "#ff9800",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200
  },
  restartButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center"
  }
});
