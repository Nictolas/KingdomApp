import React, { useCallback, useEffect } from "react";
import { Dimensions, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, clamp } from "react-native-reanimated";

const GRIGLIA_COLONNE = 24;
const GRIGLIA_RIGHE = 24;
const PADDING = 12;
const GAP = 2;
const MIN_CELL_SIZE = 14;

/** Indice della cella occupata dal Centro di Comando (centro griglia). */
const CENTRO_COMANDO_INDEX = Math.floor(GRIGLIA_COLONNE * GRIGLIA_RIGHE / 2) - Math.floor(GRIGLIA_COLONNE / 2);

/** Emoji edifici (da edificiData). */
const EDIFICIO_EMOJI: Record<string, string> = {
  "Centro di Comando": "🏛️"
};

/** Cella è acqua (blu) se true, altrimenti erba (verde). Per ora solo erba; si può espandere con mappa terreno. */
function isAcqua(_index: number): boolean {
  return false;
}

export default function MappaScreen() {
  const router = useRouter();
  const { width } = Dimensions.get("window");
  const rawSize = (width - PADDING * 2 - GAP * (GRIGLIA_COLONNE - 1)) / GRIGLIA_COLONNE;
  const size = Math.max(MIN_CELL_SIZE, Math.floor(rawSize));

  const totaleCelle = GRIGLIA_COLONNE * GRIGLIA_RIGHE;
  const gridWidth = GRIGLIA_COLONNE * size + (GRIGLIA_COLONNE - 1) * GAP;
  const gridHeight = GRIGLIA_RIGHE * size + (GRIGLIA_RIGHE - 1) * GAP;
  const contentWidth = gridWidth + PADDING * 2;
  const contentHeight = gridHeight + PADDING * 2;

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const viewportW = useSharedValue(0);
  const viewportH = useSharedValue(0);
  const contentW = useSharedValue(contentWidth);
  const contentH = useSharedValue(contentHeight);

  useEffect(() => {
    contentW.value = contentWidth;
    contentH.value = contentHeight;
  }, [contentWidth, contentHeight, contentW, contentH]);

  const onViewportLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
      const { width: w, height: h } = e.nativeEvent.layout;
      viewportW.value = w;
      viewportH.value = h;
    },
    [viewportW, viewportH]
  );

  const pan = Gesture.Pan()
    .minDistance(8)
    .onUpdate((e) => {
      const maxX = Math.min(0, viewportW.value - contentW.value);
      const maxY = Math.min(0, viewportH.value - contentH.value);
      translateX.value = clamp(translateX.value + e.deltaX, maxX, 0);
      translateY.value = clamp(translateY.value + e.deltaY, maxY, 0);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }]
  }));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Indietro
        </Text>
        <Text style={styles.title}>Mappa</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.viewport} onLayout={onViewportLayout}>
        <GestureDetector gesture={pan}>
          <Animated.View
            style={[
              styles.contentWrap,
              { width: contentWidth, height: contentHeight, padding: PADDING },
              animatedStyle
            ]}
            collapsable={false}
          >
            <View style={[styles.griglia, { gap: GAP }]}>
              {Array.from({ length: totaleCelle }, (_, i) => {
                const èCentroComando = i === CENTRO_COMANDO_INDEX;
                const acqua = isAcqua(i);
                const route = èCentroComando ? "/ministri" : null;
                const emoji = èCentroComando ? EDIFICIO_EMOJI["Centro di Comando"] : null;
                return (
                  <Pressable
                    key={i}
                    style={[
                      styles.cella,
                      acqua ? styles.cellaAcqua : styles.cellaErba,
                      { width: size, height: size },
                      èCentroComando && styles.cellaEdificio
                    ]}
                    onPress={() => {
                      if (route) router.push(route);
                    }}
                  >
                    {emoji ? (
                      <Text style={[styles.edificioEmoji, { fontSize: Math.max(10, Math.min(22, size - 4)) }]}>
                        {emoji}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#2d5a27"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.6)",
    backgroundColor: "#050816"
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
  viewport: {
    flex: 1,
    backgroundColor: "#2d5a27",
    overflow: "hidden"
  },
  contentWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "flex-start"
  },
  griglia: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "flex-start"
  },
  cella: {
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.15)",
    justifyContent: "center",
    alignItems: "center"
  },
  cellaErba: {
    backgroundColor: "#3d7c47"
  },
  cellaAcqua: {
    backgroundColor: "#2c5282"
  },
  cellaEdificio: {
    backgroundColor: "rgba(234,179,8,0.25)",
    borderColor: "rgba(234,179,8,0.7)"
  },
  edificioEmoji: {
    fontSize: 18
  }
});
