import React from "react";
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Abitante } from "../types";
import { getEmojiAbitante } from "../utils/getEmojiAbitante";
import { DESKTOP_MODAL_BREAKPOINT, modalBackdropFullscreen, modalContentFullscreen } from "./modalFullscreenStyles";

type ReligioneFedeliModalProps = {
  visible: boolean;
  religione: string;
  abitanti: Abitante[];
  onClose: () => void;
};

export function ReligioneFedeliModal({ visible, religione, abitanti, onClose }: ReligioneFedeliModalProps) {
  const fedeli = abitanti.filter((a) => a.religione === religione);
  const { width } = Dimensions.get("window");
  const isDesktop = width > DESKTOP_MODAL_BREAKPOINT;

  const getEmojiReligione = (nome: string): string => {
    const emojiMap: Record<string, string> = {
      Ateo: "🚫",
      Deista: "🤔",
      Agnostico: "❓",
      "Culto del Sole": "☀️",
      "Culto delle Ombre": "🌑"
    };
    return emojiMap[nome] || "📿";
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.modalBackdrop, isDesktop && modalBackdropFullscreen]} onPress={onClose}>
        <Pressable style={[styles.modalCard, isDesktop && modalContentFullscreen]} onPress={() => undefined}>
          <View style={styles.header}>
            <Text style={styles.emoji}>{getEmojiReligione(religione)}</Text>
            <Text style={styles.title}>{religione}</Text>
            <Text style={styles.subtitle}>{fedeli.length} fedeli</Text>
          </View>

          {fedeli.length > 0 ? (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {fedeli.map((abitante) => (
                <View key={abitante.id} style={styles.item}>
                  <Text style={styles.itemEmoji}>{getEmojiAbitante(abitante)}</Text>
                  <View style={styles.itemContent}>
                    <Text style={styles.itemNome}>{abitante.nome}</Text>
                    <Text style={styles.itemLavoro}>{abitante.lavoro}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.emptyText}>Nessun fedele registrato</Text>
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
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  modalCard: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    maxWidth: 400,
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  header: {
    alignItems: "center",
    marginBottom: 16
  },
  emoji: {
    fontSize: 48,
    marginBottom: 8
  },
  title: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4
  },
  subtitle: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 12
  },
  list: {
    maxHeight: 300,
    marginBottom: 12
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)"
  },
  itemEmoji: {
    fontSize: 28,
    marginRight: 10
  },
  itemContent: {
    flex: 1
  },
  itemNome: {
    color: "#e5e7eb",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2
  },
  itemLavoro: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10
  },
  emptyText: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 12,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 20
  },
  closeButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 8,
    padding: 12,
    alignItems: "center"
  },
  closeButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700"
  }
});
