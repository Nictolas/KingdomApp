import React from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

const GRIGLIA_COLONNE = 6;
const GRIGLIA_RIGHE = 6;
const PADDING = 12;
const GAP = 4;
const MIN_CELL_SIZE = 44;

/** Indice della cella occupata dal Centro di Comando (centro griglia). */
const CENTRO_COMANDO_INDEX = Math.floor(GRIGLIA_COLONNE * GRIGLIA_RIGHE / 2) - Math.floor(GRIGLIA_COLONNE / 2);

export default function MappaScreen() {
  const router = useRouter();
  const { width } = Dimensions.get("window");
  const rawSize = (width - PADDING * 2 - GAP * (GRIGLIA_COLONNE - 1)) / GRIGLIA_COLONNE;
  const size = Math.max(MIN_CELL_SIZE, Math.floor(rawSize));

  const totaleCelle = GRIGLIA_COLONNE * GRIGLIA_RIGHE;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Indietro
        </Text>
        <Text style={styles.title}>Mappa</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.grigliaWrap, { padding: PADDING }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.griglia, { gap: GAP }]}>
          {Array.from({ length: totaleCelle }, (_, i) => {
            const èCentroComando = i === CENTRO_COMANDO_INDEX;
            return (
              <Pressable
                key={i}
                style={[
                  styles.cella,
                  { width: size, height: size },
                  èCentroComando && styles.cellaEdificio
                ]}
                onPress={() => {
                  if (èCentroComando) router.push("/ministri");
                }}
              >
                {èCentroComando ? (
                  <Text style={styles.edificioNome} numberOfLines={2}>
                    Centro di Comando
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
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
  back: {
    color: "#93c5fd",
    fontSize: 12
  },
  title: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700"
  },
  scroll: {
    flex: 1
  },
  grigliaWrap: {
    flexGrow: 1
  },
  griglia: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "flex-start"
  },
  cella: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
    justifyContent: "center",
    alignItems: "center"
  },
  cellaEdificio: {
    backgroundColor: "rgba(234,179,8,0.15)",
    borderColor: "rgba(234,179,8,0.6)"
  },
  edificioNome: {
    color: "#eab308",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    padding: 4
  }
});
