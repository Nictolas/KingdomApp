import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const workflow = readFileSync(
  new URL("../.github/workflows/native-ab-android-debug-lab.yml", import.meta.url),
  "utf8"
);

test("Android lab builds only on Draft #297 PR and never on main or the #298 baseline PR", () => {
  assert.match(workflow, /^on:\n  pull_request:/m);
  assert.match(workflow, /if: \$\{\{ github\.event\.pull_request\.number == 297 \}\}/);
  assert.match(workflow, /concurrency:\n  group: native-ab-debug-/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.match(workflow, /determine-build:/);
  assert.match(workflow, /fetch-depth: 2/);
  assert.match(workflow, /git diff --name-only HEAD\^ HEAD/);
  assert.match(workflow, /needs: determine-build/);
  assert.match(workflow, /needs\.determine-build\.outputs\.changed/);
  assert.doesNotMatch(workflow, /push:\s*\n|schedule:\s*\n|workflow_dispatch:\s*\n/);
});

test("same PR compiles independent, pinned baseline and commit-bound candidate variants", () => {
  assert.match(workflow, /variant: baseline-298\n\s+source: 6dfcb12337992418f812049bf4bc1e1c144f843c/);
  assert.match(workflow, /variant: candidate-297\n\s+source: candidate/);
  assert.match(workflow, /github\.event\.pull_request\.head\.sha/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /npm ci --prefer-offline/);
});

test("DEBUG artifacts must be ephemeral and explicitly excluded from release or FPS conclusions", () => {
  assert.match(workflow, /expo prebuild --platform android --no-install --clean/);
  assert.match(workflow, /com\.nictolas\.mykingdom\.perflab/);
  assert.match(workflow, /debuggableVariants = \[\]/);
  assert.match(workflow, /:app:assembleDebug --no-daemon/);
  assert.match(workflow, /NOT_FOR_RELEASE_OR_FPS_BENCHMARKS=true/);
  assert.match(workflow, /sha256sum mykingdom-\*\.apk/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /retention-days: 7/);
  assert.doesNotMatch(workflow, /:app:assembleRelease|eas build|gradlew publish|google-play|fastlane|deploy:|force: true/);
});

test("A docs-only synchronize event cannot cancel a running expensive A/B APK build", () => {
  // Workflow-level concurrency applies BEFORE the determine-build job runs.
  // Keeping cancel-in-progress=true would abort a live Gradle build even when
  // the new HEAD is documentation-only and the expensive job would be skipped.
  assert.match(workflow, /cancel-in-progress: false/);
  assert.doesNotMatch(workflow, /cancel-in-progress: true/);
  assert.match(workflow, /determine-build:/);
  assert.match(workflow, /needs: determine-build/);
  assert.match(workflow, /if: needs\.determine-build\.outputs\.changed == 'true'/);
});
