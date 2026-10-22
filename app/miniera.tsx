import React, { useMemo } from "react";
import {
  Dimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useGameContext } from "../src/context/GameContext";
import { getStipendioMoneteGiornaliero } from "../src/game/edificiPubblici";
import {
  CAPACITA_MINIERA,
  MATERIALE_EDILE_DEPOSITO_PER_MINATORE_GIORNO,
  METALLI_DEPOSITO_PER_MINATORE_GIORNO,
  etichettaRaccoltoMiniera
} from "../src/game/minieraRaccolta";
import { AbitanteAvatarPreview } from "../src/ui/AbitanteAvatarPreview";
import type { Abitante } from "../src/types";

export default function MinieraScreen() {
  const {
    abitanti,
    edifici,
    risorse,
    setStipendioEdificio
  } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;

  const miniera = edifici.find((e) => e.nome === "Miniera");
  const minatori = useMemo(
    () =>
      miniera
        ? miniera.abitantiAssegnati
            .map((id) => abitanti.find((a) => a.id === id))
            .filter((a): a is Abitante => a != null)
        : [],
    [abitanti, miniera]
  );

  if (!miniera) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.title}>⛏️ Miniera non presente</Text>
        
      </SafeAreaView>
    );
  }

  const stipendio = getStipendioMoneteGiornaliero(miniera);
  const metalli = risorse.find((r) => r.nome === "Metalli")?.quantità ?? 0;
  const materialeEdile = risorse.find((r) => r.nome === "Materiale Edile")?.quantità ?? 0;
  const produzioneMetalliGiorno = minatori.length * METALLI_DEPOSITO_PER_MINATORE_GIORNO;
  const produzioneMaterialeGiorno =
    minatori.length * MATERIALE_EDILE_DEPOSITO_PER_MINATORE_GIORNO;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={{ width: 70 }} />
        <Text style={styles.title}>⛏️ Miniera</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Produzione del Regno</Text>
          <Text style={styles.infoText}>
            Ogni Minatore deposita {METALLI_DEPOSITO_PER_MINATORE_GIORNO} Metalli e {MATERIALE_EDILE_DEPOSITO_PER_MINATORE_GIORNO} Materiale Edile al giorno.
          </Text>
          <Text style={styles.production}>
            +{produzioneMetalliGiorno} Metalli/giorno · +{produzioneMaterialeGiorno} Materiale Edile/giorno
          </Text>
          <Text style={styles.infoMuted}>
            Magazzino attuale: {metalli} Metalli · {materialeEdile} Materiale Edile
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Stipendio dal Tesoro</Text>
          <Text style={styles.infoText}>
            {stipendio} monete/giorno per Minatore.
          </Text>
          <View style={styles.wageRow}>
            <Pressable
              style={styles.wageBtn}
              onPress={() => setStipendioEdificio(miniera.id, Math.max(0, stipendio - 1) * 30)}
            >
              <Text style={styles.wageBtnText}>−</Text>
            </Pressable>
            <Text style={styles.wageValue}>{stipendio} / giorno</Text>
            <Pressable
              style={styles.wageBtn}
              onPress={() => setStipendioEdificio(miniera.id, (stipendio + 1) * 30)}
            >
              <Text style={styles.wageBtnText}>+</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Minatori</Text>
          <Text style={styles.infoMuted}>
            {minatori.length}/{Math.max(miniera.capacità ?? 0, CAPACITA_MINIERA)} posti occupati. I disoccupati vengono assunti solo quando raggiungono fisicamente la Miniera sulla mappa.
          </Text>
        </View>

        {minatori.length === 0 ? (
          <Text style={styles.empty}>Nessun Minatore assegnato.</Text>
        ) : (
          <View style={styles.grid}>
            {minatori.map((a) => (
              <View key={a.id} style={styles.personCard}>
                <AbitanteAvatarPreview abitante={a} />
                <Text style={styles.personName}>{a.nome}</Text>
                <Text style={styles.personMeta}>
                  {a.lavoro} · Competenza {a.competenza}%
                </Text>
                <Text style={styles.harvest}>
                  {a.ultimoRaccoltoMiniera?.voci?.length
                    ? `Ultimo estratto: ${etichettaRaccoltoMiniera(a.ultimoRaccoltoMiniera.voci)}`
                    : "Nessuna estrazione registrata"}
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
  production: { color: "#4ade80", fontSize: 13, fontWeight: "800", marginTop: 7 },
  wageRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  wageBtn: { backgroundColor: "#334155", borderRadius: 6, paddingHorizontal: 14, paddingVertical: 7 },
  wageBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  wageValue: { color: "#e2e8f0", fontSize: 12, fontWeight: "700" },
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
