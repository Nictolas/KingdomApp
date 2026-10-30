// Browser-rendered regression for the isolated preview. This is NOT an Android/iPhone device test.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { chromium } from "playwright";

const root = resolve(process.argv[2] || "/tmp/fixed-sector-preview-browser-web");
const screenshots = resolve(process.env.PREVIEW_SCREENSHOT_DIR || "/tmp/fixed-sector-preview-screenshots");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
await mkdir(screenshots, { recursive: true });

const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url || "/", "http://localhost").pathname);
    const requested = resolve(root, "." + pathname);
    if (requested !== root && !requested.startsWith(root + sep)) throw Error("Invalid path");
    let file = requested;
    try {
      if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    } catch {
      // Expo Router's web export may be SPA; fall back for /settori-preview.
      file = join(root, "index.html");
    }
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
await new Promise((ok, fail) => {
  server.once("error", fail);
  server.listen(0, "127.0.0.1", ok);
});
const port = server.address().port;
let browser;
const sizes = [[320,568],[375,667],[390,844],[430,932],[667,375],[844,390],[1024,768]];
try {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  for (const [width, height] of sizes) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(String(error)));
    try {
      await page.goto("http://127.0.0.1:" + port + "/settori-preview", { waitUntil: "domcontentloaded" });
      await page.getByTestId("sector-preview-grid").waitFor({ state: "visible", timeout: 30000 });
      await page.getByRole("button", { name: "Elemento successivo" }).click();
      await page.getByTestId("sector-preview-selection").getByText("Castello reale").waitFor();
      const rect = await page.evaluate(() => {
        const box = id => {
          const node = document.querySelector('[data-testid="' + id + '"]');
          if (!node) throw Error("Missing " + id);
          const r = node.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height,
            right: r.right, bottom: r.bottom, top: r.top };
        };
        return { grid: box("sector-preview-grid"), nav: box("sector-preview-navigation"),
          footer: box("sector-preview-footer"), root: box("sector-preview-root"),
          viewport: { width: innerWidth, height: innerHeight } };
      });
      assert.ok(rect.grid.width > 0 && rect.grid.height > 0, "Map missing " + width + "x" + height);
      assert.ok(Math.abs(rect.grid.width / 16 - rect.grid.height / 24) < 0.1,
        "Non-square 16x24 cells at " + width + "x" + height);
      assert.ok(rect.grid.x >= -1 && rect.grid.right <= width + 1 &&
        rect.grid.y >= -1 && rect.grid.bottom <= height + 1, "Map clipped at " + width + "x" + height);
      assert.ok(rect.grid.bottom <= rect.nav.top + 1, "Arrows overlap map at " + width + "x" + height);
      assert.ok(rect.footer.bottom <= height + 1, "Footer clipped at " + width + "x" + height);
      assert.ok(rect.nav.bottom <= rect.footer.top + 1, "Navigation overlaps footer at " + width + "x" + height);
      const scroll = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight,
        viewportWidth: innerWidth, viewportHeight: innerHeight
      }));
      assert.ok(scroll.width <= width + 1 && scroll.height <= height + 1,
        "Unexpected document scroll at " + width + "x" + height + ": " + JSON.stringify(scroll));
      for (const direction of ["nord", "sud", "est", "ovest"]) {
        const button = page.getByRole("button", { name: "Settore " + direction });
        const box = await button.boundingBox();
        assert.ok(box && box.width >= 43 && box.height >= 43,
          "Direction tap target too small: " + direction + " " + width + "x" + height);
      }
      for (const name of ["Elemento precedente", "Elemento successivo"]) {
        const box = await page.getByRole("button", { name }).boundingBox();
        assert.ok(box && box.width >= 43 && box.height >= 43,
          "Selection tap target too small: " + name + " " + width + "x" + height);
      }
      // The minimap must be a 3×3 cross, not a wrapped 2-column strip.
      const mini = await page.evaluate(() => {
        const root = document.querySelector('[data-testid="sector-preview-minimap"]');
        if (!root) throw Error("Minimap missing");
        return Array.from(root.children, el => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        });
      });
      assert.equal(mini.length, 9, "Expected nine minimap slots");
      for (let i = 0; i < 9; i++) {
        assert.ok(Math.abs(mini[i].y - mini[Math.floor(i / 3) * 3].y) <= 1,
          "Minimap wraps within row at " + width + "x" + height + " index " + i);
        assert.ok(Math.abs(mini[i].x - mini[i % 3].x) <= 1,
          "Minimap column misaligned at " + width + "x" + height + " index " + i);
      }
      await page.screenshot({ path: join(screenshots, "sector-center-" + width + "x" + height + ".png") });
      await page.getByRole("button", { name: "Settore nord" }).click();
      await page.getByText("NORD · BOSCO", { exact: true }).waitFor({ state: "visible" });
      assert.ok(await page.getByRole("button", { name: "Settore nord" }).isDisabled(),
        "North arrow should be disabled at the northern boundary");
      await page.getByRole("button", { name: "Settore sud" }).click();
      await page.getByText("CENTRO CITTÀ", { exact: true }).waitFor({ state: "visible" });
      for (const [label, title] of [
        ["Nord · Bosco","NORD · BOSCO"], ["Sud · Fattorie","SUD · FATTORIE"],
        ["Est · Mercato","EST · MERCATO"], ["Ovest · Quartiere","OVEST · QUARTIERE"],
        ["Centro città","CENTRO CITTÀ"]
      ]) {
        await page.getByRole("button", { name: "Vai a " + label }).click();
        await page.getByText(title, { exact: true }).waitFor({ state: "visible" });
        const newGrid = await page.getByTestId("sector-preview-grid").boundingBox();
        assert.ok(newGrid && Math.abs(newGrid.width / 16 - newGrid.height / 24) < 0.1,
          "Sector grid distorted after navigation at " + width + "x" + height);
        assert.ok(newGrid.x >= -1 && newGrid.y >= -1 &&
          newGrid.x + newGrid.width <= width + 1 &&
          newGrid.y + newGrid.height <= height + 1,
          "Sector grid clipped after navigation: " + label + " " + width + "x" + height);
        await page.screenshot({ path: join(screenshots,
          "sector-" + label.split(" ")[0].toLowerCase() + "-" + width + "x" + height + ".png") });
      }
      assert.equal(pageErrors.length, 0, "Runtime errors: " + pageErrors.join("; "));
      console.log("PASS web Chromium " + width + "x" + height + ": grid, arrows, footer, selection, five sectors");
    } catch (error) {
      await page.screenshot({ path: join(screenshots, "sector-FAILED-" + width + "x" + height + ".png") }).catch(() => {});
      throw error;
    } finally {
      await page.close();
    }
  }
} finally {
  if (browser) await browser.close();
  await new Promise(ok => server.close(ok));
}
