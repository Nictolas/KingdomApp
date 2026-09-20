import React, { useMemo, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import Svg, { Line } from "react-native-svg";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import {
  OBIETTIVI_CATALOGO,
  obiettiviSbloccati,
  type ObiettivoNodo
} from "../src/data/obiettiviCatalogo";

const NODE_W = 128;
const NODE_H = 100;
const H_GAP = 32;
const V_GAP = 64;
const PAD = 28;

const TIPO_COLOR: Record<string, string> = {
  Scoperta: "#a78bfa",
  Costruzione: "#60a5fa",
  Evento: "#f59e0b",
  Sociale: "#34d399"
};
const TIPO_BG: Record<string, string> = {
  Scoperta: "#16122a",
  Costruzione: "#0f1a2e",
  Evento: "#1a160e",
  Sociale: "#0e1f1a"
};

type Pos = { x: number; y: number; cx: number; cy: number };

function labelSbloccoTassa(nodo: ObiettivoNodo): string | null {
  if (nodo.sblocca?.tipo !== "tassa") return null;
  if (nodo.sblocca.id === "patrimonio") return "Tassa sul Patrimonio";
  if (nodo.sblocca.id === "reddito") return "Tassa sul Reddito";
  if (nodo.sblocca.id === "iva") return "Imposta sul Valore Aggiunto";
  return null;
}

function setPos(positions: Map<string, Pos>, id: string, x: number, y: number): void {
  positions.set(id, { x, y, cx: x + NODE_W / 2, cy: y + NODE_H / 2 });
}

/**
 * Layout ad albero: ogni riga centrata sul baricentro ideale dei genitori,
 * overlap risolti senza “spingere” tutto a sinistra.
 */
function computeLayout(catalog: ObiettivoNodo[]): {
  positions: Map<string, Pos>;
  width: number;
  height: number;
} {
  const byLivello = new Map<number, ObiettivoNodo[]>();
  for (const n of catalog) {
    if (!byLivello.has(n.livello)) byLivello.set(n.livello, []);
    byLivello.get(n.livello)!.push(n);
  }
  const livelli = [...byLivello.keys()].sort((a, b) => a - b);
  const positions = new Map<string, Pos>();

  for (const liv of livelli) {
    const nodi = byLivello.get(liv)!;
    const y = PAD + (liv - 1) * (NODE_H + V_GAP);

    const withIdeal = nodi.map((n) => {
      const parents = n.requisitiId
        .map((id) => positions.get(id))
        .filter((p): p is Pos => p != null);
      const idealCx =
        parents.length > 0
          ? parents.reduce((s, p) => s + p.cx, 0) / parents.length
          : 0;
      return { n, idealX: idealCx - NODE_W / 2, idealCx };
    });
    withIdeal.sort((a, b) => a.idealX - b.idealX || a.n.id.localeCompare(b.n.id));

    // Pack sequenziale partendo da 0, poi ricentra sul baricentro ideale.
    const xs: number[] = [];
    let cursor = 0;
    for (let i = 0; i < withIdeal.length; i++) {
      const ideal = withIdeal[i]!.idealX;
      const x = i === 0 ? ideal : Math.max(ideal, cursor);
      xs.push(x);
      cursor = x + NODE_W + H_GAP;
    }

    const idealMeanCx =
      withIdeal.reduce((s, w) => s + w.idealCx, 0) / Math.max(1, withIdeal.length);
    const placedMeanCx =
      xs.reduce((s, x) => s + x + NODE_W / 2, 0) / Math.max(1, xs.length);
    const shift = idealMeanCx - placedMeanCx;

    for (let i = 0; i < withIdeal.length; i++) {
      setPos(positions, withIdeal[i]!.n.id, xs[i]! + shift, y);
    }
  }

  // Normalizza: minX = PAD, così il bounding box parte da sinistra.
  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = 0;
  for (const p of positions.values()) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x + NODE_W);
    maxY = Math.max(maxY, p.y + NODE_H);
  }
  if (!Number.isFinite(minX)) {
    return { positions, width: PAD * 2, height: PAD * 2 };
  }
  const norm = PAD - minX;
  if (norm !== 0) {
    for (const [id, p] of positions) {
      setPos(positions, id, p.x + norm, p.y);
    }
    maxX += norm;
    minX += norm;
  }

  return {
    positions,
    width: maxX + PAD,
    height: maxY + PAD
  };
}

