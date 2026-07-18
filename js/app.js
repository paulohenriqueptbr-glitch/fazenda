import {
  $, state, hasSupabase, db, currentUserId, setCurrentUserId, config,
  todayIso, addDaysIso, monthKey, userStorageKey, writeLocal, loadLocal, loadLocalAlerts, localId,
  canUseLocalAccountWithPassword, supabaseUnavailableMessage,
  selectedMedicationCowId, setSelectedMedicationCowId,
  milkFilter, setMilkFilter,
} from "./state.js";
import { showToast, withButtonLoading, addInlineValidation, isValidDate, isNotFutureDate, isValidDateRange, validateNumber, formatLiters, formatMoney, getProductionStatus, toggleTheme, updateThemeToggleIcon, getPreferredTheme, safeSubmit } from "./ui.js";
import { setupAuthListeners, checkSession, setupAuthStateListener, showLogin, showApp, requireSession, handleSupabaseError, saveLoginEmail } from "./auth.js";
import { getSyncQueue, processSyncQueue, loadSupabase, loadAppSettings, setStatus, updateSyncBadge, enqueueMutation } from "./sync.js";
import { findRecord, animalLabel, upsertMilk, insertAnimal, insertLactation, insertBreeding, insertMedication, insertCropEvent, insertStockItem, insertReminder, updateRecord, deleteRecord, savePriceQuote, saveClientProfile, showEditModal } from "./crud.js";
import { findMedication, getMedicationInfo, calculateDosage, BOVINE_MEDICATIONS } from "./medication-catalog.js";
import { dismissAutoAlert, confirmAutoAlert, toggleReminder, getMedicationInterval, updateAlertsBadge } from "./alerts.js";
import {
  el, render, renderMilk, renderReports, renderMedication, renderAlerts, renderSummary,
  populateCowSelects, setupPeriodFilter, recordActions, reminderActions,
  openAnimalProfile,
} from "./render.js";
import { loadWeatherForecast } from "./weather.js";
import { log, warn, error } from "./logger.js";
import { initPushNotifications, checkPushAlerts } from "./push.js";
import { contactUrl, subscribeUrl } from "./urls.js";
import { sumLiters, getMonthAverage } from "./stats.js";
import { maybeAutoBackup, exportDataBackup } from "./backup.js";
import { setupInstallPrompt, setupInstallListeners } from "./install.js";
import { maybeShowOnboarding, completeOnboarding } from "./onboarding.js";
import { registerServiceWorker } from "./sw-registration.js";

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
    loadLocalAlerts();
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
      // Fechar submenu ao selecionar item
      const submenu = document.getElementById("navSubmenu");
      if (submenu) submenu.classList.add("hidden");
    };
    document.addEventListener("click", (e) => { const btn = e.target.closest("[data-tab]"); if (btn) activateTab(btn.dataset.tab); });
    
    // Submenu "Mais" toggle
    const navMoreBtn = document.getElementById("navMoreBtn");
    const navSubmenu = document.getElementById("navSubmenu");
    if (navMoreBtn && navSubmenu) {
      navMoreBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        navSubmenu.classList.toggle("hidden");
      });
      // Fechar submenu ao clicar fora
      document.addEventListener("click", (e) => {
        if (!navSubmenu.contains(e.target) && e.target !== navMoreBtn) {
          navSubmenu.classList.add("hidden");
        }
      });
    }
    
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
          else if (type === "animal") {
            if (!data.type?.trim()) throw new Error("Tipo inválido");
            if (!data.status?.trim()) throw new Error("Status inválido");
            const weight = data.weight ? parseFloat(data.weight) : null;
            if (data.weight && (isNaN(weight) || weight < 0 || weight > 2000)) throw new Error("Peso inválido (0-2000 kg)");
            await updateRecord(type, id, { type: data.type.trim(), status: data.status.trim(), weight });
          }
          else if (type === "lactation") { const dl = validateNumber(data.daily_liters, 0, 500); if (dl === null) throw new Error("Litros/dia inválido"); if (data.end_date && !isValidDateRange(record.start_date, data.end_date)) throw new Error("Data de fim inválida"); await updateRecord(type, id, { daily_liters: dl, end_date: data.end_date || null }); }
          else if (type === "breeding") { if (!isValidDate(data.expected_calving_date)) throw new Error("Data inválida"); await updateRecord(type, id, { expected_calving_date: data.expected_calving_date }); }
          else if (type === "medication") { if (!data.medication_name?.trim()) throw new Error("Medicamento inválido"); if (!isValidDate(data.administration_date)) throw new Error("Data inválida"); await updateRecord(type, id, { medication_name: data.medication_name.trim(), dosage: (data.dosage || "").trim(), administration_date: data.administration_date }); }
          else if (type === "crop") { await updateRecord(type, id, { plot_name: (data.plot_name || "").trim(), crop_name: (data.crop_name || "").trim(), event_type: (data.event_type || "").trim(), event_date: data.event_date, product: (data.product || "").trim().substring(0, 120) || null, dosage: (data.dosage || "").trim().substring(0, 80) || null, area_tasks: data.area_tasks ? validateNumber(data.area_tasks, 0, 100000) : null, notes: (data.notes || "").trim().substring(0, 500) || null }); }
          else if (type === "stock") { await updateRecord(type, id, data); }
          else if (type === "reminder") { await updateRecord(type, id, { ...data, done: Boolean(record.done), completed_at: record.completed_at || null }); }
          populateCowSelects(); render(); showToast("Registro atualizado com sucesso!");
        }
        if (action === "delete") { if (!findRecord(type, id)) return; if (!window.confirm("Deseja excluir este registro?")) return; await deleteRecord(type, id); populateCowSelects(); render(); }
        if (action === "toggle-reminder") { await toggleReminder(id); renderAlerts(); updateAlertsBadge(); }
        if (action === "confirm-auto-alert") { confirmAutoAlert(id); renderAlerts(); updateAlertsBadge(); }
        if (action === "dismiss-auto-alert") { dismissAutoAlert(id); renderAlerts(); updateAlertsBadge(); }
      } catch (err) { error(err); showToast("Não foi possível concluir a ação.", "error"); }
    });
  }

  // Medical cow tabs
  if (!document.body._medicalCowTabsAttached) {
    document.body._medicalCowTabsAttached = true;
    document.addEventListener("click", (event) => {
      const tab = event.target.closest("[data-medical-cow-id]");
      if (!tab) return;
      setSelectedMedicationCowId(tab.dataset.medicalCowId);
      const sel = $("#medCowId");
      if (sel) sel.value = selectedMedicationCowId;
      renderMedication(selectedMedicationCowId);
    });
  }

  // Animal card click → open profile modal
  if (!document.body._animalCardClickAttached) {
    document.body._animalCardClickAttached = true;
    document.addEventListener("click", (event) => {
      const card = event.target.closest(".animal-card[data-animal-id]");
      if (!card) return;
      // Don't open profile if clicking action buttons
      if (event.target.closest(".item-actions")) return;
      openAnimalProfile(card.dataset.animalId);
    });
  }

  // Crop group expand/collapse toggle
  if (!document.body._cropGroupToggleAttached) {
    document.body._cropGroupToggleAttached = true;
    document.addEventListener("click", (event) => {
      const header = event.target.closest(".crop-group-header");
      if (!header) return;
      const card = header.closest(".crop-group-card");
      if (!card) return;
      const eventsContainer = card.querySelector(".crop-group-events");
      if (!eventsContainer) return;
      const isHidden = eventsContainer.classList.contains("hidden");
      eventsContainer.classList.toggle("hidden", !isHidden);
      header.setAttribute("aria-expanded", String(isHidden));
      const chevron = card.querySelector(".crop-group-chevron");
      if (chevron) chevron.style.transform = isHidden ? "rotate(180deg)" : "";
    });
    // Also handle keyboard activation
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const header = event.target.closest(".crop-group-header");
      if (!header) return;
      event.preventDefault();
      header.click();
    });
  }

  // Insemination auto-fill
  const inseminationInput = $("#inseminationDate");
  const calvingInput = $("#expectedCalving");
  if (inseminationInput && calvingInput && !inseminationInput._listenerAttached) {
    inseminationInput._listenerAttached = true;
    inseminationInput.addEventListener("change", () => { if (inseminationInput.value) calvingInput.value = addDaysIso(inseminationInput.value, 285); });
  }

  // Med cow select — auto-suggest dosage based on weight
  const medCowInput = $("#medCowId");
  if (medCowInput && !medCowInput._listenerAttached) {
    medCowInput._listenerAttached = true;
    medCowInput.addEventListener("change", () => {
      setSelectedMedicationCowId(medCowInput.value);
      renderMedication(selectedMedicationCowId);
      // Auto-suggest dosage based on cow weight
      updateDosageSuggestion();
    });
  }

  // Med name input — recalculate dosage when medication name changes
  const medNameInput = $("#medName");
  if (medNameInput && !medNameInput._dosageListenerAttached) {
    medNameInput._dosageListenerAttached = true;
    medNameInput.addEventListener("input", () => { updateDosageSuggestion(); });
    medNameInput.addEventListener("change", () => { updateDosageSuggestion(); });
  }

  // Update dosage suggestion based on selected cow's weight
  const updateDosageSuggestion = () => {
    const cowId = $("#medCowId")?.value;
    const medName = $("#medName")?.value;
    const dosageInput = $("#medDosage");
    const dosageBadge = $("#dosageSuggestion");
    if (!dosageInput || !dosageBadge) return;

    if (!cowId || !medName) {
      dosageBadge.style.display = "none";
      return;
    }

    // Find cow's weight
    const cow = state.animals.find((a) => String(a.id) === String(cowId));
    const weight = cow?.weight ? parseFloat(cow.weight) : null;

    if (!weight || weight <= 0) {
      dosageBadge.innerHTML = `<span class="dosage-badge-info">ℹ️ Informe o peso do animal no cadastro para sugestão automática</span>`;
      dosageBadge.style.display = "block";
      return;
    }

    const result = calculateDosage(medName, weight);
    
    if (result.calculatedDose) {
      dosageBadge.innerHTML = `
        <span class="dosage-badge-success">💊 Dose sugerida: <strong>${result.calculatedDose}</strong></span>
        <span class="dosage-badge-detail">Base: ${result.dosage} | Peso: ${weight} kg</span>
      `;
      dosageBadge.className = "dosage-suggestion success";
      dosageBadge.style.display = "block";
    } else if (result.warning) {
      dosageBadge.innerHTML = `<span class="dosage-badge-warning">⚠️ ${result.warning}</span>`;
      dosageBadge.className = "dosage-suggestion warning";
      dosageBadge.style.display = "block";
    } else {
      dosageBadge.style.display = "none";
    }
  };

  // ─── Form submissions ─────────────────────────────────────────────────────
  safeSubmit(el.milkForm, async () => {
    const dateValue = $("#milkDate").value;
    const litersValue = Number.parseFloat($("#liters").value || "0");
    if (!isValidDate(dateValue)) throw new Error("Data inválida");
    if (!isNotFutureDate(dateValue)) throw new Error("Não pode registrar produção futura");
    const liters = validateNumber(litersValue, 0, 1000);
    if (liters === null) throw new Error("Litros inválido (0-1000)");
    const monthAverage = getMonthAverage(state.milk);
    const ps = getProductionStatus(liters, monthAverage);
    await upsertMilk({ date: dateValue, liters, user_id: currentUserId });
    el.milkForm.reset(); el.milkDate.value = todayIso();
    if (ps.status === "Crítico") showToast(`Produção crítica! ${formatLiters(liters)} (média: ${formatLiters(monthAverage)})`, "error");
    else if (ps.status === "Baixo") showToast(`Produção baixa. ${formatLiters(liters)} (média: ${formatLiters(monthAverage)})`, "sync");
    else showToast("Produção salva com sucesso!", "success");
    render();
  }, "salvar produção");

  // ─── Animal form modal ────────────────────────────────────────────────────
  const openAnimalFormBtn = $("#openAnimalFormBtn");
  const animalFormModal = $("#animalFormModal");
  const animalFormModalForm = $("#animalFormModalForm");
  if (openAnimalFormBtn && animalFormModal) {
    openAnimalFormBtn.addEventListener("click", () => {
      animalFormModal.classList.remove("hidden");
      const nameInput = $("#animalModalName");
      if (nameInput) nameInput.focus();
    });
    animalFormModal.addEventListener("click", (e) => {
      if (e.target === animalFormModal) animalFormModal.classList.add("hidden");
    });
  }
  if (animalFormModalForm) {
    safeSubmit(animalFormModalForm, async () => {
      const identification = $("#animalModalName").value.trim();
      if (!identification || identification.length > 100) throw new Error("ID do animal deve ter 1-100 caracteres");
      const weightRaw = $("#animalModalWeight")?.value;
      const weight = weightRaw ? parseFloat(weightRaw) : null;
      if (weight !== null && (isNaN(weight) || weight < 0 || weight > 2000)) throw new Error("Peso inválido (0-2000 kg)");
      await insertAnimal({ identification, type: $("#animalModalType").value, status: $("#animalModalStatus").value, weight, user_id: currentUserId });
      animalFormModalForm.reset();
      animalFormModal.classList.add("hidden");
      showToast("Animal cadastrado!"); populateCowSelects(); render();
    }, "cadastrar animal", "Cadastrando...");
  }

  if (el.lactationForm) {
    safeSubmit(el.lactationForm, async () => {
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
    }, "registrar lactação", "Registrando...");
  }

  safeSubmit(el.breedingForm, async () => {
    const insemDate = $("#inseminationDate").value;
    const calvingDate = $("#expectedCalving").value;
    if (!isValidDate(insemDate)) throw new Error("Data de inseminação inválida");
    if (!isValidDate(calvingDate)) throw new Error("Data de parto inválida");
    if (!isValidDateRange(insemDate, calvingDate)) throw new Error("Parto não pode ser antes de inseminação");
    await insertBreeding({ cow_id: $("#breedCowId").value, insemination_date: insemDate, expected_calving_date: calvingDate });
    el.breedingForm.reset(); render(); showToast("Reprodução registrada!");
  }, "registrar reprodução", "Registrando...");

  // ─── Medication Autocomplete + Smart Badge ────────────────────────────────────
  const setupMedicationAutocomplete = () => {
    const medNameInput = $("#medName");
    const medInfoBadge = $("#medInfoBadge");
    const medDosageInput = $("#medDosage");
    const medReapplyInput = $("#medReapplyInterval");
    const medDatalist = $("#medNameOptions");
    if (!medNameInput || !medDatalist) return;

    // Build datalist from catalog
    const allNames = new Set();
    BOVINE_MEDICATIONS.forEach((med) => {
      med.patterns.forEach((p) => allNames.add(p));
    });
    ["dectomax", "baytril", "terramicina", "ivomec", "banamine", "cydectin", "draxxin", "nuflor", "cidr", "estrumate", "cystorelina", "multimin", "ferrodex", "ferridex", "hematitan", "benzetacil", "tylan", "naxcel", "excede", "valbazen"].forEach((n) => allNames.add(n));

    medDatalist.innerHTML = "";
    [...allNames].sort().forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      medDatalist.appendChild(opt);
    });

    const updateBadge = () => {
      const val = medNameInput.value.trim();
      if (!val) { medInfoBadge.style.display = "none"; return; }

      const match = findMedication(val);
      if (match) {
        const info = getMedicationInfo(val);
        medInfoBadge.className = "med-info-badge";
        medInfoBadge.innerHTML = `
          <span class="med-badge-name">✓ ${info.label}</span>
          <span class="med-badge-detail">Dosagem: ${info.dosage}</span>
          <span class="med-badge-detail">Via: ${info.route}</span>
          <span class="med-badge-detail">Reaplicar: ${info.days} dias</span>
          ${info.notes ? `<br><small>${info.notes}</small>` : ""}
        `;
        medInfoBadge.style.display = "block";

        // Auto-fill dosage if empty
        if (medDosageInput && !medDosageInput.value.trim()) {
          medDosageInput.value = info.dosage;
        }
        // Auto-fill reapply interval if empty
        if (medReapplyInput && !medReapplyInput.value) {
          medReapplyInput.value = info.days;
        }
      } else {
        medInfoBadge.className = "med-info-badge med-badge-warn";
        medInfoBadge.innerHTML = `<span class="med-badge-name">⚠ Não identificado no catálogo</span><span class="med-badge-detail">Intervalo padrão: 30 dias</span>`;
        medInfoBadge.style.display = "block";
      }
    };

    medNameInput.addEventListener("input", updateBadge);
    medNameInput.addEventListener("change", updateBadge);
  };

  setupMedicationAutocomplete();

  safeSubmit(el.medicationForm, async () => {
    const medName = $("#medName").value.trim();
    const medDate = $("#medDate").value;
    const medCowId = $("#medCowId").value;
    if (!medCowId) throw new Error("Selecione uma vaca");
    if (!medName || medName.length > 100) throw new Error("Medicamento deve ter 1-100 caracteres");
    if (!isValidDate(medDate)) throw new Error("Data de aplicação inválida");
    if (!isNotFutureDate(medDate)) throw new Error("Não pode registrar medicação futura");
    setSelectedMedicationCowId(medCowId);
    const reapplyDays = $("#medReapplyInterval")?.value ? validateNumber($("#medReapplyInterval").value, 1, 365) : null;
    await insertMedication({ cow_id: medCowId, medication_name: medName, dosage: $("#medDosage").value.trim().substring(0, 100), administration_date: medDate, reapply_interval_days: reapplyDays });
    el.medicationForm.reset(); $("#medCowId").value = selectedMedicationCowId; render(); showToast("Medicação registrada!");
  }, "registrar medicação", "Registrando...");

  if (el.cropForm) {
    safeSubmit(el.cropForm, async () => {
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
    }, "salvar manejo");
  }

  if (el.stockForm) {
    safeSubmit(el.stockForm, async () => {
      await insertStockItem({ item_name: $("#stockItemName").value, category: $("#stockCategory").value, quantity: $("#stockQuantity").value, unit: $("#stockUnit").value, min_quantity: $("#stockMinQuantity").value, notes: $("#stockNotes").value });
      el.stockForm.reset(); render(); showToast("Item de estoque salvo!");
    }, "salvar item");
  }

  if (el.reminderForm) {
    safeSubmit(el.reminderForm, async () => {
      await insertReminder({ title: $("#reminderTitle").value, category: $("#reminderCategory").value, due_date: $("#reminderDate").value, notes: $("#reminderNotes").value });
      el.reminderForm.reset(); if (el.reminderDate) el.reminderDate.value = todayIso(); render(); showToast("Lembrete salvo!");
    }, "salvar lembrete");
  }

  if (el.weatherForm) {
    el.weatherForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try { const city = el.weatherCity.value.trim(); if (!city || city.length > 120) throw new Error("Informe uma cidade valida."); await loadWeatherForecast(city); }
      catch (err) { showToast(err.message || "Erro ao buscar previsao", "error"); if (el.weatherForecast) el.weatherForecast.innerHTML = `<p class="empty">Nao foi possivel carregar a previsao.</p>`; }
    });
  }

  safeSubmit(el.priceQuoteForm, async () => {
    const price = validateNumber(el.priceQuoteInput.value || "0", 0, 100);
    if (price === null) throw new Error("Cotação inválida (0-100)");
    await savePriceQuote(price); writeLocal(); render(); el.priceQuoteForm.reset(); showToast("Cotação atualizada!");
  }, "salvar cotação");

  if (el.clientProfileForm && !el.clientProfileForm._listenerAttached) {
    el.clientProfileForm._listenerAttached = true;
    safeSubmit(el.clientProfileForm, async () => {
      const profile = state.clientProfile || {};
      await saveClientProfile({ ...profile, farmName: el.farmNameInput.value.trim(), ownerName: el.ownerNameInput.value.trim(), whatsapp: el.clientWhatsappInput.value.trim() });
      writeLocal(); render(); showToast("Dados do cliente salvos!");
    }, "salvar dados do cliente");
  }

  if (el.copyPixButton && !el.copyPixButton._listenerAttached) { el.copyPixButton._listenerAttached = true; el.copyPixButton.addEventListener("click", () => { window.location.href = subscribeUrl(); }); }
  if (el.printReportButton && !el.printReportButton._listenerAttached) { el.printReportButton._listenerAttached = true; el.printReportButton.addEventListener("click", () => { renderReports(); document.body.classList.add("printing-report"); window.print(); setTimeout(() => document.body.classList.remove("printing-report"), 400); }); }
  if (el.onboardingForm && !el.onboardingForm._listenerAttached) { el.onboardingForm._listenerAttached = true; el.onboardingForm.addEventListener("submit", async (e) => { e.preventDefault(); try { await completeOnboarding(false); } catch (err) { if (err.authRequired) throw err; showToast(err.message || "Erro ao concluir configuração", "error"); } }); }
  if (el.skipOnboardingButton && !el.skipOnboardingButton._listenerAttached) { el.skipOnboardingButton._listenerAttached = true; el.skipOnboardingButton.addEventListener("click", async () => { try { await completeOnboarding(true); } catch (err) { showToast(err.message || "Não foi possível pular agora", "error"); } }); }
  
  // ─── Close modal buttons (data-close-modal) ──────────────────────────────
  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    if (btn._closeModalAttached) return;
    btn._closeModalAttached = true;
    btn.addEventListener("click", () => {
      const modalId = btn.dataset.closeModal;
      const modal = document.getElementById(modalId);
      if (modal) modal.classList.add("hidden");
    });
  });
  
  if (!el.refreshButton._listenerAttached) { el.refreshButton._listenerAttached = true; el.refreshButton.addEventListener("click", loadData); }
  if (el.exportDataButton && !el.exportDataButton._listenerAttached) { el.exportDataButton._listenerAttached = true; el.exportDataButton.addEventListener("click", exportDataBackup); }

  el.milkDate.value = todayIso();
  if ($("#cropDate")) $("#cropDate").value = todayIso();
  if (el.reminderDate) el.reminderDate.value = todayIso();
  if (el.weatherCity) el.weatherCity.value = localStorage.getItem(userStorageKey("weather_city")) || "";

  initPushNotifications();
  setupInlineValidations();
  setupPeriodFilter();
  setupMilkFilter();
  
  // ─── Accordion sections ─────────────────────────────────────────────────
  document.querySelectorAll(".accordion-toggle").forEach((toggle) => {
    const targetId = toggle.dataset.target;
    const content = document.getElementById(targetId);
    if (!content) return;
    
    // Respect initial state from HTML
    const startsCollapsed = content.classList.contains("collapsed");
    toggle.setAttribute("aria-expanded", String(!startsCollapsed));
    
    const handler = () => {
      const isExpanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!isExpanded));
      content.classList.toggle("collapsed", isExpanded);
    };
    
    toggle.addEventListener("click", handler);
    toggle.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handler(); }
    });
  });

  // ─── Dark mode toggle ───────────────────────────────────────────────────
  const themeToggleBtn = $("#themeToggle");
  if (themeToggleBtn && !themeToggleBtn._listenerAttached) {
    themeToggleBtn._listenerAttached = true;
    const initialTheme = getPreferredTheme();
    // Garante que o atributo data-theme está correto (redundância de segurança)
    document.documentElement.setAttribute("data-theme", initialTheme);
    updateThemeToggleIcon(initialTheme);
    themeToggleBtn.addEventListener("click", () => {
      const newTheme = toggleTheme();
      updateThemeToggleIcon(newTheme);
    });
  }

  // ─── Install prompt ───────────────────────────────────────────────────
  setupInstallPrompt();
  setupInstallListeners();

  loadData();
};

