import React, { memo } from "react";
import { Image, Platform, StyleSheet, View } from "react-native";
import { MissingTile1x1 } from "./MissingTile1x1";

type Props = {
  cellSize: number;
  source: number | null | undefined;
};

/** PNG 1×1 a pieno tile; se l’asset non c’è → quadrato rosso. */
export const Tile1x1Image = memo(function Tile1x1Image({ cellSize, source }: Props) {
  if (source == null) {
    return <MissingTile1x1 cellSize={cellSize} />;
  }

  const bleed = Platform.OS === "web" ? 1 : 0;
  return (
    <View style={[styles.clip, { width: cellSize, height: cellSize }]} pointerEvents="none">
      <Image
        source={source}
        style={{
          position: "absolute",
          left: -bleed,
          top: -bleed,
          width: cellSize + bleed * 2,
          height: cellSize + bleed * 2
        }}
        resizeMode="cover"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  clip: {
    overflow: "hidden",
    position: "absolute",
    left: 0,
    top: 0
  }
});
