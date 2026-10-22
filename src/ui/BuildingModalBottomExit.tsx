import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Chiusura delle schede edificio presentate come Modal (fuori dallo Stack). */
export function BuildingModalBottomExit({
  onClose,
  label = "Torna alla mappa"
}: {
  onClose: () => void;
  label?: string;
}) {
  const insets = useSafeAreaInsets();
  const bottom = Platform.OS === "web"
    ? ("max(env(safe-area-inset-bottom, 0px), 10px)" as unknown as number)
    : Math.max(insets.bottom, 10);
  return (
    <View style={[styles.footer, { paddingBottom: bottom }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onClose}
        style={styles.button}
      >
        <Text style={styles.label}>← {label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { width: "100%", paddingTop: 10, paddingHorizontal: 12, backgroundColor: "#0b1225", flexShrink: 0 },
  button: { minHeight: 52, borderRadius: 12, backgroundColor: "#2563eb", borderWidth: 1, borderColor: "#60a5fa", alignItems: "center", justifyContent: "center" },
  label: { fontSize: 17, fontWeight: "800", color: "#ffffff" }
});
