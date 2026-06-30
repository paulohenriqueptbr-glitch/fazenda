import { state, todayIso, addDaysIso, monthKey, parseIsoDate } from "./state.js";
import { diffDays } from "./alerts.js";
import { mean } from "./analytics.js";
import { getProductionAnalysis, getHerdAnalysis, getFinancialAnalysis } from "./analytics.js";
import { getMedicationInfo } from "./medication-catalog.js";

export const RECOMMENDATION_TYPES = {
  PRODUCTION: "production",
  HEALTH: "health",
  REPRODUCTION: "reproduction",
  STOCK: "stock",
  LAVORUA: "lavorua",
  FINANCIAL: "financial",
};

export const RECOMMENDATION_PRIORITY = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

export const generateRecommendations = () => {
  const today = todayIso();
  const recommendations = [];

  recommendations.push(...getProductionRecommendations());
  recommendations.push(...getHealthRecommendations());
  recommendations.push(...getReproductionRecommendations());
  recommendations.push(...getStockRecommendations());
  recommendations.push(...getCropRecommendations());
  recommendations.push(...getFinancialRecommendations());

  const priorityOrder = {
    [RECOMMENDATION_PRIORITY.CRITICAL]: 0,
    [RECOMMENDATION_PRIORITY.HIGH]: 1,
    [RECOMMENDATION_PRIORITY.MEDIUM]: 2,
    [RECOMMENDATION_PRIORITY.LOW]: 3,
  };

  return recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
};

const getProductionRecommendations = () => {
  const recommendations = [];
  const analysis = getProductionAnalysis(14);

  if (!analysis.hasData) return recommendations;

  if (analysis.trendDirection === "down" && analysis.trendPercent < -10) {
    recommendations.push({
      type: RECOMMENDATION_TYPES.PRODUCTION,
      priority: RECOMMENDATION_PRIORITY.HIGH,
      title: "Produção em queda",
      message: `Produção caiu ${Math.abs(analysis.trendPercent)}% nos últimos 7 dias. Verifique alimentação, saúde do rebanho e condições climáticas.`,
      action: "Verificar rebanho",
      icon: "📉",
    });
  }

  if (analysis.consistency < 60) {
    recommendations.push({
      type: RECOMMENDATION_TYPES.PRODUCTION,
      priority: RECOMMENDATION_PRIORITY.MEDIUM,
      title: "Produção instável",
      message: `Consistência de ${Math.round(analysis.consistency)}% — produzir em horários regulares e manter rotina de ordenha.`,
      action: "Melhorar rotina",
      icon: "📊",
    });
  }

  if (analysis.trendDirection === "up" && analysis.trendPercent > 10) {
    recommendations.push({
      type: RECOMMENDATION_TYPES.PRODUCTION,
      priority: RECOMMENDATION_PRIORITY.LOW,
      title: "Produção em alta",
      message: `Produção subiu ${analysis.trendPercent}% — mantenha a rotina atual.`,
      action: null,
      icon: "📈",
    });
  }

  return recommendations;
};

const getHealthRecommendations = () => {
  const recommendations = [];
  const today = todayIso();
  const herd = getHerdAnalysis();

  const longLactations = (state.lactations || []).filter((l) => {
    if (l.end_date) return false;
    const days = diffDays(l.start_date, today);
    return days !== null && days > 300;
  });

  if (longLactations.length > 0) {
    const cow = state.animals.find((a) => String(a.id) === String(longLactations[0].cow_id));
    recommendations.push({
      type: RECOMMENDATION_TYPES.HEALTH,
      priority: RECOMMENDATION_PRIORITY.HIGH,
      title: "Lactação longa detectada",
      message: `${cow?.identification || "Vaca"} está em lactação há mais de 300 dias. Considere secar para descanso reprodutivo.`,
      action: "Considerar secagem",
      icon: "🐄",
    });
  }

  if (herd.recentMedications > 5) {
    recommendations.push({
      type: RECOMMENDATION_TYPES.HEALTH,
      priority: RECOMMENDATION_PRIORITY.MEDIUM,
      title: "Muitas medicações recentes",
      message: `${herd.recentMedications} medicações nos últimos 30 dias. Avalie se há padrão de doenças recorrentes.`,
      action: "Revisar sanidade",
      icon: "💊",
    });
  }

  if (herd.healthScore < 70) {
    recommendations.push({
      type: RECOMMENDATION_TYPES.HEALTH,
      priority: RECOMMENDATION_PRIORITY.MEDIUM,
      title: "Índice de saúde abaixo do ideal",
      message: `Score de saúde: ${herd.healthScore}/100. Considere melhorar manejo sanitário.`,
      action: "Melhorar manejo",
      icon: "🩺",
    });
  }

  return recommendations;
};

