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
  generaAspettoCasuale,
  creaCharacterAppearance,
  type AspettoPersonaggio,
  type CappelloPersonaggio,
  type RazzaGiocatore,
  type StileOcchi,
  type VestitiPersonaggio
} from "../game/personaggioAspetto";
import { DESKTOP_MODAL_BREAKPOINT, modalBackdropFullscreen, modalContentFullscreen } from "./modalFullscreenStyles";
import { PixelAvatarPreview } from "./PixelAvatarPreview";
import { compatibleCatalogOptions } from "../character-system/registry";
import { bodyFamilyFor, normalizeCharacterAppearance } from "../character-system/appearance";

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

const OCCHI: { id: StileOcchi; label: string }[] = [
  { id: "tondi", label: "Tondi" }, { id: "determinati", label: "Determinati" }, { id: "allegri", label: "Allegri" }
];
const VESTITI: { id: VestitiPersonaggio; label: string }[] = [
  { id: "viandante", label: "Viandante" }, { id: "nobile", label: "Nobile" },
  { id: "ranger", label: "Ranger" }, { id: "mago", label: "Mago" }
];
const CAPPELLI: { id: CappelloPersonaggio; label: string }[] = [
  { id: "nessuno", label: "Nessuno" }, { id: "cappuccio", label: "Cappuccio" },
  { id: "berretto", label: "Berretto" }, { id: "corona", label: "👑 Corona del Re" }
];

const RAZZA_RE: RazzaGiocatore = "Umano";

function forzaAspettoReTeen(aspetto: AspettoPersonaggio): AspettoPersonaggio {
  const corrente = aspetto.characterAppearance ?? creaCharacterAppearance(RAZZA_RE, "teen");
  return {
    ...aspetto,
    characterAppearance: normalizeCharacterAppearance({
      ...corrente,
      race: "human",
      bodyType: "teen",
      ageGroup: "teen",
      bodyFamily: bodyFamilyFor("human", "teen"),
      beardStyle: "none"
    })
  };
}

const ASPETTO_RE_DEFAULT = forzaAspettoReTeen(ASPETTO_GIOCATORE_DEFAULT);

