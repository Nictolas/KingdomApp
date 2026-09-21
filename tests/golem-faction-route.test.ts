import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("la fazione Golem usa la route /fazione/golem", () => {
  const fazioni = readFileSync("app/fazioni.tsx", "utf8");
  const slug = readFileSync("app/fazione/[slug].tsx", "utf8");

  assert.match(fazioni, /Golem: "\/fazione\/golem"/);
  assert.doesNotMatch(fazioni, /\/fazione\/robots/);
  assert.match(slug, /golem: "Golem"/);
  assert.doesNotMatch(slug, /robots: "Golem"/);
});
