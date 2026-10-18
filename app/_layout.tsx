import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GameProvider } from "../src/context/GameContext";

const globalStyle = { flex: 1, userSelect: "none" as const };

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.body.style.userSelect = "none";
      document.body.style.webkitUserSelect = "none";
      const { documentElement: html, body } = document;
      html.style.width = "100%";
      html.style.height = "100%";
      html.style.margin = "0";
      html.style.padding = "0";
      html.style.backgroundColor = "#050816";
      body.style.width = "100%";
      body.style.height = "100%";
      body.style.margin = "0";
      body.style.padding = "0";
      body.style.minHeight = "100vh";
      body.style.backgroundColor = "#050816";
      const root = document.getElementById("root");
      if (root) {
        (root as HTMLElement).style.width = "100%";
        (root as HTMLElement).style.height = "100%";
        (root as HTMLElement).style.minHeight = "100vh";
      }
      const meta = document.querySelector('meta[name="viewport"]');
      if (meta) {
        const c = meta.getAttribute("content") || "";
        if (!c.includes("viewport-fit=cover")) {
          meta.setAttribute(
            "content",
            c ? `${c}, viewport-fit=cover` : "width=device-width, initial-scale=1, viewport-fit=cover"
          );
        }
      }
      return () => {
        document.body.style.userSelect = "";
        document.body.style.webkitUserSelect = "";
        html.style.width = "";
        html.style.height = "";
        html.style.margin = "";
        html.style.padding = "";
        html.style.backgroundColor = "";
        body.style.width = "";
        body.style.height = "";
        body.style.margin = "";
        body.style.padding = "";
        body.style.minHeight = "";
        body.style.backgroundColor = "";
        if (root) {
          (root as HTMLElement).style.width = "";
          (root as HTMLElement).style.height = "";
          (root as HTMLElement).style.minHeight = "";
        }
        if (meta) meta.setAttribute("content", (meta.getAttribute("content") ?? "").replace(/,?\s*viewport-fit=cover/g, "").trim() || "width=device-width, initial-scale=1");
      };
    }
  }, []);

  return (
    <GestureHandlerRootView style={globalStyle}>
      <SafeAreaProvider>
        <GameProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false
            }}
          />
        </GameProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

