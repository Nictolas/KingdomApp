import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

type StatoRiga = "Attivo" | "Proposto";

type RigaPunti = {
  situazione: string;
  delta: string;
  durata: string;
  condizioni: string;
  stato: StatoRiga;
};

/** Tabella punti soddisfazione personale (derivata dal codice + proposte concordate). */
const RIGHE_PUNTI: RigaPunti[] = [
  {
    situazione: "Casa adeguata (Nobile)",
    delta: "+1",
    durata: "Situazionale",
    condizioni: "Solo se abita in Attico o Villa. Altrimenti 0 anche con altra casa.",
    stato: "Attivo"
  },
  {
    situazione: "Casa / residenza (non Nobile)",
    delta: "+1",
    durata: "Situazionale",
    condizioni:
      "Qualsiasi residenza valida (Baracca, Capanna, Dormitorio, Modulo, Villetta, Attico, Villa, Castello, o tipo Residenza). Senzatetto: 0.",
    stato: "Attivo"
  },
  {
    situazione: "Pasto del giorno — generico",
    delta: "+1",
    durata: "Giornaliero",
    condizioni: "Ha mangiato oggi. Non Nobile, non Vegano. Scade il giorno dopo.",
    stato: "Attivo"
  },
  {
    situazione: "Pasto del giorno — Nobile",
    delta: "+1",
    durata: "Giornaliero",
    condizioni: "Solo se il cibo ha tag carne. Altrimenti niente bonus (e rimuove eventuale pasto precedente).",
    stato: "Attivo"
  },
  {
    situazione: "Pasto del giorno — Vegano",
    delta: "+1",
    durata: "Giornaliero",
    condizioni:
      "Alimentazione Vegano o personalità Vegano: solo cibo vegetale puro (senza tag animali). Altrimenti 0.",
    stato: "Attivo"
  },
  {
    situazione: "Prelievo forzoso",
    delta: "−3",
    durata: "Mensile",
    condizioni: "Chi paga monete al Tesoro. Esclusi Re, Golem, casti senza inventario. Scade il mese successivo.",
    stato: "Attivo"
  },
  {
    situazione: "Lutto familiare",
    delta: "−1 (× n)",
    durata: "Permanente",
    condizioni:
      "Per ogni familiare diretto morto (coniuge, genitori, figli, fratelli). Si accumula sullo stesso id. Poi la vittima viene rimossa.",
    stato: "Attivo"
  },
  {
    situazione: "Vive con il coniuge",
    delta: "+1",
    durata: "Situazionale",
    condizioni: "Stessa abitazione del coniuge (coniugeId). Indipendente dagli altri bonus famiglia.",
    stato: "Proposto"
  },
  {
    situazione: "Vive con figlio non adulto",
    delta: "+1",
    durata: "Situazionale",
    condizioni: "Almeno un figlio in stessi locali con età < 18 (bambino/adolescente). Max +1, non per figlio.",
    stato: "Proposto"
  },
  {
    situazione: "Vive con almeno un genitore",
    delta: "+1",
    durata: "Situazionale",
    condizioni: "Almeno un genitore nella stessa abitazione. Max +1.",
    stato: "Proposto"
  },
  {
    situazione: "Coniuge vivo ma non coabitano",
    delta: "−1",
    durata: "Situazionale",
    condizioni: "Ha coniugeId valido ma non condivide la stessa abitazione. Speculare al +1 coabitazione.",
    stato: "Proposto"
  },
  {
    situazione: "Ha un lavoro",
    delta: "+1",
    durata: "Situazionale",
    condizioni: "Lavoro diverso da Disoccupato e Prigioniero. Esclusi Golem.",
    stato: "Proposto"
  },
  {
    situazione: "Disoccupato da ≥ 1 mese",
    delta: "−1",
    durata: "Situazionale / mensile",
    condizioni: "Lavoro = Disoccupato da almeno un mese di gioco. Non si somma al +1 lavoro.",
    stato: "Proposto"
  },
  {
    situazione: "Monete sopra soglia comoda",
    delta: "+1",
    durata: "Situazionale",
    condizioni: "Inventario monete ≥ soglia da definire (es. 50). Max +1.",
    stato: "Proposto"
  },
  {
    situazione: "Non ha mangiato oggi",
    delta: "−1",
    durata: "Giornaliero",
    condizioni: "Simmetrico al bonus pasto: nessun pasto consumato nel giorno di gioco.",
    stato: "Proposto"
  },
  {
    situazione: "Amicizia alta nello stesso edificio",
    delta: "+1",
    durata: "Situazionale",
    condizioni: "Almeno un’amicizia ≥ 90 con qualcuno assegnato allo stesso edificio (casa o lavoro). Max +1.",
    stato: "Proposto"
  },
  {
    situazione: "Rivalità alta nello stesso edificio",
    delta: "−1",
    durata: "Situazionale",
    condizioni: "Almeno una rivalità ≥ 70 con qualcuno nello stesso edificio. Max −1.",
    stato: "Proposto"
  },
  {
    situazione: "Casta coercibile (Schiavo / Servo della gleba)",
    delta: "−1",
    durata: "Situazionale",
    condizioni: "Vita dura da casta. Eventuale −2 da bilanciare in playtest.",
    stato: "Proposto"
  },
  {
    situazione: "Salute bassa",
    delta: "−1",
    durata: "Situazionale",
    condizioni: "Salute < 40. Esclusi Golem.",
    stato: "Proposto"
  },
  {
    situazione: "Salutista + salute alta",
    delta: "+1",
    durata: "Situazionale",
    condizioni: "Personalità Salutista e salute ≥ 70.",
    stato: "Proposto"
  },
  {
    situazione: "Stakanovista + lavoro",
    delta: "+1",
    durata: "Situazionale",
    condizioni: "Personalità Stakanovista e ha un lavoro (non Disoccupato / Prigioniero).",
    stato: "Proposto"
  },
  {
    situazione: "Incinta",
    delta: "−1",
    durata: "Temporaneo",
    condizioni: "Finché incinta = true. Stress della gravidanza; da confermare in bilanciamento.",
    stato: "Proposto"
  },
  {
    situazione: "Culto / Capo religioso soddisfatto",
    delta: "+1",
    durata: "Situazionale",
    condizioni: "Da collegare a religione e bisogni (placeholder finché non c’è il sistema culto).",
    stato: "Proposto"
  }
];

