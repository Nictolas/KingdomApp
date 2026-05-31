import React from "react";
import { StyleSheet, Text, View } from "react-native";

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

/** Capanna 2×1 — due rifugi affiancati (telo / legno). */
export function RpgFootprintCapanna2x1({ width, height }: Props) {
  const roofH = Math.round(height * 0.42);
  const baseH = height - roofH;

  return (
    <View style={[styles.wrap, { width, height }]} pointerEvents="none">
      <View
        style={{
          height: roofH,
          flexDirection: "row",
          borderBottomWidth: 2,
          borderBottomColor: OUTLINE,
          backgroundColor: "#78350f"
        }}
      >
        <View
          style={{
            flex: 1,
            margin: 2,
            marginBottom: 0,
            backgroundColor: "#b45309",
            borderTopLeftRadius: 10,
            borderTopRightRadius: 4
          }}
        />
        <View style={{ width: 2, backgroundColor: OUTLINE }} />
        <View
          style={{
            flex: 1,
            margin: 2,
            marginBottom: 0,
            backgroundColor: "#d97706",
            borderTopLeftRadius: 4,
            borderTopRightRadius: 10
          }}
        />
      </View>
      <View style={[styles.capBase, { height: baseH }]}>
        <View style={styles.capBaseInner}>
          <View style={styles.capBay}>
            <View style={styles.capLog} />
            <View style={styles.capFire} />
          </View>
          <View style={[styles.capMullion, { height: Math.max(8, baseH - 6) }]} />
          <View style={styles.capBay}>
            <View style={[styles.capLog, { alignSelf: "flex-end" }]} />
            <View style={[styles.capBedroll, { opacity: 0.9 }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

/** Serra 2×1 (due campate affiancate, tetto di vetro). */
export function RpgFootprintSerra2x1({ width, height }: Props) {
  const frame = 3;
  const roofH = Math.round(height * 0.38);
  const baseH = height - roofH;
  const midX = width / 2;

  return (
    <View style={[styles.wrap, { width, height }]} pointerEvents="none">
      <View
        style={{
          height: roofH,
          flexDirection: "row",
          borderBottomWidth: 2,
          borderBottomColor: OUTLINE,
          overflow: "hidden"
        }}
      >
        <View style={{ flex: 1, backgroundColor: "#7dd3fc", borderRightWidth: 2, borderRightColor: OUTLINE }}>
          <View style={[styles.serraRoofRib, { left: "18%" }]} />
          <View style={[styles.serraRoofRib, { left: "48%" }]} />
          <View style={[styles.serraRoofRib, { left: "78%" }]} />
        </View>
        <View style={{ flex: 1, backgroundColor: "#38bdf8" }}>
          <View style={[styles.serraRoofRib, { left: "22%" }]} />
          <View style={[styles.serraRoofRib, { left: "52%" }]} />
          <View style={[styles.serraRoofRib, { left: "82%" }]} />
        </View>
        <View
          style={{
            position: "absolute",
            left: midX - 1,
            top: 0,
            bottom: 0,
            width: 2,
            backgroundColor: OUTLINE
          }}
        />
        <View style={styles.serraRoofCap} />
      </View>
      <View style={[styles.serraBase, { height: baseH }]}>
        <View style={styles.serraBaseInner}>
          <View style={styles.serraBay}>
            <View style={styles.serraPlant} />
            <View style={[styles.serraPlant, { opacity: 0.85 }]} />
          </View>
          <View style={[styles.serraMullion, { height: baseH - frame * 2 }]} />
          <View style={styles.serraBay}>
            <View style={[styles.serraPlant, { alignSelf: "flex-end" }]} />
            <View style={[styles.serraPlant, { opacity: 0.9 }]} />
          </View>
        </View>
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

/** Bar 2×2 — tetto scuro, tenda a strisce, facciata da pub (finestroni + ingresso). */
export function RpgFootprintBar2x2({ width, height }: Props) {
  const roofH = Math.round(height * 0.34);
  const awningH = Math.max(6, Math.round(height * 0.1));
  const grondaH = 2;
  const bandH = Math.max(3, Math.floor((height - roofH - awningH - grondaH) * 0.09));
  const nStripes = Math.max(6, Math.floor(width / 10));

  return (
    <View style={[styles.wrap, { width, height }]} pointerEvents="none">
      <View
        style={{
          height: roofH,
          backgroundColor: "#1c1917",
          borderBottomWidth: 2,
          borderBottomColor: OUTLINE
        }}
      />
      <View style={{ height: awningH, flexDirection: "row", overflow: "hidden" }}>
        {Array.from({ length: nStripes }, (_, i) => (
          <View
            key={`aw-${i}`}
            style={{
              flex: 1,
              backgroundColor: i % 2 === 0 ? "#ca8a04" : "#a16207",
              borderRightWidth: i < nStripes - 1 ? 1 : 0,
              borderRightColor: OUTLINE
            }}
          />
        ))}
      </View>
      <View style={[styles.gronda, { height: grondaH }]} />
      <View style={[styles.wallBlockFlex, { backgroundColor: "#44403c" }]}>
        <View style={[styles.trimBand, { height: bandH, backgroundColor: "#292524" }]} />
        <View style={[styles.wallInnerFlex, { backgroundColor: "#57534e" }]}>
          <View style={styles.threeCols}>
            <View style={styles.col}>
              <WindowPane small />
            </View>
            <View style={[styles.col, { flex: 1.15, justifyContent: "flex-end" }]}>
              <View style={[styles.doorOuter, { width: "72%", minHeight: 22, backgroundColor: "#422006" }]}>
                <View style={styles.doorKnob} />
              </View>
              <View
                style={{
                  marginTop: 2,
                  height: 4,
                  width: "80%",
                  borderRadius: 2,
                  backgroundColor: "#fbbf24",
                  borderWidth: 1,
                  borderColor: OUTLINE,
                  opacity: 0.95
                }}
              />
            </View>
            <View style={styles.col}>
              <WindowPane small />
            </View>
          </View>
        </View>
        <View style={[styles.trimBand, { height: bandH, backgroundColor: "#1c1917" }]} />
      </View>
    </View>
  );
}

/** Mercato 2×2 — tenda verde/rossa, facciata chiara con emoji negozio. */
export function RpgFootprintMercato2x2({ width, height }: Props) {
  const roofH = Math.round(height * 0.28);
  const awningH = Math.max(6, Math.round(height * 0.12));
  const grondaH = 2;
  const bandH = Math.max(3, Math.floor((height - roofH - awningH - grondaH) * 0.09));
  const nStripes = Math.max(6, Math.floor(width / 10));
  const emojiSize = Math.max(14, Math.min(28, Math.floor(Math.min(width, height) * 0.2)));

  return (
    <View style={[styles.wrap, { width, height }]} pointerEvents="none">
      <View
        style={{
          height: roofH,
          backgroundColor: "#78716c",
          borderBottomWidth: 2,
          borderBottomColor: OUTLINE
        }}
      />
      <View style={{ height: awningH, flexDirection: "row", overflow: "hidden" }}>
        {Array.from({ length: nStripes }, (_, i) => (
          <View
            key={`mk-${i}`}
            style={{
              flex: 1,
              backgroundColor: i % 2 === 0 ? "#16a34a" : "#dc2626",
              borderRightWidth: i < nStripes - 1 ? 1 : 0,
              borderRightColor: OUTLINE
            }}
          />
        ))}
      </View>
      <View style={[styles.gronda, { height: grondaH }]} />
      <View style={[styles.wallBlockFlex, { backgroundColor: "#fef3c7" }]}>
        <View style={[styles.trimBand, { height: bandH, backgroundColor: "#92400e" }]} />
        <View style={[styles.wallInnerFlex, { backgroundColor: "#fde68a", justifyContent: "center", alignItems: "center" }]}>
          <Text style={{ fontSize: emojiSize, lineHeight: emojiSize + 2, textAlign: "center" }}>🏪</Text>
        </View>
        <View style={[styles.trimBand, { height: bandH, backgroundColor: "#78350f" }]} />
      </View>
    </View>
  );
}

/** Dissalatore 2×2 — impianto a riva (due zone mare + due sabbia in gioco); emoji 💧. */
export function RpgFootprintDissalatore2x2({ width, height }: Props) {
  const halfW = width / 2;
  const halfH = height / 2;
  const emojiSize = Math.max(12, Math.min(26, Math.floor(Math.min(width, height) * 0.2)));
  return (
    <View style={[styles.wrap, { width, height, flexDirection: "row", flexWrap: "wrap" }]} pointerEvents="none">
      <View style={{ width: halfW, height: halfH, backgroundColor: "#0ea5e9", borderWidth: 1, borderColor: OUTLINE }} />
      <View style={{ width: halfW, height: halfH, backgroundColor: "#0284c7", borderWidth: 1, borderColor: OUTLINE }} />
      <View style={{ width: halfW, height: halfH, backgroundColor: "#d6d3d1", borderWidth: 1, borderColor: OUTLINE }} />
      <View
        style={{
          width: halfW,
          height: halfH,
          backgroundColor: "#e7e5e4",
          borderWidth: 1,
          borderColor: OUTLINE,
          justifyContent: "center",
          alignItems: "center"
        }}
      >
        <Text style={{ fontSize: emojiSize, lineHeight: emojiSize + 2 }}>💧</Text>
      </View>
    </View>
  );
}

/** Facciata istituzionale 2×2 in pietra (Tribunale, Ufficio Immigrazione, …). */
function RpgFootprintEdificioPietra2x2({ width, height, emoji }: Props & { emoji: string }) {
  const roofH = Math.round(height * 0.44);
  const grondaH = 3;
  const wallH = height - roofH - grondaH;
  const bandH = Math.max(3, Math.floor(wallH * 0.1));
  const emojiSize = Math.max(14, Math.min(32, Math.floor(Math.min(width, height) * 0.22)));

  return (
    <View style={[styles.wrap, { width, height }]} pointerEvents="none">
      <RoofStripes
        roofH={roofH}
        stripeEvery={5}
        colors={{ base: "#475569", dark: "#334155", light: "#64748b" }}
      />
      <View style={[styles.gronda, { height: grondaH }]} />
      <View style={[styles.wallBlockFlex, { backgroundColor: "#e7e5e4" }]}>
        <View style={[styles.trimBand, { height: bandH, backgroundColor: "#1e293b" }]} />
        <View style={[styles.wallInnerFlex, { backgroundColor: "#d6d3d1", justifyContent: "center", alignItems: "center" }]}>
          <WallBrickTexture wallH={wallH - bandH * 2} />
          <Text style={{ fontSize: emojiSize, lineHeight: emojiSize + 2, textAlign: "center" }}>{emoji}</Text>
        </View>
        <View style={[styles.trimBand, { height: bandH, backgroundColor: "#0f172a" }]} />
      </View>
    </View>
  );
}

/** Tribunale 2×2 — facciata in pietra con emoji bilancia (stesso ingombro del dormitorio). */
export function RpgFootprintTribunale2x2(props: Props) {
  return <RpgFootprintEdificioPietra2x2 {...props} emoji="⚖️" />;
}

/** Ufficio Immigrazione 2×2 — stesso stile del Tribunale con emoji passaporto. */
export function RpgFootprintUfficioImmigrazione2x2(props: Props) {
  return <RpgFootprintEdificioPietra2x2 {...props} emoji="🛂" />;
}

/** Vetrata centrale larga (hangar / sala controllo). */
function HangarGlassPane() {
  return (
    <View style={styles.hangarOuter}>
      <View style={styles.hangarGlassL} />
      <View style={styles.hangarMullion} />
      <View style={styles.hangarGlassR} />
    </View>
  );
}

/**
 * Spazioporto 4×3 — stessa lettura degli altri edifici: tetto metallico → gronda → facciata a 4 campate → piazzale con razzo.
 */
export function RpgFootprintSpazioporto4x3({ width, height }: Props) {
  const roofH = Math.round(height * 0.4);
  const grondaH = 3;
  const lowerH = height - roofH - grondaH;
  const padH = Math.min(Math.max(12, Math.round(lowerH * 0.22)), Math.floor(lowerH * 0.35));
  const bandH = Math.max(3, Math.floor((lowerH - padH) * 0.11));
  const facadeInnerH = Math.max(12, lowerH - padH - bandH * 2);

  return (
    <View style={[styles.wrap, { width, height }]} pointerEvents="none">
      <View style={{ height: roofH, position: "relative" }}>
        <RoofStripes
          roofH={roofH}
          stripeEvery={5}
          colors={{ base: "#475569", dark: "#334155", light: "#64748b" }}
        />
        <View style={[styles.spRoofDecor, { height: Math.max(14, roofH * 0.38) }]}>
          <View style={styles.spDomeSmall} />
          <View style={styles.spDishSmall} />
        </View>
      </View>
      <View style={[styles.gronda, { height: grondaH }]} />
      <View style={styles.spLower}>
        <View style={[styles.trimBand, { height: bandH, backgroundColor: "#1e3a5f" }]} />
        <View style={[styles.spFacade, { backgroundColor: "#e2e8f0" }]}>
          <WallBrickTexture wallH={facadeInnerH} />
          <View style={styles.spFourCols}>
            <View style={styles.col}>
              <WindowPane small />
            </View>
            <View style={[styles.col, { flex: 1.2 }]}>
              <HangarGlassPane />
            </View>
            <View style={styles.col}>
              <WindowPane small />
            </View>
            <View style={styles.col}>
              <WindowPane small />
            </View>
          </View>
        </View>
        <View style={[styles.trimBand, { height: bandH, backgroundColor: "#1e293b" }]} />
        <View style={[styles.spLaunchPad, { height: padH }]}>
          <View style={styles.spGantry} />
          <View style={styles.spRocketMini} />
          <View style={styles.spGantry} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  capBase: {
    width: "100%",
    backgroundColor: "#44403c",
    padding: 3
  },
  capBaseInner: {
    flex: 1,
    flexDirection: "row",
    borderWidth: 2,
    borderColor: OUTLINE,
    backgroundColor: "#57534e",
    overflow: "hidden"
  },
  capBay: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 2,
    gap: 2
  },
  capMullion: {
    width: 2,
    alignSelf: "center",
    backgroundColor: OUTLINE
  },
  capLog: {
    width: "70%",
    height: 5,
    backgroundColor: "#5c4033",
    borderRadius: 1,
    borderWidth: 1,
    borderColor: "#292524"
  },
  capFire: {
    width: 8,
    height: 10,
    borderRadius: 4,
    backgroundColor: "#f97316",
    borderWidth: 1,
    borderColor: OUTLINE,
    opacity: 0.95
  },
  capBedroll: {
    width: "75%",
    height: 6,
    backgroundColor: "#78716c",
    borderRadius: 1,
    borderWidth: 1,
    borderColor: OUTLINE
  },
  serraRoofRib: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "rgba(12,12,12,0.35)"
  },
  serraRoofCap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 3,
    backgroundColor: "#e2e8f0",
    borderBottomWidth: 1,
    borderBottomColor: OUTLINE
  },
  serraBase: {
    width: "100%",
    backgroundColor: "#ecfdf5",
    padding: 3
  },
  serraBaseInner: {
    flex: 1,
    flexDirection: "row",
    borderWidth: 2,
    borderColor: OUTLINE,
    backgroundColor: "#d1fae5",
    overflow: "hidden"
  },
  serraBay: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 4,
    paddingBottom: 2
  },
  serraMullion: {
    width: 2,
    alignSelf: "center",
    backgroundColor: OUTLINE
  },
  serraPlant: {
    width: 5,
    height: Math.max(10, 14),
    borderRadius: 2,
    backgroundColor: "#15803d",
    borderWidth: 1,
    borderColor: "#14532d"
  },
  wrap: {
    borderRadius: 2,
    borderWidth: 2,
    borderColor: OUTLINE,
    overflow: "hidden",
    backgroundColor: "#1a1814"
  },
  spLower: {
    flex: 1,
    minHeight: 0,
    width: "100%"
  },
  spRoofDecor: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 6,
    pointerEvents: "none"
  },
  spDomeSmall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#94a3b8",
    borderWidth: 2,
    borderColor: OUTLINE
  },
  spDishSmall: {
    width: 26,
    height: 20,
    borderRadius: 13,
    backgroundColor: "#cbd5e1",
    borderWidth: 2,
    borderColor: OUTLINE,
    borderBottomWidth: 5,
    borderBottomColor: "#64748b"
  },
  spFacade: {
    flex: 1,
    minHeight: 0,
    position: "relative",
    paddingHorizontal: 3,
    paddingVertical: 2
  },
  spFourCols: {
    flex: 1,
    flexDirection: "row",
    gap: 3,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingBottom: 3,
    zIndex: 1
  },
  hangarOuter: {
    width: "94%",
    height: "58%",
    minHeight: 20,
    flexDirection: "row",
    borderWidth: 2,
    borderColor: OUTLINE,
    overflow: "hidden"
  },
  hangarGlassL: {
    flex: 1,
    backgroundColor: "#38bdf8"
  },
  hangarMullion: {
    width: 3,
    backgroundColor: OUTLINE
  },
  hangarGlassR: {
    flex: 1,
    backgroundColor: "#0ea5e9"
  },
  spLaunchPad: {
    position: "relative",
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingBottom: 2,
    backgroundColor: "#44403c",
    borderTopWidth: 1,
    borderTopColor: OUTLINE
  },
  spGantry: {
    width: 4,
    height: "75%",
    backgroundColor: "#b91c1c",
    borderWidth: 1,
    borderColor: OUTLINE
  },
  spRocketMini: {
    position: "absolute",
    left: "38%",
    right: "38%",
    bottom: 2,
    height: "88%",
    backgroundColor: "#f8fafc",
    borderWidth: 2,
    borderColor: OUTLINE,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6
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
});
