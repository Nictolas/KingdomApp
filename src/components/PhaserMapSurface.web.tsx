import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Asset } from "expo-asset";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import type { PhaserMapActions, PhaserMapSnapshot } from "../phaser/adapters/mapSceneBridge";
import type { PhaserCameraView } from "../phaser/scenes/KingdomMapScene";
import { restoreMapAfterNavigation, recoverStalledPhaserRender } from "../phaser/restoreMapAfterNavigation";
import { LPC_ASSET_SOURCES } from "../character-system/generated/lpcAssetSources";
import { canRenderCharacter, resolveCharacterLayers, CHARACTER_ASSETS } from "../character-system/registry";
import { refineLpcSpriteUrl, LPC_HD_FRAME_PX } from "../character-system/lpcHdRuntime.web";
import type { LpcArtLayer } from "../character-system/lpcPixelArtRefinement";
import { lpcLookFromSearch } from "../character-system/lpcVisualExperiment";

const lpcLayerUriCache = new Map<string, string>();
// True A/B: classic uses original 64px LPC files AND original proportions.
const lpcHdEnabled = typeof window !== "undefined" && lpcLookFromSearch(window.location.search) === "refined";
const lpcHighDetailSourceIds = new Set<string>();
const lpcHighDetailPendingIds = new Set<string>();
const LPC_HD_PILOT_MAX_LAYERS = 24;
const lpcHdRoles = new Map<string, LpcArtLayer>();
for (const layer of CHARACTER_ASSETS) {
  if (layer.layer === "body" || layer.layer === "raceFeatures") {
    lpcHdRoles.set(layer.sourceId, layer.layer);
  }
}
const getLpcLayerFrameSize = (sourceId: string): number =>
  lpcHighDetailSourceIds.has(sourceId) ? LPC_HD_FRAME_PX : 64;

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
      if (!asset.uri) return;
      const role = lpcHdRoles.get(sourceId);
      if (lpcHdEnabled && role && lpcHighDetailSourceIds.size + lpcHighDetailPendingIds.size < LPC_HD_PILOT_MAX_LAYERS) {
        lpcHighDetailPendingIds.add(sourceId);
        try {
          const enhanced = await refineLpcSpriteUrl(asset.uri, role);
          lpcHighDetailSourceIds.add(sourceId);
          lpcLayerUriCache.set(sourceId, enhanced);
          return;
        } catch {
          // Original sheet remains usable at 64x64 when image/Canvas is unavailable.
        } finally {
          lpcHighDetailPendingIds.delete(sourceId);
        }
      }
      lpcLayerUriCache.set(sourceId, asset.uri);
    })
  );
}

const SPRITESHEET = require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/spritesheet-full.png");
const GOLEM_SHEET = require("../../assets/pixel-art/characters/stone-golem.png");
const CASTLE = require("../../assets/pixel-art/buildings/castle.png");
const DORMITORY = require("../../assets/pixel-art/buildings/dormitory.png");
const GREENHOUSE = require("../../assets/pixel-art/buildings/greenhouse.png");
const FRONTIER_HUT = require("../../assets/pixel-art/buildings/frontier-hut.png");
const FOREST_TREE_1 = require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/tree_1.png");
const FOREST_TREE_2 = require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/tree_2.png");

type Props = PhaserMapActions & {
  snapshot: PhaserMapSnapshot;
  initialCamera?: PhaserCameraView | null;
};

export type PhaserMapSurfaceHandle = {
  captureCamera: () => PhaserCameraView | null;
  refreshViewport: () => void;
  resumeInteractions: () => void;
  centerOnCell: (cellIndex: number, options?: { zoomIn?: boolean }) => void;
};

