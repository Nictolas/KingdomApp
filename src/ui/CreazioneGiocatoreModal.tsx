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
  type RazzaGiocatore
} from "../game/personaggioAspetto";
import { DESKTOP_MODAL_BREAKPOINT, modalBackdropFullscreen, modalContentFullscreen } from "./modalFullscreenStyles";
import { PixelAvatarPreview } from "./PixelAvatarPreview";
import { canRenderCharacter, compatibleCatalogOptions, firstCompatibleHairColor } from "../character-system/registry";
import { bodyFamilyFor, normalizeCharacterAppearance } from "../character-system/appearance";
import { SpriteCharacterRenderer } from "../components/SpriteCharacterRenderer";
import type { CharacterAppearance, CharacterLayer } from "../character-system/types";

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

const RAZZA_RE: RazzaGiocatore = "Umano";

function forzaAspettoReTeen(aspetto: AspettoPersonaggio): AspettoPersonaggio {
  const corrente = aspetto.characterAppearance ?? creaCharacterAppearance(RAZZA_RE, "teen");
  return {
    ...aspetto,
    cappello: "corona",
    characterAppearance: normalizeCharacterAppearance({
      ...corrente,
      race: "human",
      bodyType: "teen",
      ageGroup: "teen",
      bodyFamily: bodyFamilyFor("human", "teen"),
      beardStyle: "none",
      headwear: "crown"
    })
  };
}

const ASPETTO_RE_DEFAULT = forzaAspettoReTeen(ASPETTO_GIOCATORE_DEFAULT);

function AppearanceOption({
  appearance,
  label,
  selected,
  visibleLayers,
  onPress
}: {
  appearance: CharacterAppearance;
  label: string;
  selected: boolean;
  visibleLayers: readonly CharacterLayer[];
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[styles.visualOption, selected && styles.visualOptionSelected]}
    >
      <SpriteCharacterRenderer appearance={appearance} animation="idle" direction="down" size={72} visibleLayers={visibleLayers} />
      {hovered ? <View pointerEvents="none" style={styles.optionTooltip}><Text style={styles.optionTooltipText}>{label}</Text></View> : null}
    </Pressable>
  );
}

type CreationTab = "identity" | "hair" | "clothes";

const CREATION_TABS: { id: CreationTab; label: string }[] = [
  { id: "identity", label: "Identità" },
  { id: "hair", label: "Capelli" },
  { id: "clothes", label: "Vestiti" }
];

function readableOptionName(prefix: string, value: string) {
  const name = value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return `${prefix}: ${name}`;
}

