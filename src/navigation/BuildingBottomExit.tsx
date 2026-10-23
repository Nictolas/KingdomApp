import React from "react";
import { usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tornaAllaMappa } from "./tornaAllaMappa";
import { isBuildingRoute } from "./isBuildingRoute";

/** Su native i controlli restano nel contenitore React Native; sul web usiamo un portal. */
export function ViewportBottomPortal({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/** Versione nativa. Sulla webapp Safari viene usata la variante .web.tsx. */
export function BuildingBottomExit() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  if (!isBuildingRoute(pathname)) return null;

  return (
    <View style={[styles.wrapper, { bottom: Math.max(insets.bottom, 12) }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Torna alla mappa"
        onPress={() => tornaAllaMappa(router)}
        style={styles.button}
      >
        <Text style={styles.label}>← Torna alla mappa</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: "absolute", left: 12, right: 12, zIndex: 10000 },
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
