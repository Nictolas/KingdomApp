import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../context/GameContext";
import { isTassaSbloccata, type TassaId } from "../game/tasseSblocco";

type Props = {
  tassaId: TassaId;
  titolo: string;
  children: React.ReactNode;
};

/** Se la tassa non è sbloccata (Avventura), mostra messaggio invece della schermata. */
export function GateTassaSbloccata({ tassaId, titolo, children }: Props) {
  const router = useRouter();
  const { obiettiviCompletati, modalitaGioco } = useGameContext();
  const sbloccata = isTassaSbloccata(tassaId, obiettiviCompletati, modalitaGioco);

  if (sbloccata) return <>{children}</>;

  return (
    <View style={styles.wrap}>
      <Text style={styles.lock}>🔒</Text>
      <Text style={styles.title}>{titolo}</Text>
      <Text style={styles.text}>
        Non ancora sbloccata. Completa l&apos;obiettivo fiscale corrispondente nell&apos;albero Obiettivi
        (oppure attiva la modalità Creativa).
      </Text>
      <Pressable style={styles.btn} onPress={() => router.push("/obiettivi")}>
        <Text style={styles.btnText}>Vai a Obiettivi</Text>
      </Pressable>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Indietro</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: "#050816",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12
  },
  lock: { fontSize: 40 },
  title: { color: "#fff", fontSize: 18, fontWeight: "700", textAlign: "center" },
  text: { color: "#94a3b8", fontSize: 14, textAlign: "center", lineHeight: 20, maxWidth: 360 },
  btn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8
  },
  btnText: { color: "#fff", fontWeight: "700" },
  back: { color: "#93c5fd", marginTop: 8, fontWeight: "600" }
});
