import { $ } from "./state.js";
import { formatLiters, formatMoney, formatDate, escapeHtml, formatStockQuantity } from "./ui.js";
import { getFarmScore, getProductionAnalysis, getHerdAnalysis, getFinancialAnalysis, detectProductionAnomalies, forecastProduction } from "./analytics.js";
import { getRecommendationsSummary, generateRecommendations } from "./recommendations.js";
import { forecastStock, forecastLactation } from "./predictions.js";

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
          <div class="kpi"><small>Média 7 dias</small><strong>${production.hasData ? formatLiters(production.last7Avg) : "-"}</strong></div>
          <div class="kpi"><small>Consistência</small><strong>${production.hasData ? Math.round(production.consistency) + "%" : "-"}</strong></div>
          <div class="kpi"><small>Previsão 7d</small><strong>${forecast.length ? formatLiters(forecast.reduce((s, f) => s + f.predicted, 0) / 7) + "/dia" : "-"}</strong></div>
          <div class="kpi"><small>Melhor dia</small><strong>${production.bestDay ? formatDate(production.bestDay.date) : "-"}</strong></div>
        </div>
        ${production.trendPercent !== 0 ? `<div class="trend-badge ${production.trendDirection}">${production.trendDirection === "up" ? "↑" : "↓"} ${Math.abs(production.trendPercent)}% vs semana anterior</div>` : ""}
      </div>

      <div class="smart-card">
        <div class="smart-card-header">
          <span class="smart-icon">🐄</span>
          <strong>Rebanho</strong>
        </div>
        <div class="kpi-grid">
          <div class="kpi"><small>Total</small><strong>${herd.total}</strong></div>
          <div class="kpi"><small>Lactação</small><strong>${herd.lactating} (${herd.lactatingPercent}%)</strong></div>
          <div class="kpi"><small>Gestantes</small><strong>${herd.pregnant}</strong></div>
          <div class="kpi"><small>Partos 30d</small><strong>${herd.calvings30d}</strong></div>
        </div>
        ${herd.healthScore < 80 ? `<div class="health-badge warning">🩺 Saúde: ${herd.healthScore}/100</div>` : `<div class="health-badge good">✅ Saúde: ${herd.healthScore}/100</div>`}
      </div>

      <div class="smart-card">
        <div class="smart-card-header">
          <span class="smart-icon">💰</span>
          <strong>Financeiro</strong>
        </div>
        <div class="kpi-grid">
          <div class="kpi"><small>Receita mês</small><strong>${formatMoney(financial.monthValue)}</strong></div>
          <div class="kpi"><small>Previsão</small><strong>${formatMoney(financial.projectedMonthValue)}</strong></div>
          <div class="kpi"><small>Média/dia</small><strong>${formatMoney(financial.dailyAvg * financial.price)}</strong></div>
          <div class="kpi"><small>Por animal</small><strong>${formatMoney(financial.revenuePerCow)}</strong></div>
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
            ${anomalies.map((a) => `<div class="anomaly-item ${a.severity}"><span class="anomaly-icon">${a.severity === "critical" ? "🔴" : a.severity === "warning" ? "🟡" : "ℹ️"}</span><span>${escapeHtml(a.message)}</span></div>`).join("")}
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
            ${recommendations.top3.map((r) => `<div class="recommendation-item ${r.priority}"><span class="rec-icon">${r.icon}</span><div class="rec-content"><strong>${escapeHtml(r.title)}</strong><small>${escapeHtml(r.message)}</small></div></div>`).join("")}
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
  if (forecast.length === 0) { container.innerHTML = ""; return; }

  container.innerHTML = `
    <div class="forecast-panel">
      <div class="forecast-header"><span>🔮</span><strong>Previsão de Produção (7 dias)</strong></div>
      <div class="forecast-grid">
        ${forecast.map((f) => {
          const confClass = f.confidence === "high" ? "high" : f.confidence === "medium" ? "medium" : "low";
          return `<div class="forecast-day"><small>${escapeHtml(formatDate(f.date))}</small><strong>${formatLiters(f.predicted)}</strong><span class="confidence ${confClass}">${f.confidence === "high" ? "Alta" : f.confidence === "medium" ? "Média" : "Baixa"}</span></div>`;
        }).join("")}
      </div>
    </div>
  `;
};

export const renderStockForecast = () => {
  const container = $("#stockForecastPanel");
  if (!container) return;

  const stock = forecastStock();
  const urgentItems = stock.filter((s) => s.recommendation?.type === "critical" || s.recommendation?.type === "warning");

  if (urgentItems.length === 0) { container.innerHTML = ""; return; }

  container.innerHTML = `
    <div class="stock-forecast-panel">
      <div class="forecast-header"><span>📦</span><strong>Estoque — Atenção Necessária</strong></div>
      <div class="stock-forecast-list">
        ${urgentItems.map((s) => `
          <div class="stock-forecast-item ${s.recommendation?.type}">
            <div class="stock-info"><strong>${escapeHtml(s.item_name)}</strong><small>${escapeHtml(s.recommendation?.message || "")}</small></div>
            <div class="stock-qty"><span>${formatStockQuantity(s.currentQty, s.unit)}</span>${s.daysUntilEmpty !== null ? `<small>~${s.daysUntilEmpty} dias</small>` : ""}</div>
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

  if (alerts.length === 0) { container.innerHTML = ""; return; }

  container.innerHTML = `
    <div class="lactation-forecast-panel">
      <div class="forecast-header"><span>🐄</span><strong>Lactação — Atenção</strong></div>
      <div class="lactation-forecast-list">
        ${alerts.map((l) => `
          <div class="lactation-forecast-item ${l.isLongLactation ? "critical" : "warning"}">
            <div class="lact-info"><strong>${escapeHtml(l.cow_name)}</strong><small>${l.daysActive} dias em lactação — ${escapeHtml(l.productivityPhase)}</small></div>
            ${l.recommendation ? `<div class="lact-rec"><small>${escapeHtml(l.recommendation)}</small></div>` : ""}
          </div>
        `).join("")}
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
        <div class="rec-title"><strong>${escapeHtml(r.title)}</strong><span class="rec-type">${escapeHtml(r.type)}</span></div>
        <span class="rec-priority ${r.priority}">${r.priority}</span>
      </div>
      <p class="rec-message">${escapeHtml(r.message)}</p>
      ${r.action ? `<button class="rec-action" type="button">${escapeHtml(r.action)}</button>` : ""}
    </div>
  `).join("");
};
