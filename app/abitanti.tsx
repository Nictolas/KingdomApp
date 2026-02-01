import React, { useState, useMemo } from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import type { Edificio } from "../src/types";
import { getStatoSalute } from "../src/game/ciboConsumo";
import { getEmojiRazza, fazioniData } from "../src/kingdomData";
import { getEmojiAbitante } from "../src/utils/getEmojiAbitante";
import type { Abitante } from "../src/types";
import { AbitanteInfoModal } from "../src/ui/AbitanteInfoModal";

type FazioneItem = { emoji: string; nome: string };

/** Restituisce l'array emoji+nome per fazioni + Culto del Sole / Culto degli Alieni se presenti. */
function getFazioniConReligione(a: Abitante): FazioneItem[] {
  const items: FazioneItem[] = (a.fazioni ?? []).map((nome) => {
    const f = fazioniData.find((x) => x.nome === nome);
    return { emoji: f?.emoji ?? nome, nome };
  });
  if (a.religione === "Culto del Sole") items.push({ emoji: "☀️", nome: "Culto del Sole" });
  if (a.religione === "Culto degli Alieni") items.push({ emoji: "👽", nome: "Culto degli Alieni" });
  return items;
}

/** Stringa per ordinamento: emoji fazioni + eventuale emoji religione (Culto Sole/Alieni). */
function getFazioniEmojiDisplay(fazioni: string[] | undefined, religione?: Abitante["religione"]): string {
  let s = !fazioni?.length ? "" : fazioni.map((nome) => fazioniData.find((f) => f.nome === nome)?.emoji ?? nome).join(" ");
  if (religione === "Culto del Sole") s += " ☀️";
  if (religione === "Culto degli Alieni") s += " 👽";
  return s || "—";
}

/** Wrapper emoji con tooltip (nome) al passaggio del mouse (web). */
function EmojiWithTooltip({ emoji, nome }: { emoji: string; nome: string }) {
  const [show, setShow] = useState(false);
  return (
    <View
      style={styles.tooltipWrap}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <Text style={styles.cellEmojiText}>{emoji}</Text>
      {show && (
        <View style={styles.tooltipBox}>
          <Text style={styles.tooltipText}>{nome}</Text>
        </View>
      )}
    </View>
  );
}

/** Restituisce il nome dell’edificio di residenza dell’abitante o "—" se nessuno. */
function getResidenzaAbitante(abitanteId: number, edifici: Edificio[]): string {
  const residenza = edifici.find(
    (e) => e.tipo === "Residenza" && (e.abitantiAssegnati ?? []).includes(abitanteId)
  );
  return residenza?.nome ?? "—";
}

type SortField = "nome" | "eta" | "lavoro" | "razza" | "sesso" | "orientamento" | "residenza" | "competenza" | "produttività" | "stanchezza" | "peso" | "salute" | "crediti" | "reddito" | "spese" | "lealtà" | "amici" | "rivali" | "familiari" | "paura" | "felicità" | "fazioni" | null;
type SortDirection = "asc" | "desc";

type MacroKey = "anagrafica" | "prestazioni" | "benessere" | "economia" | "lealta" | "sociale" | "religioneFazioni";
const MACRO_OPEN_DEFAULT: Record<MacroKey, boolean> = {
  anagrafica: true,
  prestazioni: true,
  benessere: true,
  economia: true,
  lealta: true,
  sociale: true,
  religioneFazioni: true
};

const LAVORI_DA_MINORE = ["Studente", "Apprendista", "Tirocinante"];

function getEmojiDisplay(abitante: Abitante, etaMinimaLavoro: number): string {
  const razza = abitante.razza ?? "Umano";
  if (razza !== "Umano") return getEmojiRazza(razza);
  const maggiorenne = abitante.eta >= etaMinimaLavoro;
  const lavoroDaMinore = LAVORI_DA_MINORE.includes(abitante.lavoro);
  if (maggiorenne && lavoroDaMinore) return "👤";
  return abitante.emoji;
}

