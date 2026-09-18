import React from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { AbitanteLpcAvatar } from "../src/ui/AbitanteLpcAvatar";
import type { Abitante } from "../src/types";

export default function CultoOmbreScreen() {
  const router = useRouter();
  const { abitanti, capoReligiosoAlieni, setCapoReligiosoAlieni } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  // Fedeli del Culto delle Ombre (abitanti con religione "Culto delle Ombre" e razza non Umana)
  const isNonUmano = (a) => (a.razza ?? "Umano") !== "Umano";
  const fedeli = abitanti.filter(
    (a) => a.religione === "Culto delle Ombre" && isNonUmano(a)
  );
  const capoReligioso = abitanti.find((a) => a.id === capoReligiosoAlieni);

  // Abitanti disponibili per essere nominati capo religioso (non già capo di altro culto, non-umani del Culto delle Ombre)
  const { capoReligiosoSole } = useGameContext();
  const disponibiliPerCapo = abitanti.filter(
    (a) =>
      a.id !== capoReligiosoSole &&
      a.religione === "Culto delle Ombre" &&
      isNonUmano(a)
  );

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>🌑 Culto delle Ombre</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Capo Religioso */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Capo Religioso</Text>
          {capoReligioso ? (
            <View style={styles.capoCard}>
              <AbitanteLpcAvatar abitante={capoReligioso} />
              <View style={styles.capoContent}>
                <Text style={styles.capoNome}>{capoReligioso.nome}</Text>
                <Text style={styles.capoInfo}>{capoReligioso.lavoro}</Text>
                <Pressable
                  style={styles.removeButton}
                  onPress={() => setCapoReligiosoAlieni(null)}
                >
                  <Text style={styles.removeButtonText}>Rimuovi</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Nessun capo religioso nominato</Text>
              {disponibiliPerCapo.length > 0 && (
                <View style={styles.nominaSection}>
                  <Text style={styles.nominaTitle}>Nomina Capo Religioso</Text>
                  <ScrollView style={styles.fedeliList} showsVerticalScrollIndicator={false}>
                    {disponibiliPerCapo.map((abitante: Abitante) => (
                      <Pressable
                        key={abitante.id}
                        style={styles.fedeleItem}
                        onPress={() => setCapoReligiosoAlieni(abitante.id)}
                      >
                        <AbitanteLpcAvatar abitante={abitante} size={32} />
                        <View style={styles.fedeleContent}>
                          <Text style={styles.fedeleNome}>{abitante.nome}</Text>
                          <Text style={styles.fedeleInfo}>{abitante.lavoro}</Text>
                        </View>
                        <Text style={styles.nominaButton}>Nomina</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Fedeli */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fedeli ({fedeli.length})</Text>
          {fedeli.length > 0 ? (
            <View style={styles.fedeliGrid}>
              {fedeli.map((fedele: Abitante) => (
                <View key={fedele.id} style={styles.fedeleCard}>
                  <AbitanteLpcAvatar abitante={fedele} />
                  <Text style={styles.fedeleCardNome}>{fedele.nome}</Text>
                  <Text style={styles.fedeleCardLavoro}>{fedele.lavoro}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Nessun fedele registrato</Text>
          )}
        </View>
      </ScrollView>
    </View>
    <View style={styles.footer}>
      <Text style={styles.back} onPress={() => router.back()}>← Religione</Text>
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
    paddingVertical: 6,
    paddingBottom: 8,
    flex: 1
  },
  section: {
    marginBottom: 12
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8
  },
  capoCard: {
    flexDirection: "row",
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  capoEmoji: {
    fontSize: 40,
    marginRight: 10
  },
  capoContent: {
    flex: 1
  },
  capoNome: {
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4
  },
  capoInfo: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    marginBottom: 6
  },
  removeButton: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(239,68,68,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#ef4444"
  },
  removeButtonText: {
    color: "#ef4444",
    fontSize: 9,
    fontWeight: "600"
  },
  emptyCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  emptyText: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 10,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 8
  },
  nominaSection: {
    marginTop: 8
  },
  nominaTitle: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 6
  },
  fedeliList: {
    maxHeight: 150
  },
  fedeleItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(5,8,22,0.8)",
    borderRadius: 6,
    padding: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)"
  },
  fedeleEmoji: {
    fontSize: 24,
    marginRight: 8
  },
  fedeleContent: {
    flex: 1
  },
  fedeleNome: {
    color: "#e5e7eb",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 2
  },
  fedeleInfo: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9
  },
  nominaButton: {
    color: "#3b82f6",
    fontSize: 9,
    fontWeight: "600"
  },
  fedeliGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  fedeleCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    alignItems: "center",
    width: "48%",
    minWidth: 120
  },
  fedeleCardEmoji: {
    fontSize: 32,
    marginBottom: 4
  },
  fedeleCardNome: {
    color: "#e5e7eb",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 2,
    textAlign: "center"
  },
  fedeleCardLavoro: {
    color: "#93c5fd",
    fontSize: 9,
    textAlign: "center"
  }
});