// ─── Setup milk date filter ──────────────────────────────────────────────────
const setupMilkFilter = () => {
  const filterButtons = document.querySelectorAll("[data-milk-period]");
  filterButtons.forEach((btn) => {
    if (btn._milkFilterAttached) return;
    btn._milkFilterAttached = true;
    btn.addEventListener("click", () => {
      filterButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const period = btn.dataset.milkPeriod;
      setMilkFilter({ period });
      if (el.milkCustomPeriod) el.milkCustomPeriod.classList.toggle("hidden", period !== "custom");
      if (period === "custom") {
        if (el.milkDateStart && !el.milkDateStart.value) el.milkDateStart.value = todayIso();
        if (el.milkDateEnd && !el.milkDateEnd.value) el.milkDateEnd.value = todayIso();
      }
      renderMilk();
    });
  });
  if (el.milkDateStart && !el.milkDateStart._milkFilterAttached) {
    el.milkDateStart._milkFilterAttached = true;
    el.milkDateStart.addEventListener("change", () => {
      setMilkFilter({ startDate: el.milkDateStart.value || null });
      renderMilk();
    });
  }
  if (el.milkDateEnd && !el.milkDateEnd._milkFilterAttached) {
    el.milkDateEnd._milkFilterAttached = true;
    el.milkDateEnd.addEventListener("change", () => {
      setMilkFilter({ endDate: el.milkDateEnd.value || null });
      renderMilk();
    });
  }
};

