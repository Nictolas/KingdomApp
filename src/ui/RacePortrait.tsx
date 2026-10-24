import React, { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import type { ImageSourcePropType } from "react-native";
import type { Razza } from "../types";

/** Single-frame LPC portraits; emoji remains visible while an image loads. */
const PORTRAITS: Record<Exclude<Razza, "Golem">, ImageSourcePropType> = {
  Umano: require("../../assets/character-packs/lpc/race-portraits/umano.png"),
  Elfo: require("../../assets/character-packs/lpc/race-portraits/elfo.png"),
  Nano: require("../../assets/character-packs/lpc/race-portraits/nano.png"),
  Orco: require("../../assets/character-packs/lpc/race-portraits/orco.png"),
  Goblin: require("../../assets/character-packs/lpc/race-portraits/goblin.png"),
  Felix: require("../../assets/character-packs/lpc/race-portraits/felix.png")
};

export function RacePortrait({ razza, emoji }: { razza: Razza; emoji: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  if (razza === "Golem") return <Text style={styles.emoji}>{emoji}</Text>;
  return (
    <View style={styles.circle} accessibilityLabel={"Ritratto " + razza}>
      <Image
        source={PORTRAITS[razza]}
        style={[styles.image, !loaded && styles.hidden]}
        resizeMode="cover"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
      {(!loaded || failed) && <Text style={styles.fallback}>{emoji}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: "#243447",
    borderWidth: 4, borderColor: "#0b1220", overflow: "hidden",
    alignItems: "center", justifyContent: "center", marginBottom: 6
  },
  image: { width: 76, height: 76, position: "absolute" },
  hidden: { opacity: 0 },
  fallback: { fontSize: 30, textAlign: "center" },
  emoji: { fontSize: 34, marginBottom: 6 }
});
