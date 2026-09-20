import React, { useMemo } from "react";
import {
  Dimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../context/GameContext";
import { getImpresaDef } from "../data/impreseCatalogo";
import { getServiDellaGlebaPerAssegnazioneEdificio } from "../game/edificiLavoro";
import { getStipendioMoneteGiornaliero } from "../game/edificiPubblici";
import { getCassaImpresa, getFatturatoMeseImpresa } from "../game/impresaCassa";
import { TASSA_IMPRESA_PERCENTUALE } from "../game/economiaPrezzi";
import { AbitanteAvatarPreview } from "./AbitanteAvatarPreview";
import type { Abitante } from "../types";

type Props = {
  edificioId: number;
  nomeAtteso?: string;
};

export function ImpresaScreen({ edificioId, nomeAtteso }: Props) {
  const router = useRouter();
  const {
    abitanti,
    edifici,
    assegnaServoDellaGlebaAEdificio,
    rimuoviAbitanteDaEdificio,
    setStipendioEdificio
  } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const maxHeight = isDesktop ? width * (9 / 16) : undefined;

  const edificio = useMemo(() => {
    const trovato = edifici.find((e) => e.id === edificioId);
    if (!trovato) return undefined;
    if (nomeAtteso && trovato.nome !== nomeAtteso) return undefined;
    return trovato;
  }, [edifici, edificioId, nomeAtteso]);

  const def = edificio ? getImpresaDef(edificio.nome) : undefined;
  const addetti = useMemo(
    () =>
      edificio
        ? edificio.abitantiAssegnati
            .map((id) => abitanti.find((a) => a.id === id))
            .filter((a): a is Abitante => a != null)
        : [],
    [abitanti, edificio]
  );
  const disponibili = useMemo(
    () => (edificio ? getServiDellaGlebaPerAssegnazioneEdificio(abitanti, edifici, edificio) : []),
    [abitanti, edifici, edificio]
  );

  if (!edificio || !def) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.title}>Impresa non trovata</Text>
        <Text style={styles.back} onPress={() => router.back()}>← Indietro</Text>
      </SafeAreaView>
    );
  }

  const stipendio = getStipendioMoneteGiornaliero(edificio);
  const cap = edificio.capacità ?? 0;

  return (
    <SafeAreaView style={[styles.safe, maxHeight != null ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>← Indietro</Text>
        <Text style={styles.title}>{edificio.emoji ?? "🏢"} {edificio.nome}</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Cassa Impresa</Text>
          <Text style={styles.money}>{getCassaImpresa(edificio)} monete</Text>
          <Text style={styles.infoText}>
            Fatturato mese: {getFatturatoMeseImpresa(edificio)} monete · tassa {TASSA_IMPRESA_PERCENTUALE}% a fine mese.
          </Text>
          <Text style={styles.infoText}>Stipendio: {stipendio} monete/giorno per lavoratore.</Text>
          <View style={styles.wageRow}>
            <Pressable
              style={styles.wageBtn}
              onPress={() => setStipendioEdificio(edificio.id, Math.max(0, stipendio - 1) * 30)}
            >
              <Text style={styles.wageBtnText}>−</Text>
            </Pressable>
            <Text style={styles.wageValue}>{stipendio} / giorno</Text>
            <Pressable
              style={styles.wageBtn}
              onPress={() => setStipendioEdificio(edificio.id, (stipendio + 1) * 30)}
            >
              <Text style={styles.wageBtnText}>+</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.tradeRow}>
          <View style={styles.tradeCard}>
            <Text style={styles.sectionTitle}>Produce</Text>
            {def.produce.map((voce, index) => (
              <Text key={index} style={styles.tradeItem}>• {voce.etichetta}</Text>
            ))}
          </View>
          <View style={styles.tradeCard}>
            <Text style={styles.sectionTitle}>Compra / consuma</Text>
            {def.compra.map((voce, index) => (
              <Text key={index} style={styles.tradeItem}>• {voce.etichetta}</Text>
            ))}
          </View>
        </View>

        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>{def.ruoloLavoratore}</Text>
            <Text style={styles.sectionMeta}>{addetti.length}/{cap} posti occupati</Text>
            <Text style={styles.hint}>{def.hintLavoratori}</Text>
            {addetti.length === 0 ? (
              <Text style={styles.empty}>Nessun lavoratore assegnato</Text>
            ) : (
              addetti.map((a) => (
                <View key={a.id} style={styles.personCard}>
                  <AbitanteAvatarPreview abitante={a} />
                  <Text style={styles.personName}>{a.nome}</Text>
                  <Text style={styles.personMeta}>{a.lavoro} · Competenza {a.competenza}%</Text>
                  <Pressable
                    style={styles.removeBtn}
                    onPress={() => rimuoviAbitanteDaEdificio(a.id, edificio.id)}
                  >
                    <Text style={styles.btnText}>Rimuovi</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>

          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Servi disponibili</Text>
            <Text style={styles.sectionMeta}>Assegnazione manuale</Text>
            {disponibili.length === 0 ? (
              <Text style={styles.empty}>Nessun Servo della gleba disponibile</Text>
            ) : (
              disponibili.map((a) => (
                <View key={a.id} style={styles.personCard}>
                  <AbitanteAvatarPreview abitante={a} />
                  <Text style={styles.personName}>{a.nome}</Text>
                  <Text style={styles.personMeta}>Competenza {a.competenza}%</Text>
                  <Pressable
                    style={styles.addBtn}
                    onPress={() => assegnaServoDellaGlebaAEdificio(a.id, edificio.id)}
                  >
                    <Text style={styles.btnText}>Assegna</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
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
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.5)"
  },
  back: { color: "#93c5fd", fontSize: 12 },
  title: { color: "#fff", fontSize: 14, fontWeight: "700" },
  content: { padding: 12, gap: 12 },
  contentDesktop: { maxWidth: 920, width: "100%", alignSelf: "center" },
  infoCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    borderRadius: 10,
    padding: 12
  },
  infoTitle: { color: "#93c5fd", fontSize: 11, fontWeight: "700" },
  money: { color: "#4ade80", fontSize: 22, fontWeight: "800", marginVertical: 4 },
  infoText: { color: "#cbd5e1", fontSize: 11, marginTop: 2 },
  wageRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  wageBtn: { backgroundColor: "#334155", borderRadius: 6, paddingHorizontal: 14, paddingVertical: 7 },
  wageBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  wageValue: { color: "#e2e8f0", fontSize: 12, fontWeight: "700" },
  tradeRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tradeCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: "#0f172a",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    padding: 12
  },
  tradeItem: { color: "#cbd5e1", fontSize: 11, marginTop: 5 },
  columns: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  column: { flex: 1, minWidth: 270 },
  sectionTitle: { color: "#fff", fontSize: 13, fontWeight: "700" },
  sectionMeta: { color: "#94a3b8", fontSize: 10, marginBottom: 6 },
  hint: { color: "#94a3b8", fontSize: 10, lineHeight: 15, marginBottom: 8 },
  empty: { color: "#64748b", fontSize: 11, fontStyle: "italic", paddingVertical: 12 },
  personCard: {
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)",
    borderRadius: 8,
    padding: 8,
    marginBottom: 8
  },
  personName: { color: "#e5e7eb", fontSize: 11, fontWeight: "700", marginTop: 4 },
  personMeta: { color: "#94a3b8", fontSize: 9, marginTop: 2 },
  addBtn: { backgroundColor: "#2563eb", borderRadius: 5, paddingVertical: 6, width: "100%", alignItems: "center", marginTop: 6 },
  removeBtn: { backgroundColor: "#dc2626", borderRadius: 5, paddingVertical: 6, width: "100%", alignItems: "center", marginTop: 6 },
  btnText: { color: "#fff", fontSize: 10, fontWeight: "700" }
});
