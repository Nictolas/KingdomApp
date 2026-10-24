import { Stack, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { GameProvider } from "../src/context/GameContext";
import { needsBottomBackFooter } from "../src/navigation/needsBottomBackFooter";

const globalStyle = { flex: 1, minHeight: 0, userSelect: "none" as const };
const routeShellStyle = { flex: 1, minHeight: 0, backgroundColor: "#050816" };
const bottomBackStyle = {
  minHeight: 48,
  paddingHorizontal: 16,
  paddingTop: 10,
  paddingBottom: Platform.OS === "web" ? 18 : 12,
  justifyContent: "center" as const,
  backgroundColor: "#0f172a",
  borderTopWidth: 1,
  borderTopColor: "rgba(148,163,184,0.4)"
};
const bottomBackTextStyle = { color: "#93c5fd", fontSize: 14, fontWeight: "600" as const };

export default function RootLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const showBottomBack = needsBottomBackFooter(pathname);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.body.style.userSelect = "none";
      document.body.style.webkitUserSelect = "none";
      const { documentElement: html, body } = document;
      html.style.width = "100%";
      html.style.height = "100dvh";
      html.style.overflow = "hidden";
      html.style.margin = "0";
      html.style.padding = "0";
      html.style.backgroundColor = "#050816";
      body.style.width = "100%";
      body.style.height = "100dvh";
      body.style.overflow = "hidden";
      body.style.margin = "0";
      body.style.padding = "0";
      body.style.minHeight = "100dvh";
      body.style.backgroundColor = "#050816";
      const root = document.getElementById("root");
      if (root) {
        (root as HTMLElement).style.width = "100%";
        (root as HTMLElement).style.height = "100dvh";
        (root as HTMLElement).style.overflow = "hidden";
        (root as HTMLElement).style.minHeight = "100dvh";
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
        html.style.overflow = "";
        html.style.margin = "";
        html.style.padding = "";
        html.style.backgroundColor = "";
        body.style.width = "";
        body.style.height = "";
        body.style.overflow = "";
        body.style.margin = "";
        body.style.padding = "";
        body.style.minHeight = "";
        body.style.backgroundColor = "";
        if (root) {
          (root as HTMLElement).style.width = "";
          (root as HTMLElement).style.height = "";
          (root as HTMLElement).style.overflow = "";
          (root as HTMLElement).style.minHeight = "";
        }
        if (meta) meta.setAttribute("content", (meta.getAttribute("content") ?? "").replace(/,?\s*viewport-fit=cover/g, "").trim() || "width=device-width, initial-scale=1");
      };
    }
  }, []);

  return (
    <GestureHandlerRootView style={globalStyle}>
      <GameProvider>
        <StatusBar style="light" />
        <View style={routeShellStyle}>
          <Stack screenOptions={{ headerShown: false }} />
          {showBottomBack && (
            <Pressable
              onPress={goBack}
              style={bottomBackStyle}
              accessibilityRole="button"
              accessibilityLabel="Torna alla pagina precedente"
              hitSlop={4}
            >
              <Text style={bottomBackTextStyle}>← Indietro</Text>
            </Pressable>
          )}
        </View>
      </GameProvider>
    </GestureHandlerRootView>
  );
}

