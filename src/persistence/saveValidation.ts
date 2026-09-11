import type { Abitante, Edificio, Risorsa } from "../types";
import { SAVE_FORMAT, SAVE_SCHEMA_VERSION, type GameSaveV1, type SaveEnvelopeV1 } from "./saveTypes.ts";
import { generaAspettoDaSeed } from "../game/personaggioAspetto";
import { getAlimentazioneAbitante } from "../game/alimentazione";
import { normalizeCharacterAppearance } from "../character-system/appearance";
import { normalizzaColtureSerraSbloccate } from "../game/colturaSerra";
import { normalizzaReligioniCustom } from "../game/fedeleCulto";
import { creaInventarioEmporioIniziale } from "../game/emporioVendita";
import { seedCassaImpresaSeMancante } from "../game/impresaCassa";
import { edificiData } from "../data/edificiData";

export class SaveValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaveValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) throw new SaveValidationError(`${path} deve essere un oggetto.`);
  return value;
}

function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new SaveValidationError(`${path} deve essere un array.`);
  return value;
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) throw new SaveValidationError(`${path} non è valido.`);
  return value;
}

function requireFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new SaveValidationError(`${path} deve essere finito.`);
  return value;
}

function requireInteger(value: unknown, path: string): number {
  const n = requireFiniteNumber(value, path);
  if (!Number.isInteger(n)) throw new SaveValidationError(`${path} deve essere intero.`);
  return n;
}

function assertUniqueIds(rows: unknown[], path: string): Set<number> {
  const ids = new Set<number>();
  rows.forEach((row, index) => {
    const id = requireInteger(requireRecord(row, `${path}[${index}]`).id, `${path}[${index}].id`);
    if (ids.has(id)) throw new SaveValidationError(`${path} contiene l'ID duplicato ${id}.`);
    ids.add(id);
  });
  return ids;
}

function assertOptionalResidentId(value: unknown, ids: Set<number>, path: string): void {
  if (value == null) return;
  const id = requireInteger(value, path);
  if (!ids.has(id)) throw new SaveValidationError(`${path} fa riferimento a un abitante inesistente.`);
}

function assertResidentIdArray(value: unknown, ids: Set<number>, path: string): void {
  if (value == null) return;
  requireArray(value, path).forEach((id, index) => assertOptionalResidentId(id, ids, `${path}[${index}]`));
}

