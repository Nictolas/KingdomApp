import React, { useMemo } from "react";
import {
  Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useGameContext } from "../../src/context/GameContext";
import { getServiDellaGlebaPerAssegnazioneEdificio } from "../../src/game/edificiLavoro";
import { orarioPerLavoro, formatFasciaOraria } from "../../src/game/orariLavoroCatalogo";
import { SEDE_PER_PROFESSIONE, type ProfessioneForestale } from "../../src/game/turniForestali";

const LAVORO_PER_SEDE = new Map<string, ProfessioneForestale>(
  (Object.entries(SEDE_PER_PROFESSIONE) as [ProfessioneForestale, string | null][])
    .filter(([, sede]) => sede !== null).map(([lavoro, sede]) => [sede!, lavoro])
);

export default function SedeForestaleScreen() {
  const router = useRouter();
  const raw = useLocalSearchParams<{ id: string | string[] }>().id;
  const edificioId = Number(Array.isArray(raw) ? raw[0] : raw);
  const {
    abitanti, edifici, assegnaServoDellaGlebaAEdificio, rimuoviAbitanteDaEdificio
  } = useGameContext();
  const edificio = useMemo(
    () => edifici.find((e) => e.id === edificioId && LAVORO_PER_SEDE.has(e.nome)),
    [edifici, edificioId]
  );
  const lavoro = edificio ? LAVORO_PER_SEDE.get(edificio.nome) : undefined;
  const lavoratori = useMemo(
    () => edificio
      ? abitanti.filter((a) => (edificio.abitantiAssegnati ?? []).includes(a.id))
      : [],
    [abitanti, edificio]
  );
  const servi = useMemo(
    () => edificio
      ? getServiDellaGlebaPerAssegnazioneEdificio(abitanti, edifici, edificio)
      : [],
    [abitanti, edifici, edificio]
  );

  const fascia = lavoro ? orarioPerLavoro(lavoro) : null;
  const posti = edificio
    ? Math.max(0, edificio.capacità - lavoratori.length)
    : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {!edificio ? (
          <Text style={styles.title}>Sede forestale non trovata</Text>
        ) : (
          <>
            <Text style={styles.title}>{edificio.emoji} {edificio.nome}</Text>
            <Text style={styles.sub}>{edificio.descrizione}</Text>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Attività</Text>
              <Text style={styles.detail}>Professione: {lavoro}</Text>
              <Text style={styles.detail}>Stato: {edificio.stato}</Text>
              <Text style={styles.detail}>Turno: {fascia ? formatFasciaOraria(fascia) : "Da definire"}</Text>
              <Text style={styles.detail}>Lavoratori: {lavoratori.length}/{edificio.capacità}</Text>
              <Text style={styles.note}>
                I lavoratori devono raggiungere fisicamente la sede e il Bosco.
                La distanza della costruzione dalla foresta incide sul tempo disponibile.
              </Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Lavoratori assegnati</Text>
              {lavoratori.length === 0 && <Text style={styles.note}>Nessuno assegnato.</Text>}
              {lavoratori.map((a) => (
                <View key={a.id} style={styles.worker}>
                  <Text style={styles.workerName}>{a.emoji} {a.nome}</Text>
                  <Pressable
                    onPress={() => rimuoviAbitanteDaEdificio(a.id, edificio.id)}
                    style={styles.outlineButton}
                    accessibilityRole="button"
                  >
                    <Text style={styles.outlineText}>Rimuovi</Text>
                  </Pressable>
                </View>
              ))}
            </View>
            {posti > 0 && servi.length > 0 && edificio.stato === "Operativo" && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Assegna un servo della gleba</Text>
                {servi.map((a) => (
                  <View key={a.id} style={styles.worker}>
                    <Text style={styles.workerName}>{a.emoji} {a.nome}</Text>
                    <Pressable
                      style={styles.button}
                      onPress={() => assegnaServoDellaGlebaAEdificio(a.id, edificio.id)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.buttonText}>Assegna</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Esci dall'edificio e torna alla mappa"
        >
          <Text style={styles.backText}>← Esci dall'edificio</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#08121f" },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 26 },
  title: { color: "#f0f5fc", fontSize: 22, fontWeight: "800" },
  sub: { color: "#c5d3e5", fontSize: 14, lineHeight: 22 },
  card: {
    backgroundColor: "#152537", borderWidth: 1, borderColor: "#2c4054",
    borderRadius: 14, padding: 16, gap: 12
  },
  cardTitle: { color: "#f1f5ff", fontSize: 17, fontWeight: "700" },
  detail: { color: "#e0e8f2", fontSize: 14 },
  note: { color: "#c5d3e5", fontSize: 13, lineHeight: 21 },
  worker: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: 10, paddingVertical: 7, borderTopWidth: 1, borderTopColor: "#2c4054"
  },
  workerName: { color: "#f1f5ff", fontSize: 13, flexShrink: 1, flex: 1 },
  outlineButton: {
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: "#7699c7"
  },
  outlineText: { color: "#d8eaff", fontSize: 13, fontWeight: "700" },
  button: { backgroundColor: "#274f86", paddingHorizontal: 13, paddingVertical: 10, borderRadius: 8 },
  buttonText: { color: "white", fontWeight: "700", fontSize: 13 },
  footer: {
    borderTopColor: "#2c4054", borderTopWidth: 1,
    backgroundColor: "#101e2e", paddingHorizontal: 16, paddingVertical: 12
  },
  backButton: { backgroundColor: "#274f86", padding: 15, borderRadius: 10, alignItems: "center" },
  backText: { color: "#ffffff", fontSize: 15, fontWeight: "700" }
});
