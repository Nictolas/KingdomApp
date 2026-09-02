import React, { useEffect, useRef } from "react";
import { Asset } from "expo-asset";
import { StyleSheet, View } from "react-native";

import type { PhaserMapActions, PhaserMapSnapshot } from "../phaser/adapters/mapSceneBridge";
import { LPC_ASSET_SOURCES } from "../character-system/generated/lpcAssetSources";

const lpcLayerUriCache = new Map<string, string>();

function getLpcLayerUrl(sourceId: string): string | undefined {
  const source = LPC_ASSET_SOURCES[sourceId as keyof typeof LPC_ASSET_SOURCES];
  if (!source) return undefined;
  const cached = lpcLayerUriCache.get(sourceId);
  if (cached) return cached;
  const uri = Asset.fromModule(source).uri;
  lpcLayerUriCache.set(sourceId, uri);
  return uri;
}

const SPRITESHEET = require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/spritesheet-full.png");
const HUMAN_SHEET = require("../../assets/pixel-art/characters/human-colonist.png");
const GOLEM_SHEET = require("../../assets/pixel-art/characters/stone-golem.png");
const LPC_HUMAN_MALE_IDLE = require("../../assets/character-packs/lpc/human-male-adult/idle.png");
const LPC_HUMAN_MALE_WALK = require("../../assets/character-packs/lpc/human-male-adult/walk.png");
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
  onDragStateChange
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<{
    game: import("phaser").Game;
    bridge: import("../phaser/adapters/mapSceneBridge").MapSceneBridge;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const Phaser = (await import("phaser")).default;
      const { MapSceneBridge } = await import("../phaser/adapters/mapSceneBridge");
      const { KingdomMapScene } = await import("../phaser/scenes/KingdomMapScene");
      if (cancelled || !hostRef.current) return;

      const bridge = new MapSceneBridge(snapshot, {
        onCellPress, onCellHover, onCharacterPress, onCharacterDoublePress,
        onCharacterPathComplete, onCharacterStepAttempt, onCharacterPathBlocked, onDragStateChange
      });
      const sheetUrl = Asset.fromModule(SPRITESHEET).uri;
      const artUrls = {
        human: Asset.fromModule(HUMAN_SHEET).uri,
        golem: Asset.fromModule(GOLEM_SHEET).uri,
        lpcHumanMaleIdle: Asset.fromModule(LPC_HUMAN_MALE_IDLE).uri,
        lpcHumanMaleWalk: Asset.fromModule(LPC_HUMAN_MALE_WALK).uri,
        getLpcLayerUrl: getLpcLayerUrl,
        buildings: {
          "command-center": Asset.fromModule(COMMAND_CENTER).uri,
          dormitory: Asset.fromModule(DORMITORY).uri,
          greenhouse: Asset.fromModule(GREENHOUSE).uri,
          "frontier-hut": Asset.fromModule(FRONTIER_HUT).uri
        }
      };
      const game = new Phaser.Game({
        // La mappa è interamente 2D. Canvas evita la ricreazione dei framebuffer
        // WebGL quando Expo Router nasconde/ridimensiona il contenitore durante
        // l'apertura di una pagina edificio ("Incomplete Attachment").
        type: Phaser.CANVAS,
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
        scene: [new KingdomMapScene(bridge, sheetUrl, artUrls)]
      });
      runtimeRef.current = { game, bridge };
    })();

    return () => {
      cancelled = true;
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
      onCellPress, onCellHover, onCharacterPress, onCharacterDoublePress,
      onCharacterPathComplete, onCharacterStepAttempt, onCharacterPathBlocked, onDragStateChange
    });
  }, [onCellPress, onCellHover, onCharacterPress, onCharacterDoublePress, onCharacterPathComplete, onCharacterStepAttempt, onCharacterPathBlocked, onDragStateChange]);

  return (
    <View style={styles.root}>
      <div ref={hostRef} style={hostStyle} />
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
  }
});
