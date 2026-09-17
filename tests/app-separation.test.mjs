import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (file) => readFileSync(file, "utf8");

test("customer, driver and partner installs have distinct app identities", () => {
  const customer = JSON.parse(read("manifest.webmanifest"));
  const driver = JSON.parse(read("driver-manifest.webmanifest"));
  const partner = JSON.parse(read("partner-manifest.webmanifest"));

  assert.equal(customer.start_url, "./app.html");
  assert.equal(driver.start_url, "/driver-home.html?source=pwa");
  assert.equal(driver.launch_handler.client_mode, "navigate-existing");
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
  assert.match(auth, /standalone && driverRole && !document\.referrer/);
  assert.match(auth, /driver-home\.html\?source=legacy-shortcut/);
});

test("registered restaurant entry resumes the dashboard instead of onboarding", () => {
  const entry = read("restaurant-register.html");
  assert.match(entry, /response\.ok && result\.restaurant \? "restaurant-dashboard\.html" : "restaurant-register-form\.html"/);
  assert.match(read("restaurant-dashboard.html"), /partner-manifest\.webmanifest/);
  assert.match(read("restaurant-orders.html"), /partner-manifest\.webmanifest/);
});

test("driver, restaurant and admin surfaces use isolated login sessions", () => {
  const driverHome = read("driver-home.html");
  const driver = read("driver.html");
  const courier = read("delivery-driver.html");
  const partnerEntry = read("partner.html");
  const routes = read("vercel.json");
  const accountRole = read("vasi-account-role.js");
  const auth = read("auth.html");
  const adminLogin = read("admin-login.html");
  const adminApp = read("admin/app.js");

  assert.match(routes, /"source": "\/partner", "destination": "\/partner\.html"/);
  assert.match(partnerEntry, /VASI Partner · Restaurant/);
  assert.match(partnerEntry, /Se connecter à mon restaurant/);
  assert.match(partnerEntry, /storageKey: "vasi-partner-auth"/);
  assert.doesNotMatch(partnerEntry, /admin-login|driver-home|ride-flow/);
  assert.match(accountRole, /vasi_driver_session_role/);
  assert.match(accountRole, /vasi_partner_session_role/);
  assert.match(accountRole, /vasi_admin_session_role/);
  assert.match(accountRole, /scoped: createScope/);
  assert.match(auth, /storageKey: "vasi-partner-auth"/);
  assert.match(auth, /"vasi-driver-auth"/);
  assert.match(driverHome, /storageKey: "vasi-driver-auth"/);
  assert.match(driver, /storageKey: "vasi-driver-auth"/);
  assert.match(courier, /storageKey: "vasi-driver-auth"/);
  assert.match(adminLogin, /storageKey:'vasi-admin-auth'/);
  assert.match(adminApp, /storageKey:'vasi-admin-auth'/);
  assert.match(adminApp, /scoped\?\.\('admin'\)/);

  for (const file of [
    "restaurant-register.html",
    "restaurant-register-form.html",
    "restaurant-dashboard.html",
    "restaurant-orders.html",
  ]) {
    assert.match(read(file), /vasi-partner-auth/, file);
  }
});

test("driver workspaces use one fixed viewport with an internal responsive scroller", () => {
  const css = read("vasi-driver-shell.css");
  for (const file of ["driver.html", "delivery-driver.html"]) {
    const html = read(file);
    assert.match(html, /data-scroll-mode="viewport"/);
    assert.match(html, /class="driver-scroll" data-scroll-region/);
    assert.match(html, /vasi-driver-shell\.css/);
  }
  assert.match(css, /height: 100dvh !important/);
  assert.match(css, /overflow: hidden !important/);
  assert.match(css, /overflow-y: auto/);
  assert.match(css, /@media \(min-width: 760px\)/);
  assert.match(css, /@media \(max-height: 560px\) and \(orientation: landscape\)/);
});

