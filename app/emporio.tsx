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
import { useGameContext } from "../src/context/GameContext";
import { getServiDellaGlebaPerAssegnazioneEdificio } from "../src/game/edificiLavoro";
import { getStipendioMoneteGiornaliero } from "../src/game/edificiPubblici";
import { getCassaImpresa, getFatturatoMeseImpresa } from "../src/game/impresaCassa";
import {
  PREZZO_ACQUISTO_ALIMENTO_EMPORIO,
  PREZZO_VENDITA_ALIMENTO_EMPORIO
} from "../src/game/emporioVendita";
import { getOggettoInventario } from "../src/game/inventario";
import { AbitanteAvatarPreview } from "../src/ui/AbitanteAvatarPreview";
import type { Abitante } from "../src/types";

export default function EmporioScreen() {
  const router = useRouter();
  const {
    abitanti,
    edifici,
    inventarioEmporioByEdificioId,
    assegnaAbitanteAEdificio,
    rimuoviAbitanteDaEdificio,
    setStipendioEdificio
  } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const maxHeight = isDesktop ? width * (9 / 16) : undefined;
  const emporio = edifici.find((e) => e.nome === "Emporio");

  const assegnati = useMemo(
    () => (emporio ? abitanti.filter((a) => emporio.abitantiAssegnati.includes(a.id)) : []),
    [abitanti, emporio]
  );
  const serviDisponibili = useMemo(
    () => (emporio ? getServiDellaGlebaPerAssegnazioneEdificio(abitanti, edifici, emporio) : []),
    [abitanti, edifici, emporio]
  );

  if (!emporio) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.title}>🧺 Emporio non presente</Text>
        <Text style={styles.back} onPress={() => router.back()}>← Indietro</Text>
      </SafeAreaView>
    );
  }

  const stipendio = getStipendioMoneteGiornaliero(emporio);
  const cassa = getCassaImpresa(emporio);
  const fatturato = getFatturatoMeseImpresa(emporio);
  const scorte = inventarioEmporioByEdificioId[emporio.id] ?? [];
  const totaleScorte = scorte.reduce((tot, voce) => tot + Math.max(0, voce.quantità), 0);

  return (
    <SafeAreaView style={[styles.safe, maxHeight != null ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>← Indietro</Text>
        <Text style={styles.title}>🧺 Emporio</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Cassa Impresa</Text>
          <Text style={styles.money}>{cassa} monete</Text>
          <Text style={styles.infoText}>Fatturato mese: {fatturato} monete</Text>
          <Text style={styles.infoText}>
            Stipendi Mercanti: {stipendio} monete/giorno ciascuno, pagati dalla cassa dell’Emporio.
          </Text>
          <View style={styles.wageRow}>
            <Pressable
              style={styles.wageBtn}
              onPress={() => setStipendioEdificio(emporio.id, Math.max(0, stipendio - 1) * 30)}
            >
              <Text style={styles.wageBtnText}>−</Text>
            </Pressable>
            <Text style={styles.wageValue}>{stipendio} / giorno</Text>
            <Pressable
              style={styles.wageBtn}
              onPress={() => setStipendioEdificio(emporio.id, (stipendio + 1) * 30)}
            >
              <Text style={styles.wageBtnText}>+</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Scorte alimentari</Text>
          <Text style={styles.money}>{totaleScorte} unità</Text>
          <Text style={styles.infoText}>
            L’Emporio compra l’eccedenza da Raccoglitori e Agricoltori a {PREZZO_VENDITA_ALIMENTO_EMPORIO} moneta per unità.
          </Text>
          <Text style={styles.infoText}>
            Gli abitanti senza cibo possono comprare una razione a {PREZZO_ACQUISTO_ALIMENTO_EMPORIO} monete.
          </Text>
          {scorte.length === 0 ? (
            <Text style={styles.empty}>Magazzino vuoto</Text>
          ) : (
            <View style={styles.stockList}>
              {scorte.map((voce) => {
                const def = getOggettoInventario(voce.itemId);
                return (
                  <Text key={voce.itemId} style={styles.stockItem}>
                    {def?.emoji ?? "📦"} {def?.nome ?? voce.itemId}: {voce.quantità}
                  </Text>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Mercanti</Text>
            <Text style={styles.sectionMeta}>{assegnati.length}/{emporio.capacità} posti occupati</Text>
            {assegnati.length === 0 ? (
              <Text style={styles.empty}>Nessun Mercante assegnato</Text>
            ) : (
              assegnati.map((a: Abitante) => (
                <View key={a.id} style={styles.personCard}>
                  <AbitanteAvatarPreview abitante={a} />
                  <Text style={styles.personName}>{a.nome}</Text>
                  <Text style={styles.personMeta}>{a.lavoro} · Produttività {a.produttività}%</Text>
                  <Pressable
                    style={styles.removeBtn}
                    onPress={() => rimuoviAbitanteDaEdificio(a.id, emporio.id)}
                  >
                    <Text style={styles.btnText}>Rimuovi</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>

          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Servi disponibili</Text>
            <Text style={styles.sectionMeta}>Assegnazione manuale all’Emporio</Text>
            {serviDisponibili.length === 0 ? (
              <Text style={styles.empty}>Nessun Servo della gleba disponibile</Text>
            ) : (
              serviDisponibili.map((a: Abitante) => (
                <View key={a.id} style={styles.personCard}>
                  <AbitanteAvatarPreview abitante={a} />
                  <Text style={styles.personName}>{a.nome}</Text>
                  <Text style={styles.personMeta}>Competenza {a.competenza}%</Text>
                  <Pressable
                    style={styles.addBtn}
                    onPress={() => assegnaAbitanteAEdificio(a.id, emporio.id)}
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
  contentDesktop: { maxWidth: 900, width: "100%", alignSelf: "center" },
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
  columns: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  column: { flex: 1, minWidth: 260 },
  sectionTitle: { color: "#fff", fontSize: 13, fontWeight: "700" },
  sectionMeta: { color: "#94a3b8", fontSize: 10, marginBottom: 8 },
  empty: { color: "#64748b", fontSize: 11, fontStyle: "italic", paddingVertical: 12 },
  stockList: { marginTop: 8, gap: 3 },
  stockItem: { color: "#e2e8f0", fontSize: 11 },
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
