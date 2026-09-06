function setPageLanguage(language) {
  const lang = language === "en" ? "en" : "fr";
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-fr][data-en]").forEach((element) => {
    element.textContent = element.dataset[lang];
  });
  document.querySelectorAll("[data-lang]").forEach((button) => {
    const active = button.dataset.lang === lang;
    button.classList.toggle("is-active",active);
    button.setAttribute("aria-pressed",String(active));
  });
  document.querySelectorAll("[data-language-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.languagePanel !== lang;
  });
  const body = document.body;
  if (body.dataset[`${lang}Title`]) document.title = body.dataset[`${lang}Title`];
  const description = document.querySelector('meta[name="description"]');
  if (description && body.dataset[`${lang}Description`]) description.content = body.dataset[`${lang}Description`];
  localStorage.setItem("vasiBusinessLanguage",lang);
}
document.querySelectorAll("[data-lang]").forEach((button) => button.addEventListener("click",() => setPageLanguage(button.dataset.lang)));
setPageLanguage(localStorage.getItem("vasiBusinessLanguage") || (navigator.language?.toLowerCase().startsWith("fr") ? "fr" : "en"));