export function CreazioneGiocatoreModal({ visible, onConferma }: CreazioneGiocatoreModalProps) {
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [sesso, setSesso] = useState<"M" | "F" | null>(null);
  const [orientamento, setOrientamento] = useState<"Etero" | "Omo" | "Bi" | "Asessuale" | null>(null);
  const [aspetto, setAspetto] = useState<AspettoPersonaggio>(ASPETTO_RE_DEFAULT);

  const { width } = Dimensions.get("window");
  const isDesktop = width > DESKTOP_MODAL_BREAKPOINT;
  const spriteAppearance = aspetto.characterAppearance ?? creaCharacterAppearance(RAZZA_RE, "teen");
  const catalogOptions = compatibleCatalogOptions(spriteAppearance, { allowRoyalHeadwear: true });
  const updateSpriteAppearance = (patch: Partial<typeof spriteAppearance>) => {
    const next = forzaAspettoReTeen({ ...aspetto, characterAppearance: { ...spriteAppearance, ...patch } });
    setAspetto(next);
  };

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
      razza: RAZZA_RE,
      aspetto: forzaAspettoReTeen(aspetto)
    });
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
              <Text style={styles.title}>Crea il tuo Re</Text>
              <Text style={styles.subtitle}>Configura un personaggio pixel-art modulare</Text>
              <View style={styles.titleUnderline} />
            </View>

            <View style={styles.messaggioWrap}>
              <Text style={styles.messaggio}>Il tuo aspetto resterà legato al personaggio e verrà conservato nel salvataggio.</Text>
            </View>

            <Text style={styles.sectionTitle}>Chi sei?</Text>

            <View style={[styles.editorLayout, isDesktop && styles.editorLayoutDesktop]}>
              <View style={[styles.previewColumn, isDesktop && styles.previewColumnDesktop]}>
                <View style={styles.previewWrap}>
                  <PixelAvatarPreview razza={RAZZA_RE} aspetto={aspetto} />
                  <View style={styles.previewMeta}>
                    <Text style={styles.previewHint}>Umano · 10 anni · corpo teen</Text>
                    <Pressable style={styles.randomButton} onPress={() => {
                      const casualeTeen = generaAspettoCasuale(RAZZA_RE, Math.random, {
                        eta: 15,
                        sesso: sesso ?? undefined
                      });
                      setAspetto(forzaAspettoReTeen(casualeTeen));
                    }}>
                      <Text style={styles.randomButtonText}>🎲 Sorprendimi</Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              <View style={styles.controlsColumn}>

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
                  onPress={() => {
                    setSesso(g.id);
                  }}
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

            <View style={styles.field}><Text style={styles.label}>Colore pelle</Text><View style={styles.chipRowWrap}>{catalogOptions.skinTones.map((value) => <Pressable key={value} style={[styles.chip, spriteAppearance.skinTone === value && styles.chipSelected]} onPress={() => updateSpriteAppearance({ skinTone: value })}><Text style={[styles.chipText, spriteAppearance.skinTone === value && styles.chipTextSelected]}>{value}</Text></Pressable>)}</View></View>
            <View style={styles.field}><Text style={styles.label}>Stile capelli</Text><View style={styles.chipRowWrap}>{catalogOptions.hairStyles.map((value) => <Pressable key={value} style={[styles.chip, spriteAppearance.hairStyle === value && styles.chipSelected]} onPress={() => updateSpriteAppearance({ hairStyle: value })}><Text style={[styles.chipText, spriteAppearance.hairStyle === value && styles.chipTextSelected]}>{value}</Text></Pressable>)}</View></View>
            <View style={styles.field}><Text style={styles.label}>Colore capelli</Text><View style={styles.chipRowWrap}>{catalogOptions.hairColors.map((value) => <Pressable key={value} style={[styles.chip, spriteAppearance.hairColor === value && styles.chipSelected]} onPress={() => updateSpriteAppearance({ hairColor: value })}><Text style={[styles.chipText, spriteAppearance.hairColor === value && styles.chipTextSelected]}>{value}</Text></Pressable>)}</View></View>
            {spriteAppearance.bodyType === "male" && <View style={styles.field}><Text style={styles.label}>Barba / baffi LPC</Text><View style={styles.chipRowWrap}>{catalogOptions.beardStyles.map((value) => <Pressable key={value} style={[styles.chip, spriteAppearance.beardStyle === value && styles.chipSelected]} onPress={() => updateSpriteAppearance({ beardStyle: value })}><Text style={[styles.chipText, spriteAppearance.beardStyle === value && styles.chipTextSelected]}>{value}</Text></Pressable>)}</View></View>}
            <View style={styles.field}><Text style={styles.label}>Outfit LPC</Text><View style={styles.chipRowWrap}>{catalogOptions.outfits.map((value) => <Pressable key={value} style={[styles.chip, spriteAppearance.outfit === value && styles.chipSelected]} onPress={() => updateSpriteAppearance({ outfit: value })}><Text style={[styles.chipText, spriteAppearance.outfit === value && styles.chipTextSelected]}>{value}</Text></Pressable>)}</View></View>
            <View style={styles.field}><Text style={styles.label}>Copricapo LPC</Text><View style={styles.chipRowWrap}>{catalogOptions.headwear.map((value) => <Pressable key={value} style={[styles.chip, spriteAppearance.headwear === value && styles.chipSelected]} onPress={() => updateSpriteAppearance({ headwear: value })}><Text style={[styles.chipText, spriteAppearance.headwear === value && styles.chipTextSelected]}>{value}</Text></Pressable>)}</View></View>

            <View style={styles.field}><Text style={styles.label}>Stile degli occhi</Text><View style={styles.chipRowWrap}>{OCCHI.map((o) => <Pressable key={o.id} style={[styles.chip, aspetto.stileOcchi === o.id && styles.chipSelected]} onPress={() => setAspetto((v) => ({ ...v, stileOcchi: o.id }))}><Text style={[styles.chipText, aspetto.stileOcchi === o.id && styles.chipTextSelected]}>{o.label}</Text></Pressable>)}</View></View>
            <View style={styles.field}><Text style={styles.label}>Vestiti</Text><View style={styles.chipRowWrap}>{VESTITI.map((o) => <Pressable key={o.id} style={[styles.chip, aspetto.vestiti === o.id && styles.chipSelected]} onPress={() => setAspetto((v) => ({ ...v, vestiti: o.id }))}><Text style={[styles.chipText, aspetto.vestiti === o.id && styles.chipTextSelected]}>{o.label}</Text></Pressable>)}</View></View>
            <View style={styles.field}><Text style={styles.label}>Copricapo <Text style={styles.kingOnly}>· la Corona appartiene solo al Re</Text></Text><View style={styles.chipRowWrap}>{CAPPELLI.map((o) => <Pressable key={o.id} style={[styles.chip, aspetto.cappello === o.id && styles.chipSelected]} onPress={() => setAspetto((v) => ({ ...v, cappello: o.id }))}><Text style={[styles.chipText, aspetto.cappello === o.id && styles.chipTextSelected]}>{o.label}</Text></Pressable>)}</View></View>
              </View>
            </View>
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
            <Text style={styles.confirmButtonText}>Inizia il tuo regno</Text>
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
  editorLayout: { width: "100%" },
  editorLayoutDesktop: { flexDirection: "row", alignItems: "flex-start", gap: 24 },
  previewColumn: { width: "100%" },
  previewColumnDesktop: { width: 300 },
  controlsColumn: { flex: 1, minWidth: 0 },
  previewWrap: { alignItems: "center", marginBottom: 18, gap: 10, backgroundColor: "rgba(120,83,45,0.16)", borderWidth: 1, borderColor: "rgba(214,195,155,0.25)", borderRadius: 14, padding: 14 },
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
  kingOnly: { color: "#d6b56f", fontWeight: "800" },
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
