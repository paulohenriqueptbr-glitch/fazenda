import { $, state, todayIso, monthKey, addDaysIso, parseIsoDate, userStorageKey, planPrice, trialDays } from "./state.js";
import { formatLiters, formatMoney, formatTasks, formatStockQuantity, formatDate, escapeHtml, empty, getProductionStatus, createStatusBadge } from "./ui.js";
import { animalLabel, cowIdKey, cowProfileKey, findRecord } from "./crud.js";
import { buildAlerts, alertStatusLabel, daysFromToday, getNextReapplyDate, countMedicationAlerts, diffDays } from "./alerts.js";
import { normalizeClientProfile, normalizeSubscription, writeLocal } from "./state.js";
import { supportWhatsapp, supportEmail } from "./state.js";

// ─── DOM Elements ───────────────────────────────────────────────────────────
export const el = {
  appShell: $("#appShell"),
  syncStatus: $("#syncStatus"),
  todayTotal: $("#todayTotal"),
  todayValue: $("#todayValue"),
  fortnightTotal: $("#fortnightTotal"),
  fortnightValue: $("#fortnightValue"),
  monthTotal: $("#monthTotal"),
  monthValue: $("#monthValue"),
  animalTotal: $("#animalTotal"),
  lactatingTotal: $("#lactatingTotal"),
  customPeriodInputs: $("#customPeriodInputs"),
  customPeriodStart: $("#customPeriodStart"),
  customPeriodEnd: $("#customPeriodEnd"),
  historyList: $("#historyList"),
  animalList: $("#animalList"),
  lactationList: $("#lactationList"),
  breedingList: $("#breedingList"),
  medicationList: $("#medicationList"),
  cropEventList: $("#cropEventList"),
  stockList: $("#stockList"),
  alertList: $("#alertList"),
  milkForm: $("#milkForm"),
  milkDate: $("#milkDate"),
  animalForm: $("#animalForm"),
  lactationForm: $("#lactationForm"),
  breedingForm: $("#breedingForm"),
  medicationForm: $("#medicationForm"),
  cropForm: $("#cropForm"),
  stockForm: $("#stockForm"),
  reminderForm: $("#reminderForm"),
  reminderDate: $("#reminderDate"),
  weatherForm: $("#weatherForm"),
  weatherCity: $("#weatherCity"),
  weatherForecast: $("#weatherForecast"),
  alertOverdueTotal: $("#alertOverdueTotal"),
  alertTodayTotal: $("#alertTodayTotal"),
  alertWeekTotal: $("#alertWeekTotal"),
  alertOpenTotal: $("#alertOpenTotal"),
  priceQuoteForm: $("#priceQuoteForm"),
  priceQuoteInput: $("#priceQuoteInput"),
  priceQuoteDisplay: $("#priceQuoteDisplay"),
  priceQuoteValue: $("#priceQuoteValue"),
  clientProfileForm: $("#clientProfileForm"),
  farmNameInput: $("#farmNameInput"),
  ownerNameInput: $("#ownerNameInput"),
  clientWhatsappInput: $("#clientWhatsappInput"),
  subscriptionStatusInput: $("#subscriptionStatusInput"),
  subscriptionDueDateInput: $("#subscriptionDueDateInput"),
  clientSummary: $("#clientSummary"),
  planPriceValue: $("#planPriceValue"),
  trialDaysValue: $("#trialDaysValue"),
  pixKeyValue: $("#pixKeyValue"),
  copyPixButton: $("#copyPixButton"),
  subscribeButton: $("#subscribeButton"),
  onboardingModal: $("#onboardingModal"),
  onboardingForm: $("#onboardingForm"),
  skipOnboardingButton: $("#skipOnboardingButton"),
  refreshButton: $("#refreshButton"),
  exportDataButton: $("#exportDataButton"),
  printReportButton: $("#printReportButton"),
  reportMonthTotal: $("#reportMonthTotal"),
  reportMonthValue: $("#reportMonthValue"),
  reportAverage: $("#reportAverage"),
  reportBestDay: $("#reportBestDay"),
  reportDetails: $("#reportDetails"),
  productionChart: $("#productionChart"),
};

// ─── Action buttons ─────────────────────────────────────────────────────────
const actionButtons = (type, id) => `
  <div class="item-actions">
    <button type="button" data-action="edit" data-type="${type}" data-id="${escapeHtml(id)}">Editar</button>
    <button type="button" data-action="delete" data-type="${type}" data-id="${escapeHtml(id)}">Excluir</button>
  </div>
`;

export const recordActions = (type, record) => (record.id ? actionButtons(type, record.id) : "");

export const reminderActions = (record) => {
  if (!record.id) return "";
  const label = record.done ? "Reabrir" : "Concluir";
  return `
    <div class="item-actions">
      <button type="button" data-action="toggle-reminder" data-type="reminder" data-id="${escapeHtml(record.id)}">${label}</button>
      <button type="button" data-action="edit" data-type="reminder" data-id="${escapeHtml(record.id)}">Editar</button>
      <button type="button" data-action="delete" data-type="reminder" data-id="${escapeHtml(record.id)}">Excluir</button>
    </div>
  `;
};

// ─── Subscription ───────────────────────────────────────────────────────────
const subscriptionLabels = { trial: "Teste", active: "Ativa", overdue: "Vencida", blocked: "Bloqueada", canceled: "Cancelada" };

const daysUntil = (isoDate) => {
  if (!isoDate || !parseIsoDate(isoDate)) return null;
  const today = new Date(todayIso() + "T00:00:00");
  const due = new Date(isoDate + "T00:00:00");
  return Math.ceil((due - today) / (24 * 60 * 60 * 1000));
};

