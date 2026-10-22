import React, { useMemo, useState } from "react";
import { Dimensions, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { getServiDellaGlebaPerAssegnazioneEdificio } from "../src/game/edificiLavoro";
import { getEmojiAbitante } from "../src/utils/getEmojiAbitante";
import { modalBackdropFullscreen, modalContentFullscreen } from "../src/ui/modalFullscreenStyles";
import type { Abitante } from "../src/types";

export default function TribunaleScreen() {
  const router = useRouter();
  const {
    abitanti,
    edifici,
    assegnaAbitanteAEdificio,
    rimuoviAbitanteDaEdificio,
    graziaCriminale,
    condannaAMorte,
    penaDiMorteAttiva,
    faiDecidereAlGiudice,
    condannaLavoriForzati
  } = useGameContext();
  const [dropdownGiudiceVisible, setDropdownGiudiceVisible] = useState(false);
  const [messaggiImputati, setMessaggiImputati] = useState<Record<number, { testo: string; ok: boolean }>>({});

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const tribunale = edifici.find((e) => e.nome === "Tribunale");
  const giudiceId = tribunale && tribunale.abitantiAssegnati.length > 0 ? tribunale.abitantiAssegnati[0] : null;
  const giudice = giudiceId ? abitanti.find((a) => a.id === giudiceId) : null;
  const imputati = abitanti.filter((a: Abitante) => (a.reati?.length ?? 0) > 0);
  const abitantiDisponibiliGiudice = useMemo(() => {
    if (!tribunale || giudice) return [];
    return getServiDellaGlebaPerAssegnazioneEdificio(abitanti, edifici, tribunale);
  }, [abitanti, edifici, tribunale, giudice]);

  if (!tribunale) return null;

  const setMessaggio = (id: number, testo: string, ok: boolean) => {
    setMessaggiImputati((prev) => ({ ...prev, [id]: { testo, ok } }));
  };

  const handleGiudiceDecide = (id: number) => {
    const esito = faiDecidereAlGiudice(id);
    setMessaggio(id, esito.messaggio, esito.ok);
    if (esito.ok) {
      setMessaggiImputati((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleLavoriForzati = (id: number) => {
    const esito = condannaLavoriForzati(id);
    setMessaggio(id, esito.messaggio, esito.ok);
    if (esito.ok) {
      setMessaggiImputati((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  return (
    <SafeAreaView style={[styles.safe, maxHeight ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>⚖️ Tribunale</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Stato Tribunale</Text>
            <Text style={styles.infoText}>
              {giudice ? `Giudice: ${giudice.nome}` : "Nessun giudice assegnato"}
            </Text>
            <Text style={styles.infoSubtext}>Imputati nel regno: {imputati.length}</Text>
          </View>

          <Pressable style={styles.reatiButton} onPress={() => router.push("/reati")}>
            <Text style={styles.reatiButtonText}>📜 Reati</Text>
          </Pressable>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Giudice</Text>
            <Pressable style={styles.dropdownButton} onPress={() => setDropdownGiudiceVisible(true)}>
              {giudice ? (
                <View style={styles.dropdownContent}>
                  <Text style={styles.dropdownEmoji}>{getEmojiAbitante(giudice)}</Text>
                  <View style={styles.dropdownTextContainer}>
                    <Text style={styles.dropdownNome}>{giudice.nome}</Text>
                    <Text style={styles.dropdownCompetenza}>Competenza: {giudice.competenza}%</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.dropdownPlaceholder}>Seleziona Giudice...</Text>
              )}
              <Text style={styles.dropdownArrow}>▼</Text>
            </Pressable>

            {giudice && (
              <Pressable style={styles.removeButton} onPress={() => rimuoviAbitanteDaEdificio(giudice.id, tribunale.id)}>
                <Text style={styles.removeButtonText}>Rimuovi</Text>
              </Pressable>
            )}

            <Modal
              visible={dropdownGiudiceVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setDropdownGiudiceVisible(false)}
            >
              <Pressable
                style={[styles.modalOverlay, isDesktop && modalBackdropFullscreen]}
                onPress={() => setDropdownGiudiceVisible(false)}
              >
                <Pressable
                  style={[styles.modalContent, isDesktop && modalContentFullscreen]}
                  onPress={(e) => e.stopPropagation()}
                >
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Seleziona Giudice</Text>
                    <Pressable onPress={() => setDropdownGiudiceVisible(false)}>
                      <Text style={styles.modalClose}>✕</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.modalHint}>Solo abitanti con casta «Servo della gleba».</Text>
                  <ScrollView style={styles.modalScrollView}>
                    {abitantiDisponibiliGiudice.length > 0 ? (
                      abitantiDisponibiliGiudice.map((a: Abitante) => (
                        <Pressable
                          key={a.id}
                          style={styles.dropdownItem}
                          onPress={() => {
                            assegnaAbitanteAEdificio(a.id, tribunale.id);
                            setDropdownGiudiceVisible(false);
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
            <Text style={styles.sectionTitle}>Imputati ({imputati.length})</Text>
            <Text style={styles.sectionHint}>
              Graziare: reati azzerati. Il graziato e i suoi Amici +10% Lealtà; i suoi Nemici −10% Lealtà.
            </Text>
            {imputati.length > 0 ? (
              <View style={styles.cardsContainer}>
                {imputati.map((c) => {
                  const msg = messaggiImputati[c.id];
                  return (
                    <View key={c.id} style={styles.imputatoCard}>
                      <Text style={styles.cardEmoji}>{getEmojiAbitante(c)}</Text>
                      <View style={styles.cardContent}>
                        <Text style={styles.cardTitle}>{c.nome}</Text>
                        <Text style={styles.cardInfo}>Età: {c.eta} anni</Text>
                        <Text style={styles.cardInfo}>
                          Reati: <Text style={styles.cardInfoStrong}>{(c.reati ?? []).join(", ")}</Text>
                        </Text>
                      </View>
                      {msg && (
                        <Text style={[styles.feedback, msg.ok ? styles.feedbackOk : styles.feedbackErr]}>
                          {msg.testo}
                        </Text>
                      )}
                      <View style={styles.imputatoButtons}>
                        <Pressable style={styles.giudiceButton} onPress={() => handleGiudiceDecide(c.id)}>
                          <Text style={styles.giudiceButtonText}>Fai decidere al Giudice</Text>
                        </Pressable>
                        <Pressable style={styles.lavoriButton} onPress={() => handleLavoriForzati(c.id)}>
                          <Text style={styles.lavoriButtonText}>Condanna ai Lavori Forzati</Text>
                        </Pressable>
                      </View>
                      <View style={styles.imputatoButtonsSecondari}>
                        <Pressable style={styles.graziaButton} onPress={() => graziaCriminale(c.id)}>
                          <Text style={styles.graziaButtonText}>Grazia</Text>
                        </Pressable>
                        {penaDiMorteAttiva && (
                          <Pressable style={styles.condannaButton} onPress={() => condannaAMorte(c.id)}>
                            <Text style={styles.condannaButtonText}>Condanna a Morte</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyText}>Nessun imputato nel regno</Text>
            )}
          </View>
        </ScrollView>
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
  content: { paddingHorizontal: 12, paddingVertical: 4, paddingBottom: 6, gap: 4, flex: 1 },
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
  reatiButton: {
    backgroundColor: "rgba(30,41,59,0.95)",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#93c5fd",
    alignItems: "center",
    marginTop: 4
  },
  reatiButtonText: { color: "#93c5fd", fontSize: 11, fontWeight: "700" },
  section: { marginTop: 4 },
  sectionTitle: { color: "#ffffff", fontSize: 11, fontWeight: "700", marginBottom: 4 },
  sectionHint: { color: "rgba(203,213,245,0.6)", fontSize: 9, marginBottom: 6 },
  cardsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  imputatoCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "#f97316",
    width: "100%",
    minWidth: 200
  },
  imputatoButtons: { flexDirection: "row", gap: 6, marginTop: 8, width: "100%" },
  imputatoButtonsSecondari: { flexDirection: "row", gap: 6, marginTop: 6, width: "100%" },
  giudiceButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    flex: 1,
    alignItems: "center"
  },
  giudiceButtonText: { color: "#ffffff", fontSize: 9, fontWeight: "700", textAlign: "center" },
  lavoriButton: {
    backgroundColor: "#a16207",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    flex: 1,
    alignItems: "center"
  },
  lavoriButtonText: { color: "#ffffff", fontSize: 9, fontWeight: "700", textAlign: "center" },
  graziaButton: {
    backgroundColor: "#22c55e",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    flex: 1,
    alignItems: "center"
  },
  graziaButtonText: { color: "#ffffff", fontSize: 10, fontWeight: "700" },
  condannaButton: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    flex: 1,
    alignItems: "center"
  },
  condannaButtonText: { color: "#ffffff", fontSize: 9, fontWeight: "700" },
  feedback: { fontSize: 9, marginTop: 6, textAlign: "center", fontWeight: "600" },
  feedbackOk: { color: "#86efac" },
  feedbackErr: { color: "#fca5a5" },
  cardEmoji: { fontSize: 24, marginBottom: 2, textAlign: "center" },
  cardContent: { width: "100%", alignItems: "center" },
  cardTitle: { color: "#e5e7eb", fontSize: 11, fontWeight: "700", marginBottom: 1, textAlign: "center" },
  cardInfo: { color: "rgba(203,213,245,0.7)", fontSize: 8, textAlign: "center", marginBottom: 1 },
  cardInfoStrong: { color: "#ffffff", fontWeight: "700" },
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
  dropdownContent: { flexDirection: "row", alignItems: "center", flex: 1 },
  dropdownEmoji: { fontSize: 20, marginRight: 8 },
  dropdownTextContainer: { flex: 1 },
  dropdownNome: { color: "#e5e7eb", fontSize: 11, fontWeight: "700", marginBottom: 2 },
  dropdownCompetenza: { color: "rgba(203,213,245,0.7)", fontSize: 9 },
  dropdownPlaceholder: { color: "rgba(203,213,245,0.5)", fontSize: 11, flex: 1 },
  dropdownArrow: { color: "rgba(203,213,245,0.7)", fontSize: 10 },
  removeButton: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    width: 80,
    alignItems: "center"
  },
  removeButtonText: { color: "#ffffff", fontSize: 9, fontWeight: "600" },
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
  modalHint: { color: "rgba(203,213,245,0.65)", fontSize: 9, paddingHorizontal: 12, paddingTop: 8 },
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
