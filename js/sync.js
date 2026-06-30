import {
  hasSupabase, db, currentUserId, state, userStorageKey, localId, loadLocal, writeLocal,
} from "./state.js";
import { showToast } from "./ui.js";
import { requireSession } from "./auth.js";
import { warn, error } from "./logger.js";

const SYNC_QUEUE_KEY = "controle-fazenda-sync-queue";
const DEAD_LETTER_QUEUE_KEY = "controle-fazenda-dead-letter-queue";
const MAX_SYNC_QUEUE_SIZE = 500;
const MAX_SYNC_ITEM_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DEAD_LETTER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_RETRY_COUNT = 5;
const VALID_MUTATION_TYPES = new Set(["insert", "update", "delete", "upsert"]);
let _isSyncing = false;

export const collections = {
  milk: { stateKey: "milk", table: "milk_records" },
  animal: { stateKey: "animals", table: "animals" },
  lactation: { stateKey: "lactations", table: "lactation_records" },
  breeding: { stateKey: "breeding", table: "breeding_records" },
  medication: { stateKey: "medication", table: "medication_records" },
  crop: { stateKey: "cropEvents", table: "crop_events" },
  stock: { stateKey: "stockItems", table: "stock_items" },
  reminder: { stateKey: "reminders", table: "reminders" },
};

export const getSyncQueue = () => {
  try {
    const queue = JSON.parse(localStorage.getItem(userStorageKey(SYNC_QUEUE_KEY))) || [];
    return Array.isArray(queue) ? queue : [];
  } catch { return []; }
};

const saveSyncQueue = (queue) => {
  try {
    localStorage.setItem(userStorageKey(SYNC_QUEUE_KEY), JSON.stringify(queue.slice(-MAX_SYNC_QUEUE_SIZE)));
    return true;
  } catch (err) {
    error("Erro ao salvar fila offline:", err);
    showToast("Nao foi possivel salvar a fila offline.", "error");
    return false;
  }
};

export const enqueueMutation = (type, action, payload, recordId = null) => {
  if (!hasSupabase) return;
  if (!collections[type]) { warn(`enqueueMutation: tipo inválido "${type}" — ignorado`); return; }
  if (!VALID_MUTATION_TYPES.has(action)) { warn(`enqueueMutation: action inválida "${action}" — ignorada`); return; }
  const queue = getSyncQueue();
  saveSyncQueue([...queue, { id: localId(), type, action, payload, recordId, timestamp: Date.now(), retryCount: 0 }]);
};

export const getDeadLetterQueue = () => {
  try {
    const queue = JSON.parse(localStorage.getItem(userStorageKey(DEAD_LETTER_QUEUE_KEY))) || [];
    return Array.isArray(queue) ? queue : [];
  } catch { return []; }
};

const saveDeadLetterQueue = (queue) => {
  try {
    const cutoff = Date.now() - DEAD_LETTER_TTL_MS;
    const filtered = queue.filter((item) => item.failedAt && item.failedAt > cutoff).slice(-MAX_SYNC_QUEUE_SIZE);
    localStorage.setItem(userStorageKey(DEAD_LETTER_QUEUE_KEY), JSON.stringify(filtered));
    return true;
  } catch (err) {
    error("Erro ao salvar dead letter queue:", err);
    return false;
  }
};

const sanitizeErrorForLog = (err) => {
  const code = err?.code || null;
  const raw = String(err?.message || "").toLowerCase();
  if (raw.includes("permission") || raw.includes("unauthorized") || raw.includes("forbidden") || code === "42501" || code === "42000") {
    return { message: "Permissão negada pelo servidor", code };
  }
  if (raw.includes("row-level security")) {
    return { message: "Acesso negado pelas políticas de segurança", code };
  }
  if (raw.includes("violates") || raw.includes("constraint")) {
    return { message: "Violação de restrição dos dados", code };
  }
  if (raw.includes("duplicate") || code === "23505") {
    return { message: "Registro duplicado", code };
  }
  if (raw.includes("not found") || code === "PGRST205") {
    return { message: "Recurso não encontrado", code };
  }
  return { message: "Erro do servidor", code };
};

const classifySyncError = (err) => {
  if (!err) return "unknown";
  
  const message = (err.message || "").toLowerCase();
  const code = err.code || "";
  const status = err.status || err.statusCode || 0;

  if (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("econnrefused") ||
    message.includes("econnreset") ||
    message.includes("timeout") ||
    message.includes("enotfound") ||
    code === "NETWORK_ERROR" ||
    status === 0 ||
    status === 408 ||
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return "network";
  }

  if (
    message.includes("permission") ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    code === "42501" ||
    code === "42000" ||
    status === 401 ||
    status === 403
  ) {
    return "permission";
  }

  if (
    message.includes("invalid") ||
    message.includes("violates") ||
    message.includes("constraint") ||
    message.includes("required") ||
    message.includes("format") ||
    code === "23502" ||
    code === "23503" ||
    code === "23505" ||
    code === "23514" ||
    code === "22P02" ||
    status === 400 ||
    status === 422
  ) {
    return "validation";
  }

  return "network";
};