function validateReferences(payload: Record<string, unknown>): void {
  const population = requireRecord(payload.population, "payload.population");
  const colony = requireRecord(payload.colony, "payload.colony");
  const events = requireRecord(payload.events, "payload.events");
  const map = requireRecord(payload.map, "payload.map");
  const abitanti = requireArray(population.abitanti, "payload.population.abitanti");
  const abitantiIds = assertUniqueIds(abitanti, "payload.population.abitanti");
  assertUniqueIds(requireArray(population.abitantiProposti, "payload.population.abitantiProposti"), "payload.population.abitantiProposti");

  abitanti.forEach((raw, index) => {
    const a = requireRecord(raw, `payload.population.abitanti[${index}]`);
    assertOptionalResidentId(a.coniugeId, abitantiIds, `abitanti[${index}].coniugeId`);
    assertOptionalResidentId(a.schiavistaId, abitantiIds, `abitanti[${index}].schiavistaId`);
    assertResidentIdArray(a.figliIds, abitantiIds, `abitanti[${index}].figliIds`);
    assertResidentIdArray(a.figliAdottatiIds, abitantiIds, `abitanti[${index}].figliAdottatiIds`);
    assertResidentIdArray(a.genitoriIds, abitantiIds, `abitanti[${index}].genitoriIds`);
    assertResidentIdArray(a.genitoriAdottiviIds, abitantiIds, `abitanti[${index}].genitoriAdottiviIds`);
    assertResidentIdArray(a.nonniIds, abitantiIds, `abitanti[${index}].nonniIds`);
  });

  const edifici = requireArray(colony.edifici, "payload.colony.edifici");
  const edificiIds = assertUniqueIds(edifici, "payload.colony.edifici");
  edifici.forEach((raw, index) => {
    const e = requireRecord(raw, `payload.colony.edifici[${index}]`);
    assertResidentIdArray(e.abitantiAssegnati, abitantiIds, `edifici[${index}].abitantiAssegnati`);
  });

  const risorse = requireArray(colony.risorse, "payload.colony.risorse");
  const risorseIds = assertUniqueIds(risorse, "payload.colony.risorse");
  requireArray(events.ordiniMercato, "payload.events.ordiniMercato").forEach((raw, index) => {
    const ordine = requireRecord(raw, `ordiniMercato[${index}]`);
    const risorsaId = requireInteger(ordine.risorsaId, `ordiniMercato[${index}].risorsaId`);
    if (!risorseIds.has(risorsaId)) throw new SaveValidationError(`L'ordine ${index} usa una risorsa inesistente.`);
  });

  for (const key of ["capoReligiosoSole", "capoReligiosoAlieni"] as const) {
    assertOptionalResidentId(events[key], abitantiIds, `payload.events.${key}`);
  }
  if (events.pendingMatrimonio != null) {
    const p = requireRecord(events.pendingMatrimonio, "payload.events.pendingMatrimonio");
    assertOptionalResidentId(p.idA, abitantiIds, "pendingMatrimonio.idA");
    assertOptionalResidentId(p.idB, abitantiIds, "pendingMatrimonio.idB");
  }
  if (events.pendingRichiestaLuogoCulto != null) {
    const p = requireRecord(events.pendingRichiestaLuogoCulto, "payload.events.pendingRichiestaLuogoCulto");
    assertOptionalResidentId(p.id, abitantiIds, "pendingRichiestaLuogoCulto.id");
  }
  requireArray(events.luoghiCultoPendentiMappa, "payload.events.luoghiCultoPendentiMappa").forEach((raw, index) => {
    const id = requireInteger(requireRecord(raw, `luoghiCultoPendentiMappa[${index}]`).edificioGlobaleId, `luoghiCultoPendentiMappa[${index}].edificioGlobaleId`);
    if (!edificiIds.has(id)) throw new SaveValidationError(`Il luogo di culto ${index} usa un edificio inesistente.`);
  });

  const edificiInMappa = requireRecord(map.edificiInMappa, "payload.map.edificiInMappa");
  Object.entries(edificiInMappa).forEach(([cell, raw]) => {
    requireInteger(Number(cell), `payload.map.edificiInMappa.${cell}`);
    const edificioGlobaleId = requireRecord(raw, `payload.map.edificiInMappa.${cell}`).edificioGlobaleId;
    if (edificioGlobaleId != null && !edificiIds.has(requireInteger(edificioGlobaleId, `edificioGlobaleId ${cell}`))) {
      throw new SaveValidationError(`La cella ${cell} usa un edificio globale inesistente.`);
    }
  });
}

