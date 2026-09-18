import React, { useMemo, useState } from "react";
import {
  Alert,
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
import { stimaPrelievoForzoso } from "../src/game/tasse";

export default function PrelievoForzosoScreen() {
  const router = useRouter();
  const { abitanti, eseguiPrelievoForzosoRe } = useGameContext();
  const [importo, setImporto] = useState("10");

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const importoNum = Math.max(0, parseInt(importo.replace(/[^0-9]/g, ""), 10) || 0);
  const anteprima = useMemo(
    () => stimaPrelievoForzoso(abitanti, importoNum),
    [abitanti, importoNum]
  );

  const conferma = () => {
    if (importoNum <= 0) {
      Alert.alert("Importo non valido", "Inserisci un numero di monete maggiore di zero.");
      return;
    }
    if (anteprima.soggettiColpiti <= 0) {
      Alert.alert("Nessun soggetto", "Nessun abitante ha monete da prelevare.");
      return;
    }
    Alert.alert(
      "Confermare il prelievo forzoso?",
      `Fino a ${importoNum} monete da ciascun suddito con inventario.\n` +
        `Stima: ${anteprima.gettito} monete da ${anteprima.soggettiColpiti} abitanti.\n` +
        `I colpiti perdono soddisfazione per un mese.`,
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Preleva",
          style: "destructive",
          onPress: () => {
            const r = eseguiPrelievoForzosoRe(importoNum);
            Alert.alert(
              "Prelievo eseguito",
              `Raccolte ${r.gettito} monete da ${r.soggettiColpiti} abitanti.`
            );
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safe, maxHeight != null ? { maxHeight, overflow: "hidden" as const } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>Prelievo Forzoso</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Potere del Re</Text>
            <Text style={styles.infoText}>
              Raccogli all&apos;improvviso fino a X monete da ogni abitante con inventario personale. Esclusi: Re,
              Golem, schiavi e servi della gleba. Il gettito va al Tesoro. Chi paga subisce −3 soddisfazione fino
              al mese successivo.
            </Text>
          </View>

          <View style={styles.configCard}>
            <Text style={styles.configTitle}>Monete per abitante (X)</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={importo}
                onChangeText={(t) => setImporto(t.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                placeholder="10"
              />
              <Text style={styles.inputUnit}>monete</Text>
            </View>
            <Text style={styles.configInfo}>
              Stima gettito: {anteprima.gettito} monete · soggetti: {anteprima.soggettiColpiti}
            </Text>
            <Text style={styles.helper}>
              Se un abitante ha meno di X monete, viene preso tutto il suo saldo.
            </Text>
          </View>

          <Pressable
            style={[styles.actionBtn, (importoNum <= 0 || anteprima.soggettiColpiti <= 0) && styles.actionBtnDisabled]}
            onPress={conferma}
            disabled={importoNum <= 0 || anteprima.soggettiColpiti <= 0}
          >
            <Text style={styles.actionBtnText}>Esegui prelievo forzoso</Text>
          </Pressable>
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Leggi
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
  content: { padding: 16, gap: 14, paddingBottom: 40 },
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
    minWidth: 88,
    textAlign: "center"
  },
  inputUnit: { color: "#94a3b8", fontWeight: "600" },
  configInfo: { color: "#86efac", fontSize: 13 },
  helper: { color: "#64748b", fontSize: 12 },
  actionBtn: {
    backgroundColor: "#b91c1c",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center"
  },
  actionBtnDisabled: { opacity: 0.45 },
  actionBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  footer: {
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#1e293b"
  },
  back: { color: "#93c5fd", fontWeight: "600" }
});
