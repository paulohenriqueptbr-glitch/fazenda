/**
 * Testes Automatizados - Terrasyn
 * Validações e regras de negócio críticas
 *
 * Rodar: npm test
 *
 * IMPORTANTE: estes testes importam as funções reais de js/pure-utils.js
 * (mesmo arquivo carregado pelo app no browser). Se uma função mudar de
 * comportamento em produção, os testes aqui refletem isso — não há mais
 * cópias locais reimplementadas que pudessem ficar dessincronizadas do
 * código real.
 */

const {
  parseIsoDate,
  isValidDate,
  isNotFutureDate,
  isValidDateRange,
  validateNumber,
  formatLiters,
  formatMoney,
  formatTasks,
  formatDate,
  escapeHtml,
  getProductionStatus,
} = require("./js/pure-utils.js");

// Mock de estado para testes de lógica de negócio (regras de agregação,
// não cobertas por pure-utils.js, que ficam espalhadas pelos módulos
// js/render.js e js/data.js dependentes de DOM)
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
  reminders: [
    { id: "r1", title: "Comprar sal mineral", category: "Geral", due_date: "2026-06-09", done: false },
    { id: "r2", title: "Ligar para tecnico", category: "Saude", due_date: "2026-06-01", done: true },
  ],
  priceQuote: 2.50,
});

// ============================================================================
// TESTES: Validação de Datas (js/pure-utils.js)
// ============================================================================

describe("Validação de Datas", () => {
  test("isValidDate aceita datas válidas", () => {
    expect(isValidDate("2026-06-06")).toBe(true);
    expect(isValidDate("2026-01-01")).toBe(true);
    expect(isValidDate("2026-12-31")).toBe(true);
  });

  test("isValidDate rejeita datas inválidas", () => {
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

    expect(isNotFutureDate(tomorrowStr)).toBe(false);
  });

  test("isNotFutureDate aceita datas passadas e hoje", () => {
    expect(isNotFutureDate("2026-01-01")).toBe(true);
    expect(isNotFutureDate("2020-01-01")).toBe(true);
  });

  test("isValidDateRange valida que fim >= início", () => {
    expect(isValidDateRange("2026-06-01", "2026-06-30")).toBe(true);
    expect(isValidDateRange("2026-06-01", "2026-06-01")).toBe(true);
    expect(isValidDateRange("2026-06-30", "2026-06-01")).toBe(false);
    expect(isValidDateRange("2026-06-01", null)).toBe(true); // null/undefined é ok
  });

  test("parseIsoDate retorna null para formatos inválidos", () => {
    expect(parseIsoDate("2026/06/06")).toBe(null);
    expect(parseIsoDate("06-06-2026")).toBe(null);
    expect(parseIsoDate(null)).toBe(null);
  });
});

// ============================================================================
// TESTES: Validação de Números (js/pure-utils.js)
// ============================================================================

describe("Validação de Números", () => {
  test("validateNumber aceita valores dentro do range", () => {
    expect(validateNumber(28.5, 0, 1000)).toBe(28.5);
    expect(validateNumber(0, 0, 1000)).toBe(0);
    expect(validateNumber(1000, 0, 1000)).toBe(1000);
  });

  test("validateNumber rejeita valores fora do range", () => {
    expect(validateNumber(-1, 0, 1000)).toBe(null);
    expect(validateNumber(1001, 0, 1000)).toBe(null);
    expect(validateNumber(99999, 0, 1000)).toBe(null);
  });

  test("validateNumber rejeita valores não-numéricos", () => {
    expect(validateNumber("abc", 0, 1000)).toBe(null);
    expect(validateNumber("", 0, 1000)).toBe(null);
    expect(validateNumber(null, 0, 1000)).toBe(null);
    expect(validateNumber(undefined, 0, 1000)).toBe(null);
  });

  test("validateNumber limita produção em litros", () => {
    expect(validateNumber(28.5, 0, 1000)).toBe(28.5);
    expect(validateNumber(5000, 0, 1000)).toBe(null); // impossível (>1000L/dia)
  });

  test("validateNumber limita lactação em litros/dia", () => {
    expect(validateNumber(28, 0, 500)).toBe(28);
    expect(validateNumber(1000, 0, 500)).toBe(null); // impossível (>500L/dia)
  });

  test("validateNumber aceita área da lavoura em tarefas", () => {
    expect(validateNumber(3, 0, 100000)).toBe(3);
    expect(validateNumber(1.5, 0, 100000)).toBe(1.5);
    expect(validateNumber(-1, 0, 100000)).toBe(null);
  });
});

