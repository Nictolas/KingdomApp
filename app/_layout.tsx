import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { GameProvider } from "../src/context/GameContext";

const globalStyle = { flex: 1, userSelect: "none" as const };

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.body.style.userSelect = "none";
      document.body.style.webkitUserSelect = "none";
      return () => {
        document.body.style.userSelect = "";
        document.body.style.webkitUserSelect = "";
      };
    }
  }, []);

  return (
    <GestureHandlerRootView style={globalStyle}>
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