/** Superficie WebGL. React le passa dati e azioni, senza partecipare al render loop. */
export const PhaserMapSurface = forwardRef<PhaserMapSurfaceHandle, Props>(function PhaserMapSurface({
  snapshot,
  initialCamera = null,
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
}, ref) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<{
    game: import("phaser").Game;
    bridge: import("../phaser/adapters/mapSceneBridge").MapSceneBridge;
  } | null>(null);
  const lastRenderedAtRef = useRef(Date.now());
  const [charactersReady, setCharactersReady] = useState(false);
  const onCharacterAssetsReadyRef = useRef(onCharacterAssetsReady);
  onCharacterAssetsReadyRef.current = onCharacterAssetsReady;

  useImperativeHandle(
    ref,
    () => ({
      captureCamera: () => {
        const runtime = runtimeRef.current;
        if (!runtime || !runtime.game.isBooted) return null;
        const scene = runtime.game.scene.getScene("kingdom-map");
        const camera = scene?.cameras?.main;
        if (!camera) return null;
        return { scrollX: camera.scrollX, scrollY: camera.scrollY, zoom: camera.zoom };
      },
      refreshViewport: () => {
        const runtime = runtimeRef.current;
        const host = hostRef.current;
        if (!runtime || !host) return;
        const width = host.clientWidth;
        const height = host.clientHeight;
        if (width >= 2 && height >= 2 &&
            (runtime.game.scale.width !== width || runtime.game.scale.height !== height)) {
          runtime.game.scale.resize(width, height);
        }
        runtime.bridge.refreshViewport();
      },
      resumeInteractions: () => {
        const runtime = runtimeRef.current;
        const host = hostRef.current;
        if (!runtime || !host || host.clientWidth < 2 || host.clientHeight < 2) return;
        // Quando una route edificio nasconde la mappa, Phaser puo' lasciare
        // l'intero Game in pausa mentre l'orologio React continua a scorrere.
        // Prima riattiva il rendering, poi libera puntatori e drag della scena.
        restoreMapAfterNavigation(runtime.game);
        runtime.game.input.enabled = true;
        runtime.bridge.resumeInteractions();
      },
      centerOnCell: (cellIndex, options) => {
        runtimeRef.current?.bridge.centerOnCell(cellIndex, options);
      }
    }),
    []
  );

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
        golem: Asset.fromModule(GOLEM_SHEET).uri,
        forestTrees: [Asset.fromModule(FOREST_TREE_1).uri, Asset.fromModule(FOREST_TREE_2).uri],
        getLpcLayerUrl,
        getLpcLayerFrameSize,
        buildings: {
          castle: Asset.fromModule(CASTLE).uri,
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
          pixelArt: true,
          roundPixels: true
        },
        scene: [new KingdomMapScene(bridge, sheetUrl, artUrls, initialCamera)]
      });
      lastRenderedAtRef.current = Date.now();
      game.events.on("postrender", () => {
        lastRenderedAtRef.current = Date.now();
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
    const host = hostRef.current;
    if (!host) return;
    // Anche una route web mantenuta nello stack puo' tornare visibile
    // senza provocare un nuovo mount o un evento focus di React Navigation.
    // ResizeObserver ripristina la mappa quando il canvas riacquista dimensioni.
    const recoverVisibleMap = () => {
      if (document.hidden || host.clientWidth < 2 || host.clientHeight < 2) return;
      const runtime = runtimeRef.current;
      if (!runtime) return;
      restoreMapAfterNavigation(runtime.game);
      runtime.game.input.enabled = true;
      runtime.bridge.resumeInteractions();
      runtime.bridge.refreshViewport();
    };
    const onVisibility = () => {
      if (!document.hidden) recoverVisibleMap();
    };
    // Safari/mobile puo' conservare il Game in memoria ma sospendere il RAF
    // quando un edificio viene chiuso. Il clock React resta invece attivo.
    // Effettua il recupero soltanto a pagina e canvas effettivamente visibili.
    const watchdog = window.setInterval(() => {
      if (document.hidden || window.location.pathname !== "/" ||
          host.clientWidth < 2 || host.clientHeight < 2) return;
      const runtime = runtimeRef.current;
      if (!runtime) return;
      const stalled = Date.now() - lastRenderedAtRef.current;
      if (recoverStalledPhaserRender(runtime.game, stalled)) {
        lastRenderedAtRef.current = Date.now();
        runtime.game.input.enabled = true;
        runtime.bridge.resumeInteractions();
        runtime.bridge.refreshViewport();
      }
    }, 2500);
    const resizeObserver = new ResizeObserver(recoverVisibleMap);
    resizeObserver.observe(host);
    window.addEventListener("focus", recoverVisibleMap);
    window.addEventListener("pageshow", recoverVisibleMap);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(watchdog);
      resizeObserver.disconnect();
      window.removeEventListener("focus", recoverVisibleMap);
      window.removeEventListener("pageshow", recoverVisibleMap);
      document.removeEventListener("visibilitychange", onVisibility);
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
});

const hostStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  overflow: "hidden",
  imageRendering: "pixelated",
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
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
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
