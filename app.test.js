/**
 * Testes Automatizados - Controle Fazenda
 * Validações e regras de negócio críticas
 * 
 * Rodar: npm test
 */

// Mock das funções que dependem do DOM
const createMockState = () => ({
  milk: [
    { id: "1", date: "2026-06-06", liters: 28.5 },
    { id: "2", date: "2026-06-05", liters: 26.0 },
    { id: "3", date: "2026-06-04", liters: 30.0 },
  ],
  animals: [
    { id: "11111111-1111-4111-8111-111111111111", identification: "BOV-0001", type: "Bovino", status: "Em lactação" },
    { id: "22222222-2222-4222-8222-222222222222", identification: "BOV-0002", type: "Bovino", status: "Seca" },
  ],
  lactations: [
    { id: "l1", cow_id: "11111111-1111-4111-8111-111111111111", start_date: "2026-01-01", daily_liters: 28 },
  ],
  breeding: [
    { id: "b1", cow_id: "22222222-2222-4222-8222-222222222222", insemination_date: "2026-05-01", expected_calving_date: "2026-07-20" },
  ],
  medication: [
    { id: "m1", cow_id: "11111111-1111-4111-8111-111111111111", medication_name: "Antibiótico X", dosage: "500mg", administration_date: "2026-06-05" },
  ],
  cropEvents: [
    { id: "c1", plot_name: "Talhão 1", crop_name: "Milho", event_type: "Plantio", event_date: "2026-06-02", area_tasks: 3 },
    { id: "c2", plot_name: "Talhão 2", crop_name: "Capim", event_type: "Pulverização", event_date: "2026-06-07", area_tasks: 1.5 },
  ],
  priceQuote: 2.50,
});

// ============================================================================
// TESTES: Validação de Datas
// ============================================================================

describe("Validação de Datas", () => {
  const parseIsoDate = (dateStr) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ""))) return null;
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
      ? date
      : null;
  };

  test("isValidDate aceita datas válidas", () => {
    const isValidDate = (dateStr) => Boolean(parseIsoDate(dateStr));
    
    expect(isValidDate("2026-06-06")).toBe(true);
    expect(isValidDate("2026-01-01")).toBe(true);
    expect(isValidDate("2026-12-31")).toBe(true);
  });

  test("isValidDate rejeita datas inválidas", () => {
    const isValidDate = (dateStr) => Boolean(parseIsoDate(dateStr));
    
    expect(isValidDate("2026-13-01")).toBe(false);
    expect(isValidDate("2026-06-31")).toBe(false);
    expect(isValidDate("invalid")).toBe(false);
    expect(isValidDate("")).toBe(false);
  });

  test("isNotFutureDate rejeita datas futuras", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    const isNotFutureDate = (dateStr) => {
      const date = parseIsoDate(dateStr);
      if (!date) return false;
      const todayCheck = new Date();
      todayCheck.setHours(0, 0, 0, 0);
      return date <= todayCheck;
    };

    expect(isNotFutureDate(tomorrowStr)).toBe(false);
  });

  test("isNotFutureDate aceita datas passadas e hoje", () => {
    const isNotFutureDate = (dateStr) => {
      const date = parseIsoDate(dateStr);
      if (!date) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return date <= today;
    };

    expect(isNotFutureDate("2026-01-01")).toBe(true);
    expect(isNotFutureDate("2020-01-01")).toBe(true);
  });

  test("isValidDateRange valida que fim >= início", () => {
    const isValidDateRange = (startStr, endStr) => {
      if (!endStr) return true;
      const start = parseIsoDate(startStr);
      const end = parseIsoDate(endStr);
      if (!start || !end) return false;
      return start <= end;
    };

    expect(isValidDateRange("2026-06-01", "2026-06-30")).toBe(true);
    expect(isValidDateRange("2026-06-01", "2026-06-01")).toBe(true);
    expect(isValidDateRange("2026-06-30", "2026-06-01")).toBe(false);
    expect(isValidDateRange("2026-06-01", null)).toBe(true); // null/undefined é ok
  });
});

// ============================================================================
// TESTES: Validação de Números
// ============================================================================

