import React from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { leggiData } from "../src/kingdomData";

export default function AmministrazioneScreen() {
  const router = useRouter();
  const { abitanti, punteggioSanzioni } = useGameContext();
  const leggi = leggiData;

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🏛️</Text>
          <Text style={styles.heroTitle}>Amministrazione</Text>
          <Text style={styles.heroSubtitle}>Leggi, sanzioni e abitanti</Text>
        </View>

        <View style={styles.block}>
          <View style={[styles.navGrid, isDesktop && styles.navGridWide]}>
            <Pressable style={[styles.navCard, isDesktop && styles.navCardWide]} onPress={() => router.push("/leggi")}>
              <Text style={styles.navEmoji}>📜</Text>
              <Text style={styles.navLabel}>Leggi</Text>
              <Text style={styles.navMeta}>{leggi.length}</Text>
            </Pressable>
            <Pressable style={[styles.navCard, isDesktop && styles.navCardWide]} onPress={() => router.push("/sanzioni")}>
              <Text style={styles.navEmoji}>⚠️</Text>
              <Text style={styles.navLabel}>Sanzioni</Text>
              <Text style={[styles.navMeta, punteggioSanzioni >= 5 && styles.navMetaWarn]}>{punteggioSanzioni}/10</Text>
            </Pressable>
            <Pressable style={[styles.navCard, isDesktop && styles.navCardWide]} onPress={() => router.push("/abitanti")}>
              <Text style={styles.navEmoji}>👥</Text>
              <Text style={styles.navLabel}>Abitanti</Text>
              <Text style={styles.navMeta}>{abitanti.length}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0a0f1a" },
  container: { flex: 1 },
  scrollContent: { paddingBottom: 28, paddingHorizontal: 14, maxWidth: 440, alignSelf: "center", width: "100%" },
  hero: {
    paddingTop: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.12)",
    marginBottom: 18,
    alignItems: "center"
  },
  heroEmoji: { fontSize: 48, marginBottom: 8 },
  heroTitle: { fontSize: 24, fontWeight: "700", color: "#f1f5f9" },
  heroSubtitle: { fontSize: 14, color: "#94a3b8", marginTop: 4 },
  block: { marginBottom: 18 },
  navGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  navGridWide: { maxWidth: 400 },
  navCard: {
    backgroundColor: "rgba(30,41,59,0.8)",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    minWidth: 100,
    flex: 1
  },
  navCardWide: { maxWidth: 140 },
  navEmoji: { fontSize: 28, marginBottom: 6 },
  navLabel: { fontSize: 16, fontWeight: "600", color: "#f1f5f9" },
  navMeta: { fontSize: 13, color: "#94a3b8", marginTop: 4 },
  navMetaWarn: { color: "#f59e0b" }
});
