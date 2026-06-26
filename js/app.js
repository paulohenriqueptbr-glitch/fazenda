import {
  $, state, hasSupabase, db, currentUserId, setCurrentUserId, config,
  todayIso, addDaysIso, monthKey, userStorageKey, writeLocal, loadLocal, localId,
  canUseLocalAccountWithPassword, supabaseUnavailableMessage,
} from "./state.js";
import { showToast, withButtonLoading, addInlineValidation, isValidDate, isNotFutureDate, isValidDateRange, validateNumber, formatLiters, getProductionStatus } from "./ui.js";
import { setupAuthListeners, checkSession, setupAuthStateListener, showLogin, showApp, requireSession, handleSupabaseError, saveLoginEmail } from "./auth.js";
import { getSyncQueue, processSyncQueue, loadSupabase, loadAppSettings, setStatus, updateSyncBadge, enqueueMutation } from "./sync.js";
import { findRecord, animalLabel, upsertMilk, insertAnimal, insertLactation, insertBreeding, insertMedication, insertCropEvent, insertStockItem, insertReminder, updateRecord, deleteRecord, savePriceQuote, saveClientProfile, showEditModal } from "./crud.js";
import { dismissAutoAlert, confirmAutoAlert, toggleReminder } from "./alerts.js";
import {
  el, render, renderMilk, renderReports, renderMedication, renderAlerts, renderSummary,
  populateCowSelects, setupPeriodFilter, recordActions, reminderActions, loadWeatherForecast,
} from "./render.js";
import { log, warn, error } from "./logger.js";

// ─── Push notifications ─────────────────────────────────────────────────────
const VAPID_PUBLIC_KEY = config.vapidPublicKey || "";

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

const savePushSubscription = async (subscription, remove = false) => {
  if (!hasSupabase || !db) return;
  try {
    const { data: { session } } = await db.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    await fetch("/api/push-subscription", {
      method: remove ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(remove ? { endpoint: subscription.endpoint } : { subscription }),
    });
  } catch (err) { warn("push-subscription:", err); }
};

const initPushNotifications = async () => {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !VAPID_PUBLIC_KEY) return;
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) { await savePushSubscription(existing); return; }
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") return;
  try {
    const subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
    await savePushSubscription(subscription);
  } catch (err) { warn("Erro ao inscrever notificações push:", err); }
};