export function CreazioneGiocatoreModal({ visible, onConferma }: CreazioneGiocatoreModalProps) {
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [sesso, setSesso] = useState<"M" | "F" | null>(null);
  const [orientamento, setOrientamento] = useState<"Etero" | "Omo" | "Bi" | "Asessuale" | null>(null);
  const [aspetto, setAspetto] = useState<AspettoPersonaggio>(ASPETTO_RE_DEFAULT);
  const [activeTab, setActiveTab] = useState<CreationTab>("identity");

  const { width } = Dimensions.get("window");
  const isDesktop = width > DESKTOP_MODAL_BREAKPOINT;
  const spriteAppearance = aspetto.characterAppearance ?? creaCharacterAppearance(RAZZA_RE, "teen");
  const catalogOptions = compatibleCatalogOptions(spriteAppearance);
  const updateSpriteAppearance = (patch: Partial<typeof spriteAppearance>) => {
    const next = forzaAspettoReTeen({ ...aspetto, characterAppearance: { ...spriteAppearance, ...patch } });
    if (next.characterAppearance && canRenderCharacter(next.characterAppearance, "idle")) {
      setAspetto(next);
    }
  };
  const updateOutfit = (upperOutfit: string, lowerOutfit: string) => {
    updateSpriteAppearance({
      outfit: upperOutfit === lowerOutfit ? upperOutfit : "custom",
      upperOutfit,
      lowerOutfit,
      fullOutfit: "none"
    });
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
          <View style={styles.header}>
            <View style={styles.emojiWrap}><Text style={styles.emoji}>🛡️</Text></View>
            <Text style={styles.title}>Crea il tuo Re</Text>
            <Text style={styles.subtitle}>Configura un personaggio pixel-art modulare</Text>
            <View style={styles.titleUnderline} />
          </View>

          <View style={[styles.editorLayout, isDesktop && styles.editorLayoutDesktop]}>
            <View style={[styles.previewColumn, isDesktop && styles.previewColumnDesktop]}>
              <View style={styles.previewWrap}>
                <PixelAvatarPreview razza={RAZZA_RE} aspetto={aspetto} />
                <View style={styles.previewMeta}>
                  <Text style={styles.previewHint}>Umano · 10 anni · corpo teen</Text>
                  <Pressable style={styles.randomButton} onPress={() => {
                    const casualeTeen = generaAspettoCasuale(RAZZA_RE, Math.random, { eta: 15, sesso: sesso ?? undefined });
                    const next = forzaAspettoReTeen(casualeTeen);
                    if (next.characterAppearance && canRenderCharacter(next.characterAppearance, "idle")) {
                      setAspetto(next);
                    }
                  }}>
                    <Text style={styles.randomButtonText}>🎲 Sorprendimi</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            <ScrollView
              style={styles.controlsScroll}
              contentContainerStyle={styles.controlsColumn}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.tabs}>
                {CREATION_TABS.map((tab) => <Pressable key={tab.id} accessibilityRole="tab" accessibilityState={{ selected: activeTab === tab.id }} style={[styles.tab, activeTab === tab.id && styles.tabSelected]} onPress={() => setActiveTab(tab.id)}><Text style={[styles.tabText, activeTab === tab.id && styles.tabTextSelected]}>{tab.label}</Text></Pressable>)}
              </View>

              {activeTab === "identity" ? <>
              <Text style={styles.sectionTitle}>Identità</Text>
              <View style={styles.field}>
                <Text style={styles.label}>Nome</Text>
                <TextInput style={styles.input} value={nome} onChangeText={setNome} placeholder="Nome" placeholderTextColor="rgba(148,163,184,0.5)" autoCapitalize="words" />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Cognome</Text>
                <TextInput style={styles.input} value={cognome} onChangeText={setCognome} placeholder="Cognome" placeholderTextColor="rgba(148,163,184,0.5)" autoCapitalize="words" />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Genere</Text>
                <View style={styles.chipRow}>{GENERI.map((g) => <Pressable key={g.id} style={[styles.chip, sesso === g.id && styles.chipSelected]} onPress={() => setSesso((current) => current === g.id ? null : g.id)}><Text style={[styles.chipText, sesso === g.id && styles.chipTextSelected]}>{g.label}</Text></Pressable>)}</View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Orientamento sessuale</Text>
                <View style={styles.chipRowWrap}>{ORIENTAMENTI.map((o) => <Pressable key={o.id} style={[styles.chip, orientamento === o.id && styles.chipSelected]} onPress={() => setOrientamento((current) => current === o.id ? null : o.id)}><Text style={[styles.chipText, orientamento === o.id && styles.chipTextSelected]}>{o.label}</Text></Pressable>)}</View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Colore pelle</Text>
                <View style={styles.visualGrid}>{catalogOptions.skinTones.map((value) => <AppearanceOption key={value} label={readableOptionName("Colore pelle", value)} selected={spriteAppearance.skinTone === value} visibleLayers={["body", "raceFeatures"]} appearance={normalizeCharacterAppearance({ ...spriteAppearance, skinTone: value })} onPress={() => updateSpriteAppearance({ skinTone: value })} />)}</View>
              </View>
              </> : null}

              {activeTab === "hair" ? <>
              <Text style={styles.sectionTitle}>Capelli</Text>
              <View style={styles.field}>
                <Text style={styles.label}>Colore capelli</Text>
                <View style={styles.visualGrid}>{catalogOptions.hairColors.map((value) => <AppearanceOption key={value} label={readableOptionName("Colore capelli", value)} selected={spriteAppearance.hairColor === value} visibleLayers={["hairBack", "hairFront"]} appearance={normalizeCharacterAppearance({ ...spriteAppearance, hairColor: value })} onPress={() => updateSpriteAppearance({ hairColor: spriteAppearance.hairColor === value ? "none" : value })} />)}</View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Stile capelli</Text>
                <View style={styles.visualGrid}>{catalogOptions.hairStyles.map((value) => {
                  const hairColor = firstCompatibleHairColor(spriteAppearance, value);
                  return <AppearanceOption key={value} label={readableOptionName("Stile capelli", value)} selected={spriteAppearance.hairStyle === value} visibleLayers={["hairBack", "hairFront"]} appearance={normalizeCharacterAppearance({ ...spriteAppearance, hairStyle: value, hairColor })} onPress={() => updateSpriteAppearance(spriteAppearance.hairStyle === value ? { hairStyle: "none", hairColor: "none" } : { hairStyle: value, hairColor })} />;
                })}</View>
              </View>
              </> : null}

              {activeTab === "clothes" ? <>
              <Text style={styles.sectionTitle}>Vestiti</Text>
              <View style={styles.field}>
                <Text style={styles.label}>Abiti completi</Text>
                <View style={styles.visualGrid}>{catalogOptions.fullOutfits.map((value) => <AppearanceOption key={value} label={readableOptionName("Abito completo", value)} selected={spriteAppearance.fullOutfit === value} visibleLayers={["fullOutfit"]} appearance={normalizeCharacterAppearance({ ...spriteAppearance, fullOutfit: value })} onPress={() => updateSpriteAppearance(spriteAppearance.fullOutfit === value ? { fullOutfit: "none" } : { outfit: value, fullOutfit: value })} />)}</View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Sopra</Text>
                <View style={styles.visualGrid}>{catalogOptions.upperOutfits.map((value) => <AppearanceOption key={value} label={readableOptionName("Sopra", value)} selected={spriteAppearance.fullOutfit === "none" && spriteAppearance.upperOutfit === value} visibleLayers={["outfit"]} appearance={normalizeCharacterAppearance({ ...spriteAppearance, fullOutfit: "none", upperOutfit: value })} onPress={() => updateOutfit(spriteAppearance.fullOutfit === "none" && spriteAppearance.upperOutfit === value ? "none" : value, spriteAppearance.lowerOutfit)} />)}</View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Sotto</Text>
                <View style={styles.visualGrid}>{catalogOptions.lowerOutfits.map((value) => <AppearanceOption key={value} label={readableOptionName("Sotto", value)} selected={spriteAppearance.fullOutfit === "none" && spriteAppearance.lowerOutfit === value} visibleLayers={["lowerBody"]} appearance={normalizeCharacterAppearance({ ...spriteAppearance, fullOutfit: "none", lowerOutfit: value })} onPress={() => updateOutfit(spriteAppearance.upperOutfit, spriteAppearance.fullOutfit === "none" && spriteAppearance.lowerOutfit === value ? "none" : value)} />)}</View>
              </View>
              </> : null}
            </ScrollView>
          </View>

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
    height: "92%",
    maxHeight: "92%",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    overflow: "hidden"
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
    marginBottom: 16,
    flexShrink: 0
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
  sectionTitle: {
    color: "#93c5fd",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  editorLayout: { width: "100%", flex: 1, minHeight: 0, overflow: "hidden" },
  editorLayoutDesktop: { flexDirection: "row", alignItems: "stretch", gap: 24 },
  previewColumn: { width: "100%" },
  previewColumnDesktop: { width: 300 },
  controlsScroll: { flex: 1, minHeight: 0, maxHeight: "100%" },
  controlsColumn: { paddingRight: 8, paddingBottom: 12 },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  tab: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 9, borderWidth: 1, borderColor: "rgba(148, 163, 184, 0.35)", backgroundColor: "rgba(30, 41, 59, 0.72)" },
  tabSelected: { borderColor: "#60a5fa", backgroundColor: "rgba(59, 130, 246, 0.24)" },
  tabText: { color: "rgba(203, 213, 245, 0.76)", fontSize: 12, fontWeight: "700" },
  tabTextSelected: { color: "#eff6ff" },
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
  visualGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  visualOption: {
    width: 82,
    height: 82,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "rgba(148, 163, 184, 0.3)",
    backgroundColor: "#243447"
  },
  visualOptionSelected: {
    borderColor: "#60a5fa",
    backgroundColor: "rgba(59, 130, 246, 0.22)"
  },
  optionTooltip: {
    position: "absolute",
    left: 3,
    right: 3,
    bottom: 3,
    minHeight: 22,
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderRadius: 5,
    justifyContent: "center",
    backgroundColor: "rgba(2, 6, 23, 0.94)"
  },
  optionTooltipText: {
    color: "#f8fafc",
    fontSize: 8,
    fontWeight: "700",
    lineHeight: 10,
    textAlign: "center"
  },
  confirmButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
    flexShrink: 0
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
