import React, { useMemo } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  View
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { BuildingScreenShell } from "./BuildingScreenShell";
import type { Abitante, Edificio } from "../types";
import { getEmojiAbitante } from "../utils/getEmojiAbitante";
import { badgePresenzaCapanna, statoPresenzaOccupanteCapanna } from "../game/presenzaCapanna";

type CommuteEntry = {
  purpose: "work" | "bar" | "home" | "mensa" | "culto" | "negozio" | "rapina" | "cerca_lavoro";
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
  postiPerCasa
}: CapannaFullscreenModalProps) {
  const occupanti = useMemo(() => {
    const set = new Set(occupantiIds);
    return abitanti.filter((a) => set.has(a.id)).sort(sortByNome);
  }, [abitanti, occupantiIds]);

  const rows = useMemo(() => {
    return occupanti.map((a) => {
      const home = cellaCasaPerAbitanteId.get(a.id) ?? null;
      const commuteRaw = commuteByAbitanteId[a.id];
      const commuteInfo =
        commuteRaw &&
        (commuteRaw.purpose === "work" || commuteRaw.purpose === "bar" || commuteRaw.purpose === "home")
          ? { purpose: commuteRaw.purpose }
          : undefined;
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
      <BuildingScreenShell title="Capanna" onBack={onClose} backLabel="Chiudi">
        <View style={styles.intro}>
          <Text style={styles.heroEmoji}>⛺</Text>
          <Text style={styles.subtitle}>
            Residenza del Regno · Cella #{anchor} · {occupantiIds.length}/{postiPerCasa} posti
          </Text>
          <Text style={styles.hint}>
            Accanto a ogni nome: se è dentro la capanna o fuori, e dove si trova (viaggio, bar, lavoro…).
          </Text>
        </View>
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
      </BuildingScreenShell>
    </Modal>
  );
}

const styles = StyleSheet.create({
  intro: {
    backgroundColor: "rgba(15,23,42,0.75)",
    paddingHorizontal: 14,
    paddingVertical: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.2)",
    marginBottom: 18
  },
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
  }
});
