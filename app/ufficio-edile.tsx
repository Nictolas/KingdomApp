import React, { useMemo, useState, useSyncExternalStore } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { getServiDellaGlebaPerAssegnazioneEdificio } from "../src/game/edificiLavoro";
import {
  elencoCantieri,
  NOME_UFFICIO_EDILE,
  PROGRESSO_COSTRUZIONE_COMPLETO
} from "../src/game/costruzioneEdifici";
import { getStipendioMoneteGiornaliero, stipendioGiornalieroToPersistito } from "../src/game/edificiPubblici";
import { computeStatoCielo } from "../src/game/cicloCielo";
import {
  etichettaDoveSiTrovaAddetto,
  lavoratoreDentroEdificioOra
} from "../src/game/presenzaLavoroEdificio";
import {
  getLavoroArrivatiMappaSnapshot,
  subscribeLavoroArrivatiMappa
} from "../src/game/mappaLavoroArrivatiStore";
import { useOrologioGioco } from "../src/hooks/useOrologioGioco";
import { AbitanteAvatarPreview } from "../src/ui/AbitanteAvatarPreview";
import { AbitanteInfoModal } from "../src/ui/AbitanteInfoModal";
import { modalBackdropFullscreen, modalContentFullscreen } from "../src/ui/modalFullscreenStyles";
import type { Abitante } from "../src/types";

