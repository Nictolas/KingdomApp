import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import {
  auditNativeAbGitIsolation, NATIVE_AB_FIXTURE_PATHS
} from '../scripts/audit-native-ab-git-isolation.mjs';

function setup(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'mykingdom-ab-git-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const put = (path, value) => {
    const dest = join(cwd, path);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, value);
  };
  const commit = (message) => { git('add', '-A'); git('commit', '-qm', message); };
  git('init', '-q', '-b', 'base');
  git('config', 'user.email', 'native-ab-tests@example.invalid');
  git('config', 'user.name', 'Native AB Tests');
  for (const path of NATIVE_AB_FIXTURE_PATHS) put(path, `base ${path}\n`);
  put('src/components/MapWandererCharacter.native.tsx', 'renderer-before-297\n');
  put('src/performance/nativeResidentFrameBus.ts', 'bus-before-297\n');
  put('src/performance/nativeResidentSegmentRunner.ts', 'runner-before-297\n');
  put('src/performance/NativePerformanceHud.tsx', 'hud-before-lab\n');
  commit('base #296');
  git('switch', '-qc', 'baseline');
  for (const path of NATIVE_AB_FIXTURE_PATHS) put(path, `shared fixture ${path}\n`);
  put('src/performance/NativePerformanceHud.tsx', 'hud-lab-baseline\n');
  put('docs/NATIVE_AB_BASELINE_PARITY.md', 'lab notes\n');
  put('.github/workflows/native-perf-diagnostics.yml', 'lab workflow\n');
  commit('lab #298');
  git('switch', '-q', 'base');
  git('switch', '-qc', 'candidate');
  for (const path of NATIVE_AB_FIXTURE_PATHS) put(path, `shared fixture ${path}\n`);
  put('src/components/MapWandererCharacter.native.tsx', 'renderer-after-297\n');
  put('src/performance/nativeResidentTimerQueue.ts', 'shared native timer queue\n');
  commit('optimized #297');
  return { cwd, git, put, commit, refs: { base: 'base', baseline: 'baseline', candidate: 'candidate' } };
}

function audit(f) { return auditNativeAbGitIsolation({ cwd: f.cwd, refs: f.refs }); }

test('accepts divergent #298/#297 branches with identical four real-sprite fixture blobs', t => {
  const f = setup(t);
  const result = audit(f);
  assert.equal(result.fixtureBlobsIdentical, 4);
  assert.equal(result.protectedEnginePathsUnchangedInBaseline, 5);
  assert.equal(result.baselineChangedFiles.length, 7);
  assert.match(result.status, /not_device_build_verified/);
});

test('rejects fixture drift even when all branches are correctly based', t => {
  const f = setup(t);
  f.git('switch', '-q', 'baseline');
  f.put(NATIVE_AB_FIXTURE_PATHS[2], 'drifted occupancy\n');
  f.commit('accidental fixture drift');
  assert.throws(() => audit(f), /fixture Git blob mismatch/);
});

test('rejects native renderer leakage into #298, regardless of fixture parity', t => {
  const f = setup(t);
  f.git('switch', '-q', 'baseline');
  f.put('src/components/MapWandererCharacter.native.tsx', 'leaked optimized renderer\n');
  f.commit('accidental native engine change');
  assert.throws(() => audit(f), /outside its lab allowlist/);
});

test('rejects unrelated baseline gameplay or web edits', t => {
  const f = setup(t);
  f.git('switch', '-q', 'baseline');
  f.put('src/game/GameContext.tsx', 'not part of A/B lab\n');
  f.commit('unrelated gameplay change');
  assert.throws(() => audit(f), /outside its lab allowlist/);
});

test('rejects a candidate without the optimized native timer queue', t => {
  const f = setup(t);
  f.git('switch', '-q', 'candidate');
  f.git('rm', '-q', 'src/performance/nativeResidentTimerQueue.ts');
  f.commit('timer queue lost');
  assert.throws(() => audit(f), /distinct optimized native timer queue/);
});

test('rejects a baseline accidentally rebased on the optimized candidate', t => {
  const f = setup(t);
  f.git('switch', '-q', 'baseline');
  f.git('reset', '--hard', 'candidate');
  assert.throws(() => audit(f), /diverge at the current #296 head|three commits must differ/);
});

test('rejects moving #296 without moving both lab branches', t => {
  const f = setup(t);
  f.git('switch', '-q', 'base');
  f.put('src/game/new-unrelated-feature.ts', 'base moved\n');
  f.commit('base advances concurrently');
  assert.throws(() => audit(f), /diverge at the current #296 head/);
});

test('pins the candidate branch to the exact CI triggering commit', t => {
  const f = setup(t);
  const sha = f.git('rev-parse', 'candidate');
  assert.equal(auditNativeAbGitIsolation({
    cwd: f.cwd, refs: f.refs, expectedCandidateSha: sha
  }).commits.candidate, sha);
  assert.throws(() => auditNativeAbGitIsolation({
    cwd: f.cwd, refs: f.refs, expectedCandidateSha: '0'.repeat(40)
  }), /candidate branch moved since the triggering CI commit/);
  assert.throws(() => auditNativeAbGitIsolation({
    cwd: f.cwd, refs: f.refs, expectedCandidateSha: 'not-a-sha'
  }), /expected candidate SHA must be a full 40-character Git commit/);
});

test('rejects missing refs and unsafe user-provided ref names without mutating the repo', t => {
  const f = setup(t);
  assert.throws(() => auditNativeAbGitIsolation({ cwd: f.cwd, refs: { ...f.refs, baseline: 'missing' } }), /unresolvable commit ref/);
  assert.throws(() => auditNativeAbGitIsolation({ cwd: f.cwd, refs: { ...f.refs, baseline: '--upload-pack=evil' } }), /unsafe or invalid Git ref/);
  assert.equal(audit(f).fixtureBlobsIdentical, 4);
});
