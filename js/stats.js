import { state, monthKey } from "./state.js";

/**
 * Soma os litros de um array de registros de leite.
 * @param {Array} records - Registros com campo `liters`
 * @returns {number} Total de litros
 */
export const sumLiters = (records) => records.reduce((sum, r) => sum + Number(r.liters || 0), 0);

/**
 * Calcula a média de litros do mês atual.
 * @param {Array} milkRecords - Array de registros de leite (state.milk)
 * @returns {number} Média de litros por registro no mês atual
 */
export const getMonthAverage = (milkRecords) => {
  const mk = monthKey();
  const monthRecords = milkRecords.filter((r) => r.date && r.date.startsWith(mk));
  return monthRecords.length ? sumLiters(monthRecords) / monthRecords.length : 0;
};

/**
 * Conta o número de animais em lactação.
 * @returns {number} Quantidade de animais com status "Em lactação"
 */
export const countLactating = () => state.animals.filter((a) => a.status === "Em lactação").length;
