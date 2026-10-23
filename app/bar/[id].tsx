import { tornaAllaMappa } from "../../src/navigation/tornaAllaMappa";
import React, { useMemo, useState, useSyncExternalStore } from "react";
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { BuildingScreenShell, BUILDING_WIDE_BREAKPOINT } from "../../src/ui/BuildingScreenShell";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useGameContext } from "../../src/context/GameContext";
import { computeStatoCielo } from "../../src/game/cicloCielo";
import { abitantiPresentiNelBarOra } from "../../src/game/orariLavoroMappa";
import {
  getBarArrivatiMappaSnapshotForEdificio,
  subscribeBarArrivatiMappa
} from "../../src/game/mappaBarArrivatiStore";
import { formatOrologioGioco } from "../../src/game/orologioGiocoSession";
import { useOrologioGioco } from "../../src/hooks/useOrologioGioco";
import { getServiDellaGlebaPerAssegnazioneEdificio } from "../../src/game/edificiLavoro";
import { getCastaAbitante } from "../../src/game/casta";
import { getStipendioMensileEdificio, STIPENDIO_BASE_MONETE_GIORNO } from "../../src/game/edificiPubblici";
import { COSTO_BAR_MONETE } from "../../src/game/barEconomia";
import { getCassaImpresa, getFatturatoMeseImpresa } from "../../src/game/impresaCassa";
import { getEmojiAbitante } from "../../src/utils/getEmojiAbitante";
import { modalBackdropFullscreen, modalContentFullscreen } from "../../src/ui/modalFullscreenStyles";
import type { Abitante } from "../../src/types";

