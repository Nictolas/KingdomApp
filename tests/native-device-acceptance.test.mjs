import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import {
  auditNativeDeviceAcceptance, nativeDeviceAcceptanceTemplate,
  POPULATIONS, SPEEDS, REQUIRED_CHECKS
} from '../scripts/audit-native-device-acceptance.mjs';

const baselineSha = 'a'.repeat(40);
const candidateSha = 'b'.repeat(40);
const observation = 'Verifica manuale su dispositivo fisico, senza telemetria automatica.';
function fixture() {
  const manifest = nativeDeviceAcceptanceTemplate();
  manifest.baseline.commit = baselineSha;
  manifest.candidate.commit = candidateSha;
  for (const device of manifest.devices) {
    device.deviceClass = device.platform === 'ios' ? 'iPhone fisico' : 'Android fisico';
    device.samePhysicalDeviceConfirmed = true;
    for (const entry of [...device.scenarios, ...device.checks]) {
      entry.baseline = 'pass'; entry.candidate = 'pass'; entry.notes = observation;
    }
  }
  return manifest;
}

test('template enumerates exactly 12 scenario cells and 10 behavioral checks on each platform', () => {
  const m = nativeDeviceAcceptanceTemplate();
  assert.deepEqual(m.devices.map(d => d.platform), ['android', 'ios']);
  assert.equal(POPULATIONS.length * SPEEDS.length, 12);
  assert.equal(REQUIRED_CHECKS.length, 10);
  for (const d of m.devices) {
    assert.equal(d.scenarios.length, 12);
    assert.equal(new Set(d.scenarios.map(s => `${s.residents}/${s.speed}`)).size, 12);
    assert.equal(d.checks.length, 10);
    assert.ok(d.scenarios.every(s => s.baseline === 'not_run' && s.candidate === 'not_run'));
  }
});

test('complete human A/B matrix remains manual review only, never auto-approves release', () => {
  const result = auditNativeDeviceAcceptance(fixture());
  assert.equal(result.status, 'human_attestations_complete_review_still_required');
  assert.equal(result.devices.length, 2);
  assert.equal(result.failedObservations, 0);
  assert.ok(result.devices.every(d => d.coverage.scenarios === 12 && d.coverage.checks === 10));
  assert.match(result.scope, /NOT verified FPS/);
  assert.match(result.conclusion, /no_automatic_merge/);
});

test('partial matrix is rejected by default and explicitly labeled incomplete when requested', () => {
  const m = fixture();
  m.devices[0].scenarios.pop();
  m.devices[1].checks[0].candidate = 'not_run';
  assert.throws(() => auditNativeDeviceAcceptance(m), /incomplete physical-device matrix/);
  const result = auditNativeDeviceAcceptance(m, { allowPartial: true });
  assert.equal(result.status, 'incomplete_device_evidence');
  assert.deepEqual(result.devices[0].coverage.missingScenarios, ['200/4']);
  assert.equal(result.devices[1].coverage.checks, 9);
});

test('an observed failure is surfaced, not silently counted as a successful comparison', () => {
  const m = fixture();
  m.devices[0].checks[3].candidate = 'fail';
  const result = auditNativeDeviceAcceptance(m);
  assert.equal(result.status, 'manual_failure_requires_investigation');
  assert.equal(result.failedObservations, 1);
  assert.equal(result.devices[0].failedObservations, 1);
});

test('provenance and physical-device attestations cannot be omitted or conflated', () => {
  for (const mutate of [
    m => { m.baseline.pr = 295; },
    m => { m.baseline.commit = m.candidate.commit; },
    m => { m.baseline.commit = 'not-a-sha'; },
    m => { m.devices[0].samePhysicalDeviceConfirmed = false; },
    m => { m.devices[1].platform = 'android'; },
    m => { m.devices[0].deviceClass = ''; }
  ]) {
    const m = fixture(); mutate(m);
    assert.throws(() => auditNativeDeviceAcceptance(m));
  }
});

test('duplicate, unknown and malformed scenario/check evidence fails closed', () => {
  for (const mutate of [
    m => { m.devices[0].scenarios.push({ ...m.devices[0].scenarios[0] }); },
    m => { m.devices[0].scenarios[0].residents = 201; },
    m => { m.devices[0].checks[0].id = 'invented'; },
    m => { m.devices[0].checks.push({ ...m.devices[0].checks[0] }); },
    m => { m.devices[0].checks[0].candidate = 'maybe'; },
    m => { m.devices[0].checks[0].notes = 'ok'; },
    m => { m.devices[0].scenarios[0].baseline = null; }
  ]) {
    const m = fixture(); mutate(m);
    assert.throws(() => auditNativeDeviceAcceptance(m));
  }
});

test('200-resident behavioral stress checks cannot be skipped as if they passed', () => {
  const m = fixture();
  for (const check of m.devices[0].checks) {
    check.baseline = 'not_run'; check.candidate = 'not_run'; check.notes = '';
  }
  const result = auditNativeDeviceAcceptance(m, { allowPartial: true });
  assert.equal(result.devices[0].coverage.scenarios, 12);
  assert.equal(result.devices[0].coverage.checks, 0);
  assert.equal(result.status, 'incomplete_device_evidence');
});

test('template CLI is valid JSON and contains no invented hardware results', () => {
  const script = resolve(dirname(fileURLToPath(import.meta.url)), '../scripts/audit-native-device-acceptance.mjs');
  const output = execFileSync(process.execPath, [script, '--template'], { encoding: 'utf8' });
  const m = JSON.parse(output);
  assert.equal(m.devices.length, 2);
  assert.equal(m.baseline.commit, null);
  assert.equal(m.candidate.commit, null);
  assert.ok(m.devices.every(d => !d.samePhysicalDeviceConfirmed));
});
