import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (file) => readFileSync(file, "utf8");

test("customer, driver and partner installs have distinct app identities", () => {
  const customer = JSON.parse(read("manifest.webmanifest"));
  const driver = JSON.parse(read("driver-manifest.webmanifest"));
  const partner = JSON.parse(read("partner-manifest.webmanifest"));

  assert.equal(customer.start_url, "./app.html");
  assert.equal(driver.start_url, "/driver");
  assert.equal(partner.start_url, "/partner");
  assert.equal(new Set([customer.id, driver.id, partner.id]).size, 3);
  assert.equal(driver.name, "VASI Driver");
  assert.equal(partner.name, "VASI Partner");
});

test("customer home contains no provider login or registration entry", () => {
  for (const file of ["app.html", "index.html"]) {
    const html = read(file);
    assert.doesNotMatch(html, /auth\.html\?role=(?:ride|courier|restaurant)/, file);
    assert.doesNotMatch(html, /restaurant-register\.html/, file);
  }
});

test("driver surface exposes only chauffeur and courier roles", () => {
  const home = read("driver-home.html");
  const auth = read("auth.html");
  assert.match(home, /role=ride&amp;surface=driver/);
  assert.match(home, /role=courier&amp;surface=driver/);
  assert.doesNotMatch(home, /role=restaurant/);
  assert.match(auth, /driver: new Set\(\["ride", "courier"\]\)/);
  assert.match(auth, /customer: new Set\(\["customer"\]\)/);
  assert.match(auth, /partner: new Set\(\["restaurant"\]\)/);
});

test("registered restaurant entry resumes the dashboard instead of onboarding", () => {
  const entry = read("restaurant-register.html");
  assert.match(entry, /response\.ok && result\.restaurant \? "restaurant-dashboard\.html" : "restaurant-register-form\.html"/);
  assert.match(read("restaurant-dashboard.html"), /partner-manifest\.webmanifest/);
  assert.match(read("restaurant-orders.html"), /partner-manifest\.webmanifest/);
});

test("offline shell includes every app manifest and shared installer", () => {
  const serviceWorker = read("sw.js");
  for (const asset of [
    "driver-home.html",
    "driver-manifest.webmanifest",
    "partner-manifest.webmanifest",
    "vasi-pwa.js",
  ]) {
    assert.match(serviceWorker, new RegExp(asset.replaceAll(".", "\\.")));
  }
});