export default function UfficioEdileScreen() {
  const router = useRouter();
  const {
    abitanti,
    edifici,
    assegnaAbitanteAEdificio,
    rimuoviAbitanteDaEdificio,
    setStipendioEdificio,
    calcolaFelicitàModificata,
    etaMinimaLavoro
  } = useGameContext();
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [selectedAbitante, setSelectedAbitante] = useState<Abitante | null>(null);
  const getAbitanteNome = (id: number) => abitanti.find((a) => a.id === id)?.nome ?? `ID ${id}`;

  const { minuti: orologioMinuti } = useOrologioGioco();
  const statoCielo = computeStatoCielo(orologioMinuti);
  const lavoroArrivatiMappa = useSyncExternalStore(
    subscribeLavoroArrivatiMappa,
    getLavoroArrivatiMappaSnapshot,
    getLavoroArrivatiMappaSnapshot
  );

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const ufficio = edifici.find((e) => e.nome === NOME_UFFICIO_EDILE);
  const ediliIds = ufficio?.abitantiAssegnati ?? [];
  const edili = ediliIds.map((id) => abitanti.find((a) => a.id === id)).filter((a): a is Abitante => a != null);
  const ediliInServizio = ufficio
    ? edili.filter((a) =>
        lavoratoreDentroEdificioOra(a.id, ufficio.id, orologioMinuti, edifici, lavoroArrivatiMappa)
      ).length
    : 0;
  const abitantiDisponibili = useMemo(() => {
    if (!ufficio) return [];
    return getServiDellaGlebaPerAssegnazioneEdificio(abitanti, edifici, ufficio);
  }, [abitanti, edifici, ufficio]);
  const cantieri = useMemo(() => elencoCantieri(edifici), [edifici]);

  if (!ufficio) return null;

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
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
              Edili: {edili.length}/{ufficio.capacità ?? 12} · {ediliInServizio} in ufficio
            </Text>
            <Text style={styles.infoSubtext}>
              Gli edili assegnati avanzano i cantieri di 1 punto all’ora ciascuno. Con un cantiere in corso si recano a
              piedi al primo della lista.{" "}
              <Text style={styles.legendVerde}>Verde = attualmente in Ufficio.</Text>
            </Text>
            {edili.length === 0 && cantieri.length > 0 && (
              <Text style={[styles.infoSubtext, styles.infoWarn]}>
                Nessun edile assegnato: {cantieri.length} cantiere/i in sospeso.
              </Text>
            )}
          </View>

          <View style={styles.stipendioCard}>
            <Text style={styles.stipendioLabel}>Stipendio giornaliero per lavoratore (monete)</Text>
            <TextInput
              style={styles.stipendioInput}
              value={String(getStipendioMoneteGiornaliero(ufficio))}
              keyboardType="number-pad"
              onChangeText={(text) => {
                const n = parseInt(text.replace(/[^0-9]/g, ""), 10);
                setStipendioEdificio(ufficio.id, stipendioGiornalieroToPersistito(isNaN(n) ? 0 : n));
              }}
            />
            <Text style={styles.infoSubtext}>
              Totale: {getStipendioMoneteGiornaliero(ufficio) * ediliIds.length} monete/giorno
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
                {edili.map((a) => {
                  const presenza = etichettaDoveSiTrovaAddetto(
                    a,
                    ufficio.id,
                    orologioMinuti,
                    statoCielo.buio,
                    edifici,
                    lavoroArrivatiMappa
                  );
                  const inServizio = presenza.inServizio;
                  return (
                    <Pressable
                      key={a.id}
                      style={[
                        styles.personCard,
                        inServizio ? styles.personCardInServizio : styles.personCardAssente
                      ]}
                      onPress={() => setSelectedAbitante(a)}
                    >
                      <AbitanteAvatarPreview abitante={a} />
                      <View style={styles.cardContent}>
                        <Text style={styles.cardTitle}>{a.nome}</Text>
                        <Text style={styles.cardInfo}>Competenza: {a.competenza}%</Text>
                        <Text
                          style={[
                            styles.presenzaLabel,
                            inServizio && styles.presenzaLabelInServizio
                          ]}
                        >
                          {presenza.testo}
                        </Text>
                      </View>
                      <Pressable
                        style={styles.removeButton}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          rimuoviAbitanteDaEdificio(a.id, ufficio.id);
                        }}
                      >
                        <Text style={styles.removeButtonText}>Rimuovi</Text>
                      </Pressable>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyText}>Nessun edile assunto</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cantieri in corso</Text>
            {cantieri.length > 0 ? (
              <View style={styles.cardsContainer}>
                {cantieri.map((c, index) => {
                  const prog = c.progressoCostruzione ?? 0;
                  return (
                    <View key={c.id} style={styles.cantiereCard}>
                      <Text style={styles.cardEmoji}>{c.emoji}</Text>
                      <View style={styles.cardContent}>
                        <Text style={styles.cardTitle}>
                          {index === 0 ? `${c.nome} · destinazione edili` : c.nome}
                        </Text>
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
                        <AbitanteAvatarPreview abitante={a} size={32} />
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

      <AbitanteInfoModal
        visible={selectedAbitante !== null}
        abitante={selectedAbitante}
        edifici={edifici}
        onClose={() => setSelectedAbitante(null)}
        getAbitanteNome={getAbitanteNome}
        calcolaFelicitàModificata={calcolaFelicitàModificata}
        etaMinimaLavoro={etaMinimaLavoro}
      />
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
  title: { color: "#e5e7eb", fontSize: 16, fontWeight: "700" },
  content: { padding: 12, gap: 12, paddingBottom: 24 },
  infoCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)"
  },
  infoTitle: { color: "#e5e7eb", fontSize: 13, fontWeight: "700", marginBottom: 4 },
  infoText: { color: "#cbd5e1", fontSize: 12, marginBottom: 4 },
  infoSubtext: { color: "rgba(203,213,245,0.65)", fontSize: 10, lineHeight: 14 },
  infoWarn: { color: "#fbbf24", marginTop: 6 },
  legendVerde: { color: "#86efac", fontWeight: "600" },
  stipendioCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
    gap: 6
  },
  stipendioLabel: { color: "#e5e7eb", fontSize: 11, fontWeight: "600" },
  stipendioInput: {
    backgroundColor: "rgba(2,6,23,0.8)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)",
    borderRadius: 6,
    color: "#f8fafc",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14
  },
  section: { gap: 8 },
  sectionTitle: { color: "#e5e7eb", fontSize: 13, fontWeight: "700" },
  addButton: {
    alignSelf: "flex-start",
    backgroundColor: "#2563eb",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  addButtonText: { color: "#ffffff", fontSize: 11, fontWeight: "600" },
  cardsContainer: { gap: 6 },
  personCard: {
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  personCardInServizio: {
    backgroundColor: "rgba(22,101,52,0.38)",
    borderColor: "rgba(74,222,128,0.5)"
  },
  personCardAssente: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderColor: "rgba(148,163,184,0.6)"
  },
  presenzaLabel: {
    marginTop: 3,
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(203,213,245,0.55)"
  },
  presenzaLabelInServizio: { color: "#bbf7d0" },
  cardContent: { flex: 1 },
  cardTitle: { color: "#e5e7eb", fontSize: 11, fontWeight: "700", marginBottom: 2 },
  cardInfo: { color: "rgba(203,213,245,0.7)", fontSize: 9 },
  cardEmoji: { fontSize: 22 },
  removeButton: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4
  },
  removeButtonText: { color: "#ffffff", fontSize: 9, fontWeight: "600" },
  cantiereCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.45)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  progressTrack: {
    marginTop: 4,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(51,65,85,0.9)",
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#fbbf24"
  },
  emptyText: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 10,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 12
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center"
  },
  modalContent: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 16,
    width: "88%",
    maxWidth: 420,
    maxHeight: "70%",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)"
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12
  },
  modalTitle: { color: "#e5e7eb", fontSize: 14, fontWeight: "700" },
  modalClose: { color: "#94a3b8", fontSize: 18, paddingHorizontal: 4 },
  modalScrollView: { maxHeight: 360 },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.35)"
  },
  dropdownItemTextContainer: { flex: 1 },
  dropdownItemNome: { color: "#e5e7eb", fontSize: 12, fontWeight: "600" },
  dropdownItemCompetenza: { color: "rgba(203,213,245,0.65)", fontSize: 10 },
  footer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.6)"
  },
  back: { color: "#93c5fd", fontSize: 13, fontWeight: "600" }
});
