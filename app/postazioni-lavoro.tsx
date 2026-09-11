import React, { useMemo, useState } from "react";
import { Dimensions, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { elencoPostazioniLavoroOrdinato } from "../src/game/edificiLavoro";
import { getServiDellaGlebaAssegnabili } from "../src/game/edificiLavoro";
import { AbitanteAvatarPreview } from "../src/ui/AbitanteAvatarPreview";

function titoloEdificio(nome: string, edificioId: number, duplicatiPerNome: Map<string, number>): string {
  const count = duplicatiPerNome.get(nome) ?? 1;
  if (count <= 1) return nome;
  if (nome === "Serra") return edificioId === 2 ? "Serra (unità 1)" : edificioId === 21 ? "Serra (unità 2)" : `${nome} (#${edificioId})`;
  return `${nome} (#${edificioId})`;
}

export default function PostazioniLavoroScreen() {
  const router = useRouter();
  const { edifici, abitanti, assegnaServoDellaGlebaAEdificio } = useGameContext();
  const [edificioSelezionato, setEdificioSelezionato] = useState<number | null>(null);

  const { righe, duplicatiPerNome } = useMemo(() => {
    const lista = elencoPostazioniLavoroOrdinato(edifici);
    const counts = new Map<string, number>();
    for (const r of lista) {
      counts.set(r.nome, (counts.get(r.nome) ?? 0) + 1);
    }
    return { righe: lista, duplicatiPerNome: counts };
  }, [edifici]);

  const serviAssegnabili = useMemo(
    () => getServiDellaGlebaAssegnabili(abitanti, edifici),
    [abitanti, edifici]
  );

  const edificioTarget = edificioSelezionato != null ? edifici.find((e) => e.id === edificioSelezionato) : null;
  const postiLiberiTarget =
    edificioTarget != null
      ? Math.max(0, edificioTarget.capacità - (edificioTarget.abitantiAssegnati?.length ?? 0))
      : 0;

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const assegnaServo = (abitanteId: number) => {
    if (edificioSelezionato == null) return;
    assegnaServoDellaGlebaAEdificio(abitanteId, edificioSelezionato);
    setEdificioSelezionato(null);
  };

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>Postazioni di lavoro</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
          <Text style={styles.intro}>
            Posti coperti / posti totali per ogni edificio. Tocca una riga con posti liberi per assegnare un Servo della gleba.
          </Text>

          <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, styles.colEdificio]}>Edificio</Text>
            <Text style={[styles.headerCell, styles.colRatio, styles.headerRatio]}>Posti</Text>
          </View>

          {righe.length === 0 ? (
            <Text style={styles.vuoto}>Nessun edificio con postazioni di lavoro operativo.</Text>
          ) : (
            righe.map((r) => {
              const liberi = r.massimi - r.coperti;
              const assegnabile = liberi > 0 && serviAssegnabili.length > 0;
              return (
                <Pressable
                  key={r.edificioId}
                  style={[styles.row, assegnabile && styles.rowAssegnabile]}
                  onPress={assegnabile ? () => setEdificioSelezionato(r.edificioId) : undefined}
                  disabled={!assegnabile}
                >
                  <View style={styles.colEdificio}>
                    <Text style={styles.emoji}>{r.emoji}</Text>
                    <Text style={styles.nomeEdificio} numberOfLines={1}>
                      {titoloEdificio(r.nome, r.edificioId, duplicatiPerNome)}
                    </Text>
                  </View>
                  <Text style={[styles.ratio, styles.colRatio, liberi > 0 && styles.ratioLiberi]}>
                    {r.coperti}/{r.massimi}
                  </Text>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>

      <Modal visible={edificioSelezionato != null} transparent animationType="fade" onRequestClose={() => setEdificioSelezionato(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setEdificioSelezionato(null)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>🌾 Assegna Servo della gleba</Text>
            <Text style={styles.modalSub}>
              {edificioTarget?.nome} · {postiLiberiTarget} post{postiLiberiTarget === 1 ? "o" : "i"} liber{postiLiberiTarget === 1 ? "o" : "i"}
            </Text>
            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {serviAssegnabili.length === 0 ? (
                <Text style={styles.modalVuoto}>Nessun Servo della gleba disponibile.</Text>
              ) : (
                serviAssegnabili.map((s) => (
                  <Pressable key={s.id} style={styles.modalItem} onPress={() => assegnaServo(s.id)}>
                    <AbitanteAvatarPreview abitante={s} size={32} />
                    <View style={styles.modalItemText}>
                      <Text style={styles.modalItemNome}>{s.nome}</Text>
                      <Text style={styles.modalItemMeta}>Comp. {s.competenza}% · {s.lavoro}</Text>
                    </View>
                  </Pressable>
                ))
              )}
            </ScrollView>
            <Pressable style={styles.modalChiudi} onPress={() => setEdificioSelezionato(null)}>
              <Text style={styles.modalChiudiText}>Annulla</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={styles.footer}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Indietro
        </Text>
      </View>
    </SafeAreaView>
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
  content: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: 16
  },
  intro: {
    color: "rgba(203,213,245,0.75)",
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 12
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: "rgba(59,130,246,0.2)",
    borderRadius: 8,
    marginBottom: 4
  },
  headerCell: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.2)",
    backgroundColor: "rgba(15,23,42,0.5)"
  },
  rowAssegnabile: {
    backgroundColor: "rgba(30,41,59,0.7)"
  },
  colEdificio: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0
  },
  colRatio: {
    width: 56,
    textAlign: "right"
  },
  headerRatio: {
    textAlign: "right"
  },
  emoji: {
    fontSize: 18
  },
  nomeEdificio: {
    flex: 1,
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "600"
  },
  ratio: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "700",
    fontVariant: ["tabular-nums"]
  },
  ratioLiberi: {
    color: "#4ade80"
  },
  vuoto: {
    color: "rgba(203,213,225,0.7)",
    fontSize: 12,
    fontStyle: "italic",
    paddingVertical: 16,
    textAlign: "center"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  modalCard: {
    backgroundColor: "#0f172a",
    borderRadius: 14,
    padding: 16,
    width: "100%",
    maxWidth: 360,
    maxHeight: "70%",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)"
  },
  modalTitle: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4
  },
  modalSub: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    marginBottom: 12
  },
  modalList: {
    maxHeight: 280
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: "rgba(30,41,59,0.5)"
  },
  modalItemEmoji: {
    fontSize: 24
  },
  modalItemText: {
    flex: 1
  },
  modalItemNome: {
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "600"
  },
  modalItemMeta: {
    color: "rgba(148,163,184,0.8)",
    fontSize: 10
  },
  modalVuoto: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 11,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 16
  },
  modalChiudi: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: "center"
  },
  modalChiudiText: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "600"
  }
});
