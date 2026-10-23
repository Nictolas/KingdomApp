import React, { useMemo, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import {
  descrizioneReligione,
  elencoNomiReligioni,
  emojiReligione,
  EMOJI_RELIGIONE_PRESET,
  RELIGIONI_ELENCO,
  èReligioneCanon,
  elencoReligioniTempio,
  type ReligioneCustom
} from "../src/game/fedeleCulto";
import { religioneTempioDi, trovaChiesaOperativa } from "../src/game/chiesa";
import { CreazioneGiocatoreModal, type DatiCreazioneGiocatore } from "../src/ui/CreazioneGiocatoreModal";
import type { AspettoPersonaggio } from "../src/game/personaggioAspetto";
import type { DottrinaNaturalista } from "../src/game/ecosistemaBosco";
import { dogmiDalModello, religioniModelloEresia } from "../src/game/eresieReligiose";
import type { DogmaReligioso } from "../src/game/dogmiReligiosi";
import { VESTITI_DOGMA } from "../src/game/dogmiReligiosi";
import { OGGETTI_INVENTARIO } from "../src/game/inventario";
import { ReligionePieChart, coloriReligione } from "../src/ui/ReligionePieChart";
import type { VestitiPersonaggio } from "../src/game/personaggioAspetto";
import { modalBackdropFullscreen, modalContentFullscreen } from "../src/ui/modalFullscreenStyles";

export default function ReligioniScreen() {
  const router = useRouter();
  const {
    abitanti, edifici, religioniCustom, creaReligioneCustom,
    modificaDogmiReligioneCustom, politicaReligiosa, religioneDiStato,
    setPoliticaReligiosa, setReligioneDiStato
  } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const maxHeight = isDesktop ? width * (9 / 16) : undefined;

  const [mostraCrea, setMostraCrea] = useState(false);
  const [mostraAbiti, setMostraAbiti] = useState(false);
  const [nomeNuova, setNomeNuova] = useState("");
  const [emojiNuova, setEmojiNuova] = useState<string>(EMOJI_RELIGIONE_PRESET[0]!);
  const [descrizioneNuova, setDescrizioneNuova] = useState("");
  const [dottrinaNuova, setDottrinaNuova] = useState<DottrinaNaturalista>({
    forestaSacra: false, tutelaFauna: false, tutelaVegetazione: false
  });
  const [aspettoSacerdote, setAspettoSacerdote] = useState<AspettoPersonaggio | null>(null);
  const [tipoFondazione, setTipoFondazione] = useState<"originale" | "eresia">("originale");
  const [religioneModello, setReligioneModello] = useState<string | null>(null);
  const [modificaReligioneId, setModificaReligioneId] = useState<string | null>(null);
  const [dogmiNuovi, setDogmiNuovi] = useState<DogmaReligioso[]>([]);
  const [ricercaAlimento, setRicercaAlimento] = useState("");
  const [esitoFondazione, setEsitoFondazione] = useState<string | null>(null);
  const [erroreCrea, setErroreCrea] = useState<string | null>(null);

  const nomiReligioni = useMemo(
    () => elencoNomiReligioni(religioniCustom),
    [religioniCustom]
  );

  const conteggi = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of nomiReligioni) map.set(r, 0);
    for (const a of abitanti) {
      if (a.razza === "Golem") continue;
      map.set(a.religione, (map.get(a.religione) ?? 0) + 1);
    }
    return map;
  }, [abitanti, nomiReligioni]);

  const chiesa = useMemo(() => trovaChiesaOperativa(edifici), [edifici]);
  const modelliEresia = useMemo(() => religioniModelloEresia(religioniCustom), [religioniCustom]);
  const opzioniReligioneStato = useMemo(() => elencoReligioniTempio(religioniCustom), [religioniCustom]);
  const alimentiDisponibili = useMemo(() => Object.values(OGGETTI_INVENTARIO)
    .filter(o => o.categoria === "Cibo")
    .filter(o => !ricercaAlimento || o.nome.toLowerCase().includes(ricercaAlimento.toLowerCase()))
    .slice(0, 14), [ricercaAlimento]);
  const chartData = useMemo(() => nomiReligioni.map(nome => ({
    nome,
    emoji: emojiReligione(nome, religioniCustom),
    count: conteggi.get(nome) ?? 0,
    color: coloriReligione(nome)
  })), [nomiReligioni, religioniCustom, conteggi]);

  const pathPerReligione = (nome: string): string | null => {
    if (nome === "Culto del Sole") return "/culto-sole";
    if (nome === "Culto delle Ombre") return "/culto-ombre";
    if (chiesa && !èReligioneCanon(nome)) return `/chiesa/${chiesa.id}`;
    return null;
  };

  const apriCrea = () => {
    setNomeNuova("");
    setEmojiNuova(EMOJI_RELIGIONE_PRESET[0]!);
    setDescrizioneNuova("");
    setDottrinaNuova({ forestaSacra: false, tutelaFauna: false, tutelaVegetazione: false });
    setAspettoSacerdote(null);
    setTipoFondazione("originale");
    setReligioneModello(null);
    setModificaReligioneId(null);
    setDogmiNuovi([]);
    setRicercaAlimento("");
    setErroreCrea(null);
    setMostraCrea(true);
  };

  const usaModello = (nome: string) => {
    const modello = religioniCustom.find(r => r.nome === nome);
    const copiati = dogmiDalModello(nome, religioniCustom);
    setTipoFondazione("eresia");
    setReligioneModello(nome);
    setDogmiNuovi(copiati.dogmi);
    setDottrinaNuova(copiati.dottrinaNaturalista);
    setEmojiNuova(emojiReligione(nome, religioniCustom));
    setDescrizioneNuova(copiati.descrizione);
    setAspettoSacerdote(modello?.aspettoSacerdote ?? null);
  };

  const apriModifica = (religione: ReligioneCustom) => {
    setModificaReligioneId(religione.id);
    setTipoFondazione(religione.origineReligione ? "eresia" : "originale");
    setReligioneModello(religione.origineReligione ?? null);
    setNomeNuova(religione.nome);
    setDescrizioneNuova(religione.descrizione);
    setEmojiNuova(religione.emoji);
    setDottrinaNuova({
      forestaSacra: religione.dottrinaNaturalista?.forestaSacra === true,
      tutelaFauna: religione.dottrinaNaturalista?.tutelaFauna === true,
      tutelaVegetazione: religione.dottrinaNaturalista?.tutelaVegetazione === true
    });
    setDogmiNuovi([...(religione.dogmi ?? [])]);
    setRicercaAlimento("");
    setErroreCrea(null);
    setMostraCrea(true);
  };

  const cambiaAlimento = (itemId: string) => {
    setDogmiNuovi(prev => prev.some(d =>
      d.tipo === "alimento_vietato" && d.itemId === itemId)
      ? prev.filter(d => d.tipo !== "alimento_vietato" || d.itemId !== itemId)
      : [...prev, { tipo: "alimento_vietato", itemId }]);
  };

  const cambiaAbito = (destinatari: "fedeli" | "sacerdoti", vestiti: VestitiPersonaggio | null) => {
    setDogmiNuovi(prev => [
      ...prev.filter(d => !(d.tipo === "abito_obbligatorio" && d.destinatari === destinatari)),
      ...(vestiti ? [{ tipo: "abito_obbligatorio" as const, destinatari, vestiti }] : [])
    ]);
  };

  const cambiaSovranoDivino = () => {
    setDogmiNuovi(prev => prev.some(d => d.tipo === "sovrano_rappresentante_divino")
      ? prev.filter(d => d.tipo !== "sovrano_rappresentante_divino")
      : [...prev, { tipo: "sovrano_rappresentante_divino" }]);
  };

  const confermaCrea = () => {
    if (modificaReligioneId) {
      const ok = modificaDogmiReligioneCustom(modificaReligioneId, dogmiNuovi, dottrinaNuova);
      if (!ok) { setErroreCrea("Religione non trovata."); return; }
      setMostraCrea(false);
      setEsitoFondazione("Dogmi aggiornati: la religione può evolvere nel tempo.");
      return;
    }
    const result = creaReligioneCustom({
      nome: nomeNuova,
      emoji: emojiNuova,
      descrizione: descrizioneNuova,
      dottrinaNaturalista: dottrinaNuova,
      dogmi: dogmiNuovi,
      ...(tipoFondazione === "eresia" && religioneModello
        ? { origineReligione: religioneModello } : {}),
      ...(aspettoSacerdote ? { aspettoSacerdote } : {})
    });
    if (!result.ok) {
      setErroreCrea(result.errore);
      return;
    }
    setMostraCrea(false);
    setEsitoFondazione(result.convertiti != null && result.convertiti > 0
      ? "Nuova eresia fondata. " + result.convertiti + " fedeli del culto originario si sono convertiti."
      : tipoFondazione === "eresia"
        ? "Nuova eresia fondata. Nessuna conversione immediata: i fedeli potranno arrivare in seguito."
        : "Nuova religione fondata da zero, senza fedeli convertiti automaticamente.");
  };

  const salvaAbitiSacerdote = (dati: DatiCreazioneGiocatore) => {
    setAspettoSacerdote(dati.aspetto);
    setMostraAbiti(false);
  };

  return (
    <SafeAreaView style={[styles.safe, maxHeight != null ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>Religioni</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.intro}>
            Ateo, Deista e Agnostico non possono essere Religione del Tempio. Ateo e Deista non possono
            diventare Fedeli di un culto.
          </Text>

          <Pressable style={styles.creaBtn} onPress={apriCrea}>
            <Text style={styles.creaBtnEmoji}>➕</Text>
            <Text style={styles.creaBtnText}>Crea Religione</Text>
          </Pressable>

          <View style={styles.cardGrid}>
            {nomiReligioni.map((nome) => {
              const path = pathPerReligione(nome);
              const count = conteggi.get(nome) ?? 0;
              const custom = !èReligioneCanon(nome);
              return (
                <Pressable
                  key={nome}
                  style={styles.card}
                  onPress={() => {
                    if (path) router.push(path);
                    else router.push("/religione");
                  }}
                >
                  <Text style={styles.emoji}>{emojiReligione(nome, religioniCustom)}</Text>
                  <Text style={styles.cardTitle}>{nome}</Text>
                  {custom ? <Text style={styles.cardBadge}>Creata</Text> : null}
                  <Text style={styles.cardCount}>{count} abitanti</Text>
                  <Text style={styles.cardDescrizione} numberOfLines={3}>
                    {descrizioneReligione(nome, religioniCustom)}
                  </Text>
                  {path ? (
                    <Text style={styles.cardLink}>Apri tempio →</Text>
                  ) : (
                    <Text style={styles.cardLink}>Politica religiosa →</Text>
                  )}
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>Edifici</Text>
          <View style={styles.edificiRow}>
            {chiesa ? (
              <Pressable
                style={styles.edificioCard}
                onPress={() => router.push(`/chiesa/${chiesa.id}`)}
              >
                <Text style={styles.edificioEmoji}>⛪</Text>
                <Text style={styles.edificioNome}>Chiesa</Text>
                <Text style={styles.edificioMeta}>
                  {religioneTempioDi(chiesa, religioniCustom)}
                </Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.edificioCard} onPress={() => router.push("/culto-sole")}>
              <Text style={styles.edificioEmoji}>☀️</Text>
              <Text style={styles.edificioNome}>Culto del Sole</Text>
            </Pressable>
            <Pressable style={styles.edificioCard} onPress={() => router.push("/culto-ombre")}>
              <Text style={styles.edificioEmoji}>🌑</Text>
              <Text style={styles.edificioNome}>Culto delle Ombre</Text>
            </Pressable>
            <Pressable style={styles.edificioCard} onPress={() => router.push("/religione")}>
              <Text style={styles.edificioEmoji}>🕊️</Text>
              <Text style={styles.edificioNome}>Politica</Text>
              <Text style={styles.edificioMeta}>Leggi religiose</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Menu
        </Text>
      </View>

      <Modal
        visible={mostraCrea}
        transparent
        animationType="fade"
        onRequestClose={() => setMostraCrea(false)}
      >
        <View style={[styles.modalBackdrop, isDesktop && modalBackdropFullscreen]}>
          <ScrollView style={[styles.modalCard, isDesktop && modalContentFullscreen]} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>Crea Religione</Text>
            <Text style={styles.modalHint}>
              Aggiunge una religione al regno (oltre a {RELIGIONI_ELENCO.join(", ")}).
            </Text>

            <Text style={styles.fieldLabel}>Nome</Text>
            <TextInput
              style={styles.input}
              value={nomeNuova}
              onChangeText={setNomeNuova}
              placeholder="Es. Ordine della Luna"
              placeholderTextColor="rgba(148,163,184,0.5)"
              autoCapitalize="words"
              maxLength={40}
            />

            <Text style={styles.fieldLabel}>Emoji</Text>
            <View style={styles.emojiRow}>
              {EMOJI_RELIGIONE_PRESET.map((e) => (
                <Pressable
                  key={e}
                  style={[styles.emojiChip, emojiNuova === e && styles.emojiChipAttivo]}
                  onPress={() => setEmojiNuova(e)}
                >
                  <Text style={styles.emojiChipText}>{e}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Descrizione</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={descrizioneNuova}
              onChangeText={setDescrizioneNuova}
              placeholder="Breve descrizione del culto…"
              placeholderTextColor="rgba(148,163,184,0.5)"
              multiline
              maxLength={160}
            />

            <Text style={styles.fieldLabel}>Dottrina della natura (facoltativa)</Text>
            <Text style={styles.modalHint}>
              Le religioni naturaliste reagiscono al degrado reale del Bosco.
              La Soddisfazione si ristabilisce quando l'ecosistema recupera.
            </Text>
            {([
              ["forestaSacra", "🌳 Il Bosco è sacro"],
              ["tutelaFauna", "🦌 Gli animali sono sacri"],
              ["tutelaVegetazione", "🌿 Proteggere la vegetazione"]
            ] as const).map(([chiave, testo]) => (
              <Pressable
                key={chiave}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: dottrinaNuova[chiave] }}
                style={[styles.dottrinaChip, dottrinaNuova[chiave] && styles.emojiChipAttivo]}
                onPress={() => setDottrinaNuova(prev => ({
                  ...prev, [chiave]: !prev[chiave]
                }))}
              >
                <Text style={styles.emojiChipText}>
                  {dottrinaNuova[chiave] ? "☑" : "☐"} {testo}
                </Text>
              </Pressable>
            ))}

            <Pressable style={styles.abitiBtn} onPress={() => setMostraAbiti(true)}>
              <Text style={styles.abitiBtnText}>
                {aspettoSacerdote ? "✓ Abiti Sacerdote personalizzati" : "Personalizza Abiti Sacerdote"}
              </Text>
            </Pressable>

            {erroreCrea ? <Text style={styles.errore}>{erroreCrea}</Text> : null}

            <View style={styles.modalActions}>
              <Pressable style={styles.modalBtnSecondary} onPress={() => setMostraCrea(false)}>
                <Text style={styles.modalBtnSecondaryText}>Annulla</Text>
              </Pressable>
              <Pressable style={styles.modalBtnPrimary} onPress={confermaCrea}>
                <Text style={styles.modalBtnPrimaryText}>Crea</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <CreazioneGiocatoreModal
        visible={mostraAbiti}
        mode="outfit"
        titolo="Abiti Sacerdote"
        initial={
          aspettoSacerdote
            ? {
                nome: "Sacerdote",
                cognome: "",
                sesso: "M",
                orientamento: "Etero",
                razza: "Umano",
                aspetto: aspettoSacerdote
              }
            : null
        }
        onAnnulla={() => setMostraAbiti(false)}
        onConferma={salvaAbitiSacerdote}
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
  content: { paddingHorizontal: 12, paddingVertical: 10, paddingBottom: 20 },
  intro: {
    color: "rgba(203,213,245,0.75)",
    fontSize: 11,
    marginBottom: 12,
    lineHeight: 16
  },
  creaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(37,99,235,0.35)",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.55)",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14
  },
  creaBtnEmoji: { fontSize: 16 },
  creaBtnText: { color: "#e0f2fe", fontSize: 13, fontWeight: "700" },
  cardGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.55)",
    width: "48%",
    flexGrow: 1,
    minWidth: 140
  },
  emoji: { fontSize: 28, marginBottom: 4, textAlign: "center" },
  cardTitle: {
    color: "#e5e7eb",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 2
  },
  cardBadge: {
    alignSelf: "center",
    color: "#93c5fd",
    fontSize: 9,
    fontWeight: "600",
    marginBottom: 2
  },
  cardCount: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 4
  },
  cardDescrizione: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9,
    textAlign: "center",
    marginBottom: 6
  },
  cardLink: { color: "#60a5fa", fontSize: 9, fontWeight: "600", textAlign: "center" },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8
  },
  edificiRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  edificioCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.45)",
    alignItems: "center",
    minWidth: 100,
    flexGrow: 1
  },
  edificioEmoji: { fontSize: 22, marginBottom: 2 },
  edificioNome: { color: "#e5e7eb", fontSize: 10, fontWeight: "700" },
  edificioMeta: { color: "rgba(148,163,184,0.85)", fontSize: 8, marginTop: 2 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.72)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "90%",
    backgroundColor: "#0f172a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.45)"
  },
  modalContent: { padding: 16 },
  modalTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 6 },
  modalHint: { color: "rgba(203,213,245,0.7)", fontSize: 11, marginBottom: 12, lineHeight: 15 },
  fieldLabel: { color: "#cbd5e1", fontSize: 11, fontWeight: "600", marginBottom: 4, marginTop: 8 },
  input: {
    backgroundColor: "rgba(15,23,42,0.9)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
    borderRadius: 8,
    color: "#f8fafc",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13
  },
  inputMulti: { minHeight: 64, textAlignVertical: "top" },
  abitiBtn: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.5)",
    backgroundColor: "rgba(30,41,59,0.85)",
    alignItems: "center"
  },
  abitiBtnText: { color: "#bfdbfe", fontSize: 12, fontWeight: "700" },
  emojiRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  dottrinaChip: {
    width: "100%", minHeight: 38, borderRadius: 8, borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)", justifyContent: "center",
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 6,
    backgroundColor: "rgba(15,23,42,0.8)"
  },
  emojiChip: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.8)"
  },
  emojiChipAttivo: {
    borderColor: "#60a5fa",
    backgroundColor: "rgba(37,99,235,0.35)"
  },
  emojiChipText: { fontSize: 18 },
  errore: { color: "#fca5a5", fontSize: 11, marginTop: 10 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 16 },
  modalBtnSecondary: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)"
  },
  modalBtnSecondaryText: { color: "#cbd5e1", fontSize: 12, fontWeight: "600" },
  modalBtnPrimary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#2563eb"
  },
  modalBtnPrimaryText: { color: "#fff", fontSize: 12, fontWeight: "700" }
});
