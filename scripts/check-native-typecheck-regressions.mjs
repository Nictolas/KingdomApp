#!/usr/bin/env node
/**
 * Additive regression gate for native optimization PRs.
 * This does NOT replace the repository's strict typecheck, which remains red
 * until the historical errors are fixed on their owning branches.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

export function parseDiagnostics(output) {
  const diagnostics = [];
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/);
    if (!match) continue;
    diagnostics.push({
      file: match[1].replaceAll("\\", "/"),
      line: Number(match[2]),
      column: Number(match[3]),
      code: match[4],
      message: match[5].trim(),
    });
  }
  return diagnostics;
}

export function diagnosticKey(entry) {
  return JSON.stringify([entry.file, entry.line, entry.column, entry.code, entry.message]);
}

export function compareDiagnostics(baseline, current) {
  // Multisets, rather than sets: repeated diagnostics cannot be hidden.
  const known = new Map();
  for (const diagnostic of baseline) {
    const key = diagnosticKey(diagnostic);
    known.set(key, (known.get(key) ?? 0) + 1);
  }
  const added = [];
  for (const diagnostic of current) {
    const key = diagnosticKey(diagnostic);
    const remaining = known.get(key) ?? 0;
    if (remaining > 0) known.set(key, remaining - 1);
    else added.push(diagnostic);
  }
  const resolved = [...known.values()].reduce((sum, count) => sum + count, 0);
  return { added, resolved, baselineCount: baseline.length, currentCount: current.length };
}

export function evaluateTypecheck(result, baseline) {
  if (result.error || result.signal || ![0, 2].includes(result.status)) {
    throw new Error(`TypeScript command failed unexpectedly (status=${result.status}, signal=${result.signal ?? "none"}): ${result.error?.message ?? result.stderr ?? ""}`);
  }
  const diagnostics = parseDiagnostics(String(result.stdout ?? "") + "\n" + String(result.stderr ?? ""));
  if (result.status !== 0 && diagnostics.length === 0) {
    throw new Error("TypeScript exited nonzero without parseable diagnostics");
  }
  const comparison = compareDiagnostics(baseline, diagnostics);
  if (result.status === 0 && diagnostics.length > 0) {
    throw new Error("TypeScript reported errors despite exit status 0");
  }
  return comparison;
}

export function run() {
  const baselinePath = fileURLToPath(new URL("../tests/fixtures/native-typecheck-baseline.json", import.meta.url));
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8")).diagnostics;
  const result = spawnSync(process.execPath, ["node_modules/typescript/bin/tsc", "--noEmit", "--pretty", "false"], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  const report = evaluateTypecheck(result, baseline);
  console.log(`TypeScript diagnostics: baseline=${report.baselineCount}, current=${report.currentCount}, resolved=${report.resolved}, NEW=${report.added.length}`);
  if (report.added.length) {
    for (const error of report.added) {
      console.error(`${error.file}(${error.line},${error.column}): error ${error.code}: ${error.message}`);
    }
    console.error("New TypeScript diagnostics introduced; native regression gate FAILED.");
    process.exitCode = 1;
  } else {
    console.log("No new TypeScript diagnostics against PR #295 baseline. This does NOT make the general typecheck green.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { run(); }
  catch (error) { console.error(error); process.exitCode = 1; }
}
