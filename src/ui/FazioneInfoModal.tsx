import React from "react";
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Abitante, Fazione } from "../types";
import { getEmojiAbitante } from "../utils/getEmojiAbitante";
import { DESKTOP_MODAL_BREAKPOINT, modalBackdropFullscreen, modalContentFullscreen } from "./modalFullscreenStyles";

type FazioneInfoModalProps = {
  visible: boolean;
  fazione: Fazione | null;
  abitanti?: Abitante[];
  onClose: () => void;
};

export function FazioneInfoModal({ visible, fazione, abitanti = [], onClose }: FazioneInfoModalProps) {
  if (!fazione) return null;
  const { width } = Dimensions.get("window");
  const isDesktop = width > DESKTOP_MODAL_BREAKPOINT;
  // "Robots": membri = tutti gli abitanti con razza Robot (fazione automatica)
  const membri =
    fazione.nome === "Robots"
      ? abitanti.filter((a) => a.razza === "Robot")
      : abitanti.filter((a) => a.fazioni?.includes(fazione.nome));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.modalBackdrop, isDesktop && modalBackdropFullscreen]} onPress={onClose}>
        <Pressable style={[styles.modalCard, isDesktop && modalContentFullscreen]} onPress={() => undefined}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <Text style={styles.emoji}>{fazione.emoji}</Text>
              <Text style={styles.title}>{fazione.nome}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Descrizione</Text>
              <Text style={styles.descrizione}>{fazione.descrizione}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Membri ({membri.length})</Text>
              {membri.length > 0 ? (
                <View style={styles.membriList}>
                  {membri.slice(0, 50).map((a) => (
                    <Text key={a.id} style={styles.membroItem}>{getEmojiAbitante(a)} {a.nome}</Text>
                  ))}
                  {membri.length > 50 && (
                    <Text style={styles.membroMore}>… e altri {membri.length - 50}</Text>
                  )}
                </View>
              ) : (
                <Text style={styles.membroEmpty}>Nessun membro in questa fazione</Text>
              )}
            </View>

            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Chiudi</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center"
  },
  modalCard: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 20,
    minWidth: 320,
    maxWidth: 400,
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)"
  },
  header: {
    alignItems: "center",
    marginBottom: 20
  },
  emoji: {
    fontSize: 64,
    marginBottom: 12
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#e5e7eb",
    textAlign: "center"
  },
  section: {
    marginTop: 12
  },
  sectionLabel: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  descrizione: {
    color: "#cbd5f5",
    fontSize: 15,
    lineHeight: 22
  },
  membriList: { marginTop: 4 },
  membroItem: { color: "#cbd5f5", fontSize: 14, marginBottom: 4 },
  membroMore: { color: "rgba(203,213,245,0.7)", fontSize: 12, fontStyle: "italic" },
  membroEmpty: { color: "rgba(203,213,245,0.6)", fontSize: 13, fontStyle: "italic" },
  closeButton: {
    marginTop: 20,
    backgroundColor: "#3b82f6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center"
  },
  closeButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600"
  }
});
