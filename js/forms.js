// ─── Forms Module ───────────────────────────────────────────────────────────
// Handlers de formulário isolados para melhor manutenibilidade

import {
  $, state, currentUserId, todayIso, monthKey, addDaysIso,
} from "./state.js";
import {
  showToast, withButtonLoading, isValidDate, isNotFutureDate,
  isValidDateRange, validateNumber, formatLiters, getProductionStatus,
} from "./ui.js";
import {
  upsertMilk, insertAnimal, insertLactation, insertBreeding,
  insertMedication, insertCropEvent, insertStockItem, insertReminder,
} from "./crud.js";
import { savePriceQuote } from "./crud.js";
import { writeLocal } from "./state.js";
import { populateCowSelects } from "./render.js";
import { error } from "./logger.js";

export const setupMilkForm = (form, dateInput) => {
  if (!form) return;
  form.addEventListener("submit", withButtonLoading(form, async (event) => {
    event.preventDefault();
    try {
      const dateValue = dateInput?.value || $("#milkDate").value;
      const litersValue = Number.parseFloat($("#liters").value || "0");
      if (!isValidDate(dateValue)) throw new Error("Data inválida");
      if (!isNotFutureDate(dateValue)) throw new Error("Não pode registrar produção futura");
      const liters = validateNumber(litersValue, 0, 1000);
      if (liters === null) throw new Error("Litros inválido (0-1000)");
      const monthRecords = state.milk.filter((r) => r.date?.startsWith(monthKey()));
      const monthAverage = monthRecords.length ? monthRecords.reduce((sum, r) => sum + Number(r.liters || 0), 0) / monthRecords.length : 0;
      const ps = getProductionStatus(liters, monthAverage);
      await upsertMilk({ date: dateValue, liters, user_id: currentUserId });
      form.reset();
      if (dateInput) dateInput.value = todayIso();
      if (ps.status === "Crítico") showToast(`Produção crítica! ${formatLiters(liters)} (média: ${formatLiters(monthAverage)})`, "error");
      else if (ps.status === "Baixo") showToast(`Produção baixa. ${formatLiters(liters)} (média: ${formatLiters(monthAverage)})`, "sync");
      else showToast("Produção salva com sucesso!", "success");
    } catch (err) { if (err.authRequired) throw err; showToast(err.message || "Erro ao salvar produção", "error"); }
  }, "Salvando..."));
};

export const setupAnimalForm = (form) => {
  if (!form) return;
  form.addEventListener("submit", withButtonLoading(form, async (event) => {
    event.preventDefault();
    try {
      const identification = $("#animalName").value.trim();
      if (!identification || identification.length > 100) throw new Error("ID do animal deve ter 1-100 caracteres");
      await insertAnimal({ identification, type: $("#animalType").value, status: $("#animalStatus").value, user_id: currentUserId });
      form.reset();
      showToast("Animal cadastrado!");
      populateCowSelects();
    } catch (err) { if (err.authRequired) throw err; showToast(err.message || "Erro ao cadastrar animal", "error"); }
  }, "Cadastrando..."));
};

export const setupLactationForm = (form) => {
  if (!form) return;
  form.addEventListener("submit", withButtonLoading(form, async (event) => {
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
      form.reset();
      showToast("Lactação registrada!");
    } catch (err) { if (err.authRequired) throw err; showToast(err.message || "Erro ao registrar lactação", "error"); }
  }, "Registrando..."));
};

export const setupBreedingForm = (form) => {
  if (!form) return;
  form.addEventListener("submit", withButtonLoading(form, async (event) => {
    event.preventDefault();
    try {
      const insemDate = $("#inseminationDate").value;
      const calvingDate = $("#expectedCalving").value;
      if (!isValidDate(insemDate)) throw new Error("Data de inseminação inválida");
      if (!isValidDate(calvingDate)) throw new Error("Data de parto inválida");
      if (!isValidDateRange(insemDate, calvingDate)) throw new Error("Parto não pode ser antes de inseminação");
      await insertBreeding({ cow_id: $("#breedCowId").value, insemination_date: insemDate, expected_calving_date: calvingDate });
      form.reset();
      showToast("Reprodução registrada!");
    } catch (err) { if (err.authRequired) throw err; showToast(err.message || "Erro ao registrar reprodução", "error"); }
  }, "Registrando..."));
};

