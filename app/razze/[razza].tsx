import React, { useMemo } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useGameContext } from "../../src/context/GameContext";
import { abitantiPerRazza, schedaDaSlug } from "../../src/game/razzeNavigazione";
import { AbitanteAvatarPreview } from "../../src/ui/AbitanteAvatarPreview";

/** Schede dinamiche /razze/umani, /razze/nani, /razze/felix, ecc. */
export default function AbitantiRazzaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ razza?: string | string[] }>();
  const slug = Array.isArray(params.razza) ? params.razza[0] : params.razza ?? "";
  const scheda = schedaDaSlug(slug);
  const { abitanti } = useGameContext();
  const { width } = useWindowDimensions();
  const elenco = useMemo(
    () => scheda ? abitantiPerRazza(abitanti, scheda.razza) : [],
    [abitanti, scheda]
  );

  const gridWidth = Math.max(0, Math.min(width, 1120) - 32);
  const columns = width < 460 ? 2 : width < 720 ? 3 : width < 1080 ? 4 : 6;
  const cardWidth = Math.max(0, (gridWidth - 12 * (columns - 1)) / columns);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Torna all'elenco delle razze"
          onPress={() => router.replace("/razze")}
          style={styles.backButton}
        >
          <Text style={styles.back}>← Razze</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {scheda ? `${scheda.emoji} ${scheda.titolo}` : "Razza non trovata"}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {scheda ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator>
          <Text style={styles.count}>
            {elenco.length} {elenco.length === 1 ? "abitante" : "abitanti"} {elenco.length === 1 ? "presente" : "presenti"} nel regno
          </Text>
          {elenco.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Nessun abitante {scheda.titolo.toLowerCase()}</Text>
              <Text style={styles.emptyText}>Al momento non ci sono abitanti di questa razza nel regno.</Text>
            </View>
          ) : (
            <View style={styles.grid} testID="griglia-abitanti-razza">
              {elenco.map((abitante) => (
                <View key={abitante.id} style={[styles.residentCard, { width: cardWidth }]} testID={`abitante-razza-${abitante.id}`}>
                  <View style={styles.portraitWrap}>
                    {abitante.razza === "Golem" ? (
                      <Text style={styles.golemEmoji}>🗿</Text>
                    ) : (
                      <AbitanteAvatarPreview abitante={abitante} size={74} liftPx={0} />
                    )}
                  </View>
                  <Text style={styles.name} numberOfLines={3}>{abitante.nome}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Questa razza non esiste.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace("/razze")}>
            <Text style={styles.back}>Torna alle razze</Text>
          </Pressable>
        </View>
      )}

      <Pressable style={styles.footer} accessibilityRole="button" onPress={() => router.replace("/razze")}>
        <Text style={styles.back}>← Tutte le razze</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0a2346" },
  header: {
    backgroundColor: "#071932", flexDirection: "row", alignItems: "center", paddingVertical: 13,
    paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: "#224a78"
  },
  backButton: { minHeight: 30, justifyContent: "center", minWidth: 66 },
  back: { color: "#a6d3ff", fontSize: 13, fontWeight: "700" },
  title: { color: "#f0f7ff", fontSize: 18, fontWeight: "800", textAlign: "center", flex: 1 },
  headerSpacer: { width: 66 },
  scroll: { flex: 1 },
  content: { width: "100%", maxWidth: 1120, alignSelf: "center", padding: 16, paddingBottom: 32 },
  count: { color: "#c0dcff", fontSize: 13, fontWeight: "600", marginBottom: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "stretch" },
  residentCard: {
    minHeight: 173, backgroundColor: "#173d70", borderWidth: 1, borderColor: "#30619d",
    borderRadius: 13, alignItems: "center", justifyContent: "flex-start",
    paddingHorizontal: 9, paddingTop: 12, paddingBottom: 12
  },
  portraitWrap: { height: 114, alignItems: "center", justifyContent: "center", marginBottom: 3 },
  golemEmoji: { fontSize: 58, textAlign: "center" },
  name: { color: "#ffffff", fontWeight: "800", fontSize: 13, textAlign: "center", lineHeight: 18 },
  empty: {
    marginTop: 16, alignSelf: "center", width: "100%", maxWidth: 650, borderRadius: 12,
    paddingVertical: 36, paddingHorizontal: 20, alignItems: "center", gap: 12,
    backgroundColor: "#173d70", borderWidth: 1, borderColor: "#30619d"
  },
  emptyTitle: { color: "#f0f7ff", fontWeight: "700", fontSize: 16, textAlign: "center" },
  emptyText: { color: "#b8d2f2", fontSize: 13, textAlign: "center" },
  footer: { backgroundColor: "#071932", padding: 14, borderTopWidth: 1, borderTopColor: "#224a78" }
});
