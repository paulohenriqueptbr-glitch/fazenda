import { state, todayIso, addDaysIso, monthKey, parseIsoDate, userStorageKey } from "./state.js";
import { formatDate, escapeHtml, empty } from "./ui.js";
import { animalLabel } from "./crud.js";
import { findRecord, updateRecord } from "./crud.js";
import { showToast } from "./ui.js";
import { writeLocal } from "./state.js";
import { getMedicationInfo } from "./medication-catalog.js";

// ─── Date helpers ───────────────────────────────────────────────────────────
/**
 * Calculates the number of days between two ISO date strings.
 * @param {string} fromIso - Start date in ISO format (YYYY-MM-DD)
 * @param {string} toIso - End date in ISO format (YYYY-MM-DD)
 * @returns {number|null} Day difference (positive if toIso is after fromIso), or null if dates are invalid
 */
export const diffDays = (fromIso, toIso) => {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  if (!from || !to) return null;
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
};

/**
 * Calculates the number of days from today until a given ISO date.
 * @param {string} isoDate - Target date in ISO format (YYYY-MM-DD)
 * @returns {number|null} Days until the date (negative if past), or null if invalid
 */
export const daysFromToday = (isoDate) => diffDays(todayIso(), isoDate);

// ─── Medication reapplication (catalog-based) ────────────────────────────────
/**
 * Determines the reapplication interval for a medication based on catalog lookup.
 * @param {string} medicationName - The name of the medication
 * @param {number|null} customInterval - User-defined interval override (days)
 * @returns {{ days: number, label: string }}
 */
export const getMedicationInterval = (medicationName, customInterval = null) => {
  const info = getMedicationInfo(medicationName, customInterval);
  return { days: info.days, label: info.label };
};

/**
 * Calculates the next reapplication date for a medication record.
 * @param {{ administration_date: string, medication_name: string, reapply_interval_days?: number|null }} record
 * @returns {{ nextDate: string, daysUntil: number, interval: { days: number, label: string } }|null}
 */
export const getNextReapplyDate = (record) => {
  if (!record?.administration_date) return null;
  const interval = getMedicationInterval(record.medication_name, record.reapply_interval_days);
  const nextDate = addDaysIso(record.administration_date, interval.days);
  const daysUntil = daysFromToday(nextDate);
  return { nextDate, daysUntil, interval };
};

// ─── Alert status ───────────────────────────────────────────────────────────
/**
 * Determines the alert status based on a due date and completion flag.
 * @param {string} dueDate - Due date in ISO format
 * @param {boolean} [done=false] - Whether the alert is completed
 * @returns {"done"|"overdue"|"today"|"week"|"upcoming"} Alert status string
 */
export const alertStatus = (dueDate, done = false) => {
  if (done) return "done";
  const days = daysFromToday(dueDate);
  if (days === null) return "upcoming";
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "week";
  return "upcoming";
};

/**
 * Returns a human-readable label for the alert status, including overdue severity.
 * @param {string} dueDate - Due date in ISO format
 * @param {boolean} [done=false] - Whether the alert is completed
 * @returns {string} Localized status label with optional urgency indicator
 */
export const alertStatusLabel = (dueDate, done = false) => {
  const status = alertStatus(dueDate, done);
  const days = daysFromToday(dueDate);
  if (status === "done") return "Concluído";
  if (status === "overdue" && days !== null && days < -7) return `🔴 ${Math.abs(days)} dia${Math.abs(days) === 1 ? "" : "s"} atrasado (CRÍTICO)`;
  if (status === "overdue") return `${Math.abs(days)} dia${Math.abs(days) === 1 ? "" : "s"} atrasado`;
  if (status === "today") return "Hoje";
  if (status === "week") return `Em ${days} dia${days === 1 ? "" : "s"}`;
  return formatDate(dueDate);
};

