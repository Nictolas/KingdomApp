import React from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { fazioniData } from "../src/kingdomData";
import type { Fazione } from "../src/types";

/** Colonne tematiche: nome colonna + nomi fazioni (come in fazioniData). */
const COLONNA_GOVERNO = ["Amministrazione", "Cittadini", "Lealisti", "Sicurezza", "Rivoluzionari", "Élite"];
const COLONNA_LAVORO = ["Lavoratori", "Scienziati", "Esploratori", "Intellettuali", "Ambientalisti"];
const COLONNA_MARGINI = ["Mafia", "Schiavi", "Nativi", "Golem", "Senzatetto", "Immigrati"];

/** Path per ogni fazione: pagina dedicata o /fazione/[slug]. */
const FAZIONE_TO_PATH: Record<string, string> = {
  Amministrazione: "/castello",
  Cittadini: "/fazione/cittadini",
  Lealisti: "/fazione/lealisti",
  Sicurezza: "/sicurezza",
  Rivoluzionari: "/rivoluzionari",
  "Élite": "/fazione/elite",
  Lavoratori: "/fazione/lavoratori",
  Scienziati: "/fazione/scienziati",
  Esploratori: "/fazione/esploratori",
  Intellettuali: "/fazione/intellettuali",
  Ambientalisti: "/fazione/ambientalisti",
  Mafia: "/mafia",
  Schiavi: "/schiavi",
  Nativi: "/nativi",
  Golem: "/fazione/robots",
  Senzatetto: "/fazione/senzatetto",
  Immigrati: "/fazione/immigrati"
};

function getFazioniPerColonna(nomi: string[]): Fazione[] {
  return nomi
    .map((nome) => fazioniData.find((f) => f.nome === nome))
    .filter((f): f is Fazione => f != null);
}

function getPathForFazione(f: Fazione): string {
  return FAZIONE_TO_PATH[f.nome] ?? `/fazione/${f.nome.toLowerCase().replace(/\s+/g, "-").replace(/[èé]/gi, "e")}`;
}

export default function FazioniScreen() {
  const router = useRouter();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const governo = getFazioniPerColonna(COLONNA_GOVERNO);
  const lavoro = getFazioniPerColonna(COLONNA_LAVORO);
  const margini = getFazioniPerColonna(COLONNA_MARGINI);

  const renderColumn = (title: string, subtitle: string, fazioniCol: Fazione[]) => (
    <View key={title} style={styles.column}>
      <Text style={styles.columnTitle}>{title}</Text>
      <Text style={styles.columnSubtitle}>{subtitle}</Text>
      <View style={styles.cardGrid}>
        {fazioniCol.map((f) => (
          <Pressable
            key={f.id}
            style={styles.card}
            onPress={() => router.push(getPathForFazione(f))}
          >
            <Text style={styles.emoji}>{f.emoji}</Text>
            <Text style={styles.cardTitle}>{f.nome}</Text>
            <Text style={styles.cardDescrizione} numberOfLines={2}>
              {f.descrizione}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>Fazioni</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.content}
        style={isDesktop ? styles.scrollFlex : undefined}
      >
        <View style={styles.columns}>
          {renderColumn("Governo e società", "Amministrazione, Cittadini, Lealisti, Sicurezza, Rivoluzionari, Élite", governo)}
          {renderColumn("Lavoro e professione", "Lavoratori, Scienziati, Esploratori, Intellettuali, Ambientalisti", lavoro)}
          {renderColumn("Margini e coercizione", "Mafia, Schiavi, Nativi, Golem, Senzatetto, Immigrati", margini)}
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
    paddingVertical: 10,
    paddingBottom: 12,
    flex: 1
  },
  scrollFlex: {
    flex: 1
  },
  columns: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20
  },
  column: {
    minWidth: 180,
    flex: 1
  },
  columnTitle: {
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2
  },
  columnSubtitle: {
    color: "rgba(148,163,184,0.8)",
    fontSize: 9,
    marginBottom: 8
  },
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    alignItems: "center",
    minWidth: 120,
    flex: 1
  },
  emoji: {
    fontSize: 28,
    marginBottom: 4
  },
  cardTitle: {
    color: "#e5e7eb",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2,
    textAlign: "center"
  },
  cardDescrizione: {
    color: "#cbd5f5",
    fontSize: 9,
    textAlign: "center"
  }
});
