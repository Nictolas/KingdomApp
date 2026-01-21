import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { formatGameTime, type GameTime } from "../game/gameClock";

type GameClockProps = {
  gameTime: GameTime;
};

export function GameClock({ gameTime }: GameClockProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.clockText}>🕐 {formatGameTime(gameTime)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 10,
    left: 10,
    zIndex: 1000,
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
  }
});
