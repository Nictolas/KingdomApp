import React from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useGameContext } from "../../src/context/GameContext";
import { fazioniData } from "../../src/kingdomData";
import { getEmojiAbitante } from "../../src/utils/getEmojiAbitante";
import type { Abitante, Fazione } from "../../src/types";
import { getMoneteInventarioAbitante } from "../../src/game/inventario";
import { abitanteHaInventarioPersonale } from "../../src/game/casta";

/** Slug (URL) → nome fazione in fazioniData. Usato per le fazioni senza pagina dedicata. */
const SLUG_TO_NOME: Record<string, string> = {
  cittadini: "Cittadini",
  lealisti: "Lealisti",
  elite: "Élite",
  lavoratori: "Lavoratori",
  scienziati: "Scienziati",
  esploratori: "Esploratori",
  intellettuali: "Intellettuali",
  ambientalisti: "Ambientalisti",
  golem: "Golem",
  senzatetto: "Senzatetto",
  immigrati: "Immigrati"
};

function moneteDi(a: Abitante): number {
  return abitanteHaInventarioPersonale(a) ? getMoneteInventarioAbitante(a.inventario) : 0;
}

function getMembri(fazione: Fazione, abitanti: Abitante[]): Abitante[] {
  if (fazione.nome === "Golem") return abitanti.filter((a) => a.razza === "Golem");
  if (fazione.nome === "Élite") return [...abitanti].sort((a, b) => moneteDi(b) - moneteDi(a)).slice(0, 3);
  if (fazione.nome === "Immigrati") return abitanti.filter((a) => !(a.fazioni?.includes("Cittadini") ?? false) && !(a.fazioni?.includes("Golem") ?? false));
  return abitanti.filter((a) => a.fazioni?.includes(fazione.nome));
}

export default function FazioneSlugScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { abitanti } = useGameContext();

  const nome = slug ? SLUG_TO_NOME[slug] : null;
  const fazione = nome ? fazioniData.find((f) => f.nome === nome) ?? null : null;

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  if (!fazione) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View style={{ width: 50 }} />
          <Text style={styles.title}>Fazione</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.content}>
          <Text style={styles.emptyText}>Fazione non trovata.</Text>
        </View>
        <View style={styles.footer}>
          <Text style={styles.back} onPress={() => router.back()}>← Fazioni</Text>
        </View>
      </SafeAreaView>
    );
  }

  const membri = getMembri(fazione, abitanti);

  return (
    <SafeAreaView style={[styles.safe, maxHeight ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>{fazione.emoji} {fazione.nome}</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Descrizione</Text>
          <Text style={styles.descrizione}>{fazione.descrizione}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Membri ({membri.length})</Text>
          {membri.length > 0 ? (
            <View style={styles.membriList}>
              {membri.map((a) => (
                <View key={a.id} style={styles.membroRow}>
                  <Text style={styles.membroItem}>{getEmojiAbitante(a)} {a.nome}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.membroEmpty}>Nessun membro in questa fazione</Text>
          )}
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
  content: { paddingHorizontal: 12, paddingVertical: 12, paddingBottom: 24 },
  section: { marginBottom: 16 },
  sectionLabel: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  descrizione: { color: "#cbd5f5", fontSize: 13, lineHeight: 20 },
  membriList: { marginTop: 4 },
  membroRow: { marginBottom: 6 },
  membroItem: { color: "#cbd5f5", fontSize: 13 },
  membroEmpty: { color: "rgba(203,213,245,0.6)", fontSize: 12, fontStyle: "italic" },
  emptyText: { color: "#cbd5f5", fontSize: 13, padding: 12 }
});
