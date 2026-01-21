import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type NavigationArrowsProps = {
  onUp: () => void;
  onDown: () => void;
  onLeft: () => void;
  onRight: () => void;
};

export function NavigationArrows({ onUp, onDown, onLeft, onRight }: NavigationArrowsProps) {
  const PAN_SPEED = 50; // pixel per movimento

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Pressable style={styles.arrowButton} onPress={onUp}>
          <Text style={styles.arrowText}>↑</Text>
        </Pressable>
      </View>
      <View style={styles.row}>
        <Pressable style={styles.arrowButton} onPress={onLeft}>
          <Text style={styles.arrowText}>←</Text>
        </Pressable>
        <View style={styles.spacer} />
        <Pressable style={styles.arrowButton} onPress={onRight}>
          <Text style={styles.arrowText}>→</Text>
        </Pressable>
      </View>
      <View style={styles.row}>
        <Pressable style={styles.arrowButton} onPress={onDown}>
          <Text style={styles.arrowText}>↓</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 20,
    right: 20,
    zIndex: 1000,
    alignItems: "center",
    justifyContent: "center"
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 2
  },
  arrowButton: {
    width: 50,
    height: 50,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 2
  },
  arrowText: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "bold"
  },
  spacer: {
    width: 54
  }
});