const subscriptionMessage = (profile) => {
  const days = daysUntil(profile.subscriptionDueDate);
  const label = subscriptionLabels[profile.subscriptionStatus] || "Indefinida";
  if (profile.subscriptionStatus === "blocked") return "Acesso bloqueado. Fale com o suporte para regularizar.";
  if (profile.subscriptionStatus === "overdue") return "Assinatura vencida. Regularize para manter o acesso.";
  if (days === null) return `${label}. Vencimento ainda não definido.`;
  if (days < 0) return `${label}. Venceu em ${formatDate(profile.subscriptionDueDate)}.`;
  if (days === 0) return `${label}. Vence hoje.`;
  return `${label}. Vence em ${days} dia${days === 1 ? "" : "s"}.`;
};

const applySubscriptionAccess = (profile) => {
  const blocked = ["blocked", "canceled"].includes(profile.subscriptionStatus);
  document.body.classList.toggle("subscription-blocked", blocked);
  document.querySelectorAll("#milkForm input, #milkForm button, #animalForm input, #animalForm select, #animalForm button, #lactationForm input, #lactationForm select, #lactationForm button, #breedingForm input, #breedingForm select, #breedingForm button, #medicationForm input, #medicationForm select, #medicationForm button, #cropForm input, #cropForm select, #cropForm textarea, #cropForm button, #stockForm input, #stockForm select, #stockForm textarea, #stockForm button, #reminderForm input, #reminderForm select, #reminderForm textarea, #reminderForm button")
    .forEach((c) => { c.disabled = blocked; });
};

// ─── Contact URLs ───────────────────────────────────────────────────────────
const contactUrl = (message, subject = "Suporte Terrasyn") => {
  const encoded = encodeURIComponent(message);
  if (supportWhatsapp) return `https://wa.me/${supportWhatsapp}?text=${encoded}`;
  if (supportEmail) return `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encoded}`;
  return "privacy.html#contato";
};
const supportUrl = () => contactUrl("Olá, preciso de suporte no Terrasyn.");
const subscribeUrl = () => contactUrl(`Olá, quero assinar o Terrasyn. Plano: ${formatMoney(planPrice)}/mês.`, "Assinatura Terrasyn");

// ─── Render functions ───────────────────────────────────────────────────────
export const renderClientPanel = () => {
  const profile = normalizeClientProfile(state.clientProfile);
  const subscription = normalizeSubscription(state.subscription);
  const display = { ...profile, ...subscription };
  state.clientProfile = profile;
  state.subscription = subscription;
  applySubscriptionAccess(display);

  if (el.farmNameInput) el.farmNameInput.value = profile.farmName || "";
  if (el.ownerNameInput) el.ownerNameInput.value = profile.ownerName || "";
  if (el.clientWhatsappInput) el.clientWhatsappInput.value = profile.whatsapp || "";
  if (el.subscriptionStatusInput) el.subscriptionStatusInput.value = display.subscriptionStatus || "trial";
  if (el.subscriptionDueDateInput) el.subscriptionDueDateInput.value = display.subscriptionDueDate || "";
  if (el.planPriceValue) el.planPriceValue.textContent = `${formatMoney(planPrice)}/mês`;
  if (el.trialDaysValue) el.trialDaysValue.textContent = `${trialDays} dias grátis`;
  if (el.pixKeyValue) el.pixKeyValue.textContent = "Solicite a chave pelo WhatsApp";
  if (el.copyPixButton) el.copyPixButton.disabled = false;
  if (el.subscribeButton) {
    el.subscribeButton.setAttribute("href", subscribeUrl());
    if (subscribeUrl().startsWith("https://")) { el.subscribeButton.setAttribute("target", "_blank"); el.subscribeButton.setAttribute("rel", "noopener noreferrer"); }
  }
  if (el.clientSummary) {
    const label = subscriptionLabels[display.subscriptionStatus] || "Indefinida";
    el.clientSummary.innerHTML = `
      <article><span>Fazenda</span><strong>${escapeHtml(profile.farmName || "Não informada")}</strong></article>
      <article><span>Responsável</span><strong>${escapeHtml(profile.ownerName || "Não informado")}</strong></article>
      <article><span>Assinatura</span><strong class="subscription-pill ${escapeHtml(display.subscriptionStatus || "trial")}">${escapeHtml(label)}</strong></article>
      <article><span>Vencimento</span><strong>${escapeHtml(display.subscriptionDueDate ? formatDate(display.subscriptionDueDate) : "A definir")}</strong></article>
      <p>${escapeHtml(subscriptionMessage(display))}</p>
    `;
  }
};

export const renderPriceQuote = () => {
  const price = Number(state.priceQuote || 0);
  const formatted = price.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  el.priceQuoteDisplay.textContent = `R$ ${formatted}/L`;
  el.priceQuoteValue.textContent = `R$ ${formatted} por litro`;
};

// ─── Period filter ──────────────────────────────────────────────────────────
let dashboardPeriod = "today";

const getPeriodRange = (period) => {
  const today = todayIso();
  const day = new Date().getDate();
  if (period === "today") return { start: today, end: today };
  if (period === "fortnight") return { start: day <= 15 ? `${monthKey()}-01` : `${monthKey()}-16`, end: today };
  if (period === "month") return { start: `${monthKey()}-01`, end: today };
  if (period === "custom") return { start: el.customPeriodStart?.value || today, end: el.customPeriodEnd?.value || today };
  return { start: today, end: today };
};