const checkPushAlerts = async () => {
  if (!("serviceWorker" in navigator) || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.ready;
  const today = todayIso();
  const in7days = addDaysIso(today, 7);
  const alerts = [];
  for (const b of state.breeding) {
    if (!b.expected_calving_date) continue;
    if (b.expected_calving_date >= today && b.expected_calving_date <= in7days) {
      const animal = state.animals.find((a) => a.id === b.cow_id);
      const name = animal?.identification || b.cow_id || "Animal";
      const diff = Math.round((new Date(b.expected_calving_date) - new Date(today)) / 86400000);
      alerts.push({ title: "Parto Previsto", body: diff === 0 ? `${name} está com parto previsto para hoje!` : `${name} tem parto previsto em ${diff} dia${diff > 1 ? "s" : ""}.`, tag: `calving-${b.id}`, url: "/?tab=breeding" });
    }
  }
  const in3days = addDaysIso(today, 3);
  for (const m of state.medication) {
    if (!m.administration_date) continue;
    const ret = addDaysIso(m.administration_date, 30);
    if (ret >= today && ret <= in3days) {
      const animal = state.animals.find((a) => a.id === m.cow_id);
      const name = animal?.identification || m.cow_id || "Animal";
      alerts.push({ title: "Retorno de Medicação", body: `Retorno de ${m.medication_name || "medicação"} para ${name}.`, tag: `med-${m.id}`, url: "/?tab=medication" });
    }
  }
  const hour = new Date().getHours();
  const todayRegistered = state.milk.some((r) => r.date === today);
  if (!todayRegistered && hour >= 8) alerts.push({ title: "Produção Pendente", body: "Você ainda não registrou a produção de leite de hoje.", tag: "milk-pending", url: "/?tab=milk" });
  const shownKey = userStorageKey("push_shown_tags");
  let shown = [];
  try { shown = JSON.parse(localStorage.getItem(shownKey) || "[]"); } catch { shown = []; }
  for (const alert of alerts) {
    if (shown.includes(alert.tag)) continue;
    reg.showNotification(alert.title, { body: alert.body, icon: "./icons/icon-192.png", badge: "./icons/icon-192.png", tag: alert.tag, data: { url: alert.url } });
    shown.push(alert.tag);
  }
  try { localStorage.setItem(shownKey, JSON.stringify(shown.slice(-50))); } catch { /* noop */ }
};

// ─── Backup ─────────────────────────────────────────────────────────────────
const AUTO_BACKUP_KEY = "terrasyn_last_auto_backup";

const maybeAutoBackup = () => {
  try {
    const last = localStorage.getItem(userStorageKey(AUTO_BACKUP_KEY));
    const now = Date.now();
    if (last && now - Number(last) < 7 * 24 * 60 * 60 * 1000) return;
    const backup = {
      exported_at: new Date().toISOString(), auto: true,
      data: { milk: state.milk, animals: state.animals, lactations: state.lactations, breeding: state.breeding, medication: state.medication, cropEvents: state.cropEvents, stockItems: state.stockItems, reminders: state.reminders, priceQuote: state.priceQuote },
      pending_sync_count: getSyncQueue().length,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `terrasyn-autobackup-${todayIso()}.json`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    localStorage.setItem(userStorageKey(AUTO_BACKUP_KEY), String(now));
    showToast("Backup automático semanal gerado", "sync");
  } catch (err) { warn("Auto-backup falhou:", err); }
};

export const exportDataBackup = () => {
  const backup = { exported_at: new Date().toISOString(), data: state, pending_sync_count: getSyncQueue().length };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = `terrasyn-backup-${todayIso()}.json`;
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  showToast("Backup exportado com sucesso!");
};

// ─── Onboarding ─────────────────────────────────────────────────────────────
const hideOnboarding = () => { if (el.onboardingModal) el.onboardingModal.classList.add("hidden"); };

const maybeShowOnboarding = () => {
  if (!el.onboardingModal || !currentUserId) return;
  const profile = state.clientProfile;
  if (profile?.onboardingDone) { hideOnboarding(); return; }
  el.onboardingModal.classList.remove("hidden");
  const farmInput = $("#onboardingFarmName");
  const ownerInput = $("#onboardingOwnerName");
  const whatsappInput = $("#onboardingWhatsapp");
  const priceInput = $("#onboardingPrice");
  const dateInput = $("#onboardingFirstDate");
  if (farmInput) farmInput.value = profile?.farmName || "";
  if (ownerInput) ownerInput.value = profile?.ownerName || "";
  if (whatsappInput) whatsappInput.value = profile?.whatsapp || "";
  if (priceInput) priceInput.value = state.priceQuote ? String(state.priceQuote) : "";
  if (dateInput && !dateInput.value) dateInput.value = todayIso();
};

const completeOnboarding = async (skip = false) => {
  const profile = state.clientProfile || {};
  const formData = el.onboardingForm ? new FormData(el.onboardingForm) : new FormData();
  const nextProfile = {
    ...profile, farmName: String(formData.get("farmName") || profile.farmName || "").trim(),
    ownerName: String(formData.get("ownerName") || profile.ownerName || "").trim(),
    whatsapp: String(formData.get("whatsapp") || profile.whatsapp || "").trim(), onboardingDone: true,
  };
  if (!skip) {
    const price = validateNumber(formData.get("price") || "0", 0, 100);
    const firstAnimal = String(formData.get("firstAnimal") || "").trim();
    const firstLitersRaw = formData.get("firstLiters");
    const firstLiters = firstLitersRaw ? validateNumber(firstLitersRaw, 0, 1000) : null;
    const firstDate = String(formData.get("firstDate") || todayIso());
    if (!nextProfile.farmName) throw new Error("Informe o nome da fazenda.");
    if (price === null) throw new Error("Preço do litro inválido.");
    if (!isValidDate(firstDate) || !isNotFutureDate(firstDate)) throw new Error("Data da primeira produção inválida.");
    await savePriceQuote(price);
    if (firstAnimal) await insertAnimal({ identification: firstAnimal, type: "Bovino de Leite", status: "Em lactação", user_id: currentUserId });
    if (firstLiters !== null) await upsertMilk({ date: firstDate, liters: firstLiters, user_id: currentUserId });
  }
  await saveClientProfile(nextProfile);
  writeLocal();
  hideOnboarding();
  populateCowSelects();
  render();
  showToast(skip ? "Onboarding pulado. Você pode configurar depois." : "Primeira configuração concluída!");
};

// ─── Load data ──────────────────────────────────────────────────────────────
const loadData = async () => {
  if (!hasSupabase) {
    loadLocal();
    render();
    maybeShowOnboarding();
    return;
  }
  try {
    await processSyncQueue({ refresh: false });
    await loadSupabase(loadAppSettings);
  } catch (err) {
    error("Supabase load error:", err);
    loadLocal();
    setStatus(navigator.onLine ? supabaseUnavailableMessage(err) : "Offline (Modo Local)", "error");
  }
  populateCowSelects();
  render();
  maybeShowOnboarding();
  checkPushAlerts();
  maybeAutoBackup();
  updateSyncBadge();
};

// ─── Init app ───────────────────────────────────────────────────────────────
let appInitialized = false;
let selectedMedicationCowId = null;

const initApp = () => {
  if (appInitialized) { loadData(); return; }
  appInitialized = true;

  // Tab listeners
  if (!document.body._tabListenersAttached) {
    document.body._tabListenersAttached = true;
    const activateTab = (tabId) => {
      if (!tabId) return;
      document.querySelectorAll(".nav-item, .quick-action, .panel").forEach((e) => e.classList.remove("active"));
      document.querySelectorAll(`[data-tab="${tabId}"]`).forEach((e) => e.classList.add("active"));
      const panel = $(`#${tabId}`);
      if (panel) panel.classList.add("active");
      if (el.appShell) el.appShell.dataset.activeTab = tabId;
      window.scrollTo({ top: el.appShell?.offsetTop || 0, behavior: "smooth" });
    };
    document.addEventListener("click", (e) => { const btn = e.target.closest("[data-tab]"); if (btn) activateTab(btn.dataset.tab); });
    if (el.appShell && !el.appShell.dataset.activeTab) {
      const initial = document.querySelector(".panel.active");
      el.appShell.dataset.activeTab = initial ? initial.id : "milk";
    }
  }

  // Record actions
  if (!document.body._recordActionsAttached) {
    document.body._recordActionsAttached = true;
    document.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const { action, type, id } = button.dataset;
      try {
        if (action === "edit") {
          const record = findRecord(type, id);
          if (!record) return;
          const data = await showEditModal(type, record);
          if (!data) return;
          // validation per type
          if (type === "milk") { const liters = validateNumber(data.liters, 0, 1000); if (liters === null) throw new Error("Litros inválido"); await updateRecord(type, id, { liters }); }
          else if (type === "animal") { if (!data.type?.trim()) throw new Error("Tipo inválido"); if (!data.status?.trim()) throw new Error("Status inválido"); await updateRecord(type, id, { type: data.type.trim(), status: data.status.trim() }); }
          else if (type === "lactation") { const dl = validateNumber(data.daily_liters, 0, 500); if (dl === null) throw new Error("Litros/dia inválido"); if (data.end_date && !isValidDateRange(record.start_date, data.end_date)) throw new Error("Data de fim inválida"); await updateRecord(type, id, { daily_liters: dl, end_date: data.end_date || null }); }
          else if (type === "breeding") { if (!isValidDate(data.expected_calving_date)) throw new Error("Data inválida"); await updateRecord(type, id, { expected_calving_date: data.expected_calving_date }); }
          else if (type === "medication") { if (!data.medication_name?.trim()) throw new Error("Medicamento inválido"); if (!isValidDate(data.administration_date)) throw new Error("Data inválida"); await updateRecord(type, id, { medication_name: data.medication_name.trim(), dosage: (data.dosage || "").trim(), administration_date: data.administration_date }); }
          else if (type === "crop") { await updateRecord(type, id, { plot_name: (data.plot_name || "").trim(), crop_name: (data.crop_name || "").trim(), event_type: (data.event_type || "").trim(), event_date: data.event_date, product: (data.product || "").trim().substring(0, 120) || null, dosage: (data.dosage || "").trim().substring(0, 80) || null, area_tasks: data.area_tasks ? validateNumber(data.area_tasks, 0, 100000) : null, notes: (data.notes || "").trim().substring(0, 500) || null }); }
          else if (type === "stock") { await updateRecord(type, id, data); }
          else if (type === "reminder") { await updateRecord(type, id, { ...data, done: Boolean(record.done), completed_at: record.completed_at || null }); }
          populateCowSelects(); render(); showToast("Registro atualizado com sucesso!");
        }
        if (action === "delete") { if (!findRecord(type, id)) return; if (!window.confirm("Deseja excluir este registro?")) return; await deleteRecord(type, id); populateCowSelects(); render(); }
        if (action === "toggle-reminder") { await toggleReminder(id); renderAlerts(); }
        if (action === "confirm-auto-alert") { confirmAutoAlert(id); renderAlerts(); }
        if (action === "dismiss-auto-alert") { dismissAutoAlert(id); renderAlerts(); }
      } catch (err) { error(err); showToast("Não foi possível concluir a ação.", "error"); }
    });
  }

  // Medical cow tabs
  if (!document.body._medicalCowTabsAttached) {
    document.body._medicalCowTabsAttached = true;
    document.addEventListener("click", (event) => {
      const tab = event.target.closest("[data-medical-cow-id]");
      if (!tab) return;
      selectedMedicationCowId = tab.dataset.medicalCowId;
      const sel = $("#medCowId");
      if (sel) sel.value = selectedMedicationCowId;
      renderMedication(selectedMedicationCowId);
    });
  }

  // Insemination auto-fill
  const inseminationInput = $("#inseminationDate");
  const calvingInput = $("#expectedCalving");
  if (inseminationInput && calvingInput && !inseminationInput._listenerAttached) {
    inseminationInput._listenerAttached = true;
    inseminationInput.addEventListener("change", () => { if (inseminationInput.value) calvingInput.value = addDaysIso(inseminationInput.value, 285); });
  }

  // Med cow select
  const medCowInput = $("#medCowId");
  if (medCowInput && !medCowInput._listenerAttached) {
    medCowInput._listenerAttached = true;
    medCowInput.addEventListener("change", () => { selectedMedicationCowId = medCowInput.value; renderMedication(selectedMedicationCowId); });
  }

  // ─── Form submissions ─────────────────────────────────────────────────────
  el.milkForm.addEventListener("submit", withButtonLoading(el.milkForm, async (event) => {
    event.preventDefault();
    try {
      const dateValue = $("#milkDate").value;
      const litersValue = Number.parseFloat($("#liters").value || "0");
      if (!isValidDate(dateValue)) throw new Error("Data inválida");
      if (!isNotFutureDate(dateValue)) throw new Error("Não pode registrar produção futura");
      const liters = validateNumber(litersValue, 0, 1000);
      if (liters === null) throw new Error("Litros inválido (0-1000)");
      const monthRecords = state.milk.filter((r) => r.date?.startsWith(monthKey()));
      const monthAverage = monthRecords.length ? monthRecords.reduce((sum, r) => sum + Number(r.liters || 0), 0) / monthRecords.length : 0;
      const ps = getProductionStatus(liters, monthAverage);
      await upsertMilk({ date: dateValue, liters, user_id: currentUserId });
      el.milkForm.reset(); el.milkDate.value = todayIso();
      if (ps.status === "Crítico") showToast(`Produção crítica! ${formatLiters(liters)} (média: ${formatLiters(monthAverage)})`, "error");
      else if (ps.status === "Baixo") showToast(`Produção baixa. ${formatLiters(liters)} (média: ${formatLiters(monthAverage)})`, "sync");
      else showToast("Produção salva com sucesso!", "success");
      render();
    } catch (err) { if (err.authRequired) throw err; showToast(err.message || "Erro ao salvar produção", "error"); }
  }, "Salvando..."));

  el.animalForm.addEventListener("submit", withButtonLoading(el.animalForm, async (event) => {
    event.preventDefault();
    try {
      const identification = $("#animalName").value.trim();
      if (!identification || identification.length > 100) throw new Error("ID do animal deve ter 1-100 caracteres");
      await insertAnimal({ identification, type: $("#animalType").value, status: $("#animalStatus").value, user_id: currentUserId });
      el.animalForm.reset(); showToast("Animal cadastrado!"); populateCowSelects(); render();
    } catch (err) { if (err.authRequired) throw err; showToast(err.message || "Erro ao cadastrar animal", "error"); }
  }, "Cadastrando..."));

  if (el.lactationForm) {
    el.lactationForm.addEventListener("submit", withButtonLoading(el.lactationForm, async (event) => {
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
        await insertLactation({ cow_id: $("#lactCowId").value, start_date: startDate, end_date: endDate, daily_liters: liters });
        el.lactationForm.reset(); showToast("Lactação registrada!"); render();
      } catch (err) { if (err.authRequired) throw err; showToast(err.message || "Erro ao registrar lactação", "error"); }
    }, "Registrando..."));
  }

  el.breedingForm.addEventListener("submit", withButtonLoading(el.breedingForm, async (event) => {
    event.preventDefault();
    try {
      const insemDate = $("#inseminationDate").value;
      const calvingDate = $("#expectedCalving").value;
      if (!isValidDate(insemDate)) throw new Error("Data de inseminação inválida");
      if (!isValidDate(calvingDate)) throw new Error("Data de parto inválida");
      if (!isValidDateRange(insemDate, calvingDate)) throw new Error("Parto não pode ser antes de inseminação");
      await insertBreeding({ cow_id: $("#breedCowId").value, insemination_date: insemDate, expected_calving_date: calvingDate });
      el.breedingForm.reset(); render(); showToast("Reprodução registrada!");
    } catch (err) { if (err.authRequired) throw err; showToast(err.message || "Erro ao registrar reprodução", "error"); }
  }, "Registrando..."));

  el.medicationForm.addEventListener("submit", withButtonLoading(el.medicationForm, async (event) => {
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
      await insertMedication({ cow_id: medCowId, medication_name: medName, dosage: $("#medDosage").value.trim().substring(0, 100), administration_date: medDate });
      el.medicationForm.reset(); $("#medCowId").value = selectedMedicationCowId; render(); showToast("Medicação registrada!");
    } catch (err) { if (err.authRequired) throw err; showToast(err.message || "Erro ao registrar medicação", "error"); }
  }, "Registrando..."));

  if (el.cropForm) {
    el.cropForm.addEventListener("submit", withButtonLoading(el.cropForm, async (event) => {
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
        await insertCropEvent({ plot_name: plotName, crop_name: cropName, event_type: eventType, event_date: eventDate, product: $("#cropProduct").value.trim().substring(0, 120), dosage: $("#cropDosage").value.trim().substring(0, 80), area_tasks: areaTasks, notes: $("#cropNotes").value.trim().substring(0, 500) });
        el.cropForm.reset(); $("#cropDate").value = todayIso(); render(); showToast("Manejo da lavoura salvo!");
      } catch (err) { if (err.authRequired) throw err; showToast(err.message || "Erro ao salvar manejo", "error"); }
    }, "Salvando..."));
  }

  if (el.stockForm) {
    el.stockForm.addEventListener("submit", withButtonLoading(el.stockForm, async (event) => {
      event.preventDefault();
      try {
        await insertStockItem({ item_name: $("#stockItemName").value, category: $("#stockCategory").value, quantity: $("#stockQuantity").value, unit: $("#stockUnit").value, min_quantity: $("#stockMinQuantity").value, notes: $("#stockNotes").value });
        el.stockForm.reset(); render(); showToast("Item de estoque salvo!");
      } catch (err) { if (err.authRequired) throw err; showToast(err.message || "Erro ao salvar item", "error"); }
    }, "Salvando..."));
  }

  if (el.reminderForm) {
    el.reminderForm.addEventListener("submit", withButtonLoading(el.reminderForm, async (event) => {
      event.preventDefault();
      try {
        await insertReminder({ title: $("#reminderTitle").value, category: $("#reminderCategory").value, due_date: $("#reminderDate").value, notes: $("#reminderNotes").value });
        el.reminderForm.reset(); if (el.reminderDate) el.reminderDate.value = todayIso(); render(); showToast("Lembrete salvo!");
      } catch (err) { if (err.authRequired) throw err; showToast(err.message || "Erro ao salvar lembrete", "error"); }
    }, "Salvando..."));
  }

  if (el.weatherForm) {
    el.weatherForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try { const city = el.weatherCity.value.trim(); if (!city || city.length > 120) throw new Error("Informe uma cidade valida."); await loadWeatherForecast(city); }
      catch (err) { showToast(err.message || "Erro ao buscar previsao", "error"); if (el.weatherForecast) el.weatherForecast.innerHTML = `<p class="empty">Nao foi possivel carregar a previsao.</p>`; }
    });
  }

  el.priceQuoteForm.addEventListener("submit", withButtonLoading(el.priceQuoteForm, async (event) => {
    event.preventDefault();
    try {
      const price = validateNumber(el.priceQuoteInput.value || "0", 0, 100);
      if (price === null) throw new Error("Cotação inválida (0-100)");
      await savePriceQuote(price); writeLocal(); render(); el.priceQuoteForm.reset(); showToast("Cotação atualizada!");
    } catch (err) { if (err.authRequired) throw err; showToast(err.message || "Erro ao salvar cotação", "error"); }
  }, "Salvando..."));

  if (el.clientProfileForm && !el.clientProfileForm._listenerAttached) {
    el.clientProfileForm._listenerAttached = true;
    el.clientProfileForm.addEventListener("submit", withButtonLoading(el.clientProfileForm, async (event) => {
      event.preventDefault();
      try {
        const profile = state.clientProfile || {};
        await saveClientProfile({ ...profile, farmName: el.farmNameInput.value.trim(), ownerName: el.ownerNameInput.value.trim(), whatsapp: el.clientWhatsappInput.value.trim() });
        writeLocal(); render(); showToast("Dados do cliente salvos!");
      } catch (err) { if (err.authRequired) throw err; showToast(err.message || "Erro ao salvar dados do cliente", "error"); }
    }, "Salvando..."));
  }

  if (el.copyPixButton && !el.copyPixButton._listenerAttached) { el.copyPixButton._listenerAttached = true; el.copyPixButton.addEventListener("click", () => { window.location.href = subscribeUrl(); }); }
  if (el.printReportButton && !el.printReportButton._listenerAttached) { el.printReportButton._listenerAttached = true; el.printReportButton.addEventListener("click", () => { renderReports(); document.body.classList.add("printing-report"); window.print(); setTimeout(() => document.body.classList.remove("printing-report"), 400); }); }
  if (el.onboardingForm && !el.onboardingForm._listenerAttached) { el.onboardingForm._listenerAttached = true; el.onboardingForm.addEventListener("submit", async (e) => { e.preventDefault(); try { await completeOnboarding(false); } catch (err) { if (err.authRequired) throw err; showToast(err.message || "Erro ao concluir configuração", "error"); } }); }
  if (el.skipOnboardingButton && !el.skipOnboardingButton._listenerAttached) { el.skipOnboardingButton._listenerAttached = true; el.skipOnboardingButton.addEventListener("click", async () => { try { await completeOnboarding(true); } catch (err) { showToast(err.message || "Não foi possível pular agora", "error"); } }); }
  if (!el.refreshButton._listenerAttached) { el.refreshButton._listenerAttached = true; el.refreshButton.addEventListener("click", loadData); }
  if (el.exportDataButton && !el.exportDataButton._listenerAttached) { el.exportDataButton._listenerAttached = true; el.exportDataButton.addEventListener("click", exportDataBackup); }

  el.milkDate.value = todayIso();
  if ($("#cropDate")) $("#cropDate").value = todayIso();
  if (el.reminderDate) el.reminderDate.value = todayIso();
  if (el.weatherCity) el.weatherCity.value = localStorage.getItem(userStorageKey("weather_city")) || "";

  initPushNotifications();
  setupInlineValidations();
  setupPeriodFilter();
  loadData();
};

