import React from "react";
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { DESKTOP_MODAL_BREAKPOINT, modalBackdropFullscreen, modalContentFullscreen } from "./modalFullscreenStyles";
import type { RichiestaInAttesa } from "../game/richieste";
import { emojiLuogoCulto } from "../game/luogoCulto";

type RichiesteModalProps = {
  visible: boolean;
  richieste: RichiestaInAttesa[];
  onClose: () => void;
  onAccetta: (richiestaId: string) => void;
  onRifiuta: (richiestaId: string) => void;
};

function descrizioneRichiesta(r: RichiestaInAttesa): string {
  if (r.tipo === "luogo-culto") {
    return `${r.nomeCapo} chiede di costruire un Luogo di Culto per il ${r.religione} (2×2 sulla mappa).`;
  }
  return "";
}

export function RichiesteModal({ visible, richieste, onClose, onAccetta, onRifiuta }: RichiesteModalProps) {
  const { width } = Dimensions.get("window");
  const isDesktop = width > DESKTOP_MODAL_BREAKPOINT;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.modalBackdrop, isDesktop && modalBackdropFullscreen]} onPress={onClose}>
        <Pressable style={[styles.modalCard, isDesktop && modalContentFullscreen]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.accentLine} />
          <Text style={styles.title}>📋 Richieste</Text>
          <Text style={styles.subtitle}>
            Richieste rimandate con «Devo pensarci». Puoi accettare o rifiutare quando sei pronto.
          </Text>

          {richieste.length === 0 ? (
            <View style={styles.vuoto}>
              <Text style={styles.vuotoText}>Nessuna richiesta in sospeso.</Text>
            </View>
          ) : (
            <ScrollView style={styles.lista} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {richieste.map((r) => {
                const emoji = r.tipo === "luogo-culto" ? emojiLuogoCulto(r.religione) : "📌";
                return (
                  <View key={r.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardEmoji}>{emoji}</Text>
                      <View style={styles.cardTitoloWrap}>
                        <Text style={styles.cardTitolo}>
                          {r.tipo === "luogo-culto" ? "Luogo di Culto" : "Richiesta"}
                        </Text>
                        <Text style={styles.cardMeta}>
                          Ricevuta: mese {r.ricevutaMese}, anno {r.ricevutaAnno}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.cardDesc}>{descrizioneRichiesta(r)}</Text>
                    <View style={styles.cardButtons}>
                      <Pressable style={[styles.btn, styles.btnAccetta]} onPress={() => onAccetta(r.id)}>
                        <Text style={styles.btnText}>Accetta</Text>
                      </Pressable>
                      <Pressable style={[styles.btn, styles.btnRifiuta]} onPress={() => onRifiuta(r.id)}>
                        <Text style={styles.btnText}>Rifiuta</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Chiudi</Text>
          </Pressable>
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
    padding: 24,
    minWidth: 320,
    maxWidth: 480,
    maxHeight: "85%",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)"
  },
  accentLine: {
    position: "absolute",
    top: 0,
    left: 24,
    right: 24,
    height: 3,
    backgroundColor: "#3b82f6",
    borderRadius: 2
  },
  title: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6
  },
  subtitle: {
    color: "rgba(203, 213, 245, 0.75)",
    fontSize: 11,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 16
  },
  vuoto: {
    paddingVertical: 24,
    alignItems: "center"
  },
  vuotoText: {
    color: "rgba(148, 163, 184, 0.7)",
    fontSize: 12,
    fontStyle: "italic"
  },
  lista: {
    maxHeight: 360,
    marginBottom: 12
  },
  card: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)"
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8
  },
  cardEmoji: {
    fontSize: 28
  },
  cardTitoloWrap: {
    flex: 1
  },
  cardTitolo: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "700"
  },
  cardMeta: {
    color: "rgba(148, 163, 184, 0.85)",
    fontSize: 9,
    marginTop: 2
  },
  cardDesc: {
    color: "rgba(226, 232, 240, 0.9)",
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 10
  },
  cardButtons: {
    flexDirection: "row",
    gap: 8
  },
  btn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center"
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
    fontSize: 11,
    fontWeight: "700"
  },
  closeBtn: {
    backgroundColor: "rgba(59, 130, 246, 0.2)",
    borderWidth: 1,
    borderColor: "#3b82f6",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  closeBtnText: {
    color: "#93c5fd",
    fontSize: 13,
    fontWeight: "700"
  }
});
