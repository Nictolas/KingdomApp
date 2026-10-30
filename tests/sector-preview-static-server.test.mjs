import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findStaticPreviewFile } from "./sector-preview-static-server.mjs";

async function fixture(fn) {
  const root = await mkdtemp(join(tmpdir(), "sector-preview-static-"));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}

test("Expo static HTML route wins over index.html SPA fallback", async () => fixture(async root => {
  await writeFile(join(root, "index.html"), "home");
  await writeFile(join(root, "settori-preview.html"), "sector");
  assert.equal(await findStaticPreviewFile(root, "/settori-preview"), join(root, "settori-preview.html"));
  assert.equal(await findStaticPreviewFile(root, "/"), join(root, "index.html"));
}));
test("nested static route is supported, then SPA fallback", async () => fixture(async root => {
  await writeFile(join(root, "index.html"), "home");
  await mkdir(join(root, "settori-preview"));
  await writeFile(join(root, "settori-preview", "index.html"), "sector");
  assert.equal(await findStaticPreviewFile(root, "/settori-preview"), join(root, "settori-preview", "index.html"));
  assert.equal(await findStaticPreviewFile(root, "/other-screen"), join(root, "index.html"));
}));
test("missing scripts must be 404 rather than serving index HTML", async () => fixture(async root => {
  await writeFile(join(root, "index.html"), "home");
  await mkdir(join(root, "assets"));
  await writeFile(join(root, "assets", "app.js"), "script");
  assert.equal(await findStaticPreviewFile(root, "/assets/app.js"), join(root, "assets", "app.js"));
  assert.equal(await findStaticPreviewFile(root, "/assets/missing.js"), null);
  assert.equal(await findStaticPreviewFile(root, "/missing.png"), null);
}));
test("path traversal and relative paths are rejected", async () => fixture(async root => {
  await assert.rejects(findStaticPreviewFile(root, "/%2e%2e/%2e%2e/secrets.txt"), /escapes/);
  await assert.rejects(findStaticPreviewFile(root, "settori-preview"), /absolute/);
}));
