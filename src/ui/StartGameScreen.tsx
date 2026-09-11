import React, { useState } from "react";
import { ActivityIndicator, Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

export type ModalitaGiocoScelta = "creativa" | "avventura";

type Props = {
  loading: boolean;
  hasSave: boolean;
  error: string | null;
  /** Testo sotto lo spinner (es. caricamento personaggi). */
  loadingLabel?: string | null;
  onContinue: () => void;
  onNewGame: (modalita: ModalitaGiocoScelta) => void;
};

export function StartGameScreen({
  loading,
  hasSave,
  error,
  loadingLabel,
  onContinue,
  onNewGame
}: Props) {
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [modalitaVisible, setModalitaVisible] = useState(false);

  const handleNewGame = () => {
    if (hasSave) {
      setConfirmationVisible(true);
      return;
    }
    setModalitaVisible(true);
  };

  const confirmNewGame = () => {
    setConfirmationVisible(false);
    setModalitaVisible(true);
  };

  const scegliModalita = (modalita: ModalitaGiocoScelta) => {
    setModalitaVisible(false);
    onNewGame(modalita);
  };

  return (
    <>
      <SafeAreaView style={styles.safe}>
        <View style={styles.card}>
          <Text style={styles.title}>MyKingdom</Text>
          <Text style={styles.subtitle}>Regno Medievale Fantasy</Text>
          {loading ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator color="#93c5fd" />
              {loadingLabel ? <Text style={styles.loadingLabel}>{loadingLabel}</Text> : null}
            </View>
          ) : (
            <>
              {hasSave && (
                <Pressable style={styles.primary} onPress={onContinue}>
                  <Text style={styles.buttonText}>Continua</Text>
                </Pressable>
              )}
              <Pressable style={styles.secondary} onPress={handleNewGame}>
                <Text style={styles.buttonText}>Nuova partita</Text>
              </Pressable>
            </>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      </SafeAreaView>

      <Modal
        animationType="fade"
        transparent
        visible={confirmationVisible}
        onRequestClose={() => setConfirmationVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmationCard} accessibilityRole="alert">
            <Text style={styles.confirmationTitle}>Creare una nuova partita?</Text>
            <Text style={styles.confirmationText}>
              La partita salvata verrà eliminata e sostituita dalla nuova avventura.
            </Text>
            <View style={styles.confirmationActions}>
              <Pressable style={styles.cancelButton} onPress={() => setConfirmationVisible(false)}>
                <Text style={styles.buttonText}>Annulla</Text>
              </Pressable>
              <Pressable style={styles.destructiveButton} onPress={confirmNewGame}>
                <Text style={styles.buttonText}>Crea nuova partita</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={modalitaVisible}
        onRequestClose={() => setModalitaVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmationCard}>
            <Text style={styles.confirmationTitle}>Modalità di gioco</Text>
            <Text style={styles.confirmationText}>
              Scegli come vuoi giocare. Potrai cambiare modalità anche in seguito.
            </Text>

            <Pressable style={styles.modalitaBtn} onPress={() => scegliModalita("creativa")}>
              <Text style={styles.modalitaEmoji}>🎨</Text>
              <View style={styles.modalitaTesto}>
                <Text style={styles.modalitaTitolo}>Creativa</Text>
                <Text style={styles.modalitaDesc}>
                  Colonia ricca fin dall&apos;inizio (anche Scuola e Lazzaretto). Nessun blocco, libertà totale.
                </Text>
              </View>
            </Pressable>

            <Pressable style={styles.modalitaBtn} onPress={() => scegliModalita("avventura")}>
              <Text style={styles.modalitaEmoji}>⚔️</Text>
              <View style={styles.modalitaTesto}>
                <Text style={styles.modalitaTitolo}>Avventura</Text>
                <Text style={styles.modalitaDesc}>
                  Pochi abitanti e pochi edifici (Castello, Capanna, Serra, Porto sul mare). Sblocca il resto avanzando.
                </Text>
              </View>
            </Pressable>

            <Pressable style={styles.cancelButtonFull} onPress={() => setModalitaVisible(false)}>
              <Text style={styles.buttonText}>Annulla</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050816", alignItems: "center", justifyContent: "center" },
  card: { width: "88%", maxWidth: 420, padding: 28, gap: 12, borderRadius: 18, backgroundColor: "#0f172a" },
  title: { color: "#fff", fontSize: 32, fontWeight: "800", textAlign: "center" },
  subtitle: { color: "#94a3b8", fontSize: 15, textAlign: "center", marginBottom: 16 },
  loadingBlock: { alignItems: "center", gap: 12, paddingVertical: 8 },
  loadingLabel: { color: "#94a3b8", fontSize: 13, textAlign: "center" },
  primary: { backgroundColor: "#2563eb", padding: 14, borderRadius: 10 },
  secondary: { backgroundColor: "#334155", padding: 14, borderRadius: 10 },
  buttonText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  error: { color: "#fca5a5", textAlign: "center", marginTop: 8 },
  modalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(2, 6, 23, 0.82)"
  },
  confirmationCard: {
    width: "100%",
    maxWidth: 430,
    gap: 16,
    padding: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#475569",
    backgroundColor: "#0f172a"
  },
  confirmationTitle: { color: "#fff", fontSize: 22, fontWeight: "800", textAlign: "center" },
  confirmationText: { color: "#cbd5e1", fontSize: 15, lineHeight: 22, textAlign: "center" },
  confirmationActions: { flexDirection: "row", gap: 10 },
  cancelButton: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: "#334155" },
  cancelButtonFull: { padding: 14, borderRadius: 10, backgroundColor: "#334155" },
  destructiveButton: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: "#b91c1c" },
  modalitaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#475569",
    backgroundColor: "#1e293b"
  },
  modalitaEmoji: { fontSize: 28 },
  modalitaTesto: { flex: 1, gap: 4 },
  modalitaTitolo: { color: "#fff", fontSize: 17, fontWeight: "700" },
  modalitaDesc: { color: "#94a3b8", fontSize: 13, lineHeight: 18 }
});
