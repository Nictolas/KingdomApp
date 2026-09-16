import React from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";

export default function IusPrimaeNoctisScreen() {
  const router = useRouter();
  const { iusPrimaeNoctisAttivo, setIusPrimaeNoctisAttivo } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>Ius primae noctis</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Stato</Text>
          <Text style={styles.infoText}>
            {iusPrimaeNoctisAttivo
              ? "Lo Ius primae noctis è attualmente attivo."
              : "Lo Ius primae noctis non è attivo."}
          </Text>
          {iusPrimaeNoctisAttivo && (
            <Text style={styles.warningText}>
              Questa legge aggiunge +1 al punteggio sanzioni. In caso di evento Matrimonio potrai scegliere di esercitare il diritto su uno dei due sposi; se di sesso opposto al Re c'è il 50% di possibilità che rimanga incinta.
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attiva / Disattiva</Text>
          <Pressable
            style={[styles.toggleButton, iusPrimaeNoctisAttivo && styles.toggleButtonActive]}
            onPress={() => setIusPrimaeNoctisAttivo(!iusPrimaeNoctisAttivo)}
          >
            <Text style={[styles.toggleText, iusPrimaeNoctisAttivo && styles.toggleTextActive]}>
              {iusPrimaeNoctisAttivo ? "✓ Attivo" : "Disattivo"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.descCard}>
          <Text style={styles.descTitle}>Descrizione</Text>
          <Text style={styles.descText}>
            Lo Ius primae noctis conferisce al Re il diritto di passare la prima notte con uno degli sposi prima delle nozze. Se attivo, in occasione dell'evento Matrimonio compare l'opzione "Utilizza Ius primae noctis": puoi scegliere su quale dei due abitanti esercitarlo. Se la persona scelta è di sesso opposto al Re, c'è il 50% di possibilità che rimanga incinta.
          </Text>
        </View>

        <View style={styles.effettiCard}>
          <Text style={styles.effettiTitle}>Effetti</Text>
          <View style={styles.effettoRow}>
            <Text style={styles.effettoEmoji}>📜</Text>
            <Text style={styles.effettoText}>In evento Matrimonio: opzione "Utilizza Ius primae noctis" e scelta dello sposo/a</Text>
          </View>
          <View style={styles.effettoRow}>
            <Text style={styles.effettoEmoji}>🤰</Text>
            <Text style={styles.effettoText}>Se sesso opposto al Re: 50% possibilità che rimanga incinta</Text>
          </View>
          <View style={styles.effettoRow}>
            <Text style={styles.effettoEmoji}>⚠️</Text>
            <Text style={styles.effettoText}>Aumenta il punteggio sanzioni di +1 punto</Text>
          </View>
        </View>

        <Pressable style={styles.linkRow} onPress={() => router.push("/sanzioni")}>
          <Text style={styles.linkText}>Vedi punteggio sanzioni →</Text>
        </Pressable>
      </ScrollView>
      </View>
      <View style={styles.footer}>
        <Text style={styles.back} onPress={() => router.back()}>← Leggi</Text>
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
  content: { paddingHorizontal: 12, paddingVertical: 10, paddingBottom: 24 },
  infoCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)"
  },
  infoTitle: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6
  },
  infoText: { color: "#e5e7eb", fontSize: 12, marginBottom: 4 },
  warningText: { color: "rgba(253,224,71,0.9)", fontSize: 11, marginTop: 6 },
  section: { marginTop: 16 },
  sectionTitle: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 8
  },
  toggleButton: {
    backgroundColor: "rgba(15,23,42,0.95)",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)",
    alignSelf: "flex-start"
  },
  toggleButtonActive: { borderColor: "rgba(74,222,128,0.5)" },
  toggleText: { color: "#cbd5f5", fontSize: 13 },
  toggleTextActive: { color: "#4ade80", fontWeight: "600" },
  descCard: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)",
    backgroundColor: "rgba(15,23,42,0.6)"
  },
  descTitle: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 6
  },
  descText: { color: "#cbd5f5", fontSize: 11, lineHeight: 18 },
  effettiCard: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)",
    backgroundColor: "rgba(15,23,42,0.6)"
  },
  effettiTitle: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 8
  },
  effettoRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  effettoEmoji: { fontSize: 14, marginRight: 8 },
  effettoText: { color: "#cbd5f5", fontSize: 11, flex: 1 },
  linkRow: { marginTop: 20, paddingVertical: 8 },
  linkText: { color: "#93c5fd", fontSize: 12 }
});
