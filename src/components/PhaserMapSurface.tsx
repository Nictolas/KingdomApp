import React, { forwardRef, useImperativeHandle } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { PhaserMapActions, PhaserMapSnapshot } from "../phaser/adapters/mapSceneBridge";
import type { PhaserCameraView } from "../phaser/scenes/KingdomMapScene";

type Props = PhaserMapActions & { snapshot: PhaserMapSnapshot; initialCamera?: PhaserCameraView | null };

export type PhaserMapSurfaceHandle = {
  captureCamera: () => PhaserCameraView | null;
  refreshViewport: () => void;
  resumeInteractions: () => void;
  centerOnCell: (cellIndex: number, options?: { zoomIn?: boolean }) => void;
};

/** Phaser è il renderer web; le build native mantengono il renderer esistente. */
export const PhaserMapSurface = forwardRef<PhaserMapSurfaceHandle, Props>(
  function PhaserMapSurface(_props, ref) {
    useImperativeHandle(
      ref,
      () => ({
        captureCamera: () => null,
        refreshViewport: () => {},
        resumeInteractions: () => {},
        centerOnCell: () => {}
      }),
      []
    );
    return (
      <View style={styles.root}>
        <Text style={styles.text}>Renderer Phaser disponibile sul web</Text>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#18291c" },
  text: { color: "#fff" }
});
