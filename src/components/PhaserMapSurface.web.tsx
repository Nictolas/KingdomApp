import React, { useEffect, useRef } from "react";
import { Asset } from "expo-asset";
import { StyleSheet, View } from "react-native";

import type { PhaserMapActions, PhaserMapSnapshot } from "../phaser/adapters/mapSceneBridge";

const SPRITESHEET = require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/spritesheet-full.png");
const CHARACTER_SHEET = require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/character.png");

type Props = PhaserMapActions & {
  snapshot: PhaserMapSnapshot;
};

/** Superficie WebGL. React le passa dati e azioni, senza partecipare al render loop. */
export function PhaserMapSurface({ snapshot, onCellPress, onCellHover, onDragStateChange }: Props) {
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

      const bridge = new MapSceneBridge(snapshot, { onCellPress, onCellHover, onDragStateChange });
      const sheetUrl = Asset.fromModule(SPRITESHEET).uri;
      const characterSheetUrl = Asset.fromModule(CHARACTER_SHEET).uri;
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
        scene: [new KingdomMapScene(bridge, sheetUrl, characterSheetUrl)]
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
    runtimeRef.current?.bridge.setActions({ onCellPress, onCellHover, onDragStateChange });
  }, [onCellPress, onCellHover, onDragStateChange]);

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
