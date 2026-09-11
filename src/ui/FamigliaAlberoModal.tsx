import React, { useMemo, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import Svg, { Line } from "react-native-svg";
import type { Abitante } from "../types";
import { useGameContext } from "../context/GameContext";
import {
  buildAlberoDiscendente,
  candidatiAdozione,
  getFigliAdottatiIds,
  getFigliBiologiciIds,
  type NodoAlberoFamiglia
} from "../game/famiglia";
import {
  abitanteDaGenitoreDeceduto,
  èIdGenitoreDecedutoRe,
  èRe,
  getGenitoriDecedutiRe,
  getZioZiaDecedutoCuginoRe,
  latoCuginoDaGenitoriIds,
  risolviParenteDecedutoRe
} from "../game/reGenitoriDeceduti";
import { trovaCuginoNobileDelRe } from "../game/cuginoNobileAvventura";
import { AbitanteAvatarPreview } from "./AbitanteAvatarPreview";
import {
  DESKTOP_MODAL_BREAKPOINT,
  modalBackdropFullscreen,
  modalContentFullscreen
} from "./modalFullscreenStyles";

type FiltroAlbero = "persona" | "regno";

type Props = {
  visible: boolean;
  onClose: () => void;
  focusId: number | null;
  abitanti: readonly Abitante[];
  onSelezionaAbitante?: (id: number) => void;
};

type NodoGrafo = {
  id: string;
  abitanteId: number;
  nome: string;
  eta: number;
  sesso?: "M" | "F";
  livello: number;
  deceduto?: boolean;
  focus?: boolean;
  adottato?: boolean;
  /** Card azione “+ Adotta” (solo Re). */
  azioneAdotta?: boolean;
  abitante: Abitante;
};

type Pos = { x: number; y: number; cx: number; cy: number };

const NODE_W = 112;
const NODE_H = 118;
const H_GAP = 28;
const V_GAP = 56;
const PAD = 24;

function setPos(positions: Map<string, Pos>, id: string, x: number, y: number): void {
  positions.set(id, { x, y, cx: x + NODE_W / 2, cy: y + NODE_H / 2 });
}

function computeLayout(nodi: NodoGrafo[]): {
  positions: Map<string, Pos>;
  width: number;
  height: number;
} {
  const byLivello = new Map<number, NodoGrafo[]>();
  for (const n of nodi) {
    if (!byLivello.has(n.livello)) byLivello.set(n.livello, []);
    byLivello.get(n.livello)!.push(n);
  }
  const livelli = [...byLivello.keys()].sort((a, b) => a - b);
  const positions = new Map<string, Pos>();

  for (const liv of livelli) {
    const row = byLivello.get(liv)!;
    const count = row.length;
    const rowWidth = count * NODE_W + Math.max(0, count - 1) * H_GAP;
    const startX = -rowWidth / 2;
    const y = PAD + liv * (NODE_H + V_GAP);
    for (let i = 0; i < count; i++) {
      setPos(positions, row[i]!.id, startX + i * (NODE_W + H_GAP), y);
    }
  }

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
  for (const [id, p] of positions) {
    setPos(positions, id, p.x + norm, p.y);
  }
  return {
    positions,
    width: maxX - minX + PAD * 2,
    height: maxY + PAD
  };
}

function OrthoEdge({
  edgeKey,
  from,
  to,
  sameRow
}: {
  edgeKey: string;
  from: Pos;
  to: Pos;
  sameRow?: boolean;
}) {
  const stroke = "rgba(148,163,184,0.5)";
  const sw = 1.5;
  if (sameRow) {
    const left = from.x <= to.x ? from : to;
    const right = from.x <= to.x ? to : from;
    return (
      <Line
        key={edgeKey}
        x1={left.x + NODE_W}
        y1={left.cy}
        x2={right.x}
        y2={right.cy}
        stroke={stroke}
        strokeWidth={sw}
      />
    );
  }
  const y1 = from.y + NODE_H;
  const y2 = to.y;
  const midY = (y1 + y2) / 2;
  return (
    <>
      <Line key={`${edgeKey}-a`} x1={from.cx} y1={y1} x2={from.cx} y2={midY} stroke={stroke} strokeWidth={sw} />
      <Line key={`${edgeKey}-b`} x1={from.cx} y1={midY} x2={to.cx} y2={midY} stroke={stroke} strokeWidth={sw} />
      <Line key={`${edgeKey}-c`} x1={to.cx} y1={midY} x2={to.cx} y2={y2} stroke={stroke} strokeWidth={sw} />
    </>
  );
}

function flattenDiscendenti(
  root: NodoAlberoFamiglia,
  map: Map<number, Abitante>,
  livello0: number
): NodoGrafo[] {
  const out: NodoGrafo[] = [];
  const walk = (n: NodoAlberoFamiglia, livello: number) => {
    const a = map.get(n.id);
    if (!a) return;
    out.push({
      id: `d-${n.id}`,
      abitanteId: n.id,
      nome: n.nome,
      eta: n.eta,
      sesso: n.sesso,
      livello,
      adottato: n.adottato,
      focus: livello === livello0,
      abitante: a
    });
    for (const f of n.figli) walk(f, livello + 1);
  };
  walk(root, livello0);
  return out;
}

function NodoCarta({
  nodo,
  onPress
}: {
  nodo: NodoGrafo;
  onPress?: () => void;
}) {
  if (nodo.azioneAdotta) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.nodoCard, styles.nodoCardAdotta, pressed && styles.nodoPressed]}
        accessibilityLabel="Adotta un abitante"
      >
        <Text style={styles.adottaPlus}>+</Text>
        <Text style={styles.adottaLabel}>Adotta</Text>
      </Pressable>
    );
  }

  const sesso = nodo.sesso === "F" ? "♀" : nodo.sesso === "M" ? "♂" : "·";
  const body = (
    <View
      style={[
        styles.nodoCard,
        nodo.focus && styles.nodoCardFocus,
        nodo.deceduto && styles.nodoCardDeceduto
      ]}
    >
      <AbitanteAvatarPreview abitante={nodo.abitante} size={44} grayscale={!!nodo.deceduto} />
      <Text style={[styles.nodoNome, nodo.deceduto && styles.nodoNomeDeceduto]} numberOfLines={2}>
        {sesso} {nodo.nome}
      </Text>
      <Text style={styles.nodoMeta}>
        {nodo.deceduto ? "† deceduto" : `${nodo.eta}a`}
        {nodo.adottato ? " · adott." : ""}
      </Text>
    </View>
  );
  if (!onPress || nodo.deceduto) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.nodoPressed}>
      {body}
    </Pressable>
  );
}

