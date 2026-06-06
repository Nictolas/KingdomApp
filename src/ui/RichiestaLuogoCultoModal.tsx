import React from "react";
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { DESKTOP_MODAL_BREAKPOINT, modalBackdropFullscreen, modalContentFullscreen } from "./modalFullscreenStyles";
import type { ReligioneConCulto } from "../game/luogoCulto";
import { emojiLuogoCulto } from "../game/luogoCulto";

type RichiestaLuogoCultoModalProps = {
  visible: boolean;
  nomeCapo: string;
  religione: ReligioneConCulto;
  onAccetta: () => void;
  onRifiuta: () => void;
  onRimanda: () => void;
};

export function RichiestaLuogoCultoModal({
  visible,
  nomeCapo,
  religione,
  onAccetta,
  onRifiuta,
  onRimanda
}: RichiestaLuogoCultoModalProps) {
  const { width } = Dimensions.get("window");
  const isDesktop = width > DESKTOP_MODAL_BREAKPOINT;
  const emoji = emojiLuogoCulto(religione);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRimanda}>
      <Pressable style={[styles.modalBackdrop, isDesktop && modalBackdropFullscreen]} onPress={onRimanda}>
        <Pressable style={[styles.modalCard, isDesktop && modalContentFullscreen]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.accentLine} />
          <View style={styles.header}>
            <View style={styles.emojiWrap}>
              <Text style={styles.emoji}>{emoji}</Text>
            </View>
            <Text style={styles.title}>Richiesta Luogo di Culto</Text>
            <View style={styles.titleUnderline} />
          </View>
          <View style={styles.messaggioWrap}>
            <Text style={styles.messaggio}>
              {nomeCapo}, Capo Religioso del {religione}, chiede il permesso di costruire un Luogo di Culto per la
              comunità dei fedeli. Accetti di finanziare la costruzione (2×2 sulla mappa)?
            </Text>
          </View>
          <View style={styles.buttonsCol}>
            <View style={styles.buttonsRow}>
              <Pressable style={[styles.btn, styles.btnAccetta]} onPress={onAccetta}>
                <Text style={styles.btnText}>Accetta</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnRifiuta]} onPress={onRifiuta}>
                <Text style={styles.btnText}>Rifiuta</Text>
              </Pressable>
            </View>
            <Pressable style={[styles.btn, styles.btnRimanda]} onPress={onRimanda}>
              <Text style={styles.btnText}>Devo pensarci</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(5, 8, 22, 0.92)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  modalCard: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 28,
    minWidth: 320,
    maxWidth: 440,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16
  },
  accentLine: {
    position: "absolute",
    top: 0,
    left: 24,
    right: 24,
    height: 3,
    backgroundColor: "#f59e0b",
    borderRadius: 2
  },
  header: {
    alignItems: "center",
    marginBottom: 16
  },
  emojiWrap: {
    marginBottom: 8
  },
  emoji: {
    fontSize: 40
  },
  title: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center"
  },
  titleUnderline: {
    marginTop: 6,
    width: 48,
    height: 2,
    backgroundColor: "rgba(148, 163, 184, 0.4)",
    borderRadius: 1
  },
  messaggioWrap: {
    marginBottom: 20
  },
  messaggio: {
    color: "rgba(226, 232, 240, 0.9)",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center"
  },
  buttonsCol: {
    gap: 10
  },
  buttonsRow: {
    flexDirection: "row",
    gap: 10
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center"
  },
  btnRimanda: {
    backgroundColor: "rgba(59, 130, 246, 0.2)",
    borderWidth: 1,
    borderColor: "#3b82f6"
  },
  btnAccetta: {
    backgroundColor: "rgba(34, 197, 94, 0.25)",
    borderWidth: 1,
    borderColor: "#22c55e"
  },
  btnRifiuta: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderWidth: 1,
    borderColor: "#ef4444"
  },
  btnText: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "700"
  }
});
