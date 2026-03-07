import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { GameProvider } from "../src/context/GameContext";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GameProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false
          }}
        />
      </GameProvider>
    </GestureHandlerRootView>
  );
}

