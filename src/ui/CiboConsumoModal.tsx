import React from "react";
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Abitante, Edificio } from "../types";
import { getConsumoCibo, getStatoSalute } from "../game/ciboConsumo";
import { getEmojiAbitante } from "../utils/getEmojiAbitante";
import { DESKTOP_MODAL_BREAKPOINT, modalBackdropFullscreen, modalContentFullscreen } from "./modalFullscreenStyles";

type CiboConsumoModalProps = {
  visible: boolean;
  abitanti: Abitante[];
  edifici: Edificio[];
  onClose: () => void;
};

export function CiboConsumoModal({ visible, abitanti, edifici, onClose }: CiboConsumoModalProps) {
  const consumiAbitanti = abitanti.map((abitante) => ({
    abitante,
    consumo: getConsumoCibo(abitante),
    statoSalute: getStatoSalute(abitante)
  }));

  // Calcola il totale consumato
  const totaleConsumo = consumiAbitanti.reduce((sum, c) => sum + c.consumo, 0);

  // Produzione fissa di cibo per abitante assegnato alla Serra (10-20, stessa logica di gioco)
  const getProduzioneCiboPerAbitante = (abitanteId: number): number => {
    const seed = abitanteId * 31;
    return 10 + (seed % 11); // 10-20
  };

  // Calcola il totale prodotto dalla Serra
  const serra = edifici.find((e) => e.nome === "Serra");
  const totaleProduzione =
    serra?.abitantiAssegnati.reduce((sum, id) => sum + getProduzioneCiboPerAbitante(id), 0) ?? 0;

  const { width } = Dimensions.get("window");
  const isDesktop = width > DESKTOP_MODAL_BREAKPOINT;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.modalBackdrop, isDesktop && modalBackdropFullscreen]} onPress={onClose}>
        <Pressable style={[styles.modalCard, isDesktop && modalContentFullscreen]} onPress={() => undefined}>
          <Text style={styles.modalTitle}>Consumo Mensile di Cibo</Text>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {consumiAbitanti.map(({ abitante, consumo, statoSalute }) => (
              <View key={abitante.id} style={styles.item}>
                <Text style={styles.emoji}>{getEmojiAbitante(abitante)}</Text>
                <View style={styles.itemContent}>
                  <Text style={styles.nome}>{abitante.nome}</Text>
                  <View style={styles.itemRow}>
                    <Text style={styles.statoSalute}>Peso: {abitante.peso ?? 50}/100 · Salute: {statoSalute}</Text>
                    <Text style={styles.consumo}>
                      {consumo} <Text style={styles.unità}>razioni</Text>
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.totaleContainer}>
            <Text style={styles.totaleLabel}>Totale mensile consumato:</Text>
            <Text style={styles.totaleValue}>
              {totaleConsumo} <Text style={styles.unità}>razioni</Text>
            </Text>
          </View>

          <View style={styles.totaleContainer}>
            <Text style={styles.totaleLabel}>Totale mensile prodotto dalla Serra:</Text>
            <Text style={styles.totaleValueProduzione}>
              {totaleProduzione} <Text style={styles.unitàProduzione}>razioni</Text>
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
  list: {
    maxHeight: 300,
    marginBottom: 12
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
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
    marginBottom: 2
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  statoSalute: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10
  },
  consumo: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "700"
  },
  unità: {
    color: "rgba(239,68,68,0.7)",
    fontWeight: "500"
  },
  totaleContainer: {
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.3)",
    marginBottom: 12,
    alignItems: "center"
  },
  totaleLabel: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  totaleValue: {
    color: "#ef4444",
    fontSize: 18,
    fontWeight: "700"
  },
  totaleValueProduzione: {
    color: "#4ade80",
    fontSize: 16,
    fontWeight: "700"
  },
  unitàProduzione: {
    color: "rgba(74,222,128,0.7)",
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