export const setupMedicationForm = (form) => {
  if (!form) return;
  form.addEventListener("submit", withButtonLoading(form, async (event) => {
    event.preventDefault();
    try {
      const medName = $("#medName").value.trim();
      const medDate = $("#medDate").value;
      const medCowId = $("#medCowId").value;
      if (!medCowId) throw new Error("Selecione uma vaca");
      if (!medName || medName.length > 100) throw new Error("Medicamento deve ter 1-100 caracteres");
      if (!isValidDate(medDate)) throw new Error("Data de aplicação inválida");
      if (!isNotFutureDate(medDate)) throw new Error("Não pode registrar medicação futura");
      const reapplyDays = $("#medReapplyInterval")?.value ? validateNumber($("#medReapplyInterval").value, 1, 365) : null;
      await insertMedication({ cow_id: medCowId, medication_name: medName, dosage: $("#medDosage").value.trim().substring(0, 100), administration_date: medDate, reapply_interval_days: reapplyDays });
      form.reset();
      showToast("Medicação registrada!");
    } catch (err) { if (err.authRequired) throw err; showToast(err.message || "Erro ao registrar medicação", "error"); }
  }, "Registrando..."));
};

export const setupCropForm = (form) => {
  if (!form) return;
  form.addEventListener("submit", withButtonLoading(form, async (event) => {
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
      form.reset();
      if ($("#cropDate")) $("#cropDate").value = todayIso();
      showToast("Manejo da lavoura salvo!");
    } catch (err) { if (err.authRequired) throw err; showToast(err.message || "Erro ao salvar manejo", "error"); }
  }, "Salvando..."));
};

export const setupStockForm = (form) => {
  if (!form) return;
  form.addEventListener("submit", withButtonLoading(form, async (event) => {
    event.preventDefault();
    try {
      await insertStockItem({ item_name: $("#stockItemName").value, category: $("#stockCategory").value, quantity: $("#stockQuantity").value, unit: $("#stockUnit").value, min_quantity: $("#stockMinQuantity").value, notes: $("#stockNotes").value });
      form.reset();
      showToast("Item de estoque salvo!");
    } catch (err) { if (err.authRequired) throw err; showToast(err.message || "Erro ao salvar item", "error"); }
  }, "Salvando..."));
};

export const setupReminderForm = (form) => {
  if (!form) return;
  form.addEventListener("submit", withButtonLoading(form, async (event) => {
    event.preventDefault();
    try {
      await insertReminder({ title: $("#reminderTitle").value, category: $("#reminderCategory").value, due_date: $("#reminderDate").value, notes: $("#reminderNotes").value });
      form.reset();
      const reminderDate = $("#reminderDate");
      if (reminderDate) reminderDate.value = todayIso();
      showToast("Lembrete salvo!");
    } catch (err) { if (err.authRequired) throw err; showToast(err.message || "Erro ao salvar lembrete", "error"); }
  }, "Salvando..."));
};

export const setupPriceQuoteForm = (form, input) => {
  if (!form) return;
  form.addEventListener("submit", withButtonLoading(form, async (event) => {
    event.preventDefault();
    try {
      const price = validateNumber(input?.value || "0", 0, 100);
      if (price === null) throw new Error("Cotação inválida (0-100)");
      await savePriceQuote(price);
      writeLocal();
      form.reset();
      showToast("Cotação atualizada!");
    } catch (err) { if (err.authRequired) throw err; showToast(err.message || "Erro ao salvar cotação", "error"); }
  }, "Salvando..."));
};

export const setupWeatherForm = (form, cityInput, forecastEl, loadWeatherFn) => {
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const city = cityInput?.value?.trim();
      if (!city || city.length > 120) throw new Error("Informe uma cidade válida.");
      await loadWeatherFn(city);
    } catch (err) {
      showToast(err.message || "Erro ao buscar previsão", "error");
      if (forecastEl) forecastEl.innerHTML = `<p class="empty">Não foi possível carregar a previsão.</p>`;
    }
  });
};

export default {
  setupMilkForm,
  setupAnimalForm,
  setupLactationForm,
  setupBreedingForm,
  setupMedicationForm,
  setupCropForm,
  setupStockForm,
  setupReminderForm,
  setupPriceQuoteForm,
  setupWeatherForm,
};
