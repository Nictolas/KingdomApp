import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { StatusBar } from "expo-status-bar";
import type { Abitante, Edificio } from "../types";
import { getEmojiAbitante } from "../utils/getEmojiAbitante";
import { badgePresenzaCapanna, statoPresenzaOccupanteCapanna } from "../game/presenzaCapanna";

type CommuteEntry = {
  purpose: "work" | "bar" | "home";
};

export type CapannaFullscreenModalProps = {
  visible: boolean;
  onClose: () => void;
  anchor: number;
  occupantiIds: number[];
  abitanti: Abitante[];
  edifici: Edificio[];
  cellaCasaPerAbitanteId: Map<number, number | null>;
  orologioMinuti: number;
  buioCielo: number;
  dormonoACasaIds: Set<number>;
  lavoroArrivatiIds: Set<number>;
  commuteByAbitanteId: Record<number, CommuteEntry & { path: number[]; token: number }>;
  barArrivatiByEdificio: Record<number, number[]>;
  postiPerCasa: number;
  postiLiberi: number;
  candidati: Abitante[];
  onRimuovi: (id: number) => void;
  onAggiungi: (id: number) => void;
  onGoResidenze: () => void;
};

function sortByNome(a: Abitante, b: Abitante): number {
  return a.nome.localeCompare(b.nome, "it");
}

