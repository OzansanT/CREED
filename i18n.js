const MESSAGES = Object.freeze({
  en: Object.freeze({
    explorer: "Explorer",
    search: "Search",
    sourceControl: "Source Control",
    run: "Run and Debug",
    extensions: "Extensions",
    settings: "Settings",
    canvasControls: "Canvas Controls",
    infiniteCanvas: "Infinite Canvas",
    components: "Components",
    layers: "Layers",
    inspector: "Inspector",
    problems: "Problems",
    output: "Output",
    debugConsole: "Debug Console",
    terminal: "Terminal",
    ports: "Ports",
    save: "Save",
    chat: "Chat",
    install: "Install"
  }),
  tr: Object.freeze({
    explorer: "Gezgin",
    search: "Ara",
    sourceControl: "Kaynak Denetimi",
    run: "Çalıştır ve Hata Ayıkla",
    extensions: "Uzantılar",
    settings: "Ayarlar",
    canvasControls: "Tuval Denetimleri",
    infiniteCanvas: "Sonsuz Tuval",
    components: "Bileşenler",
    layers: "Katmanlar",
    inspector: "Denetçi",
    problems: "Sorunlar",
    output: "Çıktı",
    debugConsole: "Hata Ayıklama Konsolu",
    terminal: "Terminal",
    ports: "Bağlantı Noktaları",
    save: "Kaydet",
    chat: "Sohbet",
    install: "Yükle"
  })
});

export function bindI18n({ settingsStore, root = document }) {
  function translate(locale = settingsStore.get().locale) {
    const messages = MESSAGES[locale] || MESSAGES.en;
    root.querySelectorAll("[data-i18n]").forEach((element) => {
      const message = messages[element.dataset.i18n];
      if (message) element.textContent = message;
    });
    root.querySelectorAll("[data-i18n-title]").forEach((element) => {
      const message = messages[element.dataset.i18nTitle];
      if (message) {
        element.title = message;
        if (element.hasAttribute("aria-label")) element.setAttribute("aria-label", message);
      }
    });
    document.documentElement.lang = locale;
  }
  const unsubscribe = settingsStore.subscribe((settings) => translate(settings.locale));
  translate();
  return Object.freeze({
    t(key, locale = settingsStore.get().locale) { return MESSAGES[locale]?.[key] || MESSAGES.en[key] || key; },
    translate,
    destroy: unsubscribe
  });
}
