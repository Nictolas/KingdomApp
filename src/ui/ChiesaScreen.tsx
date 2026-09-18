import React, { useMemo, useState, useSyncExternalStore } from "react";
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
import { useGameContext } from "../context/GameContext";
import {
  EMOJI_CHIESA,
  conReligioneTempioChiesa,
  fedeliRegistratiChiesa,
  NOME_CHIESA,
  religioneTempioDi,
  sacerdotiAssegnatiChiesa
} from "../game/chiesa";
import { elencoReligioniTempio, emojiReligione } from "../game/fedeleCulto";
import {
  getCultoArrivatiMappaSnapshotForEdificio,
  subscribeCultoArrivatiMappa
} from "../game/mappaCultoArrivatiStore";
import {
  getLavoroArrivatiMappaSnapshot,
  subscribeLavoroArrivatiMappa
} from "../game/mappaLavoroArrivatiStore";
import { lavoratoreDentroEdificioOra } from "../game/presenzaLavoroEdificio";
import { useOrologioGioco } from "../hooks/useOrologioGioco";
import { AbitanteLpcAvatar } from "./AbitanteLpcAvatar";
import { AbitanteInfoModal } from "./AbitanteInfoModal";
import type { Abitante } from "../types";

type Props = {
  edificioId: number;
};

