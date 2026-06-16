
const empty = (text) => `<p class="empty">${escapeHtml(text)}</p>`;

const diffDays = (fromIso, toIso) => {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  if (!from || !to) return null;
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
};

const daysFromToday = (isoDate) => diffDays(todayIso(), isoDate);

const alertStatus = (dueDate, done = false) => {
  if (done) return "done";
  const days = daysFromToday(dueDate);
  if (days === null) return "upcoming";
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "week";
  return "upcoming";
};

const alertStatusLabel = (dueDate, done = false) => {
  const status = alertStatus(dueDate, done);
  const days = daysFromToday(dueDate);
  if (status === "done") return "Concluido";
  if (status === "overdue") return `${Math.abs(days)} dia${Math.abs(days) === 1 ? "" : "s"} atrasado`;
  if (status === "today") return "Hoje";
  if (status === "week") return `Em ${days} dia${days === 1 ? "" : "s"}`;
  return formatDate(dueDate);
};

const makeAlert = ({ id, title, due_date, category, notes = "", type = "auto", done = false }) => ({
  id,
  title,
  due_date,
  category,
  notes,
  type,
  done,
  status: alertStatus(due_date, done),
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

  if (!state.milk.some((record) => record.date === today)) {
    alerts.push(makeAlert({
      id: `auto-milk-${today}`,
      title: "Registrar producao de leite de hoje",
      due_date: today,
      category: "Leite",
      notes: "Ainda nao existe producao lancada para hoje.",
    }));
  }

  state.breeding.forEach((record) => {
    const days = daysFromToday(record.expected_calving_date);
    if (days === null || days < -15 || days > 60) return;
    alerts.push(makeAlert({
      id: `auto-calving-${record.id || record.cow_id}-${record.expected_calving_date}`,
      title: `Parto previsto: ${animalLabel(record.cow_id)}`,
      due_date: record.expected_calving_date,
      category: "Gestacao",
      notes: `Prenhez registrada em ${formatDate(record.insemination_date)}.`,
    }));
  });

  state.lactations.forEach((record) => {
    if (record.end_date) return;
    const daysActive = diffDays(record.start_date, today);
    if (daysActive === null || daysActive < 300) return;
    alerts.push(makeAlert({
      id: `auto-lactation-${record.id || record.cow_id}`,
      title: `Revisar lactacao longa: ${animalLabel(record.cow_id)}`,
      due_date: today,
      category: "Lactacao",
      notes: `${daysActive} dias desde ${formatDate(record.start_date)}.`,
    }));
  });

  state.cropEvents.forEach((record) => {
    const eventType = String(record.event_type || "").toLowerCase();
    const rule = cropFollowUpRules.find((item) => eventType.includes(item.match));
    if (!rule || !isValidDate(record.event_date)) return;
    const dueDate = addDaysIso(record.event_date, rule.days);
    const days = daysFromToday(dueDate);
    if (days === null || days < -15 || days > 45) return;
    alerts.push(makeAlert({
      id: `auto-crop-${record.id || record.plot_name}-${dueDate}`,
      title: rule.title,
      due_date: dueDate,
      category: "Lavoura",
      notes: `${record.plot_name || "Area"} - ${record.crop_name || record.event_type || "manejo"}.`,
    }));
  });

  return alerts;
};

const buildAlerts = () => {
  const dismissed = state.dismissedAutoAlerts || new Set();
  const confirmed = state.confirmedAutoAlerts || new Set();
  const manual = state.reminders.map((record) =>
    makeAlert({
      id: record.id,
      title: record.title,
      due_date: record.due_date,
      category: record.category || "Geral",
      notes: record.notes || "",
      type: "manual",
      done: Boolean(record.done),
    })
  );

  const autoAlerts = buildAutomaticAlerts()
    .filter((alert) => !dismissed.has(alert.id))
    .map((alert) => {
      const done = confirmed.has(alert.id);
      return done ? { ...alert, done, status: alertStatus(alert.due_date, done) } : alert;
    });

  return [...autoAlerts, ...manual].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const statusOrder = { overdue: 0, today: 1, week: 2, upcoming: 3, done: 4 };
    return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3)
      || String(a.due_date || "").localeCompare(String(b.due_date || ""));
  });
};