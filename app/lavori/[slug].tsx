import React, { useMemo, useState } from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useGameContext } from "../../src/context/GameContext";
import type { Abitante } from "../../src/types";
import {
  abitantiConOccupazione,
  etichettaEdificiOccupazione,
  resolveLavoroFromSlug
} from "../../src/game/lavoriCatalogo";
import { etichettaOrarioLavoro } from "../../src/game/orariLavoroCatalogo";
import { AbitanteAvatarPreview } from "../../src/ui/AbitanteAvatarPreview";
import { AbitanteInfoModal } from "../../src/ui/AbitanteInfoModal";

export default function LavoriOccupazioneScreen() {
  const router = useRouter();
  const raw = useLocalSearchParams<{ slug: string | string[] }>().slug;
  const slug = Array.isArray(raw) ? raw[0] : raw ?? "";
  const { abitanti, edifici, calcolaFelicitàModificata, etaMinimaLavoro } = useGameContext();
  const [selectedAbitante, setSelectedAbitante] = useState<Abitante | null>(null);

  const lavoro = useMemo(
    () => resolveLavoroFromSlug(slug, abitanti),
    [slug, abitanti]
  );

  const abitantiAttivi = useMemo(
    () => abitanti.filter((a) => a.razza !== "Golem"),
    [abitanti]
  );

  const elenco = useMemo(() => {
    if (!lavoro) return [];
    return abitantiConOccupazione(abitantiAttivi, lavoro);
  }, [abitantiAttivi, lavoro]);

  const getAbitanteNome = (id: number) => abitanti.find((a) => a.id === id)?.nome ?? `ID ${id}`;

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  if (!lavoro) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.back} onPress={() => router.replace("/lavori")}>← Lavori</Text>
          <Text style={styles.title}>Occupazione</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.missingWrap}>
          <Text style={styles.missingText}>Occupazione non trovata.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, maxHeight != null ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.push("/lavori")}>← Lavori</Text>
        <Text style={styles.title}>{lavoro}</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
          <Text style={styles.edificiLabel}>{etichettaEdificiOccupazione(lavoro)}</Text>
          <Text style={styles.orarioLabel}>🕐 Orario: {etichettaOrarioLavoro(lavoro)}</Text>
          <Text style={styles.sectionTitle}>
            {elenco.length} {elenco.length === 1 ? "persona" : "persone"}
          </Text>
          <View style={styles.listCard}>
            {elenco.length === 0 ? (
              <Text style={styles.listEmpty}>Nessuno con questa occupazione</Text>
            ) : (
              elenco.map((a) => (
                <Pressable key={a.id} style={styles.riga} onPress={() => setSelectedAbitante(a)}>
                  <AbitanteAvatarPreview abitante={a} />
                  <Text style={styles.nomeLink} numberOfLines={1}>
                    {a.nome}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        </ScrollView>
      </View>

      <AbitanteInfoModal
        visible={selectedAbitante !== null}
        abitante={selectedAbitante}
        edifici={edifici}
        onClose={() => setSelectedAbitante(null)}
        getAbitanteNome={getAbitanteNome}
        calcolaFelicitàModificata={calcolaFelicitàModificata}
        etaMinimaLavoro={etaMinimaLavoro}
      />
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
  back: { color: "#93c5fd", fontSize: 12, width: 50 },
  title: { color: "#ffffff", fontSize: 14, fontWeight: "700", flex: 1, textAlign: "center" },
  content: { padding: 16, paddingBottom: 24 },
  edificiLabel: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 10
  },
  orarioLabel: {
    color: "#fde68a",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 12
  },
  sectionTitle: { color: "#ffffff", fontSize: 13, fontWeight: "700", marginBottom: 8 },
  listCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)"
  },
  listEmpty: {
    color: "rgba(203,213,245,0.45)",
    fontSize: 11,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 12
  },
  riga: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.2)"
  },
  nomeLink: { color: "#93c5fd", fontSize: 12, fontWeight: "600", flex: 1, minWidth: 0 },
  missingWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  missingText: { color: "rgba(203,213,245,0.6)", fontSize: 12 }
});