describe("Validação de Números", () => {
  test("validateNumber aceita valores dentro do range", () => {
    const validateNumber = (value, min = 0, max = 10000) => {
      const num = Number.parseFloat(value);
      return Number.isFinite(num) && num >= min && num <= max ? num : null;
    };

    expect(validateNumber(28.5, 0, 1000)).toBe(28.5);
    expect(validateNumber(0, 0, 1000)).toBe(0);
    expect(validateNumber(1000, 0, 1000)).toBe(1000);
  });

  test("validateNumber rejeita valores fora do range", () => {
    const validateNumber = (value, min = 0, max = 10000) => {
      const num = Number.parseFloat(value);
      return Number.isFinite(num) && num >= min && num <= max ? num : null;
    };

    expect(validateNumber(-1, 0, 1000)).toBe(null);
    expect(validateNumber(1001, 0, 1000)).toBe(null);
    expect(validateNumber(99999, 0, 1000)).toBe(null);
  });

  test("validateNumber rejeita valores não-numéricos", () => {
    const validateNumber = (value, min = 0, max = 10000) => {
      const num = Number.parseFloat(value);
      return Number.isFinite(num) && num >= min && num <= max ? num : null;
    };

    expect(validateNumber("abc", 0, 1000)).toBe(null);
    expect(validateNumber("", 0, 1000)).toBe(null);
    expect(validateNumber(null, 0, 1000)).toBe(null);
    expect(validateNumber(undefined, 0, 1000)).toBe(null);
  });

  test("validateNumber limita produção em litros", () => {
    const validateNumber = (value, min = 0, max = 10000) => {
      const num = Number.parseFloat(value);
      return Number.isFinite(num) && num >= min && num <= max ? num : null;
    };

    // Produção válida
    expect(validateNumber(28.5, 0, 1000)).toBe(28.5);
    
    // Produção impossível (>1000L/dia)
    expect(validateNumber(5000, 0, 1000)).toBe(null);
  });

  test("validateNumber limita lactação em litros/dia", () => {
    const validateNumber = (value, min = 0, max = 10000) => {
      const num = Number.parseFloat(value);
      return Number.isFinite(num) && num >= min && num <= max ? num : null;
    };

    // Lactação válida
    expect(validateNumber(28, 0, 500)).toBe(28);
    
    // Lactação impossível (>500L/dia)
    expect(validateNumber(1000, 0, 500)).toBe(null);
  });

  test("validateNumber aceita area da lavoura em tarefas", () => {
    const validateNumber = (value, min = 0, max = 10000) => {
      const num = Number.parseFloat(value);
      return Number.isFinite(num) && num >= min && num <= max ? num : null;
    };

    expect(validateNumber(3, 0, 100000)).toBe(3);
    expect(validateNumber(1.5, 0, 100000)).toBe(1.5);
    expect(validateNumber(-1, 0, 100000)).toBe(null);
  });
});

// ============================================================================
// TESTES: Validação de Strings
// ============================================================================

describe("Validação de Strings", () => {
  test("Valida comprimento de ID do animal (1-100 caracteres)", () => {
    const validateAnimalId = (id) => {
      const trimmed = id.trim();
      return trimmed.length > 0 && trimmed.length <= 100 ? trimmed : null;
    };

    expect(validateAnimalId("BOV-0001")).toBe("BOV-0001");
    expect(validateAnimalId("A")).toBe("A");
    expect(validateAnimalId("x".repeat(100))).toBe("x".repeat(100));
  });

  test("Rejeita strings vazias ou muito longas", () => {
    const validateAnimalId = (id) => {
      const trimmed = id.trim();
      return trimmed.length > 0 && trimmed.length <= 100 ? trimmed : null;
    };

    expect(validateAnimalId("")).toBe(null);
    expect(validateAnimalId("   ")).toBe(null);
    expect(validateAnimalId("x".repeat(101))).toBe(null);
  });

  test("Valida comprimento de medicamento", () => {
    const validateMedicine = (name) => {
      const trimmed = name.trim();
      return trimmed.length > 0 && trimmed.length <= 100 ? trimmed : null;
    };

    expect(validateMedicine("Antibiótico X")).toBe("Antibiótico X");
    expect(validateMedicine("")).toBe(null);
  });
});

// ============================================================================
// TESTES: Lógica de Negócio
// ============================================================================

