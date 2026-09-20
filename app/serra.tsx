import React, { useMemo } from "react";
import {
  Dimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import {
  getColturaSerraDef,
  getColtureSerraDisponibili,
  GIORNI_PRODUZIONE_SERRA_PER_MESE,
  PRODUZIONE_SERRA_GIORNALIERA
} from "../src/game/colturaSerra";
import { getServiDellaGlebaPerAssegnazioneEdificio } from "../src/game/edificiLavoro";
import { getStipendioMoneteGiornaliero } from "../src/game/edificiPubblici";
import { AbitanteAvatarPreview } from "../src/ui/AbitanteAvatarPreview";
import type { Abitante, Edificio } from "../src/types";

function SerraCard({
  serra,
  abitanti,
  edifici,
  coltureDisponibili,
  setColturaSerra,
  assegnaServoDellaGlebaAEdificio,
  rimuoviAbitanteDaEdificio,
  setStipendioEdificio
}: {
  serra: Edificio;
  abitanti: Abitante[];
  edifici: Edificio[];
  coltureDisponibili: ReturnType<typeof getColtureSerraDisponibili>;
  setColturaSerra: (edificioId: number, colturaItemId: string) => void;
  assegnaServoDellaGlebaAEdificio: (abitanteId: number, edificioId: number) => void;
  rimuoviAbitanteDaEdificio: (abitanteId: number, edificioId: number) => void;
  setStipendioEdificio: (edificioId: number, stipendioPerLavoratore: number) => void;
}) {
  const coltura = getColturaSerraDef(serra.colturaItemId);
  const agricoltori = serra.abitantiAssegnati
    .map((id) => abitanti.find((a) => a.id === id))
    .filter((a): a is Abitante => a != null);
  const disponibili = getServiDellaGlebaPerAssegnazioneEdificio(abitanti, edifici, serra);
  const stipendio = getStipendioMoneteGiornaliero(serra);
  const produzionePerAgricoltore =
    serra.stato === "Operativo" ? PRODUZIONE_SERRA_GIORNALIERA : 0;
  const produzioneGiorno = produzionePerAgricoltore * agricoltori.length;

  return (
    <View style={styles.serraCard}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.serraTitle}>🌱 Serra #{serra.id}</Text>
          <Text style={styles.meta}>Stato: {serra.stato} · Agricoltori: {agricoltori.length}/{serra.capacità}</Text>
        </View>
        <View style={styles.cropBadge}>
          <Text style={styles.cropBadgeText}>{coltura?.emoji ?? "🌱"} {coltura?.nome ?? "Mela"}</Text>
        </View>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Produzione attuale</Text>
        <Text style={styles.infoText}>
          {produzioneGiorno} unità/giorno totali · {produzioneGiorno * GIORNI_PRODUZIONE_SERRA_PER_MESE} unità/mese
        </Text>
        <Text style={styles.infoMuted}>
          {produzionePerAgricoltore} unità/giorno per Agricoltore, accreditate nel suo inventario personale.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Coltura</Text>
      <View style={styles.cropGrid}>
        {coltureDisponibili.map((c) => {
          const selected = c.id === (serra.colturaItemId ?? "mela");
          return (
            <Pressable
              key={c.id}
              style={[styles.cropButton, selected && styles.cropButtonSelected]}
              onPress={() => setColturaSerra(serra.id, c.id)}
            >
              <Text style={styles.cropEmoji}>{c.emoji}</Text>
              <Text style={styles.cropName}>{c.nome}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.wageBox}>
        <View>
          <Text style={styles.infoTitle}>Stipendio Agricoltori</Text>
          <Text style={styles.infoMuted}>Pagato dal Tesoro.</Text>
        </View>
        <View style={styles.wageRow}>
          <Pressable
            style={styles.wageBtn}
            onPress={() => setStipendioEdificio(serra.id, Math.max(0, stipendio - 1) * 30)}
          >
            <Text style={styles.wageBtnText}>−</Text>
          </Pressable>
          <Text style={styles.wageValue}>{stipendio}/giorno</Text>
          <Pressable
            style={styles.wageBtn}
            onPress={() => setStipendioEdificio(serra.id, (stipendio + 1) * 30)}
          >
            <Text style={styles.wageBtnText}>+</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.columns}>
        <View style={styles.column}>
          <Text style={styles.sectionTitle}>Agricoltori</Text>
          {agricoltori.length === 0 ? (
            <Text style={styles.empty}>Nessun Agricoltore assegnato</Text>
          ) : (
            agricoltori.map((a) => (
              <View key={a.id} style={styles.personCard}>
                <AbitanteAvatarPreview abitante={a} />
                <Text style={styles.personName}>{a.nome}</Text>
                <Text style={styles.personMeta}>Competenza {a.competenza}%</Text>
                <Pressable
                  style={styles.removeBtn}
                  onPress={() => rimuoviAbitanteDaEdificio(a.id, serra.id)}
                >
                  <Text style={styles.btnText}>Rimuovi</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>

        <View style={styles.column}>
          <Text style={styles.sectionTitle}>Servi disponibili</Text>
          {disponibili.length === 0 ? (
            <Text style={styles.empty}>Nessun Servo della gleba disponibile</Text>
          ) : (
            disponibili.map((a) => (
              <View key={a.id} style={styles.personCard}>
                <AbitanteAvatarPreview abitante={a} />
                <Text style={styles.personName}>{a.nome}</Text>
                <Text style={styles.personMeta}>Competenza {a.competenza}%</Text>
                <Pressable
                  style={styles.addBtn}
                  onPress={() => assegnaServoDellaGlebaAEdificio(a.id, serra.id)}
                >
                  <Text style={styles.btnText}>Assegna</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      </View>
    </View>
  );
}

export default function SerraScreen() {
  const router = useRouter();
  const {
    abitanti,
    edifici,
    coltureSerraSbloccate,
    modalitaGioco,
    setColturaSerra,
    assegnaServoDellaGlebaAEdificio,
    rimuoviAbitanteDaEdificio,
    setStipendioEdificio
  } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const serre = useMemo(() => edifici.filter((e) => e.nome === "Serra"), [edifici]);
  const coltureDisponibili = useMemo(
    () => getColtureSerraDisponibili(coltureSerraSbloccate, modalitaGioco),
    [coltureSerraSbloccate, modalitaGioco]
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>← Indietro</Text>
        <Text style={styles.title}>🌱 Serre</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}>
        <Text style={styles.subtitle}>
          In Avventura puoi scegliere solo le colture sbloccate dagli Obiettivi; in Creativa sono tutte disponibili.
        </Text>

        {serre.length === 0 ? (
          <Text style={styles.empty}>Nessuna Serra presente nel regno.</Text>
        ) : (
          serre.map((serra) => (
            <SerraCard
              key={serra.id}
              serra={serra}
              abitanti={abitanti}
              edifici={edifici}
              coltureDisponibili={coltureDisponibili}
              setColturaSerra={setColturaSerra}
              assegnaServoDellaGlebaAEdificio={assegnaServoDellaGlebaAEdificio}
              rimuoviAbitanteDaEdificio={rimuoviAbitanteDaEdificio}
              setStipendioEdificio={setStipendioEdificio}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050816" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.5)"
  },
  back: { color: "#93c5fd", fontSize: 12 },
  title: { color: "#fff", fontSize: 14, fontWeight: "700" },
  content: { padding: 12, gap: 12 },
  contentDesktop: { maxWidth: 980, width: "100%", alignSelf: "center" },
  subtitle: { color: "#94a3b8", fontSize: 11, lineHeight: 16 },
  serraCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    borderRadius: 10,
    padding: 12,
    gap: 12
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  serraTitle: { color: "#fff", fontSize: 14, fontWeight: "800" },
  meta: { color: "#94a3b8", fontSize: 10, marginTop: 3 },
  cropBadge: { backgroundColor: "#1e293b", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  cropBadgeText: { color: "#e2e8f0", fontSize: 11, fontWeight: "700" },
  infoBox: { backgroundColor: "#111827", borderRadius: 8, padding: 10 },
  infoTitle: { color: "#93c5fd", fontSize: 11, fontWeight: "700" },
  infoText: { color: "#e2e8f0", fontSize: 11, marginTop: 3 },
  infoMuted: { color: "#94a3b8", fontSize: 10, marginTop: 3 },
  sectionTitle: { color: "#fff", fontSize: 12, fontWeight: "700" },
  cropGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  cropButton: {
    width: 92,
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)",
    paddingVertical: 8
  },
  cropButtonSelected: { borderColor: "#4ade80", backgroundColor: "#13251c" },
  cropEmoji: { fontSize: 20 },
  cropName: { color: "#e2e8f0", fontSize: 9, marginTop: 2 },
  wageBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 10,
    gap: 8
  },
  wageRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  wageBtn: { backgroundColor: "#334155", borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  wageBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  wageValue: { color: "#e2e8f0", fontSize: 11, fontWeight: "700" },
  columns: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  column: { flex: 1, minWidth: 260 },
  empty: { color: "#64748b", fontSize: 11, fontStyle: "italic", paddingVertical: 10 },
  personCard: {
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 8,
    marginTop: 7
  },
  personName: { color: "#e5e7eb", fontSize: 11, fontWeight: "700", marginTop: 4 },
  personMeta: { color: "#94a3b8", fontSize: 9, marginTop: 2 },
  addBtn: { backgroundColor: "#2563eb", borderRadius: 5, paddingVertical: 6, width: "100%", alignItems: "center", marginTop: 6 },
  removeBtn: { backgroundColor: "#dc2626", borderRadius: 5, paddingVertical: 6, width: "100%", alignItems: "center", marginTop: 6 },
  btnText: { color: "#fff", fontSize: 10, fontWeight: "700" }
});
