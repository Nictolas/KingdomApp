import { BuildingResidentAvatar } from "./BuildingResidentAvatar";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { Abitante } from "../types";
import { BuildingScreenShell } from "./BuildingScreenShell";

type DormitorioFullscreenModalProps = {
  visible: boolean;
  anchor: number;
  occupantiIds: number[];
  postiPerCasa: number;
  abitanti: Abitante[];
  candidati: Abitante[];
  onClose: () => void;
  onRemove: (abitanteId: number) => void;
  onAdd: (abitanteId: number) => void;
  onOpenResidenze: () => void;
};

/**
 * La gestione del Dormitorio usa una vera schermata edificio:
 * non mostra la mappa dietro e mantiene un unico scroll verticale.
 * Le regole e i callback per l'assegnazione continuano a vivere in mappa.tsx.
 */
export function DormitorioFullscreenModal({
  visible,
  anchor,
  occupantiIds,
  postiPerCasa,
  abitanti,
  candidati,
  onClose,
  onRemove,
  onAdd,
  onOpenResidenze
}: DormitorioFullscreenModalProps) {
  const postiLiberi = Math.max(0, postiPerCasa - occupantiIds.length);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <BuildingScreenShell
        title="Dormitorio"
        onBack={onClose}
        backLabel="Chiudi"
        footerActions={
          <Pressable
            style={styles.residenzeButton}
            onPress={onOpenResidenze}
            accessibilityRole="button"
          >
            <Text style={styles.residenzeButtonText}>Residenze e prezzi</Text>
          </Pressable>
        }
      >
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Posti sulla mappa: {occupantiIds.length}/{postiPerCasa} · Cella #{anchor}</Text>
          <Text style={styles.description}>
            Puoi assegnare chi è già nel Dormitorio del Regno o far entrare chi non ha ancora residenza (non i Senzatetto).
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Posti</Text>
        {Array.from({ length: postiPerCasa }, (_, index) => {
          const id = occupantiIds[index];
          const occupante = id == null ? null : abitanti.find((a) => a.id === id) ?? null;
          return (
            <View key={`slot-${index}`} style={styles.slot}>
              <Text style={styles.slotNumber}>{index + 1}</Text>
              {occupante ? (
                <>
                  <BuildingResidentAvatar abitante={occupante} />
                  <Text style={styles.name} numberOfLines={1}>{occupante.nome}</Text>
                  <Pressable onPress={() => onRemove(occupante.id)} style={styles.removeButton} accessibilityRole="button">
                    <Text style={styles.removeText}>Esci</Text>
                  </Pressable>
                </>
              ) : (
                <Text style={styles.empty}>Libero</Text>
              )}
            </View>
          );
        })}

        <Text style={styles.sectionTitle}>Può entrare ({postiLiberi} liberi)</Text>
        {candidati.length === 0 ? (
          <Text style={styles.emptyMessage}>
            Nessun abitante disponibile (nessuno può entrare qui con le regole attuali o sono già assegnati altrove).
          </Text>
        ) : (
          candidati.map((abitante) => (
            <View key={abitante.id} style={styles.slot}>
              <BuildingResidentAvatar abitante={abitante} />
              <Text style={styles.name} numberOfLines={1}>{abitante.nome}</Text>
              <Pressable
                onPress={() => onAdd(abitante.id)}
                disabled={postiLiberi === 0}
                style={[styles.addButton, postiLiberi === 0 && styles.disabled]}
                accessibilityRole="button"
              >
                <Text style={styles.addText}>Aggiungi</Text>
              </Pressable>
            </View>
          ))
        )}
      </BuildingScreenShell>
    </Modal>
  );
}

const styles = StyleSheet.create({
  summary: { padding: 15, borderRadius: 12, backgroundColor: "#0f172a", borderWidth: 1, borderColor: "#334155", gap: 8 },
  summaryTitle: { color: "#e2e8f0", fontSize: 16, fontWeight: "700" },
  description: { color: "#b8c3db", fontSize: 14, lineHeight: 21 },
  sectionTitle: { marginTop: 20, marginBottom: 8, color: "#dbeafe", fontSize: 17, fontWeight: "700" },
  slot: {
    minHeight: 54, flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 12, paddingVertical: 9, marginBottom: 7,
    backgroundColor: "#101827", borderRadius: 10, borderWidth: 1, borderColor: "#334155"
  },
  slotNumber: { color: "#94a3b8", fontWeight: "700", fontSize: 16, minWidth: 20 },
  avatar: { fontSize: 22 },
  name: { flex: 1, minWidth: 0, color: "#f8fafc", fontSize: 15, fontWeight: "600" },
  empty: { color: "#94a3b8", fontSize: 15, fontStyle: "italic" },
  emptyMessage: { paddingVertical: 20, color: "#b8c3db", fontSize: 15, textAlign: "center", lineHeight: 23 },
  removeButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 7, backgroundColor: "#dc2626" },
  removeText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
  addButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 7, backgroundColor: "#2563eb" },
  addText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
  disabled: { opacity: 0.35 },
  residenzeButton: { backgroundColor: "#2563eb", borderRadius: 8, paddingHorizontal: 13, paddingVertical: 10 },
  residenzeButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "700" }
});
