import React from "react";
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Abitante, Edificio } from "../types";
import { DESKTOP_MODAL_BREAKPOINT, modalBackdropFullscreen, modalContentFullscreen } from "./modalFullscreenStyles";

type CreditiModalProps = {
  visible: boolean;
  abitanti: Abitante[];
  edifici: Edificio[];
  onClose: () => void;
};

export function CreditiModal({ visible, abitanti, edifici, onClose }: CreditiModalProps) {
  // Calcola le entrate dalle tasse (reddito degli abitanti)
  const entrateAbitanti = abitanti.map((abitante) => ({
    abitante,
    reddito: abitante.reddito,
    spese: abitante.spese,
    netto: abitante.reddito - abitante.spese
  }));

  // Calcola le spese di manutenzione degli edifici
  const speseManutenzione = edifici
    .filter((e) => e.stato === "Operativo")
    .map((edificio) => ({
      edificio,
      manutenzione: edificio.manutenzione
    }));

  // Calcola i totali
  const totaleRedditi = abitanti.reduce((sum, a) => sum + a.reddito, 0);
  const totaleSpese = abitanti.reduce((sum, a) => sum + a.spese, 0);
  const totaleManutenzione = speseManutenzione.reduce((sum, s) => sum + s.manutenzione, 0);
  const totaleNetto = totaleRedditi - totaleSpese - totaleManutenzione;
  const { width } = Dimensions.get("window");
  const isDesktop = width > DESKTOP_MODAL_BREAKPOINT;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.modalBackdrop, isDesktop && modalBackdropFullscreen]} onPress={onClose}>
        <Pressable style={[styles.modalCard, isDesktop && modalContentFullscreen]} onPress={() => undefined}>
          <Text style={styles.modalTitle}>Entrate e Uscite Mensili</Text>

          {/* Entrate dagli abitanti */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Entrate dalle Tasse</Text>
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {entrateAbitanti.map(({ abitante, reddito, spese, netto }) => (
                <View key={abitante.id} style={styles.item}>
                  <Text style={styles.emoji}>{getEmojiAbitante(abitante)}</Text>
                  <View style={styles.itemContent}>
                    <Text style={styles.nome}>{abitante.nome}</Text>
                    <View style={styles.itemRow}>
                      <Text style={styles.label}>Reddito:</Text>
                      <Text style={styles.valorePositivo}>+{reddito}</Text>
                    </View>
                    <View style={styles.itemRow}>
                      <Text style={styles.label}>Spese:</Text>
                      <Text style={styles.valoreNegativo}>-{spese}</Text>
                    </View>
                    <View style={styles.itemRow}>
                      <Text style={styles.label}>Netto:</Text>
                      <Text style={[styles.valoreNetto, netto >= 0 ? styles.valorePositivo : styles.valoreNegativo]}>
                        {netto >= 0 ? "+" : ""}{netto}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={styles.totaleRow}>
              <Text style={styles.totaleLabel}>Totale entrate:</Text>
              <Text style={styles.totaleValorePositivo}>+{totaleRedditi}</Text>
            </View>
            <View style={styles.totaleRow}>
              <Text style={styles.totaleLabel}>Totale spese abitanti:</Text>
              <Text style={styles.totaleValoreNegativo}>-{totaleSpese}</Text>
            </View>
          </View>

          {/* Spese di manutenzione */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Spese di Manutenzione</Text>
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {speseManutenzione.map(({ edificio, manutenzione }) => (
                <View key={edificio.id} style={styles.item}>
                  <Text style={styles.emoji}>{edificio.emoji}</Text>
                  <View style={styles.itemContent}>
                    <Text style={styles.nome}>{edificio.nome}</Text>
                    <View style={styles.itemRow}>
                      <Text style={styles.label}>Manutenzione:</Text>
                      <Text style={styles.valoreNegativo}>-{manutenzione}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={styles.totaleRow}>
              <Text style={styles.totaleLabel}>Totale manutenzione:</Text>
              <Text style={styles.totaleValoreNegativo}>-{totaleManutenzione}</Text>
            </View>
          </View>

          {/* Totale finale */}
          <View style={styles.totaleFinaleContainer}>
            <Text style={styles.totaleFinaleLabel}>Bilancio mensile:</Text>
            <Text style={[styles.totaleFinaleValore, totaleNetto >= 0 ? styles.valorePositivo : styles.valoreNegativo]}>
              {totaleNetto >= 0 ? "+" : ""}{totaleNetto} <Text style={styles.unità}>crediti</Text>
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
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center"
  },
  modalCard: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 16,
    minWidth: 320,
    maxWidth: 500,
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)"
  },
  modalTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center"
  },
  section: {
    marginBottom: 16
  },
  sectionTitle: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  list: {
    maxHeight: 200,
    marginBottom: 8
  },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 4,
    backgroundColor: "rgba(15,23,42,0.6)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)"
  },
  emoji: {
    fontSize: 24,
    marginRight: 10
  },
  itemContent: {
    flex: 1
  },
  nome: {
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2
  },
  label: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10
  },
  valorePositivo: {
    color: "#4ade80",
    fontSize: 11,
    fontWeight: "700"
  },
  valoreNegativo: {
    color: "#ef4444",
    fontSize: 11,
    fontWeight: "700"
  },
  valoreNetto: {
    fontSize: 11,
    fontWeight: "700"
  },
  totaleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.2)",
    marginTop: 4
  },
  totaleLabel: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "600"
  },
  totaleValorePositivo: {
    color: "#4ade80",
    fontSize: 12,
    fontWeight: "700"
  },
  totaleValoreNegativo: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "700"
  },
  totaleFinaleContainer: {
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: "rgba(148,163,184,0.4)",
    marginBottom: 12,
    alignItems: "center"
  },
  totaleFinaleLabel: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  totaleFinaleValore: {
    fontSize: 18,
    fontWeight: "700"
  },
  unità: {
    fontSize: 14,
    fontWeight: "500"
  },
  closeButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center"
  },
  closeButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600"
  }
});
