import {
  hasSupabase, db, currentUserId, state, localId, withCurrentUser, writeLocal, $,
} from "./state.js";
import {
  showToast, normalizeCropEventInput, normalizeStockItemInput, normalizeReminderInput,
  escapeHtml, isValidDate, isNotFutureDate, isValidDateRange, validateNumber, cleanText,
  formatDate,
} from "./ui.js";
import { requireSession, handleSupabaseError } from "./auth.js";
import { collections, enqueueMutation, loadSupabase, loadAppSettings, setStatus } from "./sync.js";
import { warn } from "./logger.js";

// ─── Find record ────────────────────────────────────────────────────────────
/**
 * Finds a single record in the local state by collection type and ID.
 * @param {string} type - Collection key (e.g. "milk", "animal", "lactation")
 * @param {string|number} id - Record ID to search for
 * @returns {Object|null} The matching record, or null if not found
 */
export const findRecord = (type, id) => {
  const col = collections[type];
  if (!col) return null;
  return state[col.stateKey].find((record) => String(record.id) === String(id));
};

// ─── Animal helpers ─────────────────────────────────────────────────────────
/**
 * Returns the identification label for an animal, or the cowId fallback.
 * @param {string|number} cowId - Animal ID or identification string
 * @returns {string} The animal's identification label, or the cowId itself
 */
export const animalLabel = (cowId) => {
  const animal = state.animals.find((item) => String(item.id) === String(cowId) || String(item.identification) === String(cowId));
  return animal?.identification || cowId || "-";
};

/**
 * Converts a cow ID to a stable string key for lookups.
 * @param {string|number|null|undefined} cowId - Animal ID
 * @returns {string} String key, empty string if falsy
 */
export const cowIdKey = (cowId) => String(cowId || "");

/**
 * Normalizes an animal label to a lowercase, trimmed string key for profile matching.
 * @param {string|null|undefined} label - Animal identification label
 * @returns {string} Normalized lowercase key
 */
export const cowProfileKey = (label) => String(label || "").trim().toLocaleLowerCase("pt-BR");

const animalReferenceIds = (animal) => new Set([animal?.id, animal?.identification].filter(Boolean).map(String));

const removeLocalAnimalRelations = (animal) => {
  const ids = animalReferenceIds(animal);
  if (ids.size === 0) return;
  state.lactations = state.lactations.filter((r) => !ids.has(String(r.cow_id)));
  state.breeding = state.breeding.filter((r) => !ids.has(String(r.cow_id)));
  state.medication = state.medication.filter((r) => !ids.has(String(r.cow_id)));
};

// ─── CRUD operations ────────────────────────────────────────────────────────
/**
 * Inserts or updates a milk production record for the current user.
 * @param {{ date: string, liters: number }} record - Milk record with date and liters
 * @returns {Promise<void>}
 * @throws {Object} Auth-required error if session is invalid
 */
