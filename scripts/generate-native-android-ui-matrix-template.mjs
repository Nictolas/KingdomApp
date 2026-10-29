#!/usr/bin/env node
/**
 * Print a blank capture manifest, never performance data or a device claim.
 * Deliberately leaves display refresh and same-device attestation unset.
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const POPULATIONS = [25, 50, 100, 200];
const SPEEDS = [1, 2, 4];
const SCENES = [
  "Sprite abitanti reali in tragitto ripetibile",
  "Sprite abitanti reali in movimento",
  "Sprite abitanti reali fermi"
];

export function makeAndroidUiMatrixTemplate({ pairs = 3, scene = SCENES[0] } = {}) {
  if (!Number.isSafeInteger(pairs) || pairs < 3 || pairs > 10) {
    throw new Error("Expected 3–10 A/B pairs per scenario");
  }
  if (!SCENES.includes(scene)) throw new Error("Real native-sprite scene required");
  return {
    schemaVersion: 1,
    platform: "android",
    scene,
    refreshHz: null,
    samePhysicalDeviceConfirmed: false,
    baselineBranch: "perf/native-real-sprite-ab-baseline-20261028",
    candidateBranch: "perf/native-resident-timer-batching-20261028",
    scenarios: POPULATIONS.flatMap(residents => SPEEDS.map(speed => ({
      residents, speed,
      pairs: Array.from({ length: pairs }, (_, index) => ({
        baseline: "baseline-" + residents + "-" + speed + "x-" + (index + 1) + ".txt",
        candidate: "candidate-" + residents + "-" + speed + "x-" + (index + 1) + ".txt"
      }))
    })))
  };
}

function main(args) {
  let pairs = 3;
  let scene = SCENES[0];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--pairs" && i + 1 < args.length && /^\d+$/.test(args[i + 1])) {
      pairs = Number(args[++i]);
    } else if (args[i] === "--scene" && i + 1 < args.length) {
      scene = args[++i];
    } else {
      throw new Error("usage: [--pairs 3..10] [--scene exact-real-sprite-scene]");
    }
  }
  process.stdout.write(JSON.stringify(makeAndroidUiMatrixTemplate({ pairs, scene }), null, 2) + "\n");
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
