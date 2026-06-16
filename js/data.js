
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
    const toSave = {
      ...state,
      dismissedAutoAlerts: [...(state.dismissedAutoAlerts || [])],
      confirmedAutoAlerts: [...(state.confirmedAutoAlerts || [])],
    };
    localStorage.setItem(userStorageKey(LOCAL_KEY), JSON.stringify(toSave));
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

/**
 * Atualiza o badge de pendentes ao lado do indicador de status.
 * Chamado sempre que a fila de sync muda.
 */
const updateSyncBadge = () => {
  const q = getSyncQueue();
  const count = q.length;
  let badge = document.getElementById("syncPendingBadge");

  if (count === 0) {
    if (badge) badge.remove();
    return;
  }

  if (!badge) {
    badge = document.createElement("span");
    badge.id = "syncPendingBadge";
    badge.className = "sync-pending-badge";
    el.syncStatus?.insertAdjacentElement("afterend", badge);
  }

  badge.textContent = `${count} pendente${count > 1 ? "s" : ""}`;
  badge.title = `${count} registro${count > 1 ? "s" : ""} aguardando sincronização`;
};

const loadLocal = () => {
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

  const [milkResult, animalResult, lactationResult, breedingResult, medicationResult, cropResult, stockResult, reminderResult] = await Promise.all([
    db.from("milk_records").select("*").order("date", { ascending: false }).range(0, PAGE_SIZE - 1),
    db.from("animals").select("*").order("created_at", { ascending: false }).range(0, PAGE_SIZE - 1),
    db.from("lactation_records").select("*").order("start_date", { ascending: false }).range(0, PAGE_SIZE - 1),
    db.from("breeding_records").select("*").order("insemination_date", { ascending: false }).range(0, PAGE_SIZE - 1),
    db.from("medication_records").select("*").order("administration_date", { ascending: false }).range(0, PAGE_SIZE - 1),
    db.from("crop_events").select("*").order("event_date", { ascending: false }).range(0, PAGE_SIZE - 1),
    db.from("stock_items").select("*").order("item_name", { ascending: true }).range(0, PAGE_SIZE - 1),
    db.from("reminders").select("*").order("due_date", { ascending: true }).range(0, PAGE_SIZE - 1),
  ]);

  const error =
    milkResult.error ||
    animalResult.error ||
    lactationResult.error ||
    breedingResult.error ||
    medicationResult.error ||
    (isMissingOptionalTable(cropResult.error, "crop_events") ? null : cropResult.error) ||
    (isMissingOptionalTable(stockResult.error, "stock_items") ? null : stockResult.error) ||
    (isMissingOptionalTable(reminderResult.error, "reminders") ? null : reminderResult.error);

  if (error) throw error;

  if (isMissingCropEventsTable(cropResult.error)) {
    console.warn("Tabela crop_events ainda nao existe no Supabase. Usando lavoura local.");
  }
  if (isMissingOptionalTable(reminderResult.error, "reminders")) {
    console.warn("Tabela reminders ainda nao existe no Supabase. Usando lembretes locais.");
  }
  if (isMissingOptionalTable(stockResult.error, "stock_items")) {
    console.warn("Tabela stock_items ainda nao existe no Supabase. Usando estoque local.");
  }

  state.milk = milkResult.data || [];
  state.animals = animalResult.data || [];
  state.lactations = lactationResult.data || [];
  state.breeding = breedingResult.data || [];
  state.medication = medicationResult.data || [];
  state.cropEvents = isMissingOptionalTable(cropResult.error, "crop_events") ? asArray(readLocal().cropEvents) : (cropResult.data || []);
  state.stockItems = isMissingOptionalTable(stockResult.error, "stock_items") ? asArray(readLocal().stockItems) : (stockResult.data || []);
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

  // Verifica e dispara alertas push locais após os dados carregarem
  checkPushAlerts();

  // Backup automático semanal silencioso
  maybeAutoBackup();

  // Atualiza badge de pendentes
  updateSyncBadge();
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

  const medSelect = $("#medCowId");
  if (medSelect) {
    medSelect.innerHTML = getUniqueMedicationAnimals()
      .map(
        (animal) =>
          `<option value="${escapeHtml(animal.id)}">${escapeHtml(animal.identification || animal.id)}</option>`
      )
      .join("");
  }
};

