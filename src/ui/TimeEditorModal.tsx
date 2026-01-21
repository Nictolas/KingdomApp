import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { GameTime } from "../game/gameClock";

type TimeEditorModalProps = {
  visible: boolean;
  gameTime: GameTime;
  onClose: () => void;
  onTimeChange: (hours: number, minutes: number) => void;
};

export function TimeEditorModal({ visible, gameTime, onClose, onTimeChange }: TimeEditorModalProps) {
  const [hours, setHours] = useState(String(gameTime.hours));
  const [minutes, setMinutes] = useState(String(gameTime.minutes));

  const handleSave = () => {
    const h = parseInt(hours, 10);
    const m = parseInt(minutes, 10);
    
    if (!isNaN(h) && !isNaN(m) && h >= 0 && h < 24 && m >= 0 && m < 60) {
      onTimeChange(h, m);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => undefined}>
          <Text style={styles.title}>Modifica Orario</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Ore (0-23):</Text>
            <TextInput
              style={styles.input}
              value={hours}
              onChangeText={setHours}
              keyboardType="numeric"
              maxLength={2}
              selectTextOnFocus
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Minuti (0-59):</Text>
            <TextInput
              style={styles.input}
              value={minutes}
              onChangeText={setMinutes}
              keyboardType="numeric"
              maxLength={2}
              selectTextOnFocus
            />
          </View>
          
          <View style={styles.buttonContainer}>
            <Pressable style={[styles.button, styles.cancelButton]} onPress={onClose}>
              <Text style={styles.buttonText}>Annulla</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.saveButton]} onPress={handleSave}>
              <Text style={styles.buttonText}>Salva</Text>
            </Pressable>
          </View>
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
    marginBottom: 20,
    color: "#333"
  },
  inputContainer: {
    width: "100%",
    marginBottom: 16
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#f9f9f9"
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center"
  },
  cancelButton: {
    backgroundColor: "#ccc"
  },
  saveButton: {
    backgroundColor: "#1976d2"
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600"
  }
});
