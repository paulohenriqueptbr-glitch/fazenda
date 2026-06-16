
const buildMonthlyReport = () => {
  const price = Number(state.priceQuote || 0);
  const currentMonth = monthKey();
  
  // Previous month calculation
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  d.setMonth(d.getMonth() - 1);
  const previousMonth = d.toISOString().slice(0, 7);

  const today = todayIso();
  const calvingLimit = addDaysIso(today, 60);
  
  const monthRecords = state.milk.filter((record) => record.date?.startsWith(currentMonth));
  const monthLiters = monthRecords.reduce((sum, record) => sum + Number(record.liters || 0), 0);
  const average = monthRecords.length ? monthLiters / monthRecords.length : 0;
  
  const prevMonthRecords = state.milk.filter((record) => record.date?.startsWith(previousMonth));
  const prevMonthLiters = prevMonthRecords.reduce((sum, record) => sum + Number(record.liters || 0), 0);
  
  // Trend calculation
  let trend = 0;
  if (prevMonthLiters > 0) {
    trend = ((monthLiters - prevMonthLiters) / prevMonthLiters) * 100;
  }

  // Projection calculation (average * days in current month)
  const currentD = new Date();
  const daysInMonth = new Date(currentD.getFullYear(), currentD.getMonth() + 1, 0).getDate();
  const projectedLiters = average * daysInMonth;
  const projectedValue = projectedLiters * price;

  const bestRecord = monthRecords.reduce(
    (best, record) => (Number(record.liters || 0) > Number(best?.liters || 0) ? record : best),
    null
  );
  const lactating = state.animals.filter((animal) => animal.status === "Em lactação").length;
  const medications = state.medication.filter((record) => record.administration_date?.startsWith(currentMonth));
  const calvings = state.breeding.filter(
    (record) => record.expected_calving_date >= today && record.expected_calving_date <= calvingLimit
  );

  return {
    price,
    monthRecords,
    monthLiters,
    monthValue: monthLiters * price,
    average,
    trend,
    projectedValue,
    bestRecord,
    lactating,
    medications,
    calvings,
  };
};

const renderReportDetails = (report) => {
  if (!el.reportDetails) return;

  el.reportDetails.innerHTML = `
    <article>
      <span>Animais em lactação</span>
      <strong>${escapeHtml(String(report.lactating))}</strong>
      <small>${escapeHtml(String(state.animals.length))} animais cadastrados</small>
    </article>
    <article>
      <span>Medicações no mês</span>
      <strong>${escapeHtml(String(report.medications.length))}</strong>
      <small>${escapeHtml(report.medications.slice(0, 2).map((item) => item.medication_name).join(", ") || "Nenhuma aplicação")}</small>
    </article>
    <article>
      <span>Previsão de parto</span>
      <strong>${escapeHtml(String(report.calvings.length))}</strong>
      <small>${escapeHtml(report.calvings.slice(0, 2).map((item) => `${animalLabel(item.cow_id)}: ${formatDate(item.expected_calving_date)}`).join(", ") || "Sem partos nos próximos 60 dias")}</small>
    </article>
    <article>
      <span>Faturamento estimado (Realizado)</span>
      <strong>${escapeHtml(formatMoney(report.monthValue))}</strong>
      <small>${escapeHtml(formatMoney(report.price))} por litro</small>
    </article>
  `;
};

let productionChart = null;

const renderReports = () => {
  const report = buildMonthlyReport();
  const chartRecords = [...state.milk]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);

  if (el.reportMonthTotal) el.reportMonthTotal.textContent = formatLiters(report.monthLiters);
  if (el.reportMonthValue) el.reportMonthValue.textContent = formatMoney(report.monthValue);
  if (el.reportAverage) el.reportAverage.textContent = formatLiters(report.average);
  if (el.reportBestDay) el.reportBestDay.textContent = report.bestRecord ? `${formatDate(report.bestRecord.date)} - ${formatLiters(report.bestRecord.liters)}` : "-";
  
  if (el.reportMonthTrend) {
    el.reportMonthTrend.textContent = report.trend === 0 ? "-" : `${report.trend > 0 ? '+' : ''}${report.trend.toFixed(1)}%`;
    el.reportMonthTrend.className = report.trend > 0 ? "trend-up" : report.trend < 0 ? "trend-down" : "";
  }
  
  if (el.reportProjectedValue) {
    el.reportProjectedValue.textContent = formatMoney(report.projectedValue);
  }
  
  renderReportDetails(report);

  // Chart.js gráfico interativo
  if (chartRecords.length > 0 && window.Chart && el.productionChart) {
    const ctx = el.productionChart.getContext ? el.productionChart : document.createElement('canvas');
    
    if (!productionChart) {
      el.productionChart.innerHTML = ''; // Limpar container
      el.productionChart.appendChild(ctx);
      productionChart = new window.Chart(ctx, {
        type: 'line',
        data: {
          labels: chartRecords.map(r => formatDate(r.date)),
          datasets: [
            {
              label: 'Produção (L)',
              data: chartRecords.map(r => Number(r.liters || 0)),
              borderColor: '#176c56',
              backgroundColor: 'rgba(23, 108, 86, 0.1)',
              borderWidth: 2,
              fill: true,
              tension: 0.3,
              pointRadius: 5,
              pointBackgroundColor: '#176c56',
              pointBorderColor: '#ffffff',
              pointBorderWidth: 2,
              pointHoverRadius: 7,
            },
            {
              label: 'Média mensal',
              data: chartRecords.map(() => report.average),
              borderColor: '#b7791f',
              borderWidth: 2,
              borderDash: [5, 5],
              fill: false,
              pointRadius: 0,
              tension: 0,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: true, position: 'top' },
            tooltip: {
              backgroundColor: 'rgba(0,0,0,0.8)',
              padding: 12,
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${formatLiters(ctx.parsed.y)}`,
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: (v) => formatLiters(v) }
            }
          }
        }
      });
    } else {
      productionChart.data.labels = chartRecords.map(r => formatDate(r.date));
      productionChart.data.datasets[0].data = chartRecords.map(r => Number(r.liters || 0));
      productionChart.data.datasets[1].data = chartRecords.map(() => report.average);
      productionChart.update();
    }
  }
};