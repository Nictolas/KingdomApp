#!/usr/bin/env node
/**
 * MyKingdom native real-sprite A/B manual-correctness audit.
 * Baseline PR #298 vs candidate PR #297; 25/50/100/200 × 1/2/4 on both
 * Android and iPhone, plus 200-resident behavioral checks.
 *
 * This validates the STRUCTURE of operator attestations, not their truth.
 * It cannot run a device, verify a binary, infer FPS, or authorize a merge.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const POPULATIONS = Object.freeze([25, 50, 100, 200]);
export const SPEEDS = Object.freeze([1, 2, 4]);
export const REQUIRED_CHECKS = Object.freeze([
  'single_tap', 'double_tap', 'pan_pinch', 'collision_retry',
  'pause_resume', 'background_foreground', 'speed_switch_1_2_4',
  'route_replacement', 'no_ghost_occupancy', 'memory_stability_200'
]);
const EXPECTED = POPULATIONS.flatMap(residents => SPEEDS.map(speed => `${residents}/${speed}`));
const SHA = /^[0-9a-f]{40}$/i;
const STATUSES = new Set(['pass', 'fail', 'not_run']);
const fail = message => { throw new Error(`Native device A/B audit: ${message}`); };
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.length >= 12 && value.length <= 600 &&
  value.trim() === value && !/[\x00-\x08\x0e-\x1f]/.test(value);

function validateObservation(entry, key) {
  if (!record(entry) || !STATUSES.has(entry.baseline) || !STATUSES.has(entry.candidate)) {
    fail(`${key}: expected baseline/candidate pass, fail or not_run`);
  }
  if ((entry.baseline !== 'not_run' || entry.candidate !== 'not_run') && !text(entry.notes)) {
    fail(`${key}: observed results require 12–600 characters of operator notes`);
  }
  if (entry.notes !== undefined && entry.notes !== '' && !text(entry.notes)) {
    fail(`${key}: invalid operator notes`);
  }
  return {
    observed: Number(entry.baseline !== 'not_run') + Number(entry.candidate !== 'not_run'),
    failures: Number(entry.baseline === 'fail') + Number(entry.candidate === 'fail'),
    complete: entry.baseline !== 'not_run' && entry.candidate !== 'not_run'
  };
}

/** Only explicit human observations are accepted; no synthetic results. */
export function auditNativeDeviceAcceptance(manifest, { allowPartial = false } = {}) {
  if (!record(manifest) || manifest.schemaVersion !== 1 ||
      !record(manifest.baseline) || manifest.baseline.pr !== 298 ||
      !SHA.test(manifest.baseline.commit ?? '') ||
      !record(manifest.candidate) || manifest.candidate.pr !== 297 ||
      !SHA.test(manifest.candidate.commit ?? '') ||
      manifest.baseline.commit.toLowerCase() === manifest.candidate.commit.toLowerCase()) {
    fail('require distinct 40-hex commit refs for baseline PR #298 and candidate PR #297');
  }
  if (typeof allowPartial !== 'boolean') fail('allowPartial must be boolean');
  if (!Array.isArray(manifest.devices) || manifest.devices.length < 1 || manifest.devices.length > 2) {
    fail('expected one or two physical-device attestations');
  }
  const seenPlatforms = new Set();
  const devices = [];
  for (const device of manifest.devices) {
    if (!record(device) || !['android', 'ios'].includes(device.platform) ||
        seenPlatforms.has(device.platform) || device.samePhysicalDeviceConfirmed !== true ||
        typeof device.deviceClass !== 'string' || device.deviceClass.trim().length < 3 ||
        device.deviceClass.length > 80 ||
        !Array.isArray(device.scenarios) || !Array.isArray(device.checks)) {
      fail('each platform needs a unique, explicitly attested device class and scenario/check arrays');
    }
    seenPlatforms.add(device.platform);
    const seenScenarios = new Set();
    const seenChecks = new Set();
    let observations = 0;
    let failures = 0;
    let completeScenarios = 0;
    let completeChecks = 0;
    for (const entry of device.scenarios) {
      if (!record(entry) || !POPULATIONS.includes(entry.residents) || !SPEEDS.includes(entry.speed)) {
        fail(`${device.platform}: invalid population/speed`);
      }
      const key = `${entry.residents}/${entry.speed}`;
      if (seenScenarios.has(key)) fail(`${device.platform}: duplicate scenario ${key}`);
      seenScenarios.add(key);
      const state = validateObservation(entry, `${device.platform} ${key}`);
      observations += state.observed;
      failures += state.failures;
      if (state.complete) completeScenarios++;
    }
    for (const entry of device.checks) {
      if (!record(entry) || !REQUIRED_CHECKS.includes(entry.id) || seenChecks.has(entry.id)) {
        fail(`${device.platform}: invalid or duplicate behavioral check`);
      }
      seenChecks.add(entry.id);
      const state = validateObservation(entry, `${device.platform} ${entry.id}`);
      observations += state.observed;
      failures += state.failures;
      if (state.complete) completeChecks++;
    }
    const missingScenarios = EXPECTED.filter(key => !seenScenarios.has(key));
    const missingChecks = REQUIRED_CHECKS.filter(key => !seenChecks.has(key));
    devices.push({
      platform: device.platform,
      deviceClass: device.deviceClass,
      deviceMatch: 'human_attestation_only',
      coverage: {
        scenarios: completeScenarios, requiredScenarios: EXPECTED.length,
        checks: completeChecks, requiredChecks: REQUIRED_CHECKS.length,
        missingScenarios, missingChecks, observations
      },
      failedObservations: failures,
      status: failures ? 'manual_failure_requires_investigation' :
        completeScenarios === EXPECTED.length && completeChecks === REQUIRED_CHECKS.length
          ? 'complete_human_attestation_for_review' : 'incomplete_human_attestation'
    });
  }
  const missingPlatforms = ['android', 'ios'].filter(p => !seenPlatforms.has(p));
  const failedObservations = devices.reduce((sum, d) => sum + d.failedObservations, 0);
  const complete = !missingPlatforms.length && devices.every(d =>
    d.status === 'complete_human_attestation_for_review');
  const status = failedObservations ? 'manual_failure_requires_investigation' :
    complete ? 'human_attestations_complete_review_still_required' : 'incomplete_device_evidence';
  if (!allowPartial && !complete && !failedObservations) {
    const missing = devices.map(d => `${d.platform}: ${d.coverage.scenarios}/12 scenarios, ${d.coverage.checks}/10 checks`).join('; ');
    fail(`incomplete physical-device matrix (${missing}; missing platforms: ${missingPlatforms.join(', ') || 'none'})`);
  }
  return {
    scope: 'Operator-entered correctness observations only; NOT verified FPS, GPU/UI, memory, touch latency or installed build identity',
    comparison: '#298 real-sprite baseline vs #297 candidate',
    commits: { baseline: manifest.baseline.commit, candidate: manifest.candidate.commit },
    missingPlatforms, devices, failedObservations, status,
    conclusion: 'no_automatic_merge_deploy_release_or_performance_approval'
  };
}

