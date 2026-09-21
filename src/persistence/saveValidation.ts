import type { Abitante, Edificio, Risorsa } from "../types";
import { SAVE_FORMAT, SAVE_SCHEMA_VERSION, type GameSaveV1, type SaveEnvelopeV1 } from "./saveTypes.ts";
import { generaAspettoDaSeed } from "../game/personaggioAspetto";
import { normalizeGameMode } from "../game/gameMode";

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
    assertResidentIdArray(a.genitoriIds, abitantiIds, `abitanti[${index}].genitoriIds`);
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
  if (colony.inventarioEmporioByEdificioId != null) {
    requireRecord(colony.inventarioEmporioByEdificioId, "payload.colony.inventarioEmporioByEdificioId");
  }
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
  if (events.registrazioniScambi != null) {
    requireArray(events.registrazioniScambi, "payload.events.registrazioniScambi");
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
  if (payload.gameMode != null && payload.gameMode !== "avventura" && payload.gameMode !== "creativa") {
    throw new SaveValidationError("Modalità di gioco non valida.");
  }
  const requiredRecords = ["population", "colony", "calendar", "simulationCursors", "policies", "events", "map"];
  requiredRecords.forEach((key) => requireRecord(payload[key], `save.payload.${key}`));
  if (!["commander-creation", "activating", "running"].includes(String(payload.gamePhase))) {
    throw new SaveValidationError("Fase di gioco non valida.");
  }
  if (typeof payload.introductionCompleted !== "boolean" || typeof payload.diarioInizioVisto !== "boolean") {
    throw new SaveValidationError("Stato dell'introduzione non valido.");
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
  next.gameMode = normalizeGameMode(next.gameMode);
  const senzaSpecieLegacy = (abitante: Abitante): Abitante => {
    const copia = { ...(abitante as Abitante & { specie?: unknown }) };
    delete copia.specie;
    return copia;
  };
  const normalizzaReligioneFantasy = (religione: Abitante["religione"] | null): Abitante["religione"] | null =>
    religione === "Culto degli Alieni" ? "Culto delle Ombre" : religione;
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
  next.colony.risorse = next.colony.risorse.map((r: Risorsa) => ({ ...r, quantità: clampNonNegative(r.quantità) }));
  next.colony.edifici = next.colony.edifici.map((e: Edificio) => ({
    ...e,
    capacità: clampNonNegative(Math.trunc(e.capacità)),
    abitantiAssegnati: [...new Set(e.abitantiAssegnati)],
    occupazione: new Set(e.abitantiAssegnati).size,
    ...(e.progressoCostruzione == null
      ? {}
      : { progressoCostruzione: Math.min(100, clampNonNegative(e.progressoCostruzione)) })
  }));
  const normalizeInventario = (inv: { itemId: string; quantità: number }[]) =>
    inv.map((v) => ({ ...v, quantità: clampNonNegative(v.quantità) }));
  next.colony.inventarioGiocatore = normalizeInventario(next.colony.inventarioGiocatore);
  Object.keys(next.colony.inventarioMensaByEdificioId).forEach((key) => {
    next.colony.inventarioMensaByEdificioId[Number(key)] = normalizeInventario(next.colony.inventarioMensaByEdificioId[Number(key)] ?? []);
  });
  next.colony.inventarioEmporioByEdificioId ??= {};
  Object.keys(next.colony.inventarioEmporioByEdificioId).forEach((key) => {
    next.colony.inventarioEmporioByEdificioId![Number(key)] = normalizeInventario(
      next.colony.inventarioEmporioByEdificioId![Number(key)] ?? []
    );
  });
  next.population.abitanti = next.population.abitanti.map((a: Abitante) => ({
    ...senzaSpecieLegacy(a),
    razza: normalizzaRazzaFantasy(a.razza),
    religione: normalizzaReligioneFantasy(a.religione) ?? "Ateo",
    ...(!a.aspetto && normalizzaRazzaFantasy(a.razza) !== "Golem" && {
      aspetto: generaAspettoDaSeed((normalizzaRazzaFantasy(a.razza) ?? "Umano") as "Umano" | "Elfo" | "Nano" | "Orco" | "Goblin", a.id)
    }),
    ...(a.id !== 1 && a.aspetto?.cappello === "corona" && {
      aspetto: { ...a.aspetto, cappello: "nessuno" }
    }),
    fazioni: a.fazioni?.map((f) => f === "Robots" ? "Golem" : f === "Culto degli Alieni" ? "Culto delle Ombre" : f),
    inventario: a.inventario ? normalizeInventario(a.inventario) : undefined
  }));
  next.population.abitantiProposti = next.population.abitantiProposti.map((a: Abitante) => ({
    ...senzaSpecieLegacy(a),
    razza: normalizzaRazzaFantasy(a.razza),
    religione: normalizzaReligioneFantasy(a.religione) ?? "Ateo",
    ...(!a.aspetto && normalizzaRazzaFantasy(a.razza) !== "Golem" && {
      aspetto: generaAspettoDaSeed((normalizzaRazzaFantasy(a.razza) ?? "Umano") as "Umano" | "Elfo" | "Nano" | "Orco" | "Goblin", a.id)
    }),
    ...(a.aspetto?.cappello === "corona" && {
      aspetto: { ...a.aspetto, cappello: "nessuno" }
    }),
    fazioni: a.fazioni?.map((f) => f === "Robots" ? "Golem" : f === "Culto degli Alieni" ? "Culto delle Ombre" : f)
  }));
  next.policies.religioneDiStato = normalizzaReligioneFantasy(next.policies.religioneDiStato);
  next.policies.razzaCampoLavoro = normalizzaRazzaFantasy(next.policies.razzaCampoLavoro) ?? null;
  next.policies.razzaCampoSterminio = normalizzaRazzaFantasy(next.policies.razzaCampoSterminio) ?? null;
  return next;
}
