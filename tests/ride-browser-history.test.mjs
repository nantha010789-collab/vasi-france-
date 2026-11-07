import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("ride booking records each step in browser history and restores it on Back", async () => {
  const source = await readFile(new URL("../ride-flow.html", import.meta.url), "utf8");

  assert.match(source, /function setBookingStep\(step, trackHistory = false\)/);
  assert.match(source, /history\.pushState\([\s\S]*vasiRideBookingStep: step/);
  assert.match(source, /window\.addEventListener\("popstate", \(event\) => \{/);
  assert.match(source, /setBookingStep\(step\);\s*\n\s*\}\);/);
  assert.match(source, /setBookingStep\("options", true\)/);
  assert.match(source, /setBookingStep\("payment", true\)/);
  assert.match(source, /window\.history\.back\(\);/);
});
