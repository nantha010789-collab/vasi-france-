(() => {
  "use strict";

  const button = document.getElementById("installAdmin");
  const help = document.getElementById("installHelp");
  const standalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true;
  let installPrompt = null;

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }

  if (!button || standalone) {
    if (button) button.hidden = true;
    return;
  }

  const isAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const showHelp = (message) => {
    if (help) {
      help.textContent = message;
      help.hidden = false;
    }
  };

  if (isAppleMobile) button.hidden = false;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    button.hidden = false;
  });

  button.addEventListener("click", async () => {
    if (installPrompt) {
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      button.hidden = true;
      return;
    }

    showHelp(
      isAppleMobile
        ? "Sur iPhone ou iPad : ouvrez cette page dans Safari, touchez Partager, puis Sur l’écran d’accueil."
        : "Dans Chrome ou Edge : ouvrez le menu du navigateur, puis choisissez Installer VASI Admin.",
    );
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    button.hidden = true;
    showHelp("VASI Admin est installé sur cet appareil.");
  });
})();