export function FamigliaAlberoModal({
  visible,
  onClose,
  focusId,
  abitanti,
  onSelezionaAbitante
}: Props) {
  const { adottaFiglio } = useGameContext();
  const [filtro, setFiltro] = useState<FiltroAlbero>("persona");
  const [mostraAdotta, setMostraAdotta] = useState(false);

  const focus = focusId != null ? abitanti.find((a) => a.id === focusId) : null;
  const byId = useMemo(() => {
    const m = new Map<number, Abitante>();
    for (const a of abitanti) m.set(a.id, a);
    return m;
  }, [abitanti]);

  const listaCandidatiAdotta = useMemo(() => {
    if (!focus || !èRe(focus)) return [];
    return candidatiAdozione(focus.id, abitanti);
  }, [focus, abitanti]);

  const grafoPersona = useMemo(() => {
    if (focusId == null || !focus) return { nodi: [] as NodoGrafo[], edges: [] as { from: string; to: string }[] };

    const nodi: NodoGrafo[] = [];
    const edges: { from: string; to: string }[] = [];

    const cuginoRe = èRe(focus) ? trovaCuginoNobileDelRe(abitanti) : undefined;
    const latoCugino = cuginoRe ? latoCuginoDaGenitoriIds(cuginoRe.genitoriIds) : null;
    const zioZia =
      èRe(focus) && latoCugino ? getZioZiaDecedutoCuginoRe(focus, latoCugino) : null;

    // Livello 0: genitori (+ zio/zia del cugino nobile in Avventura)
    const pushGenitoreDeceduto = (g: ReturnType<typeof getGenitoriDecedutiRe>[0]) => {
      nodi.push({
        id: `p-${g.id}`,
        abitanteId: g.id,
        nome: g.nome,
        eta: g.eta,
        sesso: g.sesso,
        livello: 0,
        deceduto: true,
        abitante: abitanteDaGenitoreDeceduto(g)
      });
    };

    if (èRe(focus) && (focus.genitoriIds?.length ?? 0) === 0) {
      const [padre, madre] = getGenitoriDecedutiRe(focus);
      if (zioZia && latoCugino === "paterno") {
        pushGenitoreDeceduto(zioZia);
        pushGenitoreDeceduto(padre);
        pushGenitoreDeceduto(madre);
        edges.push({ from: `p-${zioZia.id}`, to: `p-${padre.id}` });
      } else if (zioZia && latoCugino === "materno") {
        pushGenitoreDeceduto(padre);
        pushGenitoreDeceduto(madre);
        pushGenitoreDeceduto(zioZia);
        edges.push({ from: `p-${madre.id}`, to: `p-${zioZia.id}` });
      } else {
        pushGenitoreDeceduto(padre);
        pushGenitoreDeceduto(madre);
      }
    } else {
      const re = abitanti.find((a) => èRe(a));
      for (const gid of focus.genitoriIds ?? []) {
        const g = byId.get(gid);
        if (g) {
          nodi.push({
            id: `p-${gid}`,
            abitanteId: gid,
            nome: g.nome,
            eta: g.eta,
            sesso: g.sesso,
            livello: 0,
            abitante: g
          });
          continue;
        }
        if (re) {
          const dec = risolviParenteDecedutoRe(gid, re);
          if (dec) {
            nodi.push({
              id: `p-${dec.id}`,
              abitanteId: dec.id,
              nome: dec.nome,
              eta: dec.eta,
              sesso: dec.sesso,
              livello: 0,
              deceduto: true,
              abitante: abitanteDaGenitoreDeceduto(dec)
            });
          }
        }
      }
    }

    // Livello 1: focus (+ coniuge) e, per il Re, cugino nobile
    const pushFocusRow = () => {
      nodi.push({
        id: `f-${focus.id}`,
        abitanteId: focus.id,
        nome: focus.nome,
        eta: focus.eta,
        sesso: focus.sesso,
        livello: 1,
        focus: true,
        abitante: focus
      });
      if (focus.coniugeId != null) {
        const c = byId.get(focus.coniugeId);
        if (c) {
          nodi.push({
            id: `c-${c.id}`,
            abitanteId: c.id,
            nome: c.nome,
            eta: c.eta,
            sesso: c.sesso,
            livello: 1,
            abitante: c
          });
          edges.push({ from: `f-${focus.id}`, to: `c-${c.id}` });
        }
      }
    };

    if (cuginoRe && zioZia && latoCugino === "paterno") {
      nodi.push({
        id: `cousin-${cuginoRe.id}`,
        abitanteId: cuginoRe.id,
        nome: cuginoRe.nome,
        eta: cuginoRe.eta,
        sesso: cuginoRe.sesso,
        livello: 1,
        abitante: cuginoRe
      });
      edges.push({ from: `p-${zioZia.id}`, to: `cousin-${cuginoRe.id}` });
      pushFocusRow();
    } else {
      pushFocusRow();
      if (cuginoRe && zioZia && latoCugino === "materno") {
        nodi.push({
          id: `cousin-${cuginoRe.id}`,
          abitanteId: cuginoRe.id,
          nome: cuginoRe.nome,
          eta: cuginoRe.eta,
          sesso: cuginoRe.sesso,
          livello: 1,
          abitante: cuginoRe
        });
        edges.push({ from: `p-${zioZia.id}`, to: `cousin-${cuginoRe.id}` });
      }
    }

    for (const p of nodi.filter((n) => n.livello === 0)) {
      // Solo i genitori del focus → focus (non zio/zia → Re)
      if (zioZia && p.abitanteId === zioZia.id) continue;
      edges.push({ from: p.id, to: `f-${focus.id}` });
    }

    // Livello 2+: figli
    const childIds = [
      ...getFigliBiologiciIds(focus),
      ...getFigliAdottatiIds(focus)
    ];
    const adottati = new Set(getFigliAdottatiIds(focus));
    for (const cid of [...new Set(childIds)]) {
      const child = byId.get(cid);
      if (!child) continue;
      const id = `k-${cid}`;
      nodi.push({
        id,
        abitanteId: cid,
        nome: child.nome,
        eta: child.eta,
        sesso: child.sesso,
        livello: 2,
        adottato: adottati.has(cid),
        abitante: child
      });
      edges.push({ from: `f-${focus.id}`, to: id });
      const sub = buildAlberoDiscendente(cid, abitanti, 2);
      if (sub) {
        for (const nipote of sub.figli) {
          const na = byId.get(nipote.id);
          if (!na) continue;
          const nid = `n-${nipote.id}`;
          nodi.push({
            id: nid,
            abitanteId: nipote.id,
            nome: nipote.nome,
            eta: nipote.eta,
            sesso: nipote.sesso,
            livello: 3,
            adottato: nipote.adottato,
            abitante: na
          });
          edges.push({ from: id, to: nid });
        }
      }
    }

    // Card “+ Adotta” sotto il Re
    if (èRe(focus)) {
      nodi.push({
        id: "azione-adotta",
        abitanteId: -9999,
        nome: "Adotta",
        eta: 0,
        livello: 2,
        azioneAdotta: true,
        abitante: focus
      });
      edges.push({ from: `f-${focus.id}`, to: "azione-adotta" });
    }

    return { nodi, edges };
  }, [focusId, focus, byId, abitanti]);

  const grafiRegno = useMemo(() => {
    if (filtro !== "regno") return [] as { nodi: NodoGrafo[]; edges: { from: string; to: string }[] }[];
    const radici = abitanti
      .filter((a) => a.razza !== "Golem")
      .filter((a) => (a.genitoriIds?.length ?? 0) === 0)
      .filter((a) => (a.figliIds?.length ?? 0) > 0 || (a.figliAdottatiIds?.length ?? 0) > 0)
      .slice(0, 12);

    return radici.map((r) => {
      const tree = buildAlberoDiscendente(r.id, abitanti, 4);
      if (!tree) return { nodi: [], edges: [] };
      const nodi = flattenDiscendenti(tree, byId, 0);
      const edges: { from: string; to: string }[] = [];
      const walk = (n: NodoAlberoFamiglia) => {
        for (const f of n.figli) {
          edges.push({ from: `d-${n.id}`, to: `d-${f.id}` });
          walk(f);
        }
      };
      walk(tree);
      return { nodi, edges };
    });
  }, [filtro, abitanti, byId]);

  const layoutPersona = useMemo(() => computeLayout(grafoPersona.nodi), [grafoPersona.nodi]);

  const { width } = Dimensions.get("window");
  const isDesktop = width > DESKTOP_MODAL_BREAKPOINT;
  /** Larghezza utile del contenuto modale (per centrare l’albero). */
  const treeViewportW = Math.min(width - 48, isDesktop ? 688 : width - 48);

  const renderGrafo = (
    nodi: NodoGrafo[],
    edges: { from: string; to: string }[],
    layout: ReturnType<typeof computeLayout>
  ) => {
    if (nodi.length === 0) {
      return <Text style={styles.empty}>Nessun dato genealogico.</Text>;
    }
    const edgeLines = edges
      .map((e) => {
        const from = layout.positions.get(e.from);
        const to = layout.positions.get(e.to);
        if (!from || !to) return null;
        return { key: `${e.from}->${e.to}`, from, to };
      })
      .filter((x): x is { key: string; from: Pos; to: Pos } => x != null);

    const canvasW = Math.max(layout.width, treeViewportW);

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        nestedScrollEnabled
        contentContainerStyle={{
          minWidth: "100%",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <ScrollView
          nestedScrollEnabled
          style={{ maxHeight: isDesktop ? 420 : 360 }}
          contentContainerStyle={{
            width: canvasW,
            height: layout.height,
            alignItems: "center"
          }}
        >
          <View style={{ width: canvasW, height: layout.height, alignItems: "center" }}>
            <View style={{ width: layout.width, height: layout.height }}>
              <Svg
                width={layout.width}
                height={layout.height}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              >
                {edgeLines.map(({ key, from, to }) => (
                  <OrthoEdge
                    key={key}
                    edgeKey={key}
                    from={from}
                    to={to}
                    sameRow={Math.abs(from.y - to.y) < 4}
                  />
                ))}
              </Svg>
              {nodi.map((n) => {
                const pos = layout.positions.get(n.id);
                if (!pos) return null;
                return (
                  <View
                    key={n.id}
                    style={{ position: "absolute", left: pos.x, top: pos.y, width: NODE_W }}
                  >
                    <NodoCarta
                      nodo={n}
                      onPress={
                        n.azioneAdotta
                          ? () => setMostraAdotta(true)
                          : onSelezionaAbitante && !èIdGenitoreDecedutoRe(n.abitanteId)
                            ? () => onSelezionaAbitante(n.abitanteId)
                            : undefined
                      }
                    />
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </ScrollView>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, isDesktop && modalBackdropFullscreen]} onPress={onClose}>
        <Pressable
          style={[styles.card, isDesktop && modalContentFullscreen]}
          onPress={() => undefined}
        >
          <Text style={styles.title}>🌳 Albero genealogico</Text>
          <Text style={styles.subtitle}>
            {filtro === "persona"
              ? focus
                ? `Famiglia di ${focus.nome}`
                : "Nessuna persona"
              : "Lignaggi del regno"}
          </Text>

          <View style={styles.filtri}>
            <Pressable
              style={[styles.filtroBtn, filtro === "persona" && styles.filtroBtnOn]}
              onPress={() => setFiltro("persona")}
            >
              <Text style={[styles.filtroText, filtro === "persona" && styles.filtroTextOn]}>
                Questa persona
              </Text>
            </Pressable>
            <Pressable
              style={[styles.filtroBtn, filtro === "regno" && styles.filtroBtnOn]}
              onPress={() => setFiltro("regno")}
            >
              <Text style={[styles.filtroText, filtro === "regno" && styles.filtroTextOn]}>
                Tutto il regno
              </Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {filtro === "persona" ? (
              renderGrafo(grafoPersona.nodi, grafoPersona.edges, layoutPersona)
            ) : grafiRegno.length === 0 ? (
              <Text style={styles.empty}>Nessun lignaggio con parentela registrata.</Text>
            ) : (
              grafiRegno.map((g, i) => {
                const layout = computeLayout(g.nodi);
                return (
                  <View key={`regno-${i}`} style={styles.regnoBlock}>
                    {renderGrafo(g.nodi, g.edges, layout)}
                  </View>
                );
              })
            )}
          </ScrollView>

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Chiudi</Text>
          </Pressable>
        </Pressable>
      </Pressable>

      <Modal
        visible={mostraAdotta}
        transparent
        animationType="fade"
        onRequestClose={() => setMostraAdotta(false)}
      >
        <Pressable
          style={[styles.backdrop, isDesktop && modalBackdropFullscreen]}
          onPress={() => setMostraAdotta(false)}
        >
          <Pressable
            style={[styles.adottaModalCard, isDesktop && modalContentFullscreen]}
            onPress={() => undefined}
          >
            <Text style={styles.title}>Adotta</Text>
            <Text style={styles.subtitle}>
              Abitanti senza genitori vivi ({listaCandidatiAdotta.length})
            </Text>
            <ScrollView style={styles.adottaList} contentContainerStyle={styles.adottaListContent}>
              {listaCandidatiAdotta.length === 0 ? (
                <Text style={styles.empty}>Nessun abitante adottabile al momento.</Text>
              ) : (
                listaCandidatiAdotta.map((a) => (
                  <Pressable
                    key={a.id}
                    style={({ pressed }) => [styles.adottaRow, pressed && styles.adottaRowPressed]}
                    onPress={() => {
                      if (!focus) return;
                      if (adottaFiglio(focus.id, a.id)) {
                        setMostraAdotta(false);
                      }
                    }}
                  >
                    <AbitanteAvatarPreview abitante={a} size={36} />
                    <View style={styles.adottaRowInfo}>
                      <Text style={styles.adottaRowNome}>{a.nome}</Text>
                      <Text style={styles.adottaRowMeta}>
                        {a.sesso === "F" ? "♀" : "♂"} · {a.eta}a · {a.lavoro}
                      </Text>
                    </View>
                    <Text style={styles.adottaRowBtn}>Adotta</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
            <Pressable style={styles.closeBtn} onPress={() => setMostraAdotta(false)}>
              <Text style={styles.closeBtnText}>Annulla</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.72)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16
  },
  card: {
    width: "100%",
    maxWidth: 720,
    maxHeight: "90%",
    backgroundColor: "#0f172a",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    padding: 16
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f8fafc",
    textAlign: "center"
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 10
  },
  filtri: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10
  },
  filtroBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(30,41,59,0.8)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.15)",
    alignItems: "center"
  },
  filtroBtnOn: {
    backgroundColor: "rgba(59,130,246,0.25)",
    borderColor: "rgba(59,130,246,0.45)"
  },
  filtroText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8"
  },
  filtroTextOn: {
    color: "#e2e8f0"
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1
  },
  scrollContent: {
    paddingBottom: 8
  },
  regnoBlock: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.2)"
  },
  nodoCard: {
    width: NODE_W,
    minHeight: NODE_H,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: "rgba(15,23,42,0.95)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)"
  },
  nodoCardFocus: {
    borderColor: "rgba(56,189,248,0.7)",
    backgroundColor: "rgba(14,165,233,0.12)"
  },
  nodoCardDeceduto: {
    borderColor: "rgba(100,116,139,0.55)",
    backgroundColor: "rgba(30,41,59,0.75)"
  },
  nodoCardAdotta: {
    borderColor: "rgba(34,197,94,0.55)",
    backgroundColor: "rgba(34,197,94,0.1)",
    borderStyle: "dashed",
    justifyContent: "center",
    gap: 4
  },
  adottaPlus: {
    fontSize: 28,
    fontWeight: "700",
    color: "#86efac",
    lineHeight: 32
  },
  adottaLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#86efac",
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  adottaModalCard: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "80%",
    backgroundColor: "#0f172a",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    padding: 16
  },
  adottaList: {
    flexGrow: 0,
    flexShrink: 1,
    maxHeight: 360
  },
  adottaListContent: {
    gap: 6,
    paddingBottom: 8
  },
  adottaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "rgba(30,41,59,0.85)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)"
  },
  adottaRowPressed: {
    backgroundColor: "rgba(34,197,94,0.18)",
    borderColor: "rgba(34,197,94,0.4)"
  },
  adottaRowInfo: {
    flex: 1,
    minWidth: 0
  },
  adottaRowNome: {
    fontSize: 13,
    fontWeight: "700",
    color: "#e2e8f0"
  },
  adottaRowMeta: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2
  },
  adottaRowBtn: {
    fontSize: 11,
    fontWeight: "700",
    color: "#86efac"
  },
  nodoPressed: {
    opacity: 0.85
  },
  nodoNome: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "700",
    color: "#e2e8f0",
    textAlign: "center",
    lineHeight: 14
  },
  nodoNomeDeceduto: {
    color: "#94a3b8"
  },
  nodoMeta: {
    marginTop: 2,
    fontSize: 9,
    color: "#64748b",
    textAlign: "center"
  },
  empty: {
    fontSize: 12,
    color: "#64748b",
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 20
  },
  closeBtn: {
    marginTop: 12,
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: "rgba(59,130,246,0.9)"
  },
  closeBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14
  }
});
