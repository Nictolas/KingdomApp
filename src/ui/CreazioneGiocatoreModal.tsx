import React, { useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import {
  ASPETTO_GIOCATORE_DEFAULT,
  COLORI_CAPELLI,
  COLORI_PELLE,
  generaAspettoCasuale,
  type AspettoPersonaggio,
  type CappelloPersonaggio,
  type RazzaGiocatore,
  type StileCapelli,
  type StileOcchi,
  type VestitiPersonaggio
} from "../game/personaggioAspetto";
import { DESKTOP_MODAL_BREAKPOINT, modalBackdropFullscreen, modalContentFullscreen } from "./modalFullscreenStyles";
import { PixelAvatarPreview } from "./PixelAvatarPreview";

export type DatiCreazioneGiocatore = {
  nome: string;
  cognome: string;
  sesso: "M" | "F";
  orientamento: "Etero" | "Omo" | "Bi" | "Asessuale";
  razza: RazzaGiocatore;
  aspetto: AspettoPersonaggio;
};

type CreazioneGiocatoreModalProps = {
  visible: boolean;
  onConferma: (dati: DatiCreazioneGiocatore) => void;
};

const GENERI: { id: "M" | "F"; label: string }[] = [
  { id: "M", label: "Uomo" },
  { id: "F", label: "Donna" }
];

const ORIENTAMENTI: { id: "Etero" | "Omo" | "Bi" | "Asessuale"; label: string }[] = [
  { id: "Etero", label: "Eterosessuale" },
  { id: "Omo", label: "Omosessuale" },
  { id: "Bi", label: "Bisessuale" },
  { id: "Asessuale", label: "Asessuale" }
];

const RAZZE: { id: RazzaGiocatore; label: string }[] = [
  { id: "Umano", label: "Umano" }, { id: "Elfo", label: "Elfo · orecchie a punta" },
  { id: "Nano", label: "Nano" }, { id: "Orco", label: "Orco" }
];
const CAPELLI: { id: StileCapelli; label: string }[] = [
  { id: "corti", label: "Corti" }, { id: "spettinati", label: "Spettinati" },
  { id: "lunghi", label: "Lunghi" }, { id: "trecce", label: "Trecce" }
];
const OCCHI: { id: StileOcchi; label: string }[] = [
  { id: "tondi", label: "Tondi" }, { id: "determinati", label: "Determinati" }, { id: "allegri", label: "Allegri" }
];
const VESTITI: { id: VestitiPersonaggio; label: string }[] = [
  { id: "viandante", label: "Viandante" }, { id: "nobile", label: "Nobile" },
  { id: "ranger", label: "Ranger" }, { id: "mago", label: "Mago" }
];
const CAPPELLI: { id: CappelloPersonaggio; label: string }[] = [
  { id: "nessuno", label: "Nessuno" }, { id: "cappuccio", label: "Cappuccio" },
  { id: "berretto", label: "Berretto" }, { id: "corona", label: "Corona" }
];

export function CreazioneGiocatoreModal({ visible, onConferma }: CreazioneGiocatoreModalProps) {
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [sesso, setSesso] = useState<"M" | "F" | null>(null);
  const [orientamento, setOrientamento] = useState<"Etero" | "Omo" | "Bi" | "Asessuale" | null>(null);
  const [razza, setRazza] = useState<RazzaGiocatore>("Umano");
  const [aspetto, setAspetto] = useState<AspettoPersonaggio>(ASPETTO_GIOCATORE_DEFAULT);

  const { width } = Dimensions.get("window");
  const isDesktop = width > DESKTOP_MODAL_BREAKPOINT;

  const valido =
    nome.trim().length > 0 &&
    cognome.trim().length > 0 &&
    sesso != null &&
    orientamento != null;

  const handleConferma = () => {
    if (!valido || sesso == null || orientamento == null) return;
    onConferma({
      nome: nome.trim(),
      cognome: cognome.trim(),
      sesso,
      orientamento,
      razza,
      aspetto
    });
  };

  const selezionaRazza = (next: RazzaGiocatore) => {
    setRazza(next);
    if (next === "Orco" && !["#79a86b", "#668f58", "#8aa66b"].includes(aspetto.colorePelle)) {
      setAspetto((value) => ({ ...value, colorePelle: "#79a86b" }));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={[styles.modalBackdrop, isDesktop && modalBackdropFullscreen]}>
        <Pressable
          style={[styles.modalCard, isDesktop && modalContentFullscreen, isDesktop && styles.modalCardDesktop]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.accentLine} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <View style={styles.emojiWrap}>
                <Text style={styles.emoji}>🛡️</Text>
              </View>
              <Text style={styles.title}>Crea il tuo sovrano</Text>
              <Text style={styles.subtitle}>Combina liberamente i pezzi in stile chibi pixel-art</Text>
              <View style={styles.titleUnderline} />
            </View>

            <View style={styles.messaggioWrap}>
              <Text style={styles.messaggio}>Il tuo aspetto resterà legato al personaggio e verrà conservato nel salvataggio.</Text>
            </View>

            <Text style={styles.sectionTitle}>Chi sei?</Text>

            <View style={[styles.previewWrap, isDesktop && styles.previewWrapDesktop]}>
              <PixelAvatarPreview razza={razza} aspetto={aspetto} />
              <View style={styles.previewMeta}>
                <Text style={styles.previewHint}>{razza} · {aspetto.vestiti}</Text>
                <Pressable style={styles.randomButton} onPress={() => setAspetto(generaAspettoCasuale(razza))}>
                  <Text style={styles.randomButtonText}>🎲 Sorprendimi</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Nome</Text>
              <TextInput
                style={styles.input}
                value={nome}
                onChangeText={setNome}
                placeholder="Nome"
                placeholderTextColor="rgba(148,163,184,0.5)"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Cognome</Text>
              <TextInput
                style={styles.input}
                value={cognome}
                onChangeText={setCognome}
                placeholder="Cognome"
                placeholderTextColor="rgba(148,163,184,0.5)"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Genere</Text>
              <View style={styles.chipRow}>
                {GENERI.map((g) => (
                  <Pressable
                    key={g.id}
                    style={[styles.chip, sesso === g.id && styles.chipSelected]}
                    onPress={() => setSesso(g.id)}
                  >
                    <Text style={[styles.chipText, sesso === g.id && styles.chipTextSelected]}>{g.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Orientamento sessuale</Text>
              <View style={styles.chipRowWrap}>
                {ORIENTAMENTI.map((o) => (
                  <Pressable
                    key={o.id}
                    style={[styles.chip, orientamento === o.id && styles.chipSelected]}
                    onPress={() => setOrientamento(o.id)}
                  >
                    <Text style={[styles.chipText, orientamento === o.id && styles.chipTextSelected]}>
                      {o.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Text style={styles.sectionTitle}>Aspetto del personaggio</Text>

            <View style={styles.field}><Text style={styles.label}>Razza</Text><View style={styles.chipRowWrap}>{RAZZE.map((o) => <Pressable key={o.id} style={[styles.chip, razza === o.id && styles.chipSelected]} onPress={() => selezionaRazza(o.id)}><Text style={[styles.chipText, razza === o.id && styles.chipTextSelected]}>{o.label}</Text></Pressable>)}</View></View>
            <View style={styles.field}><Text style={styles.label}>Colore della pelle</Text><View style={styles.swatchRow}>{COLORI_PELLE.map((color) => <Pressable accessibilityLabel={`Pelle ${color}`} key={color} onPress={() => setAspetto((v) => ({ ...v, colorePelle: color }))} style={[styles.swatch, { backgroundColor: color }, aspetto.colorePelle === color && styles.swatchSelected]} />)}</View></View>
            <View style={styles.field}><Text style={styles.label}>Stile dei capelli</Text><View style={styles.chipRowWrap}>{CAPELLI.map((o) => <Pressable key={o.id} style={[styles.chip, aspetto.stileCapelli === o.id && styles.chipSelected]} onPress={() => setAspetto((v) => ({ ...v, stileCapelli: o.id }))}><Text style={[styles.chipText, aspetto.stileCapelli === o.id && styles.chipTextSelected]}>{o.label}</Text></Pressable>)}</View></View>
            <View style={styles.field}><Text style={styles.label}>Colore dei capelli</Text><View style={styles.swatchRow}>{COLORI_CAPELLI.map((color) => <Pressable accessibilityLabel={`Capelli ${color}`} key={color} onPress={() => setAspetto((v) => ({ ...v, coloreCapelli: color }))} style={[styles.swatch, { backgroundColor: color }, aspetto.coloreCapelli === color && styles.swatchSelected]} />)}</View></View>
            <View style={styles.field}><Text style={styles.label}>Stile degli occhi</Text><View style={styles.chipRowWrap}>{OCCHI.map((o) => <Pressable key={o.id} style={[styles.chip, aspetto.stileOcchi === o.id && styles.chipSelected]} onPress={() => setAspetto((v) => ({ ...v, stileOcchi: o.id }))}><Text style={[styles.chipText, aspetto.stileOcchi === o.id && styles.chipTextSelected]}>{o.label}</Text></Pressable>)}</View></View>
            <View style={styles.field}><Text style={styles.label}>Vestiti</Text><View style={styles.chipRowWrap}>{VESTITI.map((o) => <Pressable key={o.id} style={[styles.chip, aspetto.vestiti === o.id && styles.chipSelected]} onPress={() => setAspetto((v) => ({ ...v, vestiti: o.id }))}><Text style={[styles.chipText, aspetto.vestiti === o.id && styles.chipTextSelected]}>{o.label}</Text></Pressable>)}</View></View>
            <View style={styles.field}><Text style={styles.label}>Cappello</Text><View style={styles.chipRowWrap}>{CAPPELLI.map((o) => <Pressable key={o.id} style={[styles.chip, aspetto.cappello === o.id && styles.chipSelected]} onPress={() => setAspetto((v) => ({ ...v, cappello: o.id }))}><Text style={[styles.chipText, aspetto.cappello === o.id && styles.chipTextSelected]}>{o.label}</Text></Pressable>)}</View></View>
          </ScrollView>

          <Pressable
            style={({ pressed }) => [
              styles.confirmButton,
              !valido && styles.confirmButtonDisabled,
              pressed && valido && styles.confirmButtonPressed
            ]}
            onPress={handleConferma}
            disabled={!valido}
          >
            <Text style={styles.confirmButtonText}>Assumi il comando</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(5, 8, 22, 0.92)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  modalCard: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 24,
    minWidth: 320,
    maxWidth: 440,
    maxHeight: "92%",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16
  },
  accentLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "#3b82f6",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20
  },
  header: {
    alignItems: "center",
    marginBottom: 16
  },
  emojiWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12
  },
  emoji: {
    fontSize: 36
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#f1f5f9",
    textAlign: "center",
    letterSpacing: 0.3
  },
  modalCardDesktop: { width: "94%", maxWidth: 1040, height: "92%", borderRadius: 20, padding: 24 },
  subtitle: { color: "#d6c39b", fontSize: 13, marginTop: 7, textAlign: "center" },
  titleUnderline: {
    width: 48,
    height: 2,
    backgroundColor: "rgba(148, 163, 184, 0.4)",
    marginTop: 10,
    borderRadius: 1
  },
  messaggioWrap: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)"
  },
  messaggio: {
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "justify"
  },
  sectionTitle: {
    color: "#93c5fd",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  previewWrap: { alignItems: "center", marginBottom: 18, gap: 10, backgroundColor: "rgba(120,83,45,0.16)", borderWidth: 1, borderColor: "rgba(214,195,155,0.25)", borderRadius: 14, padding: 14 },
  previewWrapDesktop: { flexDirection: "row", justifyContent: "center", gap: 28, paddingVertical: 10 },
  previewMeta: { alignItems: "center", gap: 8 },
  previewHint: { color: "#f3ddb0", fontSize: 12, fontWeight: "800", textTransform: "capitalize" },
  randomButton: { backgroundColor: "#5c3b20", borderWidth: 1, borderColor: "#d6b56f", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  randomButtonText: { color: "#fff4d6", fontSize: 12, fontWeight: "800" },
  field: {
    marginBottom: 14
  },
  label: {
    color: "rgba(203, 213, 245, 0.85)",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 6
  },
  input: {
    backgroundColor: "rgba(30, 41, 59, 0.9)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
    color: "#f1f5f9",
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  chipRow: {
    flexDirection: "row",
    gap: 8
  },
  chipRowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
    backgroundColor: "rgba(30, 41, 59, 0.6)"
  },
  chipSelected: {
    borderColor: "#3b82f6",
    backgroundColor: "rgba(59, 130, 246, 0.2)"
  },
  chipText: {
    color: "rgba(203, 213, 245, 0.75)",
    fontSize: 12,
    fontWeight: "600"
  },
  chipTextSelected: {
    color: "#e2e8f0"
  },
  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  swatch: { width: 34, height: 34, borderRadius: 4, borderWidth: 3, borderColor: "#334155" },
  swatchSelected: { borderColor: "#60a5fa", transform: [{ scale: 1.08 }] },
  confirmButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)"
  },
  confirmButtonDisabled: {
    opacity: 0.45
  },
  confirmButtonPressed: {
    backgroundColor: "#1d4ed8"
  },
  confirmButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5
  }
});
