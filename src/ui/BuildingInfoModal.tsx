import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { Building } from "../types";

type BuildingInfoModalProps = {
  visible: boolean;
  building: Building | null;
  onClose: () => void;
};

export function BuildingInfoModal({ visible, building, onClose }: BuildingInfoModalProps) {
  if (!building) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => undefined}>
          <Text style={styles.emoji}>{building.emoji}</Text>
          <Text style={styles.title}>{building.name}</Text>
          <Text style={styles.description}>{building.description}</Text>
          
          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>Tipo:</Text>
            <Text style={styles.infoValue}>{building.type}</Text>
          </View>
          
          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>Posizione:</Text>
            <Text style={styles.infoValue}>
              X: {building.x}, Y: {building.y}
            </Text>
          </View>
          
          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>Dimensioni:</Text>
            <Text style={styles.infoValue}>
              {building.width} x {building.height} celle
            </Text>
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
  emoji: {
    fontSize: 64,
    marginBottom: 16
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333"
  },
  description: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 20
  },
  infoSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee"
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666"
  },
  infoValue: {
    fontSize: 14,
    color: "#333"
  },
  closeButton: {
    marginTop: 20,
    backgroundColor: "#1976d2",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600"
  }
});
