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
import type { ReligioneConCulto } from "../game/luogoCulto";
import { emojiLuogoCulto } from "../game/luogoCulto";
import { getEmojiAbitante } from "../utils/getEmojiAbitante";
import {
  badgePresenzaLuogoCulto,
  statoPresenzaFedeleLuogoCulto
} from "../game/presenzaLuogoCulto";

type CommuteEntry = {
  purpose: "work" | "bar" | "home" | "mensa" | "culto" | "negozio" | "rapina";
  cultoEdificioId?: number;
};

export type LuogoCultoFullscreenModalProps = {
  visible: boolean;
  onClose: () => void;
  nomeEdificio: string;
  religione: ReligioneConCulto;
  edificioGlobaleId: number;
  anchor: number;
  capoReligiosoId: number | null;
  abitanti: Abitante[];
  edifici: Edificio[];
  cellaCasaPerAbitanteId: Map<number, number | null>;
  orologioMinuti: number;
  buioCielo: number;
  dormonoACasaIds: Set<number>;
  lavoroArrivatiIds: Set<number>;
  commuteByAbitanteId: Record<number, CommuteEntry & { path: number[]; token: number }>;
  barArrivatiByEdificio: Record<number, number[]>;
  cultoArrivatiByEdificio: Record<number, number[]>;
  onApriGestioneCulto?: () => void;
};

function sortByNome(a: Abitante, b: Abitante): number {
  return a.nome.localeCompare(b.nome, "it");
}