// ─── Setup inline validations ───────────────────────────────────────────────
const setupInlineValidations = () => {
  addInlineValidation($("#liters"), (v) => { const n = Number.parseFloat(v); if (v === "" || v === null) return "Informe os litros"; if (isNaN(n) || n < 0 || n > 1000) return "Valor deve ser entre 0 e 1000"; return null; });
  addInlineValidation($("#milkDate"), (v) => { if (!isValidDate(v)) return "Data inválida"; if (!isNotFutureDate(v)) return "Não pode ser data futura"; return null; });
  addInlineValidation($("#animalName"), (v) => { if (!v?.trim()) return "Informe o identificador do animal"; if (v.trim().length > 100) return "Máximo 100 caracteres"; return null; });
  addInlineValidation($("#lactStart"), (v) => (!isValidDate(v) ? "Data inválida" : null));
  addInlineValidation($("#lactLiters"), (v) => { const n = Number.parseFloat(v); if (isNaN(n) || n < 0 || n > 500) return "Valor deve ser entre 0 e 500"; return null; });
  addInlineValidation($("#inseminationDate"), (v) => (!isValidDate(v) ? "Data inválida" : null));
  addInlineValidation($("#medName"), (v) => { if (!v?.trim()) return "Informe o medicamento"; if (v.trim().length > 100) return "Máximo 100 caracteres"; return null; });
  addInlineValidation($("#medDate"), (v) => { if (!isValidDate(v)) return "Data inválida"; if (!isNotFutureDate(v)) return "Não pode ser data futura"; return null; });
  addInlineValidation($("#priceQuoteInput"), (v) => { const n = Number.parseFloat(v); if (isNaN(n) || n < 0 || n > 100) return "Valor deve ser entre 0 e 100"; return null; });
};

