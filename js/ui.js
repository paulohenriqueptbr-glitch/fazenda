// ─── Imports and Re-exports from pure-utils.js ──────────────────────────────
// Importa funções puras de pure-utils.js para uso local E re-exporta para manter compatibilidade.
// NOTA: re-export alone (export { X } from) NÃO cria binding local — usar import separado.
import {
  escapeHtml,
  cleanText,
  optionalText,
  validateNumber,
  isValidDate,
  isNotFutureDate,
} from "./pure-utils.js";

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
  toggleTheme,
  updateThemeToggleIcon,
  getPreferredTheme,
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

// ─── Empty states ilustrados ────────────────────────────────────────────────
const emptyIcons = {
  milk: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2h8l2 6H6l2-6z"/><path d="M6 8v10a2 2 0 002 2h8a2 2 0 002-2V8"/></svg>`,
  animal: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 5.172C10 3.782 8.883 2.3 7.5 2.3S5 3.782 5 5.172c0 1.39 2.5 3.828 2.5 3.828S10 6.562 10 5.172z"/><path d="M19 5.172C19 3.782 17.883 2.3 16.5 2.3S14 3.782 14 5.172c0 1.39 2.5 3.828 2.5 3.828S19 6.562 19 5.172z"/><path d="M12 22c-4 0-7-2-7-5 0-2 1-3 2-4l1-1c1-1 2-2 4-2s3 1 4 2l1 1c1 1 2 2 2 4 0 3-3 5-7 5z"/></svg>`,
  breeding: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7z"/></svg>`,
  medication: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2l4 4-8 8-4-4 8-8z"/><path d="M9 15l-4 4"/><path d="M7 12l-4 4"/><path d="M12 12l-3 3"/><path d="M15 9l-3 3"/></svg>`,
  crop: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V8"/><path d="M5 12H2a10 10 0 0020 0h-3"/><path d="M12 8a6 6 0 00-6-6c0 3 2 5 6 6"/><path d="M12 8a6 6 0 016-6c0 3-2 5-6 6"/></svg>`,
  stock: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/></svg>`,
  alert: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>`,
  medical: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
  default: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>`,
};

export const empty = (text, type = "default") => {
  const icon = emptyIcons[type] || emptyIcons.default;
  return `<div class="empty-state" data-type="${escapeHtml(type)}">
    <div class="empty-state-icon">${icon}</div>
    <p class="empty-state-title">${escapeHtml(text)}</p>
  </div>`;
};

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