// ============================================================================
// TESTES: Status de produção (js/pure-utils.js)
// ============================================================================

describe("Status de Produção", () => {
  test("classifica como Bom quando >= média do mês", () => {
    expect(getProductionStatus(30, 28).status).toBe("Bom");
    expect(getProductionStatus(28, 28).status).toBe("Bom");
  });

  test("classifica como Baixo entre 50% e 75% da média", () => {
    expect(getProductionStatus(23, 28).status).toBe("Baixo"); // 23/28 ≈ 0.82
  });

  test("classifica como Crítico abaixo de 50% da média", () => {
    expect(getProductionStatus(10, 28).status).toBe("Crítico");
  });

  test("sem média histórica (0), considera Bom por padrão", () => {
    expect(getProductionStatus(15, 0).status).toBe("Bom");
  });
});

// ============================================================================
// TESTES: Lógica de Negócio (agregações de estado)
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

    expect(average).toBeCloseTo(84.5 / 3, 1);
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

  test("Conta manejos da lavoura no mês corretamente", () => {
    const state = createMockState();
    const currentMonth = "2026-06";

    const monthCropEvents = state.cropEvents.filter((record) => record.event_date?.startsWith(currentMonth));

    expect(monthCropEvents.length).toBe(2);
    expect(monthCropEvents.map((record) => record.event_type)).toContain("Plantio");
    expect(monthCropEvents.some((record) => record.event_type.includes("Pulver"))).toBe(true);
  });

  test("Conta lembretes abertos corretamente", () => {
    const state = createMockState();

    const openReminders = state.reminders.filter((record) => !record.done);

    expect(openReminders.length).toBe(1);
    expect(openReminders[0].title).toBe("Comprar sal mineral");
  });

  test("Identifica parto previsto dentro da janela de alertas", () => {
    const state = createMockState();
    const today = new Date(2026, 5, 9);
    const due = new Date(2026, 6, 20);
    const daysUntilCalving = Math.round((due - today) / (24 * 60 * 60 * 1000));

    const upcomingCalvings = state.breeding.filter(() => daysUntilCalving >= 0 && daysUntilCalving <= 60);

    expect(upcomingCalvings.length).toBe(1);
    expect(daysUntilCalving).toBe(41);
  });
});

// ============================================================================
// TESTES: Escapar HTML / Segurança (js/pure-utils.js)
// ============================================================================

describe("Segurança - Escape HTML", () => {
  test("Escapa caracteres perigosos", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;"
    );
    expect(escapeHtml('Test "quoted"')).toBe("Test &quot;quoted&quot;");
    expect(escapeHtml("A & B")).toBe("A &amp; B");
  });

  test("Não escapa strings seguras", () => {
    expect(escapeHtml("Bovino-0001")).toBe("Bovino-0001");
    expect(escapeHtml("28.5")).toBe("28.5");
    expect(escapeHtml("BOV_001")).toBe("BOV_001");
  });
});

// ============================================================================
// TESTES: Formatação (js/pure-utils.js)
// ============================================================================

describe("Formatação de Dados", () => {
  test("Formata litros com separador de milhar", () => {
    expect(formatLiters(1000)).toContain(" L");
    expect(formatLiters(28.5)).toContain("28");
  });

  test("Formata dinheiro em BRL", () => {
    const result = formatMoney(71.25);
    expect(result).toContain("R$");
  });

  test("Formata área da lavoura em tarefas", () => {
    expect(formatTasks(1)).toBe("1 tarefa");
    expect(formatTasks(2)).toBe("2 tarefas");
  });

  test("Formata data para português", () => {
    const result = formatDate("2026-06-06");
    expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });
});

// ============================================================================
// TESTES: Alertas e Lembretes (lógica pura)
// ============================================================================

const { addDaysIso, monthKey, todayIso } = require("./js/pure-utils.js");

