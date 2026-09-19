import React, { useCallback, useEffect, useRef, useState } from "react";
import { Asset } from "expo-asset";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import type { PhaserMapActions, PhaserMapSnapshot } from "../phaser/adapters/mapSceneBridge";
import { LPC_ASSET_SOURCES } from "../character-system/generated/lpcAssetSources";
import { canRenderCharacter, resolveCharacterLayers } from "../character-system/registry";

const lpcLayerUriCache = new Map<string, string>();

function getLpcLayerUrl(sourceId: string): string | undefined {
  const source = LPC_ASSET_SOURCES[sourceId as keyof typeof LPC_ASSET_SOURCES];
  if (!source) return undefined;
  const cached = lpcLayerUriCache.get(sourceId);
  if (cached) return cached;
  const uri = Asset.fromModule(source).uri;
  if (uri) lpcLayerUriCache.set(sourceId, uri);
  return uri;
}

function collectSnapshotLpcSourceIds(snapshot: PhaserMapSnapshot): string[] {
  const ids = new Set<string>();
  for (const character of snapshot.characters) {
    const appearance = character.characterAppearance;
    if (!appearance) continue;
    for (const animation of ["idle", "walk"] as const) {
      if (!canRenderCharacter(appearance, animation)) continue;
      for (const layer of resolveCharacterLayers(appearance, animation)) ids.add(layer.sourceId);
    }
  }
  return [...ids];
}

async function warmLpcLayerUrls(sourceIds: readonly string[]): Promise<void> {
  await Promise.all(
    sourceIds.map(async (sourceId) => {
      if (lpcLayerUriCache.has(sourceId)) return;
      const source = LPC_ASSET_SOURCES[sourceId as keyof typeof LPC_ASSET_SOURCES];
      if (!source) return;
      const asset = Asset.fromModule(source);
      if (!asset.uri) await asset.downloadAsync();
      if (asset.uri) lpcLayerUriCache.set(sourceId, asset.uri);
    })
  );
}

const SPRITESHEET = require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/spritesheet-full.png");
const HUMAN_SHEET = require("../../assets/pixel-art/characters/human-colonist.png");
const GOLEM_SHEET = require("../../assets/pixel-art/characters/stone-golem.png");
const COMMAND_CENTER = require("../../assets/pixel-art/buildings/command-center.png");
const DORMITORY = require("../../assets/pixel-art/buildings/dormitory.png");
const GREENHOUSE = require("../../assets/pixel-art/buildings/greenhouse.png");
const FRONTIER_HUT = require("../../assets/pixel-art/buildings/frontier-hut.png");

type Props = PhaserMapActions & {
  snapshot: PhaserMapSnapshot;
};

