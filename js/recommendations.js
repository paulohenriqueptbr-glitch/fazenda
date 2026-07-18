// ─── Motor de Recomendações ───────────────────────────────────────────────────
// Gera sugestões automáticas baseadas em dados e regras de negócio.
// Tudo roda localmente — nenhum dado sai do dispositivo.

import { state, todayIso, addDaysIso, monthKey, parseIsoDate } from "./state.js";
import { diffDays } from "./alerts.js";
import { mean } from "./analytics.js";
import { getProductionAnalysis, getHerdAnalysis, getFinancialAnalysis } from "./analytics.js";
import { getMedicationInfo } from "./medication-catalog.js";

// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS DE RECOMENDAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// MOTOR DE RECOMENDAÇÕES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Gera todas as recomendações baseadas no estado atual.
 * @returns {Array} Recomendações ordenadas por prioridade
 */
export const generateRecommendations = () => {
  const today = todayIso();
  const recommendations = [];

  // 1. Recomendações de produção
  recommendations.push(...getProductionRecommendations());

  // 2. Recomendações de reprodução
  recommendations.push(...getReproductionRecommendations());

  // 4. Recomendações de estoque
  recommendations.push(...getStockRecommendations());

  // 5. Recomendações de lavoura
  recommendations.push(...getCropRecommendations());

  // 6. Recomendações financeiras
  recommendations.push(...getFinancialRecommendations());

  // Ordenar por prioridade
  const priorityOrder = {
    [RECOMMENDATION_PRIORITY.CRITICAL]: 0,
    [RECOMMENDATION_PRIORITY.HIGH]: 1,
    [RECOMMENDATION_PRIORITY.MEDIUM]: 2,
    [RECOMMENDATION_PRIORITY.LOW]: 3,
  };

  return recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
};

// ═══════════════════════════════════════════════════════════════════════════════
// RECOMENDAÇÕES DE PRODUÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

const getProductionRecommendations = () => {
  const recommendations = [];
  const analysis = getProductionAnalysis(14);

  if (!analysis.hasData) return recommendations;

  // Produção em queda
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

  // Produção inconsistente
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

  // Produção acima da média
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

// ═══════════════════════════════════════════════════════════════════════════════
// RECOMENDAÇÕES DE REPRODUÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

const getReproductionRecommendations = () => {
  const recommendations = [];
  const today = todayIso();
  const herd = getHerdAnalysis();

  // Partos próximos
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

  // Baixa eficiência reprodutiva
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

  // Vacas secas sem gestação
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

// ═══════════════════════════════════════════════════════════════════════════════
// RECOMENDAÇÕES DE ESTOQUE
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// RECOMENDAÇÕES DE LAVOURA
// ═══════════════════════════════════════════════════════════════════════════════

const getCropRecommendations = () => {
  const recommendations = [];
  const today = todayIso();

  (state.cropEvents || []).forEach((event) => {
    if (!event.event_date || !event.event_type) return;

    const eventType = event.event_type.toLowerCase();
    const daysSince = diffDays(event.event_date, today);

    if (daysSince === null) return;

    // Plantio: verificar germinação
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

    // Pulverização: verificar eficácia
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

// ═══════════════════════════════════════════════════════════════════════════════
// RECOMENDAÇÕES FINANCEIRAS
// ═══════════════════════════════════════════════════════════════════════════════

const getFinancialRecommendations = () => {
  const recommendations = [];
  const financial = getFinancialAnalysis();

  // Receita por animal muito baixa
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

  // Previsão de receita vs produção atual
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

// ═══════════════════════════════════════════════════════════════════════════════
// SCORE DE RECOMENDAÇÕES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Resumo das recomendações para exibição no dashboard.
 */
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
