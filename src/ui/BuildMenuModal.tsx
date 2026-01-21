import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type BuildMenuModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelectBuildType: (buildType: "bridge" | "light") => void;
};

export function BuildMenuModal({ visible, onClose, onSelectBuildType }: BuildMenuModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => undefined}>
          <Text style={styles.title}>Costruisci</Text>
          <Text style={styles.subtitle}>Scegli cosa costruire:</Text>
          
          <View style={styles.optionsContainer}>
            <Pressable
              style={styles.option}
              onPress={() => {
                onSelectBuildType("bridge");
                onClose();
              }}
            >
              <Text style={styles.optionEmoji}>🌉</Text>
              <Text style={styles.optionText}>Ponte</Text>
            </Pressable>
            
            <Pressable
              style={styles.option}
              onPress={() => {
                onSelectBuildType("light");
                onClose();
              }}
            >
              <Text style={styles.optionEmoji}>💡</Text>
              <Text style={styles.optionText}>Luce</Text>
            </Pressable>
          </View>
          
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Chiudi</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center"
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    minWidth: 300,
    maxWidth: 400,
    alignItems: "center"
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333"
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 20
  },
  optionsContainer: {
    width: "100%",
    gap: 12,
    marginBottom: 20
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd"
  },
  optionEmoji: {
    fontSize: 32,
    marginRight: 12
  },
  optionText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333"
  },
  closeButton: {
    marginTop: 12,
    backgroundColor: "#1976d2",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    width: "100%",
    alignItems: "center"
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600"
  }
});