export function ChiesaScreen({ edificioId }: Props) {
  const router = useRouter();
  const {
    abitanti,
    edifici,
    religioniCustom,
    calcolaFelicitàModificata,
    etaMinimaLavoro,
    rimuoviAbitanteDaEdificio,
    aggiornaEdificioById
  } = useGameContext();
  const [selectedAbitante, setSelectedAbitante] = useState<Abitante | null>(null);
  const { minuti: orologioMinuti } = useOrologioGioco();

  const cultoArrivati = useSyncExternalStore(
    subscribeCultoArrivatiMappa,
    () => getCultoArrivatiMappaSnapshotForEdificio(edificioId),
    () => getCultoArrivatiMappaSnapshotForEdificio(edificioId)
  );
  const lavoroArrivati = useSyncExternalStore(
    subscribeLavoroArrivatiMappa,
    getLavoroArrivatiMappaSnapshot,
    getLavoroArrivatiMappaSnapshot
  );

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const maxHeight = isDesktop ? width * (9 / 16) : undefined;

  const edificio = useMemo(
    () => edifici.find((e) => e.id === edificioId && e.nome === NOME_CHIESA),
    [edifici, edificioId]
  );

  const sacerdoti = useMemo(
    () => (edificio ? sacerdotiAssegnatiChiesa(edificio, abitanti) : []),
    [edificio, abitanti]
  );
  const religioneTempio = useMemo(
    () => religioneTempioDi(edificio, religioniCustom),
    [edificio, religioniCustom]
  );
  const religioniTempioOpzioni = useMemo(
    () => elencoReligioniTempio(religioniCustom),
    [religioniCustom]
  );
  const fedeli = useMemo(
    () => fedeliRegistratiChiesa(abitanti, religioneTempio),
    [abitanti, religioneTempio]
  );

  const sacerdotiInServizio = useMemo(
    () =>
      sacerdoti.filter((a) =>
        lavoratoreDentroEdificioOra(a.id, edificioId, orologioMinuti, edifici, lavoroArrivati)
      ),
    [sacerdoti, edificioId, orologioMinuti, edifici, lavoroArrivati]
  );

  const presenti = useMemo(() => {
    const addetti = new Set(edificio?.abitantiAssegnati ?? []);
    const daCulto = abitanti.filter((a) => cultoArrivati.has(a.id) && !addetti.has(a.id));
    const map = new Map<number, Abitante>();
    for (const a of sacerdotiInServizio) map.set(a.id, a);
    for (const a of daCulto) map.set(a.id, a);
    return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  }, [abitanti, cultoArrivati, edificio, sacerdotiInServizio]);

  const getAbitanteNome = (id: number) => abitanti.find((a) => a.id === id)?.nome ?? `ID ${id}`;

  if (!Number.isFinite(edificioId) || !edificio) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.title}>Chiesa non trovata</Text>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Indietro
        </Text>
      </SafeAreaView>
    );
  }

  const titolo = `${EMOJI_CHIESA} ${edificio.nome} (#${edificioId})`;
  const cap = edificio.capacità ?? 30;

  return (
    <SafeAreaView style={[styles.safe, maxHeight != null ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>{titolo}</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Religione del Tempio</Text>
            <Text style={styles.religioneNome}>
              {emojiReligione(religioneTempio, religioniCustom)} {religioneTempio}
            </Text>
            <Text style={styles.infoSubtext}>
              Non può essere Ateo, Deista o Agnostico. I credenti sono gli abitanti con questa
              religione.{" "}
              {EMOJI_CHIESA} Chiesa.
            </Text>
            <View style={styles.religioneChipRow}>
              {religioniTempioOpzioni.map((nome) => {
                const attiva = nome === religioneTempio;
                return (
                  <Pressable
                    key={nome}
                    style={[styles.religioneChip, attiva && styles.religioneChipAttivo]}
                    onPress={() => {
                      if (!edificio || attiva) return;
                      aggiornaEdificioById(edificio.id, (e) =>
                        conReligioneTempioChiesa(e, nome, religioniCustom)
                      );
                    }}
                  >
                    <Text style={styles.religioneChipEmoji}>
                      {emojiReligione(nome, religioniCustom)}
                    </Text>
                    <Text
                      style={[styles.religioneChipText, attiva && styles.religioneChipTextAttivo]}
                      numberOfLines={1}
                    >
                      {nome}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.dueColonne}>
            <View style={[styles.colonna, styles.card]}>
              <Text style={styles.sectionTitle}>Sacerdote</Text>
              <Text style={styles.count}>
                {sacerdoti.length}/{cap} posti · {sacerdotiInServizio.length} in servizio
              </Text>
              <Text style={styles.infoSubtext}>
                Clero assegnato a questa Chiesa.{" "}
                <Text style={styles.legendVerde}>Verde = attualmente nel tempio.</Text>
              </Text>
              {sacerdoti.length > 0 ? (
                <View style={styles.lista}>
                  {sacerdoti.map((a) => {
                    const inServizio = sacerdotiInServizio.some((x) => x.id === a.id);
                    return (
                      <Pressable
                        key={a.id}
                        style={[styles.personRow, inServizio ? styles.personDentro : styles.personFuori]}
                        onPress={() => setSelectedAbitante(a)}
                      >
                        <AbitanteLpcAvatar abitante={a} />
                        <View style={styles.personText}>
                          <Text style={styles.personNome}>{a.nome}</Text>
                          <Text style={styles.personMeta}>{a.lavoro}</Text>
                          <Text style={[styles.presenza, inServizio && styles.presenzaDentro]}>
                            {inServizio ? "In servizio" : "Assente"}
                          </Text>
                        </View>
                        <Pressable
                          style={styles.removeBtn}
                          onPress={(e) => {
                            e.stopPropagation?.();
                            rimuoviAbitanteDaEdificio(a.id, edificio.id);
                          }}
                        >
                          <Text style={styles.removeBtnText}>Rimuovi</Text>
                        </Pressable>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.empty}>Nessun sacerdote assegnato.</Text>
              )}
            </View>

            <View style={[styles.colonna, styles.card]}>
              <Text style={styles.sectionTitle}>Credenti</Text>
              <Text style={styles.count}>
                {fedeli.length} registrati · {presenti.length} presenti
              </Text>
              <Text style={styles.infoSubtext}>
                Registrati = abitanti con religione «{religioneTempio}». Presenti = chi è dentro la
                Chiesa in questo momento.
              </Text>

              <Text style={[styles.subSection, { marginTop: 8 }]}>Presenti nell’edificio</Text>
              {presenti.length > 0 ? (
                <View style={styles.lista}>
                  {presenti.map((a) => (
                    <Pressable
                      key={a.id}
                      style={styles.visitatoreRow}
                      onPress={() => setSelectedAbitante(a)}
                    >
                      <AbitanteLpcAvatar abitante={a} size={32} />
                      <View style={styles.personText}>
                        <Text style={styles.personNome} numberOfLines={1}>
                          {a.nome}
                        </Text>
                        <Text style={styles.personMeta} numberOfLines={1}>
                          {a.lavoro} · {a.religione}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={styles.empty}>Nessuno presente in questo momento.</Text>
              )}

              <Text style={[styles.subSection, { marginTop: 10 }]}>
                Registrati ({fedeli.length})
              </Text>
              {fedeli.length > 0 ? (
                <View style={styles.lista}>
                  {fedeli.map((a) => {
                    const dentro = presenti.some((p) => p.id === a.id);
                    return (
                      <Pressable
                        key={a.id}
                        style={[styles.visitatoreRow, dentro && styles.personDentro]}
                        onPress={() => setSelectedAbitante(a)}
                      >
                        <AbitanteLpcAvatar abitante={a} size={32} />
                        <View style={styles.personText}>
                          <Text style={styles.personNome} numberOfLines={1}>
                            {a.nome}
                          </Text>
                          <Text style={styles.personMeta} numberOfLines={1}>
                            {a.lavoro}
                            {dentro ? " · Dentro" : ""}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.empty}>Nessun credente registrato per questa religione.</Text>
              )}
            </View>
          </View>
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Indietro
        </Text>
      </View>

      <AbitanteInfoModal
        visible={selectedAbitante !== null}
        abitante={selectedAbitante}
        edifici={edifici}
        onClose={() => setSelectedAbitante(null)}
        getAbitanteNome={getAbitanteNome}
        calcolaFelicitàModificata={calcolaFelicitàModificata}
        etaMinimaLavoro={etaMinimaLavoro}
      />
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
  back: { color: "#93c5fd", fontSize: 12 },
  title: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  content: { paddingHorizontal: 12, paddingVertical: 8, paddingBottom: 24 },
  infoCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.55)"
  },
  infoTitle: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  religioneNome: { color: "#f8fafc", fontSize: 16, fontWeight: "700" },
  infoSubtext: { color: "rgba(203,213,245,0.7)", fontSize: 9, marginTop: 4 },
  religioneChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10
  },
  religioneChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
    backgroundColor: "rgba(15,23,42,0.85)",
    maxWidth: "48%"
  },
  religioneChipAttivo: {
    borderColor: "#60a5fa",
    backgroundColor: "rgba(37,99,235,0.35)"
  },
  religioneChipEmoji: { fontSize: 12 },
  religioneChipText: { color: "#cbd5e1", fontSize: 10, fontWeight: "600", flexShrink: 1 },
  religioneChipTextAttivo: { color: "#eff6ff" },
  legendVerde: { color: "#86efac", fontWeight: "600" },
  dueColonne: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 10 },
  colonna: { flex: 1, minWidth: 0 },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.55)"
  },
  sectionTitle: { color: "#ffffff", fontSize: 12, fontWeight: "700", marginBottom: 4 },
  subSection: { color: "#93c5fd", fontSize: 10, fontWeight: "700", marginBottom: 4 },
  count: { color: "#ffffff", fontSize: 13, fontWeight: "700", marginBottom: 4 },
  lista: { gap: 6, marginTop: 6 },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 6,
    padding: 8,
    borderWidth: 1
  },
  personDentro: {
    backgroundColor: "rgba(22,101,52,0.38)",
    borderColor: "rgba(74,222,128,0.5)"
  },
  personFuori: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderColor: "rgba(148,163,184,0.55)"
  },
  visitatoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: "rgba(30,41,59,0.45)",
    borderRadius: 6
  },
  personText: { flex: 1, minWidth: 0 },
  personNome: { color: "#e5e7eb", fontSize: 11, fontWeight: "700" },
  personMeta: { color: "rgba(203,213,245,0.7)", fontSize: 9, marginTop: 1 },
  presenza: { marginTop: 2, fontSize: 9, fontWeight: "700", color: "rgba(203,213,245,0.55)" },
  presenzaDentro: { color: "#bbf7d0" },
  removeBtn: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4
  },
  removeBtnText: { color: "#ffffff", fontSize: 9, fontWeight: "600" },
  empty: {
    color: "rgba(203,213,245,0.55)",
    fontSize: 9,
    fontStyle: "italic",
    marginTop: 6
  }
});
