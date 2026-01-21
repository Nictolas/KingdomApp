import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000", overflow: "hidden" },
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
    backgroundColor: "transparent",
    overflow: "hidden",
    // @ts-ignore
    userSelect: "none",
    WebkitUserSelect: "none"
  },
  world: { 
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden"
  },
  grid: {
    position: "relative",
    overflow: "hidden",
    // @ts-ignore
    userSelect: "none",
    WebkitUserSelect: "none"
  }
});
