import React from "react";
import { StyleSheet, View } from "react-native";

type Props = {
  width: number;
  height: number;
};

const OUTLINE = "#0c0c0c";

/** Tetto a fasce (tegole). */
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
            opacity: 0.9
          }}
        />
      ))}
      <View style={[styles.roofRimLight, { backgroundColor: colors.light }]} />
    </View>
  );
}

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
              backgroundColor: "rgba(0,0,0,0.1)"
            }
          ]}
        />
      ))}
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

/** Amministrazione 3×2 — solo View (niente PNG: compatibile web). */
export function RpgFootprintAdmin3x2({ width, height }: Props) {
  const roofH = Math.round(height * 0.46);
  const grondaH = 3;
  const wallH = height - roofH - grondaH;
  const bandH = Math.max(3, Math.floor(wallH * 0.12));

  return (
    <View style={[styles.wrap, { width, height }]} pointerEvents="none">
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

/** Dormitorio 2×2 */
export function RpgFootprintDorm2x2({ width, height }: Props) {
  const roofH = Math.round(height * 0.46);
  const grondaH = 3;
  const wallH = height - roofH - grondaH;
  const bandH = Math.max(3, Math.floor(wallH * 0.1));

  return (
    <View style={[styles.wrap, { width, height }]} pointerEvents="none">
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

/**
 * Spazioporto 4×3 — composizione stile “centro spaziale” (no PNG):
 * fila alta: plancia + cupola + piatto; medio: edificio verde/grigio; basso: razzo + torri.
 */
export function RpgFootprintSpazioporto4x3({ width, height }: Props) {
  return (
    <View style={[styles.wrap, styles.wrapSpazioporto, { width, height }]} pointerEvents="none">
      <View style={styles.spRowTop}>
        <View style={styles.spTopSide} />
        <View style={styles.spTopCenter}>
          <View style={styles.spDome} />
          <View style={styles.spDish} />
        </View>
        <View style={styles.spTopSide} />
        <View style={styles.spTopSide} />
      </View>
      <View style={styles.spRowMid}>
        <View style={styles.spWallSeg} />
        <View style={[styles.spGlassCol, styles.spGlassMid]} />
        <View style={styles.spWallSeg} />
        <View style={styles.spWallSeg} />
      </View>
      <View style={styles.spRowBot}>
        <View style={styles.spTower}>
          <View style={styles.spTowerArm} />
          <View style={styles.spTowerArm} />
        </View>
        <View style={styles.spRocketCol}>
          <View style={styles.spRocketBody} />
        </View>
        <View style={styles.spTower}>
          <View style={styles.spTowerArm} />
          <View style={styles.spTowerArm} />
        </View>
        <View style={styles.spPad} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 2,
    borderWidth: 2,
    borderColor: OUTLINE,
    overflow: "hidden",
    backgroundColor: "#1a1814"
  },
  wrapSpazioporto: {
    borderColor: "#1e3a5f",
    backgroundColor: "#4a5d23"
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
    right: "45%",
    height: 2,
    opacity: 0.45
  },
  gronda: {
    width: "100%",
    backgroundColor: "#d6d3d1",
    borderBottomWidth: 1,
    borderBottomColor: OUTLINE
  },
  wallBlockFlex: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    backgroundColor: "#e5e5e5"
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
  },
  spRowTop: {
    flex: 1,
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: OUTLINE,
    backgroundColor: "#5c6b4a"
  },
  spTopSide: {
    flex: 1,
    margin: 1,
    backgroundColor: "#6b7c52",
    borderWidth: 1,
    borderColor: OUTLINE
  },
  spTopCenter: {
    flex: 1.4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 2
  },
  spDome: {
    width: "38%",
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: "#94a3b8",
    borderWidth: 2,
    borderColor: OUTLINE
  },
  spDish: {
    width: "42%",
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
    borderWidth: 2,
    borderColor: OUTLINE,
    borderBottomWidth: 6,
    borderBottomColor: "#64748b"
  },
  spRowMid: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#7c8f5a",
    borderBottomWidth: 1,
    borderBottomColor: OUTLINE
  },
  spWallSeg: {
    flex: 1,
    margin: 1,
    backgroundColor: "#8b9a6e",
    borderWidth: 1,
    borderColor: OUTLINE
  },
  spGlassCol: {
    flex: 1,
    margin: 1,
    borderWidth: 2,
    borderColor: OUTLINE
  },
  spGlassMid: {
    backgroundColor: "#38bdf8"
  },
  spRowBot: {
    flex: 1.1,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#78716c",
    paddingBottom: 2
  },
  spTower: {
    flex: 0.85,
    height: "88%",
    marginHorizontal: 1,
    backgroundColor: "#b91c1c",
    borderWidth: 2,
    borderColor: OUTLINE,
    justifyContent: "space-between",
    paddingVertical: 3
  },
  spTowerArm: {
    height: 3,
    backgroundColor: "#ea580c",
    marginHorizontal: 2,
    borderRadius: 1
  },
  spRocketCol: {
    flex: 1.1,
    alignItems: "center",
    justifyContent: "flex-end",
    height: "100%"
  },
  spRocketBody: {
    width: "42%",
    flex: 1,
    maxHeight: "92%",
    backgroundColor: "#f8fafc",
    borderWidth: 2,
    borderColor: OUTLINE,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2
  },
  spPad: {
    flex: 0.75,
    height: "35%",
    margin: 2,
    backgroundColor: "#57534e",
    borderWidth: 1,
    borderColor: OUTLINE
  }
});
