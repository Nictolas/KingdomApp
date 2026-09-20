import React, { useMemo } from "react";
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Abitante } from "../types";
import { snapshotFamiglia, type FamigliaVoce } from "../game/famiglia";
import { DESKTOP_MODAL_BREAKPOINT, modalBackdropFullscreen, modalContentFullscreen } from "./modalFullscreenStyles";

type Props = {
  visible: boolean;
  onClose: () => void;
  abitante: Abitante;
  abitanti: readonly Abitante[];
  onSelezionaAbitante: (id: number) => void;
  onApriAlbero: () => void;
};

function formatVoci(voci: FamigliaVoce[]): string {
  return voci.length > 0
    ? voci
        .map((v) => {
          let n = v.nome;
          if (v.adottato) n += " (adott.)";
          if (v.deceduto) n += " †";
          return n;
        })
        .join(", ")
    : "—";
}

function Riga({
  emoji,
  label,
  value,
  muted,
  onPress
}: {
  emoji: string;
  label: string;
  value: string;
  muted?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <>
      <Text style={styles.rowEmoji}>{emoji}</Text>
      <View style={styles.rowTextCol}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, muted && styles.rowMuted, onPress && styles.rowLink]} numberOfLines={3}>
          {value}
        </Text>
      </View>
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
      accessibilityRole="link"
    >
      {content}
    </Pressable>
  );
}

export function FamigliaDettaglioModal({
  visible,
  onClose,
  abitante,
  abitanti,
  onSelezionaAbitante,
  onApriAlbero
}: Props) {
  // Snapshot solo a modale aperto (evita lavoro a ogni render della scheda).
  const famiglia = useMemo(() => {
    if (!visible) return null;
    return snapshotFamiglia(abitante, abitanti);
  }, [visible, abitante, abitanti]);

  const { width } = Dimensions.get("window");
  const isDesktop = width > DESKTOP_MODAL_BREAKPOINT;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, isDesktop && modalBackdropFullscreen]} onPress={onClose}>
        <Pressable style={[styles.card, isDesktop && modalContentFullscreen]} onPress={() => undefined}>
          <Text style={styles.title}>👨‍👩‍👧 Famiglia</Text>
          <Text style={styles.subtitle}>{abitante.nome}</Text>

          <ScrollView contentContainerStyle={styles.scroll}>
            {abitante.razza === "Golem" || !famiglia ? (
              <Text style={styles.empty}>Nessuna relazione familiare.</Text>
            ) : (
              <>
                <Riga
                  emoji="👴"
                  label="Genitori"
                  value={formatVoci(famiglia.genitori)}
                  muted={famiglia.genitori.length === 0}
                  onPress={
                    famiglia.genitori[0] && !famiglia.genitori[0].deceduto
                      ? () => onSelezionaAbitante(famiglia.genitori[0]!.id)
                      : undefined
                  }
                />
                {famiglia.genitoriAdottivi.length > 0 ? (
                  <Riga
                    emoji="🤲"
                    label="Genitori adottivi"
                    value={formatVoci(famiglia.genitoriAdottivi)}
                    onPress={
                      famiglia.genitoriAdottivi[0]
                        ? () => onSelezionaAbitante(famiglia.genitoriAdottivi[0]!.id)
                        : undefined
                    }
                  />
                ) : null}
                {famiglia.nonni.length > 0 ? (
                  <Riga emoji="🧓" label="Nonni" value={formatVoci(famiglia.nonni)} />
                ) : null}
                <Riga
                  emoji="💍"
                  label="Coniuge"
                  value={famiglia.coniuge?.nome ?? "—"}
                  muted={famiglia.coniuge == null}
                  onPress={famiglia.coniuge ? () => onSelezionaAbitante(famiglia.coniuge!.id) : undefined}
                />
                <Riga
                  emoji="👶"
                  label="Figli"
                  value={formatVoci(famiglia.figli)}
                  muted={famiglia.figli.length === 0}
                  onPress={famiglia.figli[0] ? () => onSelezionaAbitante(famiglia.figli[0]!.id) : undefined}
                />
                <Riga
                  emoji="🪺"
                  label="Figli adottati"
                  value={formatVoci(famiglia.figliAdottati)}
                  muted={famiglia.figliAdottati.length === 0}
                  onPress={
                    famiglia.figliAdottati[0]
                      ? () => onSelezionaAbitante(famiglia.figliAdottati[0]!.id)
                      : undefined
                  }
                />

                <Pressable
                  style={({ pressed }) => [styles.alberoBtn, pressed && styles.alberoBtnPressed]}
                  onPress={onApriAlbero}
                >
                  <Text style={styles.alberoBtnText}>🌳 Albero genealogico</Text>
                </Pressable>
              </>
            )}
          </ScrollView>

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Chiudi</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.72)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16
  },
  card: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "85%",
    backgroundColor: "#0f172a",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    padding: 16
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f8fafc",
    textAlign: "center"
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 12,
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center"
  },
  scroll: {
    paddingBottom: 8,
    gap: 4
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8
  },
  rowPressed: {
    backgroundColor: "rgba(59,130,246,0.15)"
  },
  rowEmoji: { fontSize: 16, lineHeight: 22 },
  rowTextCol: { flex: 1, minWidth: 0 },
  rowLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(148,163,184,0.9)",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 2
  },
  rowValue: {
    fontSize: 14,
    color: "#e2e8f0",
    lineHeight: 20
  },
  rowLink: {
    color: "#93c5fd",
    fontWeight: "600",
    textDecorationLine: "underline"
  },
  rowMuted: {
    color: "rgba(226,232,240,0.45)",
    fontStyle: "italic"
  },
  empty: {
    fontSize: 13,
    color: "#64748b",
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 16
  },
  alberoBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(34,197,94,0.15)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.35)",
    alignItems: "center"
  },
  alberoBtnPressed: {
    backgroundColor: "rgba(34,197,94,0.28)"
  },
  alberoBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#86efac"
  },
  closeBtn: {
    marginTop: 12,
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: "rgba(59,130,246,0.9)"
  },
  closeBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14
  }
});
