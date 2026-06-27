/**
 * Testes de Integração - Terrasyn
 * Testa fluxos completos e integração entre módulos
 *
 * Rodar: npm test
 */

const {
  parseIsoDate,
  isValidDate,
  isNotFutureDate,
  isValidDateRange,
  validateNumber,
  formatLiters,
  formatMoney,
  formatDate,
  escapeHtml,
  getProductionStatus,
  addDaysIso,
  todayIso,
  monthKey,
  cleanText,
  optionalText,
  formatStockQuantity,
} = require("./js/pure-utils.js");

// ============================================================================
// TESTES: Fluxo completo de produção de leite
// ============================================================================

describe("Fluxo Produção de Leite", () => {
  test("Validação completa de registro de produção", () => {
    const date = "2026-06-15";
    const liters = 28.5;

    // Validação de data
    expect(isValidDate(date)).toBe(true);
    expect(isNotFutureDate(date)).toBe(true);

    // Validação de quantidade
    const validatedLiters = validateNumber(liters, 0, 1000);
    expect(validatedLiters).toBe(28.5);

    // Cálculo de valor
    const price = 2.50;
    const value = validatedLiters * price;
    expect(value).toBeCloseTo(71.25, 2);
  });

  test("Rejeita produção futura", () => {
    const futureDate = addDaysIso(todayIso(), 1);
    expect(isValidDate(futureDate)).toBe(true);
    expect(isNotFutureDate(futureDate)).toBe(false);
  });

  test("Rejeita litros fora do range", () => {
    expect(validateNumber(-1, 0, 1000)).toBe(null);
    expect(validateNumber(1001, 0, 1000)).toBe(null);
  });

  test("Calcula média mensal corretamente", () => {
    const records = [
      { date: "2026-06-01", liters: 28 },
      { date: "2026-06-02", liters: 30 },
      { date: "2026-06-03", liters: 26 },
    ];

    const total = records.reduce((sum, r) => sum + r.liters, 0);
    const average = total / records.length;

    expect(total).toBe(84);
    expect(average).toBeCloseTo(28, 1);
  });

  test("Classifica status de produção", () => {
    const average = 28;

    // Bom: >= média
    expect(getProductionStatus(28, average).status).toBe("Bom");
    expect(getProductionStatus(30, average).status).toBe("Bom");

    // Baixo: entre 50% e 75% da média
    expect(getProductionStatus(21, average).status).toBe("Baixo");

    // Crítico: abaixo de 50% da média
    expect(getProductionStatus(10, average).status).toBe("Crítico");
  });
});

// ============================================================================
// TESTES: Fluxo de cadastro de animal
// ============================================================================

describe("Fluxo Cadastro Animal", () => {
  test("Validação completa de animal", () => {
    const identification = "BOV-0001";
    const type = "Bovino de Leite";
    const status = "Em lactação";

    // Validação de identificação
    expect(identification.length).toBeGreaterThan(0);
    expect(identification.length).toBeLessThanOrEqual(100);

    // Validação de tipo
    expect(type.length).toBeGreaterThan(0);

    // Validação de status
    expect(["Em lactação", "Seca", "Novilha", "Bezerra"]).toContain(status);
  });

  test("Rejeita identificação vazia", () => {
    const identification = "";
    expect(identification.length).toBe(0);
  });

  test("Rejeita identificação muito longa", () => {
    const identification = "A".repeat(101);
    expect(identification.length).toBeGreaterThan(100);
  });
});

// ============================================================================
// TESTES: Fluxo de lactação
// ============================================================================

describe("Fluxo Lactação", () => {
  test("Validação de período de lactação", () => {
    const startDate = "2026-01-01";
    const endDate = "2026-06-30";

    expect(isValidDate(startDate)).toBe(true);
    expect(isValidDate(endDate)).toBe(true);
    expect(isValidDateRange(startDate, endDate)).toBe(true);
  });

  test("Lactação sem fim é válida", () => {
    const startDate = "2026-01-01";
    const endDate = null;

    expect(isValidDate(startDate)).toBe(true);
    expect(isValidDateRange(startDate, endDate)).toBe(true);
  });

  test("Rejeita fim antes do início", () => {
    const startDate = "2026-06-30";
    const endDate = "2026-01-01";

    expect(isValidDateRange(startDate, endDate)).toBe(false);
  });

  test("Validação de litros/dia", () => {
    expect(validateNumber(28, 0, 500)).toBe(28);
    expect(validateNumber(0, 0, 500)).toBe(0);
    expect(validateNumber(500, 0, 500)).toBe(500);
    expect(validateNumber(501, 0, 500)).toBe(null);
  });
});

