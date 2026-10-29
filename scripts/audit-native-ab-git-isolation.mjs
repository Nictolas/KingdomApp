#!/usr/bin/env node
/**
 * Read-only, fail-closed Git-object audit for the real-sprite native A/B lab.
 * Baseline #298 must branch from #296 without inheriting #297's scheduler;
 * all four workload/fixture blobs must match the candidate #297 exactly.
 * This verifies source Git history, NOT installed device binaries or FPS.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const NATIVE_AB_REFS = Object.freeze({
  base: 'refs/remotes/origin/perf/native-resident-imperative-motion-20261028',
  baseline: 'refs/remotes/origin/perf/native-real-sprite-ab-baseline-20261028',
  candidate: 'refs/remotes/origin/perf/native-resident-timer-batching-20261028'
});

export const NATIVE_AB_FIXTURE_PATHS = Object.freeze([
  'app/native-perf.tsx',
  'src/performance/NativeRealResidentWorkload.tsx',
  'src/performance/nativeRealResidentFixture.ts',
  'tests/native-real-resident-fixture.test.ts'
]);

const BASELINE_ALLOWLIST = new Set([
  ...NATIVE_AB_FIXTURE_PATHS,
  '.github/workflows/native-perf-diagnostics.yml',
  'docs/NATIVE_AB_BASELINE_PARITY.md',
  'src/performance/NativePerformanceHud.tsx'
]);

const ENGINE_PATHS = Object.freeze([
  'src/components/MapWandererCharacter.native.tsx',
  'src/performance/nativeResidentFrameBus.ts',
  'src/performance/nativeResidentTimerQueue.ts',
  'src/performance/nativeResidentSegmentRunner.ts',
  'src/performance/nativeResidentAppVisibility.ts'
]);

function fail(message) { throw new Error(`Native A/B Git isolation: ${message}`); }

function git(cwd, ...args) {
  return execFileSync('git', args, {
    cwd, encoding: 'utf8', timeout: 10_000, maxBuffer: 1_000_000,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function resolveCommit(cwd, ref) {
  if (typeof ref !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9/_-]{0,199}$/.test(ref)) {
    fail('unsafe or invalid Git ref');
  }
  try {
    const sha = git(cwd, 'rev-parse', '--verify', `${ref}^{commit}`);
    if (!/^[0-9a-f]{40}$/.test(sha)) fail('unexpected Git commit identifier');
    return sha;
  } catch {
    fail(`missing or unresolvable commit ref: ${ref}`);
  }
}

function blob(cwd, sha, path) {
  try {
    const result = git(cwd, 'rev-parse', '--verify', `${sha}:${path}`);
    return /^[0-9a-f]{40}$/.test(result) ? result : null;
  } catch {
    return null;
  }
}

/**
 * Source-only integrity gate. No network, checkout, branch writes or mutation.
 * Every ref is resolved once to a commit SHA to avoid races during the audit.
 */
export function auditNativeAbGitIsolation({ cwd = process.cwd(), refs = NATIVE_AB_REFS } = {}) {
  if (!refs || typeof refs !== 'object') fail('refs required');
  const base = resolveCommit(cwd, refs.base);
  const baseline = resolveCommit(cwd, refs.baseline);
  const candidate = resolveCommit(cwd, refs.candidate);
  if (new Set([base, baseline, candidate]).size !== 3) fail('all three commits must differ');
  let mergeBase;
  try { mergeBase = git(cwd, 'merge-base', baseline, candidate); }
  catch { fail('branches have no shared merge base'); }
  if (mergeBase !== base) {
    fail('baseline and candidate must diverge at the current #296 head');
  }
  // Strict allowlist for the laboratory baseline: no gameplay/web/native
  // engine changes may be hidden in #298, even when fixture blobs match.
  const baselinePaths = git(cwd, 'diff', '--name-only', '--no-renames', base, baseline)
    .split('\n').filter(Boolean);
  const unexpected = baselinePaths.filter(path => !BASELINE_ALLOWLIST.has(path));
  if (unexpected.length) fail('baseline modifies files outside its lab allowlist: ' + unexpected.join(', '));
  for (const path of NATIVE_AB_FIXTURE_PATHS) {
    const a = blob(cwd, baseline, path);
    const b = blob(cwd, candidate, path);
    if (!a || !b || a !== b) fail(`fixture Git blob mismatch: ${path}`);
    if (!baselinePaths.includes(path)) fail(`baseline fixture not added/changed from #296: ${path}`);
  }
  for (const path of ENGINE_PATHS) {
    if (blob(cwd, base, path) !== blob(cwd, baseline, path)) {
      fail(`baseline contains native engine changes: ${path}`);
    }
  }
  if (!blob(cwd, candidate, 'src/performance/nativeResidentTimerQueue.ts') ||
      blob(cwd, candidate, 'src/performance/nativeResidentTimerQueue.ts') ===
        blob(cwd, baseline, 'src/performance/nativeResidentTimerQueue.ts')) {
    fail('candidate lacks a distinct optimized native timer queue');
  }
  return {
    status: 'source_git_isolation_verified_not_device_build_verified',
    comparison: '#298 real-sprite baseline versus #297 native optimized candidate',
    commits: { base, baseline, candidate },
    fixtureBlobsIdentical: NATIVE_AB_FIXTURE_PATHS.length,
    baselineChangedFiles: baselinePaths,
    protectedEnginePathsUnchangedInBaseline: ENGINE_PATHS.length,
    limitation: 'Git objects only; no installed APK/IPA identity, FPS, touch or GPU validation'
  };
}

function main(args) {
  if (args.length > 1 || (args.length === 1 && args[0] !== '--json')) {
    fail('usage: node scripts/audit-native-ab-git-isolation.mjs [--json]');
  }
  const result = auditNativeAbGitIsolation();
  if (args[0] === '--json') console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`Native A/B Git isolation OK: ${result.fixtureBlobsIdentical} identical fixture blobs; ${result.protectedEnginePathsUnchangedInBaseline} baseline engine paths unchanged`);
    console.log(`Base ${result.commits.base}; baseline ${result.commits.baseline}; candidate ${result.commits.candidate}`);
    console.log('Git-source evidence only. Device builds and real hardware measurements still required.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
