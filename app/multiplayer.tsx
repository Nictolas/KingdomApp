import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import {
  LanP2PSession,
  type ConnectionSnapshot
} from "../src/multiplayer/lanSession";
import { createNativeLanSession } from "../src/multiplayer/nativeTransport";

type Mode = "choose" | "host" | "guest";
const EMPTY: ConnectionSnapshot = {
  state: "idle",
  role: null,
  sessionId: null,
  otherPeerId: null,
  lastPong: null,
  error: null
};

const stateLabels: Record<ConnectionSnapshot["state"], string> = {
  idle: "Pronto",
  signaling: "Preparazione del collegamento",
  waiting: "In attesa dell'altro telefono",
  connected: "Collegato",
  disconnected: "Disconnesso",
  error: "Errore di collegamento"
};

/** Collega soltanto i dispositivi. Non invia salvataggi o merci. */
export default function MultiplayerScreen() {
  const router = useRouter();
  const sessionRef = useRef<LanP2PSession | null>(null);
  const [mode, setMode] = useState<Mode>("choose");
  const [snapshot, setSnapshot] = useState<ConnectionSnapshot>(EMPTY);
  const [outgoing, setOutgoing] = useState("");
  const [incoming, setIncoming] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const mobile = Platform.OS === "android" || Platform.OS === "ios";

  useEffect(() => {
    if (!mobile) return;
    try {
      sessionRef.current = createNativeLanSession(setSnapshot);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Modulo WebRTC non disponibile.");
    }
    return () => {
      sessionRef.current?.close();
      sessionRef.current = null;
    };
  }, [mobile]);

  async function perform(fn: (session: LanP2PSession) => Promise<void>) {
    if (working) return;
    const session = sessionRef.current;
    if (!session) {
      setError("WebRTC nativo non disponibile: occorre una build Android/iPhone che includa il modulo.");
      return;
    }
    setWorking(true);
    setError("");
    setNote("");
    try {
      await fn(session);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Connessione non riuscita.");
    } finally {
      setWorking(false);
    }
  }

  function restart() {
    sessionRef.current?.close();
    setMode("choose");
    setOutgoing("");
    setIncoming("");
    setError("");
    setNote("");
  }

  async function shareCode() {
    if (!outgoing) return;
    try {
      await Share.share({ message: outgoing, title: "My Kingdom — codice P2P" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossibile condividere il codice.");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>← Mercato</Text>
        </Pressable>
        <Text style={styles.heading}>Scambi fra giocatori</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          Collega direttamente due telefoni Android o iPhone alla stessa rete Wi-Fi.
          Non sono richiesti account, database o server di collegamento.
        </Text>
        <Text style={styles.warning}>
          Prima fase: prova di connessione. Lo scambio di merci non è ancora attivo.
          I codici possono contenere informazioni sulla rete: condividili solo con un amico fidato.
        </Text>
        {!mobile ? (
          <View style={styles.card}>
            <Text style={styles.body}>Il multiplayer è disponibile soltanto nell'app Android o iPhone.</Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.subheading}>Stato: {stateLabels[snapshot.state]}</Text>
              {snapshot.otherPeerId && (
                <Text style={styles.success}>Canale dati aperto con l'altro telefono.</Text>
              )}
              {snapshot.lastPong !== null && (
                <Text style={styles.success}>Test di risposta ricevuta: {snapshot.lastPong}</Text>
              )}
              {snapshot.error && <Text style={styles.danger}>{snapshot.error}</Text>}
              {error && <Text style={styles.danger}>{error}</Text>}
              {note && <Text style={styles.success}>{note}</Text>}
              {working && <ActivityIndicator color="#c4b5fd" />}
            </View>

            {mode === "choose" && (
              <View style={styles.card}>
                <Text style={styles.subheading}>Come vuoi collegarti?</Text>
                <Pressable
                  style={styles.primary}
                  disabled={working}
                  onPress={() => {
                    setMode("host");
                    void perform(async session => {
                      setOutgoing(await session.host());
                      setNote("Invia il codice al secondo giocatore e fatti mandare la risposta.");
                    });
                  }}
                >
                  <Text style={styles.buttonText}>Invita un giocatore</Text>
                </Pressable>
                <Pressable
                  style={styles.secondary}
                  disabled={working}
                  onPress={() => setMode("guest")}
                >
                  <Text style={styles.buttonText}>Ho ricevuto un invito</Text>
                </Pressable>
              </View>
            )}

            {mode === "host" && (
              <View style={styles.card}>
                <Text style={styles.subheading}>1. Condividi l'invito</Text>
                {outgoing ? (
                  <>
                    <TextInput
                      accessibilityLabel="Codice di invito WebRTC da condividere"
                      style={[styles.input, styles.codeInput]}
                      multiline
                      value={outgoing}
                      editable={false}
                      selectTextOnFocus
                    />
                    <Pressable style={styles.primary} onPress={() => void shareCode()}>
                      <Text style={styles.buttonText}>Condividi l'invito</Text>
                    </Pressable>
                    <Text style={styles.subheading}>2. Incolla la risposta dell'amico</Text>
                    <TextInput
                      accessibilityLabel="Risposta ricevuta dal secondo telefono"
                      style={[styles.input, styles.codeInput]}
                      multiline
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={incoming}
                      onChangeText={setIncoming}
                      placeholder="Incolla qui il codice MKP2P1 ricevuto..."
                      placeholderTextColor="#94a3b8"
                    />
                    <Pressable
                      style={styles.primary}
                      disabled={!incoming.trim() || working || snapshot.state === "connected"}
                      onPress={() => void perform(async session => {
                        await session.acceptAnswer(incoming);
                        setNote("Risposta accettata: collegamento diretto in corso.");
                      })}
                    >
                      <Text style={styles.buttonText}>Completa il collegamento</Text>
                    </Pressable>
                  </>
                ) : (
                  <Text style={styles.body}>Preparazione dell'invito. Se compare un errore, ricomincia.</Text>
                )}
              </View>
            )}

            {mode === "guest" && (
              <View style={styles.card}>
                <Text style={styles.subheading}>1. Incolla l'invito</Text>
                <TextInput
                  accessibilityLabel="Invito ricevuto dall'altro telefono"
                  style={[styles.input, styles.codeInput]}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={incoming}
                  onChangeText={setIncoming}
                  placeholder="Incolla qui il codice MKP2P1 ricevuto..."
                  placeholderTextColor="#94a3b8"
                />
                <Pressable
                  style={styles.primary}
                  disabled={!incoming.trim() || working || !!outgoing}
                  onPress={() => void perform(async session => {
                    setOutgoing(await session.join(incoming));
                    setNote("Invia la risposta all'amico che ha creato l'invito.");
                  })}
                >
                  <Text style={styles.buttonText}>Genera la risposta</Text>
                </Pressable>
                {!!outgoing && (
                  <>
                    <Text style={styles.subheading}>2. Condividi la risposta</Text>
                    <TextInput
                      accessibilityLabel="Codice risposta da condividere"
                      style={[styles.input, styles.codeInput]}
                      multiline
                      value={outgoing}
                      editable={false}
                      selectTextOnFocus
                    />
                    <Pressable style={styles.primary} onPress={() => void shareCode()}>
                      <Text style={styles.buttonText}>Condividi la risposta</Text>
                    </Pressable>
                  </>
                )}
              </View>
            )}

            {snapshot.state === "connected" && (
              <View style={styles.card}>
                <Text style={styles.subheading}>Collegamento riuscito</Text>
                <Text style={styles.body}>
                  I due dispositivi possono comunicare direttamente tramite WebRTC.
                  Nessuna risorsa viene trasferita in questa fase.
                </Text>
                <Pressable
                  style={styles.primary}
                  onPress={() => {
                    try {
                      sessionRef.current?.ping(Date.now());
                      setNote("Test inviato: verifica la risposta qui sopra.");
                    } catch (cause) {
                      setError(cause instanceof Error ? cause.message : "Test non riuscito.");
                    }
                  }}
                >
                  <Text style={styles.buttonText}>Verifica la connessione (ping)</Text>
                </Pressable>
              </View>
            )}
            {mode !== "choose" && (
              <Pressable style={styles.secondary} onPress={restart}>
                <Text style={styles.buttonText}>Interrompi e ricomincia</Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#080c1a" },
  header: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderBottomWidth: 1, borderBottomColor: "#334155" },
  back: { color: "#c4b5fd", fontSize: 14 },
  heading: { color: "#f8fafc", fontSize: 17, fontWeight: "700", flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 12, maxWidth: 720, width: "100%", alignSelf: "center" },
  intro: { color: "#e2e8f0", fontSize: 15, lineHeight: 22 },
  warning: { color: "#fbbf24", fontSize: 13, lineHeight: 20 },
  card: { padding: 14, backgroundColor: "#101b30", borderRadius: 12, gap: 12 },
  subheading: { color: "#f8fafc", fontSize: 16, fontWeight: "700" },
  body: { color: "#cbd5e1", lineHeight: 21, fontSize: 14 },
  success: { color: "#86efac", lineHeight: 20, fontSize: 13 },
  danger: { color: "#fca5a5", lineHeight: 20, fontSize: 13 },
  input: { color: "#f8fafc", backgroundColor: "#0b1324", borderColor: "#475569", borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14 },
  codeInput: { height: 110, textAlignVertical: "top" },
  primary: { borderRadius: 9, paddingVertical: 13, paddingHorizontal: 14, alignItems: "center", backgroundColor: "#5b21b6" },
  secondary: { borderRadius: 9, paddingVertical: 13, paddingHorizontal: 14, alignItems: "center", backgroundColor: "#334155" },
  buttonText: { color: "#ffffff", fontSize: 14, fontWeight: "700" }
});
