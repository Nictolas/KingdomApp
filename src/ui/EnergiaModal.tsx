import React from "react";
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Edificio, Abitante } from "../types";
import { RESIDENZE_ENERGIA_PER_ABITANTE } from "../data/residenzeData";
import { DESKTOP_MODAL_BREAKPOINT, modalBackdropFullscreen, modalContentFullscreen } from "./modalFullscreenStyles";

type EnergiaModalProps = {
  visible: boolean;
  edifici: Edificio[];
  abitanti?: Abitante[];
  onClose: () => void;
};

const ENERGIA_PER_ROBOT = 2;

export function EnergiaModal({ visible, edifici, abitanti = [], onClose }: EnergiaModalProps) {
  // Calcola i consumi di energia degli edifici
  const consumiEnergia = edifici
    .filter((edificio) => {
      if (edificio.stato !== "Operativo") return false;
      if (!edificio.consumo) return false;
      const consumi = edificio.consumo.split(",").map((c) => c.trim());
      return consumi.some((cons) => cons.toLowerCase().includes("energia"));
    })
    .map((edificio) => {
      // Calcola consumo basato sull'efficienza e occupazione
      const consumoBase = edificio.efficienza / 20;
      const consumo = Math.floor(consumoBase * (edificio.occupazione / edificio.capacità));
      return {
        edificio,
        consumo
      };
    });

  // Residenze: consumo = energiaPerAbitante × numero residenti
  const consumiResidenze = edifici
    .filter((e) => e.tipo === "Residenza" && e.stato === "Operativo")
    .map((e) => {
      const perAbitante = RESIDENZE_ENERGIA_PER_ABITANTE[e.nome] ?? 0;
      const numAbitanti = (e.abitantiAssegnati ?? []).length;
      return { edificio: e, consumo: perAbitante * numAbitanti };
    })
    .filter((c) => c.consumo > 0);

  // Calcola la produzione di energia
  const produzioneEnergia = edifici
    .filter((edificio) => {
      if (edificio.stato !== "Operativo") return false;
      if (!edificio.produzione) return false;
      const produzioni = edificio.produzione.split(",").map((p) => p.trim());
      return produzioni.some((prod) => prod.toLowerCase().includes("energia"));
    })
    .map((edificio) => {
      // Produzione basata sul numero di abitanti assegnati
      const numAbitanti = edificio.abitantiAssegnati.length;
      // Per semplicità, assumiamo che la produzione sia basata sull'efficienza
      // In realtà dovrebbe essere calcolata come per il cibo, ma per ora usiamo un valore basato sull'efficienza
      const produzione = Math.floor(edificio.efficienza / 10);
      return {
        edificio,
        produzione
      };
    });

  // Fazione Robots: 2 energia per ogni membro Robot
  const numRobots = abitanti.filter((a) => a.razza === "Robot").length;
  const consumoRobots = numRobots * ENERGIA_PER_ROBOT;

  const totaleConsumo =
    consumiEnergia.reduce((sum, c) => sum + c.consumo, 0) +
    consumiResidenze.reduce((sum, c) => sum + c.consumo, 0) +
    consumoRobots;
  const totaleProduzione = produzioneEnergia.reduce((sum, p) => sum + p.produzione, 0);
  const bilancio = totaleProduzione - totaleConsumo;
  const { width } = Dimensions.get("window");
  const isDesktop = width > DESKTOP_MODAL_BREAKPOINT;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.modalBackdrop, isDesktop && modalBackdropFullscreen]} onPress={onClose}>
        <Pressable style={[styles.modalCard, isDesktop && modalContentFullscreen]} onPress={() => undefined}>
          <Text style={styles.modalTitle}>Consumo e Produzione di Energia</Text>

          {/* Produzione */}
          {produzioneEnergia.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Produzione</Text>
              <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                {produzioneEnergia.map(({ edificio, produzione }) => (
                  <View key={edificio.id} style={styles.item}>
                    <Text style={styles.emoji}>{edificio.emoji}</Text>
                    <View style={styles.itemContent}>
                      <Text style={styles.nome}>{edificio.nome}</Text>
                      <View style={styles.itemRow}>
                        <Text style={styles.label}>Produzione:</Text>
                        <Text style={styles.valorePositivo}>+{produzione} MW</Text>
                      </View>
                      <View style={styles.itemRow}>
                        <Text style={styles.label}>Efficienza:</Text>
                        <Text style={styles.dettaglio}>{edificio.efficienza}%</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
              <View style={styles.totaleRow}>
                <Text style={styles.totaleLabel}>Totale produzione:</Text>
                <Text style={styles.totaleValorePositivo}>+{totaleProduzione} MW</Text>
              </View>
            </View>
          )}

          {/* Consumo */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Consumo</Text>
            {consumiEnergia.length > 0 || consumiResidenze.length > 0 || numRobots > 0 ? (
              <>
                <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                  {consumiEnergia.map(({ edificio, consumo }) => (
                    <View key={edificio.id} style={styles.item}>
                      <Text style={styles.emoji}>{edificio.emoji}</Text>
                      <View style={styles.itemContent}>
                        <Text style={styles.nome}>{edificio.nome}</Text>
                        <View style={styles.itemRow}>
                          <Text style={styles.label}>Consumo:</Text>
                          <Text style={styles.valoreNegativo}>-{consumo} MW</Text>
                        </View>
                        <View style={styles.itemRow}>
                          <Text style={styles.label}>Occupazione:</Text>
                          <Text style={styles.dettaglio}>
                            {edificio.occupazione}/{edificio.capacità} ({Math.floor(((edificio.occupazione || 0) / (edificio.capacità || 1)) * 100)}%)
                          </Text>
                        </View>
                        <View style={styles.itemRow}>
                          <Text style={styles.label}>Efficienza:</Text>
                          <Text style={styles.dettaglio}>{edificio.efficienza}%</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                  {consumiResidenze.map(({ edificio, consumo }) => (
                    <View key={edificio.id} style={styles.item}>
                      <Text style={styles.emoji}>{edificio.emoji}</Text>
                      <View style={styles.itemContent}>
                        <Text style={styles.nome}>{edificio.nome} (residenza)</Text>
                        <View style={styles.itemRow}>
                          <Text style={styles.label}>Consumo:</Text>
                          <Text style={styles.valoreNegativo}>-{consumo} MW</Text>
                        </View>
                        <View style={styles.itemRow}>
                          <Text style={styles.label}>Abitanti:</Text>
                          <Text style={styles.dettaglio}>
                            {(edificio.abitantiAssegnati ?? []).length} × {RESIDENZE_ENERGIA_PER_ABITANTE[edificio.nome] ?? 0} MW
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                  {numRobots > 0 && (
                    <View style={styles.item}>
                      <Text style={styles.emoji}>🤖</Text>
                      <View style={styles.itemContent}>
                        <Text style={styles.nome}>Fazione Robots</Text>
                        <View style={styles.itemRow}>
                          <Text style={styles.label}>Consumo:</Text>
                          <Text style={styles.valoreNegativo}>-{consumoRobots} MW</Text>
                        </View>
                        <View style={styles.itemRow}>
                          <Text style={styles.label}>Membri (Robot):</Text>
                          <Text style={styles.dettaglio}>{numRobots} × {ENERGIA_PER_ROBOT} MW</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </ScrollView>
                <View style={styles.totaleRow}>
                  <Text style={styles.totaleLabel}>Totale consumo:</Text>
                  <Text style={styles.totaleValoreNegativo}>-{totaleConsumo} MW</Text>
                </View>
              </>
            ) : (
              <Text style={styles.emptyText}>Nessun edificio consuma energia</Text>
            )}
          </View>

          {/* Bilancio finale */}
          <View style={styles.totaleFinaleContainer}>
            <Text style={styles.totaleFinaleLabel}>Bilancio energetico:</Text>
            <Text style={[styles.totaleFinaleValore, bilancio >= 0 ? styles.valorePositivo : styles.valoreNegativo]}>
              {bilancio >= 0 ? "+" : ""}{bilancio} MW
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
  dettaglio: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10
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
  emptyText: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 11,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 12
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
