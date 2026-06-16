
const showApp = (email) => {
  loginScreen.classList.add("hidden");
  appShell.classList.add("visible");
  if (userEmailEl) userEmailEl.textContent = email || "";
};

const saveLoginEmail = (email) => {
  const value = String(email || "").trim();
  if (!value) return;
  try {
    localStorage.setItem(SAVED_LOGIN_EMAIL_KEY, value);
  } catch (error) {
    console.warn("Nao foi possivel salvar o e-mail de login:", error);
  }
};

const restoreLoginEmail = () => {
  const input = $("#loginEmail");
  if (!input || input.value) return;
  try {
    input.value = localStorage.getItem(SAVED_LOGIN_EMAIL_KEY) || "";
  } catch (error) {
    console.warn("Nao foi possivel carregar o e-mail de login:", error);
  }
};

const setAuthMode = (mode) => {
  const isSignup = mode === "signup";
  loginForm.classList.toggle("hidden", isSignup);
  signupForm.classList.toggle("hidden", !isSignup);
  showLoginButton.classList.toggle("active", !isSignup);
  showSignupButton.classList.toggle("active", isSignup);
  if (authSubtitle) {
    authSubtitle.textContent = isSignup ? "Crie sua conta para acessar o sistema" : "Faça login para acessar o sistema";
  }
  if (authFooter) {
    authFooter.textContent = isSignup
      ? "O acesso é protegido por e-mail e senha"
      : "Acesso restrito ao administrador da fazenda";
  }
  loginError.classList.remove("visible", "success");
};

const showLogin = (mode = "login") => {
  loginScreen.classList.remove("hidden");
  appShell.classList.remove("visible");
  setAuthMode(mode);
  restoreLoginEmail();
};

const showLoginError = (message, type = "error") => {
  loginError.textContent = message;
  loginError.classList.toggle("success", type === "success");
  loginError.classList.add("visible");
};

const isStandalonePwa = () =>
  window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;

const isMobileDevice = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const isIosDevice = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isAndroidDevice = () => /Android/i.test(navigator.userAgent);

const hideInstallPrompt = () => {
  installPromptModal?.classList.add("hidden");
};

const showInstallPrompt = () => {
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

const scheduleInstallPromptAfterSignup = () => {
  window.setTimeout(showInstallPrompt, 500);
};

const contactUrl = (message, subject = "Suporte Terrasyn") => {
  const encodedMessage = encodeURIComponent(message);
  if (supportWhatsapp) return `https://wa.me/${supportWhatsapp}?text=${encodedMessage}`;
  if (supportEmail) return `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodedMessage}`;
  return "privacy.html#contato";
};

const supportUrl = () => contactUrl("Olá, preciso de suporte no Terrasyn.");

const subscribeUrl = () =>
  contactUrl(
    `Olá, quero assinar o Terrasyn. Plano: ${formatMoney(planPrice)}/mês.`,
    "Assinatura Terrasyn"
  );

const setupSupportLinks = () => {
  document.querySelectorAll("[data-support-link], [data-subscribe-link]").forEach((link) => {
    const url = link.hasAttribute("data-subscribe-link") ? subscribeUrl() : supportUrl();
    link.setAttribute("href", url);
    if (url.startsWith("https://")) {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    } else {
      link.removeAttribute("target");
      link.removeAttribute("rel");
    }
  });
};

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const supabaseErrorMessage = (error) => {
  const raw = String(error?.message || error?.code || error || "").toLowerCase();

  if (raw.includes("jwt") || raw.includes("session")) return "Sua sessão expirou. Faça login novamente.";
  if (raw.includes("network") || raw.includes("fetch") || raw.includes("failed to fetch")) {
    return "Sem conexão com o servidor. Os dados ficarão salvos para sincronizar.";
  }
  if (raw.includes("row-level security") || raw.includes("permission denied") || raw.includes("42501")) {
    return "Acesso negado pelo Supabase. Confira seu login e as políticas RLS.";
  }
  if (raw.includes("429") || raw.includes("rate limit")) {
    return "Muitas tentativas. Aguarde um momento e tente novamente.";
  }
  if (raw.includes("violates check constraint") || raw.includes("23514")) {
    return "Dados inválidos. Confira os valores informados.";
  }
  if (raw.includes("duplicate key") || raw.includes("23505")) {
    return "Já existe um registro com essas informações.";
  }

  return "Erro ao comunicar com o servidor. Tente novamente.";
};

const isMissingOptionalTable = (error, table) =>
  Boolean(error) &&
  OPTIONAL_TABLES.has(table) &&
  (["42P01", "PGRST205"].includes(error.code) ||
    String(error.message || "").toLowerCase().includes(table));

const isMissingCropEventsTable = (error) => isMissingOptionalTable(error, "crop_events");

const authErrorMessage = (error) => {
  const raw = String(error?.message || error?.code || error || "").toLowerCase();

  if (raw.includes("already registered") || raw.includes("already exists")) {
    return "Este e-mail já está cadastrado.";
  }
  if (raw.includes("password") && (raw.includes("6") || raw.includes("short"))) {
    return "Use uma senha com pelo menos 6 caracteres.";
  }
  if (raw.includes("invalid email")) return "Informe um e-mail válido.";

  return supabaseErrorMessage(error);
};

const handleSupabaseError = (error, context = "") => {
  console.error(`Erro Supabase${context ? ` [${context}]` : ""}:`, error);
  const message = supabaseErrorMessage(error);
  showToast(message, "error");
  return message;
};

const requireSession = async () => {
  if (!hasSupabase || !db) return null;

  const {
    data: { session },
    error,
  } = await db.auth.getSession();

  if (error) throw error;

  if (!session?.user) {
    currentUserId = null;
    showLogin();
    const error = new Error("Sua sessão expirou. Faça login novamente.");
    error.authRequired = true;
    throw error;
  }

  currentUserId = session.user.id;
  return session;
};