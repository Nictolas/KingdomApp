import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { G, Path } from "react-native-svg";
import type { Casta } from "../types";
import { formattaConteggioPercentuale } from "../utils/formatPercentuale";

export type CastaPieSlice = {
  nome: Casta;
  emoji: string;
  count: number;
  color: string;
};

const CASTA_COLORI: Record<Casta, string> = {
  Schiavo: "#ef4444",
  "Servo della gleba": "#22c55e",
  Cittadino: "#3b82f6",
  Nobile: "#eab308"
};

export function coloriCasta(nome: Casta): string {
  return CASTA_COLORI[nome];
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeSlice(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  if (endAngle - startAngle >= 359.99) {
    return `M ${cx} ${cy} m -${r}, 0 a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 -${r * 2},0`;
  }
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

type CastaPieChartProps = {
  slices: CastaPieSlice[];
  size?: number;
  onCastaPress?: (casta: Casta) => void;
};

export function CastaPieChart({ slices, size = 180, onCastaPress }: CastaPieChartProps) {
  const totale = slices.reduce((s, x) => s + x.count, 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;

  let angolo = 0;
  const segmenti = slices
    .filter((s) => s.count > 0)
    .map((s) => {
      const sweep = totale > 0 ? (s.count / totale) * 360 : 0;
      const start = angolo;
      angolo += sweep;
      return { ...s, start, end: angolo, path: describeSlice(cx, cy, r, start, angolo) };
    });

  return (
    <View style={styles.wrap}>
      <View style={styles.chartRow}>
        <View style={[styles.chartBox, { width: size, height: size }]}>
          {totale === 0 ? (
            <View style={[styles.vuoto, { width: size, height: size, borderRadius: size / 2 }]}>
              <Text style={styles.vuotoText}>—</Text>
            </View>
          ) : (
            <Svg width={size} height={size}>
              <G>
                {segmenti.map((seg) => (
                  <Path key={seg.nome} d={seg.path} fill={seg.color} stroke="#0f172a" strokeWidth={1.5} />
                ))}
              </G>
            </Svg>
          )}
        </View>

        <View style={styles.legenda}>
          {slices.map((s) => {
            const meta = formattaConteggioPercentuale(s.count, totale);
            const row = (
              <>
                <View style={[styles.legendaDot, { backgroundColor: s.color }]} />
                <Text style={styles.legendaEmoji}>{s.emoji}</Text>
                <View style={styles.legendaTesto}>
                  <Text style={styles.legendaNome} numberOfLines={1}>
                    {s.nome}
                  </Text>
                  <Text style={styles.legendaMeta}>{meta}</Text>
                </View>
              </>
            );
            return onCastaPress ? (
              <Pressable
                key={s.nome}
                style={({ pressed }) => [styles.legendaRow, pressed && styles.legendaRowPressed]}
                onPress={() => onCastaPress(s.nome)}
                accessibilityRole="button"
                accessibilityLabel={`Apri elenco casta ${s.nome}`}
              >
                {row}
              </Pressable>
            ) : (
              <View key={s.nome} style={styles.legendaRow}>
                {row}
              </View>
            );
          })}
        </View>
      </View>
      <Text style={styles.totaleLabel}>
        Totale abitanti: <Text style={styles.totaleVal}>{totale}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    marginBottom: 12
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  chartBox: {
    alignItems: "center",
    justifyContent: "center"
  },
  vuoto: {
    backgroundColor: "rgba(30,41,59,0.8)",
    borderWidth: 2,
    borderColor: "rgba(148,163,184,0.3)",
    alignItems: "center",
    justifyContent: "center"
  },
  vuotoText: {
    color: "rgba(148,163,184,0.6)",
    fontSize: 24
  },
  legenda: {
    flex: 1,
    gap: 6,
    minWidth: 0
  },
  legendaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 2
  },
  legendaRowPressed: {
    backgroundColor: "rgba(59,130,246,0.15)"
  },
  legendaDot: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  legendaEmoji: {
    fontSize: 14,
    width: 20,
    textAlign: "center"
  },
  legendaTesto: {
    flex: 1,
    minWidth: 0
  },
  legendaNome: {
    color: "#e2e8f0",
    fontSize: 10,
    fontWeight: "600"
  },
  legendaMeta: {
    color: "rgba(148,163,184,0.85)",
    fontSize: 9
  },
  totaleLabel: {
    marginTop: 10,
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    textAlign: "center"
  },
  totaleVal: {
    color: "#f8fafc",
    fontWeight: "700"
  }
});
