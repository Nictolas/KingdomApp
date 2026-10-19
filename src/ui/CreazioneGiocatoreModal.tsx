import React, { useEffect, useState } from "react";
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
import { CharacterCreationPreview } from "./CharacterCreationPreview";
import { RoyalThroneBackground } from "./RoyalThroneBackground";
import { canRenderCharacter, compatibleCatalogOptions, compatibleColorsForField, firstCompatibleColorForField, firstCompatibleHairColor } from "../character-system/registry";
import { bodyFamilyFor, normalizeCharacterAppearance } from "../character-system/appearance";
import { groupCapeMantelloSections, isCapeTrim } from "../character-system/capeMantello";
import {
  filterPantsOptions,
  filterSkirtsOptions,
  filterTorsoOutfitOptions,
  groupCatalogOptionsByLpcSections,
  groupKimonoVesteSections,
  isKimonoManicheFullOutfit,
  isKimonoVesteAbito,
  isKimonoVesteTrim,
  kimonoBaseForTrim,
  kimonoTrimForBase,
  LPC_KIMONO_MANICHE_SECTIONS,
  LPC_MANICHE_TORSO_SECTIONS,
  LPC_PANTS_SECTIONS,
  LPC_SKIRTS_SECTIONS,
  LPC_TORSO_SECTIONS,
  partitionLongsleeveTorsoOptions
} from "../character-system/lpcCatalogSections";
import { CircularSpriteFrame } from "./CircularSpriteFrame";
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
  onConferma: (dati: DatiCreazioneGiocatore) => void | Promise<void>;
  mode?: "create" | "edit" | "outfit";
  initial?: DatiCreazioneGiocatore | null;
  onAnnulla?: () => void;
  titolo?: string;
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

const ASPETTO_OUTFIT_DEFAULT: AspettoPersonaggio = {
  ...ASPETTO_GIOCATORE_DEFAULT,
  cappello: "nessuno",
  characterAppearance: normalizeCharacterAppearance({
    ...creaCharacterAppearance("Umano", "male"),
    headwear: "none"
  })
};

function AppearanceOption({
  appearance,
  label,
  selected,
  visibleLayers,
  visibleSemanticIds,
  onPress
}: {
  appearance: CharacterAppearance;
  label: string;
  selected: boolean;
  visibleLayers: readonly CharacterLayer[];
  visibleSemanticIds?: Partial<Record<CharacterLayer, string>>;
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
      {selected ? <View pointerEvents="none" style={styles.selectionRing} /> : null}
      <CircularSpriteFrame appearance={appearance} size={58} animate={false} visibleLayers={visibleLayers} visibleSemanticIds={visibleSemanticIds} />
      {hovered ? <View pointerEvents="none" style={styles.optionTooltip}><Text style={styles.optionTooltipText}>{label}</Text></View> : null}
    </Pressable>
  );
}

type CreationTab = "identity" | "hair" | "busto" | "maniche" | "veste" | "mantello" | "pantaloni" | "gonne" | "scarpe" | "calze";

const CREATION_TABS: { id: CreationTab; label: string }[] = [
  { id: "identity", label: "Identità" },
  { id: "hair", label: "Capelli" },
  { id: "busto", label: "Busto" },
  { id: "maniche", label: "Maniche" },
  { id: "veste", label: "Veste" },
  { id: "mantello", label: "Mantello" },
  { id: "pantaloni", label: "Pantaloni" },
  { id: "gonne", label: "Gonne" },
  { id: "scarpe", label: "Scarpe" },
  { id: "calze", label: "Calze" }
];

function readableOptionName(prefix: string, value: string) {
  const name = formatSemanticLabel(value);
  return `${prefix}: ${name}`;
}

