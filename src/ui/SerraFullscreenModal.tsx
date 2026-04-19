import React, { useMemo } from "react";
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
import {
  badgePresenzaLavoroEdificio,
  statoPresenzaLavoratoreEdificio
} from "../game/presenzaLavoroEdificio";

type CommuteEntry = {
  purpose: "work" | "bar" | "home";
};

export type SerraFullscreenModalProps = {
  visible: boolean;
  onClose: () => void;
  edificio: Edificio;
  abitanti: Abitante[];
  edifici: Edificio[];
  cellaCasaPerAbitanteId: Map<number, number | null>;
  orologioMinuti: number;
  buioCielo: number;
  dormonoACasaIds: Set<number>;
  lavoroArrivatiIds: Set<number>;
  commuteByAbitanteId: Record<number, CommuteEntry & { path: number[]; token: number }>;
  barArrivatiByEdificio: Record<number, number[]>;
  onApriProduzione: () => void;
};

function sortByNome(a: Abitante, b: Abitante): number {
  return a.nome.localeCompare(b.nome, "it");
}

function titoloSerraDaId(id: number): string {
  if (id === 2) return "Serra (unità 1)";
  if (id === 21) return "Serra (unità 2)";
  return `Serra (#${id})`;
}

export function SerraFullscreenModal({
  visible,
  onClose,
  edificio,
  abitanti,
  edifici,
  cellaCasaPerAbitanteId,
  orologioMinuti,
  buioCielo,
  dormonoACasaIds,
  lavoroArrivatiIds,
  commuteByAbitanteId,
  barArrivatiByEdificio,
  onApriProduzione
}: SerraFullscreenModalProps) {
  const idsAssegnati = edificio.abitantiAssegnati ?? [];

  const lavoratori = useMemo(() => {
    const set = new Set(idsAssegnati);
    return abitanti.filter((a) => set.has(a.id)).sort(sortByNome);
  }, [abitanti, idsAssegnati]);

  const rows = useMemo(() => {
    return lavoratori.map((a) => {
      const home = cellaCasaPerAbitanteId.get(a.id) ?? null;
      const commuteRaw = commuteByAbitanteId[a.id];
      const commuteInfo = commuteRaw ? { purpose: commuteRaw.purpose } : undefined;
      const stato = statoPresenzaLavoratoreEdificio(a, edificio, home, {
        buioCielo,
        orologioMinuti,
        dormonoACasaIds,
        commuteInfo,
        lavoroArrivatiIds,
        barArrivatiByEdificio,
        edifici
      });
      return { abitante: a, badge: badgePresenzaLavoroEdificio(stato) };
    });
  }, [
    lavoratori,
    edificio,
    cellaCasaPerAbitanteId,
    buioCielo,
    orologioMinuti,
    dormonoACasaIds,
    commuteByAbitanteId,
    lavoroArrivatiIds,
    barArrivatiByEdificio,
    edifici
  ]);

  const titolo = titoloSerraDaId(edificio.id);
  const cap = edificio.capacità ?? 0;
  const n = idsAssegnati.length;

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
          <Text style={styles.heroEmoji}>🌱</Text>
          <Text style={styles.title}>{titolo}</Text>
          <Text style={styles.subtitle}>
            Produzione agricola · {n}/{cap} lavoratori assegnati
          </Text>
          <Text style={styles.hint}>
            Accanto a ogni nome: se è dentro la serra (in orario, in sede) o fuori e dove si trova.
          </Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Text style={styles.listaTitolo}>Chi ci lavora</Text>
            {rows.length === 0 ? (
              <Text style={styles.empty}>Nessun lavoratore assegnato a questa serra.</Text>
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
                      <Text style={styles.presenzaDettaglio} numberOfLines={2}>
                        {badge.sottotitolo}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </View>

          <Pressable
            onPress={onApriProduzione}
            style={({ pressed }) => [styles.btnProduzione, pressed && styles.btnProduzionePressed]}
          >
            <Text style={styles.btnProduzioneText}>Produzione, stipendi e assegnazioni →</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#06120f"
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(52,211,153,0.2)",
    backgroundColor: "rgba(6,78,59,0.35)"
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
    textShadowColor: "rgba(52,211,153,0.35)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#ecfdf5",
    textAlign: "center",
    letterSpacing: 0.3
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: "rgba(209,250,229,0.9)",
    textAlign: "center",
    fontWeight: "600"
  },
  hint: {
    marginTop: 10,
    fontSize: 12,
    color: "rgba(167,243,208,0.9)",
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
    marginBottom: 16
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
    backgroundColor: "rgba(6,78,59,0.55)",
    borderColor: "rgba(52,211,153,0.45)"
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
    backgroundColor: "rgba(16,185,129,0.25)",
    borderColor: "rgba(52,211,153,0.5)"
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
    color: "#a7f3d0"
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
  btnProduzione: {
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "rgba(16,185,129,0.2)",
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.45)"
  },
  btnProduzionePressed: {
    backgroundColor: "rgba(16,185,129,0.32)"
  },
  btnProduzioneText: {
    color: "#a7f3d0",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center"
  }
});
