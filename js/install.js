import { $ } from "./state.js";
import { showToast } from "./ui.js";

const installPromptModal = $("#installPromptModal");
const installPromptTitle = $("#installPromptTitle");
const installPromptMessage = $("#installPromptMessage");
const installPromptAction = $("#installPromptAction");
const installPromptLater = $("#installPromptLater");
const installPromptClose = $("#installPromptClose");
const iosInstallSteps = $("#iosInstallSteps");

let deferredInstallPrompt = null;

export const isStandalonePwa = () =>
  window.matchMedia?.("(display-mode: standalone)")?.matches ||
  window.navigator.standalone === true;

export const isMobileDevice = () =>
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export const isIosDevice = () =>
  /iPhone|iPad|iPod/i.test(navigator.userAgent);

export const isAndroidDevice = () =>
  /Android/i.test(navigator.userAgent);

export const hideInstallPrompt = () => {
  installPromptModal?.classList.add("hidden");
};

export const showInstallPrompt = () => {
  if (!installPromptModal || !isMobileDevice() || isStandalonePwa()) return;

  const ios = isIosDevice();
  const android = isAndroidDevice();
  const canPromptAndroid = android && deferredInstallPrompt;

  if (ios) {
    installPromptTitle.textContent = "Salve o Terrasyn no iPhone";
    installPromptMessage.textContent = "No iOS a instalação é feita pelo Safari, salvando o ícone na tela de início.";
    installPromptAction.textContent = "Entendi";
  } else if (canPromptAndroid) {
    installPromptTitle.textContent = "Instale o Terrasyn";
    installPromptMessage.textContent = "Coloque o aplicativo na tela inicial do Android para abrir com um toque.";
    installPromptAction.textContent = "Instalar aplicativo";
  } else if (android) {
    installPromptTitle.textContent = "Instale pelo menu do navegador";
    installPromptMessage.textContent = "Se o botão de instalação ainda não aparecer, abra o menu do Chrome e escolha Instalar app.";
    installPromptAction.textContent = "Entendi";
  } else {
    return;
  }

  iosInstallSteps?.classList.toggle("hidden", !ios);
  installPromptModal.classList.remove("hidden");
};

export const setupInstallPrompt = () => {
  if (installPromptAction && !installPromptAction._listenerAttached) {
    installPromptAction._listenerAttached = true;
    installPromptAction.addEventListener("click", async () => {
      if (isIosDevice() || !deferredInstallPrompt) {
        hideInstallPrompt();
        return;
      }
      const prompt = deferredInstallPrompt;
      deferredInstallPrompt = null;
      hideInstallPrompt();
      await prompt.prompt();
    });
  }

  if (installPromptLater) {
    installPromptLater.addEventListener("click", hideInstallPrompt);
  }

  if (installPromptClose) {
    installPromptClose.addEventListener("click", hideInstallPrompt);
  }

  if (installPromptModal) {
    installPromptModal.addEventListener("click", (e) => {
      if (e.target === installPromptModal) hideInstallPrompt();
    });
  }
};

export const setupInstallListeners = () => {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    setTimeout(() => {
      if (deferredInstallPrompt && !isStandalonePwa()) {
        showInstallPrompt();
      }
    }, 30000);
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    hideInstallPrompt();
    showToast("Terrasyn instalado com sucesso.");
  });
};

export default {
  hideInstallPrompt,
  showInstallPrompt,
  setupInstallPrompt,
  setupInstallListeners,
  isStandalonePwa,
  isMobileDevice,
  isIosDevice,
  isAndroidDevice,
};
