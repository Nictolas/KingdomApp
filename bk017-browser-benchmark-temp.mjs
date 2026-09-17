import { chromium } from 'playwright-core';

const executablePath = process.env.CHROME_PATH;
if (!executablePath) throw new Error('Chrome executable not found');

const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

async function frameStats(page, durationMs) {
  return page.evaluate((duration) => new Promise((resolve) => {
    const deltas = [];
    let start = null;
    let previous = null;
    const tick = (now) => {
      if (start === null) {
        start = now;
        previous = now;
      } else {
        deltas.push(now - previous);
        previous = now;
      }
      if (now - start < duration) {
        requestAnimationFrame(tick);
        return;
      }
      const sorted = [...deltas].sort((a, b) => a - b);
      const avg = deltas.reduce((sum, value) => sum + value, 0) / Math.max(1, deltas.length);
      const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
      resolve({
        frames: deltas.length,
        fps: Number((1000 / avg).toFixed(2)),
        avgMs: Number(avg.toFixed(3)),
        p95Ms: Number(percentile(0.95).toFixed(3)),
        p99Ms: Number(percentile(0.99).toFixed(3)),
        maxMs: Number((sorted.at(-1) ?? 0).toFixed(3)),
        over25ms: deltas.filter((d) => d > 25).length,
        over33ms: deltas.filter((d) => d > 33.34).length,
        over50ms: deltas.filter((d) => d > 50).length
      });
    };
    requestAnimationFrame(tick);
  }), durationMs);
}

async function runPan(page, canvas) {
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas has no bounding box');
  const x0 = box.x + box.width * 0.30;
  const x1 = box.x + box.width * 0.70;
  const y0 = box.y + box.height * 0.35;
  const y1 = box.y + box.height * 0.65;
  const sample = frameStats(page, 3200);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 0; i < 180; i++) {
    const phase = i / 179;
    const x = i % 2 === 0 ? x0 + (x1 - x0) * phase : x1 - (x1 - x0) * phase;
    const y = y0 + (y1 - y0) * (0.5 + 0.5 * Math.sin(i / 9));
    await page.mouse.move(x, y);
    await page.waitForTimeout(10);
  }
  await page.mouse.up();
  return sample;
}

async function runZoom(page, canvas) {
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas has no bounding box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const sample = frameStats(page, 3200);
  for (let i = 0; i < 36; i++) {
    await page.mouse.wheel(0, i < 18 ? -90 : 90);
    await page.waitForTimeout(45);
  }
  return sample;
}

function medianMetric(runs, key) {
  const values = runs.map((run) => run[key]).sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
}

function summarize(runs) {
  const keys = ['fps', 'avgMs', 'p95Ms', 'p99Ms', 'maxMs', 'over25ms', 'over33ms', 'over50ms'];
  return Object.fromEntries(keys.map((key) => [key, medianMetric(runs, key)]));
}

async function bench(url, label, cpuRate) {
  const scenarios = { idle: [], pan: [], zoom: [] };
  let diagnostics = null;
  for (let run = 0; run < 3; run++) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });
    if (cpuRate > 1) {
      const client = await page.context().newCDPSession(page);
      await client.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
    }
    await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(2500);
    const canvases = page.locator('canvas');
    const count = await canvases.count();
    if (count === 0) {
      const body = (await page.locator('body').innerText()).slice(0, 2000);
      throw new Error(`${label}: no canvas found. Body: ${body}`);
    }
    let canvas = canvases.first();
    let maxArea = -1;
    for (let i = 0; i < count; i++) {
      const candidate = canvases.nth(i);
      const box = await candidate.boundingBox();
      const area = box ? box.width * box.height : 0;
      if (area > maxArea) {
        maxArea = area;
        canvas = candidate;
      }
    }
    if (!diagnostics) {
      diagnostics = {
        canvasCount: count,
        canvasArea: Math.round(maxArea),
        bodyText: (await page.locator('body').innerText()).slice(0, 600),
        errors
      };
    }
    scenarios.idle.push(await frameStats(page, 3200));
    scenarios.pan.push(await runPan(page, canvas));
    await page.waitForTimeout(500);
    scenarios.zoom.push(await runZoom(page, canvas));
    await page.close();
  }
  return {
    label,
    cpuRate,
    diagnostics,
    raw: scenarios,
    median: {
      idle: summarize(scenarios.idle),
      pan: summarize(scenarios.pan),
      zoom: summarize(scenarios.zoom)
    }
  };
}

const suites = [];
for (const cpuRate of [1, 4]) {
  suites.push(await bench('http://127.0.0.1:4173/', 'PR57-before', cpuRate));
  suites.push(await bench('http://127.0.0.1:4174/', 'PR58-after', cpuRate));
}

console.log('BK017_BROWSER_BENCHMARK');
console.log(JSON.stringify(suites, null, 2));
await browser.close();
