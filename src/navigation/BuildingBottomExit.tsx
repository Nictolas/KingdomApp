import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "expo-router";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tornaAllaMappa } from "./tornaAllaMappa";
import { isBuildingRoute } from "./isBuildingRoute";

/**
 * Unica uscita delle pagine edificio, indipendente dal contenuto scorrevole.
 *
 * Expo Router Stack può occupare già tutta la viewport su Safari/PWA: un
 * footer flex DOPO lo Stack finisce sotto al bordo inferiore (BUG-026).
 * Su web il pulsante è quindi un portale DOM con position:fixed nella
 * viewport reale, non un altro figlio che allunga l'altezza del layout.
 */
export function BuildingBottomExit() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!isBuildingRoute(pathname)) return null;

  const button = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Torna alla mappa"
      onPress={() => tornaAllaMappa(router)}
      style={styles.button}
    >
      <Text style={styles.label}>← Torna alla mappa</Text>
    </Pressable>
  );

  if (Platform.OS === "web") {
    if (!mounted || typeof document === "undefined") return null;
    return createPortal(
      <div
        data-testid="building-bottom-exit"
        style={{
          position: "fixed",
          left: 12,
          right: 12,
          bottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
          zIndex: 2147483000,
          boxSizing: "border-box",
          pointerEvents: "auto"
        }}
      >
        {button}
      </div>,
      document.body
    );
  }

  return (
    <View style={[styles.nativeWrapper, { bottom: Math.max(insets.bottom, 12) }]}>
      {button}
    </View>
  );
}

const styles = StyleSheet.create({
  nativeWrapper: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 10000
  },
  button: {
    minHeight: 56,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#2563eb",
    borderWidth: 1,
    borderColor: "#60a5fa"
  },
  label: { color: "#ffffff", fontSize: 17, fontWeight: "800", textAlign: "center" }
});