// ─── Support links ──────────────────────────────────────────────────────────
const setupSupportLinks = () => {
  const contactUrl = (message, subject = "Suporte Terrasyn") => {
    const encoded = encodeURIComponent(message);
    if (config.supportWhatsapp) return `https://wa.me/${config.supportWhatsapp.replace(/\D/g, "")}?text=${encoded}`;
    if (config.supportEmail) return `mailto:${config.supportEmail}?subject=${encodeURIComponent(subject)}&body=${encoded}`;
    return "privacy.html#contato";
  };
  document.querySelectorAll("[data-support-link], [data-subscribe-link]").forEach((link) => {
    const url = link.hasAttribute("data-subscribe-link")
      ? contactUrl(`Olá, quero assinar o Terrasyn. Plano: ${formatLiters(config.planPrice || 39)}/mês.`, "Assinatura Terrasyn")
      : contactUrl("Olá, preciso de suporte no Terrasyn.");
    link.setAttribute("href", url);
    if (url.startsWith("https://")) { link.setAttribute("target", "_blank"); link.setAttribute("rel", "noopener noreferrer"); }
    else { link.removeAttribute("target"); link.removeAttribute("rel"); }
  });
};

// ─── Install prompt ─────────────────────────────────────────────────────────
const installPromptModal = $("#installPromptModal");
const installPromptTitle = $("#installPromptTitle");
const installPromptMessage = $("#installPromptMessage");
const installPromptAction = $("#installPromptAction");
const installPromptLater = $("#installPromptLater");
const installPromptClose = $("#installPromptClose");
const iosInstallSteps = $("#iosInstallSteps");
let deferredInstallPrompt = null;