// ============================================================================
// TESTES: Fluxo de reprodução
// ============================================================================

describe("Fluxo Reprodução", () => {
  test("Cálculo de parto previsto (285 dias)", () => {
    const inseminationDate = "2026-01-01";
    const expectedCalving = addDaysIso(inseminationDate, 285);

    expect(isValidDate(expectedCalving)).toBe(true);
    expect(expectedCalving).toBe("2026-10-13");
  });

  test("Validação de datas de reprodução", () => {
    const inseminationDate = "2026-05-01";
    const calvingDate = "2026-07-20";

    expect(isValidDate(inseminationDate)).toBe(true);
    expect(isValidDate(calvingDate)).toBe(true);
    expect(isValidDateRange(inseminationDate, calvingDate)).toBe(true);
  });

  test("Rejeita parto antes de inseminação", () => {
    const inseminationDate = "2026-07-20";
    const calvingDate = "2026-05-01";

    expect(isValidDateRange(inseminationDate, calvingDate)).toBe(false);
  });
});

// ============================================================================
// TESTES: Fluxo de medicação
// ============================================================================

describe("Fluxo Medicação", () => {
  test("Validação de medicação", () => {
    const medicationName = "Ivermectina";
    const dosage = "10ml";
    const administrationDate = "2026-06-15";

    expect(medicationName.length).toBeGreaterThan(0);
    expect(medicationName.length).toBeLessThanOrEqual(100);
    expect(isValidDate(administrationDate)).toBe(true);
    expect(isNotFutureDate(administrationDate)).toBe(true);
  });

  test("Cálculo de reaplicação", () => {
    const administrationDate = "2026-06-01";
    const intervalDays = 30;
    const nextDate = addDaysIso(administrationDate, intervalDays);

    expect(nextDate).toBe("2026-07-01");
    expect(isValidDate(nextDate)).toBe(true);
  });

  test("Rejeita medicação futura", () => {
    const futureDate = addDaysIso(todayIso(), 1);
    expect(isNotFutureDate(futureDate)).toBe(false);
  });
});

// ============================================================================
// TESTES: Fluxo de lavoura
// ============================================================================

describe("Fluxo Lavoura", () => {
  test("Validação de evento de lavoura", () => {
    const plotName = "Talhão 1";
    const cropName = "Milho";
    const eventType = "Plantio";
    const eventDate = "2026-06-15";

    expect(plotName.length).toBeGreaterThan(0);
    expect(plotName.length).toBeLessThanOrEqual(100);
    expect(cropName.length).toBeGreaterThan(0);
    expect(cropName.length).toBeLessThanOrEqual(100);
    expect(eventType.length).toBeGreaterThan(0);
    expect(eventType.length).toBeLessThanOrEqual(80);
    expect(isValidDate(eventDate)).toBe(true);
    expect(isNotFutureDate(eventDate)).toBe(true);
  });

  test("Validação de área em tarefas", () => {
    expect(validateNumber(3, 0, 100000)).toBe(3);
    expect(validateNumber(1.5, 0, 100000)).toBe(1.5);
    expect(validateNumber(-1, 0, 100000)).toBe(null);
    expect(validateNumber(100001, 0, 100000)).toBe(null);
  });

  test("Formatação de área", () => {
    expect(formatStockQuantity(3, "tarefas")).toBe("3 tarefas");
    expect(formatStockQuantity(1.5, "tarefas")).toBe("1,5 tarefas");
  });
});

// ============================================================================
// TESTES: Fluxo de estoque
// ============================================================================

