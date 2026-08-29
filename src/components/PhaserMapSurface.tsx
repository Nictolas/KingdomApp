import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { PhaserMapActions, PhaserMapSnapshot } from "../phaser/adapters/mapSceneBridge";

type Props = PhaserMapActions & { snapshot: PhaserMapSnapshot };

/** Phaser è il renderer web; le build native mantengono il renderer esistente. */
export function PhaserMapSurface(_props: Props) {
  return (
    <View style={styles.root}>
      <Text style={styles.text}>Renderer Phaser disponibile sul web</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#18291c" },
  text: { color: "#fff" }
});