// ─── Setup inline validations ───────────────────────────────────────────────
const setupInlineValidations = () => {
  addInlineValidation($("#liters"), (v) => { const n = Number.parseFloat(v); if (v === "" || v === null) return "Informe os litros"; if (isNaN(n) || n < 0 || n > 1000) return "Valor deve ser entre 0 e 1000"; return null; });
  addInlineValidation($("#milkDate"), (v) => { if (!isValidDate(v)) return "Data inválida"; if (!isNotFutureDate(v)) return "Não pode ser data futura"; return null; });
  addInlineValidation($("#animalModalName"), (v) => { if (!v?.trim()) return "Informe o identificador do animal"; if (v.trim().length > 100) return "Máximo 100 caracteres"; return null; });
  addInlineValidation($("#lactStart"), (v) => (!isValidDate(v) ? "Data inválida" : null));
  addInlineValidation($("#lactLiters"), (v) => { const n = Number.parseFloat(v); if (isNaN(n) || n < 0 || n > 500) return "Valor deve ser entre 0 e 500"; return null; });
  addInlineValidation($("#inseminationDate"), (v) => (!isValidDate(v) ? "Data inválida" : null));
  addInlineValidation($("#medName"), (v) => { if (!v?.trim()) return "Informe o medicamento"; if (v.trim().length > 100) return "Máximo 100 caracteres"; return null; });
  addInlineValidation($("#medDate"), (v) => { if (!isValidDate(v)) return "Data inválida"; if (!isNotFutureDate(v)) return "Não pode ser data futura"; return null; });
  addInlineValidation($("#priceQuoteInput"), (v) => { const n = Number.parseFloat(v); if (isNaN(n) || n < 0 || n > 100) return "Valor deve ser entre 0 e 100"; return null; });
};