type RigaFascia = { fascia: string; intervallo: string; note: string };

const RIGHE_FASCE: RigaFascia[] = [
  { fascia: "Devoto", intervallo: "≥ +5", note: "Massima fedeltà / benessere" },
  { fascia: "Soddisfatto", intervallo: "+2 … +4", note: "" },
  { fascia: "Neutrale", intervallo: "−1 … +1", note: "" },
  { fascia: "Insoddisfatto", intervallo: "−4 … −2", note: "" },
  { fascia: "Ostile", intervallo: "≤ −5", note: "Azione probabile dipende dalla personalità" }
];

type RigaOstile = { personalita: string; azione: string };

const RIGHE_OSTILE: RigaOstile[] = [
  { personalita: "Psicopatico", azione: "Attentato" },
  { personalita: "Depresso", azione: "Scomparsa" },
  { personalita: "Carismatico / Rivoluzionari", azione: "Rivolta" },
  { personalita: "Pragmatico / Tiepido / altro", azione: "Sabotaggio" }
];

type RigaFazione = {
  situazione: string;
  delta: string;
  scala: string;
  condizioni: string;
  stato: StatoRiga;
};

/** Sistema separato 1–100 (non somma i punti personali). */
const RIGHE_FAZIONE: RigaFazione[] = [
  {
    situazione: "Valore iniziale Rivoluzionari / Sicurezza",
    delta: "80",
    scala: "1–100",
    condizioni: "All’avvio partita. Clamp tra 1 e 100 a ogni modifica.",
    stato: "Attivo"
  },
  {
    situazione: "Grazia all’Ex Governatore",
    delta: "−20 Rivoluzionari",
    scala: "1–100",
    condizioni: "Soddisfazione di fazione, non punti personali.",
    stato: "Attivo"
  },
  {
    situazione: "Evento Rivoluzionari delusi",
    delta: "—",
    scala: "trigger < 70",
    condizioni: "Se Rivoluzionari < 70 può attivarsi; mensile −3 felicità ai membri (non punti sodd.).",
    stato: "Attivo"
  },
  {
    situazione: "Blocco Guerra Civile",
    delta: "—",
    scala: "Sicurezza ≥ 70",
    condizioni: "Con Caserma ≥ 3 addetti e Sicurezza ≥ 70 l’evento non scatta (anche se Lealisti in maggioranza).",
    stato: "Attivo"
  },
  {
    situazione: "Soglia protesta / ribellione (regno)",
    delta: "—",
    scala: "Ostili",
    condizioni: "≥ 5% Ostili → Protesta; ≥ 10% Ostili → Ribellione (su fascia punti personali).",
    stato: "Attivo"
  }
];

const COLS_PUNTI = [
  { key: "situazione", label: "Situazione", width: 200 },
  { key: "delta", label: "Δ", width: 72 },
  { key: "durata", label: "Durata", width: 110 },
  { key: "condizioni", label: "Condizioni / eccezioni", width: 360 },
  { key: "stato", label: "Stato", width: 88 }
] as const;

