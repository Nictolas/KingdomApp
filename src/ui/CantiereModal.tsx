import React, { useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Abitante, Edificio } from "../types";
import { NOME_UFFICIO_EDILE, PROGRESSO_COSTRUZIONE_COMPLETO } from "../game/costruzioneEdifici";
import { AbitanteAvatarPreview } from "./AbitanteAvatarPreview";
import { modalBackdropFullscreen, modalContentFullscreen } from "./modalFullscreenStyles";

type Props = {
  visible: boolean;
  cantiere: Edificio | null;
  abitanti: Abitante[];
  edifici: Edificio[];
  onClose: () => void;
  onApriUfficioEdile?: () => void;
};

/** Scheda cantiere: avanzamento e Edili dell’Ufficio Edile che lavorano ai cantieri. */
export function CantiereModal({
  visible,
  cantiere,
  abitanti,
  edifici,
  onClose,
  onApriUfficioEdile
}: Props) {
  const ufficio = useMemo(
    () => edifici.find((e) => e.nome === NOME_UFFICIO_EDILE && e.stato === "Operativo"),
    [edifici]
  );
  const edili = useMemo(() => {
    const ids = ufficio?.abitantiAssegnati ?? [];
    return ids
      .map((id) => abitanti.find((a) => a.id === id))
      .filter((a): a is Abitante => a != null);
  }, [ufficio, abitanti]);

  if (!cantiere) return null;

  const prog = Math.max(0, Math.min(PROGRESSO_COSTRUZIONE_COMPLETO, cantiere.progressoCostruzione ?? 0));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={modalBackdropFullscreen} onPress={onClose}>
        <Pressable style={[modalContentFullscreen, styles.card]} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>
            🚧 Cantiere · {cantiere.emoji ?? "🏗️"} {cantiere.nome}
          </Text>
          <Text style={styles.stato}>In costruzione</Text>

          <View style={styles.progressBlock}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${prog}%` }]} />
            </View>
            <Text style={styles.progressLabel}>{prog} / {PROGRESSO_COSTRUZIONE_COMPLETO}</Text>
          </View>

          <Text style={styles.sectionTitle}>Lavoratori al cantiere</Text>
          <Text style={styles.hint}>
            Gli Edili assegnati all’Ufficio Edile avanzano il cantiere attivo di 1 punto all’ora ciascuno.
          </Text>

          {edili.length === 0 ? (
            <Text style={styles.warn}>
              Nessun Edile al lavoro. Assegna lavoratori all’Ufficio Edile, altrimenti il cantiere resta fermo.
            </Text>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {edili.map((a) => (
                <View key={a.id} style={styles.row}>
                  <AbitanteAvatarPreview abitante={a} size={40} />
                  <View style={styles.rowText}>
                    <Text style={styles.nome}>{a.nome}</Text>
                    <Text style={styles.meta}>{a.lavoro} · Edile</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.actions}>
            {onApriUfficioEdile ? (
              <Pressable style={styles.btnPrimary} onPress={onApriUfficioEdile}>
                <Text style={styles.btnPrimaryText}>Vai all’Ufficio Edile</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.btnGhost} onPress={onClose}>
              <Text style={styles.btnGhostText}>Chiudi</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1e293b",
    padding: 20,
    maxWidth: 440,
    width: "92%",
    maxHeight: "80%",
    alignSelf: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155"
  },
  title: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4
  },
  stato: {
    color: "#fde047",
    fontSize: 13,
    marginBottom: 14
  },
  progressBlock: {
    marginBottom: 18
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(0,0,0,0.45)",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#475569"
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#4ade80"
  },
  progressLabel: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 6
  },
  sectionTitle: {
    color: "#e2e8f0",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4
  },
  hint: {
    color: "#94a3b8",
    fontSize: 12,
    marginBottom: 10,
    lineHeight: 17
  },
  warn: {
    color: "#fb923c",
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18
  },
  list: {
    maxHeight: 220,
    marginBottom: 12
  },
  listContent: {
    gap: 8,
    paddingBottom: 4
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#0f172a",
    padding: 8,
    borderRadius: 8
  },
  rowText: {
    flex: 1
  },
  nome: {
    color: "#f1f5f9",
    fontSize: 14,
    fontWeight: "600"
  },
  meta: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 2
  },
  actions: {
    gap: 8,
    marginTop: 4
  },
  btnPrimary: {
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center"
  },
  btnPrimaryText: {
    color: "#fff",
    fontWeight: "600"
  },
  btnGhost: {
    paddingVertical: 8,
    alignItems: "center"
  },
  btnGhostText: {
    color: "#94a3b8"
  }
});
