import React from "react";
import { Dimensions, SafeAreaView, StyleSheet, View } from "react-native";
import GridGame from "../src/screens/GridGame";

const ASPECT_RATIO = 16 / 9; // 16:9

export default function Index() {
  const { width, height } = Dimensions.get("window");
  const isDesktop = width > 768;

  // Su PC: contenitore 16:9 centrato che si adatta alla finestra (il più grande rettangolo 16:9 che ci sta)
  const boxWidth = isDesktop ? Math.min(width, height * ASPECT_RATIO) : width;
  const boxHeight = isDesktop ? Math.min(height, width / ASPECT_RATIO) : height;

  return (
    <SafeAreaView style={styles.safe}>
      {isDesktop ? (
        <View style={styles.desktopWrap}>
          <View style={[styles.desktopBox, { width: boxWidth, height: boxHeight }]}>
            <GridGame />
          </View>
        </View>
      ) : (
        <GridGame />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050816" },
  desktopWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#050816"
  },
  desktopBox: {
    overflow: "hidden",
    backgroundColor: "#050816"
  }
});

