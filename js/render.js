import { $, state, todayIso, monthKey, addDaysIso, parseIsoDate, userStorageKey, planPrice, trialDays, milkFilter, setMilkFilter } from "./state.js";
import { formatLiters, formatMoney, formatTasks, formatStockQuantity, formatDate, escapeHtml, empty, getProductionStatus, createStatusBadge, countUp } from "./ui.js";
import { animalLabel, cowIdKey, cowProfileKey, findRecord } from "./crud.js";
import { buildAlerts, alertStatusLabel, daysFromToday, getNextReapplyDate, countMedicationAlerts, diffDays, updateAlertsBadge } from "./alerts.js";
import { normalizeClientProfile, normalizeSubscription, writeLocal } from "./state.js";
import { supportWhatsapp, supportEmail } from "./state.js";
import { getProductionAnalysis, detectProductionAnomalies, getHerdAnalysis, getFinancialAnalysis, getFarmScore, forecastProduction } from "./analytics.js";
import { generateRecommendations, getRecommendationsSummary } from "./recommendations.js";
import { forecastStock, forecastMedication, forecastLactation } from "./predictions.js";

const generateSparkline = (data, width = 80, height = 28) => {
  if (!data.length || data.every((v) => v === 0)) return "";
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1 || 1);
  
  const points = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  
  const lastY = height - ((data[data.length - 1] - min) / range) * (height - 4) - 2;
  const areaPoints = `0,${height} ${points} ${width},${height}`;
  
  const trend = data[data.length - 1] >= data[0];
  const color = trend ? "#10b981" : "#ef4444";
  const colorLight = trend ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)";
  
  return `<svg class="sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
    <polygon points="${areaPoints}" fill="${colorLight}" />
    <polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="${width}" cy="${lastY}" r="2" fill="${color}" />
  </svg>`;
};

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
  cropGroupList: $("#cropGroupList"),
  cropStats: $("#cropStats"),
  cropGroupFilter: $("#cropGroupFilter"),
  stockList: $("#stockList"),
  alertList: $("#alertList"),
  milkForm: $("#milkForm"),
  milkDate: $("#milkDate"),
  milkCustomPeriod: $("#milkCustomPeriod"),
  milkDateStart: $("#milkDateStart"),
  milkDateEnd: $("#milkDateEnd"),
  animalForm: null,
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
  document.querySelectorAll("#milkForm input, #milkForm button, #lactationForm input, #lactationForm select, #lactationForm button, #breedingForm input, #breedingForm select, #breedingForm button, #medicationForm input, #medicationForm select, #medicationForm button, #cropForm input, #cropForm select, #cropForm textarea, #cropForm button, #stockForm input, #stockForm select, #stockForm textarea, #stockForm button, #reminderForm input, #reminderForm select, #reminderForm textarea, #reminderForm button")
    .forEach((c) => { c.disabled = blocked; });
};

const contactUrl = (message, subject = "Suporte Terrasyn") => {
  const encoded = encodeURIComponent(message);
  if (supportWhatsapp) return `https://wa.me/${supportWhatsapp}?text=${encoded}`;
  if (supportEmail) return `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encoded}`;
  return "privacy.html#contato";
};
const supportUrl = () => contactUrl("Olá, preciso de suporte no Terrasyn.");
const subscribeUrl = () => contactUrl(`Olá, quero assinar o Terrasyn. Plano: ${formatMoney(planPrice)}/mês.`, "Assinatura Terrasyn");

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
  if (el.priceQuoteDisplay) el.priceQuoteDisplay.textContent = `R$ ${formatted}/L`;
  if (el.priceQuoteValue) el.priceQuoteValue.textContent = `R$ ${formatted} por litro`;
};

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

  const todayRecords = state.milk.filter((r) => r.date === today);
  const todayLiters = todayRecords.reduce((sum, r) => sum + Number(r.liters || 0), 0);
  if (el.todayTotal) {
    const currentVal = parseFloat(el.todayTotal.textContent) || 0;
    if (currentVal !== todayLiters) {
      countUp(el.todayTotal, todayLiters, { duration: 500, suffix: " L" });
    }
  }
  if (el.todayValue) el.todayValue.textContent = formatMoney(todayLiters * price);

  const sparklineContainer = document.getElementById("sparklineContainer");
  if (sparklineContainer) {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = addDaysIso(today, -i);
      const dayRecords = state.milk.filter((r) => r.date === date);
      const dayLiters = dayRecords.reduce((sum, r) => sum + Number(r.liters || 0), 0);
      last7Days.push(dayLiters);
    }
    sparklineContainer.innerHTML = generateSparkline(last7Days);
  }

  const fortnightRecords = state.milk.filter((r) => r.date && r.date >= fortnightStart && r.date <= today);
  const fortnightLiters = fortnightRecords.reduce((sum, r) => sum + Number(r.liters || 0), 0);
  if (el.fortnightTotal) el.fortnightTotal.textContent = formatLiters(fortnightLiters);
  if (el.fortnightValue) el.fortnightValue.textContent = formatMoney(fortnightLiters * price);

  const monthRecords = state.milk.filter((r) => r.date && r.date >= monthStart && r.date <= today);
  const monthLiters = monthRecords.reduce((sum, r) => sum + Number(r.liters || 0), 0);
  if (el.monthTotal) el.monthTotal.textContent = formatLiters(monthLiters);
  if (el.monthValue) el.monthValue.textContent = formatMoney(monthLiters * price);

  if (el.animalTotal) el.animalTotal.textContent = String(state.animals.length);
  const lactating = state.animals.filter((a) => a.status === "Em lactação").length;
  if (el.lactatingTotal) el.lactatingTotal.textContent = `${lactating} em lactação`;

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

