import React, { useMemo } from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { formatOrologioGioco } from "../src/game/orologioGiocoSession";
import {
  formatRegistrazioneScambio,
  MAX_REGISTRAZIONI_SCAMBI
} from "../src/game/registrazioniScambi";

export default function RegistrazioniScreen() {
  const router = useRouter();
  const { registrazioniScambi } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const righe = useMemo(() => [...registrazioniScambi].reverse(), [registrazioniScambi]);

  return (
    <SafeAreaView style={[styles.safe, maxHeight != null ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>Registrazioni</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.hint}>
              Scambi moneta ↔ oggetto, costruzioni del Re e raccolte in Serra, Bosco e Miniera.
              Ultime {MAX_REGISTRAZIONI_SCAMBI} righe.
            </Text>
          </View>

          {righe.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.empty}>Nessuna registrazione ancora.</Text>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>
                {righe.length} registrazion{righe.length === 1 ? "e" : "i"}
              </Text>
              {righe.map((r) => (
                <View key={r.id} style={styles.riga}>
                  <Text style={styles.meta}>
                    Giorno {r.giorno} · {formatOrologioGioco(r.minutiDaMezzanotte)}
                    {r.tipo === "raccolta"
                      ? " · raccolta"
                      : r.tipo === "costruzione"
                        ? ` · costruzione · ${r.prezzoMonete}💰`
                        : ` · ${r.prezzoMonete}💰`}
                  </Text>
                  <Text style={styles.testo}>
                    {r.itemEmoji} {formatRegistrazioneScambio(r)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Indietro</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#050816"
  },
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
  back: {
    color: "#93c5fd",
    fontSize: 12
  },
  title: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700"
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: 8,
    gap: 10
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  hint: {
    color: "rgba(203,213,245,0.75)",
    fontSize: 12,
    lineHeight: 18
  },
  empty: {
    color: "rgba(203,213,245,0.55)",
    fontSize: 12
  },
  sectionTitle: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  riga: {
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.35)"
  },
  meta: {
    color: "rgba(148,163,184,0.9)",
    fontSize: 10,
    marginBottom: 2
  },
  testo: {
    color: "#e5e7eb",
    fontSize: 12,
    lineHeight: 17
  }
});