const hideInstallPrompt = () => { installPromptModal?.classList.add("hidden"); };
const isStandalonePwa = () => window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
const isMobileDevice = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const isIosDevice = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isAndroidDevice = () => /Android/i.test(navigator.userAgent);

const showInstallPrompt = () => {
  if (!installPromptModal || !isMobileDevice() || isStandalonePwa()) return;
  const ios = isIosDevice();
  const android = isAndroidDevice();
  const canPromptAndroid = android && deferredInstallPrompt;
  if (ios) { installPromptTitle.textContent = "Salve o Terrasyn no iPhone"; installPromptMessage.textContent = "No iOS a instalação é feita pelo Safari, salvando o ícone na tela de início."; installPromptAction.textContent = "Entendi"; }
  else if (canPromptAndroid) { installPromptTitle.textContent = "Instale o Terrasyn"; installPromptMessage.textContent = "Coloque o aplicativo na tela inicial do Android para abrir com um toque."; installPromptAction.textContent = "Instalar aplicativo"; }
  else if (android) { installPromptTitle.textContent = "Instale pelo menu do navegador"; installPromptMessage.textContent = "Se o botão de instalação ainda não aparecer, abra o menu do Chrome e escolha Instalar app."; installPromptAction.textContent = "Entendi"; }
  else return;
  iosInstallSteps?.classList.toggle("hidden", !ios);
  installPromptModal.classList.remove("hidden");
};

