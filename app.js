const LOCAL_KEY = "controle-fazenda-data";
const PRICE_QUOTE_KEY = "milk_price_quote";
const MAX_LOGIN_ATTEMPTS = 5;
const PAGE_SIZE = 100;

const state = {
  milk: [],
  animals: [],
  lactations: [],
  breeding: [],
  medication: [],
  priceQuote: 0,
};

const config = window.CONTROLE_LEITE_CONFIG || {};
const hasSupabase = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
const db = hasSupabase ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;
let currentUserId = null;
let failedLoginAttempts = 0;

const $ = (selector) => document.querySelector(selector);
const todayIso = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
const monthKey = () => todayIso().slice(0, 7);
const localId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
const withCurrentUser = (payload) => (currentUserId ? { ...payload, user_id: currentUserId } : payload);
const userStorageKey = (key) => (currentUserId ? `${key}:${currentUserId}` : key);

const showToast = (message, type = "success") => {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(20px)";
    toast.style.transition = "all 0.3s";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

const formatLiters = (value) => `${Number(value || 0).toLocaleString("pt-BR")} L`;
const formatMoney = (value) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

const loginScreen = $("#loginScreen");
const appShell = $("#appShell");
const loginForm = $("#loginForm");
const loginError = $("#loginError");
const logoutBtn = $("#logoutBtn");
const userEmailEl = $("#userEmail");

const el = {
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
  milkForm: $("#milkForm"),
  milkDate: $("#milkDate"),
  animalForm: $("#animalForm"),
  lactationForm: $("#lactationForm"),
  breedingForm: $("#breedingForm"),
  medicationForm: $("#medicationForm"),
  priceQuoteForm: $("#priceQuoteForm"),
  priceQuoteInput: $("#priceQuoteInput"),
  priceQuoteValue: $("#priceQuoteValue"),
  refreshButton: $("#refreshButton"),
  exportDataButton: $("#exportDataButton"),
  reportMonthTotal: $("#reportMonthTotal"),
  reportMonthValue: $("#reportMonthValue"),
  reportAverage: $("#reportAverage"),
  reportBestDay: $("#reportBestDay"),
  productionChart: $("#productionChart"),
};

const actionButtons = (type, id) => `
  <div class="item-actions">
    <button type="button" data-action="edit" data-type="${type}" data-id="${escapeHtml(id)}">Editar</button>
    <button type="button" data-action="delete" data-type="${type}" data-id="${escapeHtml(id)}">Excluir</button>
  </div>
`;

const recordActions = (type, record) => (record.id ? actionButtons(type, record.id) : "");

const showApp = (email) => {
  loginScreen.classList.add("hidden");
  appShell.classList.add("visible");
  if (userEmailEl) userEmailEl.textContent = email || "";
};

const showLogin = () => {
  loginScreen.classList.remove("hidden");
  appShell.classList.remove("visible");
  loginError.classList.remove("visible");
};

const showLoginError = (message) => {
  loginError.textContent = message;
  loginError.classList.add("visible");
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
    return JSON.parse(localStorage.getItem(userStorageKey(LOCAL_KEY))) || {};
  } catch {
    return {};
  }
};

const writeLocal = () => {
  localStorage.setItem(userStorageKey(LOCAL_KEY), JSON.stringify(state));
};

const setStatus = (message, kind = "local") => {
  el.syncStatus.textContent = message;
  el.syncStatus.dataset.kind = kind;
};

const loadLocal = () => {
  const data = readLocal();
  state.milk = data.milk || [];
  state.animals = data.animals || [];
  state.lactations = data.lactations || [];
  state.breeding = data.breeding || [];
  state.medication = data.medication || [];
  state.priceQuote = data.priceQuote || 0;
  setStatus("Local", "local");
};

const loadPriceQuote = async () => {
  const { data, error } = await db
    .from("app_settings")
    .select("value")
    .eq("key", PRICE_QUOTE_KEY)
    .eq("user_id", currentUserId)
    .maybeSingle();

  if (error) throw error;

  state.priceQuote = Number(data?.value || 0);
};

