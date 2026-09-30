import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (file) => readFileSync(file, "utf8");

test("public website exposes clean about, privacy and terms routes", () => {
  const config = JSON.parse(read("vercel.json"));
  const routes = new Map(config.rewrites.map(({ source, destination }) => [source, destination]));

  assert.equal(routes.get("/about"), "/website/about");
  assert.equal(routes.get("/privacy"), "/website/privacy");
  assert.equal(routes.get("/terms"), "/website/terms");
});

test("public policy pages are bilingual and have stable canonical URLs", () => {
  for (const [file, canonical] of [
    ["website/about.html", "https://www.vasigo.eu/about"],
    ["website/privacy.html", "https://www.vasigo.eu/privacy"],
    ["website/terms.html", "https://www.vasigo.eu/terms"],
  ]) {
    const html = read(file);
    assert.match(html, new RegExp(`rel="canonical" href="${canonical.replaceAll(".", "\\.")}"`), file);
    assert.match(html, /data-lang="fr"/, file);
    assert.match(html, /data-lang="en"/, file);
    assert.match(html, /site-pages\.js/, file);
  }
});

test("about page identifies the founder and launch region", () => {
  const about = read("website/about.html");
  assert.match(about, /Sivakumar Vacsananthan/);
  assert.match(about, /Paris · Île-de-France/);
  assert.match(about, /pré-lancement|déploiement est progressif/i);
});

test("sitemap includes every public launch page", () => {
  const sitemap = read("sitemap.xml");
  for (const url of [
    "https://www.vasigo.eu/",
    "https://www.vasigo.eu/about",
    "https://www.vasigo.eu/privacy",
    "https://www.vasigo.eu/terms",
    "https://www.vasigo.eu/website/paris.html",
    "https://www.vasigo.eu/website/airports.html",
  ]) assert.match(sitemap, new RegExp(url.replaceAll(".", "\\.")));
});

test("homepage links to the public company and policy pages", () => {
  const home = read("website/index.html");
  assert.match(home, /href="\/about"/);
  assert.match(home, /href="\/privacy"/);
  assert.match(home, /href="\/terms"/);
});
