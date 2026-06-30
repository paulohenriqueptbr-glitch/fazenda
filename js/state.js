export const LOCAL_KEY = "controle-fazenda-data";
export const PRICE_QUOTE_KEY = "milk_price_quote";
export const CLIENT_PROFILE_KEY = "client_profile";
export const SUBSCRIPTION_ADMIN_KEY = "subscription_admin";
export const SAVED_LOGIN_EMAIL_KEY = "terrasyn_saved_login_email";
export const OPTIONAL_TABLES = new Set(["crop_events", "reminders", "stock_items"]);
export const MAX_LOGIN_ATTEMPTS = 5;
export const PAGE_SIZE = 100;
export const SUBSCRIPTION_STATUSES = new Set(["trial", "active", "overdue", "blocked", "canceled"]);
export const PRODUCTION_THRESHOLDS = { critical: 0.5, warning: 0.75, good: 1.0 };
import { error } from "./logger.js";

export const state = {
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

export const config = window.CONTROLE_LEITE_CONFIG || {};
export const hasSupabase = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
export const db = hasSupabase ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;
export const supportWhatsapp = String(config.supportWhatsapp || "").replace(/\D/g, "");
export const supportEmail = String(config.supportEmail || "");
export const trialDays = Number(config.trialDays || 14);
export const planPrice = Number(config.planPrice || 39);
export const isLocalOrigin =
  ["localhost", "127.0.0.1", ""].includes(window.location.hostname) || window.location.protocol === "file:";
export const canUseLocalAccount = isLocalOrigin && !hasSupabase;
export const canUseLocalAccountWithPassword = canUseLocalAccount && Boolean(config.localModeEnabled);

export const supabaseUnavailableMessage = (err) => {
  if (canUseLocalAccountWithPassword) return "Modo local ativo. Use admin e a senha configurada no servidor.";
  if (canUseLocalAccount) return "Modo local: configure LOCAL_ADMIN_PASSWORD no .env para habilitar o acesso.";
  if (!window.supabase) return "Biblioteca do Supabase não carregou. Recarregue a página para atualizar os arquivos do app.";
  if (!config.supabaseUrl || !config.supabaseAnonKey) return "Configuração do Supabase não encontrada. Confira SUPABASE_URL e SUPABASE_ANON_KEY no ambiente.";
  return "Supabase indisponível no momento. Tente novamente.";
};

export let currentUserId = null;
export let selectedMedicationCowId = null;
export let failedLoginAttempts = 0;

export const setCurrentUserId = (id) => { currentUserId = id; };
export const setSelectedMedicationCowId = (id) => { selectedMedicationCowId = id; };
export const incrementFailedLoginAttempts = () => { failedLoginAttempts += 1; };
export const resetFailedLoginAttempts = () => { failedLoginAttempts = 0; };

export const milkFilter = { period: "today", startDate: null, endDate: null };
export const setMilkFilter = (updates) => { Object.assign(milkFilter, updates); };

export const $ = (selector) => document.querySelector(selector);

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const parseIsoDate = (isoDate) => {
  if (!ISO_DATE_PATTERN.test(String(isoDate || ""))) return null;
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
};

export const todayIso = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

export const addDaysIso = (isoDate, days) => {
  const date = parseIsoDate(isoDate) || parseIsoDate(todayIso());
  date.setDate(date.getDate() + Number(days || 0));
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

export const monthKey = () => todayIso().slice(0, 7);

export const localId = () => {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) return randomUuid;
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const withCurrentUser = (payload) => (currentUserId ? { ...payload, user_id: currentUserId } : payload);
export const userStorageKey = (key) => (currentUserId ? `${key}:${currentUserId}` : key);
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const defaultClientProfile = () => ({
  farmName: "",
  ownerName: "",
  whatsapp: "",
  trialStartedAt: new Date().toISOString(),
  onboardingDone: false,
});

export const normalizeClientProfile = (profile = {}) => ({
  farmName: String(profile?.farmName || ""),
  ownerName: String(profile?.ownerName || ""),
  whatsapp: String(profile?.whatsapp || ""),
  trialStartedAt: String(profile?.trialStartedAt || new Date().toISOString()),
  onboardingDone: Boolean(profile?.onboardingDone),
});

export const defaultSubscription = () => ({
  subscriptionStatus: "trial",
  subscriptionDueDate: addDaysIso(todayIso(), trialDays),
});

export const normalizeSubscription = (subscription = {}) => {
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

export const safeParseJson = (value, fallback = {}) => { try { return JSON.parse(value); } catch { return fallback; } };
export const asArray = (value) => (Array.isArray(value) ? value : []);

export const readLocal = () => {
  try {
    const data = JSON.parse(localStorage.getItem(userStorageKey(LOCAL_KEY))) || {};
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch { return {}; }
};

export const writeLocal = () => {
  try {
    const toSave = {
      ...state,
      dismissedAutoAlerts: [...(state.dismissedAutoAlerts || [])],
      confirmedAutoAlerts: [...(state.confirmedAutoAlerts || [])],
    };
    localStorage.setItem(userStorageKey(LOCAL_KEY), JSON.stringify(toSave));
    return true;
  } catch (err) {
    error("Erro ao salvar dados locais:", err);
    return false;
  }
};

export const loadLocal = () => {
  const data = readLocal();
  state.milk = asArray(data.milk);
  state.animals = asArray(data.animals);
  state.lactations = asArray(data.lactations);
  state.breeding = asArray(data.breeding);
  state.medication = asArray(data.medication);
  state.cropEvents = asArray(data.cropEvents);
  state.stockItems = asArray(data.stockItems);
  state.reminders = asArray(data.reminders);
  state.priceQuote = Number(data.priceQuote || 0);
  state.clientProfile = normalizeClientProfile(data.clientProfile);
  state.subscription = normalizeSubscription(data.subscription || data.clientProfile);
  state.dismissedAutoAlerts = new Set(asArray(data.dismissedAutoAlerts));
  state.confirmedAutoAlerts = new Set(asArray(data.confirmedAutoAlerts));
};

export const loadLocalAlerts = () => {
  const data = readLocal();
  state.dismissedAutoAlerts = new Set(asArray(data.dismissedAutoAlerts));
  state.confirmedAutoAlerts = new Set(asArray(data.confirmedAutoAlerts));
};

state.clientProfile = defaultClientProfile();
state.subscription = defaultSubscription();
