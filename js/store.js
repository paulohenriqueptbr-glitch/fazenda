const LOCAL_KEY = "controle-fazenda-data";
const PRICE_QUOTE_KEY = "milk_price_quote";
const CLIENT_PROFILE_KEY = "client_profile";
const SUBSCRIPTION_ADMIN_KEY = "subscription_admin";
const SAVED_LOGIN_EMAIL_KEY = "terrasyn_saved_login_email";
const OPTIONAL_TABLES = new Set(["crop_events", "reminders", "stock_items"]);
const MAX_LOGIN_ATTEMPTS = 5;
const PAGE_SIZE = 100;
const SUBSCRIPTION_STATUSES = new Set(["trial", "active", "overdue", "blocked", "canceled"]);

// PRODUCTION_THRESHOLDS agora vem de js/pure-utils.js

const state = {
  milk: [],
  animals: [],
  lactations: [],
  breeding: [],
  medication: [],
  cropEvents: [],
  stockItems: [],
  reminders: [],
  priceQuote: 0,
  clientProfile: null,
  subscription: null,
  dismissedAutoAlerts: new Set(),
  confirmedAutoAlerts: new Set(),
};

const rawConfig = window.CONTROLE_LEITE_CONFIG || {};
const cleanConfigString = (value) => String(value || "").trim();
const isHeaderSafeValue = (value) => /^[\u0009\u0020-\u00ff]*$/.test(value) && !/[\r\n]/.test(value);
const config = {
  ...rawConfig,
  supabaseUrl: cleanConfigString(rawConfig.supabaseUrl),
  supabaseAnonKey: cleanConfigString(rawConfig.supabaseAnonKey),
};
const hasInvalidSupabaseHeader = Boolean(config.supabaseAnonKey && !isHeaderSafeValue(config.supabaseAnonKey));
const hasSupabase = Boolean(
  config.supabaseUrl &&
  config.supabaseAnonKey &&
  !hasInvalidSupabaseHeader &&
  window.supabase
);
const db = hasSupabase ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;
const supportWhatsapp = String(config.supportWhatsapp || "").replace(/\D/g, "");
const supportEmail = String(config.supportEmail || "");
const trialDays = Number(config.trialDays || 14);
const planPrice = Number(config.planPrice || 39);
const isLocalOrigin =
  ["localhost", "127.0.0.1", ""].includes(window.location.hostname) || window.location.protocol === "file:";
const canUseLocalAccount = isLocalOrigin && !hasSupabase;
// O modo local agora valida a senha via /api/local-login (POST no servidor).
// A senha nunca é exposta no bundle JS do cliente.
const canUseLocalAccountWithPassword = canUseLocalAccount && Boolean(config.localModeEnabled);
const supabaseUnavailableMessage = () => {
  if (canUseLocalAccountWithPassword) {
    return "Modo local ativo. Use admin e a senha configurada no servidor.";
  }
  if (canUseLocalAccount) {
    return "Modo local: configure LOCAL_ADMIN_PASSWORD no .env para habilitar o acesso.";
  }
  if (!window.supabase) {
    return "Biblioteca do Supabase não carregou. Recarregue a página para atualizar os arquivos do app.";
  }
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    return "Configuração do Supabase não encontrada. Confira SUPABASE_URL e SUPABASE_ANON_KEY no ambiente.";
  }
  if (hasInvalidSupabaseHeader) {
    return "A chave do Supabase contem caractere invalido. Copie novamente SUPABASE_ANON_KEY sem aspas especiais ou quebras de linha.";
  }
  return "Supabase indisponível no momento. Tente novamente.";
};
let currentUserId = null;
let selectedMedicationCowId = null;
// Atenção: este contador zera ao recarregar a página — ele apenas adiciona delay
// entre tentativas na mesma sessão. A proteção real contra bruteforce é feita
// no servidor (/api/local-login) e no Supabase Auth (rate limit por IP/e-mail).
let failedLoginAttempts = 0;

const $ = (selector) => document.querySelector(selector);
// parseIsoDate, todayIso, addDaysIso, monthKey agora vêm de js/pure-utils.js
const localId = () => {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) return randomUuid;
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};
const withCurrentUser = (payload) => (currentUserId ? { ...payload, user_id: currentUserId } : payload);
const userStorageKey = (key) => (currentUserId ? `${key}:${currentUserId}` : key);

const defaultClientProfile = () => ({
  farmName: "",
  ownerName: "",
  whatsapp: "",
  trialStartedAt: new Date().toISOString(),
  onboardingDone: false,
});

const normalizeClientProfile = (profile = {}) => ({
  farmName: String(profile?.farmName || ""),
  ownerName: String(profile?.ownerName || ""),
  whatsapp: String(profile?.whatsapp || ""),
  trialStartedAt: String(profile?.trialStartedAt || new Date().toISOString()),
  onboardingDone: Boolean(profile?.onboardingDone),
});

