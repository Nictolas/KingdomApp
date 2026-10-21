import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync("src/ui/CreazioneGiocatoreModal.tsx", "utf8");

test("mobile web creator locks the underlying page without resizing with the keyboard", () => {
  assert.match(source, /body\.style\.position = "fixed"/);
  assert.match(source, /html\.style\.overflow = "hidden"/);
  assert.match(source, /setWebModalHeight\(window\.innerHeight\)/);
  assert.match(source, /Math\.abs\(window\.innerWidth - lastWidth\) > 48/);
  assert.match(source, /height: webModalHeight, flex: 0/);
  assert.match(source, /body\.style\.position = previous\.position/);
  assert.match(source, /window\.scrollTo\(0, scrollY\)/);
});

test("mobile Safari name fields do not trigger input autozoom or hide the preview", () => {
  assert.match(source, /inputMobileWeb: \{ fontSize: 16 \}/);
  assert.match(source, /Platform\.OS === "web" && !isDesktop && styles\.inputMobileWeb\]\} value=\{nome\}/);
  assert.match(source, /Platform\.OS === "web" && !isDesktop && styles\.inputMobileWeb\]\} value=\{cognome\}/);
  assert.match(source, /!textInputFocused \|\| isDesktop \|\| Platform\.OS === "web"/);
});
