import React, { useMemo, useState, useEffect } from "react";
import {
  Dimensions,
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
import { abitanteHaInventarioPersonale } from "../src/game/casta";
import { getMoneteInventarioAbitante } from "../src/game/inventario";
import { calcolaTassaPatrimonioImporto } from "../src/game/tasse";
import { getEmojiAbitante } from "../src/utils/getEmojiAbitante";
import { GateTassaSbloccata } from "../src/ui/GateTassaSbloccata";

export default function TassaPatrimonioScreen() {
  return (
    <GateTassaSbloccata tassaId="patrimonio" titolo="Tassa sul Patrimonio">
      <TassaPatrimonioScreenInner />
    </GateTassaSbloccata>
  );
}

function TassaPatrimonioScreenInner() {
  const router = useRouter();
  const {
    abitanti,
    tassaPatrimonioPercentuale,
    setTassaPatrimonioPercentuale,
  } = useGameContext();

  const [inputPct, setInputPct] = useState(String(tassaPatrimonioPercentuale));
  useEffect(() => setInputPct(String(tassaPatrimonioPercentuale)), [tassaPatrimonioPercentuale]);

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const applyPct = () => {
    const n = parseInt(inputPct, 10);
    if (!Number.isNaN(n) && n >= 0 && n <= 100) setTassaPatrimonioPercentuale(n);
    else setInputPct(String(tassaPatrimonioPercentuale));
  };

  const soggetti = useMemo(
    () =>
      abitanti
        .filter((a) => a.razza !== "Golem" && abitanteHaInventarioPersonale(a))
        .map((a) => {
          const monete = getMoneteInventarioAbitante(a.inventario);
          const tassa = calcolaTassaPatrimonioImporto(monete, tassaPatrimonioPercentuale);
          return { abitante: a, monete, tassa };
        })
        .sort((x, y) => y.tassa - x.tassa),
    [abitanti, tassaPatrimonioPercentuale]
  );

  const gettito = useMemo(
    () => soggetti.reduce((totale, voce) => totale + voce.tassa, 0),
    [soggetti]
  );

  return (
    <SafeAreaView style={[styles.safe, maxHeight != null ? { maxHeight, overflow: "hidden" as const } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>Tassa sul Patrimonio</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Come funziona</Text>
            <Text style={styles.infoText}>
              A fine mese preleva una percentuale sulle monete in inventario personale (esclusi schiavi, servi e
              Golem) e la versa al Tesoro. Aliquota 0% = nessun prelievo.
            </Text>
          </View>

          <View style={styles.configCard}>
            <Text style={styles.configTitle}>Aliquota</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={inputPct}
                onChangeText={setInputPct}
                onBlur={applyPct}
                onSubmitEditing={applyPct}
                keyboardType="numeric"
                placeholder="5"
              />
              <Text style={styles.inputUnit}>%</Text>
              <Pressable style={styles.applyBtn} onPress={applyPct}>
                <Text style={styles.applyBtnText}>Applica</Text>
              </Pressable>
            </View>
            <Text style={styles.configInfo}>Gettito stimato questo mese: {gettito} monete</Text>
          </View>

          <Text style={styles.sectionTitle}>Anteprima per abitante</Text>
          {soggetti.slice(0, 40).map(({ abitante, monete, tassa }) => (
            <View key={abitante.id} style={styles.row}>
              <Text style={styles.rowEmoji}>{getEmojiAbitante(abitante)}</Text>
              <View style={styles.rowText}>
                <Text style={styles.rowNome} numberOfLines={1}>
                  {abitante.nome}
                </Text>
                <Text style={styles.rowSub}>
                  Patrimonio {monete} · tassa {tassa}
                </Text>
              </View>
            </View>
          ))}
          {soggetti.length === 0 && <Text style={styles.empty}>Nessun soggetto imponibile</Text>}
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Indietro
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
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1e293b"
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  infoCard: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
    gap: 6
  },
  infoTitle: { color: "#e2e8f0", fontWeight: "700", fontSize: 15 },
  infoText: { color: "#94a3b8", fontSize: 13, lineHeight: 18 },
  configCard: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
    gap: 10
  },
  configTitle: { color: "#e2e8f0", fontWeight: "700", fontSize: 15 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    backgroundColor: "#1e293b",
    color: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 72,
    textAlign: "center"
  },
  inputUnit: { color: "#94a3b8", fontWeight: "600" },
  applyBtn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  applyBtnText: { color: "#fff", fontWeight: "700" },
  configInfo: { color: "#86efac", fontSize: 13 },
  sectionTitle: { color: "#cbd5e1", fontWeight: "700", marginTop: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#0f172a",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#1e293b"
  },
  rowEmoji: { fontSize: 20 },
  rowText: { flex: 1 },
  rowNome: { color: "#f8fafc", fontWeight: "600" },
  rowSub: { color: "#94a3b8", fontSize: 12 },
  empty: { color: "#64748b", fontStyle: "italic" },
  footer: {
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#1e293b"
  },
  back: { color: "#93c5fd", fontWeight: "600" }
});