function formatSemanticLabel(value: string): string {
  if (value === "trim") return "Cape Trim";
  return value.replace(/^feet_/, "").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

type OutfitColorPickerKind = "upper" | "fullOutfit" | "fullOutfitTrim" | "cape" | "capeTrim" | "lower" | "footwear";

type OutfitColorPickerRequest = {
  kind: OutfitColorPickerKind;
  semanticId: string;
  label: string;
};

type OutfitColorPickerState = {
  request: OutfitColorPickerRequest;
  colors: string[];
};

function colorsForOutfitPicker(
  appearance: CharacterAppearance,
  request: OutfitColorPickerRequest
): string[] {
  switch (request.kind) {
    case "fullOutfit":
    case "fullOutfitTrim":
      return compatibleColorsForField(appearance, "outfitPrimaryColor", "fullOutfit", request.semanticId);
    case "cape":
    case "capeTrim":
      return compatibleColorsForField(appearance, "capeColor", "cape", request.semanticId);
    case "upper":
      return compatibleColorsForField(appearance, "outfitPrimaryColor", "outfit", request.semanticId);
    case "lower":
      return compatibleColorsForField(appearance, "outfitSecondaryColor", "lowerBody", request.semanticId);
    case "footwear":
      return compatibleColorsForField(appearance, "footwear", "footwear", request.semanticId);
  }
}

function resolveOutfitPickerColors(
  appearance: CharacterAppearance,
  request: OutfitColorPickerRequest
): string[] {
  return colorsForOutfitPicker(appearance, request);
}

function previewAppearanceForOutfitPicker(
  appearance: CharacterAppearance,
  request: OutfitColorPickerRequest,
  color: string
): CharacterAppearance {
  switch (request.kind) {
    case "fullOutfit": {
      const compatibleTrim = kimonoTrimForBase(request.semanticId);
      return normalizeCharacterAppearance({
        ...appearance,
        fullOutfit: request.semanticId,
        fullOutfitTrim: compatibleTrim && appearance.fullOutfitTrim === compatibleTrim ? appearance.fullOutfitTrim : "none",
        outfit: request.semanticId,
        outfitPrimaryColor: color,
        upperOutfit: "none",
        lowerOutfit: "none"
      });
    }
    case "fullOutfitTrim":
      return normalizeCharacterAppearance({
        ...appearance,
        fullOutfit: kimonoBaseForTrim(request.semanticId) ?? appearance.fullOutfit,
        fullOutfitTrim: request.semanticId,
        outfit: kimonoBaseForTrim(request.semanticId) ?? appearance.fullOutfit,
        outfitPrimaryColor: color,
        upperOutfit: "none",
        lowerOutfit: "none"
      });
    case "upper":
      return normalizeCharacterAppearance({
        ...appearance,
        fullOutfit: "none",
        upperOutfit: request.semanticId,
        outfitPrimaryColor: color
      });
    case "lower":
      return normalizeCharacterAppearance({
        ...appearance,
        fullOutfit: "none",
        lowerOutfit: request.semanticId,
        outfitSecondaryColor: color
      });
    case "footwear":
      return normalizeCharacterAppearance({
        ...appearance,
        footwear: request.semanticId,
        footwearColor: color
      });
    case "cape":
      return normalizeCharacterAppearance({
        ...appearance,
        cape: request.semanticId,
        capeColor: color
      });
    case "capeTrim":
      return normalizeCharacterAppearance({
        ...appearance,
        capeTrim: request.semanticId,
        capeColor: color
      });
  }
}

function visibleLayersForOutfitPicker(kind: OutfitColorPickerKind): readonly CharacterLayer[] {
  switch (kind) {
    case "fullOutfit":
    case "fullOutfitTrim":
      return ["body", "raceFeatures", "fullOutfit"];
    case "upper":
      return ["outfit"];
    case "lower":
      return ["lowerBody"];
    case "footwear":
      return ["footwear"];
    case "cape":
    case "capeTrim":
      return ["cape"];
  }
}

function visibleSemanticIdsForOutfitPicker(request: OutfitColorPickerRequest): Partial<Record<CharacterLayer, string>> {
  if (request.kind === "fullOutfit" || request.kind === "fullOutfitTrim") {
    return { fullOutfit: request.semanticId };
  }
  if (request.kind === "cape" || request.kind === "capeTrim") {
    return { cape: request.semanticId };
  }
  return {};
}

function OutfitColorPickerDialog({
  picker,
  appearance,
  onSelect,
  onCancel
}: {
  picker: OutfitColorPickerState;
  appearance: CharacterAppearance;
  onSelect: (color: string) => void;
  onCancel: () => void;
}) {
  const { request, colors } = picker;
  const visibleLayers = visibleLayersForOutfitPicker(request.kind);
  const visibleSemanticIds = visibleSemanticIdsForOutfitPicker(request);
  const currentColor = request.kind === "fullOutfit" || request.kind === "fullOutfitTrim" || request.kind === "upper"
    ? appearance.outfitPrimaryColor
    : request.kind === "cape" || request.kind === "capeTrim"
      ? appearance.capeColor
    : request.kind === "lower"
      ? appearance.outfitSecondaryColor
      : appearance.footwearColor;

  return (
    <View style={styles.colorPickerOverlay} pointerEvents="box-none">
      <Pressable style={styles.colorPickerBackdrop} onPress={onCancel} accessibilityLabel="Chiudi selezione colore" />
      <View style={styles.colorPickerCard}>
        <Text style={styles.colorPickerTitle}>Scegli il colore</Text>
        <Text style={styles.colorPickerSubtitle}>{request.label}</Text>
        <ScrollView style={styles.colorPickerScroll} contentContainerStyle={styles.colorPickerGrid} keyboardShouldPersistTaps="handled">
          {colors.map((color) => (
            <AppearanceOption
              key={color}
              label={formatSemanticLabel(color)}
              selected={currentColor === color && (
                request.kind === "fullOutfit"
                  ? appearance.fullOutfit === request.semanticId
                  : request.kind === "fullOutfitTrim"
                    ? appearance.fullOutfitTrim === request.semanticId
                    : request.kind === "cape"
                      ? appearance.cape === request.semanticId
                      : request.kind === "capeTrim"
                        ? appearance.capeTrim === request.semanticId
                    : request.kind === "upper"
                    ? appearance.upperOutfit === request.semanticId
                    : request.kind === "lower"
                      ? appearance.lowerOutfit === request.semanticId
                      : appearance.footwear === request.semanticId
              )}
              visibleLayers={visibleLayers}
              visibleSemanticIds={visibleSemanticIds}
              appearance={previewAppearanceForOutfitPicker(appearance, request, color)}
              onPress={() => onSelect(color)}
            />
          ))}
        </ScrollView>
        <Pressable style={styles.colorPickerCancel} onPress={onCancel} accessibilityRole="button">
          <Text style={styles.colorPickerCancelText}>Annulla</Text>
        </Pressable>
      </View>
    </View>
  );
}

const KIMONO_VESTE_PREVIEW_LAYERS = ["body", "raceFeatures", "fullOutfit"] as const;
const CAPE_MANTELLO_PREVIEW_LAYERS = ["body", "raceFeatures", "cape"] as const;

function kimonoVestePreviewSemanticIds(semanticId: string): Partial<Record<CharacterLayer, string>> {
  return { fullOutfit: semanticId };
}

export function CreazioneGiocatoreModal({
  visible,
  onConferma,
  mode = "create",
  initial = null,
  onAnnulla,
  titolo
}: CreazioneGiocatoreModalProps) {
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [sesso, setSesso] = useState<"M" | "F" | null>(null);
  const [orientamento, setOrientamento] = useState<"Etero" | "Omo" | "Bi" | "Asessuale" | null>(null);
  const [aspetto, setAspetto] = useState<AspettoPersonaggio>(ASPETTO_RE_DEFAULT);
  const [activeTab, setActiveTab] = useState<CreationTab>("identity");
  const [outfitColorPicker, setOutfitColorPicker] = useState<OutfitColorPickerState | null>(null);

  useEffect(() => {
    if (!visible) return;
    const source =
      initial ??
      (mode === "outfit"
        ? {
            nome: "Sacerdote",
            cognome: "",
            sesso: "M" as const,
            orientamento: "Etero" as const,
            razza: RAZZA_RE,
            aspetto: ASPETTO_OUTFIT_DEFAULT
          }
        : null);
    setNome(source?.nome ?? "");
    setCognome(source?.cognome ?? "");
    setSesso(source?.sesso ?? null);
    setOrientamento(source?.orientamento ?? null);
    setAspetto(source?.aspetto ?? ASPETTO_RE_DEFAULT);
    setActiveTab(mode === "outfit" ? "busto" : "identity");
    setOutfitColorPicker(null);
  }, [visible, mode, initial]);

  const { width, height } = Dimensions.get("window");
  const isDesktop = width > DESKTOP_MODAL_BREAKPOINT;
  const mobilePreviewSize = height < 700 ? 92 : 112;
  const spriteAppearance = aspetto.characterAppearance ?? creaCharacterAppearance(RAZZA_RE, "teen");
  const catalogOptions = compatibleCatalogOptions(spriteAppearance);
  const torsoOutfitsAll = filterTorsoOutfitOptions(catalogOptions.upperOutfits, spriteAppearance.bodyType);
  const { manicheSleeves: manicheTorsoOutfits, rest: bustoTorsoOutfits } = partitionLongsleeveTorsoOptions(torsoOutfitsAll, spriteAppearance.bodyType);
  const bustoSections = groupCatalogOptionsByLpcSections(bustoTorsoOutfits, spriteAppearance.bodyType, "outfit", LPC_TORSO_SECTIONS);
  const manicheTorsoSections = groupCatalogOptionsByLpcSections(manicheTorsoOutfits, spriteAppearance.bodyType, "outfit", LPC_MANICHE_TORSO_SECTIONS);
  const kimonoManicheOutfits = catalogOptions.fullOutfits.filter(isKimonoManicheFullOutfit);
  const vesteKimonoOutfits = catalogOptions.fullOutfits.filter((id) => !isKimonoManicheFullOutfit(id));
  const manicheKimonoSections = groupCatalogOptionsByLpcSections(kimonoManicheOutfits, spriteAppearance.bodyType, "fullOutfit", LPC_KIMONO_MANICHE_SECTIONS);
  const manicheSections = [...manicheTorsoSections, ...manicheKimonoSections];
  const vesteSections = groupKimonoVesteSections(
    vesteKimonoOutfits,
    isKimonoVesteAbito(spriteAppearance.fullOutfit) ? spriteAppearance.fullOutfit : undefined
  );
  const mantelloSections = groupCapeMantelloSections(
    catalogOptions.capes,
    spriteAppearance.cape !== "none"
  );
  const pantaloniSections = groupCatalogOptionsByLpcSections(
    filterPantsOptions(catalogOptions.lowerOutfits, spriteAppearance.bodyType),
    spriteAppearance.bodyType,
    "lowerBody",
    LPC_PANTS_SECTIONS
  );
  const gonneSections = groupCatalogOptionsByLpcSections(
    filterSkirtsOptions(catalogOptions.lowerOutfits, spriteAppearance.bodyType),
    spriteAppearance.bodyType,
    "lowerBody",
    LPC_SKIRTS_SECTIONS
  );
  const scarpeFootwearSections = [
    ["Shoes", ["shoes"]],
    ["Boots", ["boots"]],
    ["Shoe / Boots Accessory", ["plate_toe", "accessory"]],
    ["Slippers", ["slippers"]],
    ["Sandals", ["sandals"]],
    ["Hoofs", ["hoofs"]]
  ] as const;
  const calzeFootwearSections = [
    ["Socks", ["socks"]]
  ] as const;
  const updateSpriteAppearance = (patch: Partial<typeof spriteAppearance>) => {
    const patched = {
      ...aspetto,
      characterAppearance: normalizeCharacterAppearance({ ...spriteAppearance, ...patch })
    };
    const next = mode === "outfit" ? patched : forzaAspettoReTeen(patched);
    if (next.characterAppearance && canRenderCharacter(next.characterAppearance, "idle")) {
      setAspetto(next);
    }
  };
  const updateOutfit = (
    upperOutfit: string,
    lowerOutfit: string,
    outfitPrimaryColor?: string,
    outfitSecondaryColor?: string
  ) => {
    updateSpriteAppearance({
      outfit: upperOutfit === lowerOutfit ? upperOutfit : "custom",
      upperOutfit,
      lowerOutfit,
      fullOutfit: "none",
      outfitPrimaryColor: upperOutfit === "none"
        ? spriteAppearance.outfitPrimaryColor
        : outfitPrimaryColor ?? firstCompatibleColorForField(spriteAppearance, "outfitPrimaryColor", "outfit", upperOutfit),
      outfitSecondaryColor: lowerOutfit === "none"
        ? spriteAppearance.outfitSecondaryColor
        : outfitSecondaryColor ?? firstCompatibleColorForField(spriteAppearance, "outfitSecondaryColor", "lowerBody", lowerOutfit)
    });
  };

  const openOutfitColorPicker = (request: OutfitColorPickerRequest, options?: { forceDialog?: boolean }) => {
    const colors = resolveOutfitPickerColors(spriteAppearance, request);
    if (colors.length === 0) return;
    if (!options?.forceDialog && colors.length <= 1) {
      applyOutfitColorPicker(request, colors[0] ?? "base");
      return;
    }
    setOutfitColorPicker({ request, colors });
  };

  const applyOutfitColorPicker = (request: OutfitColorPickerRequest, color: string) => {
    switch (request.kind) {
      case "fullOutfit": {
        const compatibleTrim = kimonoTrimForBase(request.semanticId);
        updateSpriteAppearance({
          outfit: request.semanticId,
          fullOutfit: request.semanticId,
          fullOutfitTrim: compatibleTrim && spriteAppearance.fullOutfitTrim === compatibleTrim
            ? spriteAppearance.fullOutfitTrim
            : "none",
          outfitPrimaryColor: color,
          upperOutfit: "none",
          lowerOutfit: "none"
        });
        break;
      }
      case "fullOutfitTrim":
        updateSpriteAppearance({
          outfit: kimonoBaseForTrim(request.semanticId) ?? spriteAppearance.fullOutfit,
          fullOutfit: kimonoBaseForTrim(request.semanticId) ?? spriteAppearance.fullOutfit,
          fullOutfitTrim: request.semanticId,
          outfitPrimaryColor: color,
          upperOutfit: "none",
          lowerOutfit: "none"
        });
        break;
      case "upper":
        updateOutfit(request.semanticId, spriteAppearance.lowerOutfit, color, spriteAppearance.outfitSecondaryColor);
        break;
      case "lower":
        updateOutfit(spriteAppearance.upperOutfit, request.semanticId, spriteAppearance.outfitPrimaryColor, color);
        break;
      case "footwear":
        updateSpriteAppearance({
          footwear: request.semanticId,
          footwearColor: color
        });
        break;
      case "cape":
        updateSpriteAppearance({
          cape: request.semanticId,
          capeColor: color
        });
        break;
      case "capeTrim":
        updateSpriteAppearance({
          capeTrim: request.semanticId,
          capeColor: color
        });
        break;
    }
    setOutfitColorPicker(null);
  };

  const valido =
    mode === "outfit" ||
    (nome.trim().length > 0 &&
      cognome.trim().length > 0 &&
      sesso != null &&
      orientamento != null);

  const handleConferma = () => {
    if (!valido) return;
    const sessoFinale = sesso ?? initial?.sesso ?? "M";
    const orientamentoFinale = orientamento ?? initial?.orientamento ?? "Etero";
    void onConferma({
      nome: nome.trim() || initial?.nome || (mode === "outfit" ? "Sacerdote" : "Re"),
      cognome: cognome.trim() || initial?.cognome || "",
      sesso: sessoFinale,
      orientamento: orientamentoFinale,
      razza: initial?.razza ?? RAZZA_RE,
      aspetto: mode === "outfit" ? aspetto : forzaAspettoReTeen(aspetto)
    });
  };

  const tabButtons = CREATION_TABS.map((tab) => (
    <Pressable
      key={tab.id}
      accessibilityRole="tab"
      accessibilityState={{ selected: activeTab === tab.id }}
      style={[styles.tab, !isDesktop && styles.tabMobile, activeTab === tab.id && styles.tabSelected]}
      onPress={() => setActiveTab(tab.id)}
    >
      <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextSelected]}>{tab.label}</Text>
    </Pressable>
  ));

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable
        style={[styles.modalBackdrop, !isDesktop && styles.modalBackdropMobile, isDesktop && modalBackdropFullscreen]}
        onPress={onAnnulla}
      >
        <Pressable
          style={[
            styles.modalCard,
            !isDesktop && modalContentFullscreen,
            !isDesktop && styles.modalCardMobile,
            isDesktop && modalContentFullscreen,
            isDesktop && styles.modalCardDesktop
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {!isDesktop ? (
            <View pointerEvents="none" style={styles.throneBackground}>
              <RoyalThroneBackground />
              <View style={styles.throneTint} />
            </View>
          ) : null}
          <View style={styles.accentLine} />
          <View style={styles.header}>
            <Text style={styles.title}>{titolo ?? (mode === "outfit" ? "Abiti Sacerdote" : mode === "edit" ? "Modifica il Re" : "Crea il tuo Re")}</Text>
          </View>

          <View style={[styles.editorLayout, isDesktop && styles.editorLayoutDesktop]}>
            <View style={[styles.previewColumn, isDesktop && styles.previewColumnDesktop]}>
              <View style={[styles.previewWrap, !isDesktop && styles.previewWrapMobile]}>
                {canRenderCharacter(spriteAppearance, "idle") ? (
                  <CharacterCreationPreview appearance={spriteAppearance} size={isDesktop ? 128 : mobilePreviewSize} compact={!isDesktop} />
                ) : (
                  <View style={styles.lpcPreviewError} accessibilityRole="alert">
                    <Text style={styles.lpcPreviewErrorTitle}>Anteprima LPC non disponibile</Text>
                    <Text style={styles.lpcPreviewErrorText}>
                      Questa combinazione non può essere renderizzata dal sistema Universal LPC.
                    </Text>
                  </View>
                )}
                <View style={[styles.previewMeta, !isDesktop && styles.previewMetaMobile]}>
                  <Text style={styles.previewHint}>Umano · 10 anni</Text>
                  <Pressable style={[styles.randomButton, !isDesktop && styles.randomButtonMobile]} onPress={() => {
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

            <View style={styles.controlsColumn}>
              {isDesktop ? (
                <View style={styles.tabs}>{tabButtons}</View>
              ) : (
                <ScrollView
                  horizontal
                  style={styles.tabsMobileScroll}
                  contentContainerStyle={styles.tabsMobile}
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  accessibilityLabel="Categorie di personalizzazione, scorri orizzontalmente"
                >
                  {tabButtons}
                </ScrollView>
              )}

              <ScrollView
                style={styles.controlsScroll}
                contentContainerStyle={styles.controlsScrollContent}
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
              >
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

              {activeTab === "busto" ? <>
              <Text style={styles.sectionTitle}>Busto</Text>
              {bustoSections.map(({ label, options }) => (
                <View key={label} style={styles.field}>
                  <Text style={styles.label}>{label}</Text>
                  <View style={styles.visualGrid}>{options.map((value) => {
                    const selected = spriteAppearance.fullOutfit === "none" && spriteAppearance.upperOutfit === value;
                    const previewColor = selected
                      ? spriteAppearance.outfitPrimaryColor
                      : firstCompatibleColorForField(spriteAppearance, "outfitPrimaryColor", "outfit", value);
                    return (
                      <AppearanceOption
                        key={value}
                        label={readableOptionName(label, value)}
                        selected={selected}
                        visibleLayers={["outfit"]}
                        appearance={normalizeCharacterAppearance({ ...spriteAppearance, fullOutfit: "none", upperOutfit: value, outfitPrimaryColor: previewColor })}
                        onPress={() => openOutfitColorPicker({
                          kind: "upper",
                          semanticId: value,
                          label: readableOptionName(label, value)
                        })}
                      />
                    );
                  })}</View>
                </View>
              ))}
              </> : null}

              {activeTab === "maniche" ? <>
              <Text style={styles.sectionTitle}>Maniche</Text>
              {manicheSections.map(({ label, options }) => (
                <View key={label} style={styles.field}>
                  <Text style={styles.label}>{label}</Text>
                  <View style={styles.visualGrid}>{options.map((value) => {
                    const isFullOutfit = isKimonoManicheFullOutfit(value);
                    const selected = isFullOutfit
                      ? spriteAppearance.fullOutfit === value
                      : spriteAppearance.fullOutfit === "none" && spriteAppearance.upperOutfit === value;
                    const previewColor = selected
                      ? spriteAppearance.outfitPrimaryColor
                      : firstCompatibleColorForField(
                        spriteAppearance,
                        "outfitPrimaryColor",
                        isFullOutfit ? "fullOutfit" : "outfit",
                        value
                      );
                    const previewAppearance = isFullOutfit
                      ? normalizeCharacterAppearance({ ...spriteAppearance, fullOutfit: value, outfitPrimaryColor: previewColor })
                      : normalizeCharacterAppearance({ ...spriteAppearance, fullOutfit: "none", upperOutfit: value, outfitPrimaryColor: previewColor });
                    return (
                      <AppearanceOption
                        key={value}
                        label={readableOptionName(label, value)}
                        selected={selected}
                        visibleLayers={isFullOutfit ? ["fullOutfit"] : ["outfit"]}
                        appearance={previewAppearance}
                        onPress={() => openOutfitColorPicker({
                          kind: isFullOutfit ? "fullOutfit" : "upper",
                          semanticId: value,
                          label: readableOptionName(label, value)
                        })}
                      />
                    );
                  })}</View>
                </View>
              ))}
              </> : null}

              {activeTab === "veste" ? <>
              <Text style={styles.sectionTitle}>Veste</Text>
              {vesteSections.map(({ label, options }) => (
                <View key={label} style={styles.field}>
                  <Text style={styles.label}>{label}</Text>
                  <View style={styles.visualGrid}>{options.map((value) => {
                    if (isKimonoVesteTrim(value)) {
                      const selected = spriteAppearance.fullOutfitTrim === value;
                      const base = kimonoBaseForTrim(value)!;
                      const previewColor = selected
                        ? spriteAppearance.outfitPrimaryColor
                        : firstCompatibleColorForField(spriteAppearance, "outfitPrimaryColor", "fullOutfit", value);
                      return (
                        <AppearanceOption
                          key={value}
                          label={formatSemanticLabel(value)}
                          selected={selected}
                          visibleLayers={KIMONO_VESTE_PREVIEW_LAYERS}
                          visibleSemanticIds={kimonoVestePreviewSemanticIds(value)}
                          appearance={normalizeCharacterAppearance({
                            ...spriteAppearance,
                            fullOutfit: base,
                            fullOutfitTrim: value,
                            outfitPrimaryColor: previewColor,
                            upperOutfit: "none",
                            lowerOutfit: "none"
                          })}
                          onPress={() => {
                            if (selected) {
                              updateSpriteAppearance({ fullOutfitTrim: "none" });
                              return;
                            }
                            openOutfitColorPicker({
                              kind: "fullOutfitTrim",
                              semanticId: value,
                              label: formatSemanticLabel(value)
                            }, { forceDialog: true });
                          }}
                        />
                      );
                    }

                    const selected = spriteAppearance.fullOutfit === value;
                    const compatibleTrim = kimonoTrimForBase(value);
                    const previewTrim = compatibleTrim && spriteAppearance.fullOutfitTrim === compatibleTrim
                      ? spriteAppearance.fullOutfitTrim
                      : "none";
                    const previewColor = selected
                      ? spriteAppearance.outfitPrimaryColor
                      : firstCompatibleColorForField(spriteAppearance, "outfitPrimaryColor", "fullOutfit", value);
                    return (
                      <AppearanceOption
                        key={value}
                        label={formatSemanticLabel(value)}
                        selected={selected}
                        visibleLayers={KIMONO_VESTE_PREVIEW_LAYERS}
                        visibleSemanticIds={kimonoVestePreviewSemanticIds(value)}
                        appearance={normalizeCharacterAppearance({
                          ...spriteAppearance,
                          fullOutfit: value,
                          fullOutfitTrim: previewTrim,
                          outfitPrimaryColor: previewColor,
                          upperOutfit: "none",
                          lowerOutfit: "none"
                        })}
                        onPress={() => openOutfitColorPicker({
                          kind: "fullOutfit",
                          semanticId: value,
                          label: formatSemanticLabel(value)
                        }, { forceDialog: true })}
                      />
                    );
                  })}</View>
                </View>
              ))}
              </> : null}

              {activeTab === "mantello" ? <>
              <Text style={styles.sectionTitle}>Mantello</Text>
              {mantelloSections.map(({ label, options }) => (
                <View key={label} style={styles.field}>
                  <Text style={styles.label}>{label}</Text>
                  <View style={styles.visualGrid}>{options.map((value) => {
                    if (isCapeTrim(value)) {
                      const selected = spriteAppearance.capeTrim === value;
                      const previewColor = selected
                        ? spriteAppearance.capeColor
                        : firstCompatibleColorForField(spriteAppearance, "capeColor", "cape", value);
                      return (
                        <AppearanceOption
                          key={value}
                          label={formatSemanticLabel(value)}
                          selected={selected}
                          visibleLayers={CAPE_MANTELLO_PREVIEW_LAYERS}
                          visibleSemanticIds={{ cape: value }}
                          appearance={normalizeCharacterAppearance({
                            ...spriteAppearance,
                            cape: spriteAppearance.cape === "none" ? "solid" : spriteAppearance.cape,
                            capeTrim: value,
                            capeColor: previewColor
                          })}
                          onPress={() => {
                            if (selected) {
                              updateSpriteAppearance({ capeTrim: "none" });
                              return;
                            }
                            openOutfitColorPicker({
                              kind: "capeTrim",
                              semanticId: value,
                              label: formatSemanticLabel(value)
                            }, { forceDialog: true });
                          }}
                        />
                      );
                    }

                    const selected = spriteAppearance.cape === value;
                    const previewColor = selected
                      ? spriteAppearance.capeColor
                      : firstCompatibleColorForField(spriteAppearance, "capeColor", "cape", value);
                    return (
                      <AppearanceOption
                        key={`${label}-${value}`}
                        label={formatSemanticLabel(value)}
                        selected={selected}
                        visibleLayers={CAPE_MANTELLO_PREVIEW_LAYERS}
                        visibleSemanticIds={{ cape: value }}
                        appearance={normalizeCharacterAppearance({
                          ...spriteAppearance,
                          cape: value,
                          capeColor: previewColor
                        })}
                        onPress={() => openOutfitColorPicker({
                          kind: "cape",
                          semanticId: value,
                          label: formatSemanticLabel(value)
                        }, { forceDialog: true })}
                      />
                    );
                  })}</View>
                </View>
              ))}
              </> : null}

              {activeTab === "pantaloni" ? <>
              <Text style={styles.sectionTitle}>Pantaloni</Text>
              {pantaloniSections.map(({ label, options }) => (
                <View key={label} style={styles.field}>
                  <Text style={styles.label}>{label}</Text>
                  <View style={styles.visualGrid}>{options.map((value) => {
                    const selected = spriteAppearance.fullOutfit === "none" && spriteAppearance.lowerOutfit === value;
                    const previewColor = selected
                      ? spriteAppearance.outfitSecondaryColor
                      : firstCompatibleColorForField(spriteAppearance, "outfitSecondaryColor", "lowerBody", value);
                    return (
                      <AppearanceOption
                        key={value}
                        label={readableOptionName(label, value)}
                        selected={selected}
                        visibleLayers={["lowerBody"]}
                        appearance={normalizeCharacterAppearance({ ...spriteAppearance, fullOutfit: "none", lowerOutfit: value, outfitSecondaryColor: previewColor })}
                        onPress={() => openOutfitColorPicker({
                          kind: "lower",
                          semanticId: value,
                          label: readableOptionName(label, value)
                        })}
                      />
                    );
                  })}</View>
                </View>
              ))}
              </> : null}

              {activeTab === "gonne" ? <>
              <Text style={styles.sectionTitle}>Gonne</Text>
              {gonneSections.map(({ label, options }) => (
                <View key={label} style={styles.field}>
                  <Text style={styles.label}>{label}</Text>
                  <View style={styles.visualGrid}>{options.map((value) => {
                    const selected = spriteAppearance.fullOutfit === "none" && spriteAppearance.lowerOutfit === value;
                    const previewColor = selected
                      ? spriteAppearance.outfitSecondaryColor
                      : firstCompatibleColorForField(spriteAppearance, "outfitSecondaryColor", "lowerBody", value);
                    return (
                      <AppearanceOption
                        key={value}
                        label={readableOptionName(label, value)}
                        selected={selected}
                        visibleLayers={["lowerBody"]}
                        appearance={normalizeCharacterAppearance({ ...spriteAppearance, fullOutfit: "none", lowerOutfit: value, outfitSecondaryColor: previewColor })}
                        onPress={() => openOutfitColorPicker({
                          kind: "lower",
                          semanticId: value,
                          label: readableOptionName(label, value)
                        })}
                      />
                    );
                  })}</View>
                </View>
              ))}
              </> : null}

              {activeTab === "scarpe" ? <>
              <Text style={styles.sectionTitle}>Scarpe</Text>
              {scarpeFootwearSections.map(([label, matches]) => {
                const options = catalogOptions.footwear.filter((value) => matches.some((match) => value.includes(match)));
                if (options.length === 0) return null;
                return <View key={label} style={styles.field}>
                  <Text style={styles.label}>{label}</Text>
                  <View style={styles.visualGrid}>{options.map((value) => {
                    const selected = spriteAppearance.footwear === value;
                    const previewColor = selected
                      ? spriteAppearance.footwearColor
                      : firstCompatibleColorForField(spriteAppearance, "footwear", "footwear", value);
                    return (
                      <AppearanceOption
                        key={value}
                        label={readableOptionName(label, value.replace(/^feet_/, ""))}
                        selected={selected}
                        visibleLayers={["footwear"]}
                        appearance={normalizeCharacterAppearance({ ...spriteAppearance, footwear: value, footwearColor: previewColor })}
                        onPress={() => openOutfitColorPicker({
                          kind: "footwear",
                          semanticId: value,
                          label: readableOptionName(label, value.replace(/^feet_/, ""))
                        })}
                      />
                    );
                  })}</View>
                </View>;
              })}
              </> : null}

              {activeTab === "calze" ? <>
              <Text style={styles.sectionTitle}>Calze</Text>
              {calzeFootwearSections.map(([label, matches]) => {
                const options = catalogOptions.footwear.filter((value) => matches.some((match) => value.includes(match)));
                if (options.length === 0) return null;
                return <View key={label} style={styles.field}>
                  <Text style={styles.label}>{label}</Text>
                  <View style={styles.visualGrid}>{options.map((value) => {
                    const selected = spriteAppearance.footwear === value;
                    const previewColor = selected
                      ? spriteAppearance.footwearColor
                      : firstCompatibleColorForField(spriteAppearance, "footwear", "footwear", value);
                    return (
                      <AppearanceOption
                        key={value}
                        label={readableOptionName(label, value.replace(/^feet_/, ""))}
                        selected={selected}
                        visibleLayers={["footwear"]}
                        appearance={normalizeCharacterAppearance({ ...spriteAppearance, footwear: value, footwearColor: previewColor })}
                        onPress={() => openOutfitColorPicker({
                          kind: "footwear",
                          semanticId: value,
                          label: readableOptionName(label, value.replace(/^feet_/, ""))
                        })}
                      />
                    );
                  })}</View>
                </View>;
              })}
              </> : null}
              </ScrollView>
            </View>
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
            <Text style={styles.confirmButtonText}>{mode === "outfit" ? "Salva abiti" : mode === "edit" ? "Salva modifiche" : "Inizia il tuo regno"}</Text>
          </Pressable>

          {onAnnulla ? (
            <Pressable style={styles.colorPickerCancel} onPress={onAnnulla}>
              <Text style={styles.colorPickerCancelText}>Annulla</Text>
            </Pressable>
          ) : null}

          {outfitColorPicker ? (
            <OutfitColorPickerDialog
              picker={outfitColorPicker}
              appearance={spriteAppearance}
              onSelect={(color) => applyOutfitColorPicker(outfitColorPicker.request, color)}
              onCancel={() => setOutfitColorPicker(null)}
            />
          ) : null}
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
  modalBackdropMobile: {
    padding: 0,
    backgroundColor: "#040e28",
    justifyContent: "flex-start",
    alignItems: "stretch"
  },
  throneBackground: {
    position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
    overflow: "hidden"
  },
  throneTint: {
    position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: "rgba(3, 12, 37, 0.31)"
  },
  modalCardMobile: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderRadius: 0,
    minWidth: 0,
    width: "100%",
    maxWidth: "100%",
    paddingHorizontal: 14,
    paddingTop: 20,
    paddingBottom: 16,
    elevation: 0,
    shadowOpacity: 0
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
    marginBottom: 8,
    flexShrink: 0
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#f1f5f9",
    textAlign: "center",
    letterSpacing: 0.3
  },
  modalCardDesktop: { width: "94%", maxWidth: 1040, height: "92%", borderRadius: 20, padding: 24 },
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
  controlsColumn: { flex: 1, minHeight: 0, minWidth: 0 },
  controlsScroll: { flex: 1, minHeight: 0 },
  controlsScrollContent: { paddingRight: 8, paddingBottom: 18 },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  tabsMobileScroll: { flexGrow: 0, flexShrink: 0, marginBottom: 8 },
  tabsMobile: { flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 16 },
  tabMobile: { minWidth: 84, alignItems: "center", paddingHorizontal: 12, paddingVertical: 10 },
  tab: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 9, borderWidth: 1, borderColor: "rgba(148, 163, 184, 0.35)", backgroundColor: "rgba(30, 41, 59, 0.72)" },
  tabSelected: { borderColor: "#60a5fa", backgroundColor: "rgba(59, 130, 246, 0.24)" },
  tabText: { color: "rgba(203, 213, 245, 0.76)", fontSize: 12, fontWeight: "700" },
  tabTextSelected: { color: "#eff6ff" },
  previewWrap: { alignItems: "center", marginBottom: 18, gap: 10, backgroundColor: "rgba(120,83,45,0.16)", borderWidth: 1, borderColor: "rgba(214,195,155,0.25)", borderRadius: 14, padding: 14 },
  previewWrapMobile: { marginBottom: 8, padding: 0, gap: 5, borderWidth: 0, backgroundColor: "transparent" },
  lpcPreviewError: {
    width: "100%",
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.5)",
    backgroundColor: "rgba(127, 29, 29, 0.18)"
  },
  lpcPreviewErrorTitle: {
    color: "#fecaca",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center"
  },
  lpcPreviewErrorText: {
    color: "rgba(254, 226, 226, 0.82)",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center"
  },
  previewMeta: { alignItems: "center", gap: 8 },
  previewMetaMobile: { gap: 4 },
  previewHint: { color: "#f3ddb0", fontSize: 12, fontWeight: "800", textTransform: "capitalize" },
  randomButton: { backgroundColor: "#5c3b20", borderWidth: 1, borderColor: "#d6b56f", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  randomButtonMobile: { paddingVertical: 5, paddingHorizontal: 12 },
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
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 44,
    borderWidth: 2,
    borderColor: "transparent",
    position: "relative"
  },
  visualOptionSelected: {
    borderColor: "#38bdf8",
    borderWidth: 4,
    backgroundColor: "rgba(59, 130, 246, 0.38)",
    shadowColor: "#60a5fa",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 12,
    elevation: 8
  },
  selectionRing: {
    ...StyleSheet.absoluteFill,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: "rgba(191, 219, 254, 0.95)",
    zIndex: 2
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
  },
  colorPickerOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
    alignItems: "center",
    justifyContent: "center",
    padding: 16
  },
  colorPickerBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(2, 6, 23, 0.72)"
  },
  colorPickerCard: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "78%",
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
    padding: 18,
    zIndex: 21
  },
  colorPickerTitle: {
    color: "#f1f5f9",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center"
  },
  colorPickerSubtitle: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 14
  },
  colorPickerScroll: {
    maxHeight: 360
  },
  colorPickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    paddingBottom: 8
  },
  colorPickerCancel: {
    marginTop: 12,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)"
  },
  colorPickerCancelText: {
    color: "rgba(203, 213, 245, 0.85)",
    fontSize: 12,
    fontWeight: "700"
  }
});
