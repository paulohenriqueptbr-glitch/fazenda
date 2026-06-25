import {
  hasSupabase, db, currentUserId, state, userStorageKey, localId, loadLocal, writeLocal,
} from "./state.js";
import { showToast } from "./ui.js";
import { requireSession } from "./auth.js";

// ─── Constants ──────────────────────────────────────────────────────────────
const SYNC_QUEUE_KEY = "controle-fazenda-sync-queue";
const MAX_SYNC_QUEUE_SIZE = 500;
const MAX_SYNC_ITEM_AGE_MS = 7 * 24 * 60 * 60 * 1000;

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

// ─── Sync Queue ─────────────────────────────────────────────────────────────
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
  } catch (error) {
    console.error("Erro ao salvar fila offline:", error);
    showToast("Nao foi possivel salvar a fila offline.", "error");
    return false;
  }
};

export const enqueueMutation = (type, action, payload, recordId = null) => {
  if (!hasSupabase) return;
  const queue = getSyncQueue();
  saveSyncQueue([...queue, { id: localId(), type, action, payload, recordId, timestamp: Date.now() }]);
};

// ─── Sync Badge ─────────────────────────────────────────────────────────────
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

// ─── Status indicator ───────────────────────────────────────────────────────
export const setStatus = (message, kind = "local") => {
  const el = document.getElementById("syncStatus");
  if (el) { el.textContent = message; el.dataset.kind = kind; }
};

// ─── Validate sync payload ──────────────────────────────────────────────────
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
    stock: ["item_name", "category", "quantity", "unit", "min_quantity", "notes", "user_id"],
    reminder: ["title", "category", "due_date", "notes", "done", "completed_at", "user_id"],
  };
  const allowed = allowedKeys[type];
  if (!allowed) return false;
  return Object.keys(payload).every((k) => allowed.includes(k));
};

// ─── Load from Supabase ─────────────────────────────────────────────────────
export const loadSupabase = async (loadAppSettingsFn) => {
  setStatus("Sincronizando", "syncing");
  await requireSession();

  const [milkResult, animalResult, lactationResult, breedingResult, medicationResult, cropResult, stockResult, reminderResult] = await Promise.all([
    db.from("milk_records").select("*").order("date", { ascending: false }).range(0, 99),
    db.from("animals").select("*").order("created_at", { ascending: false }).range(0, 99),
    db.from("lactation_records").select("*").order("start_date", { ascending: false }).range(0, 99),
    db.from("breeding_records").select("*").order("insemination_date", { ascending: false }).range(0, 99),
    db.from("medication_records").select("*").order("administration_date", { ascending: false }).range(0, 99),
    db.from("crop_events").select("*").order("event_date", { ascending: false }).range(0, 99),
    db.from("stock_items").select("*").order("item_name", { ascending: true }).range(0, 99),
    db.from("reminders").select("*").order("due_date", { ascending: true }).range(0, 99),
  ]);

  const error = milkResult.error || animalResult.error || lactationResult.error || breedingResult.error ||
    medicationResult.error ||
    (isMissingOptionalTable(cropResult.error, "crop_events") ? null : cropResult.error) ||
    (isMissingOptionalTable(stockResult.error, "stock_items") ? null : stockResult.error) ||
    (isMissingOptionalTable(reminderResult.error, "reminders") ? null : reminderResult.error);

  if (error) throw error;

  state.milk = milkResult.data || [];
  state.animals = animalResult.data || [];
  state.lactations = lactationResult.data || [];
  state.breeding = breedingResult.data || [];
  state.medication = medicationResult.data || [];
  state.cropEvents = isMissingOptionalTable(cropResult.error, "crop_events") ? asArray(readLocal().cropEvents) : (cropResult.data || []);
  state.stockItems = isMissingOptionalTable(stockResult.error, "stock_items") ? asArray(readLocal().stockItems) : (stockResult.data || []);
  state.reminders = isMissingOptionalTable(reminderResult.error, "reminders") ? asArray(readLocal().reminders) : (reminderResult.data || []);
  await loadAppSettingsFn();
  setStatus("Online", "online");
};

const isMissingOptionalTable = (error, table) =>
  Boolean(error) && ["crop_events", "reminders", "stock_items"].includes(table) &&
  (["42P01", "PGRST205"].includes(error.code) || String(error.message || "").toLowerCase().includes(table));

import { asArray, readLocal, CLIENT_PROFILE_KEY, PRICE_QUOTE_KEY, SUBSCRIPTION_ADMIN_KEY } from "./state.js";
import { safeParseJson, normalizeClientProfile, normalizeSubscription } from "./state.js";

// ─── Load App Settings ──────────────────────────────────────────────────────
export const loadAppSettings = async () => {
  const { data, error } = await db.from("app_settings").select("key,value").eq("user_id", currentUserId);
  if (error) throw error;
  const settings = Object.fromEntries((data || []).map((item) => [item.key, item.value]));
  state.priceQuote = Number(settings[PRICE_QUOTE_KEY] || 0);
  state.clientProfile = normalizeClientProfile(safeParseJson(settings[CLIENT_PROFILE_KEY], {}));
  state.subscription = normalizeSubscription(safeParseJson(settings[SUBSCRIPTION_ADMIN_KEY], null) || state.clientProfile);
};

// ─── Save App Setting ───────────────────────────────────────────────────────
export const saveAppSetting = async (key, value) => {
  await requireSession();
  const { error } = await db.from("app_settings").upsert(
    { key, value, user_id: currentUserId, updated_at: new Date().toISOString() },
    { onConflict: "user_id,key" }
  );
  if (error) throw error;
};

// ─── Process sync queue ─────────────────────────────────────────────────────
export const processSyncQueue = async ({ refresh = true, renderFn, loadSupabaseFn, loadAppSettingsFn } = {}) => {
  if (!hasSupabase) return;
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

  for (const item of queue) {
    try {
      const col = collections[item.type];
      if (!col) continue;
      if (!validateSyncPayload(item.type, item.action, item.payload)) { console.warn("Payload inválido descartado:", item); continue; }
      if (item.action === "insert") await db.from(col.table).insert({ ...item.payload, user_id: currentUserId });
      else if (item.action === "update") await db.from(col.table).update(item.payload).eq("id", item.recordId).eq("user_id", currentUserId);
      else if (item.action === "delete") await db.from(col.table).delete().eq("id", item.recordId).eq("user_id", currentUserId);
      else if (item.action === "upsert") await db.from(col.table).upsert({ ...item.payload, user_id: currentUserId }, { onConflict: "user_id,date" });
    } catch (err) { remaining.push(item); }
  }

  saveSyncQueue(remaining);
  setStatus(remaining.length === 0 ? "Online" : `${remaining.length} erros no sync`, remaining.length === 0 ? "online" : "error");
  updateSyncBadge();
  if (refresh && loadSupabaseFn && renderFn) {
    await loadSupabaseFn();
    renderFn();
  }
};
