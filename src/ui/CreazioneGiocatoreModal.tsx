import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  useWindowDimensions,
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
import { generaIdentitaReCasuale } from "../game/nomiUmani";
import { DESKTOP_MODAL_BREAKPOINT, modalBackdropFullscreen, modalContentFullscreen } from "./modalFullscreenStyles";
import { CharacterCreationPreview } from "./CharacterCreationPreview";
import { RoyalThroneBackground } from "./RoyalThroneBackground";
import { LPC_RUNTIME_MANIFEST, canRenderCharacter, compatibleCatalogOptions, compatibleColorsForField, firstCompatibleColorForField, firstCompatibleHairColor } from "../character-system/registry";
import { bodyFamilyFor, isGuardChainmailOutfit, normalizeCharacterAppearance, stripGuardChainmailFromCivilian } from "../character-system/appearance";
import { groupCapeMantelloSections, isCapeTrim } from "../character-system/capeMantello";
import {
  filterPantsOptions,
  filterSkirtsOptions,
  filterTorsoOutfitOptions,
  groupCatalogOptionsByLpcSections,
  groupKimonoVesteSections,
  isKimonoVesteAbito,
  isKimonoVesteTrim,
  kimonoBaseForTrim,
  kimonoTrimForBase,
  LPC_MANICHE_TORSO_SECTIONS,
  LPC_PANTS_SECTIONS,
  LPC_SKIRTS_SECTIONS,
  LPC_TORSO_SECTIONS,
  partitionLongsleeveTorsoOptions
} from "../character-system/lpcCatalogSections";
import { CircularSpriteFrame } from "./CircularSpriteFrame";
import type { CharacterAppearance, CharacterLayer } from "../character-system/types";
import { applicaSoloAbitoSacerdote, soloCampiAbitoSacerdote } from "../game/soloAbitoSacerdote";

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


