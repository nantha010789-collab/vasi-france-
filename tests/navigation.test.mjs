import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const secondaryPages = [
  "account.html",
  "activity.html",
  "admin-discounts.html",
  "admin-login.html",
  "auth.html",
  "business-account.html",
  "contact.html",
  "delete-account.html",
  "delivery-driver.html",
  "delivery.html",
  "driver.html",
  "eats-checkout.html",
  "eats.html",
  "group-order.html",
  "help.html",
  "legal.html",
  "partner-admin.html",
  "partner-register-v2.html",
  "partners.html",
  "pricing-admin.html",
  "restaurant-admin.html",
  "restaurant-dashboard.html",
  "restaurant-register.html",
  "ride-chat.html",
  "ride-flow.html",
  "ride-history.html",
  "safety.html",
  "settings.html",
  "share-ride.html",
  "support-admin.html",
  "support.html",
];

const nestedSecondaryPages = [
  "admin/index.html",
  "publicity/index.html",
  "website/contact.html",
  "website/help.html",
  "website/legal.html",
  "website/partners.html",
];

test("every secondary VASI page loads the shared return control", () => {
  for (const file of secondaryPages) {
    const html = readFileSync(file, "utf8");
    assert.match(html, /<script src="\.\/vasi-navigation\.js\?v=\d+"><\/script>/, file);
  }

  for (const file of nestedSecondaryPages) {
    const html = readFileSync(file, "utf8");
    assert.match(html, /<script src="\.\.\/vasi-navigation\.js\?v=\d+"><\/script>/, file);
  }
});

test("home and redirect-only pages do not show a misleading return control", () => {
  for (const file of [
    "index.html",
    "app.html",
    "404.html",
    "app-easy.html",
    "app-fixed.html",
    "partner-register.html",
    "vasi-admin.html",
    "vasi-app.html",
    "vasi-clean-start.html",
    "vasi-flow.html",
    "vasi-new.html",
    "vasi-rich.html",
    "vasi-ui.html",
    "vasi.html",
    "website/index.html",
  ]) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /vasi-navigation\.js/, file);
  }
});

test("the shared return control is valid JavaScript and has safe navigation rules", () => {
  const source = readFileSync("vasi-navigation.js", "utf8");
  assert.doesNotThrow(() => new vm.Script(source));
  assert.match(source, /previous\.origin === location\.origin/);
  assert.match(source, /history\.length <= 1/);
  assert.match(source, /\["admin", "publicity"\]\.includes\(lastSegment\)/);
  assert.doesNotMatch(source, /nestedIndex[^;]+segments\.length === 1/);
  assert.match(source, /"eats-checkout\.html": "eats\.html"/);
  assert.match(source, /"settings\.html": "account\.html"/);
  assert.match(source, /"admin-login\.html": "index\.html"/);
  assert.match(source, /min-width: 44px/);
  assert.match(source, /aria-label/);
});

test("the return control is available in the offline app cache", () => {
  assert.match(readFileSync("sw.js", "utf8"), /appUrl\("vasi-navigation\.js"\)/);
});