function getLavoroDisplay(abitante: Abitante, etaMinimaLavoro: number): string {
  const maggiorenne = abitante.eta >= etaMinimaLavoro;
  const lavoroDaMinore = LAVORI_DA_MINORE.includes(abitante.lavoro);
  if (maggiorenne && lavoroDaMinore) return "Disoccupato";
  return abitante.lavoro;
}

export default function AbitantiScreen() {
  const router = useRouter();
  const { abitanti, edifici, calcolaFelicitàModificata, etaMinimaLavoro } = useGameContext();
  const [selectedAbitante, setSelectedAbitante] = useState<Abitante | null>(null);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [macroOpen, setMacroOpen] = useState<Record<MacroKey, boolean>>(MACRO_OPEN_DEFAULT);

  const toggleMacro = (key: MacroKey) => {
    setMacroOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const getAbitanteNome = (id: number) => {
    return abitanti.find((a) => a.id === id)?.nome || `ID ${id}`;
  };

  /** Restituisce i familiari come { emoji, nome } con nome = "Nome Cognome (parentela)" per tooltip. In cella si mostrano solo le emoji. */
  const getFamiliariItems = (a: Abitante): { emoji: string; nome: string }[] => {
    const items: { emoji: string; nome: string }[] = [];
    const push = (id: number, parentela: string) => {
      const ab = abitanti.find((x) => x.id === id);
      if (ab) items.push({ emoji: getEmojiAbitante(ab), nome: `${ab.nome} (${parentela})` });
    };
    if (a.coniugeId != null) push(a.coniugeId, "coniuge");
    (a.figliIds ?? []).forEach((id) => push(id, "figlio"));
    (a.genitoriIds ?? []).forEach((id) => push(id, "genitore"));
    (a.nonniIds ?? []).forEach((id) => push(id, "nonno"));
    return items;
  };

  /** Stringa per ordinamento colonna Familiari (nome + parentela). */
  const getFamiliariSortKey = (a: Abitante): string =>
    getFamiliariItems(a).map((x) => x.nome).join(" ") || "—";

  /** Amici con emoji + tooltip "Nome (punteggio)". */
  const getAmiciItems = (a: Abitante): { emoji: string; nome: string }[] =>
    (a.amici ?? []).map((r) => {
      const ab = abitanti.find((x) => x.id === r.id);
      return ab ? { emoji: getEmojiAbitante(ab), nome: `${ab.nome} (${r.punteggio})` } : { emoji: "?", nome: `ID ${r.id} (${r.punteggio})` };
    });

  /** Rivali con emoji + tooltip "Nome (punteggio)". */
  const getRivaliItems = (a: Abitante): { emoji: string; nome: string }[] =>
    (a.rivali ?? []).map((r) => {
      const ab = abitanti.find((x) => x.id === r.id);
      return ab ? { emoji: getEmojiAbitante(ab), nome: `${ab.nome} (${r.punteggio})` } : { emoji: "?", nome: `ID ${r.id} (${r.punteggio})` };
    });

  // Ordina gli abitanti
  const abitantiOrdinati = useMemo(() => {
    if (!sortField) return abitanti;

    const sorted = [...abitanti].sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      if (sortField === "felicità") {
        aValue = calcolaFelicitàModificata(a);
        bValue = calcolaFelicitàModificata(b);
      } else if (sortField === "fazioni") {
        aValue = getFazioniEmojiDisplay(a.fazioni, a.religione);
        bValue = getFazioniEmojiDisplay(b.fazioni, b.religione);
      } else if (sortField === "nome") {
        aValue = a.nome;
        bValue = b.nome;
      } else if (sortField === "lavoro") {
        aValue = getLavoroDisplay(a, etaMinimaLavoro);
        bValue = getLavoroDisplay(b, etaMinimaLavoro);
      } else if (sortField === "razza") {
        aValue = a.razza ?? "Umano";
        bValue = b.razza ?? "Umano";
      } else if (sortField === "residenza") {
        aValue = getResidenzaAbitante(a.id, edifici);
        bValue = getResidenzaAbitante(b.id, edifici);
      } else if (sortField === "sesso") {
        aValue = a.sesso ?? "—";
        bValue = b.sesso ?? "—";
      } else if (sortField === "orientamento") {
        aValue = a.orientamento ?? "—";
        bValue = b.orientamento ?? "—";
      } else if (sortField === "salute") {
        aValue = getStatoSalute(a);
        bValue = getStatoSalute(b);
      } else if (sortField === "peso") {
        aValue = a.peso ?? 50;
        bValue = b.peso ?? 50;
      } else if (sortField === "amici") {
        aValue = (a.amici?.length ?? 0);
        bValue = (b.amici?.length ?? 0);
      } else if (sortField === "rivali") {
        aValue = (a.rivali?.length ?? 0);
        bValue = (b.rivali?.length ?? 0);
      } else if (sortField === "familiari") {
        aValue = getFamiliariSortKey(a);
        bValue = getFamiliariSortKey(b);
      } else {
        aValue = a[sortField as keyof Abitante] as number;
        bValue = b[sortField as keyof Abitante] as number;
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc" 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return sortDirection === "asc"
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      }
    });

    return sorted;
  }, [abitanti, edifici, sortField, sortDirection, calcolaFelicitàModificata, etaMinimaLavoro]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Inverti la direzione se clicchi di nuovo sulla stessa colonna
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Nuova colonna, inizia con ordine crescente
      setSortField(field);
      setSortDirection("asc");
    }
  };

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Home
        </Text>
        <Text style={styles.title}>Abitanti</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView 
        horizontal
        contentContainerStyle={styles.tableContainer}
        showsHorizontalScrollIndicator={true}
      >
        <ScrollView 
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={true}
        >
          {/* Riga sovracolonne (cliccabili per aprire/chiudere) */}
          <View style={styles.superHeaderRow}>
            <View style={[styles.superHeaderCell, styles.superEmoji]} />
            <Pressable
              style={[styles.superHeaderCell, macroOpen.anagrafica ? styles.superAnagrafica : styles.superMacroCollapsed]}
              onPress={() => toggleMacro("anagrafica")}
            >
              <View style={styles.superHeaderInner}>
                <Text style={styles.superHeaderText} numberOfLines={1}>Anagrafica</Text>
                <Text style={styles.superHeaderArrow}>{macroOpen.anagrafica ? "▼" : "▶"}</Text>
              </View>
            </Pressable>
            <Pressable
              style={[styles.superHeaderCell, macroOpen.prestazioni ? styles.superPrestazioni : styles.superMacroCollapsed]}
              onPress={() => toggleMacro("prestazioni")}
            >
              <View style={styles.superHeaderInner}>
                <Text style={styles.superHeaderText} numberOfLines={1}>Prestazioni</Text>
                <Text style={styles.superHeaderArrow}>{macroOpen.prestazioni ? "▼" : "▶"}</Text>
              </View>
            </Pressable>
            <Pressable
              style={[styles.superHeaderCell, macroOpen.benessere ? styles.superBenessere : styles.superMacroCollapsed]}
              onPress={() => toggleMacro("benessere")}
            >
              <View style={styles.superHeaderInner}>
                <Text style={styles.superHeaderText} numberOfLines={1}>Salute e benessere</Text>
                <Text style={styles.superHeaderArrow}>{macroOpen.benessere ? "▼" : "▶"}</Text>
              </View>
            </Pressable>
            <Pressable
              style={[styles.superHeaderCell, macroOpen.economia ? styles.superEconomia : styles.superMacroCollapsed]}
              onPress={() => toggleMacro("economia")}
            >
              <View style={styles.superHeaderInner}>
                <Text style={styles.superHeaderText} numberOfLines={1}>Economia</Text>
                <Text style={styles.superHeaderArrow}>{macroOpen.economia ? "▼" : "▶"}</Text>
              </View>
            </Pressable>
            <Pressable
              style={[styles.superHeaderCell, macroOpen.lealta ? styles.superLealta : styles.superMacroCollapsed]}
              onPress={() => toggleMacro("lealta")}
            >
              <View style={styles.superHeaderInner}>
                <Text style={styles.superHeaderText} numberOfLines={1}>Lealtà</Text>
                <Text style={styles.superHeaderArrow}>{macroOpen.lealta ? "▼" : "▶"}</Text>
              </View>
            </Pressable>
            <Pressable
              style={[styles.superHeaderCell, macroOpen.sociale ? styles.superSociale : styles.superMacroCollapsed]}
              onPress={() => toggleMacro("sociale")}
            >
              <View style={styles.superHeaderInner}>
                <Text style={styles.superHeaderText} numberOfLines={1}>Sociale</Text>
                <Text style={styles.superHeaderArrow}>{macroOpen.sociale ? "▼" : "▶"}</Text>
              </View>
            </Pressable>
            <Pressable
              style={[styles.superHeaderCell, macroOpen.religioneFazioni ? styles.superReligioneFazioni : styles.superMacroCollapsed]}
              onPress={() => toggleMacro("religioneFazioni")}
            >
              <View style={styles.superHeaderInner}>
                <Text style={styles.superHeaderText} numberOfLines={1}>Religione e fazioni</Text>
                <Text style={styles.superHeaderArrow}>{macroOpen.religioneFazioni ? "▼" : "▶"}</Text>
              </View>
            </Pressable>
          </View>

          {/* Header della tabella */}
          <View style={styles.tableHeader}>
            <View style={[styles.headerCell, styles.cellEmoji]}>
              <Text style={styles.headerText}>😊</Text>
            </View>
            {macroOpen.anagrafica && (
              <>
                <Pressable style={[styles.headerCell, styles.cellNome, sortField === "nome" && styles.headerCellActive]} onPress={() => handleSort("nome")}>
                  <Text style={styles.headerText}>👤 Nome</Text>
                  {sortField === "nome" && <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>}
                </Pressable>
                <Pressable style={[styles.headerCell, styles.cellSmall, sortField === "eta" && styles.headerCellActive]} onPress={() => handleSort("eta")}>
                  <Text style={styles.headerText}>🎂 Età</Text>
                  {sortField === "eta" && <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>}
                </Pressable>
                <Pressable style={[styles.headerCell, styles.cellLavoro, sortField === "lavoro" && styles.headerCellActive]} onPress={() => handleSort("lavoro")}>
                  <Text style={styles.headerText}>💼 Lavoro</Text>
                  {sortField === "lavoro" && <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>}
                </Pressable>
                <Pressable style={[styles.headerCell, styles.cellRazza, sortField === "razza" && styles.headerCellActive]} onPress={() => handleSort("razza")}>
                  <Text style={styles.headerText}>🪐 Razza</Text>
                  {sortField === "razza" && <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>}
                </Pressable>
                <Pressable style={[styles.headerCell, styles.cellResidenza, sortField === "residenza" && styles.headerCellActive]} onPress={() => handleSort("residenza")}>
                  <Text style={styles.headerText}>🏠 Residenza</Text>
                  {sortField === "residenza" && <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>}
                </Pressable>
                <Pressable style={[styles.headerCell, styles.cellSmall, sortField === "sesso" && styles.headerCellActive]} onPress={() => handleSort("sesso")}>
                  <Text style={styles.headerText}>⚧ Sesso</Text>
                  {sortField === "sesso" && <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>}
                </Pressable>
                <Pressable style={[styles.headerCell, styles.cellOrientamento, sortField === "orientamento" && styles.headerCellActive]} onPress={() => handleSort("orientamento")}>
                  <Text style={styles.headerText}>💕 Orient.</Text>
                  {sortField === "orientamento" && <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>}
                </Pressable>
              </>
            )}
            {macroOpen.prestazioni && (
              <>
                <Pressable style={[styles.headerCell, styles.cellSmall, sortField === "competenza" && styles.headerCellActive]} onPress={() => handleSort("competenza")}>
                  <Text style={styles.headerText}>⭐ Comp.</Text>
                  {sortField === "competenza" && <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>}
                </Pressable>
                <Pressable style={[styles.headerCell, styles.cellSmall, sortField === "produttività" && styles.headerCellActive]} onPress={() => handleSort("produttività")}>
                  <Text style={styles.headerText}>⚡ Prod.</Text>
                  {sortField === "produttività" && <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>}
                </Pressable>
                <Pressable style={[styles.headerCell, styles.cellSmall, sortField === "stanchezza" && styles.headerCellActive]} onPress={() => handleSort("stanchezza")}>
                  <Text style={styles.headerText}>😴 Stan.</Text>
                  {sortField === "stanchezza" && <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>}
                </Pressable>
              </>
            )}
            {macroOpen.benessere && (
              <>
                <Pressable style={[styles.headerCell, styles.cellSmall, sortField === "peso" && styles.headerCellActive]} onPress={() => handleSort("peso")}>
                  <Text style={styles.headerText}>⚖️ Peso</Text>
                  {sortField === "peso" && <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>}
                </Pressable>
                <Pressable style={[styles.headerCell, styles.cellSmall, sortField === "salute" && styles.headerCellActive]} onPress={() => handleSort("salute")}>
                  <Text style={styles.headerText}>🏥 Salute</Text>
                  {sortField === "salute" && <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>}
                </Pressable>
                <Pressable style={[styles.headerCell, styles.cellSmall, sortField === "felicità" && styles.headerCellActive]} onPress={() => handleSort("felicità")}>
                  <Text style={styles.headerText}>😊 Felicità</Text>
                  {sortField === "felicità" && <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>}
                </Pressable>
                <Pressable style={[styles.headerCell, styles.cellSmall, sortField === "paura" && styles.headerCellActive]} onPress={() => handleSort("paura")}>
                  <Text style={styles.headerText}>😨 Paura</Text>
                  {sortField === "paura" && <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>}
                </Pressable>
              </>
            )}
            {macroOpen.economia && (
              <>
                <Pressable style={[styles.headerCell, styles.cellMedium, sortField === "crediti" && styles.headerCellActive]} onPress={() => handleSort("crediti")}>
                  <Text style={styles.headerText}>💰 Crediti</Text>
                  {sortField === "crediti" && <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>}
                </Pressable>
                <Pressable style={[styles.headerCell, styles.cellMedium, sortField === "reddito" && styles.headerCellActive]} onPress={() => handleSort("reddito")}>
                  <Text style={styles.headerText}>📈 Reddito</Text>
                  {sortField === "reddito" && <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>}
                </Pressable>
                <Pressable style={[styles.headerCell, styles.cellMedium, sortField === "spese" && styles.headerCellActive]} onPress={() => handleSort("spese")}>
                  <Text style={styles.headerText}>📉 Spese</Text>
                  {sortField === "spese" && <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>}
                </Pressable>
              </>
            )}
            {macroOpen.lealta && (
              <Pressable style={[styles.headerCell, styles.cellSmall, sortField === "lealtà" && styles.headerCellActive]} onPress={() => handleSort("lealtà")}>
                <Text style={styles.headerText}>❤️ Lealtà</Text>
                {sortField === "lealtà" && <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>}
              </Pressable>
            )}
            {macroOpen.sociale && (
              <>
                <Pressable style={[styles.headerCell, styles.cellSociale, sortField === "amici" && styles.headerCellActive]} onPress={() => handleSort("amici")}>
                  <Text style={styles.headerText}>👥 Amici</Text>
                  {sortField === "amici" && <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>}
                </Pressable>
                <Pressable style={[styles.headerCell, styles.cellSociale, sortField === "rivali" && styles.headerCellActive]} onPress={() => handleSort("rivali")}>
                  <Text style={styles.headerText}>⚔️ Rivali</Text>
                  {sortField === "rivali" && <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>}
                </Pressable>
                <Pressable style={[styles.headerCell, styles.cellFamiliari, sortField === "familiari" && styles.headerCellActive]} onPress={() => handleSort("familiari")}>
                  <Text style={styles.headerText}>👨‍👩‍👧‍👦 Familiari</Text>
                  {sortField === "familiari" && <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>}
                </Pressable>
              </>
            )}
            {macroOpen.religioneFazioni && (
              <Pressable style={[styles.headerCell, styles.cellFazione, sortField === "fazioni" && styles.headerCellActive]} onPress={() => handleSort("fazioni")}>
                <Text style={styles.headerText}>⚔️ Fazione</Text>
                {sortField === "fazioni" && <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>}
              </Pressable>
            )}
          </View>

          {/* Righe della tabella */}
          {abitantiOrdinati.map((a: Abitante) => {
            const felicitàModificata = calcolaFelicitàModificata(a);
            const emojiDisplay = getEmojiDisplay(a, etaMinimaLavoro);
            const lavoroDisplay = getLavoroDisplay(a, etaMinimaLavoro);
            const statoSalute = getStatoSalute(a);
            const saluteStyle =
              statoSalute === "Sano"
                ? styles.cellTextSaluteSano
                : statoSalute === "Sovrappeso" || statoSalute === "Denutrito"
                ? styles.cellTextSaluteGiallo
                : statoSalute === "Obeso"
                ? styles.cellTextSaluteObeso
                : undefined;
            return (
              <Pressable
                key={a.id}
                style={styles.tableRow}
                onPress={() => setSelectedAbitante(a)}
              >
                <View style={[styles.cell, styles.cellEmoji]}>
                  <Text style={styles.cellEmojiText}>{emojiDisplay}</Text>
                </View>
                {macroOpen.anagrafica && (
                  <>
                    <View style={[styles.cell, styles.cellNome]}><Text style={styles.cellText}>{a.nome}</Text></View>
                    <View style={[styles.cell, styles.cellSmall]}><Text style={styles.cellText}>{a.eta}</Text></View>
                    <View style={[styles.cell, styles.cellLavoro]}>
                      <Text style={[styles.cellTextSmall, lavoroDisplay === "Disoccupato" && styles.cellTextDisoccupato]}>{lavoroDisplay}</Text>
                    </View>
                    <View style={[styles.cell, styles.cellRazza]}>
                      <Text style={styles.cellEmojiText}>{getEmojiRazza(a.razza ?? "Umano")}</Text>
                    </View>
                    <View style={[styles.cell, styles.cellResidenza]}>
                      <Text style={styles.cellTextSmall}>{getResidenzaAbitante(a.id, edifici)}</Text>
                    </View>
                    <View style={[styles.cell, styles.cellSmall]}>
                      <Text style={styles.cellEmojiText}>{a.sesso === "M" ? "♂️" : a.sesso === "F" ? "♀️" : "—"}</Text>
                    </View>
                    <View style={[styles.cell, styles.cellOrientamento]}>
                      <Text
                        style={[
                          styles.cellTextSmall,
                          a.orientamento === "Etero" && styles.cellTextOrientamentoEtero,
                          a.orientamento === "Bi" && styles.cellTextOrientamentoBi,
                          a.orientamento === "Omo" && styles.cellTextOrientamentoOmo
                        ]}
                      >
                        {a.orientamento ?? "—"}
                      </Text>
                    </View>
                  </>
                )}
                {macroOpen.prestazioni && (
                  <>
                    <View style={[styles.cell, styles.cellSmall]}><Text style={styles.cellText}>{a.competenza}%</Text></View>
                    <View style={[styles.cell, styles.cellSmall]}><Text style={styles.cellText}>{a.produttività}%</Text></View>
                    <View style={[styles.cell, styles.cellSmall]}><Text style={styles.cellText}>{a.stanchezza}%</Text></View>
                  </>
                )}
                {macroOpen.benessere && (
                  <>
                    <View style={[styles.cell, styles.cellSmall]}><Text style={styles.cellText}>{a.peso ?? 50}</Text></View>
                    <View style={[styles.cell, styles.cellSmall]}><Text style={[styles.cellTextSmall, saluteStyle]}>{statoSalute}</Text></View>
                    <View style={[styles.cell, styles.cellSmall]}>
                      <Text style={[styles.cellText, felicitàModificata >= 70 ? styles.cellTextPositive : felicitàModificata >= 40 ? styles.cellTextNeutral : styles.cellTextNegative]}>{felicitàModificata}%</Text>
                    </View>
                    <View style={[styles.cell, styles.cellSmall]}><Text style={styles.cellText}>{a.paura}%</Text></View>
                  </>
                )}
                {macroOpen.economia && (
                  <>
                    <View style={[styles.cell, styles.cellMedium]}><Text style={styles.cellText}>{a.crediti}</Text></View>
                    <View style={[styles.cell, styles.cellMedium]}><Text style={[styles.cellText, styles.cellTextPositive]}>{a.reddito}</Text></View>
                    <View style={[styles.cell, styles.cellMedium]}><Text style={[styles.cellText, styles.cellTextNegative]}>{a.spese}</Text></View>
                  </>
                )}
                {macroOpen.lealta && (
                  <View style={[styles.cell, styles.cellSmall]}><Text style={styles.cellText}>{a.lealtà}%</Text></View>
                )}
                {macroOpen.sociale && (
                  <>
                    <View style={[styles.cell, styles.cellSociale]}>
                      {getAmiciItems(a).length > 0 ? (
                        <View style={styles.fazioneEmojiRow}>
                          {getAmiciItems(a).map((item, idx) => (
                            <EmojiWithTooltip key={idx} emoji={item.emoji} nome={item.nome} />
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.cellEmojiText}>—</Text>
                      )}
                    </View>
                    <View style={[styles.cell, styles.cellSociale]}>
                      {getRivaliItems(a).length > 0 ? (
                        <View style={styles.fazioneEmojiRow}>
                          {getRivaliItems(a).map((item, idx) => (
                            <EmojiWithTooltip key={idx} emoji={item.emoji} nome={item.nome} />
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.cellEmojiText}>—</Text>
                      )}
                    </View>
                    <View style={[styles.cell, styles.cellFamiliari]}>
                      {getFamiliariItems(a).length > 0 ? (
                        <View style={styles.fazioneEmojiRow}>
                          {getFamiliariItems(a).map((item, idx) => (
                            <EmojiWithTooltip key={idx} emoji={item.emoji} nome={item.nome} />
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.cellEmojiText}>—</Text>
                      )}
                    </View>
                  </>
                )}
                {macroOpen.religioneFazioni && (
                  <View style={[styles.cell, styles.cellFazione]}>
                    {getFazioniConReligione(a).length > 0 ? (
                      <View style={styles.fazioneEmojiRow}>
                        {getFazioniConReligione(a).map((item, idx) => (
                          <EmojiWithTooltip key={idx} emoji={item.emoji} nome={item.nome} />
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.cellEmojiText}>—</Text>
                    )}
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </ScrollView>

      <AbitanteInfoModal
        visible={selectedAbitante !== null}
        abitante={selectedAbitante}
        onClose={() => setSelectedAbitante(null)}
        getAbitanteNome={getAbitanteNome}
        calcolaFelicitàModificata={calcolaFelicitàModificata}
        etaMinimaLavoro={etaMinimaLavoro}
      />
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
  tableContainer: {
    flexGrow: 1
  },
  content: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    paddingBottom: 6
  },
  superHeaderRow: {
    flexDirection: "row",
    backgroundColor: "rgba(30,58,138,0.5)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(59,130,246,0.5)",
    marginBottom: 0
  },
  superHeaderCell: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "rgba(148,163,184,0.4)",
    justifyContent: "center",
    alignItems: "center"
  },
  superHeaderText: {
    color: "rgba(191,219,254,0.95)",
    fontSize: 8,
    fontWeight: "700",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.3
  },
  superHeaderArrow: {
    color: "rgba(191,219,254,0.8)",
    fontSize: 8,
    marginLeft: 2
  },
  superHeaderInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center"
  },
  superMacroCollapsed: {
    width: 48,
    minWidth: 48
  },
  superEmoji: {
    width: 40,
    minWidth: 40
  },
  superAnagrafica: {
    width: 520,
    minWidth: 520
  },
  superPrestazioni: {
    width: 150,
    minWidth: 150
  },
  superBenessere: {
    width: 200,
    minWidth: 200
  },
  superEconomia: {
    width: 210,
    minWidth: 210
  },
  superLealta: {
    width: 50,
    minWidth: 50
  },
  superSociale: {
    width: 450,
    minWidth: 450
  },
  superReligioneFazioni: {
    width: 210,
    minWidth: 210
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "rgba(59,130,246,0.2)",
    borderBottomWidth: 2,
    borderBottomColor: "#3b82f6",
    marginBottom: 4
  },
  headerCell: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "rgba(148,163,184,0.3)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 2
  },
  headerCellActive: {
    backgroundColor: "rgba(59,130,246,0.3)"
  },
  headerText: {
    color: "#93c5fd",
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center"
  },
  sortIndicator: {
    color: "#3b82f6",
    fontSize: 10,
    fontWeight: "700"
  },
  tableRow: {
    flexDirection: "row",
    backgroundColor: "rgba(15,23,42,0.6)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.2)",
    minHeight: 32
  },
  cell: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "rgba(148,163,184,0.2)",
    justifyContent: "center",
    alignItems: "center"
  },
  cellEmoji: {
    width: 40,
    minWidth: 40
  },
  cellNome: {
    width: 140,
    minWidth: 140
  },
  cellLavoro: {
    width: 120,
    minWidth: 120
  },
  cellRazza: {
    width: 40,
    minWidth: 40
  },
  cellResidenza: {
    width: 100,
    minWidth: 100
  },
  cellOrientamento: {
    width: 60,
    minWidth: 60
  },
  cellSmall: {
    width: 50,
    minWidth: 50
  },
  cellMedium: {
    width: 70,
    minWidth: 70
  },
  cellSociale: {
    width: 120,
    minWidth: 120
  },
  cellFamiliari: {
    width: 200,
    minWidth: 200
  },
  cellFazione: {
    width: 140,
    minWidth: 140
  },
  fazioneEmojiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    justifyContent: "center",
    alignItems: "center"
  },
  tooltipWrap: {
    position: "relative"
  },
  tooltipBox: {
    position: "absolute",
    bottom: "100%",
    left: 0,
    marginBottom: 2,
    backgroundColor: "#1e293b",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)",
    zIndex: 10
  },
  tooltipText: {
    color: "#e2e8f0",
    fontSize: 10,
    fontWeight: "600"
  },
  cellEmojiText: {
    fontSize: 20
  },
  cellText: {
    color: "#e5e7eb",
    fontSize: 9,
    textAlign: "center"
  },
  cellTextSmall: {
    color: "#e5e7eb",
    fontSize: 8,
    textAlign: "center"
  },
  cellTextDisoccupato: {
    color: "#ef4444",
    fontWeight: "700"
  },
  cellTextPositive: {
    color: "#4ade80"
  },
  cellTextNegative: {
    color: "#ef4444"
  },
  cellTextNeutral: {
    color: "#fde047"
  },
  cellTextSaluteSano: {
    color: "#4ade80",
    fontWeight: "700"
  },
  cellTextSaluteGiallo: {
    color: "#fde047",
    fontWeight: "700"
  },
  cellTextSaluteObeso: {
    color: "#ef4444",
    fontWeight: "700"
  },
  cellTextOrientamentoEtero: {
    color: "#22c55e",
    fontWeight: "700"
  },
  cellTextOrientamentoBi: {
    color: "#eab308",
    fontWeight: "700"
  },
  cellTextOrientamentoOmo: {
    color: "#ef4444",
    fontWeight: "700"
  }
});
