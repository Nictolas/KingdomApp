import React from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

type Props = {
  loading: boolean;
  hasSave: boolean;
  error: string | null;
  onContinue: () => void;
  onNewGame: () => void;
};

export function StartGameScreen({ loading, hasSave, error, onContinue, onNewGame }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <Text style={styles.title}>MyKingdom</Text>
        <Text style={styles.subtitle}>Colonia spaziale</Text>
        {loading ? <ActivityIndicator color="#93c5fd" /> : (
          <>
            {hasSave && <Pressable style={styles.primary} onPress={onContinue}><Text style={styles.buttonText}>Continua</Text></Pressable>}
            <Pressable style={styles.secondary} onPress={onNewGame}><Text style={styles.buttonText}>Nuova partita</Text></Pressable>
          </>
        )}
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050816", alignItems: "center", justifyContent: "center" },
  card: { width: "88%", maxWidth: 420, padding: 28, gap: 12, borderRadius: 18, backgroundColor: "#0f172a" },
  title: { color: "#fff", fontSize: 32, fontWeight: "800", textAlign: "center" },
  subtitle: { color: "#94a3b8", fontSize: 15, textAlign: "center", marginBottom: 16 },
  primary: { backgroundColor: "#2563eb", padding: 14, borderRadius: 10 },
  secondary: { backgroundColor: "#334155", padding: 14, borderRadius: 10 },
  buttonText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  error: { color: "#fca5a5", textAlign: "center", marginTop: 8 }
});