export default function BarScreenById() {
  const router = useRouter();
  const raw = useLocalSearchParams<{ id: string | string[] }>().id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const edificioId = Number(idStr);

  const { abitanti, edifici, assegnaServoDellaGlebaAEdificio, rimuoviAbitanteDaEdificio, setStipendioEdificio } = useGameContext();
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const { minuti: orologioMinuti, inPausa: orologioInPausa, togglePausa: toggleOrologioPausa } =
    useOrologioGioco();
  const statoCielo = computeStatoCielo(orologioMinuti);

  const barArrivatiMappa = useSyncExternalStore(
    subscribeBarArrivatiMappa,
    () => getBarArrivatiMappaSnapshotForEdificio(edificioId),
    () => getBarArrivatiMappaSnapshotForEdificio(edificioId)
  );

  const { width } = useWindowDimensions();
  const isDesktop = width >= BUILDING_WIDE_BREAKPOINT;

  const bar = useMemo(
    () => edifici.find((e) => e.id === edificioId && e.nome === "Bar"),
    [edifici, edificioId]
  );

  const candidatiBar = abitantiPresentiNelBarOra(abitanti, orologioMinuti, statoCielo.buio, edifici);
  const presentiOraDisoccupati =
    barArrivatiMappa.size > 0
      ? candidatiBar.filter((a) => barArrivatiMappa.has(a.id))
      : candidatiBar;
  const addettiIds = bar?.abitantiAssegnati ?? [];
  const visitatoriDisoccupati = presentiOraDisoccupati.filter((a) => !addettiIds.includes(a.id));
  const addetti = addettiIds.map((id) => abitanti.find((a) => a.id === id)).filter((a): a is Abitante => a != null);
  const abitantiDisponibili = useMemo(() => {
    if (!bar) return [];
    return getServiDellaGlebaPerAssegnazioneEdificio(abitanti, edifici, bar);
  }, [abitanti, edifici, bar]);

  if (!Number.isFinite(edificioId) || !bar) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.title}>Bar non trovato</Text>
        
      </SafeAreaView>
    );
  }

  const titoloBar = edificioId === 17 ? "🍺 Bar" : `🍺 Bar (#${edificioId})`;
  const clienti = visitatoriDisoccupati;
  const cap = bar.capacità ?? 20;

  return (
    <>
      <BuildingScreenShell
        title={titoloBar}
        onBack={() => tornaAllaMappa(router)}
        backLabel="Mappa"
      >
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Stato Bar</Text>
          <View style={styles.clockRow}>
            <Text style={styles.clockLine}>
              🕐 Ora di gioco: {formatOrologioGioco(orologioMinuti)}
              {orologioInPausa ? " (in pausa)" : ""}
            </Text>
            <Pressable
              style={[styles.orologioPausaBtn, orologioInPausa && styles.orologioPausaBtnAttivo]}
              onPress={toggleOrologioPausa}
              accessibilityLabel={orologioInPausa ? "Riprendi il tempo" : "Metti in pausa il tempo"}
            >
              <Text style={styles.orologioPausaBtnText}>{orologioInPausa ? "▶️" : "⏸️"}</Text>
            </Pressable>
          </View>
          <Text style={styles.infoSubtext}>
            Luogo di ritrovo per bere, socializzare e rilassarsi dopo il lavoro.
          </Text>
          <Text style={styles.infoText}>🍺 Birra: {COSTO_BAR_MONETE} monete</Text>
          <Text style={styles.infoSubtext}>
            Cassa: {getCassaImpresa(bar)} monete · Fatturato mese: {getFatturatoMeseImpresa(bar)} monete
          </Text>
        </View>

        <View style={[styles.dueColonne, isDesktop && styles.dueColonneWide]}>
          <View style={[styles.colonna, isDesktop && styles.colonnaWide, styles.lavoratoriCard]}>
            <Text style={styles.sectionTitle}>Lavoratori</Text>
            <Text style={styles.lavoratoriCount}>
              {addetti.length}/{cap} posti
            </Text>
            <Text style={styles.infoSubtext}>
              Se il Bar è vuoto, il primo abitante idoneo può diventare Barista. Puoi anche assegnare Servi della gleba.
            </Text>
            {addetti.length > 0 ? (
              <View style={styles.cardsContainer}>
                {addetti.map((a) => (
                  <View key={a.id} style={styles.personCard}>
                    <Text style={styles.cardEmoji}>{getEmojiAbitante(a)}</Text>
                    <View style={styles.cardContent}>
                      <Text style={styles.cardTitle}>{a.nome}</Text>
                      <Text style={styles.cardInfo}>
                        {a.lavoro} · {getCastaAbitante(a)} · {a.competenza}%
                      </Text>
                    </View>
                    <Pressable
                      style={styles.removeButton}
                      onPress={() => rimuoviAbitanteDaEdificio(a.id, bar.id)}
                    >
                      <Text style={styles.removeButtonText}>Rimuovi</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyVisitatori}>Nessun lavoratore assegnato.</Text>
            )}
            {addettiIds.length < cap && (
              <Pressable style={styles.addButton} onPress={() => setDropdownVisible(true)}>
                <Text style={styles.addButtonText}>+ Aggiungi Servo della gleba</Text>
              </Pressable>
            )}
            <View style={styles.stipendioInline}>
              <Text style={styles.stipendioLabel}>
                Stipendio mensile ({STIPENDIO_BASE_MONETE_GIORNO} moneta/giorno)
              </Text>
              <TextInput
                style={styles.stipendioInput}
                value={String(getStipendioMensileEdificio(bar))}
                keyboardType="number-pad"
                onChangeText={(text) => {
                  const n = parseInt(text.replace(/[^0-9]/g, ""), 10);
                  setStipendioEdificio(bar.id, isNaN(n) ? 0 : Math.max(0, n));
                }}
              />
              <Text style={styles.infoSubtext}>
                Totale: {getStipendioMensileEdificio(bar) * addettiIds.length} monete/mese
              </Text>
            </View>
          </View>

          <View style={[styles.colonna, isDesktop && styles.colonnaWide, styles.clientiCard]}>
            <Text style={styles.sectionTitle}>Clienti</Text>
            <Text style={styles.lavoratoriCount}>{clienti.length} presenti</Text>
            <Text style={styles.infoSubtext}>
              Di giorno, fuori orario di lavoro, abitanti in visita; di notte sono a casa.
            </Text>
            {clienti.length > 0 ? (
              <View style={styles.cardsContainer}>
                {clienti.map((a) => (
                  <View key={a.id} style={styles.visitatoreRow}>
                    <Text style={styles.cardEmoji}>{getEmojiAbitante(a)}</Text>
                    <View style={styles.cardContent}>
                      <Text style={styles.visitatoreNome} numberOfLines={1}>
                        {a.nome}
                      </Text>
                      <Text style={styles.cardInfo} numberOfLines={1}>
                        {a.lavoro} · {getCastaAbitante(a)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyVisitatori}>
                Nessun cliente in questo momento.
              </Text>
            )}
          </View>
        </View>

      </BuildingScreenShell>

        <Modal visible={dropdownVisible} transparent animationType="fade" onRequestClose={() => setDropdownVisible(false)}>
          <Pressable style={[styles.modalOverlay, isDesktop && modalBackdropFullscreen]} onPress={() => setDropdownVisible(false)}>
            <Pressable style={[styles.modalContent, isDesktop && modalContentFullscreen]} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Seleziona addetto</Text>
                <Pressable onPress={() => setDropdownVisible(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </Pressable>
              </View>
              <Text style={styles.modalHint}>Solo abitanti con casta «Servo della gleba».</Text>
              <ScrollView style={styles.modalScrollView}>
                {abitantiDisponibili.length > 0 ? (
                  abitantiDisponibili.map((a) => (
                    <Pressable
                      key={a.id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        assegnaServoDellaGlebaAEdificio(a.id, bar.id);
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
                  <Text style={styles.emptyText}>Nessun Servo della gleba disponibile</Text>
                )}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
    </>
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
  content: { paddingHorizontal: 0, paddingVertical: 0, paddingBottom: 20 },
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
  clockRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6
  },
  clockLine: { flex: 1, color: "rgba(203,213,245,0.85)", fontSize: 10 },
  orologioPausaBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(30,41,59,0.6)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)"
  },
  orologioPausaBtnAttivo: {
    backgroundColor: "rgba(37,99,235,0.35)",
    borderColor: "rgba(96,165,250,0.45)"
  },
  orologioPausaBtnText: { fontSize: 14 },
  infoText: { color: "#ffffff", fontSize: 11, fontWeight: "600", marginBottom: 2 },
  infoSubtext: { color: "rgba(203,213,245,0.7)", fontSize: 9, marginTop: 2 },
  stipendioCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  stipendioInline: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.35)"
  },
  stipendioLabel: { color: "#93c5fd", fontSize: 10, fontWeight: "600", marginBottom: 4 },
  stipendioInput: {
    backgroundColor: "rgba(30,41,59,0.9)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)",
    borderRadius: 4,
    padding: 6,
    color: "#e5e7eb",
    fontSize: 16,
    minWidth: 80
  },
  dueColonne: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 12,
    marginTop: 10,
    width: "100%"
  },
  dueColonneWide: { flexDirection: "row", alignItems: "flex-start" },
  colonna: { width: "100%", minWidth: 0 },
  colonnaWide: { flex: 1, width: "auto" },
  clientiCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  lavoratoriCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.45)"
  },
  lavoratoriCount: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4
  },
  visitatoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(30,41,59,0.45)",
    borderRadius: 6,
    paddingHorizontal: 6
  },
  visitatoreNome: { color: "#e5e7eb", fontSize: 11, fontWeight: "600" },
  emptyVisitatori: {
    color: "rgba(203,213,245,0.55)",
    fontSize: 9,
    fontStyle: "italic",
    marginTop: 4
  },
  section: { marginTop: 12 },
  sectionHint: {
    color: "rgba(203,213,245,0.65)",
    fontSize: 9,
    marginBottom: 6,
    fontStyle: "italic"
  },
  sectionTitle: { color: "#ffffff", fontSize: 11, fontWeight: "700", marginBottom: 6 },
  addButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 4,
    marginTop: 8,
    marginBottom: 4,
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
  cardEmoji: { fontSize: 22 },
  cardContent: { flex: 1 },
  cardTitle: { color: "#e5e7eb", fontSize: 11, fontWeight: "700", marginBottom: 2 },
  cardInfo: { color: "rgba(203,213,245,0.7)", fontSize: 9 },
  removeButton: { backgroundColor: "#ef4444", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  removeButtonText: { color: "#ffffff", fontSize: 9, fontWeight: "600" },
  emptyText: { color: "rgba(203,213,245,0.5)", fontSize: 10, fontStyle: "italic", textAlign: "center", paddingVertical: 12 },
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
  modalHint: {
    color: "rgba(203,213,245,0.65)",
    fontSize: 9,
    fontStyle: "italic",
    paddingHorizontal: 12,
    paddingBottom: 8
  },
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