/** Superficie WebGL. React le passa dati e azioni, senza partecipare al render loop. */
export function PhaserMapSurface({
  snapshot,
  onCellPress,
  onCellHover,
  onCharacterPress,
  onCharacterDoublePress,
  onCharacterPathComplete,
  onCharacterStepAttempt,
  onCharacterPathBlocked,
  onCharacterIdleStepAttempt,
  onCharacterChatChange,
  onCharacterChatFinished,
  onCharacterAssetsReady,
  onDragStateChange
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<{
    game: import("phaser").Game;
    bridge: import("../phaser/adapters/mapSceneBridge").MapSceneBridge;
  } | null>(null);
  const [charactersReady, setCharactersReady] = useState(false);
  const onCharacterAssetsReadyRef = useRef(onCharacterAssetsReady);
  onCharacterAssetsReadyRef.current = onCharacterAssetsReady;

  const markCharactersReady = useCallback(() => {
    setCharactersReady(true);
    onCharacterAssetsReadyRef.current?.();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setCharactersReady(false);
    void (async () => {
      await warmLpcLayerUrls(collectSnapshotLpcSourceIds(snapshot));
      if (cancelled || !hostRef.current) return;
      const Phaser = (await import("phaser")).default;
      const { MapSceneBridge } = await import("../phaser/adapters/mapSceneBridge");
      const { KingdomMapScene } = await import("../phaser/scenes/KingdomMapScene");
      if (cancelled || !hostRef.current) return;

      const bridge = new MapSceneBridge(snapshot, {
        onCellPress, onCellHover, onCharacterPress, onCharacterDoublePress,
        onCharacterPathComplete, onCharacterStepAttempt, onCharacterPathBlocked,
        onCharacterIdleStepAttempt, onCharacterChatChange, onCharacterChatFinished,
        onCharacterAssetsReady: markCharactersReady,
        onDragStateChange
      });
      const sheetUrl = Asset.fromModule(SPRITESHEET).uri;
      const artUrls = {
        human: Asset.fromModule(HUMAN_SHEET).uri,
        golem: Asset.fromModule(GOLEM_SHEET).uri,
        getLpcLayerUrl,
        buildings: {
          "command-center": Asset.fromModule(COMMAND_CENTER).uri,
          dormitory: Asset.fromModule(DORMITORY).uri,
          greenhouse: Asset.fromModule(GREENHOUSE).uri,
          "frontier-hut": Asset.fromModule(FRONTIER_HUT).uri
        }
      };
      const game = new Phaser.Game({
        type: Phaser.WEBGL,
        parent: hostRef.current,
        backgroundColor: "#18291c",
        transparent: false,
        scale: {
          mode: Phaser.Scale.RESIZE,
          width: "100%",
          height: "100%"
        },
        render: {
          antialias: false,
          pixelArt: false,
          roundPixels: true
        },
        scene: [new KingdomMapScene(bridge, sheetUrl, artUrls)]
      });
      runtimeRef.current = { game, bridge };
    })();

    return () => {
      cancelled = true;
      runtimeRef.current?.game.destroy(true);
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    runtimeRef.current?.bridge.setSnapshot(snapshot);
  }, [snapshot]);

  useEffect(() => {
    runtimeRef.current?.bridge.setActions({
      onCellPress, onCellHover, onCharacterPress, onCharacterDoublePress,
      onCharacterPathComplete, onCharacterStepAttempt, onCharacterPathBlocked,
      onCharacterIdleStepAttempt, onCharacterChatChange, onCharacterChatFinished,
      onCharacterAssetsReady: markCharactersReady,
      onDragStateChange
    });
  }, [onCellPress, onCellHover, onCharacterPress, onCharacterDoublePress, onCharacterPathComplete, onCharacterStepAttempt, onCharacterPathBlocked, onCharacterIdleStepAttempt, onCharacterChatChange, onCharacterChatFinished, markCharactersReady, onDragStateChange]);

  return (
    <View style={styles.root}>
      <div id="kingdom-phaser-host" ref={hostRef} style={hostStyle} />
      {!charactersReady ? (
        <View style={styles.loadingOverlay} pointerEvents="auto" accessibilityRole="progressbar">
          <View style={styles.loadingCard}>
            <Text style={styles.loadingTitle}>Preparazione abitanti</Text>
            <Text style={styles.loadingSubtitle}>Carico gli aspetti personalizzati…</Text>
            <ActivityIndicator size="small" style={styles.loadingSpinner} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const hostStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  overflow: "hidden",
  touchAction: "none"
};

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
    backgroundColor: "#18291c"
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(2, 6, 23, 0.82)",
    zIndex: 5
  },
  loadingCard: {
    minWidth: 260,
    maxWidth: 360,
    paddingVertical: 24,
    paddingHorizontal: 28,
    borderRadius: 16,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
    alignItems: "center"
  },
  loadingTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center"
  },
  loadingSubtitle: {
    color: "rgba(203, 213, 245, 0.75)",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8
  },
  loadingSpinner: {
    marginTop: 18
  }
});