export const updateSyncBadge = () => {
  const q = getSyncQueue();
  const count = q.length;
  let badge = document.getElementById("syncPendingBadge");
  if (count === 0) { if (badge) badge.remove(); return; }
  if (!badge) {
    badge = document.createElement("span");
    badge.id = "syncPendingBadge";
    badge.className = "sync-pending-badge";
    document.getElementById("syncStatus")?.insertAdjacentElement("afterend", badge);
  }
  badge.textContent = `${count} pendente${count > 1 ? "s" : ""}`;
  badge.title = `${count} registro${count > 1 ? "s" : ""} aguardando sincronização`;
};

export const setStatus = (message, kind = "local") => {
  const el = document.getElementById("syncStatus");
  if (el) { el.textContent = message; el.dataset.kind = kind; }
};

const validateSyncPayload = (type, action, payload) => {
  if (action === "delete") return true;
  if (!payload || typeof payload !== "object") return false;
  const allowedKeys = {
    milk: ["date", "liters", "user_id"],
    animal: ["identification", "type", "status", "weight", "user_id"],
    lactation: ["cow_id", "start_date", "end_date", "daily_liters", "user_id"],
    breeding: ["cow_id", "insemination_date", "expected_calving_date", "user_id"],
    medication: ["cow_id", "medication_name", "dosage", "administration_date", "reapply_interval_days", "user_id"],
    crop: ["plot_name", "crop_name", "event_type", "event_date", "product", "dosage", "area_tasks", "notes", "user_id"],
    stock: ["item_name", "category", "quantity", "unit", "min_quantity", "notes", "user_id"],
    reminder: ["title", "category", "due_date", "notes", "done", "completed_at", "user_id"],
  };
  const allowed = allowedKeys[type];
  if (!allowed) return false;
  const keys = Object.keys(payload);
  if (!keys.every((k) => allowed.includes(k))) return false;
  if (type === "milk" && payload.liters !== undefined && (typeof payload.liters !== "number" || payload.liters < 0)) return false;
  if (type === "lactation" && payload.daily_liters !== undefined && (typeof payload.daily_liters !== "number" || payload.daily_liters < 0)) return false;
  if (type === "animal" && payload.weight !== undefined && payload.weight !== null && (typeof payload.weight !== "number" || payload.weight < 0)) return false;
  for (const k of keys) {
    if (typeof payload[k] === "string" && payload[k].length > 1000) return false;
  }
  return true;
};

const loadAllPages = async (table, options = {}) => {
  const { orderBy = "created_at", ascending = false, isOptional = false } = options;
  const PAGE_SIZE = 1000;
  let allData = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      const { data, error } = await db
        .from(table)
        .select("*")
        .order(orderBy, { ascending })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        if (isOptional && isMissingOptionalTable(error, table)) {
          return asArray(readLocal()[table] || []);
        }
        throw error;
      }

      if (data && data.length > 0) {
        allData = allData.concat(data);
        offset += PAGE_SIZE;
        hasMore = data.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    } catch (err) {
      if (isOptional && isMissingOptionalTable(err, table)) {
        return asArray(readLocal()[table] || []);
      }
      throw err;
    }
  }

  return allData;
};

export const loadSupabase = async (loadAppSettingsFn) => {
  setStatus("Sincronizando", "syncing");
  await requireSession();

  const [milk, animals, lactations, breeding, medication, cropEvents, stockItems, reminders] = await Promise.all([
    loadAllPages("milk_records", { orderBy: "date", ascending: false }),
    loadAllPages("animals", { orderBy: "created_at", ascending: false }),
    loadAllPages("lactation_records", { orderBy: "start_date", ascending: false }),
    loadAllPages("breeding_records", { orderBy: "insemination_date", ascending: false }),
    loadAllPages("medication_records", { orderBy: "administration_date", ascending: false }),
    loadAllPages("crop_events", { orderBy: "event_date", ascending: false, isOptional: true }),
    loadAllPages("stock_items", { orderBy: "item_name", ascending: true, isOptional: true }),
    loadAllPages("reminders", { orderBy: "due_date", ascending: true, isOptional: true }),
  ]);

  state.milk = milk;
  state.animals = animals;
  state.lactations = lactations;
  state.breeding = breeding;
  state.medication = medication;
  state.cropEvents = cropEvents;
  state.stockItems = stockItems;
  state.reminders = reminders;

  await loadAppSettingsFn();
  setStatus("Online", "online");
};