export const calculateProductionTrend = () => {
  const today = todayIso();
  const milkData = [...state.milk]
    .sort((a, b) => a.date.localeCompare(b.date));

  if (milkData.length < 7) {
    return { hasData: false, message: "Dados insuficientes para análise de tendência (mínimo 7 dias)" };
  }

  const last30 = milkData.filter((r) => {
    const diff = diffDays(r.date, today);
    return diff !== null && diff >= -30 && diff <= 0;
  });

  const prev30 = milkData.filter((r) => {
    const diff = diffDays(r.date, today);
    return diff !== null && diff >= -60 && diff < -30;
  });

  const last7 = milkData.slice(-7);
  const last7Avg = last7.reduce((sum, r) => sum + Number(r.liters || 0), 0) / last7.length;

  const prev7 = milkData.slice(-14, -7);
  const prev7Avg = prev7.length > 0 ? prev7.reduce((sum, r) => sum + Number(r.liters || 0), 0) / prev7.length : null;

  const last30Avg = last30.length > 0 ? last30.reduce((sum, r) => sum + Number(r.liters || 0), 0) / last30.length : null;

  const prev30Avg = prev30.length > 0 ? prev30.reduce((sum, r) => sum + Number(r.liters || 0), 0) / prev30.length : null;

  let trendDirection = "stable";
  let trendPercent = 0;
  if (prev7Avg !== null && prev7Avg > 0) {
    trendPercent = ((last7Avg - prev7Avg) / prev7Avg) * 100;
    if (trendPercent > 5) trendDirection = "up";
    else if (trendPercent < -5) trendDirection = "down";
  }

  let monthComparison = null;
  if (last30Avg !== null && prev30Avg !== null && prev30Avg > 0) {
    const monthPercent = ((last30Avg - prev30Avg) / prev30Avg) * 100;
    monthComparison = {
      thisMonth: last30Avg,
      lastMonth: prev30Avg,
      percent: monthPercent,
      direction: monthPercent > 3 ? "up" : monthPercent < -3 ? "down" : "stable",
    };
  }

  const sorted30 = [...last30].sort((a, b) => Number(b.liters || 0) - Number(a.liters || 0));
  const bestDay = sorted30[0] || null;
  const worstDay = sorted30[sorted30.length - 1] || null;
  const totalMonth = last30.reduce((sum, r) => sum + Number(r.liters || 0), 0);

  return {
    hasData: true,
    last7Avg: Math.round(last7Avg * 10) / 10,
    prev7Avg: prev7Avg ? Math.round(prev7Avg * 10) / 10 : null,
    last30Avg: last30Avg ? Math.round(last30Avg * 10) / 10 : null,
    trendDirection,
    trendPercent: Math.round(trendPercent * 10) / 10,
    monthComparison,
    bestDay: bestDay ? { date: bestDay.date, liters: bestDay.liters } : null,
    worstDay: worstDay ? { date: worstDay.date, liters: worstDay.liters } : null,
    totalMonth: Math.round(totalMonth),
    daysRecorded: last30.length,
  };
};

export const renderSummary = () => {
  const price = Number(state.priceQuote || 0);
  const today = todayIso();
  const day = new Date().getDate();
  const currentMonth = monthKey();
  const fortnightStart = day <= 15 ? `${currentMonth}-01` : `${currentMonth}-16`;
  const monthStart = `${currentMonth}-01`;

  // Today
  const todayRecords = state.milk.filter((r) => r.date === today);
  const todayLiters = todayRecords.reduce((sum, r) => sum + Number(r.liters || 0), 0);
  if (el.todayTotal) el.todayTotal.textContent = formatLiters(todayLiters);
  if (el.todayValue) el.todayValue.textContent = formatMoney(todayLiters * price);

  // Fortnight
  const fortnightRecords = state.milk.filter((r) => r.date && r.date >= fortnightStart && r.date <= today);
  const fortnightLiters = fortnightRecords.reduce((sum, r) => sum + Number(r.liters || 0), 0);
  if (el.fortnightTotal) el.fortnightTotal.textContent = formatLiters(fortnightLiters);
  if (el.fortnightValue) el.fortnightValue.textContent = formatMoney(fortnightLiters * price);

  // Month
  const monthRecords = state.milk.filter((r) => r.date && r.date >= monthStart && r.date <= today);
  const monthLiters = monthRecords.reduce((sum, r) => sum + Number(r.liters || 0), 0);
  if (el.monthTotal) el.monthTotal.textContent = formatLiters(monthLiters);
  if (el.monthValue) el.monthValue.textContent = formatMoney(monthLiters * price);

  // Animals
  if (el.animalTotal) el.animalTotal.textContent = String(state.animals.length);
  const lactating = state.animals.filter((a) => a.status === "Em lactação").length;
  if (el.lactatingTotal) el.lactatingTotal.textContent = `${lactating} em lactação`;

  // Trend analysis panel
  const trend = calculateProductionTrend();
  let trendPanel = document.getElementById("trendPanel");
  if (!trendPanel) {
    trendPanel = document.createElement("div");
    trendPanel.id = "trendPanel";
    const summaryGrid = document.querySelector(".summary-grid");
    if (summaryGrid && summaryGrid.parentNode) {
      summaryGrid.parentNode.insertBefore(trendPanel, summaryGrid.nextSibling);
    }
  }
  if (trend.hasData) {
    const trendIcon = trend.trendDirection === "up" ? "📈" : trend.trendDirection === "down" ? "📉" : "➡️";
    const monthIcon = trend.monthComparison?.direction === "up" ? "📈" : trend.monthComparison?.direction === "down" ? "📉" : "➡️";

    trendPanel.innerHTML = `
      <div class="production-trend-panel">
        <div class="trend-header">
          <span>${trendIcon}</span>
          <strong>Tendência de Produção</strong>
        </div>
        <div class="trend-grid">
          <div class="trend-card">
            <small>Média 7 dias</small>
            <strong>${trend.last7Avg} L/dia</strong>
            ${trend.prev7Avg ? `<span class="trend-change ${trend.trendDirection}">${trend.trendPercent > 0 ? "+" : ""}${trend.trendPercent}% vs semana anterior</span>` : ""}
          </div>
          ${trend.monthComparison ? `
            <div class="trend-card">
              <small>${monthIcon} Comparativo mensal</small>
              <strong>${trend.monthComparison.direction === "up" ? "↑" : trend.monthComparison.direction === "down" ? "↓" : "→"} ${Math.abs(trend.monthComparison.percent).toFixed(1)}%</strong>
              <span class="trend-change ${trend.monthComparison.direction}">Mês atual vs anterior</span>
            </div>
          ` : ""}
          ${trend.bestDay ? `
            <div class="trend-card">
              <small>🏆 Melhor dia (30d)</small>
              <strong>${formatDate(trend.bestDay.date)}</strong>
              <span class="trend-change up">${trend.bestDay.liters} L</span>
            </div>
          ` : ""}
          <div class="trend-card">
            <small>📊 Total no mês</small>
            <strong>${trend.totalMonth} L</strong>
            <span class="trend-change neutral">${trend.daysRecorded} dias registrados</span>
          </div>
        </div>
      </div>
    `;
  } else {
    trendPanel.innerHTML = "";
  }
};

