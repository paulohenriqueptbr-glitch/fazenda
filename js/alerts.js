import { state, todayIso, addDaysIso, monthKey, parseIsoDate, userStorageKey } from "./state.js";
import { formatDate, escapeHtml, empty } from "./ui.js";
import { animalLabel } from "./crud.js";
import { findRecord, updateRecord } from "./crud.js";
import { showToast } from "./ui.js";
import { writeLocal } from "./state.js";
import { getMedicationInfo } from "./medication-catalog.js";

// ─── Date helpers ───────────────────────────────────────────────────────────
export const diffDays = (fromIso, toIso) => {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  if (!from || !to) return null;
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
};

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
export const alertStatus = (dueDate, done = false) => {
  if (done) return "done";
  const days = daysFromToday(dueDate);
  if (days === null) return "upcoming";
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "week";
  return "upcoming";
};

export const alertStatusLabel = (dueDate, done = false) => {
  const status = alertStatus(dueDate, done);
  const days = daysFromToday(dueDate);
  if (status === "done") return "Concluido";
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
    if (!rule || !formatDate(r.event_date) === "-") return;
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

export const buildAlerts = () => {
  const dismissed = state.dismissedAutoAlerts || new Set();
  const confirmed = state.confirmedAutoAlerts || new Set();
  const manual = state.reminders.map((r) => makeAlert({ id: r.id, title: r.title, due_date: r.due_date, category: r.category || "Geral", notes: r.notes || "", type: "manual", done: Boolean(r.done) }));
  const autoAlerts = buildAutomaticAlerts()
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
export const dismissAutoAlert = (alertId) => {
  if (!state.dismissedAutoAlerts) state.dismissedAutoAlerts = new Set();
  state.dismissedAutoAlerts.add(alertId);
  writeLocal();
  showToast("Alerta dispensado.");
};

export const confirmAutoAlert = (alertId) => {
  if (!state.confirmedAutoAlerts) state.confirmedAutoAlerts = new Set();
  state.confirmedAutoAlerts.add(alertId);
  if (state.dismissedAutoAlerts) state.dismissedAutoAlerts.delete(alertId);
  writeLocal();
  showToast("Alerta confirmado.");
};

export const toggleReminder = async (id) => {
  const reminder = findRecord("reminder", id);
  if (!reminder) return;
  const done = !reminder.done;
  await updateRecord("reminder", id, { done, completed_at: done ? new Date().toISOString() : null });
  showToast(done ? "Lembrete concluido." : "Lembrete reaberto.");
};