const TABLE_PUNTI_MIN = COLS_PUNTI.reduce((s, c) => s + c.width, 0);

const COLS_FASCE = [
  { key: "fascia", label: "Fascia", width: 120 },
  { key: "intervallo", label: "Punteggio", width: 100 },
  { key: "note", label: "Note", width: 280 }
] as const;

const TABLE_FASCE_MIN = COLS_FASCE.reduce((s, c) => s + c.width, 0);

const COLS_OSTILE = [
  { key: "personalita", label: "Se Ostile e…", width: 220 },
  { key: "azione", label: "Azione probabile", width: 160 }
] as const;

const TABLE_OSTILE_MIN = COLS_OSTILE.reduce((s, c) => s + c.width, 0);

const COLS_FAZIONE = [
  { key: "situazione", label: "Situazione", width: 220 },
  { key: "delta", label: "Effetto", width: 140 },
  { key: "scala", label: "Scala", width: 110 },
  { key: "condizioni", label: "Condizioni / eccezioni", width: 340 },
  { key: "stato", label: "Stato", width: 88 }
] as const;

const TABLE_FAZIONE_MIN = COLS_FAZIONE.reduce((s, c) => s + c.width, 0);

function StatoBadge({ stato }: { stato: StatoRiga }) {
  return (
    <Text style={[styles.statoText, stato === "Proposto" ? styles.statoProposto : styles.statoAttivo]}>
      {stato}
    </Text>
  );
}

function DeltaText({ delta }: { delta: string }) {
  const neg = delta.trim().startsWith("−") || delta.trim().startsWith("-");
  const pos = delta.trim().startsWith("+");
  return (
    <Text
      style={[
        styles.deltaText,
        pos && styles.deltaPos,
        neg && styles.deltaNeg
      ]}
    >
      {delta}
    </Text>
  );
}

