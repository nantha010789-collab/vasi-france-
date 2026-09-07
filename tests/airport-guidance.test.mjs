import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

async function loadAirports() {
  const source = await readFile("vasi-airports.js", "utf8");
  const context = {};
  runInNewContext(source, context);
  return context.VasiAirports;
}

test("France airport pickup helper detects CDG, Orly and Beauvais", async () => {
  const airports = await loadAirports();
  assert.equal(airports.detect({ address: "Paris Charles de Gaulle Airport" }), "CDG");
  assert.equal(airports.detect({ address: "Aéroport Paris-Orly" }), "ORY");
  assert.equal(airports.detect({ address: "Beauvais–Tillé Airport" }), "BVA");
  assert.equal(airports.detect({ lat: 49.0097, lng: 2.5479 }), "CDG");
  assert.equal(airports.detect({ address: "Gare du Nord, Paris" }), null);
});

test("terminal guidance returns current pickup steps without changing VASI branding", async () => {
  const airports = await loadAirports();
  const cdg = airports.guidance("CDG", "Terminal 3", "fr");
  assert.equal(cdg.terminal, "3");
  assert.equal(cdg.specific, true);
  assert.match(cdg.zone, /P3/);
  assert.match(cdg.steps.join(" "), /Transports terrestres/);
  assert.doesNotMatch([cdg.zone, ...cdg.steps, cdg.notice].join(" "), /Uber/i);

  const orly = airports.guidance("ORY", "2", "en");
  assert.equal(orly.specific, true);
  assert.match(orly.zone, /10a/i);
  assert.match(orly.mapUrl, /parisaeroport\.fr/);

  const beauvais = airports.guidance("BVA", "1", "fr");
  assert.equal(beauvais.specific, false);
  assert.match(beauvais.notice, /zones peuvent changer/i);
});

test("all supported airport terminals are offered for selection", async () => {
  const airports = await loadAirports();
  assert.deepEqual(Array.from(airports.guidance("CDG", "", "fr").terminals), ["1", "2A", "2B", "2C", "2D", "2E", "2F", "2G", "3"]);
  assert.deepEqual(Array.from(airports.guidance("ORY", "", "fr").terminals), ["1", "2", "3", "4"]);
  assert.deepEqual(Array.from(airports.guidance("BVA", "", "fr").terminals), ["1", "2"]);
});
