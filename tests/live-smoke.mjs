import assert from "node:assert/strict";

const production = "https://vasi-new.vercel.app";
const pages = "https://nantha010789-collab.github.io/vasi-france-";

async function fetchWithRetry(url, options = {}, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(25_000),
        ...options,
      });
      if (response.status < 500) return response;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 5_000));
  }
  throw lastError;
}

async function eventually(check, attempts = 6) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await check();
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 5_000));
  }
  throw lastError;
}

async function expectPage(base, path, markers) {
  const url = new URL(path, base);
  console.log(`Checking ${url}`);
  await eventually(async () => {
    const response = await fetchWithRetry(url);
    assert.equal(response.status, 200, `${url} must return 200`);
    const html = await response.text();
    for (const marker of markers) {
      assert.ok(html.includes(marker), `${url} must contain ${marker}`);
    }
  });
}

const checks = [
  (async () => {
    await eventually(async () => {
      const response = await fetchWithRetry(`${production}/`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.equal(response.headers.get("x-frame-options"), "DENY");
      assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
      assert.match(response.headers.get("content-security-policy") || "", /frame-ancestors 'none'/);
      assert.match(response.headers.get("permissions-policy") || "", /geolocation=\(self\)/);
      const html = await response.text();
      for (const marker of ["Move.", "vasi-notifications.js", "vasi-languages.js", "apple-touch-icon"]) {
        assert.ok(html.includes(marker), `${production}/ must contain ${marker}`);
      }
    });
  })(),
  expectPage(production, "/ride-chat.html", ["callButton", "vasi-call.js", "remoteAudio"]),
  expectPage(production, "/auth.html", ["vasi_pending_phone", "otp_expired"]),
  expectPage(production, "/settings.html", ["testNotification", "VASI test successful"]),
  expectPage(production, "/vasi-languages.js", ["fr:", "ta:", "de:", "ar:", "hi:"]),
  expectPage(production, "/manifest.webmanifest", ["vasi-icon-192.png", "vasi-icon-512.png"]),
  expectPage(production, "/vasi-clean-start.html", ["location.replace(\"index.html\")"]),
  expectPage(pages, "/vasi-france-/", ["Move.", "vasi-notifications.js"]),
  expectPage(pages, "/vasi-france-/ride-chat.html", ["callButton", "vasi-call.js"]),
  expectPage(pages, "/vasi-france-/manifest.webmanifest", ["vasi-icon-192.png", "vasi-icon-512.png"]),
  (async () => {
    const callConfig = await fetchWithRetry(`${production}/api/call-config`, { redirect: "manual" });
    assert.equal(callConfig.status, 401, "call configuration must reject unauthenticated requests");
    assert.match(callConfig.headers.get("cache-control") || "", /no-store/);
  })(),
];
await Promise.all(checks);

console.log("VASI production smoke test passed.");