export const setupPeriodFilter = () => {
  const buttons = document.querySelectorAll(".period-btn");
  buttons.forEach((btn) => {
    if (btn._periodAttached) return;
    btn._periodAttached = true;
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      dashboardPeriod = btn.dataset.period;
      if (el.customPeriodInputs) el.customPeriodInputs.classList.toggle("hidden", dashboardPeriod !== "custom");
      if (dashboardPeriod === "custom") {
        if (el.customPeriodStart && !el.customPeriodStart.value) el.customPeriodStart.value = todayIso();
        if (el.customPeriodEnd && !el.customPeriodEnd.value) el.customPeriodEnd.value = todayIso();
      }
      renderSummary();
    });
  });
  if (el.customPeriodStart && !el.customPeriodStart._periodAttached) { el.customPeriodStart._periodAttached = true; el.customPeriodStart.addEventListener("change", renderSummary); }
  if (el.customPeriodEnd && !el.customPeriodEnd._periodAttached) { el.customPeriodEnd._periodAttached = true; el.customPeriodEnd.addEventListener("change", renderSummary); }
};

// ─── Render lists ───────────────────────────────────────────────────────────
export const renderMilk = () => {
  const price = Number(state.priceQuote || 0);
  const records = [...state.milk].sort((a, b) => b.date.localeCompare(a.date));
  const monthRecords = state.milk.filter((r) => r.date?.startsWith(monthKey()));
  const monthAverage = monthRecords.length ? monthRecords.reduce((sum, r) => sum + Number(r.liters || 0), 0) / monthRecords.length : 0;
  el.historyList.innerHTML = records.length
    ? records.map((r) => {
      const ps = getProductionStatus(Number(r.liters || 0), monthAverage);
      return `<article class="item" data-milk-id="${escapeHtml(r.id)}"><div><div class="item-title-row"><span>${escapeHtml(formatDate(r.date))}</span>${createStatusBadge(ps)}</div><small>${escapeHtml(formatMoney(price))} por litro</small></div><strong>${escapeHtml(formatLiters(r.liters))} | ${escapeHtml(formatMoney(Number(r.liters) * price))}</strong>${recordActions("milk", r)}</article>`;
    }).join("")
    : empty("Nenhuma produção registrada", "milk");
};

export const renderAnimals = () => {
  el.animalList.innerHTML = state.animals.length
    ? state.animals.map((a) => `<article class="item" data-animal-id="${escapeHtml(a.id)}"><div><span>${escapeHtml(a.identification)}</span><small>${escapeHtml(a.type)}</small></div><strong>${escapeHtml(a.status)}</strong>${recordActions("animal", a)}</article>`).join("")
    : empty("Nenhum animal cadastrado", "animal");
};

export const renderLactations = () => {
  if (!el.lactationList) return;
  el.lactationList.innerHTML = state.lactations.length
    ? state.lactations.map((r) => `<article class="item"><div><span>${escapeHtml(animalLabel(r.cow_id))}</span><small>${escapeHtml(formatDate(r.start_date))} -> ${r.end_date ? escapeHtml(formatDate(r.end_date)) : "atual"}</small></div><strong>${escapeHtml(formatLiters(r.daily_liters))} / dia</strong>${recordActions("lactation", r)}</article>`).join("")
    : empty("Nenhuma lactação registrada", "milk");
};

export const renderBreeding = () => {
  el.breedingList.innerHTML = state.breeding.length
    ? state.breeding.map((r) => `<article class="item"><div><span>${escapeHtml(animalLabel(r.cow_id))}</span><small>Prenhez: ${escapeHtml(formatDate(r.insemination_date))}</small></div><strong>Parto: ${escapeHtml(formatDate(r.expected_calving_date))}</strong>${recordActions("breeding", r)}</article>`).join("")
    : empty("Nenhuma reprodução registrada", "breeding");
};

// ─── Medication profiles ────────────────────────────────────────────────────
export const getUniqueMedicationAnimals = () => {
  const animals = new Map();
  state.animals.forEach((a) => { const key = cowProfileKey(a.identification || a.id); if (!key || animals.has(key)) return; animals.set(key, a); });
  return [...animals.values()];
};

export const getMedicationCowProfiles = () => {
  const profiles = new Map();
  state.animals.forEach((a) => {
    const id = cowIdKey(a.id);
    if (!id) return;
    const label = a.identification || a.id;
    const key = cowProfileKey(label) || id;
    if (!profiles.has(key)) { profiles.set(key, { id: a.id, ids: [a.id], label, type: a.type || "", status: a.status || "", records: [] }); return; }
    const p = profiles.get(key);
    if (!p.ids.some((i) => cowIdKey(i) === id)) p.ids.push(a.id);
    if (a.type && !p.type.includes(a.type)) p.type = [p.type, a.type].filter(Boolean).join(" | ");
    if (a.status && !p.status.includes(a.status)) p.status = [p.status, a.status].filter(Boolean).join(" | ");
  });
  state.medication.forEach((r) => {
    const id = cowIdKey(r.cow_id);
    if (!id) return;
    const label = animalLabel(r.cow_id);
    const key = cowProfileKey(label) || id;
    if (!profiles.has(key)) profiles.set(key, { id: r.cow_id, ids: [r.cow_id], label, type: "", status: "", records: [] });
    const p = profiles.get(key);
    if (!p.ids.some((i) => cowIdKey(i) === id)) p.ids.push(r.cow_id);
    p.records.push(r);
  });
  return [...profiles.values()]
    .map((p) => ({ ...p, records: [...p.records].sort((a, b) => String(b.administration_date || "").localeCompare(String(a.administration_date || ""))) }))
    .sort((a, b) => String(a.label).localeCompare(String(b.label), "pt-BR", { numeric: true, sensitivity: "base" }));
};