function validateCoreValues(payload: Record<string, unknown>): void {
  const population = requireRecord(payload.population, "payload.population");
  requireInteger(population.nextId, "payload.population.nextId");
  requireInteger(population.nativiNonIntegrati, "payload.population.nativiNonIntegrati");

  const colony = requireRecord(payload.colony, "payload.colony");
  requireFiniteNumber(colony.moneteGiocatore, "payload.colony.moneteGiocatore");
  requireRecord(colony.inventarioMensaByEdificioId, "payload.colony.inventarioMensaByEdificioId");
  requireRecord(colony.prezzoResidenze, "payload.colony.prezzoResidenze");
  requireArray(colony.inventarioGiocatore, "payload.colony.inventarioGiocatore");
  requireArray(colony.risorse, "payload.colony.risorse").forEach((raw, index) => {
    requireFiniteNumber(requireRecord(raw, `risorse[${index}]`).quantità, `risorse[${index}].quantità`);
  });

  const calendar = requireRecord(payload.calendar, "payload.calendar");
  for (const key of ["mese", "anno", "giorno", "minutiDaMezzanotte"] as const) {
    requireInteger(calendar[key], `payload.calendar.${key}`);
  }
  if (typeof calendar.pausaManuale !== "boolean") throw new SaveValidationError("pausaManuale non è valida.");

  const cursors = requireRecord(payload.simulationCursors, "payload.simulationCursors");
  for (const key of ["ultimoGiornoPasti", "ultimoGiornoProduzioneSerra", "ultimoGiornoEconomiaPubblica"] as const) {
    requireInteger(cursors[key], `payload.simulationCursors.${key}`);
  }

  const policies = requireRecord(payload.policies, "payload.policies");
  requireArray(policies.scaglioniConfig, "payload.policies.scaglioniConfig").forEach((raw, index) => {
    const row = requireRecord(raw, `scaglioniConfig[${index}]`);
    requireFiniteNumber(row.min, `scaglioniConfig[${index}].min`);
    if (row.max !== Infinity) requireFiniteNumber(row.max, `scaglioniConfig[${index}].max`);
    requireFiniteNumber(row.percentuale, `scaglioniConfig[${index}].percentuale`);
  });

  const events = requireRecord(payload.events, "payload.events");
  for (const key of ["eventiInCorso", "richiesteInAttesa", "luoghiCultoRifiutati", "diarioRighe"] as const) {
    requireArray(events[key], `payload.events.${key}`);
  }
  if (events.registrazioniEmporio != null) {
    requireArray(events.registrazioniEmporio, "payload.events.registrazioniEmporio");
  }
  const map = requireRecord(payload.map, "payload.map");
  for (const key of ["edificiInMappa", "terrenoInMappa", "decorazioniInMappa", "residenzeMappa"] as const) {
    requireRecord(map[key], `payload.map.${key}`);
  }
}

export function validateSaveEnvelope(value: unknown): asserts value is SaveEnvelopeV1 {
  const envelope = requireRecord(value, "save");
  if (envelope.format !== SAVE_FORMAT) throw new SaveValidationError("Formato salvataggio non riconosciuto.");
  if (typeof envelope.schemaVersion !== "number") throw new SaveValidationError("Versione salvataggio mancante.");
  if (envelope.schemaVersion > SAVE_SCHEMA_VERSION) throw new SaveValidationError("Il salvataggio proviene da una versione futura.");
  if (envelope.schemaVersion !== SAVE_SCHEMA_VERSION) throw new SaveValidationError("Versione salvataggio non supportata.");

  const metadata = requireRecord(envelope.metadata, "save.metadata");
  requireString(metadata.saveId, "save.metadata.saveId");
  requireString(metadata.gameVersion, "save.metadata.gameVersion");
  requireString(metadata.createdAt, "save.metadata.createdAt");
  requireString(metadata.updatedAt, "save.metadata.updatedAt");

  const payload = requireRecord(envelope.payload, "save.payload");
  const requiredRecords = ["population", "colony", "calendar", "simulationCursors", "policies", "events", "map"];
  requiredRecords.forEach((key) => requireRecord(payload[key], `save.payload.${key}`));
  if (!["commander-creation", "activating", "running"].includes(String(payload.gamePhase))) {
    throw new SaveValidationError("Fase di gioco non valida.");
  }
  if (typeof payload.introductionCompleted !== "boolean" || typeof payload.diarioInizioVisto !== "boolean") {
    throw new SaveValidationError("Stato dell'introduzione non valido.");
  }
  if (payload.introConsigliereVisto != null && typeof payload.introConsigliereVisto !== "boolean") {
    throw new SaveValidationError("Stato intro Consigliere non valido.");
  }
  validateCoreValues(payload);
  validateReferences(payload);
}

function clampNonNegative(value: number): number {
  return Math.max(0, value);
}

function cloneSaveValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => cloneSaveValue(item)) as T;
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneSaveValue(item)])) as T;
  }
  return value;
}