test("driver entry stays in one branded viewport on phones and tablets", () => {
  const home = read("driver-home.html");
  const manifest = JSON.parse(read("driver-manifest.webmanifest"));

  assert.match(home, /height:100dvh/);
  assert.match(home, /html,body\{[^}]*overflow:hidden/);
  assert.match(home, /env\(safe-area-inset-top/);
  assert.match(home, /@media\(min-width:700px\)/);
  assert.match(home, /@media\(max-height:590px\)/);
  assert.match(home, /--blue:#1557ff/);
  assert.match(home, /--red:#ef3340/);
  assert.match(home, /assets\/vehicles\/go\.webp/);
  assert.match(home, /assets\/delivery-service\.webp/);
  assert.doesNotMatch(home, /--green|#72e394|#173522|#183a25/);
  assert.equal(manifest.theme_color, "#06183f");
});

test("restaurant entry stays fixed inside phone and tablet safe areas", () => {
  const partner = read("partner.html");

  assert.match(partner, /height: 100dvh/);
  assert.match(partner, /html, body \{[^}]*overflow: hidden/);
  assert.match(partner, /env\(safe-area-inset-top/);
  assert.match(partner, /grid-template-rows: auto minmax\(0, 1fr\) auto/);
  assert.match(partner, /@media \(min-width: 700px\)/);
  assert.match(partner, /@media \(max-height: 590px\) and \(min-width: 600px\)/);
  assert.match(partner, /class="workbench"/);
});

test("driver dashboard has a safe sign-in-free preview", () => {
  const home = read("driver-home.html");
  const auth = read("auth.html");
  const preview = read("driver-preview.html");

  assert.match(home, /href="driver-preview\.html"/);
  assert.match(auth, /id="driverPreview"[^>]+href="driver-preview\.html"/);
  assert.match(auth, /surface === "driver" && role === "ride"/);
  assert.match(preview, /Aperçu chauffeur/);
  assert.match(preview, /aucune donnée ou action réelle/);
  assert.doesNotMatch(preview, /supabase|vasi-driver-auth|\/api\//i);
});

test("ride acceptance has a safe sign-in-free live GPS demo", () => {
  const preview = read("driver-preview.html");
  const demo = read("ride-live-demo.html");
  const driver = read("driver.html");

  assert.match(preview, /location\.href = "ride-live-demo\.html"/);
  assert.match(demo, /id="driverPhase"/);
  assert.match(demo, /id="pickupPhase"/);
  assert.match(demo, /id="arrivedPhase"/);
  assert.match(demo, /id="tripPhase"/);
  assert.match(demo, /id="completePhase"/);
  assert.match(demo, /function driverAccepts\(\)/);
  assert.match(demo, /function driverArrives\(\)/);
  assert.match(demo, /function startTrip\(\)/);
  assert.match(demo, /function completeTrip\(\)/);
  assert.match(demo, /La navigation démarre dès l’acceptation/);
  assert.doesNotMatch(demo, /customerConfirms|customerPhase/);
  assert.doesNotMatch(demo, /supabase|\/api\//i);
  assert.match(driver, /id="driverNavigationMap"/);
  assert.match(driver, /function updateDriverNavigation\(/);
  assert.match(driver, /Recalcul automatique avec votre position GPS/);
  assert.match(driver, /vasi_driver_navigation_provider/);
  assert.match(driver, /<option value="vasi">VASI GPS<\/option>/);
  assert.match(driver, /return saved === "google" \|\| saved === "waze" \? saved : "vasi"/);
  assert.match(driver, /https:\/\/waze\.com\/ul\?/);
  assert.match(driver, /dir_action=navigate/);
  assert.match(driver, /launchCurrentNavigation\(\)/);
  assert.match(driver, /if \(navigationProvider\(\) === "vasi"\) focusCurrentNavigation\(\)/);
  assert.match(driver, /openExternalNavigation\('google'\)/);
  assert.match(driver, /openExternalNavigation\('waze'\)/);
  assert.match(demo, /openDemoNavigation\('google','pickup'\)/);
  assert.match(demo, /openDemoNavigation\('waze','destination'\)/);
});

test("offline shell includes every app manifest and shared installer", () => {
  const serviceWorker = read("sw.js");
  for (const asset of [
    "driver-home.html",
    "driver-preview.html",
    "driver.html",
    "delivery-driver.html",
    "vasi-driver-shell.css",
    "partner.html",
    "driver-manifest.webmanifest",
    "partner-manifest.webmanifest",
    "vasi-pwa.js",
  ]) {
    assert.match(serviceWorker, new RegExp(asset.replaceAll(".", "\\.")));
  }
});
