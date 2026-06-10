const LOCAL_KEY = "controle-fazenda-data";
const PRICE_QUOTE_KEY = "milk_price_quote";
const CLIENT_PROFILE_KEY = "client_profile";
const SUBSCRIPTION_ADMIN_KEY = "subscription_admin";
const OPTIONAL_TABLES = new Set(["crop_events", "reminders"]);
const MAX_LOGIN_ATTEMPTS = 5;
const PAGE_SIZE = 100;
const SUBSCRIPTION_STATUSES = new Set(["trial", "active", "overdue", "blocked", "canceled"]);

// Thresholds para status de produção
const PRODUCTION_THRESHOLDS = {
  critical: 0.5,  // Menos de 50% da média = CRÍTICO
  warning: 0.75,  // Menos de 75% da média = BAIXO
  good: 1.0       // >= média = BOM
};

const state = {
  milk: [],
  animals: [],
  lactations: [],
  breeding: [],
  medication: [],
  cropEvents: [],
  reminders: [],
  priceQuote: 0,
  clientProfile: null,
  subscription: null,
};

const config = window.CONTROLE_LEITE_CONFIG || {};
const hasSupabase = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
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
    return "Biblioteca do Supabase não carregou. Recarregue a página e confira se o CDN não foi bloqueado.";
  }
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    return "Configuração do Supabase não encontrada. Confira SUPABASE_URL e SUPABASE_ANON_KEY no ambiente.";
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
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const parseIsoDate = (isoDate) => {
  if (!ISO_DATE_PATTERN.test(String(isoDate || ""))) return null;

  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
};
const todayIso = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
const addDaysIso = (isoDate, days) => {
  const date = parseIsoDate(isoDate) || parseIsoDate(todayIso());
  date.setDate(date.getDate() + Number(days || 0));
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};
const monthKey = () => todayIso().slice(0, 7);
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

const formatLiters = (value) => `${Number(value || 0).toLocaleString("pt-BR")} L`;
const formatMoney = (value) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatTasks = (value) => {
  const tasks = Number(value || 0);
  if (!tasks) return "";
  return `${tasks.toLocaleString("pt-BR")} tarefa${tasks === 1 ? "" : "s"}`;
};

const formatDate = (isoDate) => {
  if (!isoDate) return "-";
  const [year, month, day] = isoDate.split("-");
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString("pt-BR");
};

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character];
  });

// Calcular status de produção (Bom/Baixo/Crítico)
const getProductionStatus = (liters, monthAverage) => {
  const ratio = monthAverage > 0 ? liters / monthAverage : 1;
  if (ratio >= PRODUCTION_THRESHOLDS.good) return { status: "Bom", kind: "good" };
  if (ratio >= PRODUCTION_THRESHOLDS.warning) return { status: "Baixo", kind: "warning" };
  return { status: "Crítico", kind: "critical" };
};

// Criar badge de status HTML
const createStatusBadge = (status) => {
  const safeKind = ["good", "warning", "critical"].includes(status.kind) ? status.kind : "good";
  return `<span class="production-badge ${safeKind}">${escapeHtml(status.status)}</span>`;
};

const loginScreen = $("#loginScreen");
const appShell = $("#appShell");
const loginForm = $("#loginForm");
const signupForm = $("#signupForm");
const loginError = $("#loginError");
const logoutBtn = $("#logoutBtn");
const userEmailEl = $("#userEmail");
const authSubtitle = $("#authSubtitle");
const authFooter = $("#authFooter");
const showLoginButton = $("#showLoginButton");
const showSignupButton = $("#showSignupButton");

const el = {
  appShell,
  syncStatus: $("#syncStatus"),
  todayTotal: $("#todayTotal"),
  todayValue: $("#todayValue"),
  monthTotal: $("#monthTotal"),
  monthValue: $("#monthValue"),
  animalTotal: $("#animalTotal"),
  lactatingTotal: $("#lactatingTotal"),
  priceQuoteDisplay: $("#priceQuoteDisplay"),
  historyList: $("#historyList"),
  animalList: $("#animalList"),
  lactationList: $("#lactationList"),
  breedingList: $("#breedingList"),
  medicationList: $("#medicationList"),
  cropEventList: $("#cropEventList"),
  alertList: $("#alertList"),
  milkForm: $("#milkForm"),
  milkDate: $("#milkDate"),
  animalForm: $("#animalForm"),
  lactationForm: $("#lactationForm"),
  breedingForm: $("#breedingForm"),
  medicationForm: $("#medicationForm"),
  cropForm: $("#cropForm"),
  reminderForm: $("#reminderForm"),
  reminderDate: $("#reminderDate"),
  weatherForm: $("#weatherForm"),
  weatherCity: $("#weatherCity"),
  weatherForecast: $("#weatherForecast"),
  alertOverdueTotal: $("#alertOverdueTotal"),
  alertTodayTotal: $("#alertTodayTotal"),
  alertWeekTotal: $("#alertWeekTotal"),
  alertOpenTotal: $("#alertOpenTotal"),
  priceQuoteForm: $("#priceQuoteForm"),
  priceQuoteInput: $("#priceQuoteInput"),
  priceQuoteValue: $("#priceQuoteValue"),
  clientProfileForm: $("#clientProfileForm"),
  farmNameInput: $("#farmNameInput"),
  ownerNameInput: $("#ownerNameInput"),
  clientWhatsappInput: $("#clientWhatsappInput"),
  subscriptionStatusInput: $("#subscriptionStatusInput"),
  subscriptionDueDateInput: $("#subscriptionDueDateInput"),
  clientSummary: $("#clientSummary"),
  planPriceValue: $("#planPriceValue"),
  trialDaysValue: $("#trialDaysValue"),
  pixKeyValue: $("#pixKeyValue"),
  copyPixButton: $("#copyPixButton"),
  subscribeButton: $("#subscribeButton"),
  onboardingModal: $("#onboardingModal"),
  onboardingForm: $("#onboardingForm"),
  skipOnboardingButton: $("#skipOnboardingButton"),
  refreshButton: $("#refreshButton"),
  exportDataButton: $("#exportDataButton"),
  printReportButton: $("#printReportButton"),
  reportMonthTotal: $("#reportMonthTotal"),
  reportMonthValue: $("#reportMonthValue"),
  reportAverage: $("#reportAverage"),
  reportBestDay: $("#reportBestDay"),
  reportDetails: $("#reportDetails"),
  productionChart: $("#productionChart"),
};

const actionButtons = (type, id) => `
  <div class="item-actions">
    <button type="button" data-action="edit" data-type="${type}" data-id="${escapeHtml(id)}">Editar</button>
    <button type="button" data-action="delete" data-type="${type}" data-id="${escapeHtml(id)}">Excluir</button>
  </div>
`;

const recordActions = (type, record) => (record.id ? actionButtons(type, record.id) : "");

const reminderActions = (record) => {
  if (!record.id) return "";
  const actionLabel = record.done ? "Reabrir" : "Concluir";
  return `
    <div class="item-actions">
      <button type="button" data-action="toggle-reminder" data-type="reminder" data-id="${escapeHtml(record.id)}">${actionLabel}</button>
      <button type="button" data-action="edit" data-type="reminder" data-id="${escapeHtml(record.id)}">Editar</button>
      <button type="button" data-action="delete" data-type="reminder" data-id="${escapeHtml(record.id)}">Excluir</button>
    </div>
  `;
};

const showApp = (email) => {
  loginScreen.classList.add("hidden");
  appShell.classList.add("visible");
  if (userEmailEl) userEmailEl.textContent = email || "";
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
};

const showLoginError = (message, type = "error") => {
  loginError.textContent = message;
  loginError.classList.toggle("success", type === "success");
  loginError.classList.add("visible");
};

const contactUrl = (message, subject = "Suporte Controle Fazenda") => {
  const encodedMessage = encodeURIComponent(message);
  if (supportWhatsapp) return `https://wa.me/${supportWhatsapp}?text=${encodedMessage}`;
  if (supportEmail) return `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodedMessage}`;
  return "privacy.html#contato";
};

const supportUrl = () => contactUrl("Olá, preciso de suporte no Controle Fazenda.");

