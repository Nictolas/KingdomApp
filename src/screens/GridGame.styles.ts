import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b3d1f" },
  topHud: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    zIndex: 1000,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10
  },
  clockContainer: {
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)"
  },
  topHudButtons: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  clockText: { color: "#ffffff", fontSize: 16, fontWeight: "700", fontFamily: "monospace" },
  stage: {
    flex: 1,
    backgroundColor: "#1b5e20",
    // @ts-ignore
    userSelect: "none",
    WebkitUserSelect: "none"
  },
  world: { position: "absolute" },
  grid: {
    position: "relative",
    // @ts-ignore
    userSelect: "none",
    WebkitUserSelect: "none"
  }
});
