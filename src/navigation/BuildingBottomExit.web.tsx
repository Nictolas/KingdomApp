import React from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";
import { tornaAllaMappa } from "./tornaAllaMappa";
import { isBuildingRoute } from "./isBuildingRoute";
import { needsBottomBackFooter } from "./needsBottomBackFooter";

/** Controlli fissi sul viewport: evita clipping sotto lo Stack/Canvas nella PWA iPhone. */
export function ViewportBottomPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      data-testid="viewport-bottom-portal"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: "calc(8px + env(safe-area-inset-bottom, 0px))",
        // Modali fullscreen sopra il footer, anche su Safari iPhone.
        zIndex: 1000,
        boxSizing: "border-box",
        pointerEvents: "auto"
      }}
    >
      {children}
    </div>,
    document.body
  );
}

/** Il bottone resta ancorato al visual viewport su Safari/PWA, NON dopo lo Stack. */
export function BuildingBottomExit() {
  const pathname = usePathname();
  const router = useRouter();
  const building = isBuildingRoute(pathname);
  if ((!building && !needsBottomBackFooter(pathname)) || typeof document === "undefined") return null;
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={building ? "Torna alla mappa" : "Torna alla pagina precedente"}
        onPress={building ? () => tornaAllaMappa(router) : goBack}
        style={[styles.button, !building && styles.genericButton]}
      >
        <Text style={styles.label}>{building ? "← Torna alla mappa" : "← Indietro"}</Text>
      </Pressable>
    </div>,
    document.body
  );
}

const styles = StyleSheet.create({
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