const subscribeUrl = () =>
  contactUrl(
    `Olá, quero assinar o Controle Fazenda. Plano: ${formatMoney(planPrice)}/mês.`,
    "Assinatura Controle Fazenda"
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

const readLocal = () => {
  try {
    const data = JSON.parse(localStorage.getItem(userStorageKey(LOCAL_KEY))) || {};
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
};

const safeParseJson = (value, fallback = {}) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const writeLocal = () => {
  try {
    localStorage.setItem(userStorageKey(LOCAL_KEY), JSON.stringify(state));
    return true;
  } catch (error) {
    console.error("Erro ao salvar dados locais:", error);
    showToast("Nao foi possivel salvar no armazenamento local.", "error");
    return false;
  }
};

const setStatus = (message, kind = "local") => {
  el.syncStatus.textContent = message;
  el.syncStatus.dataset.kind = kind;
};

const loadLocal = () => {
  const data = readLocal();
  state.milk = asArray(data.milk);
  state.animals = asArray(data.animals);
  state.lactations = asArray(data.lactations);
  state.breeding = asArray(data.breeding);
  state.medication = asArray(data.medication);
  state.cropEvents = asArray(data.cropEvents);
  state.reminders = asArray(data.reminders);
  state.priceQuote = Number(data.priceQuote || 0);
  state.clientProfile = normalizeClientProfile(data.clientProfile);
  state.subscription = normalizeSubscription(data.subscription || data.clientProfile);
  setStatus("Local", "local");
};

const loadAppSettings = async () => {
  const { data, error } = await db
    .from("app_settings")
    .select("key,value")
    .eq("user_id", currentUserId);

  if (error) throw error;

  const settings = Object.fromEntries((data || []).map((item) => [item.key, item.value]));
  const clientProfile = safeParseJson(settings[CLIENT_PROFILE_KEY], {});
  const adminSubscription = safeParseJson(settings[SUBSCRIPTION_ADMIN_KEY], null);
  state.priceQuote = Number(settings[PRICE_QUOTE_KEY] || 0);
  state.clientProfile = normalizeClientProfile(clientProfile);
  state.subscription = normalizeSubscription(adminSubscription || clientProfile);
};

const saveAppSetting = async (key, value) => {
  await requireSession();
  const { error } = await db.from("app_settings").upsert(
    {
      key,
      value,
      user_id: currentUserId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,key" }
  );

  if (error) throw error;
};

const savePriceQuote = async (value) => {
  state.priceQuote = Number(value || 0);

  if (!hasSupabase) {
    writeLocal();
    return;
  }

  try {
    await saveAppSetting(PRICE_QUOTE_KEY, String(state.priceQuote));
  } catch (error) {
    if (error.authRequired) throw error;
    handleSupabaseError(error, "salvar cotação");
    setStatus("Offline (pendente)", "error");
    writeLocal();
  }
};

const saveClientProfile = async (profile) => {
  state.clientProfile = normalizeClientProfile(profile);

  if (!hasSupabase) {
    writeLocal();
    return;
  }

  try {
    await saveAppSetting(CLIENT_PROFILE_KEY, JSON.stringify(state.clientProfile));
  } catch (error) {
    if (error.authRequired) throw error;
    handleSupabaseError(error, "salvar dados do cliente");
    setStatus("Offline (pendente)", "error");
    writeLocal();
  }
};

const loadSupabase = async () => {
  setStatus("Sincronizando", "syncing");
  await requireSession();

  const [milkResult, animalResult, lactationResult, breedingResult, medicationResult, cropResult, reminderResult] = await Promise.all([
    db.from("milk_records").select("*").order("date", { ascending: false }).range(0, PAGE_SIZE - 1),
    db.from("animals").select("*").order("created_at", { ascending: false }).range(0, PAGE_SIZE - 1),
    db.from("lactation_records").select("*").order("start_date", { ascending: false }).range(0, PAGE_SIZE - 1),
    db.from("breeding_records").select("*").order("insemination_date", { ascending: false }).range(0, PAGE_SIZE - 1),
    db.from("medication_records").select("*").order("administration_date", { ascending: false }).range(0, PAGE_SIZE - 1),
    db.from("crop_events").select("*").order("event_date", { ascending: false }).range(0, PAGE_SIZE - 1),
    db.from("reminders").select("*").order("due_date", { ascending: true }).range(0, PAGE_SIZE - 1),
  ]);

  const error =
    milkResult.error ||
    animalResult.error ||
    lactationResult.error ||
    breedingResult.error ||
    medicationResult.error ||
    (isMissingOptionalTable(cropResult.error, "crop_events") ? null : cropResult.error) ||
    (isMissingOptionalTable(reminderResult.error, "reminders") ? null : reminderResult.error);

  if (error) throw error;

  if (isMissingCropEventsTable(cropResult.error)) {
    console.warn("Tabela crop_events ainda nao existe no Supabase. Usando lavoura local.");
  }
  if (isMissingOptionalTable(reminderResult.error, "reminders")) {
    console.warn("Tabela reminders ainda nao existe no Supabase. Usando lembretes locais.");
  }

  state.milk = milkResult.data || [];
  state.animals = animalResult.data || [];
  state.lactations = lactationResult.data || [];
  state.breeding = breedingResult.data || [];
  state.medication = medicationResult.data || [];
  state.cropEvents = isMissingOptionalTable(cropResult.error, "crop_events") ? asArray(readLocal().cropEvents) : (cropResult.data || []);
  state.reminders = isMissingOptionalTable(reminderResult.error, "reminders") ? asArray(readLocal().reminders) : (reminderResult.data || []);
  await loadAppSettings();

  setStatus("Online", "online");
};

const loadData = async () => {
  if (!hasSupabase) {
    loadLocal();
    render();
    maybeShowOnboarding();
    return;
  }

  try {
    await processSyncQueue({ refresh: false });
    await loadSupabase();
  } catch (error) {
    console.error("Supabase load error:", error);
    loadLocal();
    setStatus(navigator.onLine ? supabaseErrorMessage(error) : "Offline (Modo Local)", "error");
  }

  populateCowSelects();
  render();
  maybeShowOnboarding();
};

const populateCowSelects = () => {
  const options = state.animals
    .map(
      (animal) =>
        `<option value="${escapeHtml(animal.id)}">${escapeHtml(animal.identification)}</option>`
    )
    .join("");

  ["#lactCowId", "#breedCowId", "#medCowId"].forEach((selector) => {
    const select = $(selector);
    if (select) select.innerHTML = options;
  });
};

const animalLabel = (cowId) => {
  const animal = state.animals.find(
    (item) => String(item.id) === String(cowId) || String(item.identification) === String(cowId)
  );
  return animal?.identification || cowId || "-";
};

const cowIdKey = (cowId) => String(cowId || "");

const sortMedicationRecords = (records) =>
  [...records].sort((a, b) => String(b.administration_date || "").localeCompare(String(a.administration_date || "")));

const getMedicationCowProfiles = () => {
  const profiles = new Map();

  state.animals.forEach((animal) => {
    const id = cowIdKey(animal.id);
    if (!id) return;
    profiles.set(id, {
      id: animal.id,
      label: animal.identification || animal.id,
      type: animal.type || "",
      status: animal.status || "",
      records: [],
    });
  });

  state.medication.forEach((record) => {
    const id = cowIdKey(record.cow_id);
    if (!id) return;

    if (!profiles.has(id)) {
      profiles.set(id, {
        id: record.cow_id,
        label: animalLabel(record.cow_id),
        type: "",
        status: "",
        records: [],
      });
    }

    profiles.get(id).records.push(record);
  });

  return [...profiles.values()]
    .map((profile) => ({ ...profile, records: sortMedicationRecords(profile.records) }))
    .sort((a, b) => String(a.label).localeCompare(String(b.label), "pt-BR", { numeric: true, sensitivity: "base" }));
};

const getSelectedMedicationProfile = (profiles) => {
  if (!profiles.length) {
    selectedMedicationCowId = null;
    return null;
  }

  const selected = profiles.find((profile) => cowIdKey(profile.id) === cowIdKey(selectedMedicationCowId));
  if (selected) return selected;

  const fallback = profiles.find((profile) => profile.records.length > 0) || profiles[0];
  selectedMedicationCowId = fallback.id;
  return fallback;
};

const SYNC_QUEUE_KEY = "controle-fazenda-sync-queue";
const MAX_SYNC_QUEUE_SIZE = 500;
const MAX_SYNC_ITEM_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

const getSyncQueue = () => {
  try {
    const queue = JSON.parse(localStorage.getItem(userStorageKey(SYNC_QUEUE_KEY))) || [];
    return Array.isArray(queue) ? queue : [];
  } catch {
    return [];
  }
};

const saveSyncQueue = (queue) => {
  try {
    localStorage.setItem(userStorageKey(SYNC_QUEUE_KEY), JSON.stringify(asArray(queue).slice(-MAX_SYNC_QUEUE_SIZE)));
    return true;
  } catch (error) {
    console.error("Erro ao salvar fila offline:", error);
    showToast("Nao foi possivel salvar a fila offline.", "error");
    return false;
  }
};

const enqueueMutation = (type, action, payload, recordId = null) => {
  if (!hasSupabase) return;
  const queue = getSyncQueue();
  saveSyncQueue([...queue, { id: localId(), type, action, payload, recordId, timestamp: Date.now() }]);
};

const upsertMilk = async (record) => {
  if (hasSupabase) {
    try {
      await requireSession();
      const { error } = await db.from("milk_records").upsert(withCurrentUser(record), { onConflict: "user_id,date" });
      if (error) throw error;
      await loadSupabase();
      return;
    } catch (error) {
      if (error.authRequired) throw error;
      handleSupabaseError(error, "salvar produção");
      enqueueMutation("milk", "upsert", record);
      setStatus("Offline (pendente)", "error");
    }
  }

  state.milk = state.milk.filter((item) => item.date !== record.date);
  state.milk.push({ ...record, id: localId() });
  writeLocal();
};

const insertAnimal = async (animal) => {
  const newId = localId();
  if (hasSupabase) {
    try {
      await requireSession();
      const { error } = await db.from("animals").insert(withCurrentUser(animal));
      if (error) throw error;
      await loadSupabase();
      return;
    } catch (error) {
      if (error.authRequired) throw error;
      handleSupabaseError(error, "salvar animal");
      enqueueMutation("animal", "insert", animal, newId);
      setStatus("Offline (pendente)", "error");
    }
  }

  state.animals.unshift({ ...animal, id: newId, created_at: new Date().toISOString() });
  writeLocal();
};

const insertLactation = async (record) => {
  const newId = localId();
  const payload = {
    cow_id: record.cow_id,
    start_date: record.start_date,
    end_date: record.end_date || null,
    daily_liters: record.daily_liters,
  };
  if (hasSupabase) {
    try {
      await requireSession();
      const { error } = await db.from("lactation_records").insert(withCurrentUser(payload));
      if (error) throw error;
      await loadSupabase();
      return;
    } catch (error) {
      if (error.authRequired) throw error;
      handleSupabaseError(error, "salvar lactação");
      enqueueMutation("lactation", "insert", payload, newId);
      setStatus("Offline (pendente)", "error");
    }
  }

  state.lactations.unshift({ ...payload, id: newId, created_at: new Date().toISOString() });
  writeLocal();
};

const insertBreeding = async (record) => {
  const newId = localId();
  const payload = {
    cow_id: record.cow_id,
    insemination_date: record.insemination_date,
    expected_calving_date: record.expected_calving_date,
  };
  if (hasSupabase) {
    try {
      await requireSession();
      const { error } = await db.from("breeding_records").insert(withCurrentUser(payload));
      if (error) throw error;
      await loadSupabase();
      return;
    } catch (error) {
      if (error.authRequired) throw error;
      handleSupabaseError(error, "salvar reprodução");
      enqueueMutation("breeding", "insert", payload, newId);
      setStatus("Offline (pendente)", "error");
    }
  }

  state.breeding.unshift({ ...payload, id: newId, created_at: new Date().toISOString() });
  writeLocal();
};

const insertMedication = async (record) => {
  const newId = localId();
  const payload = {
    cow_id: record.cow_id,
    medication_name: record.medication_name,
    dosage: record.dosage,
    administration_date: record.administration_date,
  };
  if (hasSupabase) {
    try {
      await requireSession();
      const { error } = await db.from("medication_records").insert(withCurrentUser(payload));
      if (error) throw error;
      await loadSupabase();
      return;
    } catch (error) {
      if (error.authRequired) throw error;
      handleSupabaseError(error, "salvar medicação");
      enqueueMutation("medication", "insert", payload, newId);
      setStatus("Offline (pendente)", "error");
    }
  }

  state.medication.unshift({ ...payload, id: newId, created_at: new Date().toISOString() });
  writeLocal();
};

const insertCropEvent = async (record) => {
  const newId = localId();
  const payload = normalizeCropEventInput(record);
  if (hasSupabase) {
    try {
      await requireSession();
      const { error } = await db.from("crop_events").insert(withCurrentUser(payload));
      if (error) throw error;
      await loadSupabase();
      return;
    } catch (error) {
      if (error.authRequired) throw error;
      handleSupabaseError(error, "salvar manejo da lavoura");
      enqueueMutation("crop", "insert", payload, newId);
      setStatus("Offline (pendente)", "error");
    }
  }

  state.cropEvents.unshift({ ...payload, id: newId, created_at: new Date().toISOString() });
  writeLocal();
};

const insertReminder = async (record) => {
  const newId = localId();
  const payload = normalizeReminderInput(record);
  if (hasSupabase) {
    try {
      await requireSession();
      const { error } = await db.from("reminders").insert(withCurrentUser(payload));
      if (error) throw error;
      await loadSupabase();
      return;
    } catch (error) {
      if (error.authRequired) throw error;
      handleSupabaseError(error, "salvar lembrete");
      enqueueMutation("reminder", "insert", payload, newId);
      setStatus("Offline (pendente)", "error");
    }
  }

  state.reminders.unshift({ ...payload, id: newId, created_at: new Date().toISOString() });
  writeLocal();
};

const collections = {
  milk: { stateKey: "milk", table: "milk_records" },
  animal: { stateKey: "animals", table: "animals" },
  lactation: { stateKey: "lactations", table: "lactation_records" },
  breeding: { stateKey: "breeding", table: "breeding_records" },
  medication: { stateKey: "medication", table: "medication_records" },
  crop: { stateKey: "cropEvents", table: "crop_events" },
  reminder: { stateKey: "reminders", table: "reminders" },
};

const findRecord = (type, id) => {
  const config = collections[type];
  if (!config) return null;
  return state[config.stateKey].find((record) => String(record.id) === String(id));
};

const updateRecord = async (type, id, changes) => {
  const config = collections[type];
  if (!config || !id) return;

  if (hasSupabase) {
    try {
      await requireSession();
      const { error } = await db.from(config.table).update(changes).eq("id", id).eq("user_id", currentUserId);
      if (error) throw error;
      await loadSupabase();
      return;
    } catch (error) {
      if (error.authRequired) throw error;
      handleSupabaseError(error, "atualizar registro");
      enqueueMutation(type, "update", changes, id);
      setStatus("Offline (pendente)", "error");
    }
  }

  state[config.stateKey] = state[config.stateKey].map((record) =>
    String(record.id) === String(id) ? { ...record, ...changes } : record
  );
  writeLocal();
};

const animalReferenceIds = (animal) =>
  new Set([animal?.id, animal?.identification].filter(Boolean).map((value) => String(value)));

const removeLocalAnimalRelations = (animal) => {
  const ids = animalReferenceIds(animal);
  if (ids.size === 0) return;

  state.lactations = state.lactations.filter((record) => !ids.has(String(record.cow_id)));
  state.breeding = state.breeding.filter((record) => !ids.has(String(record.cow_id)));
  state.medication = state.medication.filter((record) => !ids.has(String(record.cow_id)));
};

const deleteRecord = async (type, id) => {
  const config = collections[type];
  if (!config || !id) return;
  const record = findRecord(type, id);

  if (type === "animal" && hasSupabase) {
    try {
      await requireSession();
      const relatedIds = [record?.id].filter(Boolean).map(String);
      const cleanupResults = await Promise.all([
        ...relatedIds.map((animalId) =>
          db.from("lactation_records").delete().eq("cow_id", animalId).eq("user_id", currentUserId)
        ),
        ...relatedIds.map((animalId) =>
          db.from("breeding_records").delete().eq("cow_id", animalId).eq("user_id", currentUserId)
        ),
        ...relatedIds.map((animalId) =>
          db.from("medication_records").delete().eq("cow_id", animalId).eq("user_id", currentUserId)
        ),
      ]);
      const cleanupError = cleanupResults.find((result) => result.error)?.error;
      if (cleanupError) throw cleanupError;
    } catch (err) {
      console.warn("Aviso ao limpar registros relacionados:", err);
    }
  }

  if (hasSupabase) {
    try {
      await requireSession();
      const { error } = await db.from(config.table).delete().eq("id", id).eq("user_id", currentUserId);
      if (error) throw error;
      await loadSupabase();
      return;
    } catch (error) {
      if (error.authRequired) throw error;
      handleSupabaseError(error, "excluir registro");
      enqueueMutation(type, "delete", null, id);
      setStatus("Offline (pendente)", "error");
    }
  }

  state[config.stateKey] = state[config.stateKey].filter((record) => String(record.id) !== String(id));
  if (type === "animal") removeLocalAnimalRelations(record);
  writeLocal();
};

const validateSyncPayload = (type, action, payload) => {
  if (action === "delete") return true;
  if (!payload || typeof payload !== "object") return false;
  const allowedKeys = {
    milk: ["date", "liters", "user_id"],
    animal: ["identification", "type", "status", "user_id"],
    lactation: ["cow_id", "start_date", "end_date", "daily_liters", "user_id"],
    breeding: ["cow_id", "insemination_date", "expected_calving_date", "user_id"],
    medication: ["cow_id", "medication_name", "dosage", "administration_date", "user_id"],
    crop: ["plot_name", "crop_name", "event_type", "event_date", "product", "dosage", "area_tasks", "notes", "user_id"],
    reminder: ["title", "category", "due_date", "notes", "done", "completed_at", "user_id"],
  };
  const allowed = allowedKeys[type];
  if (!allowed) return false;
  const keys = Object.keys(payload);
  return keys.every((k) => allowed.includes(k));
};

const processSyncQueue = async ({ refresh = true } = {}) => {
  if (!hasSupabase) return;
  let queue = getSyncQueue();
  if (queue.length === 0) return;

  // Descartar itens muito antigos ou acima do limite máximo
  const cutoff = Date.now() - MAX_SYNC_ITEM_AGE_MS;
  const originalLength = queue.length;
  queue = queue
    .filter((item) => item.timestamp && item.timestamp > cutoff)
    .slice(0, MAX_SYNC_QUEUE_SIZE);
  if (queue.length !== originalLength) saveSyncQueue(queue);

  if (queue.length === 0) {
    setStatus("Online", "online");
    return;
  }

  await requireSession();
  setStatus(`Sincronizando ${queue.length}...`, "syncing");
  const remaining = [];

  for (const item of queue) {
    try {
      const config = collections[item.type];
      if (!config) continue;

      // Rejeitar payloads com chaves não permitidas
      if (!validateSyncPayload(item.type, item.action, item.payload)) {
        console.warn("Payload inválido descartado da fila de sync:", item);
        continue;
      }

      if (item.action === "insert") {
        await db.from(config.table).insert({ ...item.payload, user_id: currentUserId });
      } else if (item.action === "update") {
        await db.from(config.table).update(item.payload).eq("id", item.recordId).eq("user_id", currentUserId);
      } else if (item.action === "delete") {
        await db.from(config.table).delete().eq("id", item.recordId).eq("user_id", currentUserId);
      } else if (item.action === "upsert") {
        await db.from(config.table).upsert({ ...item.payload, user_id: currentUserId }, { onConflict: "user_id,date" });
      }
    } catch (err) {
      handleSupabaseError(err, "sincronizar pendência");
      remaining.push(item);
    }
  }

  saveSyncQueue(remaining);
  if (remaining.length === 0) {
    setStatus("Online", "online");
  } else {
    setStatus(`${remaining.length} erros no sync`, "error");
  }
  if (refresh) {
    await loadSupabase();
    render();
  }
};

// Validação de datas
const isValidDate = (dateStr) => Boolean(parseIsoDate(dateStr));

const isNotFutureDate = (dateStr) => {
  const date = parseIsoDate(dateStr);
  if (!date) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date <= today;
};

const isValidDateRange = (startStr, endStr) => {
  if (!endStr) return true;
  const start = parseIsoDate(startStr);
  const end = parseIsoDate(endStr);
  if (!start || !end) return false;

  return start <= end;
};

const validateNumber = (value, min = 0, max = 10000) => {
  const num = Number.parseFloat(value);
  return Number.isFinite(num) && num >= min && num <= max ? num : null;
};

const cleanText = (value, maxLength) => String(value || "").trim().slice(0, maxLength);

const optionalText = (value, maxLength) => cleanText(value, maxLength) || null;

const normalizeCropEventInput = (data) => {
  const plotName = cleanText(data.plot_name ?? data.plotName, 100);
  const cropName = cleanText(data.crop_name ?? data.cropName, 100);
  const eventType = cleanText(data.event_type ?? data.eventType, 80);
  const eventDate = String(data.event_date ?? data.eventDate ?? "");
  const areaRaw = data.area_tasks ?? data.areaTasks ?? "";
  const areaTasks = areaRaw === "" || areaRaw === null || areaRaw === undefined
    ? null
    : validateNumber(areaRaw, 0, 100000);

  if (!plotName) throw new Error("Talhao/area deve ter 1-100 caracteres");
  if (!cropName) throw new Error("Cultura deve ter 1-100 caracteres");
  if (!eventType) throw new Error("Manejo deve ter 1-80 caracteres");
  if (!isValidDate(eventDate)) throw new Error("Data invalida");
  if (!isNotFutureDate(eventDate)) throw new Error("Nao pode registrar manejo futuro");
  if (areaTasks === null && areaRaw !== "" && areaRaw !== null && areaRaw !== undefined) {
    throw new Error("Area em tarefas invalida");
  }

  return {
    plot_name: plotName,
    crop_name: cropName,
    event_type: eventType,
    event_date: eventDate,
    product: optionalText(data.product, 120),
    dosage: optionalText(data.dosage, 80),
    area_tasks: areaTasks,
    notes: optionalText(data.notes, 500),
  };
};

const normalizeReminderInput = (data) => {
  const title = cleanText(data.title, 120);
  const dueDate = String(data.due_date ?? data.dueDate ?? "");
  const category = cleanText(data.category || "Geral", 40) || "Geral";
  const notes = optionalText(data.notes, 300);
  const done = Boolean(data.done);

  if (!title) throw new Error("Lembrete deve ter 1-120 caracteres");
  if (!isValidDate(dueDate)) throw new Error("Data do lembrete invalida");

  return {
    title,
    category,
    due_date: dueDate,
    notes,
    done,
    completed_at: done ? (data.completed_at || new Date().toISOString()) : null,
  };
};

const showEditModal = (type, record) => {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className = "edit-modal-overlay";

    const getInputsHTML = () => {
      if (type === "milk") {
        return `<label>Litros: <input type="number" name="liters" min="0" max="1000" step="0.1" value="${escapeHtml(String(record.liters ?? ''))}" required></label>`;
      } else if (type === "animal") {
        return `
          <label>Tipo: <input type="text" name="type" value="${escapeHtml(record.type)}" required></label>
          <label>Status: <input type="text" name="status" value="${escapeHtml(record.status)}" required></label>
        `;
      } else if (type === "lactation") {
        return `
          <label>Litros/dia: <input type="number" name="daily_liters" min="0" max="500" step="0.1" value="${escapeHtml(String(record.daily_liters ?? ''))}" required></label>
          <label>Fim (AAAA-MM-DD): <input type="date" name="end_date" value="${escapeHtml(record.end_date || '')}"></label>
        `;
      } else if (type === "breeding") {
        return `<label>Parto previsto: <input type="date" name="expected_calving_date" value="${escapeHtml(record.expected_calving_date || '')}" required></label>`;
      } else if (type === "medication") {
        return `
          <label>Medicamento: <input type="text" name="medication_name" value="${escapeHtml(record.medication_name)}" required></label>
          <label>Dosagem: <input type="text" name="dosage" value="${escapeHtml(record.dosage || '')}"></label>
          <label>Data: <input type="date" name="administration_date" value="${escapeHtml(record.administration_date || '')}" required></label>
        `;
      } else if (type === "crop") {
        return `
          <label>Talhão/área: <input type="text" name="plot_name" value="${escapeHtml(record.plot_name || '')}" required></label>
          <label>Cultura: <input type="text" name="crop_name" value="${escapeHtml(record.crop_name || '')}" required></label>
          <label>Manejo: <input type="text" name="event_type" value="${escapeHtml(record.event_type || '')}" required></label>
          <label>Data: <input type="date" name="event_date" value="${escapeHtml(record.event_date || '')}" required></label>
          <label>Produto/insumo: <input type="text" name="product" value="${escapeHtml(record.product || '')}"></label>
          <label>Dosagem: <input type="text" name="dosage" value="${escapeHtml(record.dosage || '')}"></label>
          <label>Área (tarefas): <input type="number" name="area_tasks" min="0" max="100000" step="0.01" value="${escapeHtml(String(record.area_tasks ?? ''))}"></label>
          <label>Observações: <textarea name="notes" rows="3">${escapeHtml(record.notes || '')}</textarea></label>
        `;
      } else if (type === "reminder") {
        return `
          <label>Titulo: <input type="text" name="title" value="${escapeHtml(record.title || '')}" required></label>
          <label>Categoria: <input type="text" name="category" value="${escapeHtml(record.category || 'Geral')}" required></label>
          <label>Data: <input type="date" name="due_date" value="${escapeHtml(record.due_date || '')}" required></label>
          <label>Observacoes: <textarea name="notes" rows="3">${escapeHtml(record.notes || '')}</textarea></label>
        `;
      }
      return "";
    };

    modal.innerHTML = `
      <div class="edit-modal-card">
        <h2>Editar Registro</h2>
        <form id="editForm" class="edit-modal-form">
          ${getInputsHTML()}
          <div class="edit-modal-actions">
            <button type="button" id="cancelBtn" class="ghost">Cancelar</button>
            <button type="submit">Salvar</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const form = modal.querySelector("#editForm");
    const cancelBtn = modal.querySelector("#cancelBtn");

    const cleanup = () => {
      modal.remove();
    };

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const data = Object.fromEntries(formData);
      cleanup();
      resolve(data);
    });

    cancelBtn.addEventListener("click", () => {
      cleanup();
      resolve(null);
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        cleanup();
        resolve(null);
      }
    });
  });
};

const editRecord = async (type, id) => {
  const record = findRecord(type, id);
  if (!record) return;

  const data = await showEditModal(type, record);
  if (!data) return;

  try {
    if (type === "milk") {
      const liters = validateNumber(data.liters, 0, 1000);
      if (liters === null) throw new Error("Litros inválido (0-1000)");
      await updateRecord(type, id, { liters });
    } else if (type === "animal") {
      if (!data.type?.trim()) throw new Error("Tipo inválido");
      if (!data.status?.trim()) throw new Error("Status inválido");
      await updateRecord(type, id, { type: data.type.trim(), status: data.status.trim() });
    } else if (type === "lactation") {
      const dailyLiters = validateNumber(data.daily_liters, 0, 500);
      if (dailyLiters === null) throw new Error("Litros/dia inválido (0-500)");
      if (data.end_date && !isValidDateRange(record.start_date, data.end_date)) {
        throw new Error("Data de fim não pode ser antes do início");
      }
      await updateRecord(type, id, { daily_liters: dailyLiters, end_date: data.end_date || null });
    } else if (type === "breeding") {
      if (!data.expected_calving_date) throw new Error("Data de parto obrigatória");
      if (!isValidDate(data.expected_calving_date)) throw new Error("Data inválida");
      await updateRecord(type, id, { expected_calving_date: data.expected_calving_date });
    } else if (type === "medication") {
      if (!data.medication_name?.trim()) throw new Error("Medicamento inválido");
      if (!data.administration_date) throw new Error("Data de aplicação obrigatória");
      if (!isValidDate(data.administration_date)) throw new Error("Data inválida");
      await updateRecord(type, id, {
        medication_name: data.medication_name.trim(),
        dosage: (data.dosage || "").trim(),
        administration_date: data.administration_date,
      });
    } else if (type === "crop") {
      const plotName = (data.plot_name || "").trim();
      const cropName = (data.crop_name || "").trim();
      const eventType = (data.event_type || "").trim();
      const eventDate = data.event_date;
      const areaTasks = data.area_tasks ? validateNumber(data.area_tasks, 0, 100000) : null;

      if (!plotName || plotName.length > 100) throw new Error("Talhão/área deve ter 1-100 caracteres");
      if (!cropName || cropName.length > 100) throw new Error("Cultura deve ter 1-100 caracteres");
      if (!eventType || eventType.length > 80) throw new Error("Manejo deve ter 1-80 caracteres");
      if (!isValidDate(eventDate)) throw new Error("Data inválida");
      if (!isNotFutureDate(eventDate)) throw new Error("Não pode registrar manejo futuro");
      if (data.area_tasks && areaTasks === null) throw new Error("Área em tarefas inválida");

      await updateRecord(type, id, {
        plot_name: plotName,
        crop_name: cropName,
        event_type: eventType,
        event_date: eventDate,
        product: (data.product || "").trim().substring(0, 120) || null,
        dosage: (data.dosage || "").trim().substring(0, 80) || null,
        area_tasks: areaTasks,
        notes: (data.notes || "").trim().substring(0, 500) || null,
      });
    } else if (type === "reminder") {
      await updateRecord(type, id, {
        ...normalizeReminderInput(data),
        done: Boolean(record.done),
        completed_at: record.completed_at || null,
      });
    }
    populateCowSelects();
    render();
    showToast("Registro atualizado com sucesso!");
  } catch (error) {
    showToast(error.message || "Erro ao editar", "error");
  }
};

const removeRecord = async (type, id) => {
  if (!findRecord(type, id)) return;
  const confirmed = window.confirm("Deseja excluir este registro?");
  if (!confirmed) return;

  await deleteRecord(type, id);
  populateCowSelects();
  render();
};

const toggleReminder = async (id) => {
  const reminder = findRecord("reminder", id);
  if (!reminder) return;
  const done = !reminder.done;
  await updateRecord("reminder", id, {
    done,
    completed_at: done ? new Date().toISOString() : null,
  });
  render();
  showToast(done ? "Lembrete concluido." : "Lembrete reaberto.");
};

const handleRecordAction = async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const { action, type, id } = button.dataset;

  try {
    if (action === "edit") await editRecord(type, id);
    if (action === "delete") await removeRecord(type, id);
    if (action === "toggle-reminder") await toggleReminder(id);
  } catch (error) {
    console.error(error);
    showToast("Não foi possível concluir a ação.", "error");
  }
};

const empty = (text) => `<p class="empty">${escapeHtml(text)}</p>`;

const diffDays = (fromIso, toIso) => {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  if (!from || !to) return null;
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
};

const daysFromToday = (isoDate) => diffDays(todayIso(), isoDate);

const alertStatus = (dueDate, done = false) => {
  if (done) return "done";
  const days = daysFromToday(dueDate);
  if (days === null) return "upcoming";
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "week";
  return "upcoming";
};

const alertStatusLabel = (dueDate, done = false) => {
  const status = alertStatus(dueDate, done);
  const days = daysFromToday(dueDate);
  if (status === "done") return "Concluido";
  if (status === "overdue") return `${Math.abs(days)} dia${Math.abs(days) === 1 ? "" : "s"} atrasado`;
  if (status === "today") return "Hoje";
  if (status === "week") return `Em ${days} dia${days === 1 ? "" : "s"}`;
  return formatDate(dueDate);
};

const makeAlert = ({ id, title, due_date, category, notes = "", type = "auto", done = false }) => ({
  id,
  title,
  due_date,
  category,
  notes,
  type,
  done,
  status: alertStatus(due_date, done),
});

const cropFollowUpRules = [
  { match: "plantio", days: 30, title: "Revisar desenvolvimento da lavoura" },
  { match: "pulver", days: 15, title: "Checar efeito da pulverizacao" },
  { match: "aduba", days: 30, title: "Avaliar resposta da adubacao" },
  { match: "irriga", days: 7, title: "Revisar irrigacao" },
  { match: "observ", days: 7, title: "Retornar observacao da lavoura" },
];

const buildAutomaticAlerts = () => {
  const today = todayIso();
  const alerts = [];

  if (!state.milk.some((record) => record.date === today)) {
    alerts.push(makeAlert({
      id: "auto-milk-today",
      title: "Registrar producao de leite de hoje",
      due_date: today,
      category: "Leite",
      notes: "Ainda nao existe producao lancada para hoje.",
    }));
  }

  state.breeding.forEach((record) => {
    const days = daysFromToday(record.expected_calving_date);
    if (days === null || days < -15 || days > 60) return;
    alerts.push(makeAlert({
      id: `auto-calving-${record.id || record.cow_id}-${record.expected_calving_date}`,
      title: `Parto previsto: ${animalLabel(record.cow_id)}`,
      due_date: record.expected_calving_date,
      category: "Gestacao",
      notes: `Prenhez registrada em ${formatDate(record.insemination_date)}.`,
    }));
  });

  state.lactations.forEach((record) => {
    if (record.end_date) return;
    const daysActive = diffDays(record.start_date, today);
    if (daysActive === null || daysActive < 300) return;
    alerts.push(makeAlert({
      id: `auto-lactation-${record.id || record.cow_id}`,
      title: `Revisar lactacao longa: ${animalLabel(record.cow_id)}`,
      due_date: today,
      category: "Lactacao",
      notes: `${daysActive} dias desde ${formatDate(record.start_date)}.`,
    }));
  });

  state.cropEvents.forEach((record) => {
    const eventType = String(record.event_type || "").toLowerCase();
    const rule = cropFollowUpRules.find((item) => eventType.includes(item.match));
    if (!rule || !isValidDate(record.event_date)) return;
    const dueDate = addDaysIso(record.event_date, rule.days);
    const days = daysFromToday(dueDate);
    if (days === null || days < -15 || days > 45) return;
    alerts.push(makeAlert({
      id: `auto-crop-${record.id || record.plot_name}-${dueDate}`,
      title: rule.title,
      due_date: dueDate,
      category: "Lavoura",
      notes: `${record.plot_name || "Area"} - ${record.crop_name || record.event_type || "manejo"}.`,
    }));
  });

  return alerts;
};

const buildAlerts = () => {
  const manual = state.reminders.map((record) =>
    makeAlert({
      id: record.id,
      title: record.title,
      due_date: record.due_date,
      category: record.category || "Geral",
      notes: record.notes || "",
      type: "manual",
      done: Boolean(record.done),
    })
  );

  return [...buildAutomaticAlerts(), ...manual].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const statusOrder = { overdue: 0, today: 1, week: 2, upcoming: 3, done: 4 };
    return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3)
      || String(a.due_date || "").localeCompare(String(b.due_date || ""));
  });
};

const subscriptionLabels = {
  trial: "Teste",
  active: "Ativa",
  overdue: "Vencida",
  blocked: "Bloqueada",
  canceled: "Cancelada",
};

const daysUntil = (isoDate) => {
  if (!isoDate || !isValidDate(isoDate)) return null;
  const today = new Date(todayIso() + "T00:00:00");
  const dueDate = new Date(isoDate + "T00:00:00");
  return Math.ceil((dueDate - today) / (24 * 60 * 60 * 1000));
};

const subscriptionMessage = (profile) => {
  const days = daysUntil(profile.subscriptionDueDate);
  const label = subscriptionLabels[profile.subscriptionStatus] || "Indefinida";

  if (profile.subscriptionStatus === "blocked") return "Acesso bloqueado. Fale com o suporte para regularizar.";
  if (profile.subscriptionStatus === "overdue") return "Assinatura vencida. Regularize para manter o acesso.";
  if (days === null) return `${label}. Vencimento ainda não definido.`;
  if (days < 0) return `${label}. Venceu em ${formatDate(profile.subscriptionDueDate)}.`;
  if (days === 0) return `${label}. Vence hoje.`;
  return `${label}. Vence em ${days} dia${days === 1 ? "" : "s"}.`;
};

const applySubscriptionAccess = (profile) => {
  const blocked = ["blocked", "canceled"].includes(profile.subscriptionStatus);
  document.body.classList.toggle("subscription-blocked", blocked);
  document
    .querySelectorAll("#milkForm input, #milkForm button, #animalForm input, #animalForm select, #animalForm button, #lactationForm input, #lactationForm select, #lactationForm button, #breedingForm input, #breedingForm select, #breedingForm button, #medicationForm input, #medicationForm select, #medicationForm button, #cropForm input, #cropForm select, #cropForm textarea, #cropForm button, #reminderForm input, #reminderForm select, #reminderForm textarea, #reminderForm button")
    .forEach((control) => {
      control.disabled = blocked;
    });
};

const renderClientPanel = () => {
  const profile = normalizeClientProfile(state.clientProfile);
  const subscription = normalizeSubscription(state.subscription);
  const displayProfile = { ...profile, ...subscription };
  state.clientProfile = profile;
  state.subscription = subscription;
  applySubscriptionAccess(displayProfile);

  if (el.farmNameInput) el.farmNameInput.value = profile.farmName || "";
  if (el.ownerNameInput) el.ownerNameInput.value = profile.ownerName || "";
  if (el.clientWhatsappInput) el.clientWhatsappInput.value = profile.whatsapp || "";
  if (el.subscriptionStatusInput) el.subscriptionStatusInput.value = displayProfile.subscriptionStatus || "trial";
  if (el.subscriptionDueDateInput) el.subscriptionDueDateInput.value = displayProfile.subscriptionDueDate || "";
  if (el.planPriceValue) el.planPriceValue.textContent = `${formatMoney(planPrice)}/mês`;
  if (el.trialDaysValue) el.trialDaysValue.textContent = `${trialDays} dias grátis`;
  if (el.pixKeyValue) el.pixKeyValue.textContent = "Solicite a chave pelo WhatsApp";
  if (el.copyPixButton) el.copyPixButton.disabled = false;
  if (el.subscribeButton) {
    el.subscribeButton.setAttribute("href", subscribeUrl());
    if (subscribeUrl().startsWith("https://")) {
      el.subscribeButton.setAttribute("target", "_blank");
      el.subscribeButton.setAttribute("rel", "noopener noreferrer");
    }
  }

  if (el.clientSummary) {
    const label = subscriptionLabels[displayProfile.subscriptionStatus] || "Indefinida";
    el.clientSummary.innerHTML = `
      <article>
        <span>Fazenda</span>
        <strong>${escapeHtml(profile.farmName || "Não informada")}</strong>
      </article>
      <article>
        <span>Responsável</span>
        <strong>${escapeHtml(profile.ownerName || "Não informado")}</strong>
      </article>
      <article>
        <span>Assinatura</span>
        <strong class="subscription-pill ${escapeHtml(displayProfile.subscriptionStatus || "trial")}">${escapeHtml(label)}</strong>
      </article>
      <article>
        <span>Vencimento</span>
        <strong>${escapeHtml(displayProfile.subscriptionDueDate ? formatDate(displayProfile.subscriptionDueDate) : "A definir")}</strong>
      </article>
      <p>${escapeHtml(subscriptionMessage(displayProfile))}</p>
    `;
  }
};

const renderPriceQuote = () => {
  const price = Number(state.priceQuote || 0);
  const formatted = price.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  el.priceQuoteDisplay.textContent = `R$ ${formatted}/L`;
  el.priceQuoteValue.textContent = `R$ ${formatted} por litro`;
};

const renderSummary = () => {
  const price = Number(state.priceQuote || 0);
  const todayRecord = state.milk.find((record) => record.date === todayIso());
  const todayLiters = Number(todayRecord?.liters || 0);
  const monthRecords = state.milk.filter((record) => record.date?.startsWith(monthKey()));
  const monthLiters = monthRecords.reduce((sum, record) => sum + Number(record.liters || 0), 0);
  const lactating = state.animals.filter((animal) => animal.status === "Em lactação").length;

  el.todayTotal.textContent = formatLiters(todayLiters);
  el.todayValue.textContent = formatMoney(todayLiters * price);
  el.monthTotal.textContent = formatLiters(monthLiters);
  el.monthValue.textContent = formatMoney(monthLiters * price);
  el.animalTotal.textContent = state.animals.length;
  el.lactatingTotal.textContent = `${lactating} em lactação`;
};

const renderMilk = () => {
  const price = Number(state.priceQuote || 0);
  const records = [...state.milk].sort((a, b) => b.date.localeCompare(a.date));
  const monthRecords = state.milk.filter((record) => record.date?.startsWith(monthKey()));
  const monthAverage = monthRecords.length ? monthRecords.reduce((sum, r) => sum + Number(r.liters || 0), 0) / monthRecords.length : 0;

  el.historyList.innerHTML = records.length
    ? records
        .map(
          (record) => {
            const prodStatus = getProductionStatus(Number(record.liters || 0), monthAverage);
            return `
            <article class="item" data-milk-id="${escapeHtml(record.id)}">
              <div>
                <div class="item-title-row">
                  <span>${escapeHtml(formatDate(record.date))}</span>
                  ${createStatusBadge(prodStatus)}
                </div>
                <small>${escapeHtml(formatMoney(price))} por litro</small>
              </div>
              <strong>${escapeHtml(formatLiters(record.liters))} | ${escapeHtml(formatMoney(Number(record.liters) * price))}</strong>
              ${recordActions("milk", record)}
            </article>
          `;
          }
        )
        .join("")
    : empty("Nenhuma produção registrada.");
};

const renderAnimals = () => {
  el.animalList.innerHTML = state.animals.length
    ? state.animals
        .map(
          (animal) => `
            <article class="item" data-animal-id="${escapeHtml(animal.id)}">
              <div>
                <span>${escapeHtml(animal.identification)}</span>
                <small>${escapeHtml(animal.type)}</small>
              </div>
              <strong>${escapeHtml(animal.status)}</strong>
              ${recordActions("animal", animal)}
            </article>
          `
        )
        .join("")
    : empty("Nenhum animal cadastrado.");
};

const renderLactations = () => {
  el.lactationList.innerHTML = state.lactations.length
    ? state.lactations
        .map(
          (record) => `
            <article class="item">
              <div>
                <span>${escapeHtml(animalLabel(record.cow_id))}</span>
                <small>${escapeHtml(formatDate(record.start_date))} -> ${
            record.end_date ? escapeHtml(formatDate(record.end_date)) : "atual"
          }</small>
              </div>
              <strong>${escapeHtml(formatLiters(record.daily_liters))} / dia</strong>
              ${recordActions("lactation", record)}
            </article>
          `
        )
        .join("")
    : empty("Nenhuma lactação registrada.");
};

const renderBreeding = () => {
  el.breedingList.innerHTML = state.breeding.length
    ? state.breeding
        .map(
          (record) => `
            <article class="item">
              <div>
                <span>${escapeHtml(animalLabel(record.cow_id))}</span>
                <small>Prenhez: ${escapeHtml(formatDate(record.insemination_date))}</small>
              </div>
              <strong>Parto: ${escapeHtml(formatDate(record.expected_calving_date))}</strong>
              ${recordActions("breeding", record)}
            </article>
          `
        )
        .join("")
    : empty("Nenhuma reprodução registrada.");
};

const renderMedicalCowRecord = (profile) => {
  const records = profile.records;
  const lastRecord = records[0];
  const animalInfo = [profile.type, profile.status].filter(Boolean).join(" | ");
  const countLabel = `${records.length} ${records.length === 1 ? "registro" : "registros"}`;

  return `
    <article class="medical-record-card">
      <header class="medical-record-head">
        <div>
          <span>Ficha médica</span>
          <h3>${escapeHtml(profile.label)}</h3>
          <small>${escapeHtml(animalInfo || "Dados do rebanho")}</small>
        </div>
        <strong>${escapeHtml(countLabel)}</strong>
      </header>
      <div class="medical-record-summary">
        <span>
          <small>Total</small>
          <strong>${escapeHtml(String(records.length))}</strong>
        </span>
        <span>
          <small>Última aplicação</small>
          <strong>${escapeHtml(lastRecord ? formatDate(lastRecord.administration_date) : "-")}</strong>
        </span>
        <span>
          <small>Último medicamento</small>
          <strong>${escapeHtml(lastRecord?.medication_name || "-")}</strong>
        </span>
      </div>
      <div class="medical-history">
        ${
          records.length
            ? records
                .map(
                  (record) => `
                    <article class="item medical-history-item">
                      <div>
                        <span>${escapeHtml(record.medication_name)}</span>
                        <small>${escapeHtml(formatDate(record.administration_date))}</small>
                      </div>
                      <strong>${escapeHtml(record.dosage || "Sem dosagem")}</strong>
                      ${recordActions("medication", record)}
                    </article>
                  `
                )
                .join("")
            : empty("Nenhuma medicação registrada para esta vaca.")
        }
      </div>
    </article>
  `;
};

const renderMedication = () => {
  const profiles = getMedicationCowProfiles();
  const selectedProfile = getSelectedMedicationProfile(profiles);
  const medCowSelect = $("#medCowId");

  if (!profiles.length) {
    el.medicationList.innerHTML = empty("Cadastre uma vaca para criar a ficha médica.");
    return;
  }

  if (
    selectedProfile &&
    medCowSelect &&
    Array.from(medCowSelect.options).some((option) => cowIdKey(option.value) === cowIdKey(selectedProfile.id))
  ) {
    medCowSelect.value = selectedProfile.id;
  }

  el.medicationList.innerHTML = `
    <div class="medical-workspace">
      <div class="medical-cow-tabs" role="tablist" aria-label="Fichas médicas das vacas">
        ${profiles
          .map((profile) => {
            const active = cowIdKey(profile.id) === cowIdKey(selectedProfile?.id);
            const lastRecord = profile.records[0];
            const countLabel = `${profile.records.length} ${profile.records.length === 1 ? "registro" : "registros"}`;
            return `
              <button
                class="medical-cow-tab ${active ? "active" : ""}"
                type="button"
                data-medical-cow-id="${escapeHtml(profile.id)}"
                role="tab"
                aria-selected="${active ? "true" : "false"}"
              >
                <span>${escapeHtml(profile.label)}</span>
                <small>${escapeHtml(countLabel)}</small>
                <em>${escapeHtml(lastRecord ? formatDate(lastRecord.administration_date) : "Sem medicação")}</em>
              </button>
            `;
          })
          .join("")}
      </div>
      <div class="medical-record-panel" role="tabpanel">
        ${selectedProfile ? renderMedicalCowRecord(selectedProfile) : empty("Selecione uma vaca para abrir a ficha médica.")}
      </div>
    </div>
  `;
};

const renderCropEvents = () => {
  if (!el.cropEventList) return;

  const records = [...state.cropEvents].sort((a, b) =>
    String(b.event_date || "").localeCompare(String(a.event_date || ""))
  );

  el.cropEventList.innerHTML = records.length
    ? records
        .map((record) => {
          const details = [
            record.product ? `Produto: ${record.product}` : "",
            record.dosage ? `Dose: ${record.dosage}` : "",
          ].filter(Boolean);
          const areaLabel = formatTasks(record.area_tasks);
          return `
            <article class="item">
              <div>
                <span>${escapeHtml(record.plot_name)} - ${escapeHtml(record.event_type)}</span>
                <small>${escapeHtml(formatDate(record.event_date))} | ${escapeHtml(record.crop_name)}</small>
                ${details.length ? `<small>${escapeHtml(details.join(" | "))}</small>` : ""}
                ${record.notes ? `<small>${escapeHtml(record.notes)}</small>` : ""}
              </div>
              <strong>${escapeHtml(areaLabel || record.event_type)}</strong>
              ${recordActions("crop", record)}
            </article>
          `;
        })
        .join("")
    : empty("Nenhum manejo de lavoura registrado.");
};

const renderAlertItem = (alert) => {
  const isManual = alert.type === "manual";
  return `
    <article class="item alert-item ${escapeHtml(alert.status)}">
      <div>
        <div class="item-title-row">
          <span>${escapeHtml(alert.title)}</span>
          <span class="alert-pill ${escapeHtml(alert.status)}">${escapeHtml(alertStatusLabel(alert.due_date, alert.done))}</span>
        </div>
        <small>${escapeHtml(alert.category)} | ${escapeHtml(formatDate(alert.due_date))}</small>
        ${alert.notes ? `<small>${escapeHtml(alert.notes)}</small>` : ""}
      </div>
      <strong>${escapeHtml(isManual ? "Lembrete" : "Automatico")}</strong>
      ${isManual ? reminderActions(findRecord("reminder", alert.id) || alert) : ""}
    </article>
  `;
};

const renderAlerts = () => {
  if (!el.alertList) return;

  const alerts = buildAlerts();
  const activeAlerts = alerts.filter((alert) => !alert.done);
  const counts = {
    overdue: activeAlerts.filter((alert) => alert.status === "overdue").length,
    today: activeAlerts.filter((alert) => alert.status === "today").length,
    week: activeAlerts.filter((alert) => alert.status === "week").length,
    open: activeAlerts.length,
  };

  if (el.alertOverdueTotal) el.alertOverdueTotal.textContent = String(counts.overdue);
  if (el.alertTodayTotal) el.alertTodayTotal.textContent = String(counts.today);
  if (el.alertWeekTotal) el.alertWeekTotal.textContent = String(counts.week);
  if (el.alertOpenTotal) el.alertOpenTotal.textContent = String(counts.open);

  el.alertList.innerHTML = alerts.length
    ? alerts.map(renderAlertItem).join("")
    : empty("Nenhum alerta no momento.");
};

const renderWeatherForecast = (data) => {
  if (!el.weatherForecast) return;

  const locationParts = [data.location?.name, data.location?.region, data.location?.country].filter(Boolean);
  const days = Array.isArray(data.forecast) ? data.forecast : [];

  el.weatherForecast.innerHTML = `
    <div class="weather-header">
      <div>
        <span>Previsao do tempo</span>
        <strong>${escapeHtml(locationParts.join(" - ") || "Local informado")}</strong>
      </div>
      <small>${escapeHtml(data.source || "Open-Meteo")}</small>
    </div>
    <div class="weather-grid">
      ${days.map((day) => `
        <article class="weather-day">
          <span>${escapeHtml(formatDate(day.date))}</span>
          <strong>${escapeHtml(day.condition || "Tempo variavel")}</strong>
          <small>${escapeHtml(`${Number(day.temperatureMin ?? 0).toLocaleString("pt-BR")} a ${Number(day.temperatureMax ?? 0).toLocaleString("pt-BR")} C`)}</small>
          <small>${escapeHtml(`Chuva: ${day.precipitationProbability ?? 0}% | ${day.precipitationMm ?? 0} mm`)}</small>
          <small>${escapeHtml(`Vento: ${day.windSpeedKmh ?? 0} km/h`)}</small>
        </article>
      `).join("")}
    </div>
  `;
};

const loadWeatherForecast = async (city) => {
  if (!el.weatherForecast) return;
  el.weatherForecast.innerHTML = `<p class="empty">Buscando previsao...</p>`;

  const response = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "Nao foi possivel buscar a previsao.");

  localStorage.setItem(userStorageKey("weather_city"), city);
  renderWeatherForecast(data);
};

const buildMonthlyReport = () => {
  const price = Number(state.priceQuote || 0);
  const currentMonth = monthKey();
  const today = todayIso();
  const calvingLimit = addDaysIso(today, 60);
  const monthRecords = state.milk.filter((record) => record.date?.startsWith(currentMonth));
  const monthLiters = monthRecords.reduce((sum, record) => sum + Number(record.liters || 0), 0);
  const average = monthRecords.length ? monthLiters / monthRecords.length : 0;
  const bestRecord = monthRecords.reduce(
    (best, record) => (Number(record.liters || 0) > Number(best?.liters || 0) ? record : best),
    null
  );
  const lactating = state.animals.filter((animal) => animal.status === "Em lactação").length;
  const medications = state.medication.filter((record) => record.administration_date?.startsWith(currentMonth));
  const calvings = state.breeding.filter(
    (record) => record.expected_calving_date >= today && record.expected_calving_date <= calvingLimit
  );

  return {
    price,
    monthRecords,
    monthLiters,
    monthValue: monthLiters * price,
    average,
    bestRecord,
    lactating,
    medications,
    calvings,
  };
};

const renderReportDetails = (report) => {
  if (!el.reportDetails) return;

  el.reportDetails.innerHTML = `
    <article>
      <span>Animais em lactação</span>
      <strong>${escapeHtml(String(report.lactating))}</strong>
      <small>${escapeHtml(String(state.animals.length))} animais cadastrados</small>
    </article>
    <article>
      <span>Medicações no mês</span>
      <strong>${escapeHtml(String(report.medications.length))}</strong>
      <small>${escapeHtml(report.medications.slice(0, 2).map((item) => item.medication_name).join(", ") || "Nenhuma aplicação")}</small>
    </article>
    <article>
      <span>Previsão de parto</span>
      <strong>${escapeHtml(String(report.calvings.length))}</strong>
      <small>${escapeHtml(report.calvings.slice(0, 2).map((item) => `${animalLabel(item.cow_id)}: ${formatDate(item.expected_calving_date)}`).join(", ") || "Sem partos nos próximos 60 dias")}</small>
    </article>
    <article>
      <span>Faturamento estimado</span>
      <strong>${escapeHtml(formatMoney(report.monthValue))}</strong>
      <small>${escapeHtml(formatMoney(report.price))} por litro</small>
    </article>
  `;
};

let productionChart = null;

const renderReports = () => {
  const report = buildMonthlyReport();
  const chartRecords = [...state.milk]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30); // 30 dias em vez de 10

  el.reportMonthTotal.textContent = formatLiters(report.monthLiters);
  el.reportMonthValue.textContent = formatMoney(report.monthValue);
  el.reportAverage.textContent = formatLiters(report.average);
  el.reportBestDay.textContent = report.bestRecord ? `${formatDate(report.bestRecord.date)} - ${formatLiters(report.bestRecord.liters)}` : "-";
  renderReportDetails(report);

  // Chart.js gráfico interativo
  if (chartRecords.length > 0 && window.Chart && el.productionChart) {
    const ctx = el.productionChart.getContext ? el.productionChart : document.createElement('canvas');
    
    if (!productionChart) {
      el.productionChart.innerHTML = ''; // Limpar container
      el.productionChart.appendChild(ctx);
      productionChart = new window.Chart(ctx, {
        type: 'line',
        data: {
          labels: chartRecords.map(r => formatDate(r.date)),
          datasets: [
            {
              label: 'Produção (L)',
              data: chartRecords.map(r => Number(r.liters || 0)),
              borderColor: '#176c56',
              backgroundColor: 'rgba(23, 108, 86, 0.1)',
              borderWidth: 2,
              fill: true,
              tension: 0.3,
              pointRadius: 5,
              pointBackgroundColor: '#176c56',
              pointBorderColor: '#ffffff',
              pointBorderWidth: 2,
              pointHoverRadius: 7,
            },
            {
              label: 'Média mensal',
              data: chartRecords.map(() => report.average),
              borderColor: '#b7791f',
              borderWidth: 2,
              borderDash: [5, 5],
              fill: false,
              pointRadius: 0,
              tension: 0,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: true, position: 'top' },
            tooltip: {
              backgroundColor: 'rgba(0,0,0,0.8)',
              padding: 12,
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${formatLiters(ctx.parsed.y)}`,
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: (v) => formatLiters(v) }
            }
          }
        }
      });
    } else {
      productionChart.data.labels = chartRecords.map(r => formatDate(r.date));
      productionChart.data.datasets[0].data = chartRecords.map(r => Number(r.liters || 0));
      productionChart.data.datasets[1].data = chartRecords.map(() => report.average);
      productionChart.update();
    }
  }
};

