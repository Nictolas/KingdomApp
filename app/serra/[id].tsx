import { tornaAllaMappa } from "../../src/navigation/tornaAllaMappa";
import React, { useMemo } from "react";
import { Platform, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { BuildingScreenShell, BUILDING_WIDE_BREAKPOINT } from "../../src/ui/BuildingScreenShell";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useGameContext } from "../../src/context/GameContext";
import { getServiDellaGlebaPerAssegnazioneEdificio } from "../../src/game/edificiLavoro";
import { getStipendioMensileEdificio, STIPENDIO_BASE_MONETE_GIORNO } from "../../src/game/edificiPubblici";
import { getEmojiAbitante } from "../../src/utils/getEmojiAbitante";
import type { Abitante } from "../../src/types";
import {
  getColturaSerraDef,
  getColtureSerraDisponibili,
  PRODUZIONE_SERRA_GIORNALIERA,
  GIORNI_PRODUZIONE_SERRA_PER_MESE
} from "../../src/game/colturaSerra";

export default function SerraScreenById() {
  const router = useRouter();
  const raw = useLocalSearchParams<{ id: string | string[] }>().id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const edificioId = Number(idStr);

  const {
    abitanti,
    edifici,
    modalitaGioco,
    coltureSerraSbloccate,
    assegnaServoDellaGlebaAEdificio,
    rimuoviAbitanteDaEdificio,
    setStipendioEdificio,
    setColturaSerra
  } = useGameContext();

  const serra = useMemo(
    () => edifici.find((e) => e.id === edificioId && e.nome === "Serra"),
    [edifici, edificioId]
  );

  const { width } = useWindowDimensions();
  const isDesktop = width >= BUILDING_WIDE_BREAKPOINT;

  const abitantiAssegnati = serra ? abitanti.filter((a) => serra.abitantiAssegnati.includes(a.id)) : [];
  const abitantiDisponibili = useMemo(() => {
    if (!serra) return [];
    return getServiDellaGlebaPerAssegnazioneEdificio(abitanti, edifici, serra);
  }, [abitanti, edifici, serra]);

  if (!Number.isFinite(edificioId) || !serra) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.title}>Serra non trovata</Text>
        
      </SafeAreaView>
    );
  }

  const coltura = getColturaSerraDef(serra.colturaItemId);
  const colturaSelezionata = serra.colturaItemId ?? coltura?.id ?? "mela";
  const coltureDisponibili = getColtureSerraDisponibili(coltureSerraSbloccate, modalitaGioco);
  const produzioneGiornaliera =
    serra.stato === "Operativo" ? PRODUZIONE_SERRA_GIORNALIERA : 0;
  const produzioneMensile = produzioneGiornaliera * GIORNI_PRODUZIONE_SERRA_PER_MESE;
  const puòAssegnare = abitantiDisponibili.length > 0 && abitantiAssegnati.length < serra.capacità;

  const titoloSerra =
    edificioId === 2 ? "Serra (unità 1)" : edificioId === 21 ? "Serra (unità 2)" : `Serra (#${edificioId})`;

  const colContent = [
    <View key="produzione" style={[styles.column, isDesktop && styles.columnWide]}>
      <Text style={styles.sectionTitle}>Produzione</Text>
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Coltura attiva</Text>
        <Text style={styles.colturaEmoji}>{coltura?.emoji ?? "🌱"}</Text>
        <Text style={styles.colturaNome}>{coltura?.nome ?? "—"}</Text>
        <Text style={styles.produzioneValue}>
          {produzioneGiornaliera}{" "}
          <Text style={styles.produzioneUnit}>
            {coltura?.nome?.toLowerCase() ?? "prodotto"}/giorno
          </Text>
        </Text>
        <Text style={styles.infoSubtext}>
          ≈ {produzioneMensile} unità/mese
        </Text>
        <Text style={styles.infoSubtext}>
          L&apos;inventario cibo del giocatore riceve la produzione
        </Text>
      </View>
      <View style={styles.stipendioCard}>
        <Text style={styles.stipendioLabel}>
          Stipendio mensile per lavoratore ({STIPENDIO_BASE_MONETE_GIORNO} moneta/giorno)
        </Text>
        <TextInput
          style={[styles.stipendioInput, Platform.OS === "web" && { fontSize: 16 }]}
          value={String(getStipendioMensileEdificio(serra))}
          keyboardType="number-pad"
          onChangeText={(text) => {
            const n = parseInt(text.replace(/[^0-9]/g, ""), 10);
            setStipendioEdificio(serra.id, isNaN(n) ? 0 : Math.max(0, n));
          }}
        />
        <Text style={styles.infoSubtext}>
          Totale: {getStipendioMensileEdificio(serra) * abitantiAssegnati.length} monete/mese
        </Text>
        <Text style={styles.infoSubtext}>
          Posti lavoro: {abitantiAssegnati.length}/{serra.capacità}
        </Text>
      </View>
    </View>,
    <View key="coltura" style={[styles.column, isDesktop && styles.columnWide]}>
      <Text style={styles.sectionTitle}>Scegli coltura</Text>
      <Text style={styles.sectionSubtitle}>1 prodotto al giorno per Serra operativa</Text>
      <View>
        <View style={styles.colturaGrid}>
          {coltureDisponibili.map((c) => {
            const selezionata = colturaSelezionata === c.id;
            return (
              <Pressable
                key={c.id}
                style={[styles.colturaChip, selezionata && styles.colturaChipSelezionata]}
                onPress={() => setColturaSerra(serra.id, c.id)}
              >
                <Text style={styles.colturaChipEmoji}>{c.emoji}</Text>
                <Text style={[styles.colturaChipNome, selezionata && styles.colturaChipNomeSelezionata]}>
                  {c.nome}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>,
    <View key="assegnati" style={[styles.column, isDesktop && styles.columnWide]}>
      <Text style={styles.sectionTitle}>Abitanti Assegnati</Text>
      {abitantiAssegnati.length > 0 ? (
        <View>
          {abitantiAssegnati.map((a: Abitante) => (
            <View key={a.id} style={styles.card}>
              <Text style={styles.cardEmoji}>{getEmojiAbitante(a)}</Text>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{a.nome}</Text>
                <Text style={styles.cardLavoro}>{a.lavoro}</Text>
                <Text style={styles.cardExtra}>Produttività: {a.produttività}%</Text>
              </View>
              <Pressable style={styles.removeButton} onPress={() => rimuoviAbitanteDaEdificio(a.id, serra.id)}>
                <Text style={styles.removeButtonText}>Rimuovi</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>Nessun abitante assegnato</Text>
      )}
    </View>,
    <View key="disponibili" style={[styles.column, isDesktop && styles.columnWide]}>
      <Text style={styles.sectionTitle}>Assegna lavoratori</Text>
      <Text style={styles.sectionSubtitle}>Servi della gleba disponibili</Text>
      {abitantiDisponibili.length > 0 ? (
        <View>
          {abitantiDisponibili.map((a: Abitante) => (
            <View key={a.id} style={styles.card}>
              <Text style={styles.cardEmoji}>{getEmojiAbitante(a)}</Text>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{a.nome}</Text>
                <Text style={styles.cardExtra}>Produttività: {a.produttività}%</Text>
                <Text style={styles.cardExtra}>Competenza: {a.competenza}%</Text>
                <Text style={styles.cardExtra}>Personalità: {a.personalità}</Text>
              </View>
              {puòAssegnare && (
                <Pressable style={styles.addButton} onPress={() => assegnaServoDellaGlebaAEdificio(a.id, serra.id)}>
                  <Text style={styles.addButtonText}>Assegna</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>Nessun Servo della gleba disponibile</Text>
      )}
    </View>
  ];

  return (
    <BuildingScreenShell
      title={titoloSerra}
      onBack={() => tornaAllaMappa(router)}
      backLabel="Mappa"
      contentStyle={isDesktop ? styles.contentRow : styles.contentColumn}
    >
      {colContent}
    </BuildingScreenShell>
  );

}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#050816"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.6)"
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.6)"
  },
  back: {
    color: "#93c5fd",
    fontSize: 12
  },
  title: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700"
  },
  contentColumn: { gap: 22, justifyContent: "flex-start" as const },
  contentRow: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 14 },
  column: { width: "100%" as const, minWidth: 0 },
  columnWide: { flex: 1, width: "auto" as const, minWidth: 210, maxWidth: 340 },
  sectionSubtitle: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    marginBottom: 6
  },
  infoCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    alignItems: "center"
  },
  infoTitle: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  produzioneValue: {
    color: "#4ade80",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 1
  },
  produzioneUnit: {
    color: "rgba(74,222,128,0.7)",
    fontSize: 9,
    fontWeight: "500"
  },
  infoSubtext: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9,
    marginTop: 1
  },
  colturaEmoji: {
    fontSize: 28,
    marginBottom: 2
  },
  colturaNome: {
    color: "#e5e7eb",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4
  },
  colturaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center"
  },
  colturaChip: {
    width: "31%",
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)"
  },
  colturaChipSelezionata: {
    borderColor: "#4ade80",
    backgroundColor: "rgba(34,197,94,0.12)"
  },
  colturaChipEmoji: {
    fontSize: 20,
    marginBottom: 2
  },
  colturaChipNome: {
    color: "rgba(203,213,245,0.85)",
    fontSize: 8,
    textAlign: "center",
    fontWeight: "600"
  },
  colturaChipNomeSelezionata: {
    color: "#4ade80"
  },
  stipendioCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  stipendioLabel: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4
  },
  stipendioInput: {
    backgroundColor: "rgba(30,41,59,0.9)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)",
    borderRadius: 4,
    padding: 6,
    color: "#e5e7eb",
    fontSize: 14,
    minWidth: 80
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    alignItems: "center",
    alignSelf: "stretch"
  },
  cardEmoji: {
    fontSize: 24,
    marginBottom: 2
  },
  cardContent: {
    width: "100%",
    alignItems: "center"
  },
  cardTitle: {
    color: "#e5e7eb",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 1,
    textAlign: "center"
  },
  cardLavoro: {
    color: "#93c5fd",
    fontSize: 9,
    marginBottom: 1,
    textAlign: "center"
  },
  cardExtra: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 8,
    textAlign: "center",
    marginTop: 1
  },
  addButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
    width: "100%",
    alignItems: "center"
  },
  addButtonText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "600"
  },
  removeButton: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
    width: "100%",
    alignItems: "center"
  },
  removeButtonText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "600"
  },
  emptyText: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 10,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 8
  }
});