export const getSelectedMedicationProfile = (profiles, selectedMedicationCowId) => {
  if (!profiles.length) return null;
  const selected = profiles.find((p) => (p.ids || [p.id]).some((id) => cowIdKey(id) === cowIdKey(selectedMedicationCowId)));
  if (selected) return selected;
  return profiles.find((p) => p.records.length > 0) || profiles[0];
};

const renderMedicalCowRecord = (profile) => {
  const records = profile.records;
  const last = records[0];
  const info = [profile.type, profile.status].filter(Boolean).join(" | ");
  const countLabel = `${records.length} ${records.length === 1 ? "registro" : "registros"}`;
  return `
    <article class="medical-record-card">
      <header class="medical-record-head"><div><span>Ficha médica</span><h3>${escapeHtml(profile.label)}</h3><small>${escapeHtml(info || "Dados do rebanho")}</small></div><strong>${escapeHtml(countLabel)}</strong></header>
      <div class="medical-record-summary">
        <span><small>Total</small><strong>${escapeHtml(String(records.length))}</strong></span>
        <span><small>Última aplicação</small><strong>${escapeHtml(last ? formatDate(last.administration_date) : "-")}</strong></span>
        <span><small>Último medicamento</small><strong>${escapeHtml(last?.medication_name || "-")}</strong></span>
      </div>
      <div class="medical-history">${records.length ? records.map((r, i) => `<article class="item medical-history-item"><div><span>${escapeHtml(r.medication_name)}</span><small>${escapeHtml(formatDate(r.administration_date))}</small></div><strong>${escapeHtml(r.dosage ? r.dosage + " ml" : "Sem dosagem")}</strong>${recordActions("medication", r)}</article>`).join("") : empty("Nenhuma medicação registrada para esta vaca", "medication")}</div>
    </article>`;
};

export const renderUpcomingReapplications = () => {
  const container = $("#upcomingReapply");
  if (!container) return;
  
  const today = todayIso();
  const upcoming = [];
  
  state.medication.forEach((m) => {
    if (!m.administration_date) return;
    const reapply = getNextReapplyDate(m);
    if (!reapply) return;
    const { nextDate, daysUntil, interval } = reapply;
    if (daysUntil === null || daysUntil < -7 || daysUntil > 7) return;
    
    const animal = state.animals.find((a) => String(a.id) === String(m.cow_id));
    const animalName = animal?.identification || m.cow_id || "";
    
    let urgencyClass = "upcoming";
    let dueLabel = "";
    if (daysUntil < 0) {
      urgencyClass = "overdue";
      dueLabel = `${Math.abs(daysUntil)} dia${Math.abs(daysUntil) === 1 ? "" : "s"} atrasado`;
    } else if (daysUntil === 0) {
      urgencyClass = "today";
      dueLabel = "Hoje!";
    } else if (daysUntil <= 2) {
      urgencyClass = "soon";
      dueLabel = daysUntil === 1 ? "Amanhã" : `Em ${daysUntil} dias`;
    } else {
      dueLabel = `Em ${daysUntil} dias`;
    }
    
    upcoming.push({
      medication_name: m.medication_name || "Medicamento",
      animalName,
      nextDate,
      daysUntil,
      interval,
      urgencyClass,
      dueLabel,
    });
  });
  
  upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
  
  if (upcoming.length === 0) {
    container.innerHTML = "";
    return;
  }
  
  const urgentCount = upcoming.filter((u) => u.urgencyClass === "overdue" || u.urgencyClass === "today").length;
  
  container.innerHTML = `
    <div class="upcoming-reapply-header">
      <h3>📋 Próximas reaplicações</h3>
      ${urgentCount > 0 ? `<span class="upcoming-reapply-count urgent">${urgentCount}</span>` : `<span class="upcoming-reapply-count">${upcoming.length}</span>`}
    </div>
    <div class="upcoming-reapply-list">
      ${upcoming.map((u) => `
        <div class="upcoming-reapply-item ${u.urgencyClass}">
          <div class="upcoming-reapply-info">
            <span class="reapply-med-name">${escapeHtml(u.medication_name)}</span>
            ${u.animalName ? `<span class="reapply-animal">${escapeHtml(u.animalName)}</span>` : ""}
            <span class="reapply-interval">Intervalo: ${u.interval.days} dias</span>
          </div>
          <div class="upcoming-reapply-due ${u.urgencyClass}">${u.dueLabel}</div>
        </div>
      `).join("")}
    </div>
  `;
};

/**
 * Detects chronic treatment patterns for each animal.
 * Flags cows that received the same medication 3+ times in the last 30 days.
 * @returns {Array} Array of chronic treatment alerts
 */
export const detectChronicTreatments = () => {
  const today = todayIso();
  const thirtyDaysAgo = addDaysIso(today, -30);
  const chronicAlerts = [];
  
  // Group medications by cow_id
  const cowMedications = {};
  state.medication.forEach((m) => {
    if (!m.administration_date || !m.cow_id || !m.medication_name) return;
    if (m.administration_date < thirtyDaysAgo) return;
    
    const key = `${m.cow_id}|${m.medication_name.toLowerCase().trim()}`;
    if (!cowMedications[key]) {
      cowMedications[key] = { cow_id: m.cow_id, medication_name: m.medication_name, count: 0, dates: [] };
    }
    cowMedications[key].count++;
    cowMedications[key].dates.push(m.administration_date);
  });
  
  // Find chronic patterns (3+ treatments in 30 days)
  Object.values(cowMedications).forEach((data) => {
    if (data.count < 3) return;
    
    const animal = state.animals.find((a) => String(a.id) === String(data.cow_id));
    const animalName = animal?.identification || data.cow_id || "";
    
    chronicAlerts.push({
      animal_name: animalName,
      cow_id: data.cow_id,
      medication_name: data.medication_name,
      treatment_count: data.count,
      dates: data.dates.sort(),
      message: `${animalName} recebeu ${data.medication_name} ${data.count} vezes nos últimos 30 dias`,
    });
  });
  
  return chronicAlerts;
};

