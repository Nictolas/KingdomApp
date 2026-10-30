import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  parseDiagnostics,
  compareDiagnostics,
  evaluateTypecheck,
} from "../scripts/check-native-typecheck-regressions.mjs";

const baseline = JSON.parse(readFileSync(new URL("./fixtures/native-typecheck-baseline.json", import.meta.url), "utf8")).diagnostics;
const error = (file, code = "TS7006") => ({ file, line: 10, column: 2, code, message: "Parameter 'x' implicitly has an 'any' type." });

test("pinned PR #295 baseline has 53 distinct errors", () => {
  assert.equal(baseline.length, 53);
  assert.equal(new Set(baseline.map(x => JSON.stringify(x))).size, 53);
});

test("baseline comparison is unchanged when order differs", () => {
  const result = compareDiagnostics(baseline, [...baseline].reverse());
  assert.equal(result.added.length, 0);
  assert.equal(result.resolved, 0);
});

test("regression gate catches a new error and permits resolved errors", () => {
  const result = compareDiagnostics(baseline, [...baseline.slice(1), error("src/performance/new-native.ts")]);
  assert.equal(result.added.length, 1);
  assert.equal(result.added[0].file, "src/performance/new-native.ts");
  assert.equal(result.resolved, 1);
});

test("regression gate catches changed message, position and duplicate", () => {
  const changed = { ...baseline[0], message: "A new diagnostic with the same code." };
  assert.equal(compareDiagnostics(baseline, [...baseline.slice(1), changed]).added.length, 1);
  assert.equal(compareDiagnostics(baseline, [...baseline, baseline[0]]).added.length, 1);
  assert.equal(compareDiagnostics(baseline, [{ ...baseline[0], line: baseline[0].line + 1 }]).added.length, 1);
});

test("parse TypeScript diagnostics, ignoring continuation lines and workflow noise", () => {
  const parsed = parseDiagnostics("2026-10-28T10:00Z unrelated\nsrc/a.ts(4,2): error TS7006: Parameter 'x' implicitly has an 'any' type.\n  More context\n");
  assert.deepEqual(parsed, [{ file: "src/a.ts", line: 4, column: 2, code: "TS7006", message: "Parameter 'x' implicitly has an 'any' type." }]);
});

test("nonzero exit without parseable errors and unexpected exits must fail closed", () => {
  assert.throws(() => evaluateTypecheck({ status: 2, stdout: "", stderr: "" }, baseline), /without parseable/);
  assert.throws(() => evaluateTypecheck({ status: 1, stdout: "", stderr: "fatal" }, baseline), /unexpectedly/);
  assert.throws(() => evaluateTypecheck({ status: null, signal: "SIGKILL", stdout: "", stderr: "" }, baseline), /unexpectedly/);
});

test("legacy diagnostics may remain red while supplementary gate passes", () => {
  const stdout = baseline.map(e => `${e.file}(${e.line},${e.column}): error ${e.code}: ${e.message}`).join("\n");
  const report = evaluateTypecheck({ status: 2, stdout, stderr: "" }, baseline);
  assert.equal(report.added.length, 0);
  assert.equal(report.currentCount, 53);
});

test("a clean TypeScript run also passes the additive regression gate", () => {
  const report = evaluateTypecheck({ status: 0, stdout: "", stderr: "" }, baseline);
  assert.equal(report.added.length, 0);
  assert.equal(report.resolved, 53);
});
