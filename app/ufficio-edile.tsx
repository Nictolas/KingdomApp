import React, { useMemo, useState } from "react";
import { Dimensions, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { getServiDellaGlebaPerAssegnazioneEdificio } from "../src/game/edificiLavoro";
import {
  elencoCantieri,
  NOME_UFFICIO_EDILE,
  PROGRESSO_COSTRUZIONE_COMPLETO
} from "../src/game/costruzioneEdifici";
import { getEmojiAbitante } from "../src/utils/getEmojiAbitante";
import { modalBackdropFullscreen, modalContentFullscreen } from "../src/ui/modalFullscreenStyles";
import type { Abitante } from "../src/types";

export default function UfficioEdileScreen() {
  const router = useRouter();
  const { abitanti, edifici, assegnaAbitanteAEdificio, rimuoviAbitanteDaEdificio, setStipendioEdificio } =
    useGameContext();
  const [dropdownVisible, setDropdownVisible] = useState(false);

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const ufficio = edifici.find((e) => e.nome === NOME_UFFICIO_EDILE);
  const ediliIds = ufficio?.abitantiAssegnati ?? [];
  const edili = ediliIds.map((id) => abitanti.find((a) => a.id === id)).filter((a): a is Abitante => a != null);
  const abitantiDisponibili = useMemo(() => {
    if (!ufficio) return [];
    return getServiDellaGlebaPerAssegnazioneEdificio(abitanti, edifici, ufficio);
  }, [abitanti, edifici, ufficio]);
  const cantieri = useMemo(() => elencoCantieri(edifici), [edifici]);

  if (!ufficio) return null;

  return (
    <SafeAreaView style={[styles.safe, maxHeight ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>🏗️ Ufficio Edile</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Stato Ufficio</Text>
            <Text style={styles.infoText}>
              Edili: {edili.length}/{ufficio.capacità ?? 12}
            </Text>
            <Text style={styles.infoSubtext}>
              Gli edili assegnati avanzano i cantieri ogni ora di gioco. Più edili = costruzione più rapida.
            </Text>
            {edili.length === 0 && cantieri.length > 0 && (
              <Text style={[styles.infoSubtext, styles.infoWarn]}>
                Nessun edile assegnato: {cantieri.length} cantiere/i in sospeso.
              </Text>
            )}
          </View>

          <View style={styles.stipendioCard}>
            <Text style={styles.stipendioLabel}>Stipendio mensile per lavoratore (monete)</Text>
            <TextInput
              style={styles.stipendioInput}
              value={String(ufficio.stipendioPerLavoratore ?? 0)}
              keyboardType="number-pad"
              onChangeText={(text) => {
                const n = parseInt(text.replace(/[^0-9]/g, ""), 10);
                setStipendioEdificio(ufficio.id, isNaN(n) ? 0 : Math.max(0, n));
              }}
            />
            <Text style={styles.infoSubtext}>
              Totale: {(ufficio.stipendioPerLavoratore ?? 0) * ediliIds.length} monete/mese
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Edili</Text>
            {ediliIds.length < (ufficio.capacità ?? 12) && (
              <Pressable style={styles.addButton} onPress={() => setDropdownVisible(true)}>
                <Text style={styles.addButtonText}>+ Assumi edile</Text>
              </Pressable>
            )}
            {edili.length > 0 ? (
              <View style={styles.cardsContainer}>
                {edili.map((a) => (
                  <View key={a.id} style={styles.personCard}>
                    <Text style={styles.cardEmoji}>{getEmojiAbitante(a)}</Text>
                    <View style={styles.cardContent}>
                      <Text style={styles.cardTitle}>{a.nome}</Text>
                      <Text style={styles.cardInfo}>Competenza: {a.competenza}%</Text>
                    </View>
                    <Pressable
                      style={styles.removeButton}
                      onPress={() => rimuoviAbitanteDaEdificio(a.id, ufficio.id)}
                    >
                      <Text style={styles.removeButtonText}>Rimuovi</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>Nessun edile assunto</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cantieri in corso</Text>
            {cantieri.length > 0 ? (
              <View style={styles.cardsContainer}>
                {cantieri.map((c) => {
                  const prog = c.progressoCostruzione ?? 0;
                  return (
                    <View key={c.id} style={styles.cantiereCard}>
                      <Text style={styles.cardEmoji}>{c.emoji}</Text>
                      <View style={styles.cardContent}>
                        <Text style={styles.cardTitle}>{c.nome}</Text>
                        <Text style={styles.cardInfo}>
                          Avanzamento: {prog}/{PROGRESSO_COSTRUZIONE_COMPLETO}
                        </Text>
                        <View style={styles.progressTrack}>
                          <View
                            style={[
                              styles.progressFill,
                              { width: `${Math.min(100, Math.max(0, prog))}%` }
                            ]}
                          />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyText}>Nessun edificio in costruzione</Text>
            )}
          </View>

          <Modal
            visible={dropdownVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setDropdownVisible(false)}
          >
            <Pressable
              style={[styles.modalOverlay, isDesktop && modalBackdropFullscreen]}
              onPress={() => setDropdownVisible(false)}
            >
              <Pressable
                style={[styles.modalContent, isDesktop && modalContentFullscreen]}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Seleziona edile</Text>
                  <Pressable onPress={() => setDropdownVisible(false)}>
                    <Text style={styles.modalClose}>✕</Text>
                  </Pressable>
                </View>
                <ScrollView style={styles.modalScrollView}>
                  {abitantiDisponibili.length > 0 ? (
                    abitantiDisponibili.map((a) => (
                      <Pressable
                        key={a.id}
                        style={styles.dropdownItem}
                        onPress={() => {
                          assegnaAbitanteAEdificio(a.id, ufficio.id);
                          setDropdownVisible(false);
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
                    <Text style={styles.emptyText}>Nessun abitante disponibile</Text>
                  )}
                </ScrollView>
              </Pressable>
            </Pressable>
          </Modal>
        </ScrollView>
      </View>
      <View style={styles.footer}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Edifici
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050816" },
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
  back: { color: "#93c5fd", fontSize: 12 },
  title: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  content: { paddingHorizontal: 12, paddingVertical: 8, paddingBottom: 24 },
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
  infoText: { color: "#ffffff", fontSize: 11, fontWeight: "600", marginBottom: 2 },
  infoSubtext: { color: "rgba(203,213,245,0.7)", fontSize: 9, marginTop: 2 },
  infoWarn: { color: "#fde047", fontWeight: "600" },
  stipendioCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  stipendioLabel: { color: "#93c5fd", fontSize: 10, fontWeight: "600", marginBottom: 4 },
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
  section: { marginTop: 12 },
  sectionTitle: { color: "#ffffff", fontSize: 11, fontWeight: "700", marginBottom: 6 },
  addButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 4,
    marginBottom: 8,
    alignItems: "center"
  },
  addButtonText: { color: "#ffffff", fontSize: 10, fontWeight: "600" },
  cardsContainer: { gap: 6 },
  personCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  cantiereCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(253,224,71,0.45)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  cardEmoji: { fontSize: 22 },
  cardContent: { flex: 1 },
  cardTitle: { color: "#e5e7eb", fontSize: 11, fontWeight: "700", marginBottom: 2 },
  cardInfo: { color: "rgba(203,213,245,0.7)", fontSize: 9 },
  progressTrack: {
    marginTop: 4,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(30,41,59,0.9)",
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#fde047",
    borderRadius: 3
  },
  removeButton: { backgroundColor: "#ef4444", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  removeButtonText: { color: "#ffffff", fontSize: 9, fontWeight: "600" },
  emptyText: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 10,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 12
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" },
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
  modalTitle: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  modalClose: { color: "rgba(203,213,245,0.7)", fontSize: 18, fontWeight: "700" },
  modalScrollView: { maxHeight: 300 },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.3)"
  },
  dropdownItemEmoji: { fontSize: 20, marginRight: 10 },
  dropdownItemTextContainer: { flex: 1 },
  dropdownItemNome: { color: "#e5e7eb", fontSize: 11, fontWeight: "700", marginBottom: 2 },
  dropdownItemCompetenza: { color: "rgba(203,213,245,0.7)", fontSize: 9 }
});
