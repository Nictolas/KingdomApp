import React from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";
import { tornaAllaMappa } from "./tornaAllaMappa";
import { isBuildingRoute } from "./isBuildingRoute";

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
        zIndex: 2147482000,
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
  if (!isBuildingRoute(pathname) || typeof document === "undefined") return null;

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
        accessibilityLabel="Torna alla mappa"
        onPress={() => tornaAllaMappa(router)}
        style={styles.button}
      >
        <Text style={styles.label}>← Torna alla mappa</Text>
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
  label: { color: "#ffffff", fontSize: 17, fontWeight: "800", textAlign: "center" }
});
