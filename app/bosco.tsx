import React, { useMemo } from "react";
import {
  Dimensions,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useGameContext } from "../src/context/GameContext";
import {
  BOTTINO_BOSCO,
  CAPACITA_BOSCO,
  etichettaRaccoltoBosco
} from "../src/game/boscoRaccolta";
import { AbitanteAvatarPreview } from "../src/ui/AbitanteAvatarPreview";
import type { Abitante } from "../src/types";

export default function BoscoScreen() {
  const { abitanti, edifici } = useGameContext();
  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;

  const bosco = edifici.find((e) => e.nome === "Bosco");
  const raccoglitori = useMemo(
    () =>
      bosco
        ? bosco.abitantiAssegnati
            .map((id) => abitanti.find((a) => a.id === id))
            .filter((a): a is Abitante => a != null)
        : [],
    [abitanti, bosco]
  );

  const bottiniPossibili = useMemo(() => {
    const seen = new Set<string>();
    return BOTTINO_BOSCO.filter((v) => {
      if (seen.has(v.itemId)) return false;
      seen.add(v.itemId);
      return true;
    });
  }, []);

  if (!bosco) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.title}>🌲 Bosco non presente</Text>
        
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={{ width: 70 }} />
        <Text style={styles.title}>🌲 Bosco</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Raccolta spontanea</Text>
          <Text style={styles.infoText}>
            Ogni Raccoglitore assegnato trova ogni giorno 1 o 2 oggetti naturali.
          </Text>
          <Text style={styles.infoMuted}>
            I disoccupati diventano Raccoglitori solo quando raggiungono fisicamente il Bosco sulla mappa.
          </Text>
          <Text style={styles.capacity}>
            {raccoglitori.length}/{Math.max(bosco.capacità ?? 0, CAPACITA_BOSCO)} posti occupati
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Possibili bottini</Text>
          <View style={styles.lootGrid}>
            {bottiniPossibili.map((v) => (
              <View key={v.itemId} style={styles.lootChip}>
                <Text style={styles.lootText}>{v.emoji} {v.nome}</Text>
              </View>
            ))}
          </View>
        </View>

        {raccoglitori.length === 0 ? (
          <Text style={styles.empty}>Nessun Raccoglitore nel Bosco.</Text>
        ) : (
          <View style={styles.grid}>
            {raccoglitori.map((a) => (
              <View key={a.id} style={styles.personCard}>
                <AbitanteAvatarPreview abitante={a} />
                <Text style={styles.personName}>{a.nome}</Text>
                <Text style={styles.personMeta}>
                  {a.lavoro} · Competenza {a.competenza}%
                </Text>
                <Text style={styles.harvest}>
                  {a.ultimoRaccoltoBosco?.voci?.length
                    ? `Ultimo trovato: ${etichettaRaccoltoBosco(a.ultimoRaccoltoBosco.voci)}`
                    : "Nessun raccolto registrato"}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
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
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.5)"
  },
  back: { color: "#93c5fd", fontSize: 12 },
  title: { color: "#fff", fontSize: 14, fontWeight: "700" },
  content: { padding: 12, gap: 12 },
  contentDesktop: { maxWidth: 920, width: "100%", alignSelf: "center" },
  infoCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    borderRadius: 10,
    padding: 12
  },
  infoTitle: { color: "#93c5fd", fontSize: 11, fontWeight: "700" },
  infoText: { color: "#e2e8f0", fontSize: 11, marginTop: 4 },
  infoMuted: { color: "#94a3b8", fontSize: 10, marginTop: 4, lineHeight: 15 },
  capacity: { color: "#4ade80", fontSize: 12, fontWeight: "800", marginTop: 8 },
  lootGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  lootChip: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  lootText: { color: "#cbd5e1", fontSize: 9 },
  empty: { color: "#64748b", fontSize: 11, fontStyle: "italic", paddingVertical: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  personCard: {
    width: 210,
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)",
    borderRadius: 8,
    padding: 10
  },
  personName: { color: "#e5e7eb", fontSize: 11, fontWeight: "700", marginTop: 5 },
  personMeta: { color: "#94a3b8", fontSize: 9, marginTop: 2 },
  harvest: { color: "#cbd5e1", fontSize: 9, marginTop: 7, textAlign: "center" }
});
