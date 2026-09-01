import React from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";

export default function NudismoScreen() {
  const router = useRouter();
  const { nudismoAttivo, setNudismoAttivo } = useGameContext();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <Text style={styles.title}>🩳 Legge sul Nudismo</Text>
        <Text style={styles.text}>
          {nudismoAttivo
            ? "Il nudismo è consentito: gli abitanti possono circolare anche senza pantaloni."
            : "Il nudismo non è consentito: in pubblico ogni abitante deve indossare pantaloni o un indumento inferiore."}
        </Text>
        <Pressable style={[styles.button, nudismoAttivo && styles.active]} onPress={() => setNudismoAttivo(!nudismoAttivo)}>
          <Text style={styles.buttonText}>{nudismoAttivo ? "✓ Legge approvata" : "Approva la legge"}</Text>
        </Pressable>
        <Text style={styles.note}>La Corona resta in ogni caso un privilegio esclusivo del Re.</Text>
        <Text style={styles.back} onPress={() => router.back()}>← Leggi</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050816", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 680, padding: 24, borderRadius: 14, borderWidth: 1, borderColor: "#334155", backgroundColor: "#0f172a" },
  title: { color: "#fff", fontSize: 24, fontWeight: "800", marginBottom: 16 },
  text: { color: "#cbd5e1", fontSize: 16, lineHeight: 24, marginBottom: 20 },
  button: { padding: 14, borderRadius: 10, backgroundColor: "#334155", alignItems: "center" },
  active: { backgroundColor: "#166534" },
  buttonText: { color: "#fff", fontWeight: "700" },
  note: { color: "#fbbf24", marginTop: 18 },
  back: { color: "#93c5fd", marginTop: 24 }
});