/** Connettore a angoli retti (↓ → ↓) tra due nodi. */
function OrthoEdge({
  edgeKey,
  from,
  to
}: {
  edgeKey: string;
  from: Pos;
  to: Pos;
}) {
  const y1 = from.y + NODE_H;
  const y2 = to.y;
  const midY = (y1 + y2) / 2;
  const stroke = "rgba(148,163,184,0.5)";
  const sw = 1.5;
  return (
    <>
      <Line key={`${edgeKey}-a`} x1={from.cx} y1={y1} x2={from.cx} y2={midY} stroke={stroke} strokeWidth={sw} />
      <Line key={`${edgeKey}-b`} x1={from.cx} y1={midY} x2={to.cx} y2={midY} stroke={stroke} strokeWidth={sw} />
      <Line key={`${edgeKey}-c`} x1={to.cx} y1={midY} x2={to.cx} y2={y2} stroke={stroke} strokeWidth={sw} />
    </>
  );
}

function NodoObiettivo({
  nodo,
  stato,
  onPress,
  style
}: {
  nodo: ObiettivoNodo;
  stato: "completato" | "sbloccato" | "bloccato";
  onPress: () => void;
  style?: object;
}) {
  const borderColor =
    stato === "completato"
      ? "#22c55e"
      : stato === "sbloccato"
        ? TIPO_COLOR[nodo.tipo] ?? "#94a3b8"
        : "rgba(100,116,139,0.35)";
  const bg =
    stato === "completato"
      ? "#0a2418"
      : stato === "sbloccato"
        ? TIPO_BG[nodo.tipo] ?? "#0f172a"
        : "#0b1220";
  const taxLabel = labelSbloccoTassa(nodo);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.nodo, { borderColor, backgroundColor: bg }, style]}
    >
      <Text style={[styles.nodoEmoji, stato === "bloccato" && { opacity: 0.55 }]}>
        {stato === "completato" ? "✅" : stato === "bloccato" ? "🔒" : nodo.emoji}
      </Text>
      <Text style={[styles.nodoTitolo, stato === "bloccato" && { color: "#64748b" }]} numberOfLines={2}>
        {nodo.titolo}
      </Text>
      <View style={[styles.tipoBadge, { borderColor }]}>
        <Text style={[styles.tipoTesto, { color: borderColor }]}>{nodo.tipo}</Text>
      </View>
      {taxLabel ? (
        <Text style={[styles.nodoTax, stato === "bloccato" && { opacity: 0.7 }]} numberOfLines={1}>
          📜 {taxLabel}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

function DettaglioModal({
  nodo,
  stato,
  onClose
}: {
  nodo: ObiettivoNodo | null;
  stato: "completato" | "sbloccato" | "bloccato";
  onClose: () => void;
}) {
  if (!nodo) return null;
  const taxLabel = labelSbloccoTassa(nodo);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <Text style={styles.modalEmoji}>{nodo.emoji}</Text>
          <Text style={styles.modalTitolo}>{nodo.titolo}</Text>
          <View
            style={[
              styles.tipoBadge,
              { borderColor: TIPO_COLOR[nodo.tipo], alignSelf: "center", marginBottom: 10 }
            ]}
          >
            <Text style={[styles.tipoTesto, { color: TIPO_COLOR[nodo.tipo] }]}>{nodo.tipo}</Text>
          </View>
          <Text style={styles.modalDesc}>{nodo.descrizione}</Text>
          {nodo.ricompensa ? (
            <View style={styles.ricompensaBox}>
              <Text style={styles.ricompensaLabel}>🎁 Ricompensa</Text>
              <Text style={styles.ricompensaTesto}>{nodo.ricompensa}</Text>
            </View>
          ) : null}
          {taxLabel ? (
            <View style={styles.tassaBox}>
              <Text style={styles.tassaLabel}>📜 Sblocca tassa</Text>
              <Text style={styles.tassaTesto}>{taxLabel}</Text>
            </View>
          ) : null}
          {stato === "bloccato" ? (
            <Text style={styles.bloccatoAvviso}>🔒 Completa i requisiti per sbloccare questo obiettivo.</Text>
          ) : stato === "completato" ? (
            <Text style={styles.completatoAvviso}>✅ Obiettivo completato!</Text>
          ) : null}
          <TouchableOpacity onPress={onClose} style={styles.chiudiBtn}>
            <Text style={styles.chiudiBtnTesto}>Chiudi</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function ObiettiviScreen() {
  const router = useRouter();
  const { width } = Dimensions.get("window");
  const maxHeight = width > 768 ? width * (9 / 16) : undefined;

  const { obiettiviCompletati, modalitaGioco } = useGameContext();
  const [dettaglio, setDettaglio] = useState<{
    nodo: ObiettivoNodo;
    stato: "completato" | "sbloccato" | "bloccato";
  } | null>(null);

  const completatiSet = useMemo(() => new Set(obiettiviCompletati), [obiettiviCompletati]);
  const sbloccatiSet = useMemo(() => obiettiviSbloccati(completatiSet), [completatiSet]);
  const layout = useMemo(() => computeLayout(OBIETTIVI_CATALOGO), []);

  /** Centra l'albero nell'area visibile. */
  const contentW = Math.max(layout.width, width);
  const offsetX = (contentW - layout.width) / 2;
  const positions = useMemo(() => {
    if (Math.abs(offsetX) < 0.5) return layout.positions;
    const shifted = new Map<string, Pos>();
    for (const [id, p] of layout.positions) {
      shifted.set(id, {
        x: p.x + offsetX,
        y: p.y,
        cx: p.cx + offsetX,
        cy: p.cy
      });
    }
    return shifted;
  }, [layout.positions, offsetX]);

  const canvasW = contentW;
  const canvasH = layout.height;

  const edges = useMemo(() => {
    const list: { from: Pos; to: Pos; key: string }[] = [];
    for (const nodo of OBIETTIVI_CATALOGO) {
      const child = positions.get(nodo.id);
      if (!child) continue;
      for (const reqId of nodo.requisitiId) {
        const parent = positions.get(reqId);
        if (!parent) continue;
        list.push({
          key: `${reqId}->${nodo.id}`,
          from: parent,
          to: child
        });
      }
    }
    return list;
  }, [positions]);

  const statoDi = (id: string): "completato" | "sbloccato" | "bloccato" => {
    if (completatiSet.has(id)) return "completato";
    if (sbloccatiSet.has(id)) return "sbloccato";
    return "bloccato";
  };

  const totale = OBIETTIVI_CATALOGO.length;
  const completati = completatiSet.size;

  return (
    <SafeAreaView style={[styles.safe, maxHeight != null ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Text style={styles.headerBtnTesto}>← Indietro</Text>
        </TouchableOpacity>
        <Text style={styles.title} pointerEvents="none">
          🎯 Obiettivi
        </Text>
        <View style={[styles.headerBtn, styles.headerBtnRight]}>
          <Text style={styles.modalitaChip}>
            {modalitaGioco === "creativa" ? "🎨 Creativa" : "⚔️ Avventura"}
          </Text>
        </View>
      </View>

      <View style={styles.progressRow}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(completati / totale) * 100}%` as any }]} />
        </View>
        <Text style={styles.progressTesto}>
          {completati}/{totale}
        </Text>
      </View>

      {modalitaGioco === "creativa" && (
        <View style={styles.creativaAvviso}>
          <Text style={styles.creativaAvvisoTesto}>
            🎨 Modalità Creativa: tutto disponibile. Gli obiettivi sono a scopo illustrativo.
          </Text>
        </View>
      )}

      <ScrollView
        horizontal
        style={styles.treeScroll}
        contentContainerStyle={{
          width: canvasW,
          minWidth: contentW,
          flexGrow: 1,
          justifyContent: "center"
        }}
        showsHorizontalScrollIndicator
      >
        <ScrollView
          nestedScrollEnabled
          contentContainerStyle={{
            width: canvasW,
            height: canvasH,
            minHeight: canvasH,
            alignItems: "center"
          }}
          showsVerticalScrollIndicator
        >
          <View style={{ width: canvasW, height: canvasH }}>
            <Svg
              width={canvasW}
              height={canvasH}
              style={[StyleSheet.absoluteFill, styles.treeEdges]}
              pointerEvents="none"
            >
              {edges.map(({ key, from, to }) => (
                <OrthoEdge key={key} edgeKey={key} from={from} to={to} />
              ))}
            </Svg>
            {OBIETTIVI_CATALOGO.map((nodo) => {
              const pos = positions.get(nodo.id);
              if (!pos) return null;
              const stato = modalitaGioco === "creativa" ? "sbloccato" : statoDi(nodo.id);
              return (
                <NodoObiettivo
                  key={nodo.id}
                  nodo={nodo}
                  stato={stato}
                  onPress={() => setDettaglio({ nodo, stato })}
                  style={{
                    position: "absolute",
                    left: pos.x,
                    top: pos.y,
                    width: NODE_W,
                    zIndex: 1,
                    elevation: 2
                  }}
                />
              );
            })}
          </View>
        </ScrollView>
      </ScrollView>

      <DettaglioModal
        nodo={dettaglio?.nodo ?? null}
        stato={dettaglio?.stato ?? "bloccato"}
        onClose={() => setDettaglio(null)}
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
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.6)",
    position: "relative"
  },
  headerBtn: { minWidth: 88, zIndex: 1 },
  headerBtnRight: { alignItems: "flex-end" },
  headerBtnTesto: { color: "#93c5fd", fontSize: 12 },
  title: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700"
  },
  modalitaChip: { color: "#f59e0b", fontSize: 12, fontWeight: "600", textAlign: "right" },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 8
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: "rgba(148,163,184,0.2)",
    borderRadius: 3,
    overflow: "hidden"
  },
  progressFill: { height: "100%", backgroundColor: "#22c55e", borderRadius: 3 },
  progressTesto: { color: "#94a3b8", fontSize: 11 },
  creativaAvviso: {
    marginHorizontal: 12,
    marginBottom: 4,
    backgroundColor: "rgba(245,158,11,0.1)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.3)"
  },
  creativaAvvisoTesto: { color: "#f59e0b", fontSize: 11 },
  treeScroll: { flex: 1 },
  treeEdges: { zIndex: 0 },
  nodo: {
    borderRadius: 10,
    borderWidth: 1.5,
    padding: 8,
    alignItems: "center",
    gap: 4,
    height: NODE_H,
    overflow: "hidden"
  },
  nodoEmoji: { fontSize: 20 },
  nodoTitolo: { color: "#e5e7eb", fontSize: 11, fontWeight: "600", textAlign: "center" },
  nodoTax: { color: "#fbbf24", fontSize: 8, fontWeight: "700", textAlign: "center", marginTop: 2 },
  tipoBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2
  },
  tipoTesto: { fontSize: 9, fontWeight: "700" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  modalCard: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 440,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)"
  },
  modalEmoji: { fontSize: 36, textAlign: "center", marginBottom: 8 },
  modalTitolo: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6
  },
  modalDesc: {
    color: "rgba(203,213,245,0.8)",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginBottom: 12
  },
  ricompensaBox: {
    backgroundColor: "rgba(245,158,11,0.1)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.3)",
    marginBottom: 12
  },
  ricompensaLabel: { color: "#f59e0b", fontSize: 11, fontWeight: "700", marginBottom: 4 },
  ricompensaTesto: { color: "#fde68a", fontSize: 12, lineHeight: 17 },
  tassaBox: {
    backgroundColor: "rgba(96,165,250,0.12)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.4)",
    marginBottom: 12
  },
  tassaLabel: { color: "#93c5fd", fontSize: 11, fontWeight: "700", marginBottom: 4 },
  tassaTesto: { color: "#bfdbfe", fontSize: 13, fontWeight: "600" },
  bloccatoAvviso: { color: "#64748b", fontSize: 12, textAlign: "center", marginBottom: 12 },
  completatoAvviso: { color: "#22c55e", fontSize: 12, textAlign: "center", marginBottom: 12 },
  chiudiBtn: {
    backgroundColor: "rgba(148,163,184,0.15)",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 4
  },
  chiudiBtnTesto: { color: "#94a3b8", fontSize: 13, fontWeight: "600" }
});