/**
 * Renders chronic treatment warnings in the medication panel.
 */
export const renderChronicTreatments = () => {
  const container = $("#chronicTreatments");
  if (!container) return;
  
  const chronicAlerts = detectChronicTreatments();
  
  if (chronicAlerts.length === 0) {
    container.innerHTML = "";
    return;
  }
  
  container.innerHTML = `
    <div class="chronic-treatment-panel">
      <div class="chronic-header">
        <span>⚠️</span>
        <strong>Tratamentos Recorrentes</strong>
        <span class="chronic-count">${chronicAlerts.length}</span>
      </div>
      <div class="chronic-list">
        ${chronicAlerts.map((alert) => `
          <div class="chronic-item">
            <div class="chronic-info">
              <span class="chronic-animal">${escapeHtml(alert.animal_name)}</span>
              <span class="chronic-med">${escapeHtml(alert.medication_name)}</span>
              <span class="chronic-count-label">${alert.treatment_count} aplicações em 30 dias</span>
            </div>
            <div class="chronic-dates">
              ${alert.dates.map((d) => `<span class="chronic-date">${formatDate(d)}</span>`).join("")}
            </div>
          </div>
        `).join("")}
      </div>
      <div class="chronic-advice">
        <small>💡 Considere consultar um veterinário sobre padrões recorrentes de tratamento.</small>
      </div>
    </div>
  `;
};

export const renderMedication = (selectedMedicationCowId) => {
  renderUpcomingReapplications();
  renderChronicTreatments();
  const profiles = getMedicationCowProfiles();
  const selectedProfile = getSelectedMedicationProfile(profiles, selectedMedicationCowId);
  const medCowSelect = $("#medCowId");
  if (!profiles.length) { el.medicationList.innerHTML = empty("Cadastre uma vaca para criar a ficha médica", "medication"); return; }
  if (selectedProfile && medCowSelect && Array.from(medCowSelect.options).some((o) => cowIdKey(o.value) === cowIdKey(selectedProfile.id))) medCowSelect.value = selectedProfile.id;
  el.medicationList.innerHTML = `
    <div class="medical-workspace">
      <div class="medical-cow-tabs" role="tablist" aria-label="Fichas médicas das vacas">${profiles.map((p) => {
        const active = (p.ids || [p.id]).some((id) => (selectedProfile?.ids || [selectedProfile?.id]).some((sid) => cowIdKey(id) === cowIdKey(sid)));
        const last = p.records[0];
        const countText = `${p.records.length} ${p.records.length === 1 ? "registro" : "registros"}`;
        const dateText = last ? formatDate(last.administration_date) : "Sem medicação";
        return `<button class="medical-cow-tab ${active ? "active" : ""}" type="button" data-medical-cow-id="${escapeHtml(p.id)}" role="tab" aria-selected="${active ? "true" : "false"}"><span>${escapeHtml(p.label)}</span><small>${escapeHtml(countText)}</small><em>${escapeHtml(dateText)}</em></button>`;
      }).join("")}</div>
      <div class="medical-record-panel" role="tabpanel">${selectedProfile ? renderMedicalCowRecord(selectedProfile) : empty("Selecione uma vaca para abrir a ficha médica", "medical")}</div>
    </div>`;
};

export const renderCropEvents = () => {
  if (!el.cropEventList) return;
  const records = [...state.cropEvents].sort((a, b) => String(b.event_date || "").localeCompare(String(a.event_date || "")));
  el.cropEventList.innerHTML = records.length
    ? records.map((r) => {
      const details = [r.product ? `Produto: ${r.product}` : "", r.dosage ? `Dose: ${r.dosage}` : ""].filter(Boolean);
      const areaLabel = formatTasks(r.area_tasks);
      return `<article class="item"><div><span>${escapeHtml(r.plot_name)} - ${escapeHtml(r.event_type)}</span><small>${escapeHtml(formatDate(r.event_date))} | ${escapeHtml(r.crop_name)}</small>${details.length ? `<small>${escapeHtml(details.join(" | "))}</small>` : ""}${r.notes ? `<small>${escapeHtml(r.notes)}</small>` : ""}</div><strong>${escapeHtml(areaLabel || r.event_type)}</strong>${recordActions("crop", r)}</article>`;
    }).join("")
    : empty("Nenhum manejo de lavoura registrado", "crop");
};

export const renderStockItems = () => {
  if (!el.stockList) return;
  const records = [...state.stockItems].sort((a, b) => {
    const byCat = String(a.category || "").localeCompare(String(b.category || ""), "pt-BR", { sensitivity: "base" });
    return byCat || String(a.item_name || "").localeCompare(String(b.item_name || ""), "pt-BR", { sensitivity: "base" });
  });
  el.stockList.innerHTML = records.length
    ? records.map((r) => {
      const qty = Number(r.quantity || 0);
      const minQty = r.min_quantity === null || r.min_quantity === undefined ? null : Number(r.min_quantity || 0);
      const isLow = minQty !== null && qty <= minQty;
      const details = [r.category || "Estoque", minQty !== null ? `Minimo: ${formatStockQuantity(minQty, r.unit)}` : "", r.notes || ""].filter(Boolean);
      return `<article class="item ${isLow ? "stock-low" : ""}"><div><span>${escapeHtml(r.item_name)}</span><small>${escapeHtml(details.join(" | "))}</small></div><strong>${escapeHtml(`${formatStockQuantity(qty, r.unit)}${isLow ? " | baixo" : ""}`)}</strong>${recordActions("stock", r)}</article>`;
    }).join("")
    : empty("Nenhum item em estoque cadastrado", "stock");
};