export function normalizeGameSave(payload: GameSaveV1): GameSaveV1 {
  const next = cloneSaveValue(payload);
  if (typeof next.introConsigliereVisto !== "boolean") {
    next.introConsigliereVisto = next.diarioInizioVisto === true;
  }
  const normalizzaRazzaFantasy = (razza: unknown): Abitante["razza"] => {
    if (razza === "Robot") return "Golem";
    if (razza === "Grigi" || razza === "Insettoidi") return "Goblin";
    if (razza === "Nordici" || razza === "Marini") return "Elfo";
    if (razza === "Rettiliani" || razza === "Ferini") return "Orco";
    return razza as Abitante["razza"];
  };
  next.calendar.mese = Math.min(12, Math.max(1, Math.trunc(next.calendar.mese)));
  next.calendar.anno = clampNonNegative(Math.trunc(next.calendar.anno));
  next.calendar.giorno = Math.max(1, Math.trunc(next.calendar.giorno));
  next.calendar.minutiDaMezzanotte = ((Math.trunc(next.calendar.minutiDaMezzanotte) % 1440) + 1440) % 1440;
  next.population.nextId = Math.max(1, Math.trunc(next.population.nextId));
  next.population.nativiNonIntegrati = clampNonNegative(Math.trunc(next.population.nativiNonIntegrati));
  next.population.razzaNativi = normalizzaRazzaFantasy(next.population.razzaNativi) ?? "Elfo";
  next.colony.moneteGiocatore = clampNonNegative(next.colony.moneteGiocatore);
  next.colony.risorse = next.colony.risorse
    .filter(
      (r: Risorsa) =>
        r.nome !== "Acqua potabile" && !r.nome.toLowerCase().includes("acqua potabile")
    )
    .map((r: Risorsa) => ({ ...r, quantità: clampNonNegative(r.quantità) }));
  const risorseIdsValidi = new Set(next.colony.risorse.map((r: Risorsa) => r.id));
  if (Array.isArray(next.events?.ordiniMercato)) {
    next.events.ordiniMercato = next.events.ordiniMercato.filter(
      (o: { risorsaId?: number }) =>
        o?.risorsaId != null && risorseIdsValidi.has(o.risorsaId)
    );
  }
  next.colony.edifici = next.colony.edifici
    .map((e: Edificio) => {
    const eraCentroComando = e.nome === "Centro di Comando" || e.id === 1;
    const eraMiniera =
      e.nome === "Raffineria Mineraria" || e.nome === "Giacimento" || e.id === 3;
    const nomeMigrato =
      e.nome === "Spazioporto"
        ? "Porto"
        : e.nome === "Hangar di Manutenzione"
          ? "Remessa dei Carri"
          : e.nome === "Luogo di Culto degli Alieni"
            ? "Luogo di Culto delle Ombre"
            : e.nome;
    // Dissalatore / Acquedotto / Centrale Energetica rimossi dal gioco.
    if (
      e.nome === "Dissalatore" ||
      e.nome === "Acquedotto" ||
      nomeMigrato === "Acquedotto" ||
      e.nome === "Centrale Energetica"
    ) {
      return null;
    }
    const emojiMigrato =
      nomeMigrato === "Porto"
        ? "⚓"
        : nomeMigrato === "Remessa dei Carri"
          ? "🐴"
          : nomeMigrato === "Luogo di Culto delle Ombre"
            ? "🌑"
            : undefined;
    return {
      ...e,
      ...(eraCentroComando ? { nome: "Castello", emoji: "🏰" } : {}),
      ...(eraMiniera && !eraCentroComando ? { nome: "Miniera", emoji: "⛏️" } : {}),
      ...(!eraCentroComando && nomeMigrato !== e.nome
        ? { nome: nomeMigrato, ...(emojiMigrato ? { emoji: emojiMigrato } : {}) }
        : {}),
      capacità:
        e.nome === "Bosco" || nomeMigrato === "Bosco"
          ? Math.max(20, clampNonNegative(Math.trunc(e.capacità)))
          : clampNonNegative(Math.trunc(e.capacità)),
      abitantiAssegnati: [...new Set(e.abitantiAssegnati)],
      occupazione: new Set(e.abitantiAssegnati).size,
      ...(e.progressoCostruzione == null
        ? {}
        : { progressoCostruzione: Math.min(100, clampNonNegative(e.progressoCostruzione)) })
    };
  })
    .filter((e): e is Edificio => e != null);

  // Emporio obbligatorio: se manca nel salvataggio (partite Avventura vecchie), aggiungilo.
  if (!next.colony.edifici.some((e: Edificio) => e.nome === "Emporio")) {
    const template = edificiData.find((e) => e.nome === "Emporio" && e.id === 35);
    if (template) {
      const idsUsati = new Set(next.colony.edifici.map((e: Edificio) => e.id));
      let id = template.id;
      while (idsUsati.has(id)) id += 1;
      next.colony.edifici.push(
        seedCassaImpresaSeMancante({
          ...template,
          id,
          abitantiAssegnati: [],
          occupazione: 0,
          stato: "Operativo"
        })
      );
    }
  }

  // Ufficio Edile obbligatorio (cantieri / Ponte): migrazione partite vecchie.
  if (!next.colony.edifici.some((e: Edificio) => e.nome === "Ufficio Edile")) {
    const template = edificiData.find((e) => e.nome === "Ufficio Edile" && e.id === 33);
    if (template) {
      const idsUsati = new Set(next.colony.edifici.map((e: Edificio) => e.id));
      let id = template.id;
      while (idsUsati.has(id)) id += 1;
      next.colony.edifici.push({
        ...template,
        id,
        abitantiAssegnati: [],
        occupazione: 0,
        stato: "Operativo"
      });
    }
  }

  const normalizeInventario = (inv: { itemId: string; quantità: number }[]) =>
    inv.map((v) => ({ ...v, quantità: clampNonNegative(v.quantità) }));
  next.colony.inventarioGiocatore = normalizeInventario(next.colony.inventarioGiocatore);
  Object.keys(next.colony.inventarioMensaByEdificioId).forEach((key) => {
    next.colony.inventarioMensaByEdificioId[Number(key)] = normalizeInventario(next.colony.inventarioMensaByEdificioId[Number(key)] ?? []);
  });
  if (
    next.colony.inventarioEmporioByEdificioId == null ||
    typeof next.colony.inventarioEmporioByEdificioId !== "object"
  ) {
    next.colony.inventarioEmporioByEdificioId = {};
  }
  Object.keys(next.colony.inventarioEmporioByEdificioId).forEach((key) => {
    next.colony.inventarioEmporioByEdificioId![Number(key)] = normalizeInventario(
      next.colony.inventarioEmporioByEdificioId![Number(key)] ?? []
    );
  });
  // Scorte cibo Emporio: se Emporio presente ma inventario vuoto, semina scorte iniziali.
  {
    const emporio = next.colony.edifici.find(
      (e: Edificio) => e.nome === "Emporio" && e.stato === "Operativo"
    );
    if (emporio) {
      const inv = next.colony.inventarioEmporioByEdificioId[emporio.id];
      const tot = (inv ?? []).reduce((s, v) => s + (v.quantità ?? 0), 0);
      if (!inv || tot <= 0) {
        const coltura =
          next.colony.edifici.find((e: Edificio) => e.nome === "Serra")?.colturaItemId;
        next.colony.inventarioEmporioByEdificioId[emporio.id] = creaInventarioEmporioIniziale(coltura);
      }
    }
  }
  next.population.abitanti = next.population.abitanti.map((a: Abitante) => {
    const razza = normalizzaRazzaFantasy(a.razza);
    let aspetto = a.aspetto;
    if (!aspetto && razza !== "Golem") {
      aspetto = generaAspettoDaSeed((razza ?? "Umano") as "Umano" | "Elfo" | "Nano" | "Orco" | "Goblin", a.id);
    }
    if (a.id !== 1 && aspetto?.cappello === "corona") {
      aspetto = { ...aspetto, cappello: "nessuno" };
    }
    // I Nani devono sempre usare il corpo LPC child (come nella pagina Razze).
    if (razza === "Nano" && aspetto?.characterAppearance) {
      aspetto = {
        ...aspetto,
        characterAppearance: normalizeCharacterAppearance({
          ...aspetto.characterAppearance,
          race: "dwarf"
        })
      };
    }
    return {
      ...a,
      alimentazione: getAlimentazioneAbitante(a),
      ...((a.personalità === "Vegetariano" || a.personalità === "Vegano") && { personalità: "Tiepido" }),
      razza,
      ...((a.religione as string) === "Culto degli Alieni" && {
        religione: "Culto delle Ombre" as Abitante["religione"]
      }),
      ...(aspetto && { aspetto }),
      fazioni: a.fazioni?.map((f) =>
        f === "Robots" ? "Golem" : f === "Culto degli Alieni" ? "Culto delle Ombre" : f
      ),
      inventario: a.inventario ? normalizeInventario(a.inventario) : undefined
    };
  });
  next.population.abitantiProposti = next.population.abitantiProposti.map((a: Abitante) => {
    const razza = normalizzaRazzaFantasy(a.razza);
    let aspetto = a.aspetto;
    if (!aspetto && razza !== "Golem") {
      aspetto = generaAspettoDaSeed((razza ?? "Umano") as "Umano" | "Elfo" | "Nano" | "Orco" | "Goblin", a.id);
    }
    if (aspetto?.cappello === "corona") {
      aspetto = { ...aspetto, cappello: "nessuno" };
    }
    if (razza === "Nano" && aspetto?.characterAppearance) {
      aspetto = {
        ...aspetto,
        characterAppearance: normalizeCharacterAppearance({
          ...aspetto.characterAppearance,
          race: "dwarf"
        })
      };
    }
    return {
      ...a,
      alimentazione: getAlimentazioneAbitante(a),
      ...((a.personalità === "Vegetariano" || a.personalità === "Vegano") && { personalità: "Tiepido" }),
      razza,
      ...((a.religione as string) === "Culto degli Alieni" && {
        religione: "Culto delle Ombre" as Abitante["religione"]
      }),
      ...(aspetto && { aspetto }),
      fazioni: a.fazioni?.map((f) =>
        f === "Robots" ? "Golem" : f === "Culto degli Alieni" ? "Culto delle Ombre" : f
      )
    };
  });
  next.policies.razzaCampoLavoro = normalizzaRazzaFantasy(next.policies.razzaCampoLavoro) ?? null;
  next.policies.razzaCampoSterminio = normalizzaRazzaFantasy(next.policies.razzaCampoSterminio) ?? null;
  if ((next.policies.religioneDiStato as string) === "Culto degli Alieni") {
    next.policies.religioneDiStato = "Culto delle Ombre";
  }
  next.policies.religioniCustom = normalizzaReligioniCustom(next.policies.religioniCustom);
  if (
    next.policies.tassaPatrimonioPercentuale == null ||
    typeof next.policies.tassaPatrimonioPercentuale !== "number" ||
    !Number.isFinite(next.policies.tassaPatrimonioPercentuale)
  ) {
    next.policies.tassaPatrimonioPercentuale = 5;
  } else {
    next.policies.tassaPatrimonioPercentuale = Math.min(
      100,
      Math.max(0, next.policies.tassaPatrimonioPercentuale)
    );
  }
  if (
    next.policies.ivaPercentuale == null ||
    typeof next.policies.ivaPercentuale !== "number" ||
    !Number.isFinite(next.policies.ivaPercentuale)
  ) {
    next.policies.ivaPercentuale = 10;
  } else {
    next.policies.ivaPercentuale = Math.min(100, Math.max(0, next.policies.ivaPercentuale));
  }
  if (Array.isArray(next.events.luoghiCultoRifiutati)) {
    next.events.luoghiCultoRifiutati = next.events.luoghiCultoRifiutati.map((r: string) =>
      r === "Culto degli Alieni" ? "Culto delle Ombre" : r
    ) as typeof next.events.luoghiCultoRifiutati;
  }
  if (
    next.events.pendingRichiestaLuogoCulto &&
    (next.events.pendingRichiestaLuogoCulto.religione as string) === "Culto degli Alieni"
  ) {
    next.events.pendingRichiestaLuogoCulto = {
      ...next.events.pendingRichiestaLuogoCulto,
      religione: "Culto delle Ombre"
    };
  }
  if (next.map?.edificiInMappa) {
    next.map.edificiInMappa = Object.fromEntries(
      Object.entries(next.map.edificiInMappa).map(([cell, raw]) => {
        const ed = raw as { id: number; nome: string; emoji: string; edificioGlobaleId?: number; footprintRef?: number; footprint?: { w: number; h: number } };
        const eraCentroComando =
          ed.nome === "Centro di Comando" || ed.edificioGlobaleId === 1 || ed.id === 1;
        const eraMiniera =
          ed.nome === "Raffineria Mineraria" || ed.nome === "Giacimento" || ed.id === 3;
        const nomeMigrato =
          ed.nome === "Spazioporto"
            ? "Porto"
            : ed.nome === "Hangar di Manutenzione"
              ? "Remessa dei Carri"
              : ed.nome === "Luogo di Culto degli Alieni"
                ? "Luogo di Culto delle Ombre"
                : ed.nome;
        if (
          ed.nome === "Dissalatore" ||
          ed.nome === "Acquedotto" ||
          nomeMigrato === "Acquedotto" ||
          ed.nome === "Centrale Energetica"
        ) {
          return null;
        }
        const emojiMigrato =
          nomeMigrato === "Porto"
            ? "⚓"
            : nomeMigrato === "Remessa dei Carri"
              ? "🐴"
              : nomeMigrato === "Luogo di Culto delle Ombre"
                ? "🌑"
                : undefined;
        if (!eraCentroComando && !eraMiniera && nomeMigrato === ed.nome) return [cell, ed];
        const anchor = ed.footprint && !ed.footprintRef;
        if (eraCentroComando) {
          return [
            cell,
            {
              ...ed,
              nome: "Castello",
              ...(anchor && ed.emoji !== "" ? { emoji: "🏰" } : {})
            }
          ];
        }
        if (eraMiniera) {
          return [
            cell,
            {
              ...ed,
              id: ed.id === 0 ? 3 : ed.id,
              nome: "Miniera",
              ...(ed.emoji !== "" || !ed.footprintRef ? { emoji: ed.emoji === "" ? "" : "⛏️" } : {})
            }
          ];
        }
        return [
          cell,
          {
            ...ed,
            nome: nomeMigrato,
            ...(emojiMigrato && (ed.emoji !== "" || anchor) ? { emoji: ed.emoji === "" ? "" : emojiMigrato } : {})
          }
        ];
      }).filter((entry): entry is [string, { id: number; nome: string; emoji: string; edificioGlobaleId?: number; footprintRef?: number; footprint?: { w: number; h: number } }] => entry != null)
    );
  }

  const ev = next.events;
  if (ev.modalitaRe !== "nel_castello" && ev.modalitaRe !== "a_giro" && ev.modalitaRe !== "in_visita") {
    ev.modalitaRe = "nel_castello";
  }
  if (ev.edificioVisitaReId === undefined) ev.edificioVisitaReId = null;
  if (
    ev.edificioVisitaReId != null &&
    !next.colony.edifici.some((e: Edificio) => e.id === ev.edificioVisitaReId)
  ) {
    ev.edificioVisitaReId = null;
  }
  if (typeof ev.popolaritaRe !== "number" || !Number.isFinite(ev.popolaritaRe)) ev.popolaritaRe = 50;
  else ev.popolaritaRe = Math.max(0, Math.min(100, Math.round(ev.popolaritaRe)));
  if (typeof ev.mesiConsecutiviNelCastello !== "number") ev.mesiConsecutiviNelCastello = 0;
  else ev.mesiConsecutiviNelCastello = Math.max(0, Math.trunc(ev.mesiConsecutiviNelCastello));
  if (ev.faseDisordine !== "nessuna" && ev.faseDisordine !== "protesta" && ev.faseDisordine !== "ribellione") {
    ev.faseDisordine = "nessuna";
  }
  if (typeof ev.avvisoReAssenteEmesso !== "boolean") ev.avvisoReAssenteEmesso = false;
  if (!Array.isArray(ev.obiettiviCompletati)) ev.obiettiviCompletati = [];
  else ev.obiettiviCompletati = ev.obiettiviCompletati.filter((id: unknown) => typeof id === "string");

  {
    const modalita =
      next.modalitaGioco === "creativa" || next.modalitaGioco === "avventura"
        ? next.modalitaGioco
        : "avventura";
    const serra = (next.colony.edifici as Edificio[]).find((e) => e.nome === "Serra");
    ev.coltureSerraSbloccate = normalizzaColtureSerraSbloccate({
      sbloccate: ev.coltureSerraSbloccate,
      modalitaGioco: modalita,
      obiettiviCompletati: ev.obiettiviCompletati,
      colturaSerraCorrente: serra?.colturaItemId
    });
  }

  if (!Array.isArray(ev.registrazioniEmporio)) {
    ev.registrazioniEmporio = [];
  } else {
    ev.registrazioniEmporio = ev.registrazioniEmporio
      .filter((r: unknown) => r && typeof r === "object")
      .map((raw: Record<string, unknown>) => ({
        id: String(raw.id ?? ""),
        giorno: Math.max(1, Math.trunc(Number(raw.giorno) || 1)),
        minutiDaMezzanotte: Math.max(0, Math.trunc(Number(raw.minutiDaMezzanotte) || 0)),
        venditoreId: Math.trunc(Number(raw.venditoreId) || 0),
        venditoreNome: String(raw.venditoreNome ?? ""),
        mercanteId: Math.trunc(Number(raw.mercanteId) || 0),
        mercanteNome: String(raw.mercanteNome ?? ""),
        itemId: String(raw.itemId ?? ""),
        itemNome: String(raw.itemNome ?? ""),
        itemEmoji: String(raw.itemEmoji ?? "📦"),
        prezzoMonete: Math.max(0, Math.trunc(Number(raw.prezzoMonete) || 0)),
        emporioId: Math.trunc(Number(raw.emporioId) || 0)
      }))
      .filter((r: { id: string }) => r.id.length > 0)
      .slice(-100);
  }

  if (!Array.isArray(ev.registrazioniScambi)) {
    ev.registrazioniScambi = [];
  } else {
    ev.registrazioniScambi = ev.registrazioniScambi
      .filter((r: unknown) => r && typeof r === "object")
      .map((raw: Record<string, unknown>) => ({
        id: String(raw.id ?? ""),
        giorno: Math.max(1, Math.trunc(Number(raw.giorno) || 1)),
        minutiDaMezzanotte: Math.max(0, Math.trunc(Number(raw.minutiDaMezzanotte) || 0)),
        luogoEdificioId:
          raw.luogoEdificioId == null || raw.luogoEdificioId === ""
            ? null
            : Math.trunc(Number(raw.luogoEdificioId) || 0),
        luogoNome: String(raw.luogoNome ?? ""),
        daId:
          raw.daId == null || raw.daId === "" ? null : Math.trunc(Number(raw.daId) || 0),
        daNome: String(raw.daNome ?? ""),
        aId: raw.aId == null || raw.aId === "" ? null : Math.trunc(Number(raw.aId) || 0),
        aNome: String(raw.aNome ?? ""),
        itemId: String(raw.itemId ?? ""),
        itemNome: String(raw.itemNome ?? ""),
        itemEmoji: String(raw.itemEmoji ?? "📦"),
        prezzoMonete: Math.max(0, Math.trunc(Number(raw.prezzoMonete) || 0)),
        ...(raw.tipo === "raccolta" || raw.tipo === "scambio" ? { tipo: raw.tipo } : {})
      }))
      .filter((r: { id: string }) => r.id.length > 0)
      .slice(-200);
  }

  if (next.modalitaGioco !== "creativa" && next.modalitaGioco !== "avventura") {
    next.modalitaGioco = "avventura";
  }

  return next;
}
