import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 18 },
  modalCard: {
    width: "100%",
    maxWidth: 460,
    borderRadius: 18,
    backgroundColor: "#0f2b18",
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)"
  },
  modalTitle: { color: "white", fontSize: 18, fontWeight: "900", marginBottom: 8 },
  modalSub: { color: "rgba(255,255,255,0.85)", fontSize: 14, marginBottom: 6 },
  modalHint: { color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 8 },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)"
  },
  btnActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderColor: "rgba(255,255,255,0.4)"
  },
  btnPrimary: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#2f9e44" },
  btnWarn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#f59f00" },
  btnText: { color: "white", fontWeight: "700" },
  btnTextPrimary: { color: "#08210f", fontWeight: "900" }
});
