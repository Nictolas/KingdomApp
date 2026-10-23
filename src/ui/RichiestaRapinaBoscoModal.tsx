import React, { useEffect, useState } from "react";
import {
  Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View
} from "react-native";
import { parereConsiglierePerRapina, type RichiestaRisarcimentoBanditi } from "../game/banditiBosco";

export function RichiestaRapinaBoscoModal(props: {
  richiesta: RichiestaRisarcimentoBanditi;
  nomeVittima: string;
  nomeConsigliere: string | null;
  moneteTesoro: number;
  onRisarcisci: () => void;
  onIgnora: () => void;
}) {
  const [mostraConsiglio, setMostraConsiglio] = useState(false);
  const { richiesta, nomeConsigliere, nomeVittima, moneteTesoro } = props;
  useEffect(() => setMostraConsiglio(false), [richiesta.id]);
  const consiglio = parereConsiglierePerRapina(richiesta);
  const sufficiente = moneteTesoro >= richiesta.dannoMonete;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={() => {
      if (mostraConsiglio) setMostraConsiglio(false);
    }}>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.card}>
          <ScrollView contentContainerStyle={styles.body}>
            {mostraConsiglio ? (
              <>
                <Text style={styles.heading}>🧙 Parere del Consigliere</Text>
                <Text style={styles.speaker}>{nomeConsigliere}</Text>
                <Text style={styles.text}>Maestà, ecco le conseguenze possibili:</Text>
                <Text style={styles.option}>Se risarcisci</Text>
                <Text style={styles.text}>{consiglio.risarcisci}</Text>
                <Text style={styles.option}>Se ignori</Text>
                <Text style={styles.text}>{consiglio.ignora}</Text>
                <Text style={styles.note}>
                  Le reazioni possono variare. La decisione resta interamente vostra.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.heading}>🏰 Udienza al Castello</Text>
                <Text style={styles.speaker}>{nomeVittima}</Text>
                <Text style={styles.text}>
                  «Maestà, mentre lavoravo nel Bosco sono stato derubato.
                  Vi chiedo un risarcimento di {richiesta.dannoMonete} monete.»
                </Text>
                <Text style={styles.note}>
                  Tesoro reale: {moneteTesoro} monete. Il Consigliere può spiegare
                  le conseguenze senza decidere al vostro posto.
                </Text>
              </>
            )}
          </ScrollView>
          <View style={styles.actions}>
            {mostraConsiglio ? (
              <Pressable accessibilityRole="button" style={styles.button}
                onPress={() => setMostraConsiglio(false)}>
                <Text style={styles.buttonText}>← Torna all'udienza</Text>
              </Pressable>
            ) : (
              <>
                <Pressable accessibilityRole="button"
                  accessibilityLabel="Chiedi al consigliere, aiuto sulle due scelte"
                  disabled={!nomeConsigliere}
                  style={[styles.button, !nomeConsigliere && styles.disabled]}
                  onPress={() => setMostraConsiglio(true)}>
                  <Text style={styles.buttonText}>❔ Chiedi al consigliere</Text>
                </Pressable>
                {!nomeConsigliere && (
                  <Text style={styles.note}>
                    Nessun Consigliere in carica. Puoi nominarne subito un altro.
                  </Text>
                )}
                <Pressable accessibilityRole="button"
                  disabled={!sufficiente}
                  style={[styles.button, styles.accept, !sufficiente && styles.disabled]}
                  onPress={props.onRisarcisci}>
                  <Text style={styles.buttonText}>
                    Risarcisci ({richiesta.dannoMonete} monete)
                  </Text>
                </Pressable>
                {!sufficiente && <Text style={styles.note}>Tesoro insufficiente per risarcire.</Text>}
                <Pressable accessibilityRole="button"
                  style={[styles.button, styles.ignore]}
                  onPress={props.onIgnora}>
                  <Text style={styles.buttonText}>Ignora la richiesta</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(5,10,22,0.93)",
    alignItems: "center", justifyContent: "center", padding: 15
  },
  card: {
    width: "100%", maxWidth: 500, maxHeight: "95%",
    backgroundColor: "#111e30", borderRadius: 18,
    borderColor: "#486080", borderWidth: 1, overflow: "hidden"
  },
  body: { gap: 14, padding: 20 },
  heading: { fontSize: 20, color: "#f4edd8", fontWeight: "800", textAlign: "center" },
  speaker: { fontSize: 16, color: "#a5cefc", fontWeight: "700", textAlign: "center" },
  text: { color: "#e5edf8", fontSize: 15, lineHeight: 24 },
  option: { color: "#f0d28b", fontSize: 15, fontWeight: "700" },
  note: { color: "#aabbd1", fontSize: 12, lineHeight: 20 },
  actions: { paddingHorizontal: 20, paddingVertical: 14, gap: 10,
    borderTopColor: "#35475e", borderTopWidth: 1 },
  button: { backgroundColor: "#34557f", paddingVertical: 13,
    borderRadius: 9, alignItems: "center" },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  accept: { backgroundColor: "#18664f" },
  ignore: { backgroundColor: "#67373a" },
  disabled: { opacity: 0.4 }
});