// ─── Service worker ─────────────────────────────────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("service-worker.js");
      await reg.update();
      const onNewSW = (worker) => {
        if (!worker) return;
        const showUpdateBanner = () => {
          if (document.getElementById("swUpdateBanner")) return;
          const banner = document.createElement("div");
          banner.id = "swUpdateBanner"; banner.className = "sw-update-banner";
          banner.innerHTML = `<span>Nova versão disponível</span><button id="swUpdateBtn" class="sw-update-btn">Atualizar agora</button><button id="swUpdateDismiss" class="sw-update-dismiss" aria-label="Fechar">✕</button>`;
          document.body.appendChild(banner);
          document.getElementById("swUpdateBtn").addEventListener("click", () => { worker.postMessage({ type: "SKIP_WAITING" }); banner.remove(); });
          document.getElementById("swUpdateDismiss").addEventListener("click", () => banner.remove());
        };
        if (worker.state === "installed") showUpdateBanner();
        else worker.addEventListener("statechange", () => { if (worker.state === "installed") showUpdateBanner(); });
      };
      if (reg.waiting) onNewSW(reg.waiting);
      reg.addEventListener("updatefound", () => onNewSW(reg.installing));
      navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload());
    } catch (err) { console.warn("Service Worker não registrado:", err); }
  });
}

