// ─── Re-exports from pure-utils.js ──────────────────────────────────────────
// Importa funções puras de pure-utils.js e re-exporta para manter compatibilidade.
// Isso garante que testes (app.test.js) e app real usam a mesma implementação.
export {
  formatLiters,
  formatMoney,
  formatTasks,
  formatStockQuantity,
  formatDate,
  escapeHtml,
  isValidDate,
  isNotFutureDate,
  isValidDateRange,
  validateNumber,
  cleanText,
  optionalText,
  getProductionStatus,
  createStatusBadge,
} from "./pure-utils.js";

// ─── Toast ──────────────────────────────────────────────────────────────────
export const showToast = (message, type = "success") => {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("is-hiding");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

// ─── Loading em botões ──────────────────────────────────────────────────────
export const withButtonLoading = (form, asyncFn, loadingText = "Salvando...") => {
  return async (...args) => {
    const btn = form?.querySelector('button[type="submit"]');
    const original = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = loadingText; }
    try { return await asyncFn(...args); } finally { if (btn) { btn.disabled = false; btn.textContent = original; } }
  };
};

// ─── Validação inline ───────────────────────────────────────────────────────
export const addInlineValidation = (inputEl, validateFn) => {
  if (!inputEl || inputEl._inlineValidation) return;
  inputEl._inlineValidation = true;
  let errorEl = inputEl.nextElementSibling;
  if (!errorEl || !errorEl.classList.contains("field-error")) {
    errorEl = document.createElement("span");
    errorEl.className = "field-error";
    inputEl.insertAdjacentElement("afterend", errorEl);
  }
  const validate = () => {
    const msg = validateFn(inputEl.value);
    errorEl.textContent = msg || "";
    inputEl.classList.toggle("input-error", Boolean(msg));
  };
  inputEl.addEventListener("blur", validate);
  inputEl.addEventListener("input", () => { if (inputEl.classList.contains("input-error")) validate(); });
};

export const empty = (text) => `<p class="empty">${escapeHtml(text)}</p>`;

// ─── Normalização de inputs ─────────────────────────────────────────────────
export const normalizeCropEventInput = (data) => {
  const plotName = cleanText(data.plot_name ?? data.plotName, 100);
  const cropName = cleanText(data.crop_name ?? data.cropName, 100);
  const eventType = cleanText(data.event_type ?? data.eventType, 80);
  const eventDate = String(data.event_date ?? data.eventDate ?? "");
  const areaRaw = data.area_tasks ?? data.areaTasks ?? "";
  const areaTasks = areaRaw === "" || areaRaw === null || areaRaw === undefined ? null : validateNumber(areaRaw, 0, 100000);
  if (!plotName) throw new Error("Talhao/area deve ter 1-100 caracteres");
  if (!cropName) throw new Error("Cultura deve ter 1-100 caracteres");
  if (!eventType) throw new Error("Manejo deve ter 1-80 caracteres");
  if (!isValidDate(eventDate)) throw new Error("Data invalida");
  if (!isNotFutureDate(eventDate)) throw new Error("Nao pode registrar manejo futuro");
  if (areaTasks === null && areaRaw !== "" && areaRaw !== null && areaRaw !== undefined) throw new Error("Area em tarefas invalida");
  return {
    plot_name: plotName, crop_name: cropName, event_type: eventType, event_date: eventDate,
    product: optionalText(data.product, 120), dosage: optionalText(data.dosage, 80),
    area_tasks: areaTasks, notes: optionalText(data.notes, 500),
  };
};

export const normalizeStockItemInput = (data) => {
  const itemName = cleanText(data.item_name ?? data.itemName, 120);
  const category = cleanText(data.category || "Insumo", 60) || "Insumo";
  const quantity = validateNumber(data.quantity, 0, 1000000);
  const unit = cleanText(data.unit, 30);
  const minRaw = data.min_quantity ?? data.minQuantity ?? "";
  const minQuantity = minRaw === "" || minRaw === null || minRaw === undefined ? null : validateNumber(minRaw, 0, 1000000);
  if (!itemName) throw new Error("Item deve ter 1-120 caracteres");
  if (quantity === null) throw new Error("Quantidade invalida");
  if (!unit) throw new Error("Unidade deve ter 1-30 caracteres");
  if (minQuantity === null && minRaw !== "" && minRaw !== null && minRaw !== undefined) throw new Error("Estoque minimo invalido");
  return { item_name: itemName, category, quantity, unit, min_quantity: minQuantity, notes: optionalText(data.notes, 300) };
};

export const normalizeReminderInput = (data) => {
  const title = cleanText(data.title, 120);
  const dueDate = String(data.due_date ?? data.dueDate ?? "");
  const category = cleanText(data.category || "Geral", 40) || "Geral";
  const notes = optionalText(data.notes, 300);
  const done = Boolean(data.done);
  if (!title) throw new Error("Lembrete deve ter 1-120 caracteres");
  if (!isValidDate(dueDate)) throw new Error("Data do lembrete invalida");
  return { title, category, due_date: dueDate, notes, done, completed_at: done ? (data.completed_at || new Date().toISOString()) : null };
};