// ─── Build alerts ───────────────────────────────────────────────────────────
const makeAlert = ({ id, title, due_date, category, notes = "", type = "auto", done = false, urgency = "normal" }) => ({
  id, title, due_date, category, notes, type, done, status: alertStatus(due_date, done), urgency,
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

  if (!state.milk.some((r) => r.date === today)) {
    alerts.push(makeAlert({ id: `auto-milk-${today}`, title: "Registrar producao de leite de hoje", due_date: today, category: "Leite", notes: "Ainda nao existe producao lancada para hoje." }));
  }

  state.breeding.forEach((r) => {
    const days = daysFromToday(r.expected_calving_date);
    if (days === null || days < -15 || days > 60) return;
    alerts.push(makeAlert({ id: `auto-calving-${r.id || r.cow_id}-${r.expected_calving_date}`, title: `Parto previsto: ${animalLabel(r.cow_id)}`, due_date: r.expected_calving_date, category: "Gestacao", notes: `Prenhez registrada em ${formatDate(r.insemination_date)}.` }));
  });

  state.lactations.forEach((r) => {
    if (r.end_date) return;
    const daysActive = diffDays(r.start_date, today);
    if (daysActive === null || daysActive < 300) return;
    alerts.push(makeAlert({ id: `auto-lactation-${r.id || r.cow_id}`, title: `Revisar lactacao longa: ${animalLabel(r.cow_id)}`, due_date: today, category: "Lactacao", notes: `${daysActive} dias desde ${formatDate(r.start_date)}.` }));
  });

  state.cropEvents.forEach((r) => {
    const eventType = String(r.event_type || "").toLowerCase();
    const rule = cropFollowUpRules.find((item) => eventType.includes(item.match));
    if (!rule || !r.event_date || formatDate(r.event_date) === "-") return;
    const dueDate = addDaysIso(r.event_date, rule.days);
    const days = daysFromToday(dueDate);
    if (days === null || days < -15 || days > 45) return;
    alerts.push(makeAlert({ id: `auto-crop-${r.id || r.plot_name}-${dueDate}`, title: rule.title, due_date: dueDate, category: "Lavoura", notes: `${r.plot_name || "Area"} - ${r.crop_name || r.event_type || "manejo"}.` }));
  });

  // Medication reapplication reminders
  state.medication.forEach((m) => {
    if (!m.administration_date) return;
    const reapply = getNextReapplyDate(m);
    if (!reapply) return;
    const { nextDate, daysUntil, interval } = reapply;
    // Only show alert in the 7 days before and 7 days after the due date
    if (daysUntil === null || daysUntil < -7 || daysUntil > 7) return;
    const animal = state.animals.find((a) => String(a.id) === String(m.cow_id));
    const animalName = animal?.identification || m.cow_id || "";
    const animalPart = animalName ? ` para ${animalName}` : "";
    let title;
    let urgency = "normal";
    if (daysUntil < 0) {
      title = `⚠️ Reaplicar ${m.medication_name || "medicamento"}${animalPart} — ${Math.abs(daysUntil)} dia${Math.abs(daysUntil) === 1 ? "" : "s"} ATRASADO`;
      urgency = "overdue";
    } else if (daysUntil === 0) {
      title = `🔴 HOJE: reaplicar ${m.medication_name || "medicamento"}${animalPart}`;
      urgency = "today";
    } else if (daysUntil <= 2) {
      title = `🟡 Amanhã: reaplicar ${m.medication_name || "medicamento"}${animalPart}`;
      urgency = "soon";
    } else if (daysUntil <= 5) {
      title = `Reaplicar ${m.medication_name || "medicamento"}${animalPart} em ${daysUntil} dias`;
      urgency = "week";
    } else {
      title = `Próxima reaplicação: ${m.medication_name || "medicamento"}${animalPart} em ${daysUntil} dias`;
      urgency = "upcoming";
    }
    alerts.push(makeAlert({
      id: `auto-med-reapply-${m.id || `${m.cow_id}-${m.administration_date}`}-${nextDate}`,
      title,
      due_date: nextDate,
      category: "Medicação",
      notes: `Intervalo: ${interval.days} dias (${interval.label}). Última aplicação: ${formatDate(m.administration_date)}.`,
      urgency,
    }));
  });

  return alerts;
};

/**
 * Checks for milk withdrawal period violations.
 * Returns alerts if any cow was treated with antibiotics and the withdrawal period hasn't expired.
 */
const buildMilkWithdrawalAlerts = () => {
  const today = todayIso();
  const alerts = [];
  
  state.medication.forEach((m) => {
    if (!m.administration_date || !m.medication_name) return;
    
    const info = getMedicationInfo(m.medication_name, m.reapply_interval_days);
    const notes = (info.notes || "").toLowerCase();
    
    // Extract withdrawal period from notes (look for "carência leite: Xh")
    const withdrawalMatch = notes.match(/car[eê]ncia leite:\s*(\d+)\s*h/);
    if (!withdrawalMatch) return;
    
    const withdrawalHours = parseInt(withdrawalMatch[1], 10);
    if (isNaN(withdrawalHours) || withdrawalHours <= 0) return;
    
    // Calculate when withdrawal expires
    const adminDate = new Date(m.administration_date);
    const withdrawEndDate = new Date(adminDate.getTime() + withdrawalHours * 60 * 60 * 1000);
    const withdrawEndDateStr = withdrawEndDate.toISOString().split("T")[0];
    
    // If withdrawal hasn't expired yet
    if (withdrawEndDateStr >= today) {
      const animal = state.animals.find((a) => String(a.id) === String(m.cow_id));
      const animalName = animal?.identification || m.cow_id || "";
      const hoursLeft = Math.round((withdrawEndDate - new Date()) / (1000 * 60 * 60));
      
      alerts.push(makeAlert({
        id: `auto-withdrawal-${m.id || `${m.cow_id}-${m.administration_date}`}`,
        title: `🚫 Carência de leite: ${animalName} — ${m.medication_name}`,
        due_date: today,
        category: "Segurança",
        notes: `Não ordenhar leite de ${animalName || "este animal"} para consumo. Carência: ${withdrawalHours}h. Expira em ${hoursLeft > 24 ? Math.ceil(hoursLeft / 24) + " dias" : hoursLeft + " horas"}. Última aplicação: ${formatDate(m.administration_date)}.`,
        urgency: "critical",
      }));
    }
  });
  
  return alerts;
};

/**
 * Checks for abortifacient medications given to pregnant cows.
 * Returns alerts if a cow with an active breeding record (pregnant) receives an abortifacient.
 */
const buildAbortifacientAlerts = () => {
  const today = todayIso();
  const alerts = [];
  
  // Known abortifacient patterns
  const abortifacientPatterns = [
    "dexametasona", "dexamethasone", "dexasone",
    "prednisolona", "prednisolone",
    "flunixina", "flunixin", "banamine",
    "pgf2", "cloprostenol", "d-clost", "estrumate",
    "misoprostol",
  ];
  
  state.medication.forEach((m) => {
    if (!m.administration_date || !m.medication_name) return;
    
    const medLower = m.medication_name.toLowerCase();
    const isAbortifacient = abortifacientPatterns.some((p) => medLower.includes(p));
    if (!isAbortifacient) return;
    
    // Check if this cow has an active pregnancy (breeding record with expected_calving_date in the future)
    const activePregnancy = state.breeding.find((b) => 
      String(b.cow_id) === String(m.cow_id) && 
      b.expected_calving_date && 
      b.expected_calving_date > today
    );
    
    if (activePregnancy) {
      const animal = state.animals.find((a) => String(a.id) === String(m.cow_id));
      const animalName = animal?.identification || m.cow_id || "";
      
      alerts.push(makeAlert({
        id: `auto-abortifacient-${m.id || `${m.cow_id}-${m.administration_date}`}`,
        title: `⚠️ ALERTA: ${m.medication_name} em vaca gestante (${animalName})`,
        due_date: m.administration_date,
        category: "Segurança",
        notes: `${animalName} está com prenhez registrada (parto previsto: ${formatDate(activePregnancy.expected_calving_date)}). ${m.medication_name} pode causar aborto! Verifique com o veterinário.`,
        urgency: "critical",
      }));
    }
  });
  
  return alerts;
};

/**
 * Checks for low stock items and generates reorder alerts.
 */
const buildStockAlerts = () => {
  const today = todayIso();
  const alerts = [];
  
  state.stockItems.forEach((item) => {
    const qty = Number(item.quantity || 0);
    const minQty = item.min_quantity === null || item.min_quantity === undefined ? null : Number(item.min_quantity);
    if (minQty === null || qty > minQty) return;
    
    const isZero = qty === 0;
    alerts.push(makeAlert({
      id: `auto-stock-${item.id || item.item_name}`,
      title: isZero ? `📦 ESTOQUE ZERADO: ${item.item_name}` : `📦 Estoque baixo: ${item.item_name}`,
      due_date: today,
      category: "Estoque",
      notes: `${isZero ? "Sem unidades em estoque!" : `Atual: ${qty}. Mínimo: ${minQty}.`}${item.category ? ` Categoria: ${item.category}.` : ""}${item.notes ? ` ${item.notes}` : ""}`,
      urgency: isZero ? "critical" : "today",
    }));
  });
  
  return alerts;
};

/**
 * Checks for weather-related crop issues.
 * Warns if spraying was done recently and rain is forecast, or if planting was done in bad conditions.
 */
const buildWeatherCropAlerts = () => {
  const today = todayIso();
  const alerts = [];

  state.cropEvents.forEach((r) => {
    if (!r.event_date) return;
    const eventDate = r.event_date;
    const eventType = String(r.event_type || "").toLowerCase();
    const daysSince = diffDays(eventDate, today);

    if (daysSince === null || daysSince < -1 || daysSince > 3) return;

    if (eventType.includes("pulver") || eventType.includes("aplicação") || eventType.includes("aplicacao")) {
      if (daysSince >= 0 && daysSince <= 1) {
        alerts.push(makeAlert({
          id: `auto-weather-spray-${r.id || r.event_date}`,
          title: `🌧️ Verificar chuva após pulverização`,
          due_date: today,
          category: "Lavoura",
          notes: `Pulverização em ${formatDate(r.event_date)} em ${r.plot_name || "área"}. Verifique se houve chuva — pode reduzir a eficácia do produto.`,
          urgency: daysSince === 0 ? "today" : "soon",
        }));
      }
    }

    if (eventType.includes("plantio") || eventType.includes("semeadura")) {
      if (daysSince >= 0 && daysSince <= 2) {
        alerts.push(makeAlert({
          id: `auto-weather-plant-${r.id || r.event_date}`,
          title: `🌱 Acompanhar germinação`,
          due_date: addDaysIso(eventDate, 7),
          category: "Lavoura",
          notes: `Plantio em ${formatDate(r.event_date)} em ${r.plot_name || "área"}. Verifique umidade do solo e germinação em 7 dias.`,
          urgency: "upcoming",
        }));
      }
    }
  });

  return alerts;
};

/**
 * Builds and returns all alerts (automatic + manual reminders), sorted by
 * status urgency and due date. Filters out dismissed alerts and marks confirmed ones.
 * @returns {Array<{ id: string, title: string, due_date: string, category: string, notes: string, type: string, done: boolean, status: string, urgency: string }>}
 */
export const buildAlerts = () => {
  const dismissed = state.dismissedAutoAlerts || new Set();
  const confirmed = state.confirmedAutoAlerts || new Set();
  const manual = state.reminders.map((r) => makeAlert({ id: r.id, title: r.title, due_date: r.due_date, category: r.category || "Geral", notes: r.notes || "", type: "manual", done: Boolean(r.done) }));
  const withdrawalAlerts = buildMilkWithdrawalAlerts();
  const abortifacientAlerts = buildAbortifacientAlerts();
  const stockAlerts = buildStockAlerts();
  const weatherCropAlerts = buildWeatherCropAlerts();
  const autoAlerts = [...buildAutomaticAlerts(), ...withdrawalAlerts, ...abortifacientAlerts, ...stockAlerts, ...weatherCropAlerts]
    .filter((a) => !dismissed.has(a.id))
    .map((a) => { const done = confirmed.has(a.id); return done ? { ...a, done, status: alertStatus(a.due_date, done) } : a; });
  return [...autoAlerts, ...manual].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const order = { overdue: 0, today: 1, week: 2, upcoming: 3, done: 4 };
    return (order[a.status] ?? 3) - (order[b.status] ?? 3) || String(a.due_date || "").localeCompare(String(b.due_date || ""));
  });
};

