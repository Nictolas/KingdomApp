import React from "react";
import { Image, StyleSheet, View } from "react-native";

type Props = {
  width: number;
  height: number;
};

/** Sprite pixel-art (PNG) scalato sul footprint 3×2 celle. */
const ADMIN_SRC = require("../../assets/buildings/edificio-amministrazione-3x2.png");
/** Sprite pixel-art (PNG) scalato sul footprint 2×2 celle. */
const DORM_SRC = require("../../assets/buildings/dormitorio-2x2.png");

export function RpgFootprintAdmin3x2({ width, height }: Props) {
  return (
    <View style={[styles.wrap, { width, height }]} pointerEvents="none">
      <Image source={ADMIN_SRC} style={StyleSheet.absoluteFillObject} resizeMode="stretch" />
    </View>
  );
}

export function RpgFootprintDorm2x2({ width, height }: Props) {
  return (
    <View style={[styles.wrap, { width, height }]} pointerEvents="none">
      <Image source={DORM_SRC} style={StyleSheet.absoluteFillObject} resizeMode="stretch" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 2,
    borderWidth: 2,
    borderColor: "#0c0c0c",
    overflow: "hidden",
    backgroundColor: "#1a1814"
  }
});
