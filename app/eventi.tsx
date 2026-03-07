import React from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { esisteCoppiaMatrimonioPossibile } from "../src/game/avanzaMese";

const MATRIMONIO_DESC_POSSIBILE =
  "Una coppia con amicizia ≥90 e compatibile (orientamento/sesso) può chiedere di sposarsi allo Skip Mese.";
const MATRIMONIO_DESC_NON_PRONTO =
  "Quando una coppia avrà amicizia ≥90 e sarà compatibile (orientamento/sesso), potrà chiedere di sposarsi allo Skip Mese.";

const NASCITA_DESC_POSSIBILE =
  "Le coppie sposate possono concepire (Legge sulle Nascite ≠ Nessuna). Dopo 9 mesi nasce un figlio; avviso quando qualcuna è incinta.";
const NASCITA_DESC_NON_POSSIBILE =
  "Attiva una politica sulle nascite (Legge sulle Nascite) e avere coppie sposate per poter avere nuove nascite.";

function esisteCoppiaSposata(abitanti: { coniugeId?: number }[]): boolean {
  return abitanti.some((a) => a.coniugeId != null);
}

export default function EventiScreen() {
  const router = useRouter();
  const { abitanti, eventiInCorso, eventiCatalogo, pendingAssimilazione, accettaAssimilazione, rifiutaAssimilazione, politicaNascite, tipologieFamigliaAccettate } = useGameContext();
  const puòMatrimonio = esisteCoppiaMatrimonioPossibile(abitanti, tipologieFamigliaAccettate);
  const incinte = abitanti.filter((a) => a.incinta === true);
  const nascitaInCorso = incinte.length > 0;
  const nascitaPossibile = !nascitaInCorso && politicaNascite !== "nessuna" && esisteCoppiaSposata(abitanti);

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const idsInCorso = new Set(eventiInCorso.map((e) => e.id));
  const inCorso = eventiCatalogo.filter((e) => idsInCorso.has(e.id));
  const possibili = eventiCatalogo.filter((e) => !idsInCorso.has(e.id));
  const matrimonioCard = {
    id: "matrimonio",
    nome: "Matrimonio",
    emoji: "💒",
    descrizione: puòMatrimonio ? MATRIMONIO_DESC_POSSIBILE : MATRIMONIO_DESC_NON_PRONTO
  };
  const nascitaCard = {
    id: "nascita",
    nome: "Nascita",
    emoji: "👶",
    descrizione: nascitaInCorso
      ? incinte.length === 1
        ? `${incinte[0].nome} è incinta. Parto tra 9 mesi dall'inizio gravidanza.`
        : `${incinte.map((a) => a.nome).join(", ")} sono incinte. Parto tra 9 mesi dall'inizio gravidanza.`
      : nascitaPossibile
        ? NASCITA_DESC_POSSIBILE
        : NASCITA_DESC_NON_POSSIBILE
  };
  const inCorsoConNascita = nascitaInCorso ? [nascitaCard, ...inCorso] : inCorso;
  const possibiliConMatrimonioENascita = nascitaPossibile ? [matrimonioCard, nascitaCard, ...possibili] : [matrimonioCard, ...possibili];

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>📌 Eventi</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          Eventi possibili o in corso nella colonia. Qui trovi il catalogo degli eventi che possono verificarsi o che sono attivi.
        </Text>

        {pendingAssimilazione != null && pendingAssimilazione > 0 && (
          <View style={styles.assimilazioneBanner}>
            <Text style={styles.assimilazioneTitle}>🤝 Assimilazione</Text>
            <Text style={styles.assimilazioneText}>
              Alcuni nativi ({pendingAssimilazione}) vogliono aggiungersi alla colonia. Vuoi accettarli?
            </Text>
            <View style={styles.assimilazioneButtons}>
              <Pressable style={[styles.assimilazioneBtn, styles.assimilazioneBtnAccetta]} onPress={accettaAssimilazione}>
                <Text style={styles.assimilazioneBtnText}>Accetta</Text>
              </Pressable>
              <Pressable style={[styles.assimilazioneBtn, styles.assimilazioneBtnRifiuta]} onPress={rifiutaAssimilazione}>
                <Text style={styles.assimilazioneBtnText}>Rifiuta</Text>
              </Pressable>
            </View>
          </View>
        )}

        {inCorsoConNascita.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>In corso ({inCorsoConNascita.length})</Text>
            <View style={styles.grid}>
              {inCorsoConNascita.map((e) => (
                <View key={e.id} style={[styles.card, styles.cardInCorso]}>
                  <Text style={styles.emoji}>{e.emoji}</Text>
                  <View style={styles.badgeInCorso}>
                    <Text style={styles.badgeText}>In corso</Text>
                  </View>
                  <Text style={styles.cardTitle}>{e.nome}</Text>
                  <Text style={styles.cardDesc} numberOfLines={3}>
                    {e.descrizione}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Possibili ({possibiliConMatrimonioENascita.length})</Text>
          <View style={styles.grid}>
            {possibiliConMatrimonioENascita.map((e) => (
              <View key={e.id} style={styles.card}>
                <Text style={styles.emoji}>{e.emoji}</Text>
                <View style={styles.badgePossibile}>
                  <Text style={styles.badgeText}>Possibile</Text>
                </View>
                <Text style={styles.cardTitle}>{e.nome}</Text>
                <Text style={styles.cardDesc} numberOfLines={3}>
                  {e.descrizione}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      </View>
      <View style={styles.footer}>
        <Text style={styles.back} onPress={() => router.back()}>← Home</Text>
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
  content: { paddingHorizontal: 12, paddingVertical: 6, paddingBottom: 8, flex: 1 },
  subtitle: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 12
  },
  section: { marginBottom: 14 },
  sectionTitle: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    width: "48%",
    minWidth: 160
  },
  cardInCorso: {
    borderColor: "#f59e0b",
    backgroundColor: "rgba(245,158,11,0.08)"
  },
  emoji: { fontSize: 26, marginBottom: 4 },
  badgePossibile: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(148,163,184,0.25)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4
  },
  badgeInCorso: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(245,158,11,0.3)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4
  },
  badgeText: { color: "#e5e7eb", fontSize: 9, fontWeight: "700" },
  cardTitle: { color: "#e5e7eb", fontSize: 12, fontWeight: "700", marginBottom: 4 },
  cardDesc: { color: "rgba(203,213,245,0.7)", fontSize: 10, lineHeight: 14 },
  assimilazioneBanner: {
    backgroundColor: "rgba(34,197,94,0.12)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.5)"
  },
  assimilazioneTitle: { color: "#22c55e", fontSize: 13, fontWeight: "700", marginBottom: 6 },
  assimilazioneText: { color: "#e5e7eb", fontSize: 11, marginBottom: 10, lineHeight: 16 },
  assimilazioneButtons: { flexDirection: "row", gap: 8 },
  assimilazioneBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, minWidth: 80, alignItems: "center" },
  assimilazioneBtnAccetta: { backgroundColor: "#22c55e" },
  assimilazioneBtnRifiuta: { backgroundColor: "rgba(148,163,184,0.4)", borderWidth: 1, borderColor: "rgba(148,163,184,0.6)" },
  assimilazioneBtnText: { color: "#ffffff", fontSize: 11, fontWeight: "700" }
});
