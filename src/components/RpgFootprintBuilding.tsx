import React from "react";
import { StyleSheet, View } from "react-native";

const OUTLINE = "#0c0c0c";
const GRONDA = "#d6d3d1";

type Props = {
  width: number;
  height: number;
};

/** Tetto con fasce orizzontali (tegole / lame). */
function RoofStripes({
  roofH,
  colors,
  stripeEvery
}: {
  roofH: number;
  colors: { base: string; dark: string; light: string };
  stripeEvery: number;
}) {
  const n = Math.max(3, Math.floor(roofH / stripeEvery));
  const bandH = roofH / n;
  return (
    <View style={[styles.roofShell, { height: roofH, backgroundColor: colors.base }]}>
      {Array.from({ length: n }, (_, i) => (
        <View
          key={`s-${i}`}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: i * bandH,
            height: bandH,
            backgroundColor: i % 2 === 0 ? colors.dark : colors.light,
            opacity: 0.88
          }}
        />
      ))}
      <View style={[styles.roofRimLight, { backgroundColor: colors.light }]} />
    </View>
  );
}

/** Fasce decorative tipo “mattoni” sulla facciata. */
function WallBrickTexture({ wallH }: { wallH: number }) {
  const rows = Math.max(3, Math.floor(wallH / 5));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: rows }, (_, r) => (
        <View
          key={`br-${r}`}
          style={[
            styles.brickRow,
            {
              top: 4 + r * ((wallH - 8) / rows),
              marginLeft: r % 2 === 0 ? 0 : 6,
              backgroundColor: "rgba(0,0,0,0.12)"
            }
          ]}
        />
      ))}
    </View>
  );
}

/** Amministrazione 3×2: tetto ardesia, facciata istituzionale con tre campate. */
export function RpgFootprintAdmin3x2({ width, height }: Props) {
  const roofH = Math.round(height * 0.46);
  const grondaH = 3;
  const wallH = height - roofH - grondaH;
  const bandH = Math.max(3, Math.floor(wallH * 0.12));

  return (
    <View style={[styles.wrap, { width, height }]}>
      <RoofStripes
        roofH={roofH}
        stripeEvery={5}
        colors={{ base: "#4a5568", dark: "#374151", light: "#64748b" }}
      />
      <View style={[styles.gronda, { height: grondaH }]} />
      <View style={styles.wallBlockFlex}>
        <View style={[styles.trimBand, { height: bandH, backgroundColor: "#1e3a5f" }]} />
        <View style={styles.wallInnerFlex}>
          <WallBrickTexture wallH={wallH - bandH * 2} />
          <View style={styles.threeCols}>
            <View style={styles.col}>
              <WindowPane />
            </View>
            <View style={styles.col}>
              <DoorPane tall />
            </View>
            <View style={styles.col}>
              <WindowPane />
            </View>
          </View>
        </View>
        <View style={[styles.trimBand, { height: bandH, backgroundColor: "#1e293b" }]} />
      </View>
    </View>
  );
}

/** Dormitorio 2×2: tetto rosso vivo, muro chiaro, porta + finestra (stile casa Pokémon). */
export function RpgFootprintDorm2x2({ width, height }: Props) {
  const roofH = Math.round(height * 0.46);
  const grondaH = 3;
  const wallH = height - roofH - grondaH;
  const bandH = Math.max(3, Math.floor(wallH * 0.1));

  return (
    <View style={[styles.wrap, { width, height }]}>
      <RoofStripes
        roofH={roofH}
        stripeEvery={4}
        colors={{ base: "#b91c1c", dark: "#991b1b", light: "#dc2626" }}
      />
      <View style={[styles.gronda, { height: grondaH }]} />
      <View style={[styles.wallBlockFlex, { backgroundColor: "#f5f5f4" }]}>
        <View style={[styles.trimBand, { height: bandH, backgroundColor: "#1e3a5f" }]} />
        <View style={[styles.wallInnerFlex, { backgroundColor: "#e7e5e4" }]}>
          <WallBrickTexture wallH={wallH - bandH * 2} />
          <View style={styles.twoCols}>
            <View style={[styles.col, { justifyContent: "flex-end" }]}>
              <DoorPane />
            </View>
            <View style={[styles.col, { justifyContent: "center" }]}>
              <WindowPane small />
            </View>
          </View>
        </View>
        <View style={[styles.trimBand, { height: bandH, backgroundColor: "#334155" }]} />
      </View>
    </View>
  );
}

function WindowPane({ small }: { small?: boolean }) {
  const h = small ? "42%" : "48%";
  const w = small ? "58%" : "62%";
  return (
    <View style={[styles.windowOuter, { width: w as `${number}%`, height: h as `${number}%` }]}>
      <View style={styles.windowGlassTop} />
      <View style={styles.windowGlassBot} />
    </View>
  );
}

function DoorPane({ tall }: { tall?: boolean }) {
  const h = tall ? "78%" : "62%";
  return (
    <View style={[styles.doorOuter, { height: h as `${number}%` }]}>
      <View style={styles.doorKnob} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 2,
    borderWidth: 2,
    borderColor: OUTLINE,
    overflow: "hidden",
    backgroundColor: OUTLINE
  },
  roofShell: {
    width: "100%",
    overflow: "hidden",
    borderBottomWidth: 1,
    borderBottomColor: "#020617"
  },
  roofRimLight: {
    position: "absolute",
    left: 0,
    top: 0,
    right: "40%",
    height: 2,
    opacity: 0.45
  },
  gronda: {
    width: "100%",
    backgroundColor: GRONDA,
    borderBottomWidth: 1,
    borderBottomColor: OUTLINE
  },
  wallBlock: {
    backgroundColor: "#e5e5e5",
    width: "100%"
  },
  wallBlockFlex: {
    flex: 1,
    width: "100%",
    minHeight: 0,
    backgroundColor: "#e5e5e5"
  },
  wallInner: {
    position: "relative",
    flex: 1,
    paddingHorizontal: 3,
    paddingVertical: 2
  },
  wallInnerFlex: {
    position: "relative",
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 3,
    paddingVertical: 2
  },
  trimBand: {
    width: "100%"
  },
  threeCols: {
    flex: 1,
    flexDirection: "row",
    gap: 2,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingBottom: 2,
    zIndex: 1
  },
  twoCols: {
    flex: 1,
    flexDirection: "row",
    gap: 3,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingBottom: 2,
    zIndex: 1
  },
  col: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    minHeight: 0
  },
  brickRow: {
    position: "absolute",
    left: 4,
    right: 10,
    height: 1
  },
  windowOuter: {
    borderWidth: 2,
    borderColor: OUTLINE,
    backgroundColor: "#0ea5e9",
    overflow: "hidden"
  },
  windowGlassTop: {
    flex: 1,
    backgroundColor: "#7dd3fc"
  },
  windowGlassBot: {
    flex: 1,
    backgroundColor: "#0284c7"
  },
  doorOuter: {
    width: "52%",
    minHeight: 18,
    backgroundColor: "#78350f",
    borderWidth: 2,
    borderColor: OUTLINE,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingRight: 3
  },
  doorKnob: {
    width: 3,
    height: 3,
    borderRadius: 1,
    backgroundColor: "#facc15",
    borderWidth: 1,
    borderColor: "#854d0e"
  }
});
