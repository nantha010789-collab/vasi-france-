import assert from "node:assert/strict";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { test } from "node:test";
import vm from "node:vm";

const root = process.cwd();

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === ".git" || entry.name === "node_modules") return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const htmlFiles = walk(root).filter((file) => file.endsWith(".html"));
const appBrandFiles = [
  "app.html",
  "index.html",
  "contact.html",
  "help.html",
  "legal.html",
  "partners.html",
  "vasi-languages.js",
].map((file) => join(root, file));

const supportFiles = [
  "auth.html",
  "contact.html",
  "legal.html",
  "support.html",
  "tests/live-smoke.mjs",
].map((file) => join(root, file));

function localTargetExists(page, rawTarget) {
  if (
    !rawTarget ||
    rawTarget.startsWith("#") ||
    /^(?:https?:|mailto:|tel:|sms:|data:|blob:|javascript:|\/\/)/i.test(rawTarget) ||
    /[${}]/.test(rawTarget)
  ) {
    return true;
  }

  const target = decodeURIComponent(rawTarget.split(/[?#]/, 1)[0]);
  if (!target) return true;

  if (target.startsWith("/api/")) {
    return existsSync(join(root, `${target.slice(1)}.js`));
  }

  const resolved = target.startsWith("/")
    ? resolve(root, `.${target}`)
    : resolve(dirname(page), target);
  if (!normalize(resolved).startsWith(normalize(root))) return false;
  if (existsSync(resolved)) {
    return !statSync(resolved).isDirectory() || existsSync(join(resolved, "index.html"));
  }
  if (!extname(resolved) && existsSync(`${resolved}.html`)) return true;
  return false;
}

test("every static page reference resolves to a real local route or asset", () => {
  const failures = [];
  const referencePattern = /\b(?:href|src)\s*=\s*["']([^"'<>]+)["']/gi;

  for (const page of htmlFiles) {
    const html = readFileSync(page, "utf8");
    for (const match of html.matchAll(referencePattern)) {
      if (!localTargetExists(page, match[1])) {
        failures.push(`${page.slice(root.length + 1)} -> ${match[1]}`);
      }
    }
  }

  assert.deepEqual(failures, []);
});

test("inline page scripts contain valid JavaScript", () => {
  const failures = [];
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

  for (const page of htmlFiles) {
    const html = readFileSync(page, "utf8");
    for (const [index, match] of [...html.matchAll(scriptPattern)].entries()) {
      const attributes = match[1];
      if (/\bsrc\s*=/i.test(attributes) || /\btype=["']application\/ld\+json["']/i.test(attributes)) continue;
      try {
        new vm.Script(match[2], { filename: `${page}#script-${index + 1}` });
      } catch (error) {
        failures.push(String(error));
      }
    }
  }

  assert.deepEqual(failures, []);
});

test("static page element IDs are unique", () => {
  const failures = [];
  const idPattern = /\bid\s*=\s*["']([^"']+)["']/gi;

  for (const page of htmlFiles) {
    const html = readFileSync(page, "utf8");
    const seen = new Set();
    for (const match of html.matchAll(idPattern)) {
      if (/[${}]/.test(match[1])) continue;
      if (seen.has(match[1])) failures.push(`${page.slice(root.length + 1)} -> #${match[1]}`);
      seen.add(match[1]);
    }
  }

  assert.deepEqual(failures, []);
});

test("every HTML page declares its document language", () => {
  const failures = htmlFiles
    .filter((page) => !/<html\b[^>]*\blang=["'][a-z]{2}(?:-[A-Z]{2})?["']/i.test(readFileSync(page, "utf8")))
    .map((page) => page.slice(root.length + 1));

  assert.deepEqual(failures, []);
});

test("public French branding consistently uses Eats", () => {
  const outdatedBranding = [
    /["']Eats["']\s*:\s*["']Repas["']/i,
    /VASI pour vos trajets,\s*repas et livraisons/i,
    /<strong>\s*Repas\s*<\/strong>/i,
  ];
  const failures = appBrandFiles.flatMap((file) => {
    const source = readFileSync(file, "utf8");
    return outdatedBranding.some((pattern) => pattern.test(source))
      ? [file.slice(root.length + 1)]
      : [];
  });
  assert.deepEqual(failures, []);
});

test("public support links use the current VASI email", () => {
  const failures = supportFiles
    .filter((file) => /contact@vasi\.eu/i.test(readFileSync(file, "utf8")))
    .map((file) => file.slice(root.length + 1));
  assert.deepEqual(failures, []);
});
