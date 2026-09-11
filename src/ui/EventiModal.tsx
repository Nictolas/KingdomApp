import React, { useMemo } from "react";
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { DESKTOP_MODAL_BREAKPOINT, modalBackdropFullscreen, modalContentFullscreen } from "./modalFullscreenStyles";
import { calcolaEventiUI, type EventoUICard, type StatoEventoUI } from "../game/eventiDisponibili";
import type { EventiUIInput } from "../game/eventiDisponibili";

type EventiModalProps = {
  visible: boolean;
  onClose: () => void;
  input: EventiUIInput;
};

function badgeLabel(stato: StatoEventoUI): string {
  switch (stato) {
    case "in-corso":
      return "In corso";
    case "disponibile":
      return "Disponibile";
    case "in-attesa":
      return "In attesa";
    case "rimandato":
      return "Rimandato";
    default:
      return "Possibile";
  }
}

function badgeStyle(stato: StatoEventoUI) {
  switch (stato) {
    case "in-corso":
      return styles.badgeInCorso;
    case "disponibile":
      return styles.badgeDisponibile;
    case "in-attesa":
      return styles.badgeInAttesa;
    case "rimandato":
      return styles.badgeRimandato;
    default:
      return styles.badgePossibile;
  }
}

function EventoCard({ card }: { card: EventoUICard }) {
  return (
    <View
      style={[
        styles.card,
        (card.stato === "in-corso" || card.stato === "in-attesa" || card.stato === "rimandato") && styles.cardAttivo
      ]}
    >
      <Text style={styles.emoji}>{card.emoji}</Text>
      <View style={[styles.badge, badgeStyle(card.stato)]}>
        <Text style={styles.badgeText}>{badgeLabel(card.stato)}</Text>
      </View>
      <Text style={styles.cardTitle}>{card.nome}</Text>
      <Text style={styles.cardDesc}>{card.descrizione}</Text>
    </View>
  );
}

function Sezione({ titolo, cards }: { titolo: string; cards: EventoUICard[] }) {
  if (cards.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {titolo} ({cards.length})
      </Text>
      <View style={styles.grid}>
        {cards.map((c) => (
          <EventoCard key={c.id} card={c} />
        ))}
      </View>
    </View>
  );
}

export function EventiModal({ visible, onClose, input }: EventiModalProps) {
  const { width } = Dimensions.get("window");
  const isDesktop = width > DESKTOP_MODAL_BREAKPOINT;

  const { inCorso, disponibili, possibili } = useMemo(() => calcolaEventiUI(input), [input]);

  const totaleDisponibili = disponibili.length + inCorso.length;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.modalBackdrop, isDesktop && modalBackdropFullscreen]} onPress={onClose}>
        <Pressable style={[styles.modalCard, isDesktop && modalContentFullscreen]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.accentLine} />
          <Text style={styles.title}>📌 Eventi</Text>
          <Text style={styles.subtitle}>
            Eventi in corso, disponibili ora e altri possibili nel regno. Gli eventi mensili si attivano al cambio mese;
            la Richiesta Luogo di Culto parte appena si verificano i requisiti.
          </Text>

          <ScrollView style={styles.scroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            <Sezione titolo="In corso / In attesa" cards={inCorso} />
            <Sezione titolo="Disponibili ora" cards={disponibili} />
            <Sezione titolo="Altri possibili" cards={possibili} />
            {inCorso.length === 0 && disponibili.length === 0 && possibili.length === 0 && (
              <Text style={styles.vuoto}>Nessun evento registrato.</Text>
            )}
          </ScrollView>

          <Text style={styles.footerMeta}>
            Attivi o disponibili: <Text style={styles.footerVal}>{totaleDisponibili}</Text>
          </Text>

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
    maxWidth: 520,
    maxHeight: "88%",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)"
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
  title: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6
  },
  subtitle: {
    color: "rgba(203, 213, 245, 0.75)",
    fontSize: 10,
    textAlign: "center",
    marginBottom: 14,
    lineHeight: 15
  },
  scroll: {
    maxHeight: 420,
    marginBottom: 10
  },
  section: {
    marginBottom: 14
  },
  sectionTitle: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  grid: {
    gap: 8
  },
  card: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)"
  },
  cardAttivo: {
    borderColor: "rgba(245, 158, 11, 0.45)",
    backgroundColor: "rgba(245, 158, 11, 0.06)"
  },
  emoji: {
    fontSize: 22,
    marginBottom: 4
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6
  },
  badgeInCorso: {
    backgroundColor: "rgba(245, 158, 11, 0.3)"
  },
  badgeDisponibile: {
    backgroundColor: "rgba(34, 197, 94, 0.25)"
  },
  badgeInAttesa: {
    backgroundColor: "rgba(59, 130, 246, 0.25)"
  },
  badgeRimandato: {
    backgroundColor: "rgba(148, 163, 184, 0.3)"
  },
  badgePossibile: {
    backgroundColor: "rgba(148, 163, 184, 0.2)"
  },
  badgeText: {
    color: "#e5e7eb",
    fontSize: 9,
    fontWeight: "700"
  },
  cardTitle: {
    color: "#e5e7eb",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4
  },
  cardDesc: {
    color: "rgba(203, 213, 245, 0.75)",
    fontSize: 10,
    lineHeight: 14
  },
  vuoto: {
    color: "rgba(148, 163, 184, 0.7)",
    fontSize: 11,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 20
  },
  footerMeta: {
    color: "rgba(203, 213, 245, 0.7)",
    fontSize: 10,
    textAlign: "center",
    marginBottom: 10
  },
  footerVal: {
    color: "#f8fafc",
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
