import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Asset } from "expo-asset";

import type { PhaserMapActions, PhaserMapSnapshot } from "../phaser/adapters/mapSceneBridge";
import { LPC_ASSET_SOURCES } from "../character-system/generated/lpcAssetSources";
import { canRenderCharacter, resolveCharacterLayers } from "../character-system/registry";

const lpcLayerUriCache = new Map<string, string>();
/** Dopo il primo caricamento riuscito, i rimontaggi evitano l’overlay immediato. */
let lpcSessionWarmedOnce = false;

function getLpcLayerUrl(sourceId: string): string | undefined {
  const source = LPC_ASSET_SOURCES[sourceId as keyof typeof LPC_ASSET_SOURCES];
  if (!source) return undefined;
  const cached = lpcLayerUriCache.get(sourceId);
  if (cached) return cached;
  const uri = Asset.fromModule(source).uri;
  if (uri) lpcLayerUriCache.set(sourceId, uri);
  return uri;
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

function collectSnapshotLpcSourceIds(snapshot: PhaserMapSnapshot): string[] {
  const sourceIds = new Set<string>();
  for (const character of snapshot.characters) {
    const appearance = character.characterAppearance;
    if (!appearance) continue;
    for (const animation of ["idle", "walk"] as const) {
      if (!canRenderCharacter(appearance, animation)) continue;
      for (const layer of resolveCharacterLayers(appearance, animation)) sourceIds.add(layer.sourceId);
    }
  }
  return [...sourceIds];
}

function snapshotLpcUrlsAlreadyWarm(snapshot: PhaserMapSnapshot): boolean {
  const ids = collectSnapshotLpcSourceIds(snapshot);
  if (ids.length === 0) return lpcSessionWarmedOnce;
  return ids.every((id) => lpcLayerUriCache.has(id) || !LPC_ASSET_SOURCES[id as keyof typeof LPC_ASSET_SOURCES]);
}

const SPRITESHEET = require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/spritesheet-full.png");
const GOLEM_SHEET = require("../../assets/pixel-art/characters/stone-golem.png");
const COMMAND_CENTER = require("../../assets/pixel-art/buildings/command-center.png");
const DORMITORY = require("../../assets/pixel-art/buildings/dormitory.png");
const GREENHOUSE = require("../../assets/pixel-art/buildings/greenhouse.png");
const FRONTIER_HUT = require("../../assets/pixel-art/buildings/frontier-hut.png");

type Props = PhaserMapActions & {
  snapshot: PhaserMapSnapshot;
};

export type PhaserMapSurfaceHandle = {
  refreshViewport: () => void;
  centerOnCell: (cellIndex: number, options?: { zoomIn?: boolean }) => void;
};

/** Superficie WebGL. React le passa dati e azioni, senza partecipare al render loop. */
export const PhaserMapSurface = forwardRef<PhaserMapSurfaceHandle, Props>(function PhaserMapSurface(
  {
    snapshot,
    onCellPress,
    onCellHover,
    onCharacterPress,
    onCharacterDoublePress,
    onCharacterPathComplete,
    onCharacterStepAttempt,
    onCharacterIdleStepAttempt,
    onCharacterChatChange,
    onCharacterChatFinished,
    onCharacterPathBlocked,
    onDragStateChange,
    onCharacterAssetsReady
  },
  ref
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<{
    game: import("phaser").Game;
    bridge: import("../phaser/adapters/mapSceneBridge").MapSceneBridge;
  } | null>(null);
  const [charactersReady, setCharactersReady] = useState(false);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(() => !snapshotLpcUrlsAlreadyWarm(snapshot));
  const onCharacterAssetsReadyRef = useRef(onCharacterAssetsReady);
  onCharacterAssetsReadyRef.current = onCharacterAssetsReady;
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  useImperativeHandle(
    ref,
    () => ({
      refreshViewport: () => {
        const runtime = runtimeRef.current;
        const host = hostRef.current;
        if (!runtime || !host) return;
        const w = host.clientWidth;
        const h = host.clientHeight;
        if (w > 0 && h > 0) runtime.game.scale.resize(w, h);
        runtime.bridge.refreshViewport();
      },
      centerOnCell: (cellIndex, options) => {
        runtimeRef.current?.bridge.centerOnCell(cellIndex, options);
      }
    }),
    []
  );

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let delayedOverlayTimer: ReturnType<typeof setTimeout> | undefined;
    setCharactersReady(false);

    const alreadyWarm = snapshotLpcUrlsAlreadyWarm(snapshotRef.current);
    if (alreadyWarm) {
      // Rimontaggio: mostra overlay solo se Phaser impiega più di ~200ms.
      setShowLoadingOverlay(false);
      delayedOverlayTimer = setTimeout(() => {
        if (!cancelled) setShowLoadingOverlay(true);
      }, 200);
    } else {
      setShowLoadingOverlay(true);
    }

    const markReady = () => {
      if (cancelled) return;
      lpcSessionWarmedOnce = true;
      setCharactersReady(true);
      setShowLoadingOverlay(false);
      if (delayedOverlayTimer) clearTimeout(delayedOverlayTimer);
      onCharacterAssetsReadyRef.current?.();
    };

    void (async () => {
      const Phaser = (await import("phaser")).default;
      const { MapSceneBridge } = await import("../phaser/adapters/mapSceneBridge");
      const { KingdomMapScene } = await import("../phaser/scenes/KingdomMapScene");
      if (cancelled || !hostRef.current) return;

      const initialSnapshot = snapshotRef.current;
      await warmLpcLayerUrls(collectSnapshotLpcSourceIds(initialSnapshot));
      if (cancelled || !hostRef.current) return;

      const bridge = new MapSceneBridge(initialSnapshot, {
        onCellPress,
        onCellHover,
        onCharacterPress,
        onCharacterDoublePress,
        onCharacterPathComplete,
        onCharacterStepAttempt,
        onCharacterIdleStepAttempt,
        onCharacterChatChange,
        onCharacterChatFinished,
        onCharacterPathBlocked,
        onDragStateChange,
        onCharacterAssetsReady: markReady
      });
      const sheetUrl = Asset.fromModule(SPRITESHEET).uri;
      const artUrls = {
        golem: Asset.fromModule(GOLEM_SHEET).uri,
        getLpcLayerUrl: getLpcLayerUrl,
        buildings: {
          "command-center": Asset.fromModule(COMMAND_CENTER).uri,
          dormitory: Asset.fromModule(DORMITORY).uri,
          greenhouse: Asset.fromModule(GREENHOUSE).uri,
          "frontier-hut": Asset.fromModule(FRONTIER_HUT).uri
        }
      };
      const host = hostRef.current;
      const game = new Phaser.Game({
        type: Phaser.CANVAS,
        parent: host,
        backgroundColor: "#18291c",
        transparent: false,
        scale: {
          mode: Phaser.Scale.RESIZE,
          width: host.clientWidth || 800,
          height: host.clientHeight || 600,
          autoRound: true
        },
        render: {
          antialias: false,
          pixelArt: true,
          roundPixels: true
        },
        scene: [new KingdomMapScene(bridge, sheetUrl, artUrls)]
      });
      runtimeRef.current = { game, bridge };

      // Assicura che il canvas segua sempre il contenitore a schermo intero.
      resizeObserver = new ResizeObserver(() => {
        if (!runtimeRef.current || !hostRef.current) return;
        const w = hostRef.current.clientWidth;
        const h = hostRef.current.clientHeight;
        if (w > 0 && h > 0) {
          runtimeRef.current.game.scale.resize(w, h);
        }
      });
      resizeObserver.observe(host);
      if (host.clientWidth > 0 && host.clientHeight > 0) {
        game.scale.resize(host.clientWidth, host.clientHeight);
      }
    })();

    return () => {
      cancelled = true;
      if (delayedOverlayTimer) clearTimeout(delayedOverlayTimer);
      resizeObserver?.disconnect();
      const runtime = runtimeRef.current;
      if (runtime) {
        runtime.game.scale.stopListeners();
        runtime.game.loop.stop();
        runtime.game.destroy(true);
      }
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    runtimeRef.current?.bridge.setSnapshot(snapshot);
  }, [snapshot]);

  useEffect(() => {
    runtimeRef.current?.bridge.setActions({
      onCellPress,
      onCellHover,
      onCharacterPress,
      onCharacterDoublePress,
      onCharacterPathComplete,
      onCharacterStepAttempt,
      onCharacterIdleStepAttempt,
      onCharacterChatChange,
      onCharacterChatFinished,
      onCharacterPathBlocked,
      onDragStateChange,
      onCharacterAssetsReady: () => {
        lpcSessionWarmedOnce = true;
        setCharactersReady(true);
        setShowLoadingOverlay(false);
        onCharacterAssetsReadyRef.current?.();
      }
    });
  }, [
    onCellPress,
    onCellHover,
    onCharacterPress,
    onCharacterDoublePress,
    onCharacterPathComplete,
    onCharacterStepAttempt,
    onCharacterIdleStepAttempt,
    onCharacterChatChange,
    onCharacterChatFinished,
    onCharacterPathBlocked,
    onDragStateChange
  ]);

  return (
    <View style={styles.root}>
      <div ref={hostRef} style={hostStyle} />
      {!charactersReady && showLoadingOverlay ? (
        <View style={styles.loadingOverlay} pointerEvents="auto" accessibilityRole="progressbar">
          <View style={styles.loadingCard}>
            <Text style={styles.loadingTitle}>Preparazione abitanti</Text>
            <Text style={styles.loadingSubtitle}>Carico gli aspetti personalizzati…</Text>
            <ActivityIndicator size="small" color="#93c5fd" style={styles.loadingSpinner} />
          </View>
        </View>
      ) : null}
    </View>
  );
});

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
