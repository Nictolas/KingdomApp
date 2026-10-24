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
  const [assetFailed, setAssetFailed] = React.useState(false);
  const [loadedIds, setLoadedIds] = React.useState<ReadonlySet<string>>(() => new Set());
  const layers = React.useMemo(() => resolveCharacterLayers(appearance, animation).filter(layer =>
    (!visibleLayers || visibleLayers.includes(layer.layer)) &&
    (!visibleSemanticIds?.[layer.layer] || visibleSemanticIds[layer.layer] === layer.semanticId)
  ), [appearance, animation, visibleLayers, visibleSemanticIds]);
  const layerIds = React.useMemo(() => [...new Set(layers.map(layer => layer.sourceId))], [layers]);
  const missingSource = layers.some(layer => !LPC_ASSET_SOURCES[layer.sourceId]);
  React.useEffect(() => {
    setAssetFailed(false);
    setLoadedIds(new Set());
  }, [appearance, animation, direction]);
  const canShow = canRenderCharacter(appearance, animation) && !missingSource;
  const allLoaded = layerIds.length > 0 && layerIds.every(id => loadedIds.has(id));
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
        {(!canShow || assetFailed || !allLoaded) && (
          <View style={styles.fallback}>
            <Text style={{ fontSize: Math.max(14, Math.round(size * 0.45)) }}>
              {RACE_FALLBACK[appearance.race] ?? "👤"}
            </Text>
          </View>
        )}
        {canShow && !assetFailed && (
        <View
          style={[
            styles.spriteSlot,
            { left, width: renderSize, height: renderSize },
            faceOnly ? { top } : { bottom },
            !allLoaded && styles.loading
          ]}
        >
          <SpriteCharacterRenderer
            appearance={appearance}
            animation={animation}
            direction={direction}
            size={renderSize}
            animate={animate}
            onAssetError={() => setAssetFailed(true)}
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
  fallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  loading: { opacity: 0 },
  spriteSlot: {
    position: "absolute",
    bottom: 0,
    overflow: "visible"
  }
});
