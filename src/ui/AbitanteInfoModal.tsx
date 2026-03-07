import React from "react";
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Abitante } from "../types";
import { getStatoSalute } from "../game/ciboConsumo";
import { getEmojiAbitante } from "../utils/getEmojiAbitante";
import { DESKTOP_MODAL_BREAKPOINT, modalBackdropFullscreen, modalContentFullscreen } from "./modalFullscreenStyles";

const LAVORI_DA_MINORE = ["Studente", "Apprendista", "Tirocinante"];

type AbitanteInfoModalProps = {
  visible: boolean;
  abitante: Abitante | null;
  onClose: () => void;
  getAbitanteNome: (id: number) => string;
  calcolaFelicitàModificata?: (abitante: Abitante) => number;
  etaMinimaLavoro?: number;
  redditoCittadinanza?: number;
};

/** Riga compatta: emoji + valore (es. "🎂 32 anni") */
function Row({ emoji, value, muted }: { emoji: string; value: string; muted?: boolean }) {
  return (
    <Text style={[styles.row, muted && styles.rowMuted]} numberOfLines={1}>
      {emoji} {value}
    </Text>
  );
}

export function AbitanteInfoModal({
  visible,
  abitante,
  onClose,
  getAbitanteNome,
  calcolaFelicitàModificata,
  etaMinimaLavoro = 18,
  redditoCittadinanza = 0
}: AbitanteInfoModalProps) {
  if (!abitante) return null;

  const maggiorenne = abitante.eta >= etaMinimaLavoro;
  const lavoroDaMinore = LAVORI_DA_MINORE.includes(abitante.lavoro);
  const emojiDisplay = maggiorenne && lavoroDaMinore ? "👤" : getEmojiAbitante(abitante);
  const lavoroDisplay = maggiorenne && lavoroDaMinore ? "Disoccupato" : abitante.lavoro;

  const èBeneficiario =
    abitante.razza !== "Robot" &&
    lavoroDisplay === "Disoccupato" &&
    !(abitante.fazioni?.includes("Schiavi") ?? false) &&
    redditoCittadinanza > 0;
  const redditoEffettivo = abitante.razza === "Robot" ? 0 : abitante.reddito + (èBeneficiario ? redditoCittadinanza : 0);
  const felicitàModificata = calcolaFelicitàModificata ? calcolaFelicitàModificata(abitante) : abitante.felicità;
  const felicitàCambiata = abitante.razza !== "Robot" && felicitàModificata !== abitante.felicità;

  const { width } = Dimensions.get("window");
  const isDesktop = width > DESKTOP_MODAL_BREAKPOINT;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, isDesktop && modalBackdropFullscreen]} onPress={onClose}>
        <Pressable style={[styles.card, isDesktop && modalContentFullscreen]} onPress={() => undefined}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* Header compatto */}
            <View style={styles.header}>
              <Text style={styles.headerEmoji}>{emojiDisplay}</Text>
              <View style={styles.headerText}>
                <Text style={styles.title}>{abitante.nome}</Text>
                <Text style={styles.subtitle}>💼 {lavoroDisplay}</Text>
              </View>
            </View>

            {/* Blocco unico compatto a due colonne */}
            <View style={styles.grid}>
              <View style={styles.col}>
                <Text style={styles.blockTitle}>📋 Anagrafica</Text>
                <Row emoji="🎂" value={`${abitante.eta} anni`} />
                <Row emoji="🪐" value={abitante.razza ?? "Umano"} />
                <Row emoji="⚔️" value={abitante.fazioni?.join(", ") ?? "—"} />
                <Row emoji="🧠" value={abitante.personalità} />
                <Row emoji="⛪" value={abitante.religione} />
              </View>
              <View style={styles.col}>
                <Text style={styles.blockTitle}>📊 Prestazioni & Salute</Text>
                <Row emoji="⭐" value={`${abitante.competenza}%`} />
                <Row emoji="⚡" value={`${abitante.produttività}%`} />
                <Row emoji="😴" value={`${abitante.stanchezza}%`} />
                <Row emoji="⚖️" value={abitante.razza === "Robot" ? "—" : `${abitante.peso ?? 50}`} />
                <Row emoji="🏥" value={abitante.razza === "Robot" ? "—" : getStatoSalute(abitante)} />
              </View>
            </View>

            <View style={styles.grid}>
              <View style={styles.col}>
                <Text style={styles.blockTitle}>👥 Relazioni</Text>
                {abitante.razza === "Robot" ? (
                  <Row emoji="—" value="—" muted />
                ) : (
                  <>
                    <Row emoji="😊" value={abitante.amici?.length ? abitante.amici.map((r) => getAbitanteNome(r.id)).join(", ") : "nessuno"} muted={!abitante.amici?.length} />
                    <Row emoji="😠" value={abitante.rivali?.length ? abitante.rivali.map((r) => getAbitanteNome(r.id)).join(", ") : "nessuno"} muted={!abitante.rivali?.length} />
                  </>
                )}
              </View>
              <View style={styles.col}>
                <Text style={styles.blockTitle}>👨‍👩‍👧 Famiglia</Text>
                {abitante.razza === "Robot" ? (
                  <Row emoji="—" value="—" muted />
                ) : (
                  <>
                    <Row emoji="💍" value={abitante.coniugeId != null ? getAbitanteNome(abitante.coniugeId) : "—"} muted={abitante.coniugeId == null} />
                    <Row emoji="👶" value={(abitante.figliIds?.length ?? 0) > 0 ? (abitante.figliIds ?? []).map(getAbitanteNome).join(", ") : "—"} muted={!(abitante.figliIds?.length ?? 0)} />
                  </>
                )}
              </View>
            </View>

            <View style={styles.grid}>
              <View style={styles.col}>
                <Text style={styles.blockTitle}>💰 Economia</Text>
                <Row emoji="💵" value={abitante.razza === "Robot" ? "—" : `${abitante.crediti} cr`} />
                <Row emoji="📈" value={abitante.razza === "Robot" ? "—" : `${redditoEffettivo} cr/mese`} />
                <Row emoji="📉" value={abitante.razza === "Robot" ? "—" : `${abitante.spese} cr/mese`} />
              </View>
              <View style={styles.col}>
                <Text style={styles.blockTitle}>❤️ Sentimenti</Text>
                <Row emoji="❤️" value={abitante.razza === "Robot" ? "—" : `${abitante.lealtà}%`} />
                <Row emoji="😨" value={abitante.razza === "Robot" ? "—" : `${abitante.paura}%`} />
                <Row
                  emoji="😊"
                  value={
                    abitante.razza === "Robot"
                      ? "—"
                      : `${felicitàModificata}%${felicitàCambiata ? ` (base ${abitante.felicità})` : ""}`
                  }
                />
              </View>
            </View>

            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕ Chiudi</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center"
  },
  card: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 14,
    minWidth: 300,
    maxWidth: 420,
    maxHeight: "85%",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)"
  },
  scroll: { paddingBottom: 8 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.2)"
  },
  headerEmoji: { fontSize: 40, marginRight: 12 },
  headerText: { flex: 1 },
  title: { fontSize: 16, fontWeight: "700", color: "#e5e7eb" },
  subtitle: { fontSize: 11, color: "#93c5fd", marginTop: 2 },
  grid: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 10
  },
  col: { flex: 1, minWidth: 0 },
  blockTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "#93c5fd",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  row: {
    fontSize: 11,
    color: "#cbd5f5",
    marginBottom: 2
  },
  rowMuted: {
    color: "rgba(203,213,245,0.5)",
    fontStyle: "italic"
  },
  closeBtn: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "rgba(59,130,246,0.9)",
    borderRadius: 8,
    alignSelf: "center"
  },
  closeBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" }
});