export const upsertMilk = async (record) => {
  if (hasSupabase) {
    try {
      await requireSession();
      const { error } = await db.from("milk_records").upsert(withCurrentUser(record), { onConflict: "user_id,date" });
      if (error) throw error;
      await loadSupabase(loadAppSettings);
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

/**
 * Inserts a new animal record.
 * @param {{ identification: string, type: string, status: string, weight?: number }} animal - Animal data
 * @returns {Promise<void>}
 * @throws {Object} Auth-required error if session is invalid
 */
export const insertAnimal = async (animal) => {
  const newId = localId();
  if (hasSupabase) {
    try {
      await requireSession();
      const { error } = await db.from("animals").insert(withCurrentUser(animal));
      if (error) throw error;
      await loadSupabase(loadAppSettings);
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

/**
 * Inserts a new lactation record for an animal.
 * @param {{ cow_id: string|number, start_date: string, end_date?: string|null, daily_liters?: number }} record - Lactation data
 * @returns {Promise<void>}
 * @throws {Object} Auth-required error if session is invalid
 */
export const insertLactation = async (record) => {
  const newId = localId();
  const payload = { cow_id: record.cow_id, start_date: record.start_date, end_date: record.end_date || null, daily_liters: record.daily_liters };
  if (hasSupabase) {
    try {
      await requireSession();
      const { error } = await db.from("lactation_records").insert(withCurrentUser(payload));
      if (error) throw error;
      await loadSupabase(loadAppSettings);
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

/**
 * Inserts a new breeding (insemination) record.
 * @param {{ cow_id: string|number, insemination_date: string, expected_calving_date: string }} record - Breeding data
 * @returns {Promise<void>}
 * @throws {Object} Auth-required error if session is invalid
 */
export const insertBreeding = async (record) => {
  const newId = localId();
  const payload = { cow_id: record.cow_id, insemination_date: record.insemination_date, expected_calving_date: record.expected_calving_date };
  if (hasSupabase) {
    try {
      await requireSession();
      const { error } = await db.from("breeding_records").insert(withCurrentUser(payload));
      if (error) throw error;
      await loadSupabase(loadAppSettings);
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

/**
 * Inserts a new medication record for an animal.
 * @param {{ cow_id: string|number, medication_name: string, dosage?: string, administration_date: string, reapply_interval_days?: number|null }} record - Medication data
 * @returns {Promise<void>}
 * @throws {Object} Auth-required error if session is invalid
 */
export const insertMedication = async (record) => {
  const newId = localId();
  const payload = { cow_id: record.cow_id, medication_name: record.medication_name, dosage: record.dosage, administration_date: record.administration_date, reapply_interval_days: record.reapply_interval_days ?? null };
  if (hasSupabase) {
    try {
      await requireSession();
      const { error } = await db.from("medication_records").insert(withCurrentUser(payload));
      if (error) throw error;
      await loadSupabase(loadAppSettings);
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

/**
 * Inserts a new crop event (manejo) record.
 * @param {{ plot_name: string, crop_name: string, event_type: string, event_date: string, product?: string, dosage?: string, area_tasks?: number, notes?: string }} record - Crop event data
 * @returns {Promise<void>}
 * @throws {Object} Auth-required error if session is invalid
 */
export const insertCropEvent = async (record) => {
  const newId = localId();
  const payload = normalizeCropEventInput(record);
  if (hasSupabase) {
    try {
      await requireSession();
      const { error } = await db.from("crop_events").insert(withCurrentUser(payload));
      if (error) throw error;
      await loadSupabase(loadAppSettings);
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

/**
 * Inserts a new stock item (insumo) record.
 * @param {{ item_name: string, category?: string, quantity: number, unit: string, min_quantity?: number, notes?: string }} record - Stock item data
 * @returns {Promise<void>}
 * @throws {Object} Auth-required error if session is invalid
 */
export const insertStockItem = async (record) => {
  const newId = localId();
  const payload = normalizeStockItemInput(record);
  if (hasSupabase) {
    try {
      await requireSession();
      const { error } = await db.from("stock_items").insert(withCurrentUser(payload));
      if (error) throw error;
      await loadSupabase(loadAppSettings);
      return;
    } catch (error) {
      if (error.authRequired) throw error;
      handleSupabaseError(error, "salvar item de estoque");
      enqueueMutation("stock", "insert", payload, newId);
      setStatus("Offline (pendente)", "error");
    }
  }
  state.stockItems.unshift({ ...payload, id: newId, created_at: new Date().toISOString() });
  writeLocal();
};

/**
 * Inserts a new reminder record.
 * @param {{ title: string, category?: string, due_date: string, notes?: string }} record - Reminder data
 * @returns {Promise<void>}
 * @throws {Object} Auth-required error if session is invalid
 */
export const insertReminder = async (record) => {
  const newId = localId();
  const payload = normalizeReminderInput(record);
  if (hasSupabase) {
    try {
      await requireSession();
      const { error } = await db.from("reminders").insert(withCurrentUser(payload));
      if (error) throw error;
      await loadSupabase(loadAppSettings);
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

// ─── Update / Delete ────────────────────────────────────────────────────────
/**
 * Updates an existing record by type and ID with the given changes.
 * @param {string} type - Collection key (e.g. "milk", "animal", "crop")
 * @param {string|number} id - Record ID to update
 * @param {Object} changes - Key-value pairs of fields to update
 * @returns {Promise<void>}
 * @throws {Object} Auth-required error if session is invalid
 */
export const updateRecord = async (type, id, changes) => {
  const col = collections[type];
  if (!col || !id) return;
  if (hasSupabase) {
    try {
      await requireSession();
      const { error } = await db.from(col.table).update(changes).eq("id", id).eq("user_id", currentUserId);
      if (error) throw error;
      await loadSupabase(loadAppSettings);
      return;
    } catch (error) {
      if (error.authRequired) throw error;
      handleSupabaseError(error, "atualizar registro");
      enqueueMutation(type, "update", changes, id);
      setStatus("Offline (pendente)", "error");
    }
  }
  state[col.stateKey] = state[col.stateKey].map((r) => String(r.id) === String(id) ? { ...r, ...changes } : r);
  writeLocal();
};

/**
 * Deletes a record by type and ID. For animals, also removes related lactation,
 * breeding, and medication records.
 * @param {string} type - Collection key (e.g. "animal", "milk", "crop")
 * @param {string|number} id - Record ID to delete
 * @returns {Promise<void>}
 * @throws {Object} Auth-required error if session is invalid
 */
export const deleteRecord = async (type, id) => {
  const col = collections[type];
  if (!col || !id) return;
  const record = findRecord(type, id);

  if (type === "animal" && hasSupabase) {
    try {
      await requireSession();
      const relatedIds = [record?.id].filter(Boolean).map(String);
      const results = await Promise.all([
        ...relatedIds.map((aid) => db.from("lactation_records").delete().eq("cow_id", aid).eq("user_id", currentUserId)),
        ...relatedIds.map((aid) => db.from("breeding_records").delete().eq("cow_id", aid).eq("user_id", currentUserId)),
        ...relatedIds.map((aid) => db.from("medication_records").delete().eq("cow_id", aid).eq("user_id", currentUserId)),
      ]);
      const cleanupError = results.find((r) => r.error)?.error;
      if (cleanupError) throw cleanupError;
    } catch (err) { warn("Aviso ao limpar registros relacionados:", err); }
  }

  if (hasSupabase) {
    try {
      await requireSession();
      const { error } = await db.from(col.table).delete().eq("id", id).eq("user_id", currentUserId);
      if (error) throw error;
      await loadSupabase(loadAppSettings);
      return;
    } catch (error) {
      if (error.authRequired) throw error;
      handleSupabaseError(error, "excluir registro");
      enqueueMutation(type, "delete", null, id);
      setStatus("Offline (pendente)", "error");
    }
  }
  state[col.stateKey] = state[col.stateKey].filter((r) => String(r.id) !== String(id));
  if (type === "animal") removeLocalAnimalRelations(record);
  writeLocal();
};

// ─── Price quote & client profile ───────────────────────────────────────────
/**
 * Saves the milk price quote to state and syncs to Supabase.
 * @param {number|string} value - Price quote value
 * @returns {Promise<void>}
 */
export const savePriceQuote = async (value) => {
  state.priceQuote = Number(value || 0);
  if (!hasSupabase) { writeLocal(); return; }
  try {
    await requireSession();
    const { error } = await db.from("app_settings").upsert(
      { key: "milk_price_quote", value: String(state.priceQuote), user_id: currentUserId, updated_at: new Date().toISOString() },
      { onConflict: "user_id,key" }
    );
    if (error) throw error;
  } catch (error) {
    if (error.authRequired) throw error;
    handleSupabaseError(error, "salvar cotação");
    setStatus("Offline (pendente)", "error");
    writeLocal();
  }
};

/**
 * Saves the client profile to state and syncs to Supabase.
 * @param {Object} profile - Client profile object
 * @returns {Promise<void>}
 */
export const saveClientProfile = async (profile) => {
  state.clientProfile = profile;
  if (!hasSupabase) { writeLocal(); return; }
  try {
    await requireSession();
    const { error } = await db.from("app_settings").upsert(
      { key: "client_profile", value: JSON.stringify(state.clientProfile), user_id: currentUserId, updated_at: new Date().toISOString() },
      { onConflict: "user_id,key" }
    );
    if (error) throw error;
  } catch (error) {
    if (error.authRequired) throw error;
    handleSupabaseError(error, "salvar dados do cliente");
    setStatus("Offline (pendente)", "error");
    writeLocal();
  }
};

// ─── Edit modal ─────────────────────────────────────────────────────────────

/**
 * Displays a modal dialog for editing a record and returns the user's input.
 * @param {string} type - Record type (e.g. "milk", "animal", "lactation", "breeding", "medication", "crop", "stock", "reminder")
 * @param {Object} record - The current record data to populate the form
 * @returns {Promise<Object|null>} Form data as key-value pairs, or null if cancelled
 */
export const showEditModal = (type, record) => {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className = "edit-modal-overlay";
    const getInputsHTML = () => {
      if (type === "milk") return `<label>Litros: <input type="number" name="liters" min="0" max="1000" step="0.1" value="${escapeHtml(String(record.liters ?? ''))}" required></label>`;
      if (type === "animal") return `<label>Tipo: <input type="text" name="type" value="${escapeHtml(record.type)}" required></label><label>Status: <input type="text" name="status" value="${escapeHtml(record.status)}" required></label><label>Peso (kg): <input type="number" name="weight" min="0" max="2000" step="0.1" value="${escapeHtml(String(record.weight ?? ''))}" placeholder="Opcional"></label>`;
      if (type === "lactation") return `<label>Litros/dia: <input type="number" name="daily_liters" min="0" max="500" step="0.1" value="${escapeHtml(String(record.daily_liters ?? ''))}" required></label><label>Fim: <input type="date" name="end_date" value="${escapeHtml(record.end_date || '')}"></label>`;
      if (type === "breeding") return `<label>Parto previsto: <input type="date" name="expected_calving_date" value="${escapeHtml(record.expected_calving_date || '')}" required></label>`;
      if (type === "medication") return `<label>Medicamento: <input type="text" name="medication_name" value="${escapeHtml(record.medication_name)}" required></label><label>Dosagem: <input type="text" name="dosage" value="${escapeHtml(record.dosage || '')}"></label><label>Data: <input type="date" name="administration_date" value="${escapeHtml(record.administration_date || '')}" required></label>`;
      if (type === "crop") return `<label>Talhão: <input type="text" name="plot_name" value="${escapeHtml(record.plot_name || '')}" required></label><label>Cultura: <input type="text" name="crop_name" value="${escapeHtml(record.crop_name || '')}" required></label><label>Manejo: <input type="text" name="event_type" value="${escapeHtml(record.event_type || '')}" required></label><label>Data: <input type="date" name="event_date" value="${escapeHtml(record.event_date || '')}" required></label><label>Produto: <input type="text" name="product" value="${escapeHtml(record.product || '')}"></label><label>Dosagem: <input type="text" name="dosage" value="${escapeHtml(record.dosage || '')}"></label><label>Área: <input type="number" name="area_tasks" min="0" max="100000" step="0.01" value="${escapeHtml(String(record.area_tasks ?? ''))}"></label><label>Obs: <textarea name="notes" rows="3">${escapeHtml(record.notes || '')}</textarea></label>`;
      if (type === "stock") return `<label>Item: <input type="text" name="item_name" value="${escapeHtml(record.item_name || '')}" required></label><label>Categoria: <input type="text" name="category" value="${escapeHtml(record.category || 'Insumo')}" required></label><label>Qtd: <input type="number" name="quantity" min="0" max="1000000" step="0.01" value="${escapeHtml(String(record.quantity ?? ''))}" required></label><label>Unidade: <input type="text" name="unit" value="${escapeHtml(record.unit || '')}" required></label><label>Mínimo: <input type="number" name="min_quantity" min="0" max="1000000" step="0.01" value="${escapeHtml(String(record.min_quantity ?? ''))}"></label><label>Obs: <textarea name="notes" rows="3">${escapeHtml(record.notes || '')}</textarea></label>`;
      if (type === "reminder") return `<label>Título: <input type="text" name="title" value="${escapeHtml(record.title || '')}" required></label><label>Categoria: <input type="text" name="category" value="${escapeHtml(record.category || 'Geral')}" required></label><label>Data: <input type="date" name="due_date" value="${escapeHtml(record.due_date || '')}" required></label><label>Obs: <textarea name="notes" rows="3">${escapeHtml(record.notes || '')}</textarea></label>`;
      return "";
    };
    modal.innerHTML = `<div class="edit-modal-card"><h2>Editar Registro</h2><form id="editForm" class="edit-modal-form">${getInputsHTML()}<div class="edit-modal-actions"><button type="button" id="cancelBtn" class="ghost">Cancelar</button><button type="submit">Salvar</button></div></form></div>`;
    document.body.appendChild(modal);
    const form = modal.querySelector("#editForm");
    const cancelBtn = modal.querySelector("#cancelBtn");
    const cleanup = () => modal.remove();
    form.addEventListener("submit", (e) => { e.preventDefault(); const data = Object.fromEntries(new FormData(form)); cleanup(); resolve(data); });
    cancelBtn.addEventListener("click", () => { cleanup(); resolve(null); });
    modal.addEventListener("click", (e) => { if (e.target === modal) { cleanup(); resolve(null); } });
  });
};
