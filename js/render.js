import { $, state, todayIso, monthKey, addDaysIso, parseIsoDate, userStorageKey, planPrice, trialDays, milkFilter, setMilkFilter } from "./state.js";
import { formatLiters, formatMoney, formatTasks, formatStockQuantity, formatDate, escapeHtml, empty, getProductionStatus, createStatusBadge, countUp } from "./ui.js";
import { animalLabel, cowIdKey, cowProfileKey, findRecord } from "./crud.js";
import { buildAlerts, alertStatusLabel, daysFromToday, diffDays, updateAlertsBadge } from "./alerts.js";
import { normalizeClientProfile, normalizeSubscription, writeLocal } from "./state.js";
import { supportWhatsapp, supportEmail } from "./state.js";
import { getProductionAnalysis, detectProductionAnomalies, getHerdAnalysis, getFinancialAnalysis, getFarmScore, forecastProduction } from "./analytics.js";
import { generateRecommendations, getRecommendationsSummary } from "./recommendations.js";
import { forecastStock, forecastLactation } from "./predictions.js";
import { contactUrl, supportUrl, subscribeUrl } from "./urls.js";
import { sumLiters, getMonthAverage, countLactating } from "./stats.js";
import { renderWeatherForecast as renderWeather, loadWeatherForecast } from "./weather.js";
import { renderReports as renderReportsModule } from "./reports.js";
import { renderSmartDashboard, renderProductionForecast, renderStockForecast, renderLactationForecast, renderRecommendations } from "./smart-dashboard.js";

// ─── Sparkline helper ──────────────────────────────────────────────────────
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
  cropGroupList: $("#cropGroupList"),
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
  document.querySelectorAll("#milkForm input, #milkForm button, #lactationForm input, #lactationForm select, #lactationForm button, #breedingForm input, #breedingForm select, #breedingForm button, #medicationForm input, #medicationForm select, #medicationForm button, #cropForm input, #cropForm select, #cropForm textarea, #cropForm button, #stockForm input, #stockForm select, #stockForm textarea, #stockForm button, #reminderForm input, #reminderForm select, #reminderForm textarea, #reminderForm button")
    .forEach((c) => { c.disabled = blocked; });
};

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
  if (el.priceQuoteDisplay) el.priceQuoteDisplay.textContent = `R$ ${formatted}/L`;
  if (el.priceQuoteValue) el.priceQuoteValue.textContent = `R$ ${formatted} por litro`;
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
  const last7Avg = last7.length > 0 ? sumLiters(last7) / last7.length : 0;

  const prev7 = milkData.slice(-14, -7);
  const prev7Avg = prev7.length > 0 ? sumLiters(prev7) / prev7.length : null;

  const last30Avg = last30.length > 0 ? sumLiters(last30) / last30.length : null;

  const prev30Avg = prev30.length > 0 ? sumLiters(prev30) / prev30.length : null;

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
  const totalMonth = sumLiters(last30);

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
  const todayLiters = sumLiters(todayRecords);
  if (el.todayTotal) {
    const currentVal = parseFloat(el.todayTotal.textContent) || 0;
    if (currentVal !== todayLiters) {
      countUp(el.todayTotal, todayLiters, { duration: 500, suffix: " L" });
    }
  }
  if (el.todayValue) el.todayValue.textContent = formatMoney(todayLiters * price);

  // Sparkline - últimos 7 dias
  const sparklineContainer = document.getElementById("sparklineContainer");
  if (sparklineContainer) {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = addDaysIso(today, -i);
      const dayRecords = state.milk.filter((r) => r.date === date);
      const dayLiters = sumLiters(dayRecords);
      last7Days.push(dayLiters);
    }
    sparklineContainer.innerHTML = generateSparkline(last7Days);
  }

  // Fortnight
  const fortnightRecords = state.milk.filter((r) => r.date && r.date >= fortnightStart && r.date <= today);
  const fortnightLiters = sumLiters(fortnightRecords);
  if (el.fortnightTotal) el.fortnightTotal.textContent = formatLiters(fortnightLiters);
  if (el.fortnightValue) el.fortnightValue.textContent = formatMoney(fortnightLiters * price);

  // Month
  const monthRecords = state.milk.filter((r) => r.date && r.date >= monthStart && r.date <= today);
  const monthLiters = sumLiters(monthRecords);
  if (el.monthTotal) el.monthTotal.textContent = formatLiters(monthLiters);
  if (el.monthValue) el.monthValue.textContent = formatMoney(monthLiters * price);

  // Animals
  if (el.animalTotal) el.animalTotal.textContent = String(state.animals.length);
  const lactating = countLactating();
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
  const monthAverage = getMonthAverage(state.milk);
  
  // ─── Cálculos do resumo do filtro ────────────────────────────────────────
  const totalLiters = sumLiters(records);
  const totalValue = totalLiters * price;
  
  // ─── Resumo do período filtrado ──────────────────────────────────────────
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

// ─── Animal Profile Modal ──────────────────────────────────────────────────
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

  // Fill title
  const titleEl = document.getElementById("animalProfileTitle");
  if (titleEl) titleEl.textContent = `Ficha: ${animal.identification}`;

  // Fill status badge
  const statusEl = document.getElementById("animalProfileStatus");
  if (statusEl) {
    statusEl.textContent = animal.status;
    statusEl.className = "status-badge";
  }

  // Fill breeding list
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

  // Fill health list
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

  // Fill additional info (type + active lactations)
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
    // Insert before first section-title
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

  // Open modal
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

