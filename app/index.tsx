import React from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import GridGame from "../src/screens/GridGame";

export default function Index() {
  return (
    <SafeAreaView style={styles.safe}>
      <GridGame />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b3d1f" }
});

