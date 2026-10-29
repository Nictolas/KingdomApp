import { performance } from "node:perf_hooks";
import { nativeResidentNeedsTouchRender } from "../src/performance/nativeResidentTouchRenderGate";

const passThrough = (cell: number) => cell % 40 < 3;
const rounds = 5;
const results: Array<{ baselineMs: number; gatedMs: number; baselineRenders: number; gatedRenders: number }> = [];
function run(gated: boolean) {
  let renders = 0;
  const start = performance.now();
  for (let resident = 0; resident < 200; resident++) {
    let prev: number | null = null;
    const spawn = resident * 2;
    for (let leg = 0; leg <= 240; leg++) {
      const next = leg % 2 === 0 ? spawn : spawn + 1;
      if (!gated || nativeResidentNeedsTouchRender(prev, next, passThrough)) renders++;
      prev = next;
    }
  }
  return { ms: performance.now() - start, renders };
}
for (let i = 0; i < rounds; i++) {
  const first = run(i % 2 === 0), second = run(i % 2 !== 0);
  const baseline = i % 2 === 0 ? first : second;
  const gated = i % 2 === 0 ? second : first;
  results.push({ baselineMs: baseline.ms, gatedMs: gated.ms, baselineRenders: baseline.renders, gatedRenders: gated.renders });
}
const middle = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
const baseline = results[0]!.baselineRenders, gated = results[0]!.gatedRenders;
if (!results.every(r => r.baselineRenders === baseline && r.gatedRenders === gated)) throw Error("Inconsistent render-count model");
console.log(JSON.stringify({ model: "Node-only touch-policy decisions, NOT React commits or device FPS", residents: 200, legsPerResident: 240, baselineDecisions: baseline, gatedDecisions: gated, medianBaselineMs: middle(results.map(r => r.baselineMs)), medianGatedMs: middle(results.map(r => r.gatedMs)) }));