// ─── Global events ──────────────────────────────────────────────────────────
window.addEventListener("online", () => { if (hasSupabase && db) { setStatus("Conectando...", "syncing"); processSyncQueue().then(() => checkSession(initApp)).catch(() => {}); } });
window.addEventListener("offline", () => { const q = getSyncQueue(); setStatus(`Offline ${q.length > 0 ? '(' + q.length + ' pendentes)' : '(Modo Local)'}`, "error"); updateSyncBadge(); });
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredInstallPrompt = e; });
window.addEventListener("appinstalled", () => { deferredInstallPrompt = null; hideInstallPrompt(); showToast("Terrasyn instalado com sucesso."); });
installPromptAction?.addEventListener("click", async () => { if (isIosDevice() || !deferredInstallPrompt) { hideInstallPrompt(); return; } const p = deferredInstallPrompt; deferredInstallPrompt = null; hideInstallPrompt(); await p.prompt(); });
installPromptLater?.addEventListener("click", hideInstallPrompt);
installPromptClose?.addEventListener("click", hideInstallPrompt);
installPromptModal?.addEventListener("click", (e) => { if (e.target === installPromptModal) hideInstallPrompt(); });

// ─── Boot ───────────────────────────────────────────────────────────────────
setupSupportLinks();
setupAuthListeners(initApp);
setupAuthStateListener(initApp);
checkSession(initApp);
