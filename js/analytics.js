import { state, todayIso, monthKey, addDaysIso, parseIsoDate } from "./state.js";
import { diffDays } from "./alerts.js";

export const mean = (arr) => {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
};

export const median = (arr) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const stddev = (arr) => {
  if (arr.length < 2) return 0;
  const avg = mean(arr);
  const squareDiffs = arr.map((v) => (v - avg) ** 2);
  return Math.sqrt(squareDiffs.reduce((s, v) => s + v, 0) / arr.length);
};

export const cv = (arr) => {
  const avg = mean(arr);
  if (avg === 0) return 0;
  return (stddev(arr) / avg) * 100;
};

export const zScore = (value, arr) => {
  if (arr.length < 2) return 0;
  const avg = mean(arr);
  const sd = stddev(arr);
  if (sd === 0) return 0;
  return (value - avg) / sd;
};

export const linearRegression = (points) => {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.[1] ?? 0, predict: () => points[0]?.[1] ?? 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (const [x, y] of points) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) || 0;
  const intercept = (sumY - slope * sumX) / n;

  return {
    slope,
    intercept,
    predict: (x) => slope * x + intercept,
    r2: (() => {
      const avgY = sumY / n;
      let ssTot = 0, ssRes = 0;
      for (const [x, y] of points) {
        ssTot += (y - avgY) ** 2;
        ssRes += (y - (slope * x + intercept)) ** 2;
      }
      return ssTot === 0 ? 0 : 1 - ssRes / ssTot;
    })(),
  };
};

export const weightedMovingAverage = (arr, windowSize = 7) => {
  if (arr.length === 0) return [];
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = arr.slice(start, i + 1);
    let weightSum = 0, valueSum = 0;
    window.forEach((v, idx) => {
      const weight = idx + 1;
      weightSum += weight;
      valueSum += v * weight;
    });
    result.push(valueSum / weightSum);
  }
  return result;
};

