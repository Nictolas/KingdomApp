import React, { useState } from "react";
import { ActivityIndicator, Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

type Props = {
  loading: boolean;
  hasSave: boolean;
  error: string | null;
  confirmNewGame: boolean;
  onContinue: () => void;
  onNewGame: () => void;
  onTrySectors: () => void;
  onTryTerritories: () => void;
};

export function StartGameScreen({
  loading,
  hasSave,
  error,
  confirmNewGame,
  onContinue,
  onNewGame,
  onTrySectors,
  onTryTerritories
}: Props) {
  const [showNewGameConfirmation, setShowNewGameConfirmation] = useState(false);

  const handleNewGamePress = () => {
    if (confirmNewGame) {
      setShowNewGameConfirmation(true);
      return;
    }
    onNewGame();
  };

  const confirmNewGameStart = () => {
    setShowNewGameConfirmation(false);
    onNewGame();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <Text style={styles.title}>MyKingdom</Text>
        <Text style={styles.subtitle}>Regno Medievale Fantasy</Text>
        {loading ? <ActivityIndicator color="#93c5fd" /> : (
          <>
            {hasSave && (
              <Pressable style={styles.primary} onPress={onContinue}>
                <Text style={styles.buttonText}>Continua</Text>
              </Pressable>
            )}
            <Pressable style={styles.secondary} onPress={handleNewGamePress}>
              <Text style={styles.buttonText}>Nuova partita</Text>
            </Pressable>
            <Pressable testID="start-territory-world" accessibilityRole="button"
              style={styles.territoryButton} onPress={onTryTerritories}>
              <Text style={styles.buttonText}>Regno a territori · 32×32</Text>
              <Text style={styles.sectorNote}>Esplora, acquista e conquista nuovi territori. Salvataggio indipendente.</Text>
            </Pressable>
            <Pressable testID="start-sector-mode" accessibilityRole="button" style={styles.sectorButton} onPress={onTrySectors}>
              <Text style={styles.buttonText}>🏘️ Gioca: Regno a settori</Text>
              <Text style={styles.sectorNote}>Prototipo separato: non cancella la partita principale.</Text>
            </Pressable>
          </>
        )}
        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      <Modal
        visible={showNewGameConfirmation}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNewGameConfirmation(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nuova partita</Text>
            <Text style={styles.modalText}>
              La partita salvata verrà sostituita. Vuoi continuare?
            </Text>
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalCancel]}
                onPress={() => setShowNewGameConfirmation(false)}
              >
                <Text style={styles.modalButtonText}>Annulla</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalConfirm]}
                onPress={confirmNewGameStart}
              >
                <Text style={styles.modalButtonText}>Continua</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  territoryButton:{backgroundColor:"#80623b",padding:13,borderRadius:10,borderWidth:1,borderColor:"#d4b078"},
  sectorButton: {backgroundColor:"#166534",padding:13,borderRadius:10,borderWidth:1,borderColor:"#86efac"},
  sectorNote: {color:"#d1fae5",fontSize:11,textAlign:"center",marginTop:4},
  buttonText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  error: { color: "#fca5a5", textAlign: "center", marginTop: 8 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    padding: 22,
    gap: 14
  },
  modalTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center"
  },
  modalText: {
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center"
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10
  },
  modalCancel: {
    backgroundColor: "#334155"
  },
  modalConfirm: {
    backgroundColor: "#b91c1c"
  },
  modalButtonText: {
    color: "#fff",
    fontWeight: "700",
    textAlign: "center"
  }
});
