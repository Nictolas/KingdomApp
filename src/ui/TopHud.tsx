import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatGameTime, type GameTime } from "../game/gameClock";

type TopHudProps = {
  gameTime: GameTime;
  onBuildPress: () => void;
  onClockPress: () => void;
};

export function TopHud({ gameTime, onBuildPress, onClockPress }: TopHudProps) {
  return (
    <View style={styles.container}>
      <Pressable style={styles.clockContainer} onPress={onClockPress}>
        <Text style={styles.clockText}>🕐 {formatGameTime(gameTime)}</Text>
      </Pressable>
      
      <Pressable style={styles.buildButton} onPress={onBuildPress}>
        <Text style={styles.buildButtonText}>Costruisci</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 10,
    left: 10,
    zIndex: 1000,
    flexDirection: "row",
    gap: 10,
    alignItems: "center"
  },
  clockContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)"
  },
  clockText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "monospace"
  },
  buildButton: {
    backgroundColor: "rgba(76, 175, 80, 0.9)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)"
  },
  buildButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700"
  }
});