/**
 * Counts medication reapplication alerts grouped by urgency.
 * @returns {{ overdue: number, today: number, soon: number, upcoming: number, total: number }}
 */
export const countMedicationAlerts = () => {
  const alerts = buildAlerts();
  const medAlerts = alerts.filter((a) => a.category === "Medicação" && !a.done);
  return {
    overdue: medAlerts.filter((a) => a.urgency === "overdue").length,
    today: medAlerts.filter((a) => a.urgency === "today").length,
    soon: medAlerts.filter((a) => a.urgency === "soon").length,
    upcoming: medAlerts.filter((a) => a.urgency === "upcoming" || a.urgency === "week").length,
    total: medAlerts.length,
  };
};

// ─── Alert actions ──────────────────────────────────────────────────────────
/**
 * Dismisses an automatic alert by adding it to the dismissed set and persisting.
 * @param {string} alertId - ID of the alert to dismiss
 * @returns {void}
 */
export const dismissAutoAlert = (alertId) => {
  if (!state.dismissedAutoAlerts) state.dismissedAutoAlerts = new Set();
  state.dismissedAutoAlerts.add(alertId);
  writeLocal();
  showToast("Alerta dispensado.");
};

/**
 * Confirms an automatic alert by adding it to the confirmed set, removing
 * it from dismissed if present, and persisting.
 * @param {string} alertId - ID of the alert to confirm
 * @returns {void}
 */