// ─── Alerts ─────────────────────────────────────────────────────────────────
export const renderAlertItem = (alert) => {
  const isManual = alert.type === "manual";
  const autoActions = !isManual && !alert.done ? `<div class="item-actions"><button type="button" data-action="confirm-auto-alert" data-id="${escapeHtml(alert.id)}">Confirmar</button><button type="button" class="ghost" data-action="dismiss-auto-alert" data-id="${escapeHtml(alert.id)}">Dispensar</button></div>` : "";
  return `<article class="item alert-item ${escapeHtml(alert.status)}"><div><div class="item-title-row"><span>${escapeHtml(alert.title)}</span><span class="alert-pill ${escapeHtml(alert.status)}">${escapeHtml(alertStatusLabel(alert.due_date, alert.done))}</span></div><small>${escapeHtml(alert.category)} | ${escapeHtml(formatDate(alert.due_date))}</small>${alert.notes ? `<small>${escapeHtml(alert.notes)}</small>` : ""}</div><strong>${escapeHtml(isManual ? "Lembrete" : "Automatico")}</strong>${isManual ? reminderActions(findRecord("reminder", alert.id) || alert) : autoActions}</article>`;
};

export const renderAlerts = () => {
  if (!el.alertList) return;
  const alerts = buildAlerts();
  const active = alerts.filter((a) => !a.done);
  const counts = {
    overdue: active.filter((a) => a.status === "overdue").length,
    today: active.filter((a) => a.status === "today").length,
    week: active.filter((a) => a.status === "week").length,
    open: active.length,
  };
  if (el.alertOverdueTotal) el.alertOverdueTotal.textContent = String(counts.overdue);
  if (el.alertTodayTotal) el.alertTodayTotal.textContent = String(counts.today);
  if (el.alertWeekTotal) el.alertWeekTotal.textContent = String(counts.week);
  if (el.alertOpenTotal) el.alertOpenTotal.textContent = String(counts.open);
  el.alertList.innerHTML = alerts.length ? alerts.map(renderAlertItem).join("") : empty("Nenhum alerta no momento", "alert");
};

// ─── Weather ────────────────────────────────────────────────────────────────
export const renderWeatherForecast = (data) => {
  if (!el.weatherForecast) return;
  const locationParts = [data.location?.name, data.location?.region, data.location?.country].filter(Boolean);
  const days = Array.isArray(data.forecast) ? data.forecast : [];
  el.weatherForecast.innerHTML = `
    <div class="weather-header"><div><span>Previsao do tempo</span><strong>${escapeHtml(locationParts.join(" - ") || "Local informado")}</strong></div><small>${escapeHtml(data.source || "Open-Meteo")}</small></div>
    <div class="weather-grid">${days.map((d) => `<article class="weather-day"><span>${escapeHtml(formatDate(d.date))}</span><strong>${escapeHtml(d.condition || "Tempo variavel")}</strong><small>${escapeHtml(`${Number(d.temperatureMin ?? 0).toLocaleString("pt-BR")} a ${Number(d.temperatureMax ?? 0).toLocaleString("pt-BR")} C`)}</small><small>${escapeHtml(`Chuva: ${d.precipitationProbability ?? 0}% | ${d.precipitationMm ?? 0} mm`)}</small><small>${escapeHtml(`Vento: ${d.windSpeedKmh ?? 0} km/h`)}</small></article>`).join("")}</div>`;
};

export const loadWeatherForecast = async (city) => {
  if (!el.weatherForecast) return;
  el.weatherForecast.innerHTML = `
    <div class="weather-header skeleton skeleton-card">
      <span>Previsão do tempo</span>
      <strong>Carregando...</strong>
    </div>
    <div class="weather-grid">
      ${[1,2,3].map(() => '<article class="weather-day skeleton skeleton-card"><span>&nbsp;</span><strong>&nbsp;</strong><small>&nbsp;</small></article>').join('')}
    </div>`;
  const response = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "Nao foi possivel buscar a previsao.");
  localStorage.setItem(userStorageKey("weather_city"), city);
  renderWeatherForecast(data);
};

// ─── Reports ────────────────────────────────────────────────────────────────
let productionChart = null;

const destroyChart = () => {
  if (productionChart) {
    productionChart.destroy();
    productionChart = null;
  }
};

const buildMonthlyReport = () => {
  const price = Number(state.priceQuote || 0);
  const currentMonth = monthKey();
  const today = todayIso();
  const calvingLimit = addDaysIso(today, 60);
  const monthRecords = state.milk.filter((r) => r.date?.startsWith(currentMonth));
  const monthLiters = monthRecords.reduce((sum, r) => sum + Number(r.liters || 0), 0);
  const average = monthRecords.length ? monthLiters / monthRecords.length : 0;
  const bestRecord = monthRecords.reduce((best, r) => (Number(r.liters || 0) > Number(best?.liters || 0) ? r : best), null);
  const lactating = state.animals.filter((a) => a.status === "Em lactação").length;
  const medications = state.medication.filter((r) => r.administration_date?.startsWith(currentMonth));
  const calvings = state.breeding.filter((r) => r.expected_calving_date >= today && r.expected_calving_date <= calvingLimit);
  return { price, monthRecords, monthLiters, monthValue: monthLiters * price, average, bestRecord, lactating, medications, calvings };
};