export const renderMilk = () => {
  const price = Number(state.priceQuote || 0);
  const today = todayIso();
  
  let filteredRecords = [...state.milk];
  let periodLabel = "";
  
  const dayOfMonth = new Date().getDate();
  
  if (milkFilter.period === "today") {
    filteredRecords = filteredRecords.filter((r) => r.date === today);
    periodLabel = `Hoje (${formatDate(today)})`;
  } else if (milkFilter.period === "fortnight") {
    const fortnightStart = dayOfMonth <= 15 ? `${monthKey()}-01` : `${monthKey()}-16`;
    filteredRecords = filteredRecords.filter((r) => r.date >= fortnightStart && r.date <= today);
    periodLabel = `Quinzena (${formatDate(fortnightStart)} a ${formatDate(today)})`;
  } else if (milkFilter.period === "month") {
    const monthStart = today.slice(0, 7) + "-01";
    filteredRecords = filteredRecords.filter((r) => r.date >= monthStart && r.date <= today);
    periodLabel = `Mês (${formatDate(monthStart)} a ${formatDate(today)})`;
  } else if (milkFilter.period === "custom" && milkFilter.startDate && milkFilter.endDate) {
    filteredRecords = filteredRecords.filter((r) => r.date >= milkFilter.startDate && r.date <= milkFilter.endDate);
    periodLabel = `Personalizado (${formatDate(milkFilter.startDate)} a ${formatDate(milkFilter.endDate)})`;
  }
  
  const records = filteredRecords.sort((a, b) => b.date.localeCompare(a.date));
  const monthRecords = state.milk.filter((r) => r.date?.startsWith(monthKey()));
  const monthAverage = monthRecords.length ? monthRecords.reduce((sum, r) => sum + Number(r.liters || 0), 0) / monthRecords.length : 0;
  
  const totalLiters = records.reduce((sum, r) => sum + Number(r.liters || 0), 0);
  const totalValue = totalLiters * price;
  
  const summaryHtml = `<div class="milk-filter-summary">
    <span class="milk-filter-label">${escapeHtml(periodLabel)}</span>
    <span class="milk-filter-stats">${records.length} registro${records.length !== 1 ? "s" : ""} | ${escapeHtml(formatLiters(totalLiters))} | ${escapeHtml(formatMoney(totalValue))}</span>
  </div>`;
  
  el.historyList.innerHTML = summaryHtml + (records.length
    ? records.map((r) => {
      const ps = getProductionStatus(Number(r.liters || 0), monthAverage);
      return `<article class="item" data-milk-id="${escapeHtml(r.id)}"><div><div class="item-title-row"><span>${escapeHtml(formatDate(r.date))}</span>${createStatusBadge(ps)}</div><small>${escapeHtml(formatMoney(price))} por litro</small></div><strong>${escapeHtml(formatLiters(r.liters))} | ${escapeHtml(formatMoney(Number(r.liters) * price))}</strong>${recordActions("milk", r)}</article>`;
    }).join("")
    : empty("Nenhuma produção registrada para este período", "milk"));
};

