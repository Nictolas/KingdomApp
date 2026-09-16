import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

export default function MafiaScreen() {
  const router = useRouter();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>🕴️ Mafia</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Descrizione */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chi Sono</Text>
          <Text style={styles.text}>
            La Mafia è un'organizzazione criminale che opera nell'ombra della colonia. Controlla attività illecite e
            mantiene una rete di influenze tra i coloni.
          </Text>
        </View>

        {/* Cosa Vuole */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✅ Cosa Vuole</Text>
          <View style={styles.listItem}>
            <Text style={styles.listEmoji}>💊</Text>
            <Text style={styles.listText}>Tutte le droghe vietate (aumenta il loro controllo sul mercato nero)</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listEmoji}>💰</Text>
            <Text style={styles.listText}>Basse tasse per facilitare le loro operazioni</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listEmoji}>🔒</Text>
            <Text style={styles.listText}>Corruzione e controllo delle istituzioni</Text>
          </View>
        </View>

        {/* Cosa Non Vuole */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>❌ Cosa Non Vuole</Text>
          <View style={styles.listItem}>
            <Text style={styles.listEmoji}>🚫</Text>
            <Text style={styles.listText}>Legalizzazione delle droghe (riduce i loro profitti)</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listEmoji}>⚖️</Text>
            <Text style={styles.listText}>Leggi severe contro la criminalità organizzata</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listEmoji}>👮</Text>
            <Text style={styles.listText}>Maggiore controllo delle forze dell'ordine</Text>
          </View>
        </View>

        {/* Effetti */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Effetti</Text>
          <View style={styles.effettoCard}>
            <Text style={styles.effettoEmoji}>😊</Text>
            <View style={styles.effettoContent}>
              <Text style={styles.effettoTitolo}>Bonus Felicità</Text>
              <Text style={styles.effettoDescrizione}>
                I membri della Mafia sono +10% più felici se tutte le droghe sono vietate.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
    <View style={styles.footer}>
      <Text style={styles.back} onPress={() => router.back()}>← Fazioni</Text>
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
    paddingVertical: 6,
    paddingBottom: 8,
    flex: 1
  },
  section: {
    marginBottom: 12
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8
  },
  text: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    lineHeight: 14
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 6,
    padding: 8
  },
  listEmoji: {
    fontSize: 16,
    marginRight: 8,
    marginTop: 2
  },
  listText: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    lineHeight: 14,
    flex: 1
  },
  effettoCard: {
    flexDirection: "row",
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  effettoEmoji: {
    fontSize: 32,
    marginRight: 10
  },
  effettoContent: {
    flex: 1
  },
  effettoTitolo: {
    color: "#e5e7eb",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4
  },
  effettoDescrizione: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    lineHeight: 14
  }
});