const COLOR_HINTS: Record<string, string> = {
  base: "#75849a", black: "#28232c", white: "#eee9df", grey: "#9299a7",
  gray: "#9299a7", silver: "#bbc0ca", steel: "#97a6bd", iron: "#919bab",
  gold: "#e2b357", yellow: "#ebca59", blonde: "#dfb354", blond: "#dfb354",
  red: "#b74740", auburn: "#9c4e32", brown: "#865330", orange: "#dc883d",
  green: "#39895b", blue: "#447bc2", cyan: "#4bb9bb", navy: "#283d69",
  teal: "#319d95", purple: "#946fc0", violet: "#916ab1", pink: "#d682a1",
  cream: "#e4d3b0", beige: "#cdb38c", tan: "#b58e64", copper: "#b2794e"
};
function swatchColor(id: string): string {
  if (/^#[a-f0-9]{6}$/i.test(id)) return id;
  const normalized = id.toLowerCase().replace(/[_-]/g, " ");
  return COLOR_HINTS[normalized] ?? COLOR_HINTS[normalized.split(" ").find((word) => COLOR_HINTS[word]) ?? ""] ?? "#75849a";
}
function ColorPalette({ colors, selected, onSelect }: {
  colors: readonly string[];
  selected: string;
  onSelect: (color: string) => void;
}) {
  if (colors.length === 0) return null;
  return (
    <View style={styles.palettePanel}>
      <Text style={styles.paletteTitle}>Colore</Text>
      <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.paletteChoices}>
        {colors.map((color) => (
          <Pressable
            key={color}
            accessibilityRole="button"
            accessibilityLabel={"Colore: " + formatSemanticLabel(color)}
            accessibilityState={{ selected: selected === color }}
            onPress={() => onSelect(color)}
            style={[styles.paletteChoice, selected === color && styles.paletteChoiceSelected]}
          >
            <View style={[styles.paletteDot, { backgroundColor: swatchColor(color) }]} />
            <Text numberOfLines={1} style={[styles.paletteLabel, selected === color && styles.paletteLabelSelected]}>{formatSemanticLabel(color)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

type OutfitColorPickerKind = "upper" | "sleeve" | "fullOutfit" | "fullOutfitTrim" | "cape" | "capeTrim" | "lower" | "footwear";

type OutfitColorPickerRequest = {
  kind: OutfitColorPickerKind;
  semanticId: string;
  label: string;
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
    case "sleeve":
      return compatibleColorsForField(appearance, "outfitPrimaryColor", "outfit", request.semanticId);
    case "lower":
      return compatibleColorsForField(appearance, "outfitSecondaryColor", "lowerBody", request.semanticId);
    case "footwear":
      return compatibleColorsForField(appearance, "footwear", "footwear", request.semanticId);
  }
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
  const [paletteSelections, setPaletteSelections] = useState<Partial<Record<CreationTab, string>>>({});
  const [stableWebHeight, setStableWebHeight] = useState<number | null>(null);
  const categoryScrollRef = useRef<ScrollView>(null);

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
    // La Chainmail appartiene solo alle Guardie, non all'editor del Re/Sacerdote.
    const initialAppearance = source?.aspetto ?? ASPETTO_RE_DEFAULT;
    setAspetto(initialAppearance.characterAppearance
      ? { ...initialAppearance, characterAppearance: stripGuardChainmailFromCivilian(initialAppearance.characterAppearance) }
      : initialAppearance);
    setActiveTab(mode === "outfit" ? "busto" : "identity");
    setPaletteSelections({});
  }, [visible, mode, initial]);

  // iOS Safari modifica l'altezza visibile quando apre la tastiera.
  // Manteniamo il layout della creazione ancorato all'altezza iniziale.
  useEffect(() => {
    if (Platform.OS !== "web" || !visible || typeof window === "undefined") return;
    setStableWebHeight(window.innerHeight);
    const { documentElement, body } = document;
    const previousHtmlOverflow = documentElement.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    documentElement.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      documentElement.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, [visible]);

  const { width, height: windowHeight } = useWindowDimensions();
  const isDesktop = width > DESKTOP_MODAL_BREAKPOINT;
  const height = !isDesktop && Platform.OS === "web" && stableWebHeight !== null
    ? stableWebHeight : windowHeight;
  const compactMobile = !isDesktop && height < 760;
  const mobilePreviewSize = height < 680 ? 78 : height < 860 ? 98 : 116;
  const spriteAppearance = aspetto.characterAppearance ?? creaCharacterAppearance(RAZZA_RE, "teen");
  const catalogOptions = compatibleCatalogOptions(spriteAppearance);
  const torsoOutfitsAll = filterTorsoOutfitOptions(catalogOptions.upperOutfits, spriteAppearance.bodyType).filter((id) => !isGuardChainmailOutfit(id));
  const { manicheSleeves: manicheTorsoOutfits, rest: bustoTorsoOutfits } = partitionLongsleeveTorsoOptions(torsoOutfitsAll, spriteAppearance.bodyType);
  const bustoSections = groupCatalogOptionsByLpcSections(bustoTorsoOutfits, spriteAppearance.bodyType, "outfit", LPC_TORSO_SECTIONS);
  const manicheTorsoSections = groupCatalogOptionsByLpcSections(manicheTorsoOutfits, spriteAppearance.bodyType, "outfit", LPC_MANICHE_TORSO_SECTIONS);
  // Solo gli asset LPC effettivamente sovrapponibili al busto sono maniche.
  // I kimono longsleeve/oversize sono abiti completi: appartengono a "Veste".
  const manicheSections = manicheTorsoSections;
  const vesteSections = groupKimonoVesteSections(
    catalogOptions.fullOutfits,
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
      characterAppearance: normalizeCharacterAppearance({
        ...spriteAppearance,
        ...(mode === "outfit" ? soloCampiAbitoSacerdote(patch) : patch)
      })
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

  const applyOutfitColorPicker = (request: OutfitColorPickerRequest, color: string) => {
    // Keep the palette in sync with the actual color worn when changing an item.
    setPaletteSelections((prev) => ({ ...prev, [activeTab]: color }));
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
      case "sleeve":
        updateSpriteAppearance({ sleeveOutfit: request.semanticId, sleeveColor: color });
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
      aspetto: mode === "outfit"
        ? applicaSoloAbitoSacerdote(initial?.aspetto ?? ASPETTO_OUTFIT_DEFAULT, aspetto)
        : forzaAspettoReTeen(aspetto)
    });
  };


  const categoryColors = useMemo(() => {
    if (activeTab === "identity") return [];
    const sections = activeTab === "busto" ? bustoSections
      : activeTab === "maniche" ? manicheSections
      : activeTab === "veste" ? vesteSections
      : activeTab === "mantello" ? mantelloSections
      : activeTab === "pantaloni" ? pantaloniSections
      : activeTab === "gonne" ? gonneSections : [];
    const options = new Set<string>(
      activeTab === "hair" ? catalogOptions.hairStyles
      : activeTab === "scarpe" ? catalogOptions.footwear.filter((id) => scarpeFootwearSections.some(([, tokens]) => tokens.some((token) => id.includes(token))))
      : activeTab === "calze" ? catalogOptions.footwear.filter((id) => calzeFootwearSections.some(([, tokens]) => tokens.some((token) => id.includes(token))))
      : sections.flatMap(({ options }) => options)
    );
    const slot = activeTab === "hair" ? "hairFront"
      : activeTab === "mantello" ? "cape"
      : activeTab === "pantaloni" || activeTab === "gonne" ? "lowerBody"
      : activeTab === "scarpe" || activeTab === "calze" ? "footwear"
      : activeTab === "veste" ? "fullOutfit" : "outfit";
    const field = activeTab === "mantello" ? "capeColor"
      : activeTab === "pantaloni" || activeTab === "gonne" ? "outfitSecondaryColor"
      : activeTab === "scarpe" || activeTab === "calze" ? "footwear" : "outfitPrimaryColor";
    return [...new Set(LPC_RUNTIME_MANIFEST.assets
      .filter((asset) => asset.bodyType === spriteAppearance.bodyType && options.has(asset.semanticId) &&
        (activeTab === "hair" ? asset.slot === "hairBack" || asset.slot === "hairFront"
        : activeTab === "maniche" ? asset.slot === "outfit" && asset.colorField === field
        : asset.slot === slot && asset.colorField === field))
      .map((asset) => asset.color))].sort();
  }, [activeTab, spriteAppearance.bodyType, spriteAppearance.cape, spriteAppearance.fullOutfit]);

  const currentCategoryColor = activeTab === "hair" ? spriteAppearance.hairColor
    : activeTab === "maniche" ? spriteAppearance.sleeveColor
    : activeTab === "mantello" ? spriteAppearance.capeColor
    : activeTab === "pantaloni" || activeTab === "gonne" ? spriteAppearance.outfitSecondaryColor
    : activeTab === "scarpe" || activeTab === "calze" ? spriteAppearance.footwearColor
    : spriteAppearance.outfitPrimaryColor;
  const selectedCategoryColor = paletteSelections[activeTab] ?? currentCategoryColor;

  const colorForOption = (kind: OutfitColorPickerKind, semanticId: string) => {
    const available = colorsForOutfitPicker(spriteAppearance, { kind, semanticId, label: "" });
    const fallback = kind === "cape" || kind === "capeTrim" ? spriteAppearance.capeColor
      : kind === "sleeve" ? spriteAppearance.sleeveColor
      : kind === "lower" ? spriteAppearance.outfitSecondaryColor
      : kind === "footwear" ? spriteAppearance.footwearColor : spriteAppearance.outfitPrimaryColor;
    return available.includes(selectedCategoryColor) ? selectedCategoryColor
      : available.includes(fallback) ? fallback
      : available.includes("base") ? "base" : available[0] ?? fallback;
  };
  const colorForHairStyle = (style: string) => {
    const available = LPC_RUNTIME_MANIFEST.assets.filter((asset) =>
      asset.bodyType === spriteAppearance.bodyType &&
      (asset.slot === "hairBack" || asset.slot === "hairFront") &&
      asset.semanticId === style
    ).map((asset) => asset.color);
    return available.includes(selectedCategoryColor) ? selectedCategoryColor
      : available.includes(spriteAppearance.hairColor) ? spriteAppearance.hairColor
      : firstCompatibleHairColor(spriteAppearance, style);
  };
  const selectCategoryColor = (color: string) => {
    setPaletteSelections((prev) => ({ ...prev, [activeTab]: color }));
    if (activeTab === "hair") {
      if (spriteAppearance.hairStyle !== "none" && LPC_RUNTIME_MANIFEST.assets.some((asset) =>
        asset.bodyType === spriteAppearance.bodyType && asset.semanticId === spriteAppearance.hairStyle &&
        (asset.slot === "hairBack" || asset.slot === "hairFront") && asset.color === color
      )) updateSpriteAppearance({ hairColor: color });
      return;
    }
    const equipped = activeTab === "mantello" ? spriteAppearance.cape
      : activeTab === "maniche" ? spriteAppearance.sleeveOutfit
      : activeTab === "pantaloni" || activeTab === "gonne" ? spriteAppearance.lowerOutfit
      : activeTab === "scarpe" || activeTab === "calze" ? spriteAppearance.footwear
      : activeTab === "veste" ? spriteAppearance.fullOutfit : spriteAppearance.upperOutfit;
    const categories = activeTab === "busto" ? bustoSections
      : activeTab === "maniche" ? manicheSections
      : activeTab === "veste" ? vesteSections
      : activeTab === "mantello" ? mantelloSections
      : activeTab === "pantaloni" ? pantaloniSections
      : activeTab === "gonne" ? gonneSections : [];
    const inCategory = activeTab === "scarpe" ? scarpeFootwearSections.some(([, tokens]) => tokens.some((token) => equipped.includes(token)))
      : activeTab === "calze" ? calzeFootwearSections.some(([, tokens]) => tokens.some((token) => equipped.includes(token)))
      : categories.some(({ options }) => options.includes(equipped));
    if (!inCategory) return;
    const kind: OutfitColorPickerKind = activeTab === "mantello" ? "cape"
      : activeTab === "maniche" ? "sleeve"
      : activeTab === "pantaloni" || activeTab === "gonne" ? "lower"
      : activeTab === "scarpe" || activeTab === "calze" ? "footwear"
      : activeTab === "veste" ? "fullOutfit" : "upper";
    if (!colorsForOutfitPicker(spriteAppearance, { kind, semanticId: equipped, label: "" }).includes(color)) return;
    if (kind === "cape") updateSpriteAppearance({ capeColor: color });
    else if (kind === "sleeve") updateSpriteAppearance({ sleeveColor: color });
    else if (kind === "lower") updateSpriteAppearance({ outfitSecondaryColor: color });
    else if (kind === "footwear") updateSpriteAppearance({ footwearColor: color });
    else updateSpriteAppearance({ outfitPrimaryColor: color });
  };

  // La paginazione mobile deve usare le stesse schede visibili, evitando che le frecce
  // possano riaprire Identità o Capelli in modalità abito sacerdotale.
  const selectableTabs = CREATION_TABS
    .filter((tab) => mode !== "outfit" || (tab.id !== "identity" && tab.id !== "hair"));
  const activeTabIndex = selectableTabs.findIndex((tab) => tab.id === activeTab);
  const selectTab = (tabId: CreationTab) => {
    const index = selectableTabs.findIndex((tab) => tab.id === tabId);
    if (index < 0) return;
    setActiveTab(tabId);
    if (!isDesktop) {
      categoryScrollRef.current?.scrollTo({ x: Math.max(0, (index - 1) * 92), animated: true });
    }
  };
  const stepTab = (delta: -1 | 1) => {
    const target = selectableTabs[Math.min(selectableTabs.length - 1, Math.max(0, activeTabIndex + delta))];
    if (target) selectTab(target.id);
  };

  const tabButtons = selectableTabs.map((tab) => (
    <Pressable
      key={tab.id}
      accessibilityRole="tab"
      accessibilityState={{ selected: activeTab === tab.id }}
      style={[styles.tab, !isDesktop && styles.tabMobile, activeTab === tab.id && styles.tabSelected]}
      onPress={() => selectTab(tab.id)}
    >
      <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextSelected]}>{tab.label}</Text>
    </Pressable>
  ));

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView
        style={[
          styles.keyboardRoot,
          !isDesktop && Platform.OS === "web" && stableWebHeight !== null
            ? { height: stableWebHeight, minHeight: stableWebHeight, flexShrink: 0 }
            : null
        ]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <Pressable
        style={[styles.modalBackdrop, !isDesktop && styles.modalBackdropMobile, isDesktop && modalBackdropFullscreen]}
        onPress={onAnnulla}
      >
        <Pressable
          style={[
            styles.modalCard,
            !isDesktop && modalContentFullscreen,
            !isDesktop && styles.modalCardMobile,
            compactMobile && styles.modalCardMobileCompact,
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
          <View style={[styles.header, compactMobile && styles.headerCompact]}>
            <Text style={styles.title}>{titolo ?? (mode === "outfit" ? "Abiti Sacerdote" : mode === "edit" ? "Modifica il Re" : "Crea il tuo Re")}</Text>
          </View>

          <View style={[styles.editorLayout, isDesktop && styles.editorLayoutDesktop]}>
            {(
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
                  <Text style={styles.previewHint}>{mode === "outfit" ? "Anteprima abito" : "Umano · 10 anni"}</Text>
                  {mode !== "outfit" && (
                  <Pressable style={[styles.randomButton, !isDesktop && styles.randomButtonMobile]} onPress={() => {
                    const identita = mode === "create" ? generaIdentitaReCasuale() : null;
                    if (identita) {
                      setNome(identita.nome);
                      setCognome(identita.cognome);
                      setSesso(identita.sesso);
                      setOrientamento(identita.orientamento);
                    }
                    const casualeTeen = generaAspettoCasuale(RAZZA_RE, Math.random, { eta: 15, sesso: identita?.sesso ?? sesso ?? undefined });
                    const next = forzaAspettoReTeen(casualeTeen);
                    if (next.characterAppearance && canRenderCharacter(next.characterAppearance, "idle")) {
                      setAspetto(next);
                      setPaletteSelections({});
                    }
                  }}>
                    <Text style={styles.randomButtonText}>🎲 Sorprendimi</Text>
                  </Pressable>
                  )}
                </View>
              </View>
            </View>
            )}

            <View style={styles.controlsColumn}>
              {isDesktop ? (
                <View style={styles.tabs}>{tabButtons}</View>
              ) : (
                <View style={styles.tabsMobileRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Categoria precedente"
                    accessibilityState={{ disabled: activeTabIndex <= 0 }}
                    disabled={activeTabIndex <= 0}
                    style={[styles.tabStepButton, activeTabIndex <= 0 && styles.tabStepButtonDisabled]}
                    onPress={() => stepTab(-1)}
                  >
                    <Text style={styles.tabStepText}>‹</Text>
                  </Pressable>
                  <ScrollView
                    ref={categoryScrollRef}
                    horizontal
                    style={styles.tabsMobileScroll}
                    contentContainerStyle={styles.tabsMobile}
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    accessibilityLabel="Categorie di personalizzazione, scorri orizzontalmente"
                  >
                    {tabButtons}
                  </ScrollView>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Categoria successiva"
                    accessibilityState={{ disabled: activeTabIndex >= selectableTabs.length - 1 }}
                    disabled={activeTabIndex >= selectableTabs.length - 1}
                    style={[styles.tabStepButton, activeTabIndex >= selectableTabs.length - 1 && styles.tabStepButtonDisabled]}
                    onPress={() => stepTab(1)}
                  >
                    <Text style={styles.tabStepText}>›</Text>
                  </Pressable>
                </View>
              )}

              <ScrollView
                style={styles.controlsScroll}
                contentContainerStyle={styles.controlsScrollContent}
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
              >
              {activeTab !== "identity" ? <ColorPalette colors={categoryColors} selected={selectedCategoryColor} onSelect={selectCategoryColor} /> : null}
              {mode !== "outfit" && activeTab === "identity" ? <>
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
              {spriteAppearance.race !== "orc" && spriteAppearance.race !== "goblin" ? (
              <View style={styles.field}>
                <Text style={styles.label}>Colore pelle</Text>
                <View style={styles.visualGrid}>{catalogOptions.skinTones.map((value) => <AppearanceOption key={value} label={readableOptionName("Colore pelle", value)} selected={spriteAppearance.skinTone === value} visibleLayers={["body", "raceFeatures"]} appearance={normalizeCharacterAppearance({ ...spriteAppearance, skinTone: value })} onPress={() => updateSpriteAppearance({ skinTone: value })} />)}</View>
              </View>
              ) : (
                <Text style={styles.label}>Pelle verde obbligatoria per orchi e goblin.</Text>
              )}
              </> : null}

              {mode !== "outfit" && activeTab === "hair" ? <>
              <Text style={styles.sectionTitle}>Capelli</Text>

              <View style={styles.field}>
                <Text style={styles.label}>Stile capelli</Text>
                <View style={styles.visualGrid}>{catalogOptions.hairStyles.map((value) => {
                  const hairColor = colorForHairStyle(value);
                  return <AppearanceOption key={value} label={readableOptionName("Stile capelli", value)} selected={spriteAppearance.hairStyle === value} visibleLayers={["hairBack", "hairFront"]} appearance={normalizeCharacterAppearance({ ...spriteAppearance, hairStyle: value, hairColor })} onPress={() => {
                     if (spriteAppearance.hairStyle === value) {
                       updateSpriteAppearance({ hairStyle: "none", hairColor: "none" });
                     } else {
                       setPaletteSelections((prev) => ({ ...prev, hair: hairColor }));
                       updateSpriteAppearance({ hairStyle: value, hairColor });
                     }
                   }} />;
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
                    const previewColor = colorForOption("upper", value);
                    return (
                      <AppearanceOption
                        key={value}
                        label={readableOptionName(label, value)}
                        selected={selected}
                        visibleLayers={["outfit"]}
                        appearance={normalizeCharacterAppearance({ ...spriteAppearance, fullOutfit: "none", upperOutfit: value, outfitPrimaryColor: previewColor })}
                        onPress={() => applyOutfitColorPicker({ kind: "upper", semanticId: value, label: formatSemanticLabel(value) }, previewColor)}
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
                    const selected = spriteAppearance.sleeveOutfit === value;
                    const previewColor = colorForOption("sleeve", value);
                    return (
                      <AppearanceOption
                        key={value}
                        label={readableOptionName(label, value)}
                        selected={selected}
                        visibleLayers={["outfit"]}
                        visibleSemanticIds={{ outfit: value }}
                        appearance={normalizeCharacterAppearance({ ...spriteAppearance, sleeveOutfit: value, sleeveColor: previewColor })}
                        onPress={() => {
                          if (selected) {
                            updateSpriteAppearance({ sleeveOutfit: "none" });
                          } else {
                            applyOutfitColorPicker({ kind: "sleeve", semanticId: value, label: formatSemanticLabel(value) }, previewColor);
                          }
                        }}
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
                      const previewColor = colorForOption("fullOutfitTrim", value);
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
                            applyOutfitColorPicker({ kind: "fullOutfitTrim", semanticId: value, label: formatSemanticLabel(value) }, previewColor);
                          }}
                        />
                      );
                    }

                    const selected = spriteAppearance.fullOutfit === value;
                    const compatibleTrim = kimonoTrimForBase(value);
                    const previewTrim = compatibleTrim && spriteAppearance.fullOutfitTrim === compatibleTrim
                      ? spriteAppearance.fullOutfitTrim
                      : "none";
                    const previewColor = colorForOption("fullOutfit", value);
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
                        onPress={() => applyOutfitColorPicker({ kind: "fullOutfit", semanticId: value, label: formatSemanticLabel(value) }, previewColor)}
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
                      const previewColor = colorForOption("capeTrim", value);
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
                            applyOutfitColorPicker({ kind: "capeTrim", semanticId: value, label: formatSemanticLabel(value) }, previewColor);
                          }}
                        />
                      );
                    }

                    const selected = spriteAppearance.cape === value;
                    const previewColor = colorForOption("cape", value);
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
                        onPress={() => applyOutfitColorPicker({ kind: "cape", semanticId: value, label: formatSemanticLabel(value) }, previewColor)}
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
                    const previewColor = colorForOption("lower", value);
                    return (
                      <AppearanceOption
                        key={value}
                        label={readableOptionName(label, value)}
                        selected={selected}
                        visibleLayers={["lowerBody"]}
                        appearance={normalizeCharacterAppearance({ ...spriteAppearance, fullOutfit: "none", lowerOutfit: value, outfitSecondaryColor: previewColor })}
                        onPress={() => applyOutfitColorPicker({ kind: "lower", semanticId: value, label: formatSemanticLabel(value) }, previewColor)}
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
                    const previewColor = colorForOption("lower", value);
                    return (
                      <AppearanceOption
                        key={value}
                        label={readableOptionName(label, value)}
                        selected={selected}
                        visibleLayers={["lowerBody"]}
                        appearance={normalizeCharacterAppearance({ ...spriteAppearance, fullOutfit: "none", lowerOutfit: value, outfitSecondaryColor: previewColor })}
                        onPress={() => applyOutfitColorPicker({ kind: "lower", semanticId: value, label: formatSemanticLabel(value) }, previewColor)}
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
                    const previewColor = colorForOption("footwear", value);
                    return (
                      <AppearanceOption
                        key={value}
                        label={readableOptionName(label, value.replace(/^feet_/, ""))}
                        selected={selected}
                        visibleLayers={["footwear"]}
                        appearance={normalizeCharacterAppearance({ ...spriteAppearance, footwear: value, footwearColor: previewColor })}
                        onPress={() => applyOutfitColorPicker({ kind: "footwear", semanticId: value, label: formatSemanticLabel(value) }, previewColor)}
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
                    const previewColor = colorForOption("footwear", value);
                    return (
                      <AppearanceOption
                        key={value}
                        label={readableOptionName(label, value.replace(/^feet_/, ""))}
                        selected={selected}
                        visibleLayers={["footwear"]}
                        appearance={normalizeCharacterAppearance({ ...spriteAppearance, footwear: value, footwearColor: previewColor })}
                        onPress={() => applyOutfitColorPicker({ kind: "footwear", semanticId: value, label: formatSemanticLabel(value) }, previewColor)}
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

        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardRoot: { flex: 1 },

  palettePanel: { marginBottom: 16 },
  paletteTitle: { color: "#f3ddb0", fontSize: 13, fontWeight: "800", marginBottom: 8 },
  paletteChoices: { gap: 8, paddingRight: 12 },
  paletteChoice: { width: 66, minHeight: 62, padding: 5, borderRadius: 10, borderWidth: 1, borderColor: "rgba(148,163,184,0.42)", backgroundColor: "rgba(8,21,47,0.88)", alignItems: "center", justifyContent: "center", gap: 3 },
  paletteChoiceSelected: { borderColor: "#60a5fa", borderWidth: 2, backgroundColor: "rgba(37,99,235,0.28)" },
  paletteDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.55)" },
  paletteLabel: { color: "#cbd5e1", fontSize: 9, fontWeight: "700", textAlign: "center", width: 58 },
  paletteLabelSelected: { color: "#ffffff" },

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
    paddingBottom: 24,
    elevation: 0,
    shadowOpacity: 0
  },
  modalCardMobileCompact: { paddingTop: 10, paddingBottom: 16 },
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
  headerCompact: { marginBottom: 4 },
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
  tabsMobileRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
  tabStepButton: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: "rgba(147,197,253,0.52)", backgroundColor: "rgba(15,35,76,0.88)", alignItems: "center", justifyContent: "center" },
  tabStepButtonDisabled: { opacity: 0.35 },
  tabStepText: { color: "#eff6ff", fontSize: 27, fontWeight: "700" },
  tabsMobileScroll: { flex: 1, minWidth: 0, flexGrow: 1, flexShrink: 1 },
  tabsMobile: { flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 16 },
  tabMobile: { minWidth: 84, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, paddingVertical: 10 },
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
    // Con meno di 16 px Safari iOS ingrandisce automaticamente la pagina al focus.
    fontSize: Platform.OS === "web" ? 16 : 14,
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