export function CapannaFullscreenModal({
  visible,
  onClose,
  anchor,
  occupantiIds,
  abitanti,
  edifici,
  cellaCasaPerAbitanteId,
  orologioMinuti,
  buioCielo,
  dormonoACasaIds,
  lavoroArrivatiIds,
  commuteByAbitanteId,
  barArrivatiByEdificio,
  postiPerCasa,
  postiLiberi,
  candidati,
  onRimuovi,
  onAggiungi,
  onGoResidenze
}: CapannaFullscreenModalProps) {
  const [mostraGestione, setMostraGestione] = useState(false);

  const occupanti = useMemo(() => {
    const set = new Set(occupantiIds);
    return abitanti.filter((a) => set.has(a.id)).sort(sortByNome);
  }, [abitanti, occupantiIds]);

  const rows = useMemo(() => {
    return occupanti.map((a) => {
      const home = cellaCasaPerAbitanteId.get(a.id) ?? null;
      const commuteRaw = commuteByAbitanteId[a.id];
      const commuteInfo = commuteRaw ? { purpose: commuteRaw.purpose } : undefined;
      const stato = statoPresenzaOccupanteCapanna(a, anchor, home, {
        buioCielo,
        orologioMinuti,
        dormonoACasaIds,
        commuteInfo,
        lavoroArrivatiIds,
        barArrivatiByEdificio,
        edifici
      });
      return { abitante: a, badge: badgePresenzaCapanna(stato) };
    });
  }, [
    occupanti,
    anchor,
    cellaCasaPerAbitanteId,
    buioCielo,
    orologioMinuti,
    dormonoACasaIds,
    commuteByAbitanteId,
    lavoroArrivatiIds,
    barArrivatiByEdificio,
    edifici
  ]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar style="light" />
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Chiudi"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.heroEmoji}>⛺</Text>
          <Text style={styles.title}>Capanna</Text>
          <Text style={styles.subtitle}>
            Residenza coloniale · Cella #{anchor} · {occupantiIds.length}/{postiPerCasa} posti
          </Text>
          <Text style={styles.hint}>
            Accanto a ogni nome: se è dentro la capanna o fuori, e dove si trova (viaggio, bar, lavoro…).
          </Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Text style={styles.listaTitolo}>Chi abita qui</Text>
            {rows.length === 0 ? (
              <Text style={styles.empty}>Nessun abitante assegnato a questa capanna.</Text>
            ) : (
              rows.map(({ abitante, badge }) => (
                <View
                  key={abitante.id}
                  style={[styles.listaRiga, badge.èDentro ? styles.listaRigaDentro : styles.listaRigaFuori]}
                >
                  <Text style={styles.listaAvatar}>{getEmojiAbitante(abitante)}</Text>
                  <Text style={styles.listaNome} numberOfLines={1}>
                    {abitante.nome}
                  </Text>
                  <View style={styles.listaBadgeCol}>
                    <View
                      style={[
                        styles.presenzaPill,
                        badge.èDentro ? styles.presenzaPillDentro : styles.presenzaPillFuori
                      ]}
                    >
                      <Text style={styles.presenzaPillEmoji}>{badge.simbolo}</Text>
                      <Text
                        style={[
                          styles.presenzaPillTesto,
                          badge.èDentro ? styles.presenzaPillTestoDentro : styles.presenzaPillTestoFuori
                        ]}
                      >
                        {badge.titolo}
                      </Text>
                    </View>
                    {badge.sottotitolo != null ? (
                      <Text style={styles.presenzaDettaglio} numberOfLines={1}>
                        {badge.sottotitolo}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </View>

          <Pressable
            onPress={() => setMostraGestione((v) => !v)}
            style={({ pressed }) => [styles.toggleGestione, pressed && styles.toggleGestionePressed]}
          >
            <Text style={styles.toggleGestioneText}>
              {mostraGestione ? "▼" : "▶"} Gestione posti e assegnazioni
            </Text>
          </Pressable>

          {mostraGestione ? (
            <View style={styles.gestioneBox}>
              <Text style={styles.gestioneNote}>
                L&apos;assegnazione qui aggiorna anche la Capanna globale in colonia.
              </Text>
              <Text style={styles.gestioneTitolo}>Posti</Text>
              {Array.from({ length: postiPerCasa }, (_, slot) => {
                const id = occupantiIds[slot];
                const occ = id != null ? abitanti.find((x) => x.id === id) : null;
                return (
                  <View key={`slot-${slot}`} style={styles.slotRow}>
                    <Text style={styles.slotLabel}>{slot + 1}</Text>
                    {occ ? (
                      <>
                        <Text style={styles.slotEmoji}>{getEmojiAbitante(occ)}</Text>
                        <Text style={styles.slotNome} numberOfLines={1}>
                          {occ.nome}
                        </Text>
                        <Pressable style={styles.slotRimuovi} onPress={() => onRimuovi(occ.id)}>
                          <Text style={styles.slotRimuoviText}>Esci</Text>
                        </Pressable>
                      </>
                    ) : (
                      <Text style={styles.slotVuoto}>Libero</Text>
                    )}
                  </View>
                );
              })}
              <Text style={styles.gestioneTitolo}>
                Può entrare {postiLiberi === 0 ? "(pieno)" : `(${postiLiberi} liberi)`}
              </Text>
              <ScrollView
                nestedScrollEnabled
                style={styles.candidatiScroll}
                showsVerticalScrollIndicator={false}
              >
                {candidati.length === 0 ? (
                  <Text style={styles.candidatiEmpty}>
                    Nessun abitante disponibile con le regole attuali.
                  </Text>
                ) : (
                  candidati.map((a) => (
                    <Pressable
                      key={a.id}
                      style={styles.candidatoRow}
                      onPress={() => onAggiungi(a.id)}
                      disabled={postiLiberi === 0}
                    >
                      <Text style={styles.candidatoEmoji}>{getEmojiAbitante(a)}</Text>
                      <Text style={styles.candidatoNome} numberOfLines={1}>
                        {a.nome}
                      </Text>
                      <Text style={styles.candidatoHint}>Aggiungi</Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>
              <Pressable style={styles.btnSecondario} onPress={onGoResidenze}>
                <Text style={styles.btnSecondarioText}>Schermata Residenze (prezzi)</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#070b14"
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(251,191,36,0.15)",
    backgroundColor: "rgba(15,23,42,0.5)"
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 4
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(148,163,184,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)"
  },
  closeBtnPressed: {
    backgroundColor: "rgba(148,163,184,0.35)"
  },
  closeBtnText: {
    color: "#e2e8f0",
    fontSize: 18,
    fontWeight: "700"
  },
  heroEmoji: {
    fontSize: 56,
    textAlign: "center",
    marginBottom: 8,
    textShadowColor: "rgba(251,191,36,0.35)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fefce8",
    textAlign: "center",
    letterSpacing: 0.5
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: "rgba(226,232,240,0.85)",
    textAlign: "center",
    fontWeight: "600"
  },
  hint: {
    marginTop: 10,
    fontSize: 12,
    color: "rgba(148,163,184,0.95)",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 8
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 16
  },
  section: {
    marginBottom: 22
  },
  listaTitolo: {
    fontSize: 17,
    fontWeight: "800",
    color: "#f1f5f9",
    marginBottom: 12
  },
  empty: {
    color: "rgba(203,213,225,0.85)",
    fontSize: 14,
    fontStyle: "italic",
    lineHeight: 20,
    paddingVertical: 8
  },
  listaRiga: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    gap: 10
  },
  listaRigaDentro: {
    backgroundColor: "rgba(22,101,52,0.35)",
    borderColor: "rgba(74,222,128,0.35)"
  },
  listaRigaFuori: {
    backgroundColor: "rgba(30,41,59,0.85)",
    borderColor: "rgba(148,163,184,0.25)"
  },
  listaAvatar: {
    fontSize: 26
  },
  listaNome: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: "700",
    color: "#f8fafc"
  },
  listaBadgeCol: {
    alignItems: "flex-end",
    maxWidth: "52%",
    flexShrink: 0
  },
  presenzaPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 5,
    borderWidth: 1
  },
  presenzaPillDentro: {
    backgroundColor: "rgba(34,197,94,0.22)",
    borderColor: "rgba(74,222,128,0.45)"
  },
  presenzaPillFuori: {
    backgroundColor: "rgba(59,130,246,0.18)",
    borderColor: "rgba(96,165,250,0.38)"
  },
  presenzaPillEmoji: {
    fontSize: 14
  },
  presenzaPillTesto: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.2
  },
  presenzaPillTestoDentro: {
    color: "#bbf7d0"
  },
  presenzaPillTestoFuori: {
    color: "#bfdbfe"
  },
  presenzaDettaglio: {
    marginTop: 3,
    fontSize: 11,
    color: "rgba(203,213,225,0.88)",
    fontWeight: "600",
    textAlign: "right"
  },
  toggleGestione: {
    marginTop: 4,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(30,41,59,0.6)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)"
  },
  toggleGestionePressed: {
    backgroundColor: "rgba(51,65,85,0.7)"
  },
  toggleGestioneText: {
    color: "#93c5fd",
    fontSize: 14,
    fontWeight: "700"
  },
  gestioneBox: {
    paddingBottom: 8
  },
  gestioneNote: {
    fontSize: 12,
    color: "rgba(203,213,225,0.85)",
    marginBottom: 12,
    lineHeight: 18
  },
  gestioneTitolo: {
    color: "rgba(203,213,245,0.95)",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 6
  },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: "rgba(15,23,42,0.9)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)"
  },
  slotLabel: {
    color: "rgba(148,163,184,0.95)",
    fontSize: 12,
    width: 22,
    fontWeight: "700"
  },
  slotEmoji: { fontSize: 20, marginRight: 8 },
  slotNome: {
    flex: 1,
    color: "#e5e7eb",
    fontSize: 14,
    fontWeight: "600"
  },
  slotVuoto: {
    color: "rgba(148,163,184,0.7)",
    fontSize: 13,
    fontStyle: "italic",
    flex: 1
  },
  slotRimuovi: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(239,68,68,0.35)"
  },
  slotRimuoviText: {
    color: "#fecaca",
    fontSize: 12,
    fontWeight: "600"
  },
  candidatiScroll: {
    maxHeight: 220
  },
  candidatiEmpty: {
    color: "rgba(203,213,245,0.9)",
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 12
  },
  candidatoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: "rgba(15,23,42,0.8)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)"
  },
  candidatoEmoji: {
    fontSize: 22,
    marginRight: 10
  },
  candidatoNome: {
    color: "#e5e7eb",
    fontSize: 14,
    fontWeight: "600",
    flex: 1
  },
  candidatoHint: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "600"
  },
  btnSecondario: {
    marginTop: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "rgba(59,130,246,0.25)",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.4)"
  },
  btnSecondarioText: {
    color: "#bfdbfe",
    fontSize: 14,
    fontWeight: "700"
  }
});
