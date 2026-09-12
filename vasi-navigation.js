(function () {
  "use strict";

  const segments = location.pathname.split("/").filter(Boolean);
  const lastSegment = (segments.at(-1) || "").toLowerCase();
  const nestedIndex = ["admin", "publicity"].includes(lastSegment);
  const page = lastSegment.includes(".")
    ? lastSegment
    : (lastSegment && !nestedIndex ? `${lastSegment}.html` : "index.html");
  const parent = nestedIndex
    ? lastSegment
    : (segments.at(-2) || "").toLowerCase();

  const rootPages = new Set([
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
  ]);

  // The customer home screens and invisible redirect shims must not show a back
  // control. A nested index (admin/publicity) is still a secondary screen.
  if (rootPages.has(page) && !["admin", "publicity"].includes(parent)) return;

  const fallbacks = {
    "account.html": "index.html",
    "activity.html": "index.html",
    "admin-discounts.html": "vasi-admin.html",
    "admin-login.html": "index.html",
    "auth.html": "index.html",
    "business-account.html": "account.html",
    "contact.html": "index.html",
    "delete-account.html": "settings.html#privacy",
    "delivery-driver.html": "index.html",
    "delivery.html": "index.html",
    "driver.html": "index.html",
    "eats-checkout.html": "eats.html",
    "eats.html": "index.html",
    "eats-orders.html": "eats.html",
    "group-order.html": "eats.html",
    "help.html": "index.html",
    "legal.html": "index.html",
    "partner-admin.html": "vasi-admin.html",
    "partner-register-v2.html": "index.html",
    "partners.html": "index.html",
    "pricing-admin.html": "vasi-admin.html",
    "restaurant-admin.html": "vasi-admin.html",
    "restaurant-dashboard.html": "eats.html",
    "restaurant-register.html": "eats.html",
    "ride-chat.html": "ride-flow.html",
    "ride-flow.html": "index.html",
    "ride-history.html": "account.html",
    "safety.html": "index.html",
    "settings.html": "account.html",
    "share-ride.html": "index.html",
    "support-admin.html": "vasi-admin.html",
    "support.html": "index.html",
  };

  let fallback = fallbacks[page] || "index.html";
  if (parent === "website") fallback = "index.html";
  if (parent === "admin" || parent === "publicity") fallback = "../index.html";

  const labels = {
    fr: "Retour",
    en: "Back",
    ta: "பின்செல்",
    de: "Zurück",
    ar: "رجوع",
    hi: "वापस",
  };

  function currentLanguage() {
    const usesPageLanguage = document.body?.hasAttribute("data-fr-title") &&
      document.body?.hasAttribute("data-en-title");
    const stored = usesPageLanguage
      ? localStorage.getItem("vasiBusinessLanguage")
      : (localStorage.getItem("vasi_language") || localStorage.getItem("vasiBusinessLanguage"));
    return labels[stored] ? stored : (document.documentElement.lang || "fr").slice(0, 2).toLowerCase();
  }

  function updateLabel(control) {
    const label = labels[currentLanguage()] || labels.fr;
    control.setAttribute("aria-label", label);
    control.setAttribute("title", label);
    const text = control.querySelector(".vasi-return-text");
    if (text) text.textContent = label;
  }

  function hasInternalPreviousPage() {
    if (history.length <= 1 || !document.referrer) return false;
    try {
      const previous = new URL(document.referrer);
      return previous.origin === location.origin && previous.href !== location.href;
    } catch (_) {
      return false;
    }
  }

  function returnSafely() {
    if (hasInternalPreviousPage()) history.back();
    else location.href = fallback;
  }

  function install() {
    const explicit = document.querySelector(
      "[data-vasi-return], .back-btn, header .back, .top .back, a[aria-label*='Return' i], button[onclick*='history.back']"
    );
    const host = document.querySelector("header .header-inner, header, .top") || document.body;
    const control = explicit || document.createElement("button");

    if (!explicit) {
      control.type = "button";
      host.prepend(control);
      if (host === document.body) control.classList.add("vasi-return-floating");
    }

    control.classList.add("vasi-return-button");
    control.dataset.vasiReturn = "true";
    control.removeAttribute("onclick");
    if (control.tagName === "A") control.setAttribute("href", fallback);
    control.innerHTML = '<span class="vasi-return-icon" aria-hidden="true">‹</span><span class="vasi-return-text"></span>';
    updateLabel(control);

    control.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      returnSafely();
    }, true);

    window.addEventListener("vasi:languagechange", function () { updateLabel(control); });
    document.querySelectorAll("[data-lang]").forEach(function (button) {
      button.addEventListener("click", function () { setTimeout(function () { updateLabel(control); }, 0); });
    });
  }

  const style = document.createElement("style");
  style.textContent = `
    .vasi-return-button {
      flex: 0 0 auto !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 7px !important;
      width: auto !important;
      min-width: 44px !important;
      max-width: none !important;
      min-height: 44px !important;
      margin: 0 !important;
      padding: 0 13px 0 9px !important;
      border: 1px solid rgba(255,255,255,.18) !important;
      border-radius: 999px !important;
      background: #151515 !important;
      color: #fff !important;
      box-shadow: 0 7px 22px rgba(0,0,0,.16) !important;
      font: 800 14px/1 Inter, system-ui, sans-serif !important;
      text-decoration: none !important;
      cursor: pointer !important;
      touch-action: manipulation !important;
      -webkit-tap-highlight-color: transparent;
      z-index: 50;
    }
    .vasi-return-button:hover { background: #222 !important; }
    .vasi-return-button:focus-visible { outline: 3px solid #5b9cff !important; outline-offset: 2px !important; }
    .vasi-return-icon { font-size: 29px; font-weight: 500; line-height: 0; transform: translateY(-1px); }
    .vasi-return-floating {
      position: fixed !important;
      top: max(14px, env(safe-area-inset-top, 0px)) !important;
      left: max(14px, env(safe-area-inset-left, 0px)) !important;
    }
    @media (max-width: 390px) {
      .vasi-return-button { min-width: 44px !important; width: 44px !important; padding: 0 !important; }
      .vasi-return-text { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0,0,0,0) !important; white-space: nowrap !important; border: 0 !important; }
    }
  `;
  document.head.appendChild(style);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
