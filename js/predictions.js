
import { state, todayIso, addDaysIso, monthKey, parseIsoDate } from "./state.js";
import { diffDays } from "./alerts.js";
import { mean, linearRegression, weightedMovingAverage, cv } from "./analytics.js";
import { getMedicationInfo } from "./medication-catalog.js";

export const forecastStock = () => {
  const today = todayIso();
  const stockItems = state.stockItems || [];

  return stockItems.map((item) => {
    const qty = Number(item.quantity || 0);
    const minQty = item.min_quantity === null || item.min_quantity === undefined
      ? null
      : Number(item.min_quantity);

    const consumption = calculateItemConsumption(item);

    let daysUntilEmpty = null;
    let daysUntilMinimum = null;
    let recommendation = null;

    if (consumption.dailyRate > 0) {
      daysUntilEmpty = Math.round(qty / consumption.dailyRate);
      if (minQty !== null && minQty !== undefined) {
        daysUntilMinimum = Math.round((qty - minQty) / consumption.dailyRate);
      }
    }

    if (qty === 0) {
      recommendation = { type: "critical", message: "Item em estoque zero — repor urgentemente" };
    } else if (daysUntilMinimum !== null && daysUntilMinimum <= 3) {
      recommendation = { type: "warning", message: `Estoque mínimo atingido em ${daysUntilMinimum} dias` };
    } else if (daysUntilEmpty !== null && daysUntilEmpty <= 7) {
      recommendation = { type: "warning", message: `Estoque vai acabar em ${daysUntilEmpty} dias` };
    } else if (minQty !== null && qty <= minQty) {
      recommendation = { type: "warning", message: "Estoque abaixo do mínimo" };
    }

    return {
      ...item,
      currentQty: qty,
      minQty,
      consumption,
      daysUntilEmpty,
      daysUntilMinimum,
      recommendation,
    };
  }).sort((a, b) => {
    if (a.recommendation?.type === "critical" && b.recommendation?.type !== "critical") return -1;
    if (b.recommendation?.type === "critical" && a.recommendation?.type !== "critical") return 1;
    if (a.daysUntilMinimum !== null && b.daysUntilMinimum !== null) return a.daysUntilMinimum - b.daysUntilMinimum;
    if (a.daysUntilEmpty !== null && b.daysUntilEmpty !== null) return a.daysUntilEmpty - b.daysUntilEmpty;
    return 0;
  });
};

const calculateItemConsumption = (item) => {
  const today = todayIso();
  const itemName = (item.item_name || "").toLowerCase();
  const category = (item.category || "").toLowerCase();

  let totalUsed = 0;
  let periodDays = 0;

  if (category === "medicamento" || category.includes("medic")) {
    const meds = state.medication.filter((m) => {
      const medName = (m.medication_name || "").toLowerCase();
      return medName.includes(itemName) || itemName.includes(medName);
    });

    if (meds.length > 1) {
      const oldest = meds.reduce((o, m) =>
        m.administration_date < (o.administration_date || "9999") ? m : o
      );
      const newest = meds.reduce((n, m) =>
        m.administration_date > (n.administration_date || "0000") ? m : n
      );

      periodDays = diffDays(oldest.administration_date, newest.administration_date) || 30;
      totalUsed = meds.length;
    }
  }

  if (totalUsed === 0) {
    totalUsed = 1;
    periodDays = 30;
  }

  const dailyRate = periodDays > 0 ? totalUsed / periodDays : 0;

  return {
    dailyRate: Math.round(dailyRate * 1000) / 1000,
    monthlyRate: Math.round(dailyRate * 30 * 100) / 100,
    totalUsed,
    periodDays,
    sampleSize: category.includes("medic") ? "medication" : "estimated",
  };
};

export const forecastMedication = () => {
  const today = todayIso();
  const medications = state.medication || [];
  const forecast = [];

  medications.forEach((m) => {
    if (!m.administration_date || !m.medication_name) return;

    const info = getMedicationInfo(m.medication_name, m.reapply_interval_days);
    const nextDate = addDaysIso(m.administration_date, info.days);
    const daysUntil = diffDays(today, nextDate);

    if (daysUntil !== null && daysUntil <= 30) {
      const animal = state.animals.find((a) => String(a.id) === String(m.cow_id));
      forecast.push({
        medication_name: m.medication_name,
        cow_id: m.cow_id,
        cow_name: animal?.identification || m.cow_id,
        lastDate: m.administration_date,
        nextDate,
        daysUntil,
        interval: info.days,
        category: info.category,
        urgency: daysUntil < 0 ? "overdue" : daysUntil <= 2 ? "urgent" : daysUntil <= 7 ? "soon" : "planned",
      });
    }
  });

  return forecast.sort((a, b) => a.daysUntil - b.daysUntil);
};