const savePriceQuote = async (value) => {
  state.priceQuote = Number(value || 0);

  if (!hasSupabase) {
    writeLocal();
    return;
  }

  await requireSession();
  const { error } = await db.from("app_settings").upsert(
    {
      key: PRICE_QUOTE_KEY,
      value: String(state.priceQuote),
      user_id: currentUserId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,key" }
  );

  if (error) throw error;
};

const loadSupabase = async () => {
  setStatus("Sincronizando", "syncing");
  await requireSession();

  const [milkResult, animalResult, lactationResult, breedingResult, medicationResult] = await Promise.all([
    db.from("milk_records").select("*").order("date", { ascending: false }).range(0, PAGE_SIZE - 1),
    db.from("animals").select("*").order("created_at", { ascending: false }).range(0, PAGE_SIZE - 1),
    db.from("lactation_records").select("*").order("start_date", { ascending: false }).range(0, PAGE_SIZE - 1),
    db.from("breeding_records").select("*").order("insemination_date", { ascending: false }).range(0, PAGE_SIZE - 1),
    db.from("medication_records").select("*").order("administration_date", { ascending: false }).range(0, PAGE_SIZE - 1),
  ]);

  const error =
    milkResult.error ||
    animalResult.error ||
    lactationResult.error ||
    breedingResult.error ||
    medicationResult.error;

  if (error) throw error;

  state.milk = milkResult.data || [];
  state.animals = animalResult.data || [];
  state.lactations = lactationResult.data || [];
  state.breeding = breedingResult.data || [];
  state.medication = medicationResult.data || [];
  await loadPriceQuote();

  setStatus("Online", "online");
};

const loadData = async () => {
  if (!hasSupabase) {
    loadLocal();
    render();
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
};

const populateCowSelects = () => {
  const options = state.animals
    .map(
      (animal) =>
        `<option value="${escapeHtml(animal.identification)}">${escapeHtml(animal.identification)}</option>`
    )
    .join("");

  $("#lactCowId").innerHTML = options;
  $("#breedCowId").innerHTML = options;
  $("#medCowId").innerHTML = options;
};

const SYNC_QUEUE_KEY = "controle-fazenda-sync-queue";

const getSyncQueue = () => {
  try { return JSON.parse(localStorage.getItem(userStorageKey(SYNC_QUEUE_KEY))) || []; } catch { return []; }
};

const saveSyncQueue = (queue) => {
  localStorage.setItem(userStorageKey(SYNC_QUEUE_KEY), JSON.stringify(queue));
};

const enqueueMutation = (type, action, payload, recordId = null) => {
  if (!hasSupabase) return;
  const queue = getSyncQueue();
  queue.push({ id: localId(), type, action, payload, recordId, timestamp: Date.now() });
  saveSyncQueue(queue);
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

const collections = {
  milk: { stateKey: "milk", table: "milk_records" },
  animal: { stateKey: "animals", table: "animals" },
  lactation: { stateKey: "lactations", table: "lactation_records" },
  breeding: { stateKey: "breeding", table: "breeding_records" },
  medication: { stateKey: "medication", table: "medication_records" },
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
      const { error } = await db.from(config.table).update(changes).eq("id", id);
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

const deleteRecord = async (type, id) => {
  const config = collections[type];
  if (!config || !id) return;

  if (type === "animal" && hasSupabase) {
    try {
      await requireSession();
      const animalId = String(id);
      await Promise.all([
        db.from("lactation_records").delete().eq("cow_id", animalId),
        db.from("breeding_records").delete().eq("cow_id", animalId),
        db.from("medication_records").delete().eq("cow_id", animalId),
      ]);
    } catch (err) {
      console.warn("Aviso ao limpar registros relacionados:", err);
    }
  }

  if (hasSupabase) {
    try {
      await requireSession();
      const { error } = await db.from(config.table).delete().eq("id", id);
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
  writeLocal();
};

const processSyncQueue = async ({ refresh = true } = {}) => {
  if (!hasSupabase) return;
  const queue = getSyncQueue();
  if (queue.length === 0) return;

  await requireSession();
  setStatus(`Sincronizando ${queue.length}...`, "syncing");
  const remaining = [];

  for (const item of queue) {
    try {
      const config = collections[item.type];
      if (!config) continue;
      
      if (item.action === "insert") {
        await db.from(config.table).insert({ ...item.payload, user_id: currentUserId });
      } else if (item.action === "update") {
        await db.from(config.table).update(item.payload).eq("id", item.recordId);
      } else if (item.action === "delete") {
        await db.from(config.table).delete().eq("id", item.recordId);
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
const isValidDate = (dateStr) => {
  const date = new Date(dateStr + "T00:00:00");
  return !Number.isNaN(date.getTime());
};

const isNotFutureDate = (dateStr) => {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date <= today;
};

const isValidDateRange = (startStr, endStr) => {
  if (!endStr) return true;
  const start = new Date(startStr + "T00:00:00");
  const end = new Date(endStr + "T00:00:00");
  return start <= end;
};

const validateNumber = (value, min = 0, max = 10000) => {
  const num = Number.parseFloat(value);
  return Number.isFinite(num) && num >= min && num <= max ? num : null;
};

const showEditModal = (type, record) => {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className = "edit-modal-overlay";
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
      background: rgba(0,0,0,0.5); display: flex; align-items: center; 
      justify-content: center; z-index: 1000;
    `;

    const getInputsHTML = () => {
      if (type === "milk") {
        return `<label>Litros: <input type="number" name="liters" min="0" max="1000" step="0.1" value="${record.liters}" required></label>`;
      } else if (type === "animal") {
        return `
          <label>Tipo: <input type="text" name="type" value="${escapeHtml(record.type)}" required></label>
          <label>Status: <input type="text" name="status" value="${escapeHtml(record.status)}" required></label>
        `;
      } else if (type === "lactation") {
        return `
          <label>Litros/dia: <input type="number" name="daily_liters" min="0" max="500" step="0.1" value="${record.daily_liters}" required></label>
          <label>Fim (AAAA-MM-DD): <input type="date" name="end_date" value="${record.end_date || ''}"></label>
        `;
      } else if (type === "breeding") {
        return `<label>Parto previsto: <input type="date" name="expected_calving_date" value="${record.expected_calving_date || ''}" required></label>`;
      } else if (type === "medication") {
        return `
          <label>Medicamento: <input type="text" name="medication_name" value="${escapeHtml(record.medication_name)}" required></label>
          <label>Dosagem: <input type="text" name="dosage" value="${escapeHtml(record.dosage || '')}"></label>
          <label>Data: <input type="date" name="administration_date" value="${record.administration_date}" required></label>
        `;
      }
      return "";
    };

    modal.innerHTML = `
      <div style="background: white; padding: 24px; border-radius: 8px; max-width: 400px; box-shadow: 0 8px 40px rgba(0,0,0,0.2);">
        <h2 style="margin-top: 0; font-size: 1.25rem;">Editar Registro</h2>
        <form id="editForm" style="display: grid; gap: 12px;">
          ${getInputsHTML()}
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 16px;">
            <button type="button" id="cancelBtn" style="padding: 10px; background: #ddd; border: 1px solid #ccc; border-radius: 4px; cursor: pointer;">Cancelar</button>
            <button type="submit" style="padding: 10px; background: #176c56; color: white; border: none; border-radius: 4px; cursor: pointer;">Salvar</button>
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

const handleRecordAction = async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const { action, type, id } = button.dataset;

  try {
    if (action === "edit") await editRecord(type, id);
    if (action === "delete") await removeRecord(type, id);
  } catch (error) {
    console.error(error);
    showToast("Não foi possível concluir a ação.", "error");
  }
};

const empty = (text) => `<p class="empty">${escapeHtml(text)}</p>`;

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

  el.historyList.innerHTML = records.length
    ? records
        .map(
          (record) => `
            <article class="item">
              <div>
                <span>${formatDate(record.date)}</span>
                <small>${formatMoney(price)} por litro</small>
              </div>
              <strong>${formatLiters(record.liters)} | ${formatMoney(Number(record.liters) * price)}</strong>
              ${recordActions("milk", record)}
            </article>
          `
        )
        .join("")
    : empty("Nenhuma produção registrada.");
};

const renderAnimals = () => {
  el.animalList.innerHTML = state.animals.length
    ? state.animals
        .map(
          (animal) => `
            <article class="item">
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
                <span>${escapeHtml(record.cow_id)}</span>
                <small>${formatDate(record.start_date)} -> ${
            record.end_date ? formatDate(record.end_date) : "atual"
          }</small>
              </div>
              <strong>${formatLiters(record.daily_liters)} / dia</strong>
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
                <span>${escapeHtml(record.cow_id)}</span>
                <small>Prenhez: ${formatDate(record.insemination_date)}</small>
              </div>
              <strong>Parto: ${formatDate(record.expected_calving_date)}</strong>
              ${recordActions("breeding", record)}
            </article>
          `
        )
        .join("")
    : empty("Nenhuma reprodução registrada.");
};

const renderMedication = () => {
  el.medicationList.innerHTML = state.medication.length
    ? state.medication
        .map(
          (record) => `
            <article class="item">
              <div>
                <span>${escapeHtml(record.cow_id)}</span>
                <small>${formatDate(record.administration_date)}</small>
              </div>
              <strong>${escapeHtml(record.medication_name)} - ${escapeHtml(record.dosage)}</strong>
              ${recordActions("medication", record)}
            </article>
          `
        )
        .join("")
    : empty("Nenhuma medicação registrada.");
};

const renderReports = () => {
  const price = Number(state.priceQuote || 0);
  const monthRecords = state.milk.filter((record) => record.date?.startsWith(monthKey()));
  const monthLiters = monthRecords.reduce((sum, record) => sum + Number(record.liters || 0), 0);
  const average = monthRecords.length ? monthLiters / monthRecords.length : 0;
  const bestRecord = monthRecords.reduce(
    (best, record) => (Number(record.liters || 0) > Number(best?.liters || 0) ? record : best),
    null
  );
  const chartRecords = [...state.milk]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-10);
  const maxLiters = chartRecords.reduce((max, record) => Math.max(max, Number(record.liters || 0)), 0);

  el.reportMonthTotal.textContent = formatLiters(monthLiters);
  el.reportMonthValue.textContent = formatMoney(monthLiters * price);
  el.reportAverage.textContent = formatLiters(average);
  el.reportBestDay.textContent = bestRecord ? `${formatDate(bestRecord.date)} - ${formatLiters(bestRecord.liters)}` : "-";

  el.productionChart.innerHTML = chartRecords.length
    ? chartRecords
        .map((record) => {
          const liters = Number(record.liters || 0);
          const width = maxLiters ? Math.max(8, (liters / maxLiters) * 100) : 8;

          return `
            <div class="chart-row">
              <span>${formatDate(record.date)}</span>
              <div class="chart-track">
                <div class="chart-bar" style="width: ${width}%"></div>
              </div>
              <strong>${formatLiters(liters)}</strong>
            </div>
          `;
        })
        .join("")
    : empty("Nenhuma produção para montar o gráfico.");
};

const render = () => {
  renderPriceQuote();
  renderSummary();
  renderMilk();
  renderAnimals();
  renderLactations();
  renderBreeding();
  renderMedication();
  renderReports();
};

const exportDataBackup = () => {
  const backup = {
    exported_at: new Date().toISOString(),
    user_id: currentUserId,
    data: state,
    pending_sync: getSyncQueue(),
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

let appInitialized = false;

const initApp = () => {
  if (appInitialized) {
    loadData();
    return;
  }

  appInitialized = true;

  if (!document.body._tabListenersAttached) {
    document.body._tabListenersAttached = true;
    document.querySelectorAll(".nav-item").forEach((button) => {
      if (!button._clickListenerAttached) {
        button._clickListenerAttached = true;
        button.addEventListener("click", () => {
          document.querySelectorAll(".nav-item, .panel").forEach((element) => element.classList.remove("active"));
          button.classList.add("active");
          $(`#${button.dataset.tab}`).classList.add("active");
        });
      }
    });
  }

  if (!document.body._recordActionsAttached) {
    document.body._recordActionsAttached = true;
    document.addEventListener("click", handleRecordAction);
  }

  const inseminationInput = $("#inseminationDate");
  const calvingInput = $("#expectedCalving");
  if (inseminationInput && calvingInput && !inseminationInput._listenerAttached) {
    inseminationInput._listenerAttached = true;
    inseminationInput.addEventListener("change", () => {
      if (!inseminationInput.value) return;
      const [year, month, day] = inseminationInput.value.split("-");
      const date = new Date(Number(year), Number(month) - 1, Number(day));
      date.setDate(date.getDate() + 285);
      calvingInput.value = date.toISOString().split("T")[0];
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

      await upsertMilk({
        date: dateValue,
        liters,
        user_id: currentUserId,
      });

      el.milkForm.reset();
      el.milkDate.value = todayIso();
      showToast("Produção salva com sucesso!");
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

      if (!medName || medName.length > 100) throw new Error("Medicamento deve ter 1-100 caracteres");
      if (!isValidDate(medDate)) throw new Error("Data de aplicação inválida");
      if (!isNotFutureDate(medDate)) throw new Error("Não pode registrar medicação futura");

      await insertMedication({
        cow_id: $("#medCowId").value,
        medication_name: medName,
        dosage: $("#medDosage").value.trim().substring(0, 100),
        administration_date: medDate,
      });

      el.medicationForm.reset();
      render();
      showToast("Medicação registrada!");
    } catch (err) {
      if (err.authRequired) throw err;
      showToast(err.message || "Erro ao registrar medicação", "error");
    }
  });

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

  if (!el.refreshButton._listenerAttached) {
    el.refreshButton._listenerAttached = true;
    el.refreshButton.addEventListener("click", loadData);
  }
  if (el.exportDataButton && !el.exportDataButton._listenerAttached) {
    el.exportDataButton._listenerAttached = true;
    el.exportDataButton.addEventListener("click", exportDataBackup);
  }
  el.milkDate.value = todayIso();
  loadData();
};

const checkSession = async () => {
  if (!hasSupabase || !db) {
    showLogin();
    showLoginError("Configuração do Supabase não encontrada. Confira as variáveis do ambiente.");
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

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.classList.remove("visible");

  const email = $("#loginEmail").value.trim();
  const password = $("#loginPassword").value;

  if (failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
    showLoginError("Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.");
    return;
  }

  if (!hasSupabase || !db) {
    showLoginError("Configuração do Supabase não encontrada. Confira as variáveis do ambiente.");
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

checkSession();
