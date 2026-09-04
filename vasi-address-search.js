(function () {
  "use strict";

  const API_ORIGIN = location.hostname.endsWith(".github.io")
    ? "https://vasi-new.vercel.app"
    : "";
  const translate = (text) => window.VasiLanguage?.translate?.(text) || text;

  function request(body) {
    return fetch(API_ORIGIN + "/api/places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Address search is unavailable");
      return data;
    });
  }

  function attach(options) {
    const input = typeof options.input === "string"
      ? document.querySelector(options.input)
      : options.input;
    if (!input) throw new Error("Address input not found");

    const shell = input.closest(".vasi-address-shell") || input.parentElement;
    const list = typeof options.suggestions === "string"
      ? document.querySelector(options.suggestions)
      : options.suggestions || shell.querySelector(".vasi-address-suggestions");
    const confirmation = typeof options.confirmation === "string"
      ? document.querySelector(options.confirmation)
      : options.confirmation || shell.querySelector(".vasi-address-confirmation");
    const status = typeof options.status === "string"
      ? document.querySelector(options.status)
      : options.status || shell.querySelector(".vasi-address-status");
    if (!list || !confirmation) throw new Error("Address search UI is incomplete");

    const listId = list.id || `vasi-address-list-${Math.random().toString(36).slice(2)}`;
    list.id = listId;
    list.setAttribute("role", "listbox");
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", listId);
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("autocapitalize", "words");
    input.setAttribute("spellcheck", "false");

    let selected = null;
    let suggestions = [];
    let activeIndex = -1;
    let timer = null;
    let requestNumber = 0;

    const message = (text) => {
      if (status) status.textContent = text;
    };

    const close = () => {
      suggestions = [];
      activeIndex = -1;
      list.replaceChildren();
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
    };

    const invalidate = () => {
      if (!selected) return;
      selected = null;
      shell.classList.remove("is-confirmed");
      confirmation.hidden = true;
      confirmation.textContent = "";
      input.setAttribute("aria-invalid", "true");
      input.dispatchEvent(new CustomEvent("vasi:address-cleared", { bubbles: true }));
    };

    const render = () => {
      list.replaceChildren();
      suggestions.forEach((suggestion, index) => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "vasi-address-option";
        option.id = `${listId}-option-${index}`;
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", String(index === activeIndex));
        const main = document.createElement("strong");
        main.textContent = suggestion.main || suggestion.label;
        const secondary = document.createElement("span");
        secondary.textContent = suggestion.secondary || "";
        option.append(main, secondary);
        option.addEventListener("pointerdown", (event) => event.preventDefault());
        option.addEventListener("click", () => choose(index));
        list.append(option);
      });
      list.hidden = suggestions.length === 0;
      input.setAttribute("aria-expanded", String(suggestions.length > 0));
    };

    const setActive = (index) => {
      if (!suggestions.length) return;
      activeIndex = (index + suggestions.length) % suggestions.length;
      render();
      const active = document.getElementById(`${listId}-option-${activeIndex}`);
      input.setAttribute("aria-activedescendant", active.id);
      active.scrollIntoView({ block: "nearest" });
    };

    async function choose(index) {
      const suggestion = suggestions[index];
      if (!suggestion) return;
      close();
      input.disabled = true;
      message(translate("Confirming address…"));
      try {
        const data = await request({ action: "resolve", place_id: suggestion.place_id });
        selected = data.place;
        input.value = selected.label;
        input.setAttribute("aria-invalid", "false");
        shell.classList.add("is-confirmed");
        confirmation.hidden = false;
        confirmation.textContent = `✓ ${translate("Address confirmed")} · ${selected.label}`;
        message("");
        input.dispatchEvent(new CustomEvent("vasi:address-selected", {
          bubbles: true,
          detail: { ...selected },
        }));
        if (typeof options.onSelect === "function") options.onSelect({ ...selected });
      } catch (error) {
        message(error.message || "Could not confirm this address");
      } finally {
        input.disabled = false;
        input.focus();
      }
    }

    async function search() {
      const query = input.value.trim();
      if (query.length < 4) {
        close();
        message(query ? "Enter at least 4 characters." : "");
        return;
      }
      const currentRequest = ++requestNumber;
      message(translate("Searching addresses…"));
      try {
        const data = await request({
          action: "autocomplete",
          input: query,
          location: options.location || undefined,
        });
        if (currentRequest !== requestNumber) return;
        suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
        activeIndex = -1;
        render();
        message(suggestions.length ? `${suggestions.length} addresses found.` : translate("No matching address found."));
      } catch (error) {
        if (currentRequest !== requestNumber) return;
        close();
        message(error.message || "Address search is unavailable");
      }
    }

    input.addEventListener("input", () => {
      invalidate();
      clearTimeout(timer);
      timer = setTimeout(search, 320);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive(activeIndex + 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive(activeIndex - 1);
      } else if (event.key === "Enter" && activeIndex >= 0) {
        event.preventDefault();
        choose(activeIndex);
      } else if (event.key === "Escape") {
        close();
      }
    });
    input.addEventListener("blur", () => setTimeout(close, 120));

    return {
      getValue: () => (selected ? { ...selected } : null),
      isConfirmed: () => Boolean(selected),
      clear: () => {
        selected = null;
        input.value = "";
        shell.classList.remove("is-confirmed");
        confirmation.hidden = true;
        input.setAttribute("aria-invalid", "false");
        close();
      },
    };
  }

  window.VasiAddressSearch = { attach };
})();