describe("Lógica de Negócio", () => {
  test("Calcula produção mensal corretamente", () => {
    const state = createMockState();
    const currentMonth = "2026-06";
    
    const monthRecords = state.milk.filter((record) => record.date?.startsWith(currentMonth));
    const monthLiters = monthRecords.reduce((sum, record) => sum + Number(record.liters || 0), 0);
    
    expect(monthLiters).toBe(28.5 + 26.0 + 30.0); // 84.5
  });

  test("Calcula média mensal corretamente", () => {
    const state = createMockState();
    const currentMonth = "2026-06";
    
    const monthRecords = state.milk.filter((record) => record.date?.startsWith(currentMonth));
    const monthLiters = monthRecords.reduce((sum, record) => sum + Number(record.liters || 0), 0);
    const average = monthRecords.length ? monthLiters / monthRecords.length : 0;
    
    expect(average).toBeCloseTo((84.5 / 3), 1);
  });

  test("Identifica melhor dia de produção", () => {
    const state = createMockState();
    const currentMonth = "2026-06";
    
    const monthRecords = state.milk.filter((record) => record.date?.startsWith(currentMonth));
    const bestRecord = monthRecords.reduce(
      (best, record) => (Number(record.liters || 0) > Number(best?.liters || 0) ? record : best),
      null
    );
    
    expect(bestRecord.liters).toBe(30.0);
    expect(bestRecord.date).toBe("2026-06-04");
  });

  test("Conta animais em lactação corretamente", () => {
    const state = createMockState();
    const lactating = state.animals.filter((animal) => animal.status === "Em lactação").length;
    
    expect(lactating).toBe(1);
  });

  test("Calcula valor em dinheiro corretamente", () => {
    const state = createMockState();
    const liters = 28.5;
    const price = state.priceQuote;
    
    const value = liters * price;
    expect(value).toBeCloseTo(71.25, 2);
  });

  test("Identifica lactações ativas (sem data de fim)", () => {
    const state = createMockState();
    
    const activeLactations = state.lactations.filter((l) => !l.end_date);
    expect(activeLactations.length).toBe(1);
    expect(activeLactations[0].cow_id).toBe("11111111-1111-4111-8111-111111111111");
  });

  test("Calcula data de parto (285 dias após inseminação)", () => {
    const insemDate = new Date(2026, 4, 1);
    insemDate.setDate(insemDate.getDate() + 285);
    
    expect(insemDate.getFullYear()).toBe(2027);
    expect(insemDate.getMonth()).toBe(1); // Fevereiro (0-indexed)
    expect(insemDate.getDate()).toBe(10);
  });

  test("Conta manejos da lavoura no mes corretamente", () => {
    const state = createMockState();
    const currentMonth = "2026-06";

    const monthCropEvents = state.cropEvents.filter((record) => record.event_date?.startsWith(currentMonth));

    expect(monthCropEvents.length).toBe(2);
    expect(monthCropEvents.map((record) => record.event_type)).toContain("Plantio");
    expect(monthCropEvents.map((record) => record.event_type)).toContain("Pulverização");
  });
});

// ============================================================================
// TESTES: Escapar HTML (Segurança)
// ============================================================================

describe("Segurança - Escape HTML", () => {
  test("Escapa caracteres perigosos", () => {
    const escapeHtml = (value) =>
      String(value ?? "").replace(/[&<>"']/g, (character) => {
        const entities = {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        };
        return entities[character];
      });

    expect(escapeHtml("<script>alert('xss')</script>")).toBe("&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;");
    expect(escapeHtml('Test "quoted"')).toBe("Test &quot;quoted&quot;");
    expect(escapeHtml("A & B")).toBe("A &amp; B");
  });

  test("Não escapa strings seguras", () => {
    const escapeHtml = (value) =>
      String(value ?? "").replace(/[&<>"']/g, (character) => {
        const entities = {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        };
        return entities[character];
      });

    expect(escapeHtml("Bovino-0001")).toBe("Bovino-0001");
    expect(escapeHtml("28.5")).toBe("28.5");
    expect(escapeHtml("BOV_001")).toBe("BOV_001");
  });
});

// ============================================================================
// TESTES: Formatação
// ============================================================================

describe("Formatação de Dados", () => {
  test("Formata litros com separador de milhar", () => {
    const formatLiters = (value) => `${Number(value || 0).toLocaleString("pt-BR")} L`;
    
    expect(formatLiters(1000)).toContain(" L");
    expect(formatLiters(28.5)).toContain("28");
  });

  test("Formata dinheiro em BRL", () => {
    const formatMoney = (value) =>
      Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    const result = formatMoney(71.25);
    expect(result).toContain("R$");
  });

  test("Formata area da lavoura em tarefas", () => {
    const formatTasks = (value) => {
      const tasks = Number(value || 0);
      if (!tasks) return "";
      return `${tasks.toLocaleString("pt-BR")} tarefa${tasks === 1 ? "" : "s"}`;
    };

    expect(formatTasks(1)).toBe("1 tarefa");
    expect(formatTasks(2)).toBe("2 tarefas");
  });

  test("Formata data para português", () => {
    const formatDate = (isoDate) => {
      if (!isoDate) return "-";
      const [year, month, day] = isoDate.split("-");
      return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString("pt-BR");
    };

    const result = formatDate("2026-06-06");
    expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });
});

console.log("✅ Testes carregados! Execute com: npm test");