export function LuogoCultoFullscreenModal({
  visible,
  onClose,
  nomeEdificio,
  religione,
  edificioGlobaleId,
  anchor,
  capoReligiosoId,
  abitanti,
  edifici,
  cellaCasaPerAbitanteId,
  orologioMinuti,
  buioCielo,
  dormonoACasaIds,
  lavoroArrivatiIds,
  commuteByAbitanteId,
  barArrivatiByEdificio,
  cultoArrivatiByEdificio,
  onApriGestioneCulto
}: LuogoCultoFullscreenModalProps) {
  const heroEmoji = emojiLuogoCulto(religione);

  const capoReligioso = useMemo(
    () => (capoReligiosoId != null ? abitanti.find((a) => a.id === capoReligiosoId) ?? null : null),
    [abitanti, capoReligiosoId]
  );

  const fedeli = useMemo(
    () => abitanti.filter((a) => a.religione === religione).sort(sortByNome),
    [abitanti, religione]
  );

  const capoBadge = useMemo(() => {
    if (!capoReligioso) return null;
    const home = cellaCasaPerAbitanteId.get(capoReligioso.id) ?? null;
    const commuteRaw = commuteByAbitanteId[capoReligioso.id];
    const commuteInfo = commuteRaw
      ? { purpose: commuteRaw.purpose, cultoEdificioId: commuteRaw.cultoEdificioId }
      : undefined;
    const stato = statoPresenzaFedeleLuogoCulto(capoReligioso, edificioGlobaleId, home, {
      buioCielo,
      orologioMinuti,
      dormonoACasaIds,
      commuteInfo,
      lavoroArrivatiIds,
      barArrivatiByEdificio,
      cultoArrivatiByEdificio,
      edifici
    });
    return badgePresenzaLuogoCulto(stato);
  }, [
    capoReligioso,
    edificioGlobaleId,
    cellaCasaPerAbitanteId,
    commuteByAbitanteId,
    buioCielo,
    orologioMinuti,
    dormonoACasaIds,
    lavoroArrivatiIds,
    barArrivatiByEdificio,
    cultoArrivatiByEdificio,
    edifici
  ]);

  const fedeliRows = useMemo(() => {
    return fedeli
      .filter((a) => a.id !== capoReligiosoId)
      .map((a) => {
        const home = cellaCasaPerAbitanteId.get(a.id) ?? null;
        const commuteRaw = commuteByAbitanteId[a.id];
        const commuteInfo = commuteRaw
          ? { purpose: commuteRaw.purpose, cultoEdificioId: commuteRaw.cultoEdificioId }
          : undefined;
        const stato = statoPresenzaFedeleLuogoCulto(a, edificioGlobaleId, home, {
          buioCielo,
          orologioMinuti,
          dormonoACasaIds,
          commuteInfo,
          lavoroArrivatiIds,
          barArrivatiByEdificio,
          cultoArrivatiByEdificio,
          edifici
        });
        return { abitante: a, badge: badgePresenzaLuogoCulto(stato) };
      });
  }, [
    fedeli,
    capoReligiosoId,
    edificioGlobaleId,
    cellaCasaPerAbitanteId,
    commuteByAbitanteId,
    buioCielo,
    orologioMinuti,
    dormonoACasaIds,
    lavoroArrivatiIds,
    barArrivatiByEdificio,
    cultoArrivatiByEdificio,
    edifici
  ]);

  const dentroCount =
    (capoBadge?.èDentro ? 1 : 0) + fedeliRows.filter((r) => r.badge.èDentro).length;

  const theme =
    religione === "Culto del Sole"
      ? {
          root: "#120a04",
          headerBg: "rgba(120,53,15,0.35)",
          border: "rgba(251,191,36,0.25)",
          accent: "#fde68a",
          accentSoft: "rgba(251,191,36,0.2)",
          dentroBg: "rgba(120,53,15,0.55)",
          dentroBorder: "rgba(251,191,36,0.45)",
          pillDentro: "rgba(245,158,11,0.25)",
          pillDentroBorder: "rgba(251,191,36,0.5)",
          pillDentroText: "#fde68a"
        }
      : {
          root: "#060812",
          headerBg: "rgba(30,27,75,0.4)",
          border: "rgba(167,139,250,0.25)",
          accent: "#ddd6fe",
          accentSoft: "rgba(167,139,250,0.2)",
          dentroBg: "rgba(49,46,129,0.55)",
          dentroBorder: "rgba(167,139,250,0.45)",
          pillDentro: "rgba(139,92,246,0.25)",
          pillDentroBorder: "rgba(167,139,250,0.5)",
          pillDentroText: "#ddd6fe"
        };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar style="light" />
      <SafeAreaView style={[styles.root, { backgroundColor: theme.root }]}>
        <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.headerBg }]}>
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
          <Text style={styles.heroEmoji}>{heroEmoji}</Text>
          <Text style={styles.title}>{nomeEdificio}</Text>
          <Text style={[styles.subtitle, { color: theme.accent }]}>
            {religione} · Cella #{anchor} · {dentroCount}/{fedeli.length} fedeli dentro
          </Text>
          <Text style={styles.hint}>
            Preghiera collettiva 10:00–11:00. Accanto a ogni nome: se è dentro il luogo di culto o fuori.
          </Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Text style={styles.listaTitolo}>Capo Religioso</Text>
            {capoReligioso && capoBadge ? (
              <View
                style={[
                  styles.listaRiga,
                  capoBadge.èDentro
                    ? { backgroundColor: theme.dentroBg, borderColor: theme.dentroBorder }
                    : styles.listaRigaFuori
                ]}
              >
                <Text style={styles.listaAvatar}>{getEmojiAbitante(capoReligioso)}</Text>
                <View style={styles.listaNomeCol}>
                  <Text style={styles.listaNome} numberOfLines={1}>
                    {capoReligioso.nome}
                  </Text>
                  <Text style={styles.listaRuolo}>Capo Religioso · {capoReligioso.lavoro}</Text>
                </View>
                <View style={styles.listaBadgeCol}>
                  <View
                    style={[
                      styles.presenzaPill,
                      capoBadge.èDentro
                        ? {
                            backgroundColor: theme.pillDentro,
                            borderColor: theme.pillDentroBorder
                          }
                        : styles.presenzaPillFuori
                    ]}
                  >
                    <Text style={styles.presenzaPillEmoji}>{capoBadge.simbolo}</Text>
                    <Text
                      style={[
                        styles.presenzaPillTesto,
                        capoBadge.èDentro
                          ? { color: theme.pillDentroText }
                          : styles.presenzaPillTestoFuori
                      ]}
                    >
                      {capoBadge.titolo}
                    </Text>
                  </View>
                  {capoBadge.sottotitolo != null ? (
                    <Text style={styles.presenzaDettaglio} numberOfLines={2}>
                      {capoBadge.sottotitolo}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : (
              <Text style={styles.empty}>Nessun Capo Religioso nominato per questo culto.</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.listaTitolo}>Fedeli ({fedeli.length})</Text>
            {fedeliRows.length === 0 ? (
              <Text style={styles.empty}>Nessun altro fedele registrato.</Text>
            ) : (
              fedeliRows.map(({ abitante, badge }) => (
                <View
                  key={abitante.id}
                  style={[
                    styles.listaRiga,
                    badge.èDentro
                      ? { backgroundColor: theme.dentroBg, borderColor: theme.dentroBorder }
                      : styles.listaRigaFuori
                  ]}
                >
                  <Text style={styles.listaAvatar}>{getEmojiAbitante(abitante)}</Text>
                  <View style={styles.listaNomeCol}>
                    <Text style={styles.listaNome} numberOfLines={1}>
                      {abitante.nome}
                    </Text>
                    <Text style={styles.listaRuolo}>{abitante.lavoro}</Text>
                  </View>
                  <View style={styles.listaBadgeCol}>
                    <View
                      style={[
                        styles.presenzaPill,
                        badge.èDentro
                          ? {
                              backgroundColor: theme.pillDentro,
                              borderColor: theme.pillDentroBorder
                            }
                          : styles.presenzaPillFuori
                      ]}
                    >
                      <Text style={styles.presenzaPillEmoji}>{badge.simbolo}</Text>
                      <Text
                        style={[
                          styles.presenzaPillTesto,
                          badge.èDentro ? { color: theme.pillDentroText } : styles.presenzaPillTestoFuori
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

          {onApriGestioneCulto ? (
            <Pressable
              onPress={onApriGestioneCulto}
              style={({ pressed }) => [
                styles.btnGestione,
                { backgroundColor: theme.accentSoft, borderColor: theme.border },
                pressed && styles.btnGestionePressed
              ]}
            >
              <Text style={[styles.btnGestioneText, { color: theme.accent }]}>
                Gestione culto e nomine →
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1
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
    marginBottom: 8
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#f8fafc",
    textAlign: "center",
    letterSpacing: 0.3
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    textAlign: "center",
    fontWeight: "600"
  },
  hint: {
    marginTop: 10,
    fontSize: 12,
    color: "rgba(203,213,225,0.88)",
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
  listaRigaFuori: {
    backgroundColor: "rgba(30,41,59,0.85)",
    borderColor: "rgba(148,163,184,0.25)"
  },
  listaAvatar: {
    fontSize: 26
  },
  listaNomeCol: {
    flex: 1,
    minWidth: 0
  },
  listaNome: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f8fafc"
  },
  listaRuolo: {
    fontSize: 11,
    color: "rgba(203,213,225,0.75)",
    marginTop: 2
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
  btnGestione: {
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1
  },
  btnGestionePressed: {
    opacity: 0.85
  },
  btnGestioneText: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center"
  }
});
