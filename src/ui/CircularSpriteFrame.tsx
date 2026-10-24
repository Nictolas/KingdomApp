import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { lpcSpriteCircleDiameter } from "../character-system/lpcPack";
import { canRenderCharacter, resolveCharacterLayers } from "../character-system/registry";
import { LPC_ASSET_SOURCES } from "../character-system/generated/lpcAssetSources";
import { SpriteCharacterRenderer } from "../components/SpriteCharacterRenderer";
import type { CharacterAnimationId, CharacterAppearance, CharacterDirection, CharacterLayer } from "../character-system/types";

const FRAME_BORDER = 4;
const RACE_FALLBACK: Record<string, string> = {
  human: "🧑", elf: "🧝", dwarf: "🧔", orc: "👹",
  goblin: "👺", felix: "🐱", skeleton: "💀"
};

export function CircularSpriteFrame({
  appearance,
  size,
  animation = "idle",
  direction = "down",
  animate = true,
  visibleLayers,
  visibleSemanticIds,
  liftPx = 0,
  /** Ritaglia lo sprite sul volto (zoom sulla testa). */
  faceOnly = false
}: {
  appearance: CharacterAppearance;
  size: number;
  animation?: CharacterAnimationId;
  direction?: CharacterDirection;
  animate?: boolean;
  visibleLayers?: readonly CharacterLayer[];
  visibleSemanticIds?: Partial<Record<CharacterLayer, string>>;
  liftPx?: number;
  faceOnly?: boolean;
}) {
  const [failedSource, setFailedSource] = React.useState<string | null>(null);
  const [loadedIds, setLoadedIds] = React.useState<ReadonlySet<string>>(() => new Set());
  const layers = React.useMemo(() => resolveCharacterLayers(appearance, animation).filter(layer =>
    (!visibleLayers || visibleLayers.includes(layer.layer)) &&
    (!visibleSemanticIds?.[layer.layer] || visibleSemanticIds[layer.layer] === layer.semanticId)
  ), [appearance, animation, visibleLayers, visibleSemanticIds]);
  const layerIds = React.useMemo(() => [...new Set(layers.map(layer => layer.sourceId))], [layers]);
  const layerSignature = layerIds.join("|");
  // Core body/head must be present. An optional hat, tool, beard etc. must never
  // prevent the rest of a resident from being drawn.
  const essentialIds = React.useMemo(() => [...new Set(
    layers.filter(layer => layer.layer === "body" || layer.layer === "raceFeatures")
      .map(layer => layer.sourceId)
  )], [layers]);
  const canShow = canRenderCharacter(appearance, animation) &&
    essentialIds.length >= 2 && essentialIds.every(id => Boolean(LPC_ASSET_SOURCES[id]));
  // Do NOT clear loadedIds when appearance changes identity. The game rebuilds
  // equivalent appearance objects on every tick; clearing it lost the cached
  // Image onLoad events and left already-decoded sprites permanently invisible.
  React.useEffect(() => {
    setFailedSource(null);
  }, [layerSignature]);
  const essentialLoaded = essentialIds.every(id => loadedIds.has(id));
  const essentialFailed = failedSource !== null && essentialIds.includes(failedSource);
  const diameter = lpcSpriteCircleDiameter(size);
  const outer = diameter + FRAME_BORDER * 2;
  // Zoom sul volto: la testa LPC sta nella parte alta del frame 64×64.
  const zoom = faceOnly ? 2.9 : 1;
  const renderSize = Math.round(size * zoom);
  const left = (diameter - renderSize) / 2;
  // Dall'alto: salta lo spazio vuoto sopra i capelli e inquadra la faccia.
  const top = faceOnly ? Math.round(-renderSize * 0.14) : undefined;
  const bottom = faceOnly ? undefined : liftPx;
  return (
    <View style={[styles.outer, { width: outer, height: outer, borderRadius: outer / 2 }]}>
      <View style={[styles.inner, { width: diameter, height: diameter, borderRadius: diameter / 2 }]}>
        {(!canShow || essentialFailed || !essentialLoaded) && (
          <View style={styles.fallback} pointerEvents="none">
            <Text style={{ fontSize: Math.max(14, Math.round(size * 0.45)) }}>
              {RACE_FALLBACK[appearance.race] ?? "👤"}
            </Text>
          </View>
        )}
        {canShow && !essentialFailed && (
          <View
            style={[
              styles.spriteSlot,
              { left, width: renderSize, height: renderSize },
              faceOnly ? { top } : { bottom }
            ]}
          >
            <SpriteCharacterRenderer
              appearance={appearance}
              animation={animation}
              direction={direction}
              size={renderSize}
              animate={animate}
              onAssetError={(sourceId) => setFailedSource(sourceId)}
              onAssetLoad={(sourceId) => setLoadedIds(current => {
                if (current.has(sourceId)) return current;
                const next = new Set(current);
                next.add(sourceId);
                return next;
              })}
              visibleLayers={visibleLayers}
              visibleSemanticIds={visibleSemanticIds}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: "#0b1220",
    padding: FRAME_BORDER,
    alignItems: "center",
    justifyContent: "center"
  },
  inner: {
    backgroundColor: "#243447",
    overflow: "hidden",
    position: "relative"
  },
  fallback: {
    position: "absolute", top: 0, bottom: 0, left: 0, right: 0,
    alignItems: "center", justifyContent: "center"
  },
  spriteSlot: {
    position: "absolute",
    bottom: 0,
    overflow: "visible"
  }
});