// ─── Support links ──────────────────────────────────────────────────────────
const setupSupportLinks = () => {
  document.querySelectorAll("[data-support-link], [data-subscribe-link]").forEach((link) => {
    const url = link.hasAttribute("data-subscribe-link")
      ? contactUrl(`Olá, quero assinar o Terrasyn. Plano: ${formatMoney(config.planPrice || 39)}/mês.`, "Assinatura Terrasyn")
      : contactUrl("Olá, preciso de suporte no Terrasyn.");
    link.setAttribute("href", url);
    if (url.startsWith("https://")) { link.setAttribute("target", "_blank"); link.setAttribute("rel", "noopener noreferrer"); }
    else { link.removeAttribute("target"); link.removeAttribute("rel"); }
  });
};

// ─── Global events ──────────────────────────────────────────────────────────
window.addEventListener("online", () => { if (hasSupabase && db) { setStatus("Conectando...", "syncing"); processSyncQueue().then(() => checkSession(initApp)).catch(() => {}); } });
window.addEventListener("offline", () => { const q = getSyncQueue(); setStatus(`Offline ${q.length > 0 ? '(' + q.length + ' pendentes)' : '(Modo Local)'}`, "error"); updateSyncBadge(); });

// ─── Error boundary global ──────────────────────────────────────────────────
window.addEventListener("error", (event) => {
  error("Erro global não tratado:", event.error);
  event.preventDefault();
});

window.addEventListener("unhandledrejection", (event) => {
  error("Promise rejeitada não tratada:", event.reason);
});

// ─── Boot ───────────────────────────────────────────────────────────────────
registerServiceWorker();
setupSupportLinks();
setupAuthListeners(initApp);
setupAuthStateListener(initApp);
checkSession(initApp);
