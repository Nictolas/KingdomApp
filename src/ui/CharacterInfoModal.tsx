import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { Character } from "../types";

type CharacterInfoModalProps = {
  visible: boolean;
  character: Character | null;
  onClose: () => void;
};

export function CharacterInfoModal({ visible, character, onClose }: CharacterInfoModalProps) {
  if (!character) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => undefined}>
          <Text style={styles.emoji}>{character.emoji}</Text>
          <Text style={styles.title}>{character.name}</Text>
          <Text style={styles.profession}>{character.profession}</Text>
          
          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>Età:</Text>
            <Text style={styles.infoValue}>{character.age} anni</Text>
          </View>
          
          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>Posizione:</Text>
            <Text style={styles.infoValue}>
              X: {Math.round(character.x)}, Y: {Math.round(character.y)}
            </Text>
          </View>
          
          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>Destinazione:</Text>
            <Text style={styles.infoValue}>
              X: {character.targetX}, Y: {character.targetY}
            </Text>
          </View>

          {(character.isInCastle || character.isInFarm || character.isInHouse) && (
            <View style={styles.locationSection}>
              <Text style={styles.locationLabel}>Attualmente in:</Text>
              {character.isInCastle && <Text style={styles.locationValue}>🏰 Castello</Text>}
              {character.isInFarm && <Text style={styles.locationValue}>🌾 Campo</Text>}
              {character.isInHouse && <Text style={styles.locationValue}>🏠 Casa</Text>}
            </View>
          )}

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
    marginBottom: 4,
    color: "#333"
  },
  profession: {
    fontSize: 18,
    color: "#666",
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
  locationSection: {
    width: "100%",
    marginTop: 12,
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 8
  },
  locationLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 4
  },
  locationValue: {
    fontSize: 16,
    color: "#333",
    marginTop: 4
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
