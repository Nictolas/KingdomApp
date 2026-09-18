import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { generaAspettoEsempioRazza } from "../src/game/personaggioAspetto";
import { lpcSpriteCircleDiameter } from "../src/character-system/lpcPack";
import { RAZZE_ABITANTI } from "../src/types";
import { PixelAvatarPreview } from "../src/ui/PixelAvatarPreview";

const RACE_DETAILS = {
  Umano: { head: "Human" },
  Nano: { head: "Human child / Winter Beard" },
  Scheletro: { head: "Skeleton" },
  Vampiro: { head: "Vampire" },
  Goblin: { head: "Goblin" },
  Orco: { head: "Orc female / Orc male" },
  Lucertoloide: { head: "Lizard female / Lizard male" }
} as const;

const ESEMPIO_RAZZA_SEED: Record<(typeof RAZZE_ABITANTI)[number], number> = {
  Umano: 42,
  Nano: 777,
  Scheletro: 137,
  Vampiro: 256,
  Goblin: 389,
  Orco: 512,
  Lucertoloide: 633
};

const ESEMPI_RAZZA = Object.fromEntries(
  RAZZE_ABITANTI.map((razza) => [razza, generaAspettoEsempioRazza(razza, ESEMPIO_RAZZA_SEED[razza])])
) as Record<(typeof RAZZE_ABITANTI)[number], ReturnType<typeof generaAspettoEsempioRazza>>;

export default function RazzeScreen() {
  const router = useRouter();
  const { abitanti } = useGameContext();

  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}><Text style={styles.title}>🧬 Razze</Text></View>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>Composizione razziale degli abitanti del regno.</Text>
      <View style={styles.grid}>
      {RAZZE_ABITANTI.map((razza) => {
        const count = abitanti.filter((abitante) => (abitante.razza ?? "Umano") === razza).length;
        const detail = RACE_DETAILS[razza];
        const avatarSize = 52;
        const avatarOuter = lpcSpriteCircleDiameter(avatarSize) + 8;
        return <View key={razza} style={styles.card}>
          <View style={[styles.avatarWrap, { width: avatarOuter, height: avatarOuter }]}>
            <PixelAvatarPreview razza={razza} aspetto={ESEMPI_RAZZA[razza]} size={avatarSize} animate={false} />
          </View>
          <Text style={styles.race}>{razza}</Text>
          <Text style={styles.head} numberOfLines={2}>Heads: {detail.head}</Text>
          <View style={styles.countBadge}><Text style={styles.count}>{count}</Text></View>
        </View>;
      })}
      </View>
    </ScrollView>
    <View style={styles.footer}><Text style={styles.back} onPress={() => router.back()}>← Menu</Text></View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050816" },
  header: { alignItems: "center", padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(148,163,184,0.6)" },
  title: { color: "#fff", fontSize: 16, fontWeight: "800" },
  content: { width: "100%", maxWidth: 960, alignSelf: "center", padding: 16 },
  subtitle: { color: "rgba(203,213,245,0.78)", fontSize: 12, marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: {
    width: "31%",
    minWidth: 180,
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    backgroundColor: "rgba(15,23,42,0.96)"
  },
  avatarWrap: { marginBottom: 8, alignItems: "center", justifyContent: "center" },
  race: { color: "#f1f5f9", fontSize: 14, fontWeight: "800", textAlign: "center" },
  head: { color: "#93c5fd", fontSize: 10, marginTop: 4, textAlign: "center", minHeight: 28 },
  countBadge: { marginTop: 8, minWidth: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(59,130,246,0.2)", borderWidth: 1, borderColor: "#3b82f6" },
  count: { color: "#fff", fontSize: 16, fontWeight: "800" },
  footer: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(148,163,184,0.6)" },
  back: { color: "#93c5fd", fontSize: 12 }
});
