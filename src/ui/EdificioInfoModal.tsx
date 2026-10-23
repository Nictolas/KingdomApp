import { BuildingModalBottomExit } from "./BuildingModalBottomExit";
import React from "react";
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Edificio } from "../types";
import { EDIFICIO_COMPETENZA_RICHIESTA } from "../data/edificiCompetenze";
import { DESKTOP_MODAL_BREAKPOINT, modalBackdropFullscreen, modalContentFullscreen } from "./modalFullscreenStyles";
import { getStipendioMensileEdificio } from "../game/edificiPubblici";
import { isEdificioPubblicoConPostazioniLavoro } from "../game/edificiLavoro";

type EdificioInfoModalProps = {
  visible: boolean;
  edificio: Edificio | null;
  onClose: () => void;
};

export function EdificioInfoModal({ visible, edificio, onClose }: EdificioInfoModalProps) {
  if (!edificio) return null;

  const getStatoColor = (stato: Edificio["stato"]) => {
    switch (stato) {
      case "Operativo":
        return "#4ade80";
      case "In costruzione":
        return "#fde047";
      case "In manutenzione":
        return "#fb923c";
      case "Danneggiato":
        return "#f97373";
      default:
        return "#cbd5f5";
    }
  };

  const formatMonete = (valore: number) => `${valore} monete`;
  const { width } = Dimensions.get("window");
  const isDesktop = width > DESKTOP_MODAL_BREAKPOINT;
  const nLav = edificio.abitantiAssegnati?.length ?? 0;
  const costoStipendi =
    isEdificioPubblicoConPostazioniLavoro(edificio) ? getStipendioMensileEdificio(edificio) * nLav : 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.modalBackdrop, isDesktop && modalBackdropFullscreen]} onPress={onClose}>
        <Pressable style={[styles.modalCard, isDesktop && modalContentFullscreen]} onPress={() => undefined}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <Text style={styles.emoji}>{edificio.emoji}</Text>
              <Text style={styles.title}>{edificio.nome}</Text>
              <View
                style={[
                  styles.statoBadge,
                  { backgroundColor: getStatoColor(edificio.stato) + "20" }
                ]}
              >
                <Text style={[styles.statoText, { color: getStatoColor(edificio.stato) }]}>
                  {edificio.stato}
                </Text>
              </View>
            </View>

            <Text style={styles.tipo}>{edificio.tipo}</Text>
            <Text style={styles.descrizione}>{edificio.descrizione}</Text>

            {/* Informazioni base */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Informazioni</Text>
              <Text style={styles.line}>Livello: {edificio.livello}</Text>
              <Text style={styles.line}>
                Occupazione: {edificio.occupazione}/{edificio.capacità}
              </Text>
              <Text style={styles.line}>Efficienza: {edificio.efficienza}%</Text>
              {edificio.stato === "In costruzione" && (
                <Text style={styles.line}>
                  Avanzamento cantiere: {edificio.progressoCostruzione ?? 0}/100
                </Text>
              )}
              <Text style={styles.line}>
                Costo mensile: {formatMonete(costoStipendi)} (stipendio × lavoratori)
              </Text>
            </View>

            {/* Competenza richiesta (da /competenze) */}
            {EDIFICIO_COMPETENZA_RICHIESTA[edificio.id] && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Competenza</Text>
                <Text style={styles.line}>
                  {EDIFICIO_COMPETENZA_RICHIESTA[edificio.id].nomeCompetenza} (min. {EDIFICIO_COMPETENZA_RICHIESTA[edificio.id].competenzaMinima}%)
                </Text>
                <Text style={styles.lineHint}>
                  I Disoccupati con competenza ≥ soglia possono essere assegnati automaticamente allo Skip Mese.
                </Text>
              </View>
            )}

            {/* Produzione e consumo */}
            {(edificio.produzione || edificio.consumo) && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Risorse</Text>
                {edificio.produzione && (
                  <Text style={styles.line}>
                    <Text style={styles.label}>Produce: </Text>
                    {edificio.produzione}
                  </Text>
                )}
                {edificio.consumo && (
                  <Text style={styles.line}>
                    <Text style={styles.label}>Consuma: </Text>
                    {edificio.consumo}
                  </Text>
                )}
              </View>
            )}

            
          </ScrollView>
          <BuildingModalBottomExit onClose={onClose} />
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
    marginBottom: 16
  },
  emoji: {
    fontSize: 64,
    marginBottom: 12
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#e5e7eb",
    marginBottom: 8,
    textAlign: "center"
  },
  statoBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12
  },
  statoText: {
    fontSize: 12,
    fontWeight: "600"
  },
  tipo: {
    color: "#93c5fd",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center"
  },
  descrizione: {
    color: "rgba(203,213,245,0.8)",
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
    textAlign: "center"
  },
  section: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.2)"
  },
  sectionLabel: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  line: {
    color: "#cbd5f5",
    fontSize: 14,
    marginBottom: 6
  },
  lineHint: {
    color: "rgba(203,213,245,0.6)",
    fontSize: 11,
    marginTop: 2,
    fontStyle: "italic"
  },
  label: {
    color: "rgba(203,213,245,0.7)",
    fontWeight: "500"
  },
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