const getProductionData = (days = 30) => {
  const today = todayIso();
  return state.milk
    .filter((r) => r.date && diffDays(r.date, today) !== null)
    .map((r) => ({ date: r.date, liters: Number(r.liters || 0) }))
    .filter((r) => {
      const d = diffDays(r.date, today);
      return d !== null && d >= -days && d <= 0;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
};

export const getProductionAnalysis = (days = 30) => {
  const data = getProductionData(days);
  if (data.length < 3) {
    return {
      hasData: false,
      message: "Dados insuficientes para análise (mínimo 3 dias)",
      dataCount: data.length,
    };
  }

  const values = data.map((d) => d.liters);
  const last7 = values.slice(-7);
  const prev7 = values.slice(-14, -7);
  const last30 = values;

  const regPoints = data.map((d, i) => [i, d.liters]);
  const regression = linearRegression(regPoints);

  let trendDirection = "stable";
  let trendPercent = 0;
  const prev7Avg = mean(prev7);
  const last7Avg = mean(last7);
  if (prev7.length > 0 && prev7Avg > 0) {
    trendPercent = ((last7Avg - prev7Avg) / prev7Avg) * 100;
    if (trendPercent > 5) trendDirection = "up";
    else if (trendPercent < -5) trendDirection = "down";
  }

  const anomalies = data.filter((d) => Math.abs(zScore(d.liters, values)) > 2);

  const sorted = [...data].sort((a, b) => b.liters - a.liters);
  const bestDay = sorted[0];
  const worstDay = sorted[sorted.length - 1];

  const consistency = cv(values);

  const wma = weightedMovingAverage(values, 7);
  const currentWMA = wma[wma.length - 1] || 0;

  return {
    hasData: true,
    dataCount: data.length,
    totalLiters: values.reduce((s, v) => s + v, 0),
    average: mean(values),
    median: median(values),
    min: Math.min(...values),
    max: Math.max(...values),
    stddev: stddev(values),
    consistency: Math.max(0, 100 - consistency),
    trendDirection,
    trendPercent: Math.round(trendPercent * 10) / 10,
    regressionSlope: regression.slope,
    r2: regression.r2,
    last7Avg: Math.round(last7Avg * 10) / 10,
    prev7Avg: prev7.length ? Math.round(prev7Avg * 10) / 10 : null,
    last30Avg: Math.round(mean(last30) * 10) / 10,
    currentWMA: Math.round(currentWMA * 10) / 10,
    bestDay,
    worstDay,
    anomalies,
    anomalyCount: anomalies.length,
    data,
    regression,
  };
};

export const forecastProduction = (forecastDays = 7) => {
  const data = getProductionData(60);
  if (data.length < 7) return [];

  const values = data.map((d) => d.liters);
  const regPoints = data.map((d, i) => [i, d.liters]);
  const regression = linearRegression(regPoints);

  const wma = weightedMovingAverage(values, 7);
  const lastWMA = wma[wma.length - 1] || mean(values);

  const dayOfWeek = new Date().getDay();
  const sameDayValues = data.filter((d) => new Date(d.date).getDay() === dayOfWeek).map((d) => d.liters);
  const seasonalFactor = sameDayValues.length > 2 ? mean(sameDayValues) / mean(values) : 1;

  const today = todayIso();
  const predictions = [];

  for (let i = 1; i <= forecastDays; i++) {
    const futureDate = addDaysIso(today, i);
    const x = data.length + i - 1;
    const regPrediction = regression.predict(x);

    const blended = regPrediction * 0.4 + lastWMA * 0.4 + (mean(values) * seasonalFactor) * 0.2;

    let confidence = "medium";
    if (regression.r2 > 0.7 && cv(values) < 20) confidence = "high";
    else if (regression.r2 < 0.3 || cv(values) > 40) confidence = "low";

    predictions.push({
      date: futureDate,
      predicted: Math.max(0, Math.round(blended * 10) / 10),
      confidence,
      dayIndex: i,
    });
  }

  return predictions;
};

export const detectProductionAnomalies = () => {
  const data = getProductionData(30);
  const anomalies = [];

  if (data.length < 5) return anomalies;

  const values = data.map((d) => d.liters);
  const avg = mean(values);
  const lastEntry = data[data.length - 1];
  const lastValue = lastEntry.liters;

  if (lastValue < avg * 0.7 && avg > 0) {
    const dropPct = Math.round(((avg - lastValue) / avg) * 100);
    anomalies.push({
      type: "sharp_drop",
      severity: dropPct > 50 ? "critical" : "warning",
      message: `Produção caiu ${dropPct}% abaixo da média`,
      date: lastEntry.date,
      value: lastValue,
      avg,
    });
  }

  if (lastValue > avg * 1.5 && avg > 0) {
    const risePct = Math.round(((lastValue - avg) / avg) * 100);
    anomalies.push({
      type: "spike",
      severity: "info",
      message: `Produção ${risePct}% acima da média — verificar se é consistente`,
      date: lastEntry.date,
      value: lastValue,
      avg,
    });
  }

  const z = zScore(lastValue, values);
  if (Math.abs(z) > 2.5) {
    anomalies.push({
      type: "z_score",
      severity: Math.abs(z) > 3 ? "critical" : "warning",
      message: `Valor estatisticamente fora do padrão (z=${z.toFixed(1)})`,
      date: lastEntry.date,
      value: lastValue,
      avg,
    });
  }

  const last5 = data.slice(-5);
  if (last5.length >= 5) {
    let consecutiveDrops = 0;
    for (let i = 1; i < last5.length; i++) {
      if (last5[i].liters < last5[i - 1].liters) consecutiveDrops++;
    }
    if (consecutiveDrops >= 4) {
      anomalies.push({
        type: "consistent_decline",
        severity: "warning",
        message: `Produção em queda há ${consecutiveDrops} dias seguidos`,
        date: last5[last5.length - 1].date,
        value: last5[last5.length - 1].liters,
      });
    }
  }

  if (lastValue === 0) {
    anomalies.push({
      type: "zero_production",
      severity: "critical",
      message: "Produção registrada como zero — verificar se dados estão corretos",
      date: lastEntry.date,
      value: 0,
    });
  } else if (lastValue < avg * 0.3 && avg > 0) {
    anomalies.push({
      type: "very_low",
      severity: "warning",
      message: `Produção muito baixa (${lastValue}L vs média de ${Math.round(avg)}L)`,
      date: lastEntry.date,
      value: lastValue,
      avg,
    });
  }

  return anomalies;
};

export const getHerdAnalysis = () => {
  const animals = state.animals || [];
  const lactations = state.lactations || [];
  const breeding = state.breeding || [];
  const medication = state.medication || [];
  const today = todayIso();

  const total = animals.length;
  const lactating = animals.filter((a) => a.status === "Em lactação").length;
  const dry = animals.filter((a) => a.status === "Seca").length;
  const pregnant = animals.filter((a) => a.status === "Prenhe").length;

  const activeLactations = lactations.filter((r) => !r.end_date);
  const avgLactationDays = activeLactations.length
    ? mean(activeLactations.map((r) => diffDays(r.start_date, today) || 0))
    : 0;

  const activePregnancies = breeding.filter(
    (r) => r.expected_calving_date && r.expected_calving_date > today
  );
  const avgPregnancyProgress = activePregnancies.length
    ? mean(
        activePregnancies.map((r) => {
          const totalDays = 285;
          const elapsed = diffDays(r.insemination_date, today) || 0;
          return Math.min(100, Math.round((elapsed / totalDays) * 100));
        })
      )
    : 0;

  const calvings30d = activePregnancies.filter((r) => {
    const days = diffDays(today, r.expected_calving_date);
    return days !== null && days >= -30 && days <= 0;
  });

  const recentMeds = medication.filter((r) => {
    if (!r.administration_date) return false;
    const d = diffDays(r.administration_date, today);
    return d !== null && d >= -30 && d <= 0;
  });

  const totalBreeding = breeding.length;
  const successfulPregnancies = breeding.filter((r) => r.expected_calving_date).length;
  const reproductiveEfficiency = totalBreeding > 0 ? Math.round((successfulPregnancies / totalBreeding) * 100) : 0;

  const healthIssues = recentMeds.filter((m) => {
    const name = (m.medication_name || "").toLowerCase();
    return name.includes("antibiótico") || name.includes("anti-inflamatório") || name.includes("banamine");
  }).length;
  const healthScore = Math.max(0, 100 - healthIssues * 10);

  return {
    total,
    lactating,
    dry,
    pregnant,
    lactatingPercent: total > 0 ? Math.round((lactating / total) * 100) : 0,
    avgLactationDays: Math.round(avgLactationDays),
    activePregnancies: activePregnancies.length,
    avgPregnancyProgress,
    calvings30d: calvings30d.length,
    calvings30dDetails: calvings30d.map((r) => ({
      cow: state.animals.find((a) => String(a.id) === String(r.cow_id))?.identification || r.cow_id,
      date: r.expected_calving_date,
      daysUntil: diffDays(today, r.expected_calving_date),
    })),
    recentMedications: recentMeds.length,
    reproductiveEfficiency,
    healthScore,
  };
};

export const getFinancialAnalysis = () => {
  const price = Number(state.priceQuote || 0);
  const today = todayIso();
  const currentMonth = monthKey();
  const forecast = forecastProduction(30);

  const monthRecords = state.milk.filter((r) => r.date?.startsWith(currentMonth));
  const monthLiters = monthRecords.reduce((s, r) => s + Number(r.liters || 0), 0);
  const monthValue = monthLiters * price;

  const daysInMonth = new Date(
    parseInt(currentMonth.split("-")[0]),
    parseInt(currentMonth.split("-")[1]),
    0
  ).getDate();
  const dayOfMonth = new Date().getDate();
  const remainingDays = daysInMonth - dayOfMonth;

  const forecastRemaining = forecast.slice(0, remainingDays);
  const forecastLiters = forecastRemaining.reduce((s, f) => s + f.predicted, 0);
  const projectedMonthTotal = monthLiters + forecastLiters;
  const projectedMonthValue = projectedMonthTotal * price;

  const dailyAvg = dayOfMonth > 0 ? monthLiters / dayOfMonth : 0;
  const projectedFromAvg = dailyAvg * daysInMonth;

  const lactating = state.animals.filter((a) => a.status === "Em lactação").length;
  const revenuePerCow = lactating > 0 ? monthValue / lactating : 0;

  return {
    price,
    monthLiters,
    monthValue,
    dailyAvg: Math.round(dailyAvg * 10) / 10,
    projectedMonthTotal: Math.round(projectedMonthTotal),
    projectedMonthValue: Math.round(projectedMonthValue * 100) / 100,
    projectedFromAvg: Math.round(projectedFromAvg),
    remainingDays,
    revenuePerCow: Math.round(revenuePerCow * 100) / 100,
    lactating,
  };
};

export const getFarmScore = () => {
  const production = getProductionAnalysis(14);
  const herd = getHerdAnalysis();
  const financial = getFinancialAnalysis();
  const anomalies = detectProductionAnomalies();

  let score = 50;

  if (production.hasData) {
    score += production.consistency * 0.15;
    if (production.trendDirection === "up") score += 10;
    else if (production.trendDirection === "down") score -= 10;
  }

  if (herd.total > 0) {
    score += herd.lactatingPercent * 0.1;
    score += herd.healthScore * 0.1;
  }

  if (financial.monthValue > 0) score += 5;

  const criticalAnomalies = anomalies.filter((a) => a.severity === "critical").length;
  const warningAnomalies = anomalies.filter((a) => a.severity === "warning").length;
  score -= criticalAnomalies * 10;
  score -= warningAnomalies * 3;

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    breakdown: {
      production: production.hasData ? {
        consistency: production.consistency,
        trend: production.trendDirection,
      } : null,
      herd: {
        lactatingPercent: herd.lactatingPercent,
        healthScore: herd.healthScore,
      },
      financial: {
        monthValue: financial.monthValue,
      },
      anomalies: {
        critical: criticalAnomalies,
        warning: warningAnomalies,
      },
    },
    label: score >= 80 ? "Excelente" : score >= 60 ? "Bom" : score >= 40 ? "Regular" : "Precisa de atenção",
  };
};