export default function RegoleSoddisfazioneScreen() {
  const router = useRouter();
  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight != null ? { maxHeight, overflow: "hidden" as const } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>😌 Regole Soddisfazione</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
          <Text style={styles.intro}>
            Visione d’insieme dei punti soddisfazione. Totale personale = modificatori validi + bonus
            situazionali. Golem esclusi. «Attivo» = già nel codice; «Proposto» = da implementare.
            Distinto da felicità (0–100), popolarità del Re e soddisfazione fazioni (tabella sotto).
          </Text>

          <Text style={styles.sectionTitle}>Punti soddisfazione personale</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
            <View style={[styles.table, { minWidth: TABLE_PUNTI_MIN }]}>
              <View style={[styles.row, styles.headerRow]}>
                {COLS_PUNTI.map((col) => (
                  <View key={col.key} style={[styles.cell, { width: col.width }]}>
                    <Text style={styles.headerCellText}>{col.label}</Text>
                  </View>
                ))}
              </View>
              {RIGHE_PUNTI.map((r, index) => (
                <View
                  key={`${r.situazione}-${r.stato}`}
                  style={[
                    styles.row,
                    index % 2 === 1 && styles.rowAlt,
                    r.stato === "Proposto" && styles.rowProposto
                  ]}
                >
                  <View style={[styles.cell, { width: COLS_PUNTI[0].width }]}>
                    <Text style={styles.cellStrong}>{r.situazione}</Text>
                  </View>
                  <View style={[styles.cell, { width: COLS_PUNTI[1].width }]}>
                    <DeltaText delta={r.delta} />
                  </View>
                  <View style={[styles.cell, { width: COLS_PUNTI[2].width }]}>
                    <Text style={styles.cellMuted}>{r.durata}</Text>
                  </View>
                  <View style={[styles.cell, { width: COLS_PUNTI[3].width }]}>
                    <Text style={styles.cellBody}>{r.condizioni}</Text>
                  </View>
                  <View style={[styles.cell, { width: COLS_PUNTI[4].width }]}>
                    <StatoBadge stato={r.stato} />
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.sectionTitle}>Fasce (da punteggio totale)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
            <View style={[styles.table, { minWidth: TABLE_FASCE_MIN }]}>
              <View style={[styles.row, styles.headerRow]}>
                {COLS_FASCE.map((col) => (
                  <View key={col.key} style={[styles.cell, { width: col.width }]}>
                    <Text style={styles.headerCellText}>{col.label}</Text>
                  </View>
                ))}
              </View>
              {RIGHE_FASCE.map((r, index) => (
                <View key={r.fascia} style={[styles.row, index % 2 === 1 && styles.rowAlt]}>
                  <View style={[styles.cell, { width: COLS_FASCE[0].width }]}>
                    <Text style={styles.cellStrong}>{r.fascia}</Text>
                  </View>
                  <View style={[styles.cell, { width: COLS_FASCE[1].width }]}>
                    <Text style={styles.deltaText}>{r.intervallo}</Text>
                  </View>
                  <View style={[styles.cell, { width: COLS_FASCE[2].width }]}>
                    <Text style={styles.cellBody}>{r.note || "—"}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.sectionTitle}>Se fascia Ostile</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
            <View style={[styles.table, { minWidth: TABLE_OSTILE_MIN }]}>
              <View style={[styles.row, styles.headerRow]}>
                {COLS_OSTILE.map((col) => (
                  <View key={col.key} style={[styles.cell, { width: col.width }]}>
                    <Text style={styles.headerCellText}>{col.label}</Text>
                  </View>
                ))}
              </View>
              {RIGHE_OSTILE.map((r, index) => (
                <View key={r.personalita} style={[styles.row, index % 2 === 1 && styles.rowAlt]}>
                  <View style={[styles.cell, { width: COLS_OSTILE[0].width }]}>
                    <Text style={styles.cellBody}>{r.personalita}</Text>
                  </View>
                  <View style={[styles.cell, { width: COLS_OSTILE[1].width }]}>
                    <Text style={styles.cellStrong}>{r.azione}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.sectionTitle}>Fazioni e disordine (altro sistema)</Text>
          <Text style={styles.sectionHint}>
            Non si sommano ai punti personali. Scala tipicamente 1–100 o soglie percentuali.
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
            <View style={[styles.table, { minWidth: TABLE_FAZIONE_MIN }]}>
              <View style={[styles.row, styles.headerRow]}>
                {COLS_FAZIONE.map((col) => (
                  <View key={col.key} style={[styles.cell, { width: col.width }]}>
                    <Text style={styles.headerCellText}>{col.label}</Text>
                  </View>
                ))}
              </View>
              {RIGHE_FAZIONE.map((r, index) => (
                <View key={r.situazione} style={[styles.row, index % 2 === 1 && styles.rowAlt]}>
                  <View style={[styles.cell, { width: COLS_FAZIONE[0].width }]}>
                    <Text style={styles.cellStrong}>{r.situazione}</Text>
                  </View>
                  <View style={[styles.cell, { width: COLS_FAZIONE[1].width }]}>
                    <Text style={styles.cellBody}>{r.delta}</Text>
                  </View>
                  <View style={[styles.cell, { width: COLS_FAZIONE[2].width }]}>
                    <Text style={styles.cellMuted}>{r.scala}</Text>
                  </View>
                  <View style={[styles.cell, { width: COLS_FAZIONE[3].width }]}>
                    <Text style={styles.cellBody}>{r.condizioni}</Text>
                  </View>
                  <View style={[styles.cell, { width: COLS_FAZIONE[4].width }]}>
                    <StatoBadge stato={r.stato} />
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Home
        </Text>
      </View>
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
  back: { color: "#93c5fd", fontSize: 12 },
  title: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  content: { paddingHorizontal: 12, paddingVertical: 8, paddingBottom: 24 },
  intro: {
    color: "rgba(203,213,245,0.85)",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
    maxWidth: 900
  },
  sectionTitle: {
    color: "#93c5fd",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 18,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  sectionHint: {
    color: "rgba(203,213,245,0.65)",
    fontSize: 11,
    marginBottom: 8,
    lineHeight: 16
  },
  table: {
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "rgba(15,23,42,0.95)",
    marginBottom: 4
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.35)"
  },
  rowAlt: { backgroundColor: "rgba(30,41,59,0.55)" },
  rowProposto: { backgroundColor: "rgba(120,53,15,0.22)" },
  headerRow: {
    backgroundColor: "rgba(30,41,59,0.95)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.55)"
  },
  cell: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    justifyContent: "center",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "rgba(148,163,184,0.25)"
  },
  headerCellText: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3
  },
  cellStrong: { color: "#f8fafc", fontSize: 12, fontWeight: "700" },
  cellBody: { color: "rgba(226,232,240,0.92)", fontSize: 11, lineHeight: 16 },
  cellMuted: { color: "rgba(148,163,184,0.95)", fontSize: 11, fontWeight: "600" },
  deltaText: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"]
  },
  deltaPos: { color: "#86efac" },
  deltaNeg: { color: "#fca5a5" },
  statoText: { fontSize: 11, fontWeight: "800" },
  statoAttivo: { color: "#86efac" },
  statoProposto: { color: "#fbbf24" }
});
