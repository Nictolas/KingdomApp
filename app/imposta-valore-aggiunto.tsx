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
import {
  stimaUnitaProduzioneEdificio,
  stimaValoreProduzioneRegno,
  calcolaIvaImporto
} from "../src/game/tasse";
import { PREZZO_UNITA_VALORE_AGGIUNTO } from "../src/game/economiaPrezzi";
import { GateTassaSbloccata } from "../src/ui/GateTassaSbloccata";

export default function ImpostaValoreAggiuntoScreen() {
  return (
    <GateTassaSbloccata tassaId="iva" titolo="Imposta sul Valore Aggiunto">
      <ImpostaValoreAggiuntoScreenInner />
    </GateTassaSbloccata>
  );
}

function ImpostaValoreAggiuntoScreenInner() {
  const router = useRouter();
  const { abitanti, edifici, ivaPercentuale, setIvaPercentuale } = useGameContext();

  const [inputPct, setInputPct] = useState(String(ivaPercentuale));
  useEffect(() => setInputPct(String(ivaPercentuale)), [ivaPercentuale]);

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const applyPct = () => {
    const n = parseInt(inputPct, 10);
    if (!Number.isNaN(n) && n >= 0 && n <= 100) setIvaPercentuale(n);
    else setInputPct(String(ivaPercentuale));
  };

  const dettaglio = useMemo(() => {
    return edifici
      .filter((e) => e.stato === "Operativo" && e.produzione)
      .map((e) => {
        const unita = stimaUnitaProduzioneEdificio(e, abitanti);
        const valore = unita * PREZZO_UNITA_VALORE_AGGIUNTO;
        return { edificio: e, unita, valore };
      })
      .filter((r) => r.unita > 0)
      .sort((a, b) => b.valore - a.valore);
  }, [edifici, abitanti]);

  const valoreTotale = useMemo(
    () => stimaValoreProduzioneRegno(edifici, abitanti),
    [edifici, abitanti]
  );
  const gettito = calcolaIvaImporto(valoreTotale, ivaPercentuale);

  return (
    <SafeAreaView style={[styles.safe, maxHeight != null ? { maxHeight, overflow: "hidden" as const } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>Imposta sul Valore Aggiunto</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Come funziona</Text>
            <Text style={styles.infoText}>
              A fine mese stima il valore della produzione degli edifici operativi (
              {PREZZO_UNITA_VALORE_AGGIUNTO} moneta per unità) e accredita al Tesoro l&apos;aliquota scelta. Non
              rimuove risorse. Aliquota 0% = nessun gettito.
            </Text>
          </View>

          <View style={styles.configCard}>
            <Text style={styles.configTitle}>Aliquota IVA</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={inputPct}
                onChangeText={setInputPct}
                onBlur={applyPct}
                onSubmitEditing={applyPct}
                keyboardType="numeric"
                placeholder="10"
              />
              <Text style={styles.inputUnit}>%</Text>
              <Pressable style={styles.applyBtn} onPress={applyPct}>
                <Text style={styles.applyBtnText}>Applica</Text>
              </Pressable>
            </View>
            <Text style={styles.configInfo}>
              Valore produzione stimato: {valoreTotale} · Gettito: {gettito} monete
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Edifici produttivi</Text>
          {dettaglio.map(({ edificio, unita, valore }) => (
            <View key={edificio.id} style={styles.row}>
              <Text style={styles.rowEmoji}>{edificio.emoji ?? "🏭"}</Text>
              <View style={styles.rowText}>
                <Text style={styles.rowNome} numberOfLines={1}>
                  {edificio.nome}
                </Text>
                <Text style={styles.rowSub}>
                  {unita} unità · valore {valore} · IVA {calcolaIvaImporto(valore, ivaPercentuale)}
                </Text>
              </View>
            </View>
          ))}
          {dettaglio.length === 0 && (
            <Text style={styles.empty}>Nessuna produzione stimata (servono addetti sugli edifici).</Text>
          )}
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
  title: { color: "#fff", fontSize: 16, fontWeight: "700", textAlign: "center", flex: 1 },
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
