import React, { useEffect, useRef } from "react";
import { Asset } from "expo-asset";
import { StyleSheet, View } from "react-native";

import type { PhaserMapActions, PhaserMapSnapshot } from "../phaser/adapters/mapSceneBridge";

const SPRITESHEET = require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/spritesheet-full.png");
const HUMAN_SHEET = require("../../assets/pixel-art/characters/human-colonist.png");
const ROBOT_SHEET = require("../../assets/pixel-art/characters/service-robot.png");
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
        onCharacterPathComplete, onDragStateChange
      });
      const sheetUrl = Asset.fromModule(SPRITESHEET).uri;
      const artUrls = {
        human: Asset.fromModule(HUMAN_SHEET).uri,
        robot: Asset.fromModule(ROBOT_SHEET).uri,
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
      onCharacterPathComplete, onDragStateChange
    });
  }, [onCellPress, onCellHover, onCharacterPress, onCharacterDoublePress, onCharacterPathComplete, onDragStateChange]);

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