const render = () => {
  renderClientPanel();
  renderPriceQuote();
  renderSummary();
  renderMilk();
  renderAnimals();
  renderLactations();
  renderBreeding();
  renderMedication();
  renderCropEvents();
  renderAlerts();
  renderReports();
};

const exportDataBackup = () => {
  const pendingSyncCount = getSyncQueue().length;
  const backup = {
    exported_at: new Date().toISOString(),
    data: state,
    pending_sync_count: pendingSyncCount,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `controle-fazenda-backup-${todayIso()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Backup exportado com sucesso!");
};

const printCurrentReport = () => {
  renderReports();
  document.body.classList.add("printing-report");
  window.print();
  setTimeout(() => document.body.classList.remove("printing-report"), 400);
};

const hideOnboarding = () => {
  if (el.onboardingModal) el.onboardingModal.classList.add("hidden");
};

const maybeShowOnboarding = () => {
  if (!el.onboardingModal || !currentUserId) return;
  const profile = normalizeClientProfile(state.clientProfile);
  if (profile.onboardingDone) {
    hideOnboarding();
    return;
  }
  el.onboardingModal.classList.remove("hidden");
  const farmInput = $("#onboardingFarmName");
  const ownerInput = $("#onboardingOwnerName");
  const whatsappInput = $("#onboardingWhatsapp");
  const priceInput = $("#onboardingPrice");
  const dateInput = $("#onboardingFirstDate");
  if (farmInput) farmInput.value = profile.farmName || "";
  if (ownerInput) ownerInput.value = profile.ownerName || "";
  if (whatsappInput) whatsappInput.value = profile.whatsapp || "";
  if (priceInput) priceInput.value = state.priceQuote ? String(state.priceQuote) : "";
  if (dateInput && !dateInput.value) dateInput.value = todayIso();
};

const completeOnboarding = async (skip = false) => {
  const profile = normalizeClientProfile(state.clientProfile);
  const formData = el.onboardingForm ? new FormData(el.onboardingForm) : new FormData();
  const nextProfile = {
    ...profile,
    farmName: String(formData.get("farmName") || profile.farmName || "").trim(),
    ownerName: String(formData.get("ownerName") || profile.ownerName || "").trim(),
    whatsapp: String(formData.get("whatsapp") || profile.whatsapp || "").trim(),
    onboardingDone: true,
  };

  if (!skip) {
    const price = validateNumber(formData.get("price") || "0", 0, 100);
    const firstAnimal = String(formData.get("firstAnimal") || "").trim();
    const firstLitersRaw = formData.get("firstLiters");
    const firstLiters = firstLitersRaw ? validateNumber(firstLitersRaw, 0, 1000) : null;
    const firstDate = String(formData.get("firstDate") || todayIso());

    if (!nextProfile.farmName) throw new Error("Informe o nome da fazenda.");
    if (price === null) throw new Error("Preço do litro inválido.");
    if (firstLitersRaw && firstLiters === null) throw new Error("Primeira produção inválida.");
    if (!isValidDate(firstDate) || !isNotFutureDate(firstDate)) throw new Error("Data da primeira produção inválida.");

    await savePriceQuote(price);

    if (firstAnimal) {
      await insertAnimal({
        identification: firstAnimal,
        type: "Bovino de Leite",
        status: "Em lactação",
        user_id: currentUserId,
      });
    }

    if (firstLiters !== null) {
      await upsertMilk({
        date: firstDate,
        liters: firstLiters,
        user_id: currentUserId,
      });
    }
  }

  await saveClientProfile(nextProfile);
  writeLocal();
  hideOnboarding();
  populateCowSelects();
  render();
  showToast(skip ? "Onboarding pulado. Você pode configurar depois." : "Primeira configuração concluída!");
};

let appInitialized = false;

const initApp = () => {
  if (appInitialized) {
    loadData();
    return;
  }

  appInitialized = true;

  if (!document.body._tabListenersAttached) {
    document.body._tabListenersAttached = true;
    const activateTab = (tabId) => {
      if (!tabId) return;
      document.querySelectorAll(".nav-item, .quick-action, .panel").forEach((element) => element.classList.remove("active"));
      document.querySelectorAll(`[data-tab="${tabId}"]`).forEach((element) => element.classList.add("active"));
      const panel = $(`#${tabId}`);
      if (panel) panel.classList.add("active");
      window.scrollTo({ top: el.appShell?.offsetTop || 0, behavior: "smooth" });
    };

    document.querySelectorAll("[data-tab]").forEach((button) => {
      if (!button._clickListenerAttached) {
        button._clickListenerAttached = true;
        button.addEventListener("click", () => activateTab(button.dataset.tab));
      }
    });
  }

  if (!document.body._recordActionsAttached) {
    document.body._recordActionsAttached = true;
    document.addEventListener("click", handleRecordAction);
  }

  if (!document.body._medicalCowTabsAttached) {
    document.body._medicalCowTabsAttached = true;
    document.addEventListener("click", (event) => {
      const cowTab = event.target.closest("[data-medical-cow-id]");
      if (!cowTab) return;

      selectedMedicationCowId = cowTab.dataset.medicalCowId;
      const medCowSelect = $("#medCowId");
      if (medCowSelect) medCowSelect.value = selectedMedicationCowId;
      renderMedication();
    });
  }

  const inseminationInput = $("#inseminationDate");
  const calvingInput = $("#expectedCalving");
  if (inseminationInput && calvingInput && !inseminationInput._listenerAttached) {
    inseminationInput._listenerAttached = true;
    inseminationInput.addEventListener("change", () => {
      if (!inseminationInput.value) return;
      calvingInput.value = addDaysIso(inseminationInput.value, 285);
    });
  }

  const medCowInput = $("#medCowId");
  if (medCowInput && !medCowInput._listenerAttached) {
    medCowInput._listenerAttached = true;
    medCowInput.addEventListener("change", () => {
      selectedMedicationCowId = medCowInput.value;
      renderMedication();
    });
  }

  el.milkForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const dateValue = $("#milkDate").value;
      const litersValue = Number.parseFloat($("#liters").value || "0");

      if (!isValidDate(dateValue)) throw new Error("Data inválida");
      if (!isNotFutureDate(dateValue)) throw new Error("Não pode registrar produção futura");
      const liters = validateNumber(litersValue, 0, 1000);
      if (liters === null) throw new Error("Litros inválido (0-1000)");

      // Calcular alerta de produção baixa
      const monthRecords = state.milk.filter((record) => record.date?.startsWith(monthKey()));
      const monthAverage = monthRecords.length ? monthRecords.reduce((sum, r) => sum + Number(r.liters || 0), 0) / monthRecords.length : 0;
      const prodStatus = getProductionStatus(liters, monthAverage);

      await upsertMilk({
        date: dateValue,
        liters,
        user_id: currentUserId,
      });

      el.milkForm.reset();
      el.milkDate.value = todayIso();
      
      // Mostrar toast com alerta se produção está baixa
      if (prodStatus.status === "Crítico") {
        showToast(`⚠️ Produção crítica! ${formatLiters(liters)} (média: ${formatLiters(monthAverage)})`, "error");
      } else if (prodStatus.status === "Baixo") {
        showToast(`⚠️ Produção baixa. ${formatLiters(liters)} (média: ${formatLiters(monthAverage)})`, "sync");
      } else {
        showToast("Produção salva com sucesso! ✓", "success");
      }
      
      render();
    } catch (err) {
      if (err.authRequired) throw err;
      showToast(err.message || "Erro ao salvar produção", "error");
    }
  });

  el.animalForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const identification = $("#animalName").value.trim();
      if (!identification || identification.length > 100) throw new Error("ID do animal deve ter 1-100 caracteres");
      
      await insertAnimal({
        identification,
        type: $("#animalType").value,
        status: $("#animalStatus").value,
        user_id: currentUserId,
      });

      el.animalForm.reset();
      showToast("Animal cadastrado!");
      populateCowSelects();
      render();
    } catch (err) {
      if (err.authRequired) throw err;
      showToast(err.message || "Erro ao cadastrar animal", "error");
    }
  });

  el.lactationForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const startDate = $("#lactStart").value;
      const endDate = $("#lactEnd").value || null;
      const dailyLiters = Number.parseFloat($("#lactLiters").value || "0");

      if (!isValidDate(startDate)) throw new Error("Data de início inválida");
      if (endDate && !isValidDate(endDate)) throw new Error("Data de fim inválida");
      if (!isValidDateRange(startDate, endDate)) throw new Error("Data de fim não pode ser antes do início");
      
      const liters = validateNumber(dailyLiters, 0, 500);
      if (liters === null) throw new Error("Litros/dia inválido (0-500)");

      await insertLactation({
        cow_id: $("#lactCowId").value,
        start_date: startDate,
        end_date: endDate,
        daily_liters: liters,
      });

      el.lactationForm.reset();
      showToast("Lactação registrada!");
      render();
    } catch (err) {
      if (err.authRequired) throw err;
      showToast(err.message || "Erro ao registrar lactação", "error");
    }
  });

  el.breedingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const insemDate = $("#inseminationDate").value;
      const calvingDate = $("#expectedCalving").value;

      if (!isValidDate(insemDate)) throw new Error("Data de inseminação inválida");
      if (!isValidDate(calvingDate)) throw new Error("Data de parto inválida");
      if (!isValidDateRange(insemDate, calvingDate)) throw new Error("Parto não pode ser antes de inseminação");

      await insertBreeding({
        cow_id: $("#breedCowId").value,
        insemination_date: insemDate,
        expected_calving_date: calvingDate,
      });
      el.breedingForm.reset();
      render();
      showToast("Reprodução registrada!");
    } catch (err) {
      if (err.authRequired) throw err;
      showToast(err.message || "Erro ao registrar reprodução", "error");
    }
  });

  el.medicationForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const medName = $("#medName").value.trim();
      const medDate = $("#medDate").value;
      const medCowId = $("#medCowId").value;

      if (!medCowId) throw new Error("Selecione uma vaca");
      if (!medName || medName.length > 100) throw new Error("Medicamento deve ter 1-100 caracteres");
      if (!isValidDate(medDate)) throw new Error("Data de aplicação inválida");
      if (!isNotFutureDate(medDate)) throw new Error("Não pode registrar medicação futura");

      selectedMedicationCowId = medCowId;
      await insertMedication({
        cow_id: medCowId,
        medication_name: medName,
        dosage: $("#medDosage").value.trim().substring(0, 100),
        administration_date: medDate,
      });

      el.medicationForm.reset();
      $("#medCowId").value = selectedMedicationCowId;
      render();
      showToast("Medicação registrada!");
    } catch (err) {
      if (err.authRequired) throw err;
      showToast(err.message || "Erro ao registrar medicação", "error");
    }
  });

  if (el.cropForm) {
    el.cropForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      try {
        const plotName = $("#cropPlot").value.trim();
        const cropName = $("#cropName").value.trim();
        const eventType = $("#cropEventType").value.trim();
        const eventDate = $("#cropDate").value;
        const areaTasksRaw = $("#cropAreaTasks").value;
        const areaTasks = areaTasksRaw ? validateNumber(areaTasksRaw, 0, 100000) : null;

        if (!plotName || plotName.length > 100) throw new Error("Talhão/área deve ter 1-100 caracteres");
        if (!cropName || cropName.length > 100) throw new Error("Cultura deve ter 1-100 caracteres");
        if (!eventType || eventType.length > 80) throw new Error("Manejo deve ter 1-80 caracteres");
        if (!isValidDate(eventDate)) throw new Error("Data inválida");
        if (!isNotFutureDate(eventDate)) throw new Error("Não pode registrar manejo futuro");
        if (areaTasksRaw && areaTasks === null) throw new Error("Área em tarefas inválida");

        await insertCropEvent({
          plot_name: plotName,
          crop_name: cropName,
          event_type: eventType,
          event_date: eventDate,
          product: $("#cropProduct").value.trim().substring(0, 120),
          dosage: $("#cropDosage").value.trim().substring(0, 80),
          area_tasks: areaTasks,
          notes: $("#cropNotes").value.trim().substring(0, 500),
        });

        el.cropForm.reset();
        $("#cropDate").value = todayIso();
        render();
        showToast("Manejo da lavoura salvo!");
      } catch (err) {
        if (err.authRequired) throw err;
        showToast(err.message || "Erro ao salvar manejo", "error");
      }
    });
  }

  if (el.reminderForm) {
    el.reminderForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      try {
        await insertReminder({
          title: $("#reminderTitle").value,
          category: $("#reminderCategory").value,
          due_date: $("#reminderDate").value,
          notes: $("#reminderNotes").value,
        });

        el.reminderForm.reset();
        if (el.reminderDate) el.reminderDate.value = todayIso();
        render();
        showToast("Lembrete salvo!");
      } catch (err) {
        if (err.authRequired) throw err;
        showToast(err.message || "Erro ao salvar lembrete", "error");
      }
    });
  }

  if (el.weatherForm) {
    el.weatherForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      try {
        const city = el.weatherCity.value.trim();
        if (!city || city.length > 120) throw new Error("Informe uma cidade valida.");
        await loadWeatherForecast(city);
      } catch (err) {
        showToast(err.message || "Erro ao buscar previsao", "error");
        if (el.weatherForecast) el.weatherForecast.innerHTML = empty("Nao foi possivel carregar a previsao.");
      }
    });
  }

  el.priceQuoteForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const price = validateNumber(el.priceQuoteInput.value || "0", 0, 100);
      if (price === null) throw new Error("Cotação inválida (0-100)");
      
      await savePriceQuote(price);
      writeLocal();
      render();
      el.priceQuoteForm.reset();
      showToast("Cotação atualizada!");
    } catch (err) {
      if (err.authRequired) throw err;
      showToast(err.message || "Erro ao salvar cotação", "error");
    }
  });

  if (el.clientProfileForm && !el.clientProfileForm._listenerAttached) {
    el.clientProfileForm._listenerAttached = true;
    el.clientProfileForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      try {
        const profile = normalizeClientProfile(state.clientProfile);
        const nextProfile = {
          ...profile,
          farmName: el.farmNameInput.value.trim(),
          ownerName: el.ownerNameInput.value.trim(),
          whatsapp: el.clientWhatsappInput.value.trim(),
        };

        await saveClientProfile(nextProfile);
        writeLocal();
        render();
        showToast("Dados do cliente salvos!");
      } catch (err) {
        if (err.authRequired) throw err;
        showToast(err.message || "Erro ao salvar dados do cliente", "error");
      }
    });
  }

  if (el.copyPixButton && !el.copyPixButton._listenerAttached) {
    el.copyPixButton._listenerAttached = true;
    el.copyPixButton.addEventListener("click", async () => {
      window.location.href = subscribeUrl();
    });
  }

  if (el.printReportButton && !el.printReportButton._listenerAttached) {
    el.printReportButton._listenerAttached = true;
    el.printReportButton.addEventListener("click", printCurrentReport);
  }

  if (el.onboardingForm && !el.onboardingForm._listenerAttached) {
    el.onboardingForm._listenerAttached = true;
    el.onboardingForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await completeOnboarding(false);
      } catch (err) {
        if (err.authRequired) throw err;
        showToast(err.message || "Erro ao concluir configuração inicial", "error");
      }
    });
  }

  if (el.skipOnboardingButton && !el.skipOnboardingButton._listenerAttached) {
    el.skipOnboardingButton._listenerAttached = true;
    el.skipOnboardingButton.addEventListener("click", async () => {
      try {
        await completeOnboarding(true);
      } catch (err) {
        showToast(err.message || "Não foi possível pular agora", "error");
      }
    });
  }

  if (!el.refreshButton._listenerAttached) {
    el.refreshButton._listenerAttached = true;
    el.refreshButton.addEventListener("click", loadData);
  }
  if (el.exportDataButton && !el.exportDataButton._listenerAttached) {
    el.exportDataButton._listenerAttached = true;
    el.exportDataButton.addEventListener("click", exportDataBackup);
  }
  el.milkDate.value = todayIso();
  if ($("#cropDate")) $("#cropDate").value = todayIso();
  if (el.reminderDate) el.reminderDate.value = todayIso();
  if (el.weatherCity) {
    el.weatherCity.value = localStorage.getItem(userStorageKey("weather_city")) || "";
  }
  loadData();
};

