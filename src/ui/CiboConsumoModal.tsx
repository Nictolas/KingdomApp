import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Abitante } from "../types";

type CiboConsumoModalProps = {
  visible: boolean;
  abitanti: Abitante[];
  onClose: () => void;
};

export function CiboConsumoModal({ visible, abitanti, onClose }: CiboConsumoModalProps) {
  // Calcola il consumo di ogni abitante
  const consumiAbitanti = abitanti.map((abitante) => {
    let consumoMin: number;
    let consumoMax: number;
    let statoSalute: string;

    if (abitante.salute > 70) {
      // Obeso: consuma da 5 a 10
      consumoMin = 5;
      consumoMax = 10;
      statoSalute = "Obeso";
    } else if (abitante.salute >= 30 && abitante.salute <= 70) {
      // Normale: consuma da 1 a 5
      consumoMin = 1;
      consumoMax = 5;
      statoSalute = "Normale";
    } else {
      // Altro: consuma da 1 a 10
      consumoMin = 1;
      consumoMax = 10;
      statoSalute = "Basso";
    }

    return {
      abitante,
      consumoMin,
      consumoMax,
      statoSalute
    };
  });

  // Calcola il totale minimo e massimo
  const totaleMin = consumiAbitanti.reduce((sum, c) => sum + c.consumoMin, 0);
  const totaleMax = consumiAbitanti.reduce((sum, c) => sum + c.consumoMax, 0);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => undefined}>
          <Text style={styles.modalTitle}>Consumo Mensile di Cibo</Text>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {consumiAbitanti.map(({ abitante, consumoMin, consumoMax, statoSalute }) => (
              <View key={abitante.id} style={styles.item}>
                <Text style={styles.emoji}>{abitante.emoji}</Text>
                <View style={styles.itemContent}>
                  <Text style={styles.nome}>{abitante.nome}</Text>
                  <View style={styles.itemRow}>
                    <Text style={styles.statoSalute}>Salute: {abitante.salute} ({statoSalute})</Text>
                    <Text style={styles.consumo}>
                      {consumoMin === consumoMax ? (
                        `${consumoMin}`
                      ) : (
                        `${consumoMin}-${consumoMax}`
                      )}{" "}
                      <Text style={styles.unità}>razioni</Text>
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.totaleContainer}>
            <Text style={styles.totaleLabel}>Totale mensile:</Text>
            <Text style={styles.totaleValue}>
              {totaleMin === totaleMax ? (
                `${totaleMin}`
              ) : (
                `${totaleMin}-${totaleMax}`
              )}{" "}
              <Text style={styles.unità}>razioni</Text>
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
