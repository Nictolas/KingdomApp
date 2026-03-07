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

function Row({ emoji, value, muted }: { emoji: string; value: string; muted?: boolean }) {
  return (
    <View style={styles.rowWrap}>
      <Text style={styles.rowEmoji}>{emoji}</Text>
      <Text style={[styles.rowValue, muted && styles.rowMuted]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{title}</Text>
      <View style={styles.blockContent}>{children}</View>
    </View>
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
            {/* Header con accento */}
            <View style={styles.headerAccent} />
            <View style={styles.header}>
              <View style={styles.avatarWrap}>
                <Text style={styles.avatarEmoji}>{emojiDisplay}</Text>
              </View>
              <View style={styles.headerText}>
                <Text style={styles.title}>{abitante.nome}</Text>
                <View style={styles.lavoroBadge}>
                  <Text style={styles.lavoroBadgeText}>💼 {lavoroDisplay}</Text>
                </View>
              </View>
            </View>

            <View style={styles.twoCol}>
              <Block title="📋 Anagrafica">
                <Row emoji="🎂" value={`${abitante.eta} anni`} />
                <Row emoji="🪐" value={abitante.razza ?? "Umano"} />
                <Row emoji="⚔️" value={abitante.fazioni?.join(", ") ?? "—"} />
                <Row emoji="🧠" value={abitante.personalità} />
                <Row emoji="⛪" value={abitante.religione} />
              </Block>
              <Block title="📊 Prestazioni & Salute">
                <Row emoji="⭐" value={`${abitante.competenza}%`} />
                <Row emoji="⚡" value={`${abitante.produttività}%`} />
                <Row emoji="😴" value={`${abitante.stanchezza}%`} />
                <Row emoji="⚖️" value={abitante.razza === "Robot" ? "—" : `${abitante.peso ?? 50}`} />
                <Row emoji="🏥" value={abitante.razza === "Robot" ? "—" : getStatoSalute(abitante)} />
              </Block>
            </View>

            <View style={styles.twoCol}>
              <Block title="👥 Relazioni">
                {abitante.razza === "Robot" ? (
                  <Row emoji="—" value="—" muted />
                ) : (
                  <>
                    <Row emoji="😊" value={abitante.amici?.length ? abitante.amici.map((r) => getAbitanteNome(r.id)).join(", ") : "nessuno"} muted={!abitante.amici?.length} />
                    <Row emoji="😠" value={abitante.rivali?.length ? abitante.rivali.map((r) => getAbitanteNome(r.id)).join(", ") : "nessuno"} muted={!abitante.rivali?.length} />
                  </>
                )}
              </Block>
              <Block title="👨‍👩‍👧 Famiglia">
                {abitante.razza === "Robot" ? (
                  <Row emoji="—" value="—" muted />
                ) : (
                  <>
                    <Row emoji="💍" value={abitante.coniugeId != null ? getAbitanteNome(abitante.coniugeId) : "—"} muted={abitante.coniugeId == null} />
                    <Row emoji="👶" value={(abitante.figliIds?.length ?? 0) > 0 ? (abitante.figliIds ?? []).map(getAbitanteNome).join(", ") : "—"} muted={!(abitante.figliIds?.length ?? 0)} />
                  </>
                )}
              </Block>
            </View>

            <View style={styles.twoCol}>
              <Block title="💰 Economia">
                <Row emoji="💵" value={abitante.razza === "Robot" ? "—" : `${abitante.crediti} cr`} />
                <Row emoji="📈" value={abitante.razza === "Robot" ? "—" : `${redditoEffettivo} cr/mese`} />
                <Row emoji="📉" value={abitante.razza === "Robot" ? "—" : `${abitante.spese} cr/mese`} />
              </Block>
              <Block title="❤️ Sentimenti">
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
              </Block>
            </View>

            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Chiudi</Text>
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
    backgroundColor: "rgba(0,0,0,0.82)",
    justifyContent: "center",
    alignItems: "center"
  },
  card: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 0,
    minWidth: 320,
    maxWidth: 440,
    maxHeight: "88%",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    overflow: "hidden"
  },
  scroll: { paddingBottom: 20, paddingHorizontal: 16 },
  headerAccent: {
    height: 4,
    backgroundColor: "#3b82f6",
    width: "100%"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.15)"
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(30,41,59,0.9)",
    borderWidth: 2,
    borderColor: "rgba(59,130,246,0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14
  },
  avatarEmoji: { fontSize: 30 },
  headerText: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f8fafc",
    letterSpacing: 0.2
  },
  lavoroBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    backgroundColor: "rgba(59,130,246,0.2)",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12
  },
  lavoroBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#93c5fd"
  },
  twoCol: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14
  },
  block: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "rgba(15,23,42,0.5)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.12)",
    overflow: "hidden"
  },
  blockTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(248,250,252,0.9)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(30,41,59,0.5)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.1)"
  },
  blockContent: {
    padding: 10
  },
  rowWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
    gap: 8
  },
  rowEmoji: { fontSize: 14, lineHeight: 20 },
  rowValue: {
    flex: 1,
    fontSize: 12,
    color: "#e2e8f0",
    lineHeight: 20
  },
  rowMuted: {
    color: "rgba(226,232,240,0.5)",
    fontStyle: "italic"
  },
  closeBtn: {
    marginTop: 18,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "rgba(59,130,246,0.9)",
    borderRadius: 12,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.4)"
  },
  closeBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700"
  }
});