const animalLabel = (cowId) => {
  const animal = state.animals.find(
    (item) => String(item.id) === String(cowId) || String(item.identification) === String(cowId)
  );
  return animal?.identification || cowId || "-";
};

const cowIdKey = (cowId) => String(cowId || "");
const cowProfileKey = (label) => String(label || "").trim().toLocaleLowerCase("pt-BR");

const getUniqueMedicationAnimals = () => {
  const animals = new Map();

  state.animals.forEach((animal) => {
    const key = cowProfileKey(animal.identification || animal.id);
    if (!key || animals.has(key)) return;
    animals.set(key, animal);
  });

  return [...animals.values()];
};

const sortMedicationRecords = (records) =>
  [...records].sort((a, b) => String(b.administration_date || "").localeCompare(String(a.administration_date || "")));

const getMedicationCowProfiles = () => {
  const profiles = new Map();

  state.animals.forEach((animal) => {
    const id = cowIdKey(animal.id);
    if (!id) return;
    const label = animal.identification || animal.id;
    const key = cowProfileKey(label) || id;

    if (!profiles.has(key)) {
      profiles.set(key, {
        id: animal.id,
        ids: [animal.id],
        label,
        type: animal.type || "",
        status: animal.status || "",
        records: [],
      });
      return;
    }

    const profile = profiles.get(key);
    if (!profile.ids.some((item) => cowIdKey(item) === id)) profile.ids.push(animal.id);
    if (animal.type && !profile.type.includes(animal.type)) {
      profile.type = [profile.type, animal.type].filter(Boolean).join(" | ");
    }
    if (animal.status && !profile.status.includes(animal.status)) {
      profile.status = [profile.status, animal.status].filter(Boolean).join(" | ");
    }
  });

  state.medication.forEach((record) => {
    const id = cowIdKey(record.cow_id);
    if (!id) return;
    const label = animalLabel(record.cow_id);
    const key = cowProfileKey(label) || id;

    if (!profiles.has(key)) {
      profiles.set(key, {
        id: record.cow_id,
        ids: [record.cow_id],
        label,
        type: "",
        status: "",
        records: [],
      });
    }

    const profile = profiles.get(key);
    if (!profile.ids.some((item) => cowIdKey(item) === id)) profile.ids.push(record.cow_id);
    profile.records.push(record);
  });

  return [...profiles.values()]
    .map((profile) => ({
      ...profile,
      records: sortMedicationRecords(profile.records),
    }))
    .sort((a, b) => String(a.label).localeCompare(String(b.label), "pt-BR", { numeric: true, sensitivity: "base" }));
};

const getSelectedMedicationProfile = (profiles) => {
  if (!profiles.length) {
    selectedMedicationCowId = null;
    return null;
  }

  const selected = profiles.find((profile) =>
    (profile.ids || [profile.id]).some((id) => cowIdKey(id) === cowIdKey(selectedMedicationCowId))
  );
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
  updateSyncBadge();
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

const insertStockItem = async (record) => {
  const newId = localId();
  const payload = normalizeStockItemInput(record);
  if (hasSupabase) {
    try {
      await requireSession();
      const { error } = await db.from("stock_items").insert(withCurrentUser(payload));
      if (error) throw error;
      await loadSupabase();
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
  stock: { stateKey: "stockItems", table: "stock_items" },
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
    stock: ["item_name", "category", "quantity", "unit", "min_quantity", "notes", "user_id"],
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
  updateSyncBadge();
  if (refresh) {
    await loadSupabase();
    render();
  }
};
