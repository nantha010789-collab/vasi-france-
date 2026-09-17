(() => {
  "use strict";

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }

  const button = document.querySelector("[data-vasi-install]");
  const help = document.querySelector("[data-vasi-install-help]");
  const standalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true;
  let prompt = null;

  if (!button || standalone) {
    if (button) button.hidden = true;
    return;
  }

  const apple = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (apple) button.hidden = false;

  const showHelp = (message) => {
    if (!help) return;
    help.textContent = message;
    help.hidden = false;
  };

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    prompt = event;
    button.hidden = false;
  });

  button.addEventListener("click", async () => {
    if (prompt) {
      prompt.prompt();
      await prompt.userChoice;
      prompt = null;
      button.hidden = true;
      return;
    }
    showHelp(
      apple
        ? "Dans Safari : Partager, puis Sur l’écran d’accueil."
        : "Dans Chrome ou Edge : ouvrez le menu, puis choisissez Installer l’application.",
    );
  });

  window.addEventListener("appinstalled", () => {
    prompt = null;
    button.hidden = true;
    showHelp("L’application VASI est installée sur cet appareil.");
  });
})();