export const renderReports = () => {
  const report = buildMonthlyReport();
  const chartRecords = [...state.milk].sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  el.reportMonthTotal.textContent = formatLiters(report.monthLiters);
  el.reportMonthValue.textContent = formatMoney(report.monthValue);
  el.reportAverage.textContent = formatLiters(report.average);
  el.reportBestDay.textContent = report.bestRecord ? `${formatDate(report.bestRecord.date)} - ${formatLiters(report.bestRecord.liters)}` : "-";
  if (el.reportDetails) {
    el.reportDetails.innerHTML = `
      <article><span>Animais em lactação</span><strong>${escapeHtml(String(report.lactating))}</strong><small>${escapeHtml(String(state.animals.length))} animais cadastrados</small></article>
      <article><span>Medicações no mês</span><strong>${escapeHtml(String(report.medications.length))}</strong><small>${escapeHtml(report.medications.slice(0, 2).map((i) => i.medication_name).join(", ") || "Nenhuma aplicação")}</small></article>
      <article><span>Previsão de parto</span><strong>${escapeHtml(String(report.calvings.length))}</strong><small>${escapeHtml(report.calvings.slice(0, 2).map((i) => `${animalLabel(i.cow_id)}: ${formatDate(i.expected_calving_date)}`).join(", ") || "Sem partos nos próximos 60 dias")}</small></article>
      <article><span>Faturamento estimado</span><strong>${escapeHtml(formatMoney(report.monthValue))}</strong><small>${escapeHtml(formatMoney(report.price))} por litro</small></article>`;
  }
  if (chartRecords.length > 0 && window.Chart && el.productionChart) {
    const ctx = el.productionChart.getContext ? el.productionChart : document.createElement("canvas");

    // Destrói chart anterior antes de criar novo (previne memory leak)
    destroyChart();

    el.productionChart.innerHTML = "";
    el.productionChart.appendChild(ctx);
    productionChart = new window.Chart(ctx, {
        type: "line",
        data: {
          labels: chartRecords.map((r) => formatDate(r.date)),
          datasets: [
            { label: "Produção (L)", data: chartRecords.map((r) => Number(r.liters || 0)), borderColor: "#176c56", backgroundColor: "rgba(23,108,86,0.1)", borderWidth: 2, fill: true, tension: 0.3, pointRadius: 5, pointBackgroundColor: "#176c56", pointBorderColor: "#fff", pointBorderWidth: 2, pointHoverRadius: 7 },
            { label: "Média mensal", data: chartRecords.map(() => report.average), borderColor: "#b7791f", borderWidth: 2, borderDash: [5, 5], fill: false, pointRadius: 0, tension: 0 },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: true,
          plugins: { legend: { display: true, position: "top" }, tooltip: { backgroundColor: "rgba(0,0,0,0.8)", padding: 12, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatLiters(ctx.parsed.y)}` } } },
          scales: { y: { beginAtZero: true, ticks: { callback: (v) => formatLiters(v) } } },
        },
      });
  } else {
    destroyChart();
  }
};

// ─── Debounce helper ────────────────────────────────────────────────────────
const debounce = (fn, ms = 16) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};

/**
 * Renders a contextual summary banner on login showing urgent items.
 */
export const renderLoginSummary = () => {
  const container = $("#loginSummary");
  if (!container) return;
  
  const today = todayIso();
  const items = [];
  
  // Overdue medications
  state.medication.forEach((m) => {
    if (!m.administration_date) return;
    const reapply = getNextReapplyDate(m);
    if (!reapply) return;
    if (reapply.daysUntil < 0) {
      const animal = state.animals.find((a) => String(a.id) === String(m.cow_id));
      const name = animal?.identification || m.cow_id || "";
      items.push({ type: "overdue", text: `${m.medication_name} — ${name} (${Math.abs(reapply.daysUntil)} dia${Math.abs(reapply.daysUntil) === 1 ? "" : "s"} atrasado)`, icon: "🔴" });
    }
  });
  
  // Today's calvings
  state.breeding.forEach((b) => {
    if (b.expected_calving_date === today) {
      const animal = state.animals.find((a) => a.id === b.cow_id);
      items.push({ type: "today", text: `Parto previsto hoje: ${animal?.identification || b.cow_id}`, icon: "🐄" });
    }
  });
  
  // Low stock
  state.stockItems.forEach((item) => {
    const qty = Number(item.quantity || 0);
    const minQty = item.min_quantity === null || item.min_quantity === undefined ? null : Number(item.min_quantity);
    if (minQty !== null && qty <= minQty) {
      items.push({ type: "stock", text: `Estoque baixo: ${item.item_name} (${qty} restante${qty === 1 ? "" : "s"})`, icon: "📦" });
    }
  });
  
  // No milk registered today (after 8am)
  const hour = new Date().getHours();
  if (hour >= 8 && !state.milk.some((r) => r.date === today)) {
    items.push({ type: "milk", text: "Produção de leite de hoje não registrada", icon: "🥛" });
  }
  
  if (items.length === 0) {
    container.innerHTML = "";
    return;
  }
  
  container.innerHTML = `
    <div class="login-summary-banner">
      <div class="login-summary-header">
        <span class="login-summary-icon">📋</span>
        <strong>Resumo do dia</strong>
        <span class="login-summary-count">${items.length}</span>
      </div>
      <div class="login-summary-list">
        ${items.map((item) => `
          <div class="login-summary-item ${item.type}">
            <span>${item.icon}</span>
            <span>${escapeHtml(item.text)}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
};

// ─── Master render (debounced) ──────────────────────────────────────────────
let _renderScheduled = false;
let _pendingMedicationCowId = null;

const _doRender = () => {
  _renderScheduled = false;
  renderClientPanel();
  renderPriceQuote();
  renderSummary();
  renderMilk();
  renderAnimals();
  renderLactations();
  renderBreeding();
  renderMedication(_pendingMedicationCowId);
  renderCropEvents();
  renderStockItems();
  renderAlerts();
  renderReports();
};

export const render = (selectedMedicationCowId) => {
  _pendingMedicationCowId = selectedMedicationCowId ?? _pendingMedicationCowId;
  if (_renderScheduled) return;
  _renderScheduled = true;
  // Use requestAnimationFrame para batch de updates visuais
  if (typeof requestAnimationFrame !== "undefined") {
    requestAnimationFrame(_doRender);
  } else {
    setTimeout(_doRender, 0);
  }
};

// Versão debounce para chamadas externas que podem ser frecuentes
export const debouncedRender = debounce((selectedMedicationCowId) => {
  _pendingMedicationCowId = selectedMedicationCowId ?? _pendingMedicationCowId;
  _doRender();
}, 50);

// ─── Populate cow selects ───────────────────────────────────────────────────
export const populateCowSelects = () => {
  const options = state.animals.map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.identification)}</option>`).join("");
  ["#lactCowId", "#breedCowId", "#medCowId"].forEach((sel) => { const el = $(sel); if (el) el.innerHTML = options; });
  const medSelect = $("#medCowId");
  if (medSelect) {
    medSelect.innerHTML = getUniqueMedicationAnimals().map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.identification || a.id)}</option>`).join("");
  }
};
