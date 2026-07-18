import { warn } from "./logger.js";

export const registerServiceWorker = () => {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("service-worker.js");
      await reg.update();
      const onNewSW = (worker) => {
        if (!worker) return;
        const showUpdateBanner = () => {
          if (document.getElementById("swUpdateBanner")) return;
          const banner = document.createElement("div");
          banner.id = "swUpdateBanner"; banner.className = "sw-update-banner";
          banner.innerHTML = `<span>Nova versão disponível</span><button id="swUpdateBtn" class="sw-update-btn">Atualizar agora</button><button id="swUpdateDismiss" class="sw-update-dismiss" aria-label="Fechar">✕</button>`;
          document.body.appendChild(banner);
          document.getElementById("swUpdateBtn").addEventListener("click", () => { worker.postMessage({ type: "SKIP_WAITING" }); banner.remove(); });
          document.getElementById("swUpdateDismiss").addEventListener("click", () => banner.remove());
        };
        if (worker.state === "installed") showUpdateBanner();
        else worker.addEventListener("statechange", () => { if (worker.state === "installed") showUpdateBanner(); });
      };
      if (reg.waiting) onNewSW(reg.waiting);
      reg.addEventListener("updatefound", () => onNewSW(reg.installing));
      navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload());
    } catch (err) { warn("Service Worker não registrado:", err); }
  });
};
