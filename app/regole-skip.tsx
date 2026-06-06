import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

/** Elenco di ciò che succede quando si fa Skip Mese (derivato da avanzaMese.ts e useGameState). */
const REGOLE_SKIP: { titolo: string; punti: string[] }[] = [
  {
    titolo: "Emigrazione",
    punti: [
      "Abitanti con felicità (modificata) ≤ 10% e crediti ≥ 100 hanno 50% di probabilità di lasciare la colonia.",
      "Non si applica se è attivo il divieto di espatrio."
    ]
  },
  {
    titolo: "Omicidi per rivalità",
    punti: [
      "Per ogni coppia di rivali con punteggio ≥ 90 (o ≥ 60 se uno dei due è Psicopatico), c’è 50% di probabilità che uno uccida l’altro.",
      "Le vittime vengono rimosse dalla colonia.",
      "Vengono puliti i riferimenti ai morti (amici, rivali, coniuge, figli, genitori, nonni) e le assegnazioni agli edifici.",
      "Se ci sono vittime, viene mostrato un alert con il nome."
    ]
  },
  {
    titolo: "Rapporti Amicizia / Rivalità",
    punti: [
      "Coppie di abitanti assegnati allo stesso edificio (qualsiasi edificio) che non hanno già un rapporto sviluppano in modo casuale Amicizia o Rivalità con punteggio iniziale 10.",
      "Ogni Skip Mese ogni rapporto (amicizia o rivalità) varia di un punteggio casuale da -10 a +10.",
      "Se il punteggio raggiunge 0 o inferiore, il rapporto si trasforma: amicizia diventa rivalità e viceversa, con nuovo punteggio 10."
    ]
  },
  {
    titolo: "Matrimonio",
    punti: [
      "Se due abitanti hanno Amicizia ≥ 90 e sono compatibili (orientamento/sesso), appare l’alert «X e Y vogliono sposarsi. Glielo concedi?». Sì: vengono impostati come coniugi; No: nulla.",
      "Compatibilità: Omo solo con Omo o Bi dello stesso sesso; Etero con Etero o Bi del sesso opposto; Bi con Etero, Omo o Bi di qualunque sesso."
    ]
  },
  {
    titolo: "Aggiornamento abitanti",
    punti: [
      "Casta coercibile (Schiavo, Servo della gleba): crediti e spese restano 0; stanchezza + random 0–9; peso e salute ±2 (entro 0–100).",
      "Schiavi privati che lavorano: il reddito va al padrone (non al bilancio colonia).",
      "Altri abitanti: crediti = crediti + reddito − spese (reddito = 0 se Disoccupato, salvo reddito di cittadinanza); stanchezza + random 0–9; peso e salute ±2 (entro 0–100).",
      "Omicidio per rivalità: genera reato «Omicidio» salvo se la vittima è schiavo del killer (o Servo della gleba ucciso dal Comandante)."
    ]
  },
  {
    titolo: "Aggiornamento edifici",
    punti: [
      "Ogni edificio operativo ha efficienza che varia di ±2 (limitata tra 50 e 100)."
    ]
  },
  {
    titolo: "Risorse – Crediti",
    punti: [
      "Crediti colonia = crediti precedenti + (somma redditi di tutti gli abitanti) − (somma spese) − (somma manutenzione edifici operativi)."
    ]
  },
  {
    titolo: "Risorse – Produzione edifici",
    punti: [
      "Ogni edificio operativo con produzione: se produce Cibo, si usa getProduzioneCiboPerAbitante per ogni abitante assegnato (10–20 razioni/abitante); per altre risorse si usa la produttività media degli assegnati.",
      "Se c’è un ministro «Ministero dell’Agricoltura» con personalità Pollice Verde, la produzione di cibo riceve +10%."
    ]
  },
  {
    titolo: "Risorse – Consumo edifici",
    punti: [
      "Ogni edificio operativo con consumo sottrae risorse in base a efficienza/20 e occupazione/capacità."
    ]
  },
  {
    titolo: "Risorse – Consumo cibo abitanti",
    punti: [
      "Ogni abitante consuma razioni di cibo in base alla categoria di peso: Denutrito 0–5, Normopeso 6–10, Sovrappeso 11–15, Obeso 16–20 razioni/mese."
    ]
  },
  {
    titolo: "Nativi non integrati",
    punti: [
      "Il contatore dei nativi non integrati aumenta di 0–5 (valore casuale)."
    ]
  },
  {
    titolo: "Calendario",
    punti: [
      "Mese avanza (1→2 … 12→1); se il mese passa da 12 a 1, aumenta l’anno."
    ]
  },
  {
    titolo: "Eventi in corso",
    punti: [
      "Gli eventi scaduti (durata trascorsa) vengono rimossi.",
      "Per ogni evento ancora in corso viene applicato l’effetto mensile (applicaMensile)."
    ]
  },
  {
    titolo: "Nuovi eventi",
    punti: [
      "Per ogni tipo di evento non già in corso: se la condizione è vera e un random supera la probabilità, l’evento si attiva (applicaAttivazione) e viene aggiunto alla lista con durata definita."
    ]
  },
  {
    titolo: "Assimilazione",
    punti: [
      "Se l’evento Assimilazione è appena attivato (felicità media > 80%), viene impostato un numero di nativi da accettare/rifiutare (1–3); la scelta si fa dalla pagina Eventi."
    ]
  },
  {
    titolo: "Ordini mercato",
    punti: [
      "Tutti gli ordini di acquisto/vendita inseriti nel Mercato vengono eseguiti: acquisti sottraggono crediti e aggiungono risorse, vendite sottraggono risorse e aggiungono crediti.",
      "Dopo l’esecuzione la lista ordini viene svuotata."
    ]
  },
  {
    titolo: "Dopo lo Skip",
    punti: [
      "Vengono generati nuovi candidati immigrati (abitantiProposti) per la pagina Immigrazione."
    ]
  }
];

export default function RegoleSkipScreen() {
  const router = useRouter();
  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>⏭️ Regole Skip</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={true}>
        <Text style={styles.intro}>
          Quando premi «Skip Mese» vengono applicate, in ordine, le seguenti regole. L’elenco riflette la logica in avanzaMese.ts e nel contesto di gioco.
        </Text>

        <View style={[styles.griglia, isDesktop && styles.grigliaDesktop]}>
          {REGOLE_SKIP.map((sezione) => (
            <View key={sezione.titolo} style={styles.sezione}>
              <Text style={styles.sezioneTitolo}>{sezione.titolo}</Text>
              {sezione.punti.map((punto, idx) => (
                <View key={idx} style={styles.punto}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.puntoTesto}>{punto}</Text>
                </View>
              ))}
            </View>
          ))}
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
    padding: 20,
    paddingBottom: 32,
    flexGrow: 1
  },
  intro: {
    color: "rgba(203,213,245,0.9)",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 24,
    maxWidth: 720
  },
  griglia: {
    flexDirection: "column",
    gap: 0
  },
  grigliaDesktop: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
    justifyContent: "flex-start"
  },
  sezione: {
    marginBottom: 20,
    padding: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.3)",
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    minWidth: 260,
    flex: 1,
    flexBasis: "31%",
    maxWidth: 380
  },
  sezioneTitolo: {
    color: "#93c5fd",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  punto: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8
  },
  bullet: {
    color: "#93c5fd",
    fontSize: 12,
    marginRight: 8
  },
  puntoTesto: {
    color: "#e5e7eb",
    fontSize: 12,
    flex: 1,
    lineHeight: 18
  }
});