export const forecastCosts = () => {
  const stockItems = state.stockItems || [];
  const monthKey_ = monthKey();

  let estimatedMonthlyCost = 0;
  const itemCosts = [];

  stockItems.forEach((item) => {
    const qty = Number(item.quantity || 0);
    const consumption = calculateItemConsumption(item);
    const monthlyUsage = consumption.monthlyRate;

    if (monthlyUsage > 0) {
      estimatedMonthlyCost += monthlyUsage;
      itemCosts.push({
        name: item.item_name,
        monthlyUsage,
        unit: item.unit,
        category: item.category,
      });
    }
  });

  const price = Number(state.priceQuote || 0);
  const monthRecords = state.milk.filter((r) => r.date?.startsWith(monthKey_));
  const monthLiters = monthRecords.reduce((s, r) => s + Number(r.liters || 0), 0);
  const projectedRevenue = monthLiters * price;

  return {
    estimatedMonthlyCost,
    projectedRevenue,
    netEstimate: projectedRevenue - estimatedMonthlyCost,
    itemCosts: itemCosts.sort((a, b) => b.monthlyUsage - a.monthlyUsage).slice(0, 10),
  };
};

export const forecastProductionAdvanced = (days = 30) => {
  const today = todayIso();
  const milkData = [...state.milk]
    .filter((r) => r.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (milkData.length < 14) return [];

  const values = milkData.map((r) => Number(r.liters || 0));
  const regPoints = milkData.map((r, i) => [i, Number(r.liters || 0)]);
  const regression = linearRegression(regPoints);

  const predictions = regression.predict;
  const errors = regPoints.map(([x, y]) => Math.abs(predictions(x) - y));
  const avgError = mean(errors);
  const maxError = Math.max(...errors);

  const result = [];

  for (let i = 1; i <= days; i++) {
    const futureDate = addDaysIso(today, i);
    const x = milkData.length + i - 1;
    const predicted = Math.max(0, regression.predict(x));

    const uncertaintyFactor = 1 + (i / days) * 0.5;

    result.push({
      date: futureDate,
      predicted: Math.round(predicted * 10) / 10,
      low: Math.max(0, Math.round((predicted - avgError * uncertaintyFactor * 1.5) * 10) / 10),
      high: Math.round((predicted + avgError * uncertaintyFactor * 1.5) * 10) / 10,
      confidence: i <= 7 ? "high" : i <= 14 ? "medium" : "low",
    });
  }

  return result;
};

export const forecastLactation = () => {
  const today = todayIso();
  const lactations = state.lactations || [];

  const activeLactations = lactations.filter((r) => !r.end_date);

  return activeLactations.map((l) => {
    const daysActive = diffDays(l.start_date, today) || 0;
    const cow = state.animals.find((a) => String(a.id) === String(l.cow_id));

    let productivityPhase = "established";
    let expectedTrend = "stable";

    if (daysActive < 30) {
      productivityPhase = "increasing";
      expectedTrend = "up";
    } else if (daysActive < 120) {
      productivityPhase = "peak";
      expectedTrend = "stable";
    } else if (daysActive < 240) {
      productivityPhase = "declining";
      expectedTrend = "down";
    } else {
      productivityPhase = "late";
      expectedTrend = "down";
    }

    const isLongLactation = daysActive > 300;

    return {
      cow_id: l.cow_id,
      cow_name: cow?.identification || l.cow_id,
      startDate: l.start_date,
      daysActive,
      dailyLiters: Number(l.daily_liters || 0),
      productivityPhase,
      expectedTrend,
      isLongLactation,
      recommendation: isLongLactation
        ? "Considere secar esta vaca — lactação muito longa"
        : daysActive > 240
        ? "Preparar para secagem em breve"
        : null,
    };
  });
};