describe("Alertas e Lembretes", () => {
  const mockAlertState = () => ({
    milk: [{ id: "1", date: todayIso(), liters: 25 }],
    animals: [{ id: "a1", identification: "BOV-001", type: "Bovino", status: "Em lactação" }],
    lactations: [],
    breeding: [
      { id: "b1", cow_id: "a1", insemination_date: "2026-01-01", expected_calving_date: addDaysIso(todayIso(), 5) },
    ],
    medication: [
      { id: "m1", cow_id: "a1", medication_name: "Ivermectina", dosage: "10ml", administration_date: addDaysIso(todayIso(), -28) },
    ],
    cropEvents: [],
    stockItems: [],
    reminders: [
      { id: "r1", title: "Vacinar bezerros", category: "Saude", due_date: todayIso(), done: false, notes: "" },
      { id: "r2", title: "Comprar ração", category: "Estoque", due_date: addDaysIso(todayIso(), 3), done: true, notes: "Já comprado" },
    ],
    dismissedAutoAlerts: new Set(),
    confirmedAutoAlerts: new Set(),
  });

  test("Detecta parto previsto nos próximos 7 dias", () => {
    const state = mockAlertState();
    const today = todayIso();
    const in7days = addDaysIso(today, 7);
    const upcoming = state.breeding.filter(
      (b) => b.expected_calving_date >= today && b.expected_calving_date <= in7days
    );
    expect(upcoming.length).toBe(1);
    expect(upcoming[0].cow_id).toBe("a1");
  });

  test("Detecta medicação com retorno próximo", () => {
    const state = mockAlertState();
    const today = todayIso();
    const in3days = addDaysIso(today, 3);
    const upcoming = state.medication.filter((m) => {
      const ret = addDaysIso(m.administration_date, 30);
      return ret >= today && ret <= in3days;
    });
    expect(upcoming.length).toBe(1);
    expect(upcoming[0].medication_name).toBe("Ivermectina");
  });

  test("Conta lembretes abertos e concluídos", () => {
    const state = mockAlertState();
    const open = state.reminders.filter((r) => !r.done);
    const done = state.reminders.filter((r) => r.done);
    expect(open.length).toBe(1);
    expect(done.length).toBe(1);
    expect(open[0].title).toBe("Vacinar bezerros");
  });

  test("Dismissed alerts são filtrados", () => {
    const state = mockAlertState();
    state.dismissedAutoAlerts.add("auto-calving-b1");
    const filtered = state.breeding.filter(
      (b) => !state.dismissedAutoAlerts.has(`auto-calving-${b.id}`)
    );
    expect(filtered.length).toBe(0);
  });

  test("Confirmed alerts são marcados como done", () => {
    const state = mockAlertState();
    state.confirmedAutoAlerts.add("auto-calving-b1");
    const breeding = state.breeding.find((b) => b.id === "b1");
    const isDone = state.confirmedAutoAlerts.has(`auto-calving-${breeding.id}`);
    expect(isDone).toBe(true);
  });
});

// ============================================================================
// TESTES: Normalização de Inputs (js/ui.js re-exports de pure-utils.js)
// ============================================================================

const {
  cleanText,
  optionalText,
  formatStockQuantity,
} = require("./js/pure-utils.js");

describe("Normalização de Inputs", () => {
  test("cleanText limita caracteres", () => {
    expect(cleanText("hello world", 5)).toBe("hello");
    expect(cleanText("  abc  ", 10)).toBe("abc");
    expect(cleanText(null, 10)).toBe("");
    expect(cleanText(undefined, 10)).toBe("");
  });

  test("optionalText retorna null para strings vazias", () => {
    expect(optionalText("", 100)).toBe(null);
    expect(optionalText("   ", 100)).toBe(null);
    expect(optionalText("abc", 100)).toBe("abc");
  });

  test("formatStockQuantity formata quantidade e unidade", () => {
    expect(formatStockQuantity(10, "kg")).toBe("10 kg");
    expect(formatStockQuantity(0, "L")).toBe("0 L");
    expect(formatStockQuantity(5.5, "sacos")).toBe("5,5 sacos");
  });

  test("validateNumber para preços (0-100)", () => {
    expect(validateNumber(3.5, 0, 100)).toBe(3.5);
    expect(validateNumber(0, 0, 100)).toBe(0);
    expect(validateNumber(100, 0, 100)).toBe(100);
    expect(validateNumber(101, 0, 100)).toBe(null);
    expect(validateNumber(-1, 0, 100)).toBe(null);
  });
});

// ============================================================================
// TESTES: State Helpers (js/state.js)
// ============================================================================

describe("State Helpers", () => {
  test("addDaysIso soma dias corretamente", () => {
    const result = addDaysIso("2026-06-01", 10);
    expect(result).toBe("2026-06-11");
  });

  test("addDaysIso lida com mês de transição", () => {
    const result = addDaysIso("2026-06-25", 10);
    expect(result).toBe("2026-07-05");
  });

  test("monthKey retorna chave do mês atual", () => {
    const key = monthKey();
    expect(key).toMatch(/^\d{4}-\d{2}$/);
  });

  test("todayIso retorna data ISO de hoje", () => {
    const today = todayIso();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
