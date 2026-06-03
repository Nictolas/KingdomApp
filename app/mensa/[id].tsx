import React, { useMemo, useState } from "react";
import { Dimensions, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useGameContext } from "../../src/context/GameContext";
import { abitanteHaBisognoMensa } from "../../src/game/mensaPubblica";
import { formatOrologioGioco } from "../../src/game/orologioGiocoSession";
import { useOrologioGioco } from "../../src/hooks/useOrologioGioco";
import { getEmojiAbitante } from "../../src/utils/getEmojiAbitante";
import { modalBackdropFullscreen, modalContentFullscreen } from "../../src/ui/modalFullscreenStyles";
import type { Abitante } from "../../src/types";

export default function MensaScreenById() {
  const router = useRouter();
  const raw = useLocalSearchParams<{ id: string | string[] }>().id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const edificioId = Number(idStr);

  const { abitanti, edifici, assegnaAbitanteAEdificio, rimuoviAbitanteDaEdificio, setStipendioEdificio } =
    useGameContext();
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const { minuti: orologioMinuti, inPausa: orologioInPausa, togglePausa: toggleOrologioPausa } =
    useOrologioGioco();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const mensa = useMemo(
    () => edifici.find((e) => e.id === edificioId && e.nome === "Mensa Pubblica"),
    [edifici, edificioId]
  );

  if (!Number.isFinite(edificioId) || !mensa) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.title}>Mensa non trovata</Text>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Indietro
        </Text>
      </SafeAreaView>
    );
  }

  const addettiIds = mensa.abitantiAssegnati ?? [];
  const affamati = abitanti.filter((a) => abitanteHaBisognoMensa(a, edifici));
  const addetti = addettiIds.map((id) => abitanti.find((a) => a.id === id)).filter((a): a is Abitante => a != null);
  const abitantiDisponibili = abitanti.filter(
    (a) => a.razza !== "Robot" && !addettiIds.includes(a.id) && (mensa.capacità ?? 40) > addettiIds.length
  );

  const titolo = `🍽️ Mensa Pubblica (#${edificioId})`;

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>{titolo}</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Stato Mensa</Text>
          <View style={styles.clockRow}>
            <Text style={styles.clockLine}>🕐 Ora di gioco: {formatOrologioGioco(orologioMinuti)}</Text>
            <Pressable style={styles.orologioPausaBtn} onPress={toggleOrologioPausa}>
              <Text style={styles.orologioPausaBtnText}>{orologioInPausa ? "▶️" : "⏸️"}</Text>
            </Pressable>
          </View>
          <Text style={styles.infoText}>
            Addetti: {addetti.length}/{mensa.capacità ?? 40}
          </Text>
          <Text style={styles.infoSubtext}>
            Gli abitanti senza cibo in inventario si recano qui sulla mappa per ricevere un pasto compatibile con
            la dieta (Vegetariano / Vegano inclusi).
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>In attesa di pasto ({affamati.length})</Text>
          {affamati.length > 0 ? (
            affamati.map((a) => (
              <View key={a.id} style={styles.row}>
                <Text style={styles.emoji}>{getEmojiAbitante(a)}</Text>
                <Text style={styles.nome} numberOfLines={1}>
                  {a.nome}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>Nessun abitante senza cibo al momento.</Text>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Addetti</Text>
          {addetti.length > 0 ? (
            addetti.map((a) => (
              <View key={a.id} style={styles.row}>
                <Text style={styles.emoji}>{getEmojiAbitante(a)}</Text>
                <Text style={styles.nome} numberOfLines={1}>
                  {a.nome}
                </Text>
                <Pressable onPress={() => rimuoviAbitanteDaEdificio(a.id, edificioId)}>
                  <Text style={styles.rimuovi}>Rimuovi</Text>
                </Pressable>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>Nessun addetto assegnato.</Text>
          )}
          {abitantiDisponibili.length > 0 && (
            <Pressable style={styles.addBtn} onPress={() => setDropdownVisible(true)}>
              <Text style={styles.addBtnText}>+ Aggiungi addetto</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.stipendioCard}>
          <Text style={styles.sectionTitle}>Stipendio mensile per addetto</Text>
          <TextInput
            style={styles.stipendioInput}
            keyboardType="numeric"
            defaultValue={String(mensa.stipendioPerLavoratore ?? 0)}
            onEndEditing={(e) => setStipendioEdificio(edificioId, parseInt(e.nativeEvent.text, 10) || 0)}
          />
        </View>
      </ScrollView>

      <Modal visible={dropdownVisible} transparent animationType="fade">
        <Pressable style={modalBackdropFullscreen} onPress={() => setDropdownVisible(false)}>
          <Pressable style={modalContentFullscreen} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Scegli addetto</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {abitantiDisponibili.map((a) => (
                <Pressable
                  key={a.id}
                  style={styles.modalRow}
                  onPress={() => {
                    assegnaAbitanteAEdificio(a.id, edificioId);
                    setDropdownVisible(false);
                  }}
                >
                  <Text>
                    {getEmojiAbitante(a)} {a.nome}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1a1a2e" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  title: { fontSize: 18, fontWeight: "700", color: "#fff", textAlign: "center", flex: 1 },
  back: { color: "#8af", padding: 16 },
  content: { padding: 16, paddingBottom: 32 },
  infoCard: {
    backgroundColor: "#252545",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16
  },
  infoTitle: { fontSize: 16, fontWeight: "700", color: "#fff", marginBottom: 8 },
  clockRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  clockLine: { color: "#ccc", flex: 1 },
  orologioPausaBtn: { padding: 8 },
  orologioPausaBtnText: { fontSize: 18 },
  infoText: { color: "#fff", marginBottom: 4 },
  infoSubtext: { color: "#aaa", fontSize: 13, lineHeight: 18 },
  sectionCard: {
    backgroundColor: "#252545",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16
  },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: "#fff", marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 6, gap: 8 },
  emoji: { fontSize: 22 },
  nome: { flex: 1, color: "#eee" },
  rimuovi: { color: "#f88", fontSize: 13 },
  empty: { color: "#888", fontStyle: "italic" },
  addBtn: {
    marginTop: 12,
    backgroundColor: "#3a3a6a",
    borderRadius: 8,
    padding: 12,
    alignItems: "center"
  },
  addBtnText: { color: "#fff", fontWeight: "600" },
  stipendioCard: {
    backgroundColor: "#252545",
    borderRadius: 12,
    padding: 16
  },
  stipendioInput: {
    backgroundColor: "#1a1a2e",
    color: "#fff",
    borderRadius: 8,
    padding: 10,
    marginTop: 8
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#fff", marginBottom: 12 },
  modalRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#333" }
});