export function nativeDeviceAcceptanceTemplate() {
  return {
    schemaVersion: 1,
    baseline: { pr: 298, commit: null },
    candidate: { pr: 297, commit: null },
    devices: ['android', 'ios'].map(platform => ({
      platform, deviceClass: '', samePhysicalDeviceConfirmed: false,
      scenarios: POPULATIONS.flatMap(residents => SPEEDS.map(speed => ({
        residents, speed, baseline: 'not_run', candidate: 'not_run', notes: ''
      }))),
      checks: REQUIRED_CHECKS.map(id => ({ id, baseline: 'not_run', candidate: 'not_run', notes: '' }))
    }))
  };
}

function main(argv) {
  if (argv.length === 1 && argv[0] === '--template') {
    console.log(JSON.stringify(nativeDeviceAcceptanceTemplate(), null, 2));
    return;
  }
  let path = null;
  let allowPartial = false;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--manifest' && i + 1 < argv.length) path = argv[++i];
    else if (argv[i] === '--allow-partial') allowPartial = true;
    else if (argv[i] === '--json') json = true;
    else fail('usage: --template OR --manifest file.json [--allow-partial] [--json]');
  }
  if (!path) fail('manifest path required');
  const raw = readFileSync(resolve(path), 'utf8');
  if (raw.length > 128_000) fail('manifest too large');
  const result = auditNativeDeviceAcceptance(JSON.parse(raw), { allowPartial });
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`MyKingdom physical-device manual audit: ${result.status}`);
    for (const d of result.devices) {
      console.log(`${d.platform}: ${d.coverage.scenarios}/12 scenarios, ${d.coverage.checks}/10 behavioral checks, ${d.failedObservations} failures`);
    }
    console.log('Human attestations only; compare JS and UI traces separately. No automatic release approval.');
  }
  if (result.failedObservations) process.exitCode = 2;
  else if (result.status === 'incomplete_device_evidence' && !allowPartial) process.exitCode = 3;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
