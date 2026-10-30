/**
 * Pure, opt-in comparison of two human-shared device diagnostic reports.
 * No collection, storage, telemetry, native APIs or automatic device claims.
 * The reports are JS-only; neither contains physical GPU/UI FPS.
 */
export type NativeRealSpriteABReport = Readonly<{
  platform: "android" | "ios";
  scene: string;
  population: 25 | 50 | 100 | 200;
  timeScale: 1 | 2 | 4;
  terrainCells: number;
  durationSeconds: number;
  samples: number;
  jsFps: number;
  frameP95Ms: number;
  frameMeanMs: number;
  over33: number;
  over50: number;
  rafBatchP95Ms: number;
  timerBatchP95Ms: number;
  eventLoopP95Ms: number;
  renderBodies: number;
  timerCallbacks: number;
}>;

export type NativeRealSpriteABComparison = Readonly<{
  baseline: NativeRealSpriteABReport;
  optimized: NativeRealSpriteABReport;
  jsFpsDifference: number;
  frameP95DifferenceMs: number;
  eventLoopP95DifferenceMs: number;
  timerCallbacksDifference: number;
  interpretation: "js-only";
}>;

const required = [
  "Piattaforma", "Scena", "Elementi", "Velocità simulazione",
  "Celle terreno", "Durata", "Campioni", "FPS JS medio",
  "Frame medio", "p95", "Frame oltre 33 ms", "Frame oltre 50 ms",
  "Batch RAF JS p95", "Batch timer JS p95", "Ritardo loop JS p95",
  "Render sprite React", "Callback timer residenti"
] as const;

function numeric(raw: string, label: string): number {
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw)) {
    throw new Error("Valore numerico non valido: " + label);
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error("Valore non finito: " + label);
  return value;
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error("Intero non valido: " + label);
  return value;
}

export function parseNativeRealSpriteABReport(text: string): NativeRealSpriteABReport {
  if (text.length > 32_768) throw new Error("Report diagnostico troppo grande");
  const lines = text.trim().split(/\r?\n/);
  if (lines[0] !== "MyKingdom - diagnostica prestazioni JS (non GPU/UI FPS)") {
    throw new Error("Non è un report diagnostico JS MyKingdom");
  }
  const entries = new Map<string, string>();
  for (const line of lines.slice(1)) {
    const colon = line.indexOf(": ");
    if (colon < 0) continue;
    const key = line.slice(0, colon);
    if (!required.includes(key as typeof required[number])) continue;
    if (entries.has(key)) throw new Error("Campo duplicato: " + key);
    entries.set(key, line.slice(colon + 2));
  }
  for (const key of required) {
    if (!entries.has(key)) throw new Error("Campo diagnostico mancante: " + key);
  }
  const get = (key: typeof required[number]) => entries.get(key)!;
  const platform = get("Piattaforma");
  if (platform !== "android" && platform !== "ios") {
    throw new Error("Solo report da Android/iOS nativi sono confrontabili");
  }
  const scene = get("Scena");
  if (!scene.startsWith("Sprite abitanti reali")) {
    throw new Error("I marker semplici non sono una baseline per sprite reali");
  }
  const population = numeric(get("Elementi"), "Elementi");
  if (![25, 50, 100, 200].includes(population)) throw new Error("Popolazione A/B non supportata");
  const timeScaleRaw = get("Velocità simulazione");
  if (!/^(1|2|4)x$/.test(timeScaleRaw)) throw new Error("Velocità 1×/2×/4× richiesta");
  const timeScale = Number(timeScaleRaw.slice(0, -1));
  const durationRaw = get("Durata");
  if (!/^\d+(?:\.\d+)? s$/.test(durationRaw)) throw new Error("Durata diagnostica non valida");
  const durationSeconds = numeric(durationRaw.slice(0, -2), "Durata");
  if (durationSeconds !== 10) throw new Error("La cattura deve durare 10 secondi");
  const samples = positiveInteger(numeric(get("Campioni"), "Campioni"), "Campioni");
  if (samples < 60) throw new Error("Campionamento JS insufficiente per un confronto A/B");
  const jsFps = numeric(get("FPS JS medio"), "FPS JS medio");
  if (jsFps <= 0 || jsFps > 1000) throw new Error("FPS JS fuori intervallo");
  const frameP95Ms = numeric(get("p95").replace(/ ms$/, ""), "p95");
  const frameMeanMs = numeric(get("Frame medio").replace(/ ms$/, ""), "Frame medio");
  const over33 = numeric(get("Frame oltre 33 ms"), "Frame oltre 33 ms");
  const over50 = numeric(get("Frame oltre 50 ms"), "Frame oltre 50 ms");
  const rafBatchP95Ms = numeric(get("Batch RAF JS p95").replace(/ ms$/, ""), "Batch RAF JS p95");
  const timerBatchP95Ms = numeric(get("Batch timer JS p95").replace(/ ms$/, ""), "Batch timer JS p95");
  const eventLoopP95Ms = numeric(get("Ritardo loop JS p95").replace(/ ms$/, ""), "Ritardo loop JS p95");
  const renderBodies = numeric(get("Render sprite React"), "Render sprite React");
  const timerCallbacks = numeric(get("Callback timer residenti"), "Callback timer residenti");
  const terrainCells = positiveInteger(numeric(get("Celle terreno"), "Celle terreno"), "Celle terreno");
  if (terrainCells !== 400) throw new Error("Fixture A/B sprite reali deve avere 400 celle");
  if (over33 > samples || over50 > over33) throw new Error("Contatori frame incoerenti");
  if (frameP95Ms < 0 || frameMeanMs <= 0) throw new Error("Tempi frame incoerenti");
  if (samples > durationSeconds * 1000) throw new Error("Campioni incompatibili con la durata");
  return {
    platform, scene, population: population as NativeRealSpriteABReport["population"],
    timeScale: timeScale as NativeRealSpriteABReport["timeScale"], terrainCells,
    durationSeconds, samples, jsFps, frameP95Ms, frameMeanMs, over33, over50,
    rafBatchP95Ms, timerBatchP95Ms, eventLoopP95Ms, renderBodies, timerCallbacks
  };
}

export function compareNativeRealSpriteABReports(
  baselineText: string,
  optimizedText: string
): NativeRealSpriteABComparison {
  const baseline = parseNativeRealSpriteABReport(baselineText);
  const optimized = parseNativeRealSpriteABReport(optimizedText);
  for (const key of ["platform", "scene", "population", "timeScale", "terrainCells", "durationSeconds"] as const) {
    if (baseline[key] !== optimized[key]) {
      throw new Error("Confronto A/B non valido: " + key + " diverso fra le due catture");
    }
  }
  return {
    baseline, optimized,
    jsFpsDifference: optimized.jsFps - baseline.jsFps,
    frameP95DifferenceMs: optimized.frameP95Ms - baseline.frameP95Ms,
    eventLoopP95DifferenceMs: optimized.eventLoopP95Ms - baseline.eventLoopP95Ms,
    timerCallbacksDifference: optimized.timerCallbacks - baseline.timerCallbacks,
    interpretation: "js-only"
  };
}
