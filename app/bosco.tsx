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
  BOTTINO_BOSCO,
  CAPACITA_BOSCO,
  etichettaRaccoltoBosco
} from "../src/game/boscoRaccolta";
import { AbitanteAvatarPreview } from "../src/ui/AbitanteAvatarPreview";
import type { Abitante } from "../src/types";
import { getGiornoGiocoSnapshot } from "../src/game/orologioGiocoSession";
import {
  aggiornaLeggeCacciaBosco, normalizzaStatoEcosistemaBosco,
  scegliLuogoSacroBosco,
  type IntensitaCaccia
} from "../src/game/ecosistemaBosco";

export default function BoscoScreen() {
  const router = useRouter();
  const { abitanti, edifici, aggiornaEdificioById, religioniCustom } = useGameContext();
  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;

  const bosco = edifici.find((e) => e.nome === "Bosco");
  const ambiente = normalizzaStatoEcosistemaBosco(
    bosco?.ecosistemaBosco, getGiornoGiocoSnapshot() - 1
  );
  const religioniNaturaliste = religioniCustom.filter(r =>
    r.dottrinaNaturalista?.forestaSacra ||
    r.dottrinaNaturalista?.tutelaFauna ||
    r.dottrinaNaturalista?.tutelaVegetazione
  );
  const cambiaLuogoSacro = (nome: string | null) => {
    if (!bosco) return;
    aggiornaEdificioById(bosco.id, edificio => ({
      ...edificio,
      ecosistemaBosco: scegliLuogoSacroBosco(
        normalizzaStatoEcosistemaBosco(
          edificio.ecosistemaBosco, getGiornoGiocoSnapshot() - 1
        ),
        nome,
        religioniCustom,
        getGiornoGiocoSnapshot()
      )
    }));
  };
  const modificaCaccia = (quota: number, intensita: IntensitaCaccia) => {
    if (!bosco) return;
    aggiornaEdificioById(bosco.id, (edificio) => ({
      ...edificio,
      ecosistemaBosco: aggiornaLeggeCacciaBosco(
        normalizzaStatoEcosistemaBosco(
          edificio.ecosistemaBosco, getGiornoGiocoSnapshot() - 1
        ),
        quota,
        intensita
      )
    }));
  };
  const raccoglitori = useMemo(
    () =>
      bosco
        ? bosco.abitantiAssegnati
            .map((id) => abitanti.find((a) => a.id === id))
            .filter((a): a is Abitante => a != null)
        : [],
    [abitanti, bosco]
  );

  const bottiniPossibili = useMemo(() => {
    const seen = new Set<string>();
    return BOTTINO_BOSCO.filter((v) => {
      if (seen.has(v.itemId)) return false;
      seen.add(v.itemId);
      return true;
    });
  }, []);

  if (!bosco) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.title}>🌲 Bosco non presente</Text>
        <Text style={styles.back} onPress={() => router.back()}>← Indietro</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>🌲 Bosco</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Raccolta spontanea</Text>
          <Text style={styles.infoText}>
            I Raccoglitori producono solo dopo l'arrivo reale nel Bosco e almeno 30 minuti
            di lavoro. L'esito dipende da tempo, competenza e risorse disponibili.
          </Text>
          <Text style={styles.infoMuted}>
            I disoccupati diventano Raccoglitori solo quando raggiungono fisicamente il Bosco sulla mappa.
          </Text>
          <Text style={styles.capacity}>
            {raccoglitori.length}/{Math.max(bosco.capacità ?? 0, CAPACITA_BOSCO)} posti occupati
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Stato dell'ecosistema</Text>
          <Text style={styles.infoText}>🌳 Alberi: {ambiente.riserve.alberi.toFixed(1)}/100</Text>
          <Text style={styles.infoText}>🦌 Fauna: {ambiente.riserve.fauna.toFixed(1)}/100</Text>
          <Text style={styles.infoText}>🌿 Vegetazione: {ambiente.riserve.vegetazione.toFixed(1)}/100</Text>
          <Text style={styles.infoMuted}>
            La raccolta consuma le scorte disponibili. La vegetazione e gli animali si
            rigenerano col tempo; i Silvicoltori favoriscono il recupero del Bosco.
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>🌳 Luogo naturale sacro</Text>
          <Text style={styles.infoText}>
            {ambiente.luogoSacro
              ? `Bosco consacrato alla religione: ${ambiente.luogoSacro.religione}`
              : "Il Bosco non è stato consacrato a nessuna religione."}
          </Text>
          <Text style={styles.infoMuted}>
            Il Re può riconoscere come sacra l'intera foresta per una religione
            che attribuisce valore spirituale alla natura. Non aggiunge edifici
            dentro il Bosco. I Druidi della religione prescelta, se vi lavorano
            realmente, favoriscono la ricrescita della vegetazione.
          </Text>
          {religioniNaturaliste.length === 0 ? (
            <Text style={styles.infoMuted}>
              Per consacrare il Bosco, crea prima una religione con almeno una
              dottrina naturalista nella schermata Religioni.
            </Text>
          ) : (
            <View style={styles.controls}>
              {religioniNaturaliste.map(r => (
                <Pressable
                  key={r.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Consacra il Bosco a ${r.nome}`}
                  accessibilityState={{ selected: ambiente.luogoSacro?.religione === r.nome }}
                  style={[styles.action, ambiente.luogoSacro?.religione === r.nome && styles.actionSelected]}
                  onPress={() => cambiaLuogoSacro(r.nome)}
                >
                  <Text style={styles.actionText}>{r.emoji} {r.nome}</Text>
                </Pressable>
              ))}
              {ambiente.luogoSacro && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Revoca la consacrazione del Bosco"
                  style={styles.action}
                  onPress={() => cambiaLuogoSacro(null)}
                >
                  <Text style={styles.actionText}>Revoca consacrazione</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Leggi del Re sulla caccia</Text>
          <Text style={styles.infoText}>
            Numero massimo di Cacciatori attivi: {ambiente.quotaMassimaCacciatori}
            {ambiente.quotaMassimaCacciatori === 0 ? " (caccia vietata)" : ""}
          </Text>
          <View style={styles.controls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Riduci il numero massimo di cacciatori"
              style={styles.action}
              onPress={() => modificaCaccia(
                Math.max(0, ambiente.quotaMassimaCacciatori - 1), ambiente.intensitaCaccia
              )}
            >
              <Text style={styles.actionText}>−</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Aumenta il numero massimo di cacciatori"
              style={styles.action}
              onPress={() => modificaCaccia(
                Math.min(100, ambiente.quotaMassimaCacciatori + 1), ambiente.intensitaCaccia
              )}
            >
              <Text style={styles.actionText}>+</Text>
            </Pressable>
          </View>
          <Text style={styles.infoText}>Intensità della caccia</Text>
          <View style={styles.controls}>
            {(["leggera", "ordinaria", "spietata"] as const).map((valore) => (
              <Pressable
                key={valore}
                accessibilityRole="button"
                accessibilityLabel={"Caccia " + valore}
                accessibilityState={{ selected: ambiente.intensitaCaccia === valore }}
                style={[styles.action, ambiente.intensitaCaccia === valore && styles.actionSelected]}
                onPress={() => modificaCaccia(ambiente.quotaMassimaCacciatori, valore)}
              >
                <Text style={styles.actionText}>{valore}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.infoMuted}>
            Caccia leggera: resa minore. Caccia spietata: maggiori opportunità di cattura,
            ma anche maggiore consumo della fauna. Le quantità sono provvisorie.
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Possibili bottini</Text>
          <View style={styles.lootGrid}>
            {bottiniPossibili.map((v) => (
              <View key={v.itemId} style={styles.lootChip}>
                <Text style={styles.lootText}>{v.emoji} {v.nome}</Text>
              </View>
            ))}
          </View>
        </View>

        {raccoglitori.length === 0 ? (
          <Text style={styles.empty}>Nessun Raccoglitore nel Bosco.</Text>
        ) : (
          <View style={styles.grid}>
            {raccoglitori.map((a) => (
              <View key={a.id} style={styles.personCard}>
                <AbitanteAvatarPreview abitante={a} />
                <Text style={styles.personName}>{a.nome}</Text>
                <Text style={styles.personMeta}>
                  {a.lavoro} · Competenza {a.competenza}%
                </Text>
                <Text style={styles.harvest}>
                  {a.ultimoRaccoltoBosco?.voci?.length
                    ? `Ultimo trovato: ${etichettaRaccoltoBosco(a.ultimoRaccoltoBosco.voci)}`
                    : "Nessun raccolto registrato"}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Esci dal Bosco e torna alla mappa"
          style={styles.exitButton}
          onPress={() => router.back()}
        >
          <Text style={styles.exitText}>← Esci dal Bosco</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050816" },
  footer: { padding: 12, borderTopWidth: 1, borderTopColor: "#334155", backgroundColor: "#0f172a" },
  exitButton: { backgroundColor: "#1d4f88", borderRadius: 10, padding: 15, alignItems: "center" },
  exitText: { color: "#fff", fontSize: 15, fontWeight: "700" },
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
  contentDesktop: { maxWidth: 920, width: "100%", alignSelf: "center" },
  infoCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    borderRadius: 10,
    padding: 12
  },
  infoTitle: { color: "#93c5fd", fontSize: 11, fontWeight: "700" },
  infoText: { color: "#e2e8f0", fontSize: 11, marginTop: 4 },
  infoMuted: { color: "#94a3b8", fontSize: 10, marginTop: 4, lineHeight: 15 },
  capacity: { color: "#4ade80", fontSize: 12, fontWeight: "800", marginTop: 8 },
  controls: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  action: { borderColor: "#64748b", borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  actionSelected: { borderColor: "#4ade80", backgroundColor: "#14532d" },
  actionText: { color: "#e2e8f0", fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  lootGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  lootChip: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  lootText: { color: "#cbd5e1", fontSize: 9 },
  empty: { color: "#64748b", fontSize: 11, fontStyle: "italic", paddingVertical: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  personCard: {
    width: 210,
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)",
    borderRadius: 8,
    padding: 10
  },
  personName: { color: "#e5e7eb", fontSize: 11, fontWeight: "700", marginTop: 5 },
  personMeta: { color: "#94a3b8", fontSize: 9, marginTop: 2 },
  harvest: { color: "#cbd5e1", fontSize: 9, marginTop: 7, textAlign: "center" }
});
