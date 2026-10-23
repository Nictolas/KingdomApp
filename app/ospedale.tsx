import React, { useMemo, useState } from "react";
import { Dimensions, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { getStatoSalute } from "../src/game/ciboConsumo";
import { getServiDellaGlebaPerAssegnazioneEdificio } from "../src/game/edificiLavoro";
import { getEmojiAbitante } from "../src/utils/getEmojiAbitante";
import { modalBackdropFullscreen, modalContentFullscreen } from "../src/ui/modalFullscreenStyles";
import type { Abitante } from "../src/types";

export default function OspedaleScreen() {
  const router = useRouter();
  const { abitanti, edifici, assegnaAbitanteAEdificio, rimuoviAbitanteDaEdificio, setStipendioEdificio, calcolaFelicitàModificata } = useGameContext();
  const [dropdownDottoreVisible, setDropdownDottoreVisible] = useState(false);

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const ospedale = edifici.find((e) => e.nome === "Ospedale");
  const dottoreId = ospedale && ospedale.abitantiAssegnati.length > 0 ? ospedale.abitantiAssegnati[0] : null;
  const dottore = dottoreId ? abitanti.find((a) => a.id === dottoreId) : null;

  const malati = abitanti.filter(
    (a) => a.razza !== "Golem" && getStatoSalute(a) !== "Sano" && getStatoSalute(a) !== "Incinta"
  );

  const incinte = abitanti.filter((a) => a.razza !== "Golem" && a.incinta === true);

  const abitantiDisponibiliDottore = useMemo(() => {
    if (!ospedale || dottore) return [];
    return getServiDellaGlebaPerAssegnazioneEdificio(abitanti, edifici, ospedale);
  }, [abitanti, edifici, ospedale, dottore]);

  const puòAssegnareDottore = abitantiDisponibiliDottore.length > 0 && !dottore;

  if (!ospedale) {
    return null;
  }

  return (
    <SafeAreaView style={[styles.safe, maxHeight ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>🏥 Ospedale</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Stato Ospedale</Text>
          <Text style={styles.infoText}>
            {dottore ? `Dottore: ${dottore.nome}` : "Nessun dottore assegnato"}
          </Text>
          <Text style={styles.infoSubtext}>
            Malati nel regno: {malati.length} · Incinte: {incinte.length}
          </Text>
        </View>

        <View style={styles.stipendioCard}>
          <Text style={styles.stipendioLabel}>Stipendio mensile per lavoratore (monete)</Text>
          <TextInput
            style={styles.stipendioInput}
            value={String(ospedale.stipendioPerLavoratore ?? 0)}
            keyboardType="number-pad"
            onChangeText={(text) => {
              const n = parseInt(text.replace(/[^0-9]/g, ""), 10);
              setStipendioEdificio(ospedale.id, isNaN(n) ? 0 : Math.max(0, n));
            }}
          />
          <Text style={styles.infoSubtext}>
            Totale: {(ospedale.stipendioPerLavoratore ?? 0) * (ospedale.abitantiAssegnati?.length ?? 0)} monete/mese
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dottore</Text>
          <Pressable
            style={styles.dropdownButton}
            onPress={() => puòAssegnareDottore && setDropdownDottoreVisible(true)}
            disabled={!puòAssegnareDottore && !dottore}
          >
            {dottore ? (
              <View style={styles.dropdownContent}>
                <Text style={styles.dropdownEmoji}>{getEmojiAbitante(dottore)}</Text>
                <View style={styles.dropdownTextContainer}>
                  <Text style={styles.dropdownNome}>{dottore.nome}</Text>
                  <Text style={styles.dropdownCompetenza}>Competenza: {dottore.competenza}%</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.dropdownPlaceholder}>Seleziona Dottore...</Text>
            )}
            <Text style={styles.dropdownArrow}>▼</Text>
          </Pressable>
          {dottore && (
            <Pressable
              style={styles.removeButton}
              onPress={() => rimuoviAbitanteDaEdificio(dottore.id, ospedale.id)}
            >
              <Text style={styles.removeButtonText}>Rimuovi</Text>
            </Pressable>
          )}

          <Modal
            visible={dropdownDottoreVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setDropdownDottoreVisible(false)}
          >
            <Pressable
              style={[styles.modalOverlay, isDesktop && modalBackdropFullscreen]}
              onPress={() => setDropdownDottoreVisible(false)}
            >
              <Pressable style={[styles.modalContent, isDesktop && modalContentFullscreen]} onPress={(e) => e.stopPropagation()}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Seleziona Dottore</Text>
                  <Pressable onPress={() => setDropdownDottoreVisible(false)}>
                    <Text style={styles.modalClose}>✕</Text>
                  </Pressable>
                </View>
                <Text style={styles.modalHint}>Solo abitanti con casta «Servo della gleba».</Text>
                <ScrollView style={styles.modalScrollView}>
                  {abitantiDisponibiliDottore.length > 0 ? (
                    abitantiDisponibiliDottore.map((a: Abitante) => (
                      <Pressable
                        key={a.id}
                        style={styles.dropdownItem}
                        onPress={() => {
                          assegnaAbitanteAEdificio(a.id, ospedale.id);
                          setDropdownDottoreVisible(false);
                        }}
                      >
                        <Text style={styles.dropdownItemEmoji}>{getEmojiAbitante(a)}</Text>
                        <View style={styles.dropdownItemTextContainer}>
                          <Text style={styles.dropdownItemNome}>{a.nome}</Text>
                          <Text style={styles.dropdownItemCompetenza}>Competenza: {a.competenza}%</Text>
                        </View>
                      </Pressable>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>Nessun Servo della gleba disponibile</Text>
                  )}
                </ScrollView>
              </Pressable>
            </Pressable>
          </Modal>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Malati ({malati.length})</Text>
          {malati.length > 0 ? (
            <View style={styles.cardsContainer}>
              {malati.map((malato: Abitante) => (
                <View key={malato.id} style={styles.malatoCard}>
                  <Text style={styles.cardEmoji}>{getEmojiAbitante(malato)}</Text>
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{malato.nome}</Text>
                    <Text style={styles.cardInfo}>Età: {malato.eta} anni</Text>
                    <Text style={styles.malatoPesoSalute}>Peso: {malato.razza === "Golem" ? "—" : `${malato.peso ?? 50}/100`} · Salute: {malato.razza === "Golem" ? "—" : getStatoSalute(malato)}</Text>
                    <Text style={styles.cardInfo}>Soddisfazione: {malato.razza === "Golem" ? "—" : `${Math.round((calcolaFelicitàModificata(malato) - 50) / 10)} punti`}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Nessun malato nel regno</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Incinte ({incinte.length})</Text>
          {incinte.length > 0 ? (
            <View style={styles.cardsContainer}>
              {incinte.map((persona: Abitante) => (
                <View key={persona.id} style={styles.incintaCard}>
                  <Text style={styles.cardEmoji}>{getEmojiAbitante(persona)}</Text>
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{persona.nome}</Text>
                    <Text style={styles.cardInfo}>Età: {persona.eta} anni</Text>
                    <Text style={styles.incintaSalute}>Salute: Incinta</Text>
                    <Text style={styles.cardInfo}>Soddisfazione: {Math.round((calcolaFelicitàModificata(persona) - 50) / 10)} punti</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Nessuna persona incinta nel regno</Text>
          )}
        </View>
      </ScrollView>
    </View>
    <View style={styles.footer}>
      <Text style={styles.back} onPress={() => router.back()}>← Edifici</Text>
    </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#050816"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.6)"
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.6)"
  },
  back: {
    color: "#93c5fd",
    fontSize: 12
  },
  title: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700"
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    paddingBottom: 6,
    gap: 4,
    flex: 1
  },
  infoCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  infoTitle: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  infoText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2
  },
  infoSubtext: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9,
    marginTop: 2
  },
  stipendioCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  stipendioLabel: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4
  },
  stipendioInput: {
    backgroundColor: "rgba(30,41,59,0.9)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)",
    borderRadius: 4,
    padding: 6,
    color: "#e5e7eb",
    fontSize: 14,
    minWidth: 80
  },
  malatoPesoSalute: {
    color: "rgba(203,213,245,0.8)",
    fontSize: 9,
    marginTop: 2
  },
  incintaSalute: {
    color: "#f9a8d4",
    fontSize: 9,
    marginTop: 2,
    fontWeight: "600"
  },
  section: {
    marginTop: 4
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4
  },
  cardsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4
  },
  malatoCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: "#f97316",
    alignItems: "center",
    width: "48%",
    minWidth: 120
  },
  incintaCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: "#ec4899",
    alignItems: "center",
    width: "48%",
    minWidth: 120
  },
  cardEmoji: {
    fontSize: 24,
    marginBottom: 2
  },
  cardContent: {
    width: "100%",
    alignItems: "center"
  },
  cardTitle: {
    color: "#e5e7eb",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 1,
    textAlign: "center"
  },
  cardInfo: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 8,
    textAlign: "center",
    marginBottom: 1
  },
  removeButton: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    width: 80,
    alignItems: "center"
  },
  removeButtonText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "600"
  },
  emptyText: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 10,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 8
  },
  dropdownButton: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6
  },
  dropdownContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1
  },
  dropdownEmoji: {
    fontSize: 20,
    marginRight: 8
  },
  dropdownTextContainer: {
    flex: 1
  },
  dropdownNome: {
    color: "#e5e7eb",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2
  },
  dropdownCompetenza: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9
  },
  dropdownPlaceholder: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 11,
    flex: 1
  },
  dropdownArrow: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center"
  },
  modalContent: {
    backgroundColor: "#050816",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    width: "80%",
    maxWidth: 400,
    maxHeight: "70%"
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.6)"
  },
  modalTitle: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700"
  },
  modalHint: {
    color: "rgba(203,213,245,0.65)",
    fontSize: 9,
    paddingHorizontal: 12,
    paddingTop: 8
  },
  modalClose: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 18,
    fontWeight: "700"
  },
  modalScrollView: {
    maxHeight: 300
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.3)"
  },
  dropdownItemEmoji: {
    fontSize: 20,
    marginRight: 10
  },
  dropdownItemTextContainer: {
    flex: 1
  },
  dropdownItemNome: {
    color: "#e5e7eb",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2
  },
  dropdownItemCompetenza: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9
  }
});
