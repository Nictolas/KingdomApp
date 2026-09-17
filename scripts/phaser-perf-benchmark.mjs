import { chromium } from "playwright";

const baseUrl = process.env.KINGDOM_BENCHMARK_URL ?? "http://127.0.0.1:4173";
const warmupMs = Number(process.env.KINGDOM_BENCHMARK_WARMUP_MS ?? 2500);
const sampleMs = Number(process.env.KINGDOM_BENCHMARK_SAMPLE_MS ?? 5000);
const minSamples = Number(process.env.KINGDOM_BENCHMARK_MIN_SAMPLES ?? 30);
const maxScenarioMs = Number(process.env.KINGDOM_BENCHMARK_MAX_SCENARIO_MS ?? 15000);

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await context.addInitScript(() => {
  globalThis.__KINGDOM_PERF_REQUESTED__ = true;
});

async function currentMetrics(page) {
  return page.evaluate(() => {
    const live = globalThis.__KINGDOM_PERF_SNAPSHOT__?.();
    return live ?? globalThis.__KINGDOM_PERF__ ?? null;
  });
}

async function openScenario() {
  const page = await context.newPage();
  const diagnostics = [];
  page.on("pageerror", (error) => diagnostics.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.push(`console.error: ${message.text()}`);
  });
  await page.goto(`${baseUrl}/?perf=1`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForSelector("canvas", { timeout: 120_000 });
  try {
    await page.waitForFunction(
      () => {
        const metrics = globalThis.__KINGDOM_PERF_SNAPSHOT__?.() ?? globalThis.__KINGDOM_PERF__;
        return (metrics?.sampleCount ?? 0) >= 10;
      },
      null,
      { timeout: 90_000 }
    );
  } catch (error) {
    console.error("Benchmark bootstrap failed", {
      url: page.url(),
      diagnostics,
      body: (await page.locator("body").innerText().catch(() => "")).slice(0, 4000),
      requested: await page.evaluate(() => globalThis.__KINGDOM_PERF_REQUESTED__ ?? null),
      metrics: await currentMetrics(page)
    });
    throw error;
  }
  await page.waitForTimeout(warmupMs);
  await page.evaluate(() => globalThis.__KINGDOM_PERF_RESET__?.());
  return page;
}

async function waitForIdleMetrics(page, scenario) {
  const startedAt = Date.now();
  const minimumEndAt = startedAt + sampleMs;
  const deadline = startedAt + Math.max(sampleMs, maxScenarioMs);

  while (Date.now() < deadline) {
    if (Date.now() >= minimumEndAt) {
      const metrics = await currentMetrics(page);
      if (metrics?.sampleCount >= minSamples) return { scenario, ...metrics };
    }
    await page.waitForTimeout(100);
  }

  const metrics = await currentMetrics(page);
  throw new Error(
    `No usable performance sample for ${scenario}: ${metrics?.sampleCount ?? 0}/${minSamples} samples after ${Date.now() - startedAt} ms`
  );
}

async function idleScenario() {
  const page = await openScenario();
  const result = await waitForIdleMetrics(page, "idle");
  await page.close();
  return result;
}

async function panScenario() {
  const page = await openScenario();
  const canvas = page.locator("canvas").last();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Phaser canvas has no bounding box");
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const startedAt = Date.now();
  const minimumEndAt = startedAt + sampleMs;
  const deadline = startedAt + Math.max(sampleMs, maxScenarioMs);
  let direction = 1;

  while (Date.now() < deadline) {
    await page.mouse.move(centerX - 180 * direction, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 180 * direction, centerY + 80 * direction, { steps: 10 });
    await page.mouse.up();
    direction *= -1;

    if (Date.now() >= minimumEndAt) {
      const metrics = await currentMetrics(page);
      if (metrics?.sampleCount >= minSamples) {
        await page.close();
        return { scenario: "pan", ...metrics };
      }
    }
  }

  const metrics = await currentMetrics(page);
  await page.close();
  throw new Error(
    `No usable performance sample for pan: ${metrics?.sampleCount ?? 0}/${minSamples} samples after ${Date.now() - startedAt} ms`
  );
}

async function zoomScenario() {
  const page = await openScenario();
  const canvas = page.locator("canvas").last();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Phaser canvas has no bounding box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const startedAt = Date.now();
  const minimumEndAt = startedAt + sampleMs;
  const deadline = startedAt + Math.max(sampleMs, maxScenarioMs);
  let direction = 1;

  while (Date.now() < deadline) {
    await page.mouse.wheel(0, 180 * direction);
    direction *= -1;
    await page.waitForTimeout(80);

    if (Date.now() >= minimumEndAt) {
      const metrics = await currentMetrics(page);
      if (metrics?.sampleCount >= minSamples) {
        await page.close();
        return { scenario: "zoom", ...metrics };
      }
    }
  }

  const metrics = await currentMetrics(page);
  await page.close();
  throw new Error(
    `No usable performance sample for zoom: ${metrics?.sampleCount ?? 0}/${minSamples} samples after ${Date.now() - startedAt} ms`
  );
}

try {
  const results = [await idleScenario(), await panScenario(), await zoomScenario()];
  console.log("BK017_PERF_RESULTS=" + JSON.stringify(results));
  console.table(results.map(({ scenario, meanFps, meanFrameMs, p95FrameMs, framesOver33Ms, framesOver50Ms, sampleCount }) => ({
    scenario,
    meanFps,
    meanFrameMs,
    p95FrameMs,
    framesOver33Ms,
    framesOver50Ms,
    sampleCount
  })));
} finally {
  await browser.close();
}