const renderMedicalCowRecord = (profile, isExpanded) => {
  const records = profile.records;
  const last = records[0];
  const info = [profile.type, profile.status].filter(Boolean).join(" · ");
  return `
    <article class="med-animal-card${isExpanded ? " expanded" : ""}" data-medical-cow-id="${escapeHtml(profile.id)}">
      <div class="med-card-header">
        <div class="med-card-title">
          <h3>${escapeHtml(profile.label)}</h3>
          ${info ? `<small>${escapeHtml(info)}</small>` : ""}
        </div>
        <div class="med-card-meta">
          <span class="med-card-count">${records.length}</span>
          <span class="med-card-label">${records.length === 1 ? "registro" : "registros"}</span>
        </div>
      </div>
      <div class="med-card-summary">
        <span>${escapeHtml(last?.medication_name || "Sem medicação")}</span>
        <em>${escapeHtml(last ? formatDate(last.administration_date) : "")}</em>
      </div>
      <div class="med-card-history">${records.length ? records.map((r) => {
        const medName = r.medication_name ? r.medication_name.charAt(0).toUpperCase() + r.medication_name.slice(1) : "";
        const dosageDisplay = r.dosage ? (r.dosage + (r.dosage.match(/\s*(ml|mg|comprimido|frasco|g|L|%)/i) ? "" : " ml")) : "";
        return `<article class="item medical-history-item"><div><span>${escapeHtml(medName)}</span><small>${escapeHtml(formatDate(r.administration_date))}</small></div><strong>${escapeHtml(dosageDisplay)}</strong>${recordActions("medication", r)}</article>`;
      }).join("") : '<small class="med-card-empty">Nenhuma medicação registrada</small>'}</div>
    </article>`;
};



export const renderMedication = (selectedMedicationCowId) => {
  const profiles = getMedicationCowProfiles();
  const medCowSelect = $("#medCowId");
  if (!profiles.length) { el.medicationList.innerHTML = empty("Cadastre uma vaca para criar a ficha médica", "medication"); return; }
  if (selectedMedicationCowId && medCowSelect && Array.from(medCowSelect.options).some((o) => cowIdKey(o.value) === cowIdKey(selectedMedicationCowId))) medCowSelect.value = selectedMedicationCowId;
  el.medicationList.innerHTML = `<div class="med-cards-grid">${profiles.map((p) => {
    const isExpanded = selectedMedicationCowId && (p.ids || [p.id]).some((id) => cowIdKey(id) === cowIdKey(selectedMedicationCowId));
    return renderMedicalCowRecord(p, isExpanded);
  }).join("")}</div>`;
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

// ─── Crop Groups (Lavoura Individual com Dias de Vida) ─────────────────────
export const renderCropGroups = () => {
  if (!el.cropGroupList) return;

  const today = todayIso();
  const groups = new Map();

  state.cropEvents.forEach((r) => {
    const key = `${r.plot_name}|||${r.crop_name}`;
    if (!groups.has(key)) {
      groups.set(key, {
        plot_name: r.plot_name,
        crop_name: r.crop_name,
        crop_group: r.crop_group || "",
        events: [],
        plantingDate: null,
      });
    }
    const group = groups.get(key);
    group.events.push(r);
    if (r.event_type === "Plantio" && r.event_date) {
      if (!group.plantingDate || r.event_date < group.plantingDate) {
        group.plantingDate = r.event_date;
      }
    }
  });

  if (groups.size === 0) {
    el.cropGroupList.innerHTML = "";
    return;
  }

  const sortedGroups = [...groups.values()].sort((a, b) => {
    const dateA = a.plantingDate || "";
    const dateB = b.plantingDate || "";
    return dateB.localeCompare(dateA);
  });

  el.cropGroupList.innerHTML = sortedGroups.map((group) => {
    const daysAlive = group.plantingDate ? diffDays(group.plantingDate, today) : null;
    const groupBadge = group.crop_group
      ? `<span class="crop-group-badge">${escapeHtml(group.crop_group)}</span>`
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
          </div>
          <strong>${escapeHtml(formatTasks(r.area_tasks) || r.event_type)}</strong>
        </article>
      `).join("");

    return `
      <div class="crop-group-card" data-crop-group-key="${escapeHtml(group.plot_name + "|||" + group.crop_name)}">
        <div class="crop-group-header" role="button" tabindex="0" aria-expanded="false">
          <div class="crop-group-info">
            <div class="crop-group-title-row">
              <span class="crop-group-name">${escapeHtml(group.plot_name)}</span>
              <span class="crop-group-crop">${escapeHtml(group.crop_name)}</span>
            </div>
            <div class="crop-group-meta">
              ${groupBadge}
              <span class="crop-event-count">${group.events.length} evento${group.events.length === 1 ? "" : "s"}</span>
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

// ─── Reports ────────────────────────────────────────────────────────────────
export const renderReports = () => renderReportsModule(el);

// ─── Debounce helper ────────────────────────────────────────────────────────
const debounce = (fn, ms = 16) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};

// ─── Master render (debounced) ──────────────────────────────────────────────
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
  renderLactationForecast();
  renderAlerts();
  updateAlertsBadge();
  renderRecommendations();
  renderReports();
  renderProductionForecast();
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
