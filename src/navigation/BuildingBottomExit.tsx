import React from "react";
import { usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tornaAllaMappa } from "./tornaAllaMappa";
import { isBuildingRoute } from "./isBuildingRoute";
import { needsBottomBackFooter } from "./needsBottomBackFooter";

/** Su native i controlli restano nel contenitore React Native; sul web usiamo un portal. */
export function ViewportBottomPortal({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/** Versione nativa. Sulla webapp Safari viene usata la variante .web.tsx. */
export function BuildingBottomExit() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const building = isBuildingRoute(pathname);
  if (!building && !needsBottomBackFooter(pathname)) return null;
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  return (
    <View style={[styles.wrapper, { bottom: Math.max(insets.bottom, 12) }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={building ? "Torna alla mappa" : "Torna alla pagina precedente"}
        onPress={building ? () => tornaAllaMappa(router) : goBack}
        style={[styles.button, !building && styles.genericButton]}
      >
        <Text style={styles.label}>{building ? "← Torna alla mappa" : "← Indietro"}</Text>
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
  genericButton: { backgroundColor: "#0f172a", borderColor: "#64748b" },
  label: { color: "#ffffff", fontSize: 17, fontWeight: "800", textAlign: "center" }
});
