import { BuildingModalBottomExit } from "./BuildingModalBottomExit";
import React, { useState, useMemo } from "react";
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Edificio, Razza } from "../types";
import { DESKTOP_MODAL_BREAKPOINT, modalBackdropFullscreen, modalContentFullscreen } from "./modalFullscreenStyles";
import { getStipendioMensileEdificio } from "../game/edificiPubblici";
import { isEdificioPubblicoConPostazioniLavoro } from "../game/edificiLavoro";

const RAZZE: Razza[] = [
  "Umano",
  "Elfo",
  "Nano",
  "Orco",
  "Goblin",
  "Golem"
];

const RELIGIONI: string[] = [
  "Ateo",
  "Deista",
  "Agnostico",
  "Culto del Sole",
  "Culto delle Ombre"
];

type Abitante = import("../types").Abitante;

type CampoDiLavoroModalProps = {
  visible: boolean;
  edificio: Edificio | null;
  abitanti: Abitante[];
  aggiungiAlCampoDiLavoroTuttiQuelliChe: (filtro: {
    personalità?: string;
    razza?: string;
    religione?: string;
  }) => void;
  onClose: () => void;
};

const TUTTI = "— Tutti";

export function CampoDiLavoroModal({
  visible,
  edificio,
  abitanti,
  aggiungiAlCampoDiLavoroTuttiQuelliChe,
  onClose
}: CampoDiLavoroModalProps) {
  const [personalità, setPersonalità] = useState<string>("");
  const [razza, setRazza] = useState<string>("");
  const [religione, setReligione] = useState<string>("");
  const [dropdownAperto, setDropdownAperto] = useState<"personalità" | "razza" | "religione" | null>(null);

  const opzioniPersonalità = useMemo(() => {
    const set = new Set(abitanti.map((a) => a.personalità).filter(Boolean));
    return [TUTTI, ...Array.from(set).sort()];
  }, [abitanti]);

  const { width } = Dimensions.get("window");
  const isDesktop = width > DESKTOP_MODAL_BREAKPOINT;

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

  const handleAggiungi = () => {
    aggiungiAlCampoDiLavoroTuttiQuelliChe({
      personalità: personalità && personalità !== TUTTI ? personalità : undefined,
      razza: razza && razza !== TUTTI ? razza : undefined,
      religione: religione && religione !== TUTTI ? religione : undefined
    });
    setDropdownAperto(null);
  };

  const opzioniRazza = [TUTTI, ...RAZZE];
  const opzioniReligione = [TUTTI, ...RELIGIONI];

  const labelPersonalità = personalità || TUTTI;
  const labelRazza = razza || TUTTI;
  const labelReligione = religione || TUTTI;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.modalBackdrop, isDesktop && modalBackdropFullscreen]} onPress={onClose}>
        <Pressable style={[styles.modalCard, isDesktop && modalContentFullscreen]} onPress={() => undefined}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <Text style={styles.emoji}>{edificio.emoji}</Text>
              <Text style={styles.title}>{edificio.nome}</Text>
              <View
                style={[styles.statoBadge, { backgroundColor: getStatoColor(edificio.stato) + "20" }]}
              >
                <Text style={[styles.statoText, { color: getStatoColor(edificio.stato) }]}>
                  {edificio.stato}
                </Text>
              </View>
            </View>

            <Text style={styles.tipo}>{edificio.tipo}</Text>
            <Text style={styles.descrizione}>{edificio.descrizione}</Text>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Informazioni</Text>
              <Text style={styles.line}>Livello: {edificio.livello}</Text>
              <Text style={styles.line}>
                Occupazione: {edificio.occupazione}/{edificio.capacità}
              </Text>
              <Text style={styles.line}>Efficienza: {edificio.efficienza}%</Text>
              <Text style={styles.line}>
                Costo mensile:{" "}
                {formatMonete(
                  isEdificioPubblicoConPostazioniLavoro(edificio)
                    ? getStipendioMensileEdificio(edificio) * (edificio.abitantiAssegnati?.length ?? 0)
                    : 0
                )}{" "}
                (stipendio × lavoratori)
              </Text>
            </View>

            {/* Aggiungi tutti quelli che... */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Aggiungi tutti quelli che...</Text>
              <Text style={styles.sectionHint}>
                Seleziona uno o più filtri. Chi viene aggiunto avrà lavoro &quot;Prigioniero&quot;.
              </Text>

              <View style={styles.dropdownRow}>
                <Text style={styles.dropdownLabel}>Personalità</Text>
                <Pressable
                  style={styles.dropdownButton}
                  onPress={() => setDropdownAperto(dropdownAperto === "personalità" ? null : "personalità")}
                >
                  <Text style={styles.dropdownButtonText} numberOfLines={1}>
                    {labelPersonalità}
                  </Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </Pressable>
              </View>
              <View style={styles.dropdownRow}>
                <Text style={styles.dropdownLabel}>Razza</Text>
                <Pressable
                  style={styles.dropdownButton}
                  onPress={() => setDropdownAperto(dropdownAperto === "razza" ? null : "razza")}
                >
                  <Text style={styles.dropdownButtonText} numberOfLines={1}>
                    {labelRazza}
                  </Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </Pressable>
              </View>
              <View style={styles.dropdownRow}>
                <Text style={styles.dropdownLabel}>Religione</Text>
                <Pressable
                  style={styles.dropdownButton}
                  onPress={() => setDropdownAperto(dropdownAperto === "religione" ? null : "religione")}
                >
                  <Text style={styles.dropdownButtonText} numberOfLines={1}>
                    {labelReligione}
                  </Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </Pressable>
              </View>

              <Pressable style={styles.aggiungiButton} onPress={handleAggiungi}>
                <Text style={styles.aggiungiButtonText}>Aggiungi al Campo di Lavoro</Text>
              </Pressable>
            </View>

            
          </ScrollView>
          <BuildingModalBottomExit onClose={onClose} />
        </Pressable>
      </Pressable>

      {/* Modal menu a tendina */}
      <Modal
        visible={dropdownAperto !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDropdownAperto(null)}
      >
        <Pressable
          style={[styles.pickerOverlay, isDesktop && modalBackdropFullscreen]}
          onPress={() => setDropdownAperto(null)}
        >
          <Pressable style={styles.pickerBox} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.pickerTitle}>
              {dropdownAperto === "personalità"
                ? "Personalità"
                : dropdownAperto === "razza"
                ? "Razza"
                : "Religione"}
            </Text>
            <ScrollView style={styles.pickerScroll}>
              {dropdownAperto === "personalità" &&
                opzioniPersonalità.map((op) => (
                  <Pressable
                    key={op}
                    style={styles.pickerItem}
                    onPress={() => {
                      setPersonalità(op === TUTTI ? "" : op);
                      setDropdownAperto(null);
                    }}
                  >
                    <Text style={styles.pickerItemText}>{op}</Text>
                  </Pressable>
                ))}
              {dropdownAperto === "razza" &&
                opzioniRazza.map((op) => (
                  <Pressable
                    key={op}
                    style={styles.pickerItem}
                    onPress={() => {
                      setRazza(op === TUTTI ? "" : op);
                      setDropdownAperto(null);
                    }}
                  >
                    <Text style={styles.pickerItemText}>{op}</Text>
                  </Pressable>
                ))}
              {dropdownAperto === "religione" &&
                opzioniReligione.map((op) => (
                  <Pressable
                    key={op}
                    style={styles.pickerItem}
                    onPress={() => {
                      setReligione(op === TUTTI ? "" : op);
                      setDropdownAperto(null);
                    }}
                  >
                    <Text style={styles.pickerItemText}>{op}</Text>
                  </Pressable>
                ))}
            </ScrollView>
            <Pressable style={styles.pickerChiudi} onPress={() => setDropdownAperto(null)}>
              <Text style={styles.pickerChiudiText}>Chiudi</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  header: { alignItems: "center", marginBottom: 16 },
  emoji: { fontSize: 64, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: "700", color: "#e5e7eb", marginBottom: 8, textAlign: "center" },
  statoBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statoText: { fontSize: 12, fontWeight: "600" },
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
    color: "rgba(203,213,245,0.85)",
    fontSize: 13,
    lineHeight: 19
  },
  sectionHint: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 11,
    marginBottom: 12,
    lineHeight: 16
  },
  dropdownRow: { marginBottom: 10 },
  dropdownLabel: {
    color: "rgba(203,213,245,0.8)",
    fontSize: 11,
    marginBottom: 4
  },
  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(15,23,42,0.95)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  dropdownButtonText: { color: "#e5e7eb", fontSize: 14, flex: 1 },
  dropdownArrow: { color: "rgba(203,213,245,0.7)", fontSize: 10, marginLeft: 8 },
  aggiungiButton: {
    marginTop: 14,
    backgroundColor: "#dc2626",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center"
  },
  aggiungiButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "600" },
  closeButton: {
    marginTop: 20,
    backgroundColor: "#3b82f6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center"
  },
  closeButtonText: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center"
  },
  pickerBox: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 16,
    minWidth: 260,
    maxWidth: 320,
    maxHeight: "60%",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)"
  },
  pickerTitle: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  pickerScroll: { maxHeight: 280 },
  pickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.2)"
  },
  pickerItemText: { color: "#e5e7eb", fontSize: 14 },
  pickerChiudi: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: "center"
  },
  pickerChiudiText: { color: "#93c5fd", fontSize: 14 }
});