const isMissingOptionalTable = (error, table) =>
  Boolean(error) && ["crop_events", "reminders", "stock_items"].includes(table) &&
  (["42P01", "PGRST205"].includes(error.code) || String(error.message || "").toLowerCase().includes(table));

import { asArray, readLocal, CLIENT_PROFILE_KEY, PRICE_QUOTE_KEY, SUBSCRIPTION_ADMIN_KEY } from "./state.js";
import { safeParseJson, normalizeClientProfile, normalizeSubscription } from "./state.js";

export const loadAppSettings = async () => {
  const { data, error } = await db.from("app_settings").select("key,value").eq("user_id", currentUserId);
  if (error) throw error;
  const settings = Object.fromEntries((data || []).map((item) => [item.key, item.value]));
  state.priceQuote = Number(settings[PRICE_QUOTE_KEY] || 0);
  state.clientProfile = normalizeClientProfile(safeParseJson(settings[CLIENT_PROFILE_KEY], {}));
  state.subscription = normalizeSubscription(safeParseJson(settings[SUBSCRIPTION_ADMIN_KEY], null) || state.clientProfile);
};

export const saveAppSetting = async (key, value) => {
  await requireSession();
  const { error } = await db.from("app_settings").upsert(
    { key, value, user_id: currentUserId, updated_at: new Date().toISOString() },
    { onConflict: "user_id,key" }
  );
  if (error) throw error;
};

export const processSyncQueue = async ({ refresh = true, renderFn, loadSupabaseFn, loadAppSettingsFn } = {}) => {
  if (!hasSupabase) return;
  if (_isSyncing) return;
  _isSyncing = true;
  try {
    let queue = getSyncQueue();
    if (queue.length === 0) { setStatus("Online", "online"); return; }

    const cutoff = Date.now() - MAX_SYNC_ITEM_AGE_MS;
    const originalLength = queue.length;
    queue = queue.filter((item) => item.timestamp && item.timestamp > cutoff).slice(0, MAX_SYNC_QUEUE_SIZE);
    if (queue.length !== originalLength) saveSyncQueue(queue);
    if (queue.length === 0) { setStatus("Online", "online"); return; }

    await requireSession();
    setStatus(`Sincronizando ${queue.length}...`, "syncing");
    const remaining = [];
    const deadLetter = [];

    for (const item of queue) {
      try {
        const col = collections[item.type];
        if (!col) continue;
        if (!validateSyncPayload(item.type, item.action, item.payload)) { warn("Payload inválido descartado:", item.id, item.type, item.action); continue; }
        if (item.action === "insert") await db.from(col.table).upsert({ ...item.payload, id: item.recordId || item.id, user_id: currentUserId }, { onConflict: "id" });
        else if (item.action === "update") await db.from(col.table).update(item.payload).eq("id", item.recordId).eq("user_id", currentUserId);
        else if (item.action === "delete") await db.from(col.table).delete().eq("id", item.recordId).eq("user_id", currentUserId);
        else if (item.action === "upsert") await db.from(col.table).upsert({ ...item.payload, user_id: currentUserId }, { onConflict: "user_id,date" });
      } catch (err) {
        const errorType = classifySyncError(err);
        const retryCount = (item.retryCount || 0) + 1;
        const sanitized = sanitizeErrorForLog(err);

        switch (errorType) {
          case "validation":
            warn("Item descartado (validação):", item.id, item.type, sanitized.message, sanitized.code);
            break;

          case "permission":
            error("Permissão negada:", item.id, item.type, sanitized.code);
            deadLetter.push({ ...item, errorType, errorMessage: sanitized.message, errorCode: sanitized.code, failedAt: Date.now() });
            break;

          case "network":
          default:
            if (retryCount > MAX_RETRY_COUNT) {
              error("Max retentativas excedido:", item.id, item.type, sanitized.code);
              deadLetter.push({ ...item, errorType, errorMessage: sanitized.message, errorCode: sanitized.code, retryCount, failedAt: Date.now() });
            } else {
              remaining.push({ ...item, retryCount });
            }
            break;
        }
      }
    }

    saveSyncQueue(remaining);

    if (deadLetter.length > 0) {
      const existingDeadLetter = getDeadLetterQueue();
      saveDeadLetterQueue([...existingDeadLetter, ...deadLetter]);
    }

    const errorMessage = remaining.length > 0 ? `${remaining.length} erros no sync` : "Online";
    setStatus(errorMessage, remaining.length === 0 ? "online" : "error");
    updateSyncBadge();
    if (refresh && loadSupabaseFn && renderFn) {
      await loadSupabaseFn();
      renderFn();
    }
  } finally {
    _isSyncing = false;
  }
};