const defaultSubscription = () => ({
  subscriptionStatus: "trial",
  subscriptionDueDate: addDaysIso(todayIso(), trialDays),
});

const normalizeSubscription = (subscription = {}) => {
  const defaults = defaultSubscription();
  const data = subscription && typeof subscription === "object" ? subscription : {};
  const rawStatus = String(data.subscriptionStatus || defaults.subscriptionStatus);
  const dueDate = Object.prototype.hasOwnProperty.call(data, "subscriptionDueDate")
    ? data.subscriptionDueDate
    : defaults.subscriptionDueDate;

  return {
    subscriptionStatus: SUBSCRIPTION_STATUSES.has(rawStatus) ? rawStatus : defaults.subscriptionStatus,
    subscriptionDueDate: String(dueDate || ""),
  };
};

state.clientProfile = defaultClientProfile();
state.subscription = defaultSubscription();

const showToast = (message, type = "success") => {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("is-hiding");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

// ─── Loading em botões ────────────────────────────────────────────────────────
/**
 * Desabilita o botão de submit de um formulário durante uma operação async,
 * mostrando um texto de "carregando" no lugar.
 * Retorna uma função de restauração caso seja necessário chamar manualmente.
 */
const withButtonLoading = (form, asyncFn, loadingText = "Salvando...") => {
  return async (...args) => {
    const btn = form?.querySelector('button[type="submit"]');
    const original = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = loadingText; }
    try {
      return await asyncFn(...args);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = original; }
    }
  };
};

// ─── Validação inline ─────────────────────────────────────────────────────────
/**
 * Registra validação no evento blur de um campo.
 * Cria (ou reutiliza) um elemento de erro logo abaixo do campo.
 */
const addInlineValidation = (inputEl, validateFn) => {
  if (!inputEl || inputEl._inlineValidation) return;
  inputEl._inlineValidation = true;

  let errorEl = inputEl.nextElementSibling;
  if (!errorEl || !errorEl.classList.contains("field-error")) {
    errorEl = document.createElement("span");
    errorEl.className = "field-error";
    inputEl.insertAdjacentElement("afterend", errorEl);
  }

  const validate = () => {
    const msg = validateFn(inputEl.value);
    errorEl.textContent = msg || "";
    inputEl.classList.toggle("input-error", Boolean(msg));
  };

  inputEl.addEventListener("blur", validate);
  inputEl.addEventListener("input", () => {
    if (inputEl.classList.contains("input-error")) validate();
  });
};

/**
 * Registra validação inline nos campos principais de todos os formulários.
 * Chamado uma vez após o initApp.
 */
const setupInlineValidations = () => {
  // Produção de leite
  addInlineValidation($("#liters"), (v) => {
    const n = Number.parseFloat(v);
    if (v === "" || v === null) return "Informe os litros";
    if (isNaN(n) || n < 0 || n > 1000) return "Valor deve ser entre 0 e 1000";
    return null;
  });
  addInlineValidation($("#milkDate"), (v) => {
    if (!isValidDate(v)) return "Data inválida";
    if (!isNotFutureDate(v)) return "Não pode ser data futura";
    return null;
  });

  // Animal
  addInlineValidation($("#animalName"), (v) => {
    if (!v?.trim()) return "Informe o identificador do animal";
    if (v.trim().length > 100) return "Máximo 100 caracteres";
    return null;
  });

  // Lactação
  addInlineValidation($("#lactStart"), (v) => (!isValidDate(v) ? "Data inválida" : null));
  addInlineValidation($("#lactLiters"), (v) => {
    const n = Number.parseFloat(v);
    if (isNaN(n) || n < 0 || n > 500) return "Valor deve ser entre 0 e 500";
    return null;
  });

  // Reprodução
  addInlineValidation($("#inseminationDate"), (v) => (!isValidDate(v) ? "Data inválida" : null));

  // Medicação
  addInlineValidation($("#medName"), (v) => {
    if (!v?.trim()) return "Informe o medicamento";
    if (v.trim().length > 100) return "Máximo 100 caracteres";
    return null;
  });
  addInlineValidation($("#medDate"), (v) => {
    if (!isValidDate(v)) return "Data inválida";
    if (!isNotFutureDate(v)) return "Não pode ser data futura";
    return null;
  });

  // Cotação
  addInlineValidation($("#priceQuoteInput"), (v) => {
    const n = Number.parseFloat(v);
    if (isNaN(n) || n < 0 || n > 100) return "Valor deve ser entre 0 e 100";
    return null;
  });
};

// formatLiters, formatMoney, formatTasks, formatStockQuantity, formatDate,
// escapeHtml, PRODUCTION_THRESHOLDS, getProductionStatus e createStatusBadge
// agora vêm de js/pure-utils.js