export const confirmAutoAlert = (alertId) => {
  if (!state.confirmedAutoAlerts) state.confirmedAutoAlerts = new Set();
  state.confirmedAutoAlerts.add(alertId);
  if (state.dismissedAutoAlerts) state.dismissedAutoAlerts.delete(alertId);
  writeLocal();
  showToast("Alerta confirmado.");
};

/**
 * Toggles the completion status of a reminder record.
 * @param {string|number} id - Reminder record ID
 * @returns {Promise<void>}
 */
export const toggleReminder = async (id) => {
  const reminder = findRecord("reminder", id);
  if (!reminder) return;
  const done = !reminder.done;
  await updateRecord("reminder", id, { done, completed_at: done ? new Date().toISOString() : null });
  showToast(done ? "Lembrete concluido." : "Lembrete reaberto.");
};

// ─── Badge de notificação ──────────────────────────────────────────────────
/**
 * Updates the alerts badge count in both quick-access and nav elements,
 * hiding badges when count is zero.
 * @returns {void}
 */
export const updateAlertsBadge = () => {
  const alerts = buildAlerts();
  const pendingCount = alerts.filter((a) => !a.done).length;
  const badgeQuick = document.getElementById("alertsBadgeQuick");
  const badgeNav = document.getElementById("alertsBadgeNav");
  
  if (badgeQuick) {
    badgeQuick.textContent = pendingCount;
    badgeQuick.classList.toggle("hidden", pendingCount === 0);
  }
  if (badgeNav) {
    badgeNav.textContent = pendingCount;
    badgeNav.classList.toggle("hidden", pendingCount === 0);
  }
};
