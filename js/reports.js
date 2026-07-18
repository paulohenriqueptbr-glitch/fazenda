import { $, state, todayIso, monthKey, addDaysIso } from "./state.js";
import { formatLiters, formatMoney, formatDate, escapeHtml } from "./ui.js";
import { animalLabel } from "./crud.js";
import { sumLiters, countLactating } from "./stats.js";

let productionChart = null;

const destroyChart = () => {
  if (productionChart) {
    productionChart.destroy();
    productionChart = null;
  }
};

export const buildMonthlyReport = () => {
  const price = Number(state.priceQuote || 0);
  const currentMonth = monthKey();
  const today = todayIso();
  const calvingLimit = addDaysIso(today, 60);
  const monthRecords = state.milk.filter((r) => r.date?.startsWith(currentMonth));
  const monthLiters = sumLiters(monthRecords);
  const average = monthRecords.length ? monthLiters / monthRecords.length : 0;
  const bestRecord = monthRecords.reduce((best, r) => (Number(r.liters || 0) > Number(best?.liters || 0) ? r : best), null);
  const lactating = countLactating();
  const medications = state.medication.filter((r) => r.administration_date?.startsWith(currentMonth));
  const calvings = state.breeding.filter((r) => r.expected_calving_date >= today && r.expected_calving_date <= calvingLimit);
  return { price, monthRecords, monthLiters, monthValue: monthLiters * price, average, bestRecord, lactating, medications, calvings };
};

export const renderReports = (el) => {
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
