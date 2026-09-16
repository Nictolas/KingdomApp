import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { getEmojiAbitante } from "../src/utils/getEmojiAbitante";
import type { Abitante } from "../src/types";

export default function RedditoCittadinanzaScreen() {
  const router = useRouter();
  const { abitanti, redditoCittadinanza, setRedditoCittadinanza } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const beneficiari = abitanti.filter(
    (a) => a.lavoro === "Disoccupato" && !(a.fazioni?.includes("Schiavi") ?? false)
  );

  return (
    <SafeAreaView style={[styles.safe, maxHeight ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>Reddito di Cittadinanza</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Importo mensile</Text>
          <Text style={styles.sectionSubtitle}>
            Importo in crediti dato ogni mese a tutti gli abitanti <Text style={styles.bold}>non schiavi</Text> con
            lavoro <Text style={styles.bold}>"Disoccupato"</Text>. L'importo entra nel loro reddito.
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={String(redditoCittadinanza ?? 0)}
              keyboardType="number-pad"
              onChangeText={(text) => {
                const n = parseInt(text.replace(/[^0-9]/g, ""), 10);
                setRedditoCittadinanza(isNaN(n) ? 0 : Math.max(0, n));
              }}
            />
            <Text style={styles.inputUnit}>crediti/mese</Text>
          </View>
          <Text style={styles.helperText}>
            Impostando 0 il Reddito di Cittadinanza è di fatto disattivato.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Beneficiari attuali ({beneficiari.length})</Text>
          {beneficiari.length === 0 ? (
            <Text style={styles.emptyText}>Nessun disoccupato non schiavo al momento.</Text>
          ) : (
            <View style={styles.list}>
              {beneficiari.map((a: Abitante) => (
                <View key={a.id} style={styles.item}>
                  <Text style={styles.itemEmoji}>{getEmojiAbitante(a)}</Text>
                  <View style={styles.itemContent}>
                    <Text style={styles.itemNome}>{a.nome}</Text>
                    <Text style={styles.itemDetail}>Reddito attuale: {a.reddito} crediti/mese</Text>
                    <Text style={styles.itemDetail}>
                      Reddito con cittadinanza: {a.reddito + (redditoCittadinanza ?? 0)} crediti/mese
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      </View>
      <View style={styles.footer}>
        <Text style={styles.back} onPress={() => router.back()}>← Leggi</Text>
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
    paddingVertical: 8,
    paddingBottom: 12,
    gap: 8,
    flexGrow: 1
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  sectionTitle: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  sectionSubtitle: {
    color: "rgba(203,213,245,0.8)",
    fontSize: 10,
    marginBottom: 8
  },
  bold: {
    fontWeight: "700"
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4
  },
  input: {
    backgroundColor: "rgba(30,41,59,0.9)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)",
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    color: "#e5e7eb",
    fontSize: 14,
    minWidth: 80
  },
  inputUnit: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10
  },
  helperText: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9,
    marginTop: 4
  },
  list: {
    marginTop: 4,
    gap: 4
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 4,
    backgroundColor: "rgba(15,23,42,0.8)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)"
  },
  itemEmoji: {
    fontSize: 22,
    marginRight: 8
  },
  itemContent: {
    flex: 1
  },
  itemNome: {
    color: "#e5e7eb",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2
  },
  itemDetail: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9
  },
  emptyText: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 10,
    fontStyle: "italic",
    marginTop: 4
  }
});