export const renderAnimals = () => {
  el.animalList.innerHTML = state.animals.length
    ? state.animals.map((a) => {
      const weightInfo = a.weight ? ` | ${a.weight} kg` : "";
      return `<article class="item animal-card" data-animal-id="${escapeHtml(a.id)}"><div><span>${escapeHtml(a.identification)}</span><small>${escapeHtml(a.type)}${escapeHtml(weightInfo)}</small></div><strong>${escapeHtml(a.status)}</strong>${recordActions("animal", a)}</article>`;
    }).join("")
    : empty("Nenhum animal cadastrado", "animal");
};

export const openAnimalProfile = (animalId) => {
  const animal = state.animals.find((a) => String(a.id) === String(animalId));
  if (!animal) return;

  const breedingRecords = state.breeding
    .filter((r) => String(r.cow_id) === String(animalId))
    .sort((a, b) => String(b.insemination_date || "").localeCompare(String(a.insemination_date || "")));

  const healthRecords = state.medication
    .filter((r) => String(r.cow_id) === String(animalId))
    .sort((a, b) => String(b.administration_date || "").localeCompare(String(a.administration_date || "")));

  const activeLactations = state.lactations.filter(
    (r) => String(r.cow_id) === String(animalId) && !r.end_date
  );

  const titleEl = document.getElementById("animalProfileTitle");
  if (titleEl) titleEl.textContent = `Ficha: ${animal.identification}`;

  const statusEl = document.getElementById("animalProfileStatus");
  if (statusEl) {
    statusEl.textContent = animal.status;
    statusEl.className = "status-badge";
  }

  const breedingListEl = document.getElementById("profileBreedingList");
  if (breedingListEl) {
    if (breedingRecords.length === 0) {
      breedingListEl.innerHTML = '<div class="empty-profile-section">Nenhum registro reprodutivo</div>';
    } else {
      breedingListEl.innerHTML = breedingRecords.map((r) => `
        <article class="item compact-profile-item">
          <div>
            <span>${escapeHtml(formatDate(r.insemination_date))}</span>
            <small>Inseminação</small>
          </div>
          <strong>Parto: ${escapeHtml(formatDate(r.expected_calving_date))}</strong>
        </article>
      `).join("");
    }
  }

  const healthListEl = document.getElementById("profileHealthList");
  if (healthListEl) {
    if (healthRecords.length === 0) {
      healthListEl.innerHTML = '<div class="empty-profile-section">Nenhum registro de saúde</div>';
    } else {
      healthListEl.innerHTML = healthRecords.map((r) => {
        const medName = r.medication_name ? r.medication_name.charAt(0).toUpperCase() + r.medication_name.slice(1) : "";
        const dosageDisplay = r.dosage ? (r.dosage + (r.dosage.match(/\s*(ml|mg|comprimido|frasco|g|L|%)/i) ? "" : " ml")) : "Sem dosagem";
        return `
        <article class="item compact-profile-item">
          <div>
            <span>${escapeHtml(medName)}</span>
            <small>${escapeHtml(formatDate(r.administration_date))}</small>
          </div>
          <strong>${escapeHtml(dosageDisplay)}</strong>
        </article>`;
      }).join("");
    }
  }

  const contentEl = document.querySelector("#animalProfileModal .profile-content");
  if (contentEl) {
    let infoHtml = `
      <div class="profile-info-row">
        <span class="profile-info-label">Tipo</span>
        <span class="profile-info-value">${escapeHtml(animal.type)}</span>
      </div>
    `;
    if (activeLactations.length > 0) {
      infoHtml += `
        <div class="profile-info-row">
          <span class="profile-info-label">Lactações ativas</span>
          <span class="profile-info-value">${escapeHtml(String(activeLactations.length))} — ${activeLactations.map((l) => escapeHtml(formatLiters(l.daily_liters)) + "/dia").join(", ")}</span>
        </div>
      `;
    }
    const firstSection = contentEl.querySelector(".section-title");
    if (firstSection) {
      let infoContainer = contentEl.querySelector(".profile-info-container");
      if (!infoContainer) {
        infoContainer = document.createElement("div");
        infoContainer.className = "profile-info-container";
        contentEl.insertBefore(infoContainer, firstSection);
      }
      infoContainer.innerHTML = infoHtml;
    }
  }

  const modal = document.getElementById("animalProfileModal");
  if (modal) modal.classList.remove("hidden");
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
      <div class="medical-history">${records.length ? records.map((r, i) => { const medName = r.medication_name ? r.medication_name.charAt(0).toUpperCase() + r.medication_name.slice(1) : ""; const dosageDisplay = r.dosage ? (r.dosage + (r.dosage.match(/\s*(ml|mg|comprimido|frasco|g|L|%)/i) ? "" : " ml")) : "Sem dosagem"; return `<article class="item medical-history-item"><div><span>${escapeHtml(medName)}</span><small>${escapeHtml(formatDate(r.administration_date))}</small></div><strong>${escapeHtml(dosageDisplay)}</strong>${recordActions("medication", r)}</article>`; }).join("") : empty("Nenhuma medicação registrada para esta vaca", "medication")}</div>
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
    if (daysUntil === null || daysUntil < 0 || daysUntil > 14) return;
    
    const animal = state.animals.find((a) => String(a.id) === String(m.cow_id));
    const animalName = animal?.identification || m.cow_id || "";
    
    let urgencyClass = "upcoming";
    let dueLabel = "";
    if (daysUntil === 0) {
      urgencyClass = "today";
      dueLabel = "Reaplicar hoje";
    } else if (daysUntil === 1) {
      urgencyClass = "soon";
      dueLabel = "Reaplicar amanhã";
    } else if (daysUntil <= 3) {
      urgencyClass = "soon";
      dueLabel = `Reaplicar em ${daysUntil} dias`;
    } else {
      dueLabel = `Reaplicar em ${daysUntil} dias`;
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

export const detectChronicTreatments = () => {
  const today = todayIso();
  const thirtyDaysAgo = addDaysIso(today, -30);
  const chronicAlerts = [];
  
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

let cropGroupFilter = "Todas";
export const setCropGroupFilter = (value) => { cropGroupFilter = value || "Todas"; };

const CROP_GROUP_CLASS = {
  "Milho/Sorgo": "crop-tag-milho",
  "Palma Forrageira": "crop-tag-palma",
  "Outra": "crop-tag-outra",
};

const buildCropGroupsMap = () => {
  const groups = new Map();
  state.cropEvents.forEach((r) => {
    const cropGroup = r.crop_group || "Milho/Sorgo";
    const key = `${cropGroup}|||${r.plot_name}|||${r.crop_name}`;
    if (!groups.has(key)) {
      groups.set(key, {
        plot_name: r.plot_name,
        crop_name: r.crop_name,
        crop_group: cropGroup,
        events: [],
        plantingDate: null,
        lastEventDate: null,
      });
    }
    const group = groups.get(key);
    group.events.push(r);
    if (r.event_type === "Plantio" && r.event_date) {
      if (!group.plantingDate || r.event_date < group.plantingDate) group.plantingDate = r.event_date;
    }
    if (r.event_date && (!group.lastEventDate || r.event_date > group.lastEventDate)) group.lastEventDate = r.event_date;
  });
  return groups;
};

export const renderCropStats = () => {
  if (!el.cropStats) return;
  const today = todayIso();
  const groups = buildCropGroupsMap();
  const totalLavouras = groups.size;
  const monthRecords = state.cropEvents.filter((r) => String(r.event_date || "").startsWith(monthKey()));
  const stale = [...groups.values()].filter((g) => g.lastEventDate && diffDays(g.lastEventDate, today) > 15).length;
  const lastEvent = [...state.cropEvents].sort((a, b) => String(b.event_date || "").localeCompare(String(a.event_date || "")))[0];

  const cards = [
    { label: "Lavouras ativas", value: totalLavouras, icon: "&#127793;" },
    { label: "Eventos este mês", value: monthRecords.length, icon: "&#128197;" },
    { label: "Sem atividade +15 dias", value: stale, icon: "&#9888;&#65039;", warn: stale > 0 },
    { label: "Última atividade", value: lastEvent ? formatDate(lastEvent.event_date) : "—", icon: "&#128338;" },
  ];

  el.cropStats.innerHTML = cards.map((c) => `
    <div class="crop-stat-card ${c.warn ? "crop-stat-warn" : ""}">
      <span class="crop-stat-icon">${c.icon}</span>
      <div>
        <strong>${escapeHtml(String(c.value))}</strong>
        <small>${escapeHtml(c.label)}</small>
      </div>
    </div>
  `).join("");
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

export const renderCropGroups = () => {
  if (!el.cropGroupList) return;

  renderCropStats();

  const today = todayIso();
  const groups = buildCropGroupsMap();

  if (groups.size === 0) {
    el.cropGroupList.innerHTML = empty("Nenhuma lavoura cadastrada ainda. Adicione o primeiro manejo acima.", "crop");
    return;
  }

  let filtered = [...groups.values()];
  if (cropGroupFilter && cropGroupFilter !== "Todas") filtered = filtered.filter((g) => g.crop_group === cropGroupFilter);

  if (filtered.length === 0) {
    el.cropGroupList.innerHTML = empty(`Nenhuma lavoura em "${cropGroupFilter}"`, "crop");
    return;
  }

  const sortedGroups = filtered.sort((a, b) => {
    const dateA = a.plantingDate || a.lastEventDate || "";
    const dateB = b.plantingDate || b.lastEventDate || "";
    return dateB.localeCompare(dateA);
  });

  el.cropGroupList.innerHTML = sortedGroups.map((group) => {
    const daysAlive = group.plantingDate ? diffDays(group.plantingDate, today) : null;
    const daysSinceLast = group.lastEventDate ? diffDays(group.lastEventDate, today) : null;
    const isStale = daysSinceLast !== null && daysSinceLast > 15;
    const groupTagClass = CROP_GROUP_CLASS[group.crop_group] || "crop-tag-outra";
    const groupBadge = `<span class="crop-group-badge ${groupTagClass}">${escapeHtml(group.crop_group)}</span>`;
    const attentionBadge = isStale
      ? `<span class="crop-attention-badge">&#9888;&#65039; ${daysSinceLast} dias sem atividade</span>`
      : "";
    const daysDisplay = daysAlive !== null
      ? `<span class="crop-days-number">${daysAlive}</span><span class="crop-days-label">dias</span>`
      : `<span class="crop-days-number">—</span>`;

    const eventsList = group.events
      .sort((a, b) => String(b.event_date || "").localeCompare(String(a.event_date || "")))
      .map((r) => `
        <article class="item crop-event-item">
          <div>
            <span>${escapeHtml(r.event_type)}</span>
            <small>${escapeHtml(formatDate(r.event_date))}${r.product ? ` | ${escapeHtml(r.product)}` : ""}${r.dosage ? ` | ${escapeHtml(r.dosage)}` : ""}</small>
            ${r.notes ? `<small>${escapeHtml(r.notes)}</small>` : ""}
          </div>
          <strong>${escapeHtml(formatTasks(r.area_tasks) || r.event_type)}</strong>
          ${recordActions("crop", r)}
        </article>
      `).join("");

    return `
      <div class="crop-group-card ${isStale ? "crop-group-card-stale" : ""}" data-crop-group-key="${escapeHtml(group.plot_name + "|||" + group.crop_name)}">
        <div class="crop-group-header" role="button" tabindex="0" aria-expanded="false">
          <div class="crop-group-info">
            <div class="crop-group-title-row">
              <span class="crop-group-name">${escapeHtml(group.plot_name)}</span>
              <span class="crop-group-crop">${escapeHtml(group.crop_name)}</span>
            </div>
            <div class="crop-group-meta">
              ${groupBadge}
              <span class="crop-event-count">${group.events.length} evento${group.events.length === 1 ? "" : "s"}</span>
              ${attentionBadge}
            </div>
          </div>
          <div class="crop-group-days">
            ${daysDisplay}
          </div>
          <span class="crop-group-chevron" aria-hidden="true">&#9662;</span>
        </div>
        <div class="crop-group-events hidden">
          ${eventsList}
        </div>
      </div>
    `;
  }).join("");
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

const WEATHER_CACHE_KEY = "last_weather_forecast";
const CACHE_TTL_MS = 30 * 60 * 1000;

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

  const cached = localStorage.getItem(WEATHER_CACHE_KEY);
  if (cached) {
    try {
      const cacheData = JSON.parse(cached);
      if (cacheData.city === city && cacheData.data && cacheData.timestamp) {
        const isCacheFresh = (Date.now() - cacheData.timestamp) < CACHE_TTL_MS;
        if (!navigator.onLine || isCacheFresh) {
          renderWeatherForecast(cacheData.data);
          const updated = new Date(cacheData.timestamp);
          const timeStr = updated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          const dateStr = updated.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
          if (el.weatherForecast) {
            const header = el.weatherForecast.querySelector(".weather-header small");
            if (header) header.textContent = `${escapeHtml(cacheData.data.source || "Open-Meteo")} (Atualizado: ${dateStr} ${timeStr})`;
          }
          if (!navigator.onLine) return;
        }
      }
    } catch { }
  }

  el.weatherForecast.innerHTML = `
    <div class="weather-header skeleton skeleton-card">
      <span>Previsão do tempo</span>
      <strong>Carregando...</strong>
    </div>
    <div class="weather-grid">
      ${[1,2,3].map(() => '<article class="weather-day skeleton skeleton-card"><span>&nbsp;</span><strong>&nbsp;</strong><small>&nbsp;</small></article>').join('')}
    </div>`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(`/api/weather?city=${encodeURIComponent(city)}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "Nao foi possivel buscar a previsao.");
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ city, data, timestamp: Date.now() }));
    localStorage.setItem(userStorageKey("weather_city"), city);
    renderWeatherForecast(data);
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Tempo limite excedido. Verifique sua conexão.");
    }
    if (cached) {
      try {
        const cacheData = JSON.parse(cached);
        if (cacheData.city === city && cacheData.data) {
          renderWeatherForecast(cacheData.data);
          return;
        }
      } catch { }
    }
    throw err;
  }
};

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

const debounce = (fn, ms = 16) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};

export const renderSmartDashboard = () => {
  const container = $("#smartDashboard");
  if (!container) return;

  const farmScore = getFarmScore();
  const production = getProductionAnalysis(14);
  const herd = getHerdAnalysis();
  const financial = getFinancialAnalysis();
  const anomalies = detectProductionAnomalies();
  const recommendations = getRecommendationsSummary();
  const forecast = forecastProduction(7);

  const scoreColor = farmScore.score >= 80 ? "excellent" : farmScore.score >= 60 ? "good" : farmScore.score >= 40 ? "regular" : "attention";

  const trendIcon = production.hasData
    ? production.trendDirection === "up" ? "📈" : production.trendDirection === "down" ? "📉" : "➡️"
    : "📊";

  container.innerHTML = `
    <div class="smart-dashboard">
      <div class="smart-card farm-score-card ${scoreColor}">
        <div class="smart-card-header">
          <span class="smart-icon">🎯</span>
          <strong>Score da Fazenda</strong>
        </div>
        <div class="score-display">
          <span class="score-number">${farmScore.score}</span>
          <span class="score-label">${escapeHtml(farmScore.label)}</span>
        </div>
        <small>${escapeHtml(production.hasData ? `${trendIcon} Tendência ${production.trendDirection === "up" ? "de alta" : production.trendDirection === "down" ? "de queda" : "estável"}` : "Colete mais dados para análise")}</small>
      </div>

      <div class="smart-card">
        <div class="smart-card-header">
          <span class="smart-icon">🥛</span>
          <strong>Produção</strong>
        </div>
        <div class="kpi-grid">
          <div class="kpi">
            <small>Média 7 dias</small>
            <strong>${production.hasData ? formatLiters(production.last7Avg) : "-"}</strong>
          </div>
          <div class="kpi">
            <small>Consistência</small>
            <strong>${production.hasData ? Math.round(production.consistency) + "%" : "-"}</strong>
          </div>
          <div class="kpi">
            <small>Previsão 7d</small>
            <strong>${forecast.length ? formatLiters(forecast.reduce((s, f) => s + f.predicted, 0) / 7) + "/dia" : "-"}</strong>
          </div>
          <div class="kpi">
            <small>Melhor dia</small>
            <strong>${production.bestDay ? formatDate(production.bestDay.date) : "-"}</strong>
          </div>
        </div>
        ${production.trendPercent !== 0 ? `
          <div class="trend-badge ${production.trendDirection}">
            ${production.trendDirection === "up" ? "↑" : "↓"} ${Math.abs(production.trendPercent)}% vs semana anterior
          </div>
        ` : ""}
      </div>

      <div class="smart-card">
        <div class="smart-card-header">
          <span class="smart-icon">🐄</span>
          <strong>Rebanho</strong>
        </div>
        <div class="kpi-grid">
          <div class="kpi">
            <small>Total</small>
            <strong>${herd.total}</strong>
          </div>
          <div class="kpi">
            <small>Lactação</small>
            <strong>${herd.lactating} (${herd.lactatingPercent}%)</strong>
          </div>
          <div class="kpi">
            <small>Gestantes</small>
            <strong>${herd.pregnant}</strong>
          </div>
          <div class="kpi">
            <small>Partos 30d</small>
            <strong>${herd.calvings30d}</strong>
          </div>
        </div>
        ${herd.healthScore < 80 ? `
          <div class="health-badge warning">
            🩺 Saúde: ${herd.healthScore}/100
          </div>
        ` : `
          <div class="health-badge good">
            ✅ Saúde: ${herd.healthScore}/100
          </div>
        `}
      </div>

      <div class="smart-card">
        <div class="smart-card-header">
          <span class="smart-icon">💰</span>
          <strong>Financeiro</strong>
        </div>
        <div class="kpi-grid">
          <div class="kpi">
            <small>Receita mês</small>
            <strong>${formatMoney(financial.monthValue)}</strong>
          </div>
          <div class="kpi">
            <small>Previsão</small>
            <strong>${formatMoney(financial.projectedMonthValue)}</strong>
          </div>
          <div class="kpi">
            <small>Média/dia</small>
            <strong>${formatMoney(financial.dailyAvg * financial.price)}</strong>
          </div>
          <div class="kpi">
            <small>Por animal</small>
            <strong>${formatMoney(financial.revenuePerCow)}</strong>
          </div>
        </div>
      </div>

      ${anomalies.length > 0 ? `
        <div class="smart-card anomaly-card">
          <div class="smart-card-header">
            <span class="smart-icon">⚠️</span>
            <strong>Anomalias Detectadas</strong>
            <span class="anomaly-count">${anomalies.length}</span>
          </div>
          <div class="anomaly-list">
            ${anomalies.map((a) => `
              <div class="anomaly-item ${a.severity}">
                <span class="anomaly-icon">${a.severity === "critical" ? "🔴" : a.severity === "warning" ? "🟡" : "ℹ️"}</span>
                <span>${escapeHtml(a.message)}</span>
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}

      ${recommendations.total > 0 ? `
        <div class="smart-card recommendations-card">
          <div class="smart-card-header">
            <span class="smart-icon">💡</span>
            <strong>Recomendações</strong>
            <span class="recommendation-count">${recommendations.total}</span>
          </div>
          <div class="recommendation-list">
            ${recommendations.top3.map((r) => `
              <div class="recommendation-item ${r.priority}">
                <span class="rec-icon">${r.icon}</span>
                <div class="rec-content">
                  <strong>${escapeHtml(r.title)}</strong>
                  <small>${escapeHtml(r.message)}</small>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}
    </div>
  `;
};

export const renderProductionForecast = () => {
  const container = $("#forecastPanel");
  if (!container) return;

  const forecast = forecastProduction(7);
  if (forecast.length === 0) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <div class="forecast-panel">
      <div class="forecast-header">
        <span>🔮</span>
        <strong>Previsão de Produção (7 dias)</strong>
      </div>
      <div class="forecast-grid">
        ${forecast.map((f) => {
          const confClass = f.confidence === "high" ? "high" : f.confidence === "medium" ? "medium" : "low";
          return `
            <div class="forecast-day">
              <small>${escapeHtml(formatDate(f.date))}</small>
              <strong>${formatLiters(f.predicted)}</strong>
              <span class="confidence ${confClass}">${f.confidence === "high" ? "Alta" : f.confidence === "medium" ? "Média" : "Baixa"}</span>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
};

export const renderRecommendations = () => {
  const container = $("#recommendationList");
  if (!container) return;

  const all = generateRecommendations();
  if (all.length === 0) {
    container.innerHTML = `<div class="empty-recommendations"><span>✅</span><p>Nenhuma recomendação no momento — tudo sob controle!</p></div>`;
    return;
  }

  container.innerHTML = all.map((r) => `
    <div class="recommendation-card ${r.priority}">
      <div class="rec-header">
        <span class="rec-icon">${r.icon}</span>
        <div class="rec-title">
          <strong>${escapeHtml(r.title)}</strong>
          <span class="rec-type">${escapeHtml(r.type)}</span>
        </div>
        <span class="rec-priority ${r.priority}">${r.priority}</span>
      </div>
      <p class="rec-message">${escapeHtml(r.message)}</p>
      ${r.action ? `<button class="rec-action" type="button">${escapeHtml(r.action)}</button>` : ""}
    </div>
  `).join("");
};

export const renderStockForecast = () => {
  const container = $("#stockForecastPanel");
  if (!container) return;

  const stock = forecastStock();
  const urgentItems = stock.filter((s) => s.recommendation?.type === "critical" || s.recommendation?.type === "warning");

  if (urgentItems.length === 0) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <div class="stock-forecast-panel">
      <div class="forecast-header">
        <span>📦</span>
        <strong>Estoque — Atenção Necessária</strong>
      </div>
      <div class="stock-forecast-list">
        ${urgentItems.map((s) => `
          <div class="stock-forecast-item ${s.recommendation?.type}">
            <div class="stock-info">
              <strong>${escapeHtml(s.item_name)}</strong>
              <small>${escapeHtml(s.recommendation?.message || "")}</small>
            </div>
            <div class="stock-qty">
              <span>${formatStockQuantity(s.currentQty, s.unit)}</span>
              ${s.daysUntilEmpty !== null ? `<small>~${s.daysUntilEmpty} dias</small>` : ""}
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
};

export const renderMedicationForecast = () => {
  const container = $("#medicationForecastPanel");
  if (!container) return;

  const forecast = forecastMedication();
  const urgent = forecast.filter((f) => f.urgency === "overdue" || f.urgency === "urgent");

  if (urgent.length === 0) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <div class="medication-forecast-panel">
      <div class="forecast-header">
        <span>💊</span>
        <strong>Medicação — Próximas Reaplicações</strong>
      </div>
      <div class="medication-forecast-list">
        ${urgent.map((f) => `
          <div class="medication-forecast-item ${f.urgency}">
            <div class="med-info">
              <strong>${escapeHtml(f.medication_name)}</strong>
              <small>${escapeHtml(f.cow_name)}</small>
            </div>
            <div class="med-due">
              <span>${f.daysUntil < 0 ? `${Math.abs(f.daysUntil)}d atrasado` : f.daysUntil === 0 ? "Hoje" : `${f.daysUntil}d`}</span>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
};

export const renderLactationForecast = () => {
  const container = $("#lactationForecastPanel");
  if (!container) return;

  const lactations = forecastLactation();
  const alerts = lactations.filter((l) => l.isLongLactation || l.recommendation);

  if (alerts.length === 0) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <div class="lactation-forecast-panel">
      <div class="forecast-header">
        <span>🐄</span>
        <strong>Lactação — Atenção</strong>
      </div>
      <div class="lactation-forecast-list">
        ${alerts.map((l) => `
          <div class="lactation-forecast-item ${l.isLongLactation ? "critical" : "warning"}">
            <div class="lact-info">
              <strong>${escapeHtml(l.cow_name)}</strong>
              <small>${l.daysActive} dias em lactação — ${escapeHtml(l.productivityPhase)}</small>
            </div>
            ${l.recommendation ? `<div class="lact-rec"><small>${escapeHtml(l.recommendation)}</small></div>` : ""}
          </div>
        `).join("")}
      </div>
    </div>
  `;
};

let _renderScheduled = false;
let _pendingMedicationCowId = null;

const _doRender = () => {
  _renderScheduled = false;
  renderClientPanel();
  renderPriceQuote();
  renderSummary();
  renderSmartDashboard();
  renderMilk();
  renderAnimals();
  renderLactations();
  renderBreeding();
  renderMedication(_pendingMedicationCowId);
  renderCropEvents();
  renderCropGroups();
  renderStockItems();
  renderStockForecast();
  renderMedicationForecast();
  renderLactationForecast();
  renderAlerts();
  updateAlertsBadge();
  renderRecommendations();
  renderReports();
  renderProductionForecast();
  updateHealthBadges();
};

export const render = (selectedMedicationCowId) => {
  _pendingMedicationCowId = selectedMedicationCowId ?? _pendingMedicationCowId;
  if (_renderScheduled) return;
  _renderScheduled = true;
  if (typeof requestAnimationFrame !== "undefined") {
    requestAnimationFrame(_doRender);
  } else {
    setTimeout(_doRender, 0);
  }
};

export const debouncedRender = debounce((selectedMedicationCowId) => {
  _pendingMedicationCowId = selectedMedicationCowId ?? _pendingMedicationCowId;
  _doRender();
}, 50);

export const populateCowSelects = () => {
  const options = state.animals.map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.identification)}</option>`).join("");
  ["#lactCowId", "#breedCowId", "#medCowId"].forEach((sel) => { const el = $(sel); if (el) el.innerHTML = options; });
  const medSelect = $("#medCowId");
  if (medSelect) {
    medSelect.innerHTML = getUniqueMedicationAnimals().map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.identification || a.id)}</option>`).join("");
  }
};

export const updateHealthBadges = () => {
  const reapplyBadge = $("#reapplyBadge");
  const chronicBadge = $("#chronicBadge");
  
  if (reapplyBadge) {
    const upcomingCount = document.querySelectorAll("#upcomingReapply .upcoming-reapply-item").length;
    if (upcomingCount > 0) {
      reapplyBadge.textContent = upcomingCount;
      reapplyBadge.classList.remove("hidden");
    } else {
      reapplyBadge.classList.add("hidden");
    }
  }
  
  if (chronicBadge) {
    const chronicCount = document.querySelectorAll("#chronicTreatments .chronic-item").length;
    if (chronicCount > 0) {
      chronicBadge.textContent = chronicCount;
      chronicBadge.classList.remove("hidden");
    } else {
      chronicBadge.classList.add("hidden");
    }
  }
};
