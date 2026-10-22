import React, { type ReactNode } from "react";
import { usePathname } from "expo-router";
import { isBuildingRoute } from "../navigation/isBuildingRoute";
import { BuildingModalBottomExit } from "./BuildingModalBottomExit";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const BUILDING_WIDE_BREAKPOINT = 1000;

type BuildingScreenShellProps = {
  title: string;
  onBack: () => void;
  children: ReactNode;
  backLabel?: string;
  footerActions?: ReactNode;
  headerActions?: ReactNode;
  scrollable?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Layout condiviso per le schermate degli edifici, sia pagine che modal fullscreen.
 *
 * Un'unica area scrollabile verticale evita gli scroll orizzontali e quelli annidati
 * delle precedenti schermate mobile. Header e navigazione restano sempre raggiungibili.
 */
export function BuildingScreenShell({
  title,
  onBack,
  backLabel = "Torna alla mappa",
  footerActions,
  headerActions,
  scrollable = true,
  contentStyle,
  children
}: BuildingScreenShellProps) {
  const { width } = useWindowDimensions();
  // Le pagine edificio sono coperte dalla barra globale. Le schede fullscreen
  // aperte come modali SULLA mappa hanno invece bisogno della barra qui.
  const showModalExit = !isBuildingRoute(usePathname());
  const insets = useSafeAreaInsets();
  const isWide = width >= BUILDING_WIDE_BREAKPOINT;

  // Safari in modalità "Aggiungi alla schermata Home" può esporre inset=0.
  // In quel caso riserviamo la zona della status bar solo quando la PWA è standalone.
  const webStandalone =
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone));
  const safeAreaStyle: ViewStyle = Platform.OS === "web"
    ? ({
        paddingTop: webStandalone && !isWide
          ? "max(env(safe-area-inset-top, 0px), 48px)"
          : "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)"
      } as unknown as ViewStyle)
    : { paddingTop: insets.top, paddingBottom: insets.bottom };

  return (
    <View style={[styles.root, safeAreaStyle]}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        {headerActions ? <View style={styles.headerActions}>{headerActions}</View> : <View style={styles.headerSpacer} />}
      </View>

      {scrollable ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, isWide && styles.contentWide, contentStyle]}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.staticContent, styles.content, isWide && styles.contentWide, contentStyle]}>
          {children}
        </View>
      )}

      {showModalExit ? <BuildingModalBottomExit onClose={onBack} label={backLabel} /> : null}
      {footerActions ? <View style={styles.footerActions}>{footerActions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, width: "100%", backgroundColor: "#050816" },
  header: {
    minHeight: 54,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.45)",
    backgroundColor: "#0b1225"
  },
  headerActions: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
  staticContent: { flex: 1, minHeight: 0 },
  headerSpacer: { width: 42, height: 44 },
  headerTitle: { flex: 1, textAlign: "center", color: "#f8fafc", fontWeight: "700", fontSize: 18 },
  scroll: { flex: 1, minHeight: 0 },
  content: { width: "100%", flexGrow: 1, paddingHorizontal: 16, paddingVertical: 18, paddingBottom: 32 },
  contentWide: { maxWidth: 1280, alignSelf: "center", paddingHorizontal: 24 },
    footerActions: { alignItems: "flex-end", justifyContent: "center", padding: 8 }
});