const checkSession = async () => {
  if (!hasSupabase || !db) {
    showLogin();
    showLoginError(supabaseUnavailableMessage(), canUseLocalAccountWithPassword ? "success" : "error");
    return;
  }

  try {
    const {
      data: { session },
    } = await db.auth.getSession();

    if (session?.user) {
      currentUserId = session.user.id;
      showApp(session.user.email);
      initApp();
    } else {
      showLogin();
      if (!navigator.onLine) {
        showLoginError("Sem internet. Entre uma vez online antes de usar offline.");
      }
    }
  } catch (error) {
    console.error("Session check error:", error);
    showLogin();
  }
};

showLoginButton.addEventListener("click", () => setAuthMode("login"));
showSignupButton.addEventListener("click", () => setAuthMode("signup"));

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.classList.remove("visible", "success");

  const email = $("#loginEmail").value.trim();
  const password = $("#loginPassword").value;

  // Login local: validação feita no servidor via /api/local-login
  if (canUseLocalAccountWithPassword && email.toLowerCase() === "admin") {
    try {
      const res = await fetch("/api/local-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: email.toLowerCase(), password }),
      });
      const json = await res.json();
      if (json.ok) {
        failedLoginAttempts = 0;
        currentUserId = "local-admin";
        showApp("admin local");
        initApp();
        showToast("Modo local ativo.");
        return;
      }
      failedLoginAttempts += 1;
      showLoginError(json.message || "Usuário ou senha incorretos.");
      return;
    } catch {
      showLoginError("Erro ao verificar credenciais locais.");
      return;
    }
  }

  if (failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
    showLoginError("Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.");
    return;
  }

  if (!hasSupabase || !db) {
    showLoginError(supabaseUnavailableMessage());
    return;
  }

  if (!navigator.onLine) {
    showLoginError("Sem internet. Conecte para fazer login.");
    return;
  }

  try {
    const { data, error } = await db.auth.signInWithPassword({ email, password });

    if (error) {
      failedLoginAttempts += 1;
      await delay(Math.min(failedLoginAttempts * 2000, 30000));
      const message =
        error.message === "Invalid login credentials"
          ? `E-mail ou senha incorretos. Tentativa ${failedLoginAttempts}/${MAX_LOGIN_ATTEMPTS}.`
          : supabaseErrorMessage(error);
      showLoginError(message);
      return;
    }

    failedLoginAttempts = 0;
    currentUserId = data.user.id;
    showApp(data.user.email);
    initApp();
  } catch (error) {
    showLoginError("Erro ao conectar. Tente novamente.");
    console.error(error);
  }
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.classList.remove("visible", "success");

  const name = $("#signupName").value.trim();
  const email = $("#signupEmail").value.trim();
  const password = $("#signupPassword").value;
  const passwordConfirm = $("#signupPasswordConfirm").value;
  const submitButton = signupForm.querySelector('button[type="submit"]');

  if (!hasSupabase || !db) {
    showLoginError(
      canUseLocalAccount
        ? "No modo local não é possível criar contas. Use o login de administrador."
        : supabaseUnavailableMessage()
    );
    return;
  }

  if (!navigator.onLine) {
    showLoginError("Sem internet. Conecte para criar uma conta.");
    return;
  }

  if (password.length < 6) {
    showLoginError("Use uma senha com pelo menos 6 caracteres.");
    return;
  }

  if (password !== passwordConfirm) {
    showLoginError("As senhas não conferem.");
    return;
  }

  if (!$("#signupPrivacyConsent").checked) {
    showLoginError("Aceite a política de privacidade para criar a conta.");
    return;
  }

  try {
    submitButton.disabled = true;
    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    });

    if (error) {
      showLoginError(authErrorMessage(error));
      return;
    }

    signupForm.reset();

    if (data.session?.user) {
      failedLoginAttempts = 0;
      currentUserId = data.session.user.id;
      showApp(data.session.user.email);
      initApp();
      return;
    }

    setAuthMode("login");
    showLoginError("Conta criada. Confira seu e-mail para confirmar o cadastro.", "success");
  } catch (error) {
    showLoginError("Erro ao criar conta. Tente novamente.");
    console.error(error);
  } finally {
    submitButton.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  if (hasSupabase && db) {
    await db.auth.signOut();
  }

  currentUserId = null;
  showLogin();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js");
  });
}

if (hasSupabase && db) {
  db.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session?.user) {
      currentUserId = null;
      showLogin();
      return;
    }

    currentUserId = session.user.id;
    showApp(session.user.email);
    initApp();
  });
}

window.addEventListener("online", () => {
  if (hasSupabase && db) {
    setStatus("Conectando...", "syncing");
    processSyncQueue().then(() => checkSession());
  }
});

window.addEventListener("offline", () => {
  const q = getSyncQueue();
  setStatus(`Offline ${q.length > 0 ? '(' + q.length + ' pendentes)' : '(Modo Local)'}`, "error");
});

setupSupportLinks();
checkSession();