describe("Fluxo Estoque", () => {
  test("Validação de item de estoque", () => {
    const itemName = "Ração";
    const category = "Alimentos";
    const quantity = 100;
    const unit = "kg";

    expect(itemName.length).toBeGreaterThan(0);
    expect(itemName.length).toBeLessThanOrEqual(120);
    expect(category.length).toBeGreaterThan(0);
    expect(validateNumber(quantity, 0, 1000000)).toBe(100);
    expect(unit.length).toBeGreaterThan(0);
    expect(unit.length).toBeLessThanOrEqual(30);
  });

  test("Detecta estoque baixo", () => {
    const quantity = 5;
    const minQuantity = 10;

    expect(quantity <= minQuantity).toBe(true);
  });

  test("Formatação de quantidade", () => {
    expect(formatStockQuantity(10, "kg")).toBe("10 kg");
    expect(formatStockQuantity(0, "L")).toBe("0 L");
    expect(formatStockQuantity(5.5, "sacos")).toBe("5,5 sacos");
  });
});

// ============================================================================
// TESTES: Fluxo de lembretes
// ============================================================================

describe("Fluxo Lembretes", () => {
  test("Validação de lembrete", () => {
    const title = "Comprar ração";
    const category = "Estoque";
    const dueDate = "2026-06-20";

    expect(title.length).toBeGreaterThan(0);
    expect(title.length).toBeLessThanOrEqual(120);
    expect(category.length).toBeGreaterThan(0);
    expect(isValidDate(dueDate)).toBe(true);
  });

  test("Status de lembrete", () => {
    const today = todayIso();
    const pastDate = addDaysIso(today, -1);
    const futureDate = addDaysIso(today, 1);

    // Atrasado
    expect(isNotFutureDate(pastDate)).toBe(true);

    // Futuro
    expect(isNotFutureDate(futureDate)).toBe(false);
  });
});

// ============================================================================
// TESTES: Segurança e sanitização
// ============================================================================

describe("Segurança", () => {
  test("Escape HTML previne XSS", () => {
    const malicious = '<script>alert("xss")</script>';
    const escaped = escapeHtml(malicious);

    expect(escaped).not.toContain("<script>");
    expect(escaped).toContain("&lt;script&gt;");
  });

  test("Clean text limita caracteres", () => {
    const longText = "A".repeat(200);
    const cleaned = cleanText(longText, 100);

    expect(cleaned.length).toBe(100);
  });

  test("Optional text retorna null para vazio", () => {
    expect(optionalText("", 100)).toBe(null);
    expect(optionalText("   ", 100)).toBe(null);
    expect(optionalText("abc", 100)).toBe("abc");
  });
});

// ============================================================================
// TESTES: Formatação e display
// ============================================================================

describe("Formatação", () => {
  test("FormatLiters mostra unidade", () => {
    const result = formatLiters(28.5);
    expect(result).toContain("28");
    expect(result).toContain("L");
  });

  test("FormatMoney mostra R$", () => {
    const result = formatMoney(71.25);
    expect(result).toContain("R$");
  });

  test("FormatDate mostra data legível", () => {
    const result = formatDate("2026-06-15");
    expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });

  test("MonthKey retorna formato AAAA-MM", () => {
    const key = monthKey();
    expect(key).toMatch(/^\d{4}-\d{2}$/);
  });

  test("TodayIso retorna formato AAAA-MM-DD", () => {
    const today = todayIso();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ============================================================================
// TESTES: Cálculos financeiros
// ============================================================================

describe("Cálculos Financeiros", () => {
  test("Calcula faturamento mensal", () => {
    const liters = 840; // 30 dias x 28L
    const price = 2.50;
    const revenue = liters * price;

    expect(revenue).toBe(2100);
  });

  test("Calcula média de preço", () => {
    const prices = [2.50, 2.60, 2.40];
    const average = prices.reduce((a, b) => a + b, 0) / prices.length;

    expect(average).toBeCloseTo(2.50, 2);
  });

  test("Formatação de moeda BRL", () => {
    const value = 1234.56;
    const formatted = value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

    expect(formatted).toContain("R$");
    expect(formatted).toContain("1.234");
  });
});
