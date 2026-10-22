import React from "react";
import { usePathname, useRouter } from "expo-router";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tornaAllaMappa } from "./tornaAllaMappa";
import { isBuildingRoute } from "./isBuildingRoute";

/**
 * Unico pulsante di uscita per TUTTE le pagine di edifici.
 * E' fratello dello Stack: resta fisso al margine inferiore dello schermo,
 * non appartiene alla ScrollView della singola pagina.
 */
export function BuildingBottomExit() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  if (!isBuildingRoute(pathname)) return null;

  const safeBottom = Platform.OS === "web"
    ? ("max(env(safe-area-inset-bottom, 0px), 10px)" as unknown as number)
    : Math.max(insets.bottom, 10);

  return (
    <View style={[styles.wrapper, { paddingBottom: safeBottom }]}>
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
  wrapper: {
    width: "100%",
    flexShrink: 0,
    paddingTop: 10,
    paddingHorizontal: 16,
    backgroundColor: "#0b1225",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#475569",
    zIndex: 100
  },
  button: {
    minHeight: 52,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#2563eb",
    borderWidth: 1,
    borderColor: "#60a5fa"
  },
  label: { color: "#ffffff", fontSize: 17, fontWeight: "800", textAlign: "center" }
});