const getReproductionRecommendations = () => {
  const recommendations = [];
  const today = todayIso();
  const herd = getHerdAnalysis();

  if (herd.calvings30d > 0) {
    recommendations.push({
      type: RECOMMENDATION_TYPES.REPRODUCTION,
      priority: RECOMMENDATION_PRIORITY.HIGH,
      title: `${herd.calvings30d} parto(s) previsto(s) nos próximos 30 dias`,
      message: "Prepare local de parto, monitore sinais de trabalho de parto e tenha kit de emergência pronto.",
      action: "Preparar parto",
      icon: "🐄",
    });
  }

  if (herd.reproductiveEfficiency < 50 && herd.total > 5) {
    recommendations.push({
      type: RECOMMENDATION_TYPES.REPRODUCTION,
      priority: RECOMMENDATION_PRIORITY.MEDIUM,
      title: "Eficiência reprodutiva baixa",
      message: `Taxa de sucesso: ${herd.reproductiveEfficiency}%. Considere avaliação veterinária.`,
      action: "Avaliar reprodutivos",
      icon: "🤰",
    });
  }

  const dryNotPregnant = state.animals.filter((a) =>
    a.status === "Seca" &&
    !(state.breeding || []).some((b) =>
      String(b.cow_id) === String(a.id) &&
      b.expected_calving_date &&
      b.expected_calving_date > today
    )
  );

  if (dryNotPregnant.length > 0) {
    recommendations.push({
      type: RECOMMENDATION_TYPES.REPRODUCTION,
      priority: RECOMMENDATION_PRIORITY.MEDIUM,
      title: `${dryNotPregnant.length} vaca(s) seca(s) sem gestação`,
      message: "Considere inseminar para manter produtividade.",
      action: "Inseminar",
      icon: "💉",
    });
  }

  return recommendations;
};

const getStockRecommendations = () => {
  const recommendations = [];

  (state.stockItems || []).forEach((item) => {
    const qty = Number(item.quantity || 0);
    const minQty = item.min_quantity === null || item.min_quantity === undefined
      ? null
      : Number(item.min_quantity);

    if (qty === 0) {
      recommendations.push({
        type: RECOMMENDATION_TYPES.STOCK,
        priority: RECOMMENDATION_PRIORITY.CRITICAL,
        title: `Estoque zerado: ${item.item_name}`,
        message: "Repor urgentemente para não interromper atividades.",
        action: "Comprar agora",
        icon: "📦",
      });
    } else if (minQty !== null && qty <= minQty) {
      recommendations.push({
        type: RECOMMENDATION_TYPES.STOCK,
        priority: RECOMMENDATION_PRIORITY.HIGH,
        title: `Estoque baixo: ${item.item_name}`,
        message: `Atual: ${qty} ${item.unit}. Mínimo: ${minQty}. Planeje reposição.`,
        action: "Planejar compra",
        icon: "📦",
      });
    }
  });

  return recommendations;
};

const getCropRecommendations = () => {
  const recommendations = [];
  const today = todayIso();

  (state.cropEvents || []).forEach((event) => {
    if (!event.event_date || !event.event_type) return;

    const eventType = event.event_type.toLowerCase();
    const daysSince = diffDays(event.event_date, today);

    if (daysSince === null) return;

    if (eventType.includes("plantio") && daysSince >= 7 && daysSince <= 14) {
      recommendations.push({
        type: RECOMMENDATION_TYPES.LAVORUA,
        priority: RECOMMENDATION_PRIORITY.MEDIUM,
        title: `Verificar germinação: ${event.plot_name || event.crop_name}`,
        message: `Plantio foi há ${daysSince} dias. Verifique percentual de germinação.`,
        action: "Visitar lavoura",
        icon: "🌱",
      });
    }

    if (eventType.includes("pulver") && daysSince >= 7 && daysSince <= 10) {
      recommendations.push({
        type: RECOMMENDATION_TYPES.LAVORUA,
        priority: RECOMMENDATION_PRIORITY.LOW,
        title: `Avaliar efeito da pulverização: ${event.plot_name || event.crop_name}`,
        message: `Pulverização foi há ${daysSince} dias. Verifique eficácia do produto.`,
        action: "Avaliar resultado",
        icon: "🌾",
      });
    }
  });

  return recommendations;
};

const getFinancialRecommendations = () => {
  const recommendations = [];
  const financial = getFinancialAnalysis();

  if (financial.revenuePerCow < 50 && financial.lactating > 0) {
    recommendations.push({
      type: RECOMMENDATION_TYPES.FINANCIAL,
      priority: RECOMMENDATION_PRIORITY.MEDIUM,
      title: "Receita por animal abaixo do esperado",
      message: `R$ ${financial.revenuePerCow.toFixed(2)}/animal lactente este mês. Avalie produtividade e custos.`,
      action: "Analisar custos",
      icon: "💰",
    });
  }

  if (financial.projectedMonthValue < financial.monthValue * 0.9) {
    recommendations.push({
      type: RECOMMENDATION_TYPES.FINANCIAL,
      priority: RECOMMENDATION_PRIORITY.LOW,
      title: "Previsão de receita menor que o mês atual",
      message: "Mantenha foco na produtividade para fechar o mês bem.",
      action: null,
      icon: "📊",
    });
  }

  return recommendations;
};

export const getRecommendationsSummary = () => {
  const all = generateRecommendations();
  return {
    total: all.length,
    critical: all.filter((r) => r.priority === RECOMMENDATION_PRIORITY.CRITICAL).length,
    high: all.filter((r) => r.priority === RECOMMENDATION_PRIORITY.HIGH).length,
    medium: all.filter((r) => r.priority === RECOMMENDATION_PRIORITY.MEDIUM).length,
    low: all.filter((r) => r.priority === RECOMMENDATION_PRIORITY.LOW).length,
    top3: all.slice(0, 3),
    byType: {
      production: all.filter((r) => r.type === RECOMMENDATION_TYPES.PRODUCTION).length,
      health: all.filter((r) => r.type === RECOMMENDATION_TYPES.HEALTH).length,
      reproduction: all.filter((r) => r.type === RECOMMENDATION_TYPES.REPRODUCTION).length,
      stock: all.filter((r) => r.type === RECOMMENDATION_TYPES.STOCK).length,
      crop: all.filter((r) => r.type === RECOMMENDATION_TYPES.LAVORUA).length,
      financial: all.filter((r) => r.type === RECOMMENDATION_TYPES.FINANCIAL).length,
    },
  };
};
