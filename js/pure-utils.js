const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseIsoDate = (isoDate) => {
  if (!ISO_DATE_PATTERN.test(String(isoDate || ""))) return null;

  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
};

const todayIso = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

const addDaysIso = (isoDate, days) => {
  const date = parseIsoDate(isoDate) || parseIsoDate(todayIso());
  date.setDate(date.getDate() + Number(days || 0));
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const monthKey = () => todayIso().slice(0, 7);

const isValidDate = (dateStr) => Boolean(parseIsoDate(dateStr));

const isNotFutureDate = (dateStr) => {
  const date = parseIsoDate(dateStr);
  if (!date) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date <= today;
};

const isValidDateRange = (startStr, endStr) => {
  if (!endStr) return true;
  const start = parseIsoDate(startStr);
  const end = parseIsoDate(endStr);
  if (!start || !end) return false;

  return start <= end;
};

const validateNumber = (value, min = 0, max = 10000) => {
  const num = Number.parseFloat(value);
  return Number.isFinite(num) && num >= min && num <= max ? num : null;
};

const cleanText = (value, maxLength) => String(value || "").trim().slice(0, maxLength);

const optionalText = (value, maxLength) => cleanText(value, maxLength) || null;

const formatLiters = (value) => `${Number(value || 0).toLocaleString("pt-BR")} L`;

const formatMoney = (value) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatTasks = (value) => {
  const tasks = Number(value || 0);
  if (!tasks) return "";
  return `${tasks.toLocaleString("pt-BR")} tarefa${tasks === 1 ? "" : "s"}`;
};

const formatStockQuantity = (quantity, unit) =>
  `${Number(quantity || 0).toLocaleString("pt-BR")} ${String(unit || "").trim()}`.trim();

const formatDate = (isoDate) => {
  if (!isoDate) return "-";
  const [year, month, day] = isoDate.split("-");
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString("pt-BR");
};

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

const PRODUCTION_THRESHOLDS = {
  critical: 0.5,
  warning: 0.75,
  good: 1.0,
};

const getProductionStatus = (liters, monthAverage) => {
  const ratio = monthAverage > 0 ? liters / monthAverage : 1;
  if (ratio >= PRODUCTION_THRESHOLDS.good) return { status: "Bom", kind: "good" };
  if (ratio >= PRODUCTION_THRESHOLDS.warning) return { status: "Baixo", kind: "warning" };
  return { status: "Crítico", kind: "critical" };
};

const createStatusBadge = (status) => {
  const safeKind = ["good", "warning", "critical"].includes(status.kind) ? status.kind : "good";
  return `<span class="production-badge ${safeKind}">${escapeHtml(status.status)}</span>`;
};

const THEME_STORAGE_KEY = "terrasyn-theme";

const getStoredTheme = () => localStorage.getItem(THEME_STORAGE_KEY);

const getPreferredTheme = () => {
  const stored = getStoredTheme();
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const setThemeAttribute = (theme) => {
  document.documentElement.setAttribute("data-theme", theme);
};

const persistTheme = (theme) => {
  try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch {}
};

const toggleTheme = () => {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const next = current === "dark" ? "light" : "dark";
  setThemeAttribute(next);
  persistTheme(next);
  return next;
};

const updateThemeToggleIcon = (theme) => {
  const lucideIcons = document.querySelectorAll("#themeToggle i[data-lucide]");
  if (lucideIcons.length) {
    const iconName = theme === "dark" ? "sun" : "moon";
    lucideIcons.forEach((icon) => icon.setAttribute("data-lucide", iconName));
    if (window.lucide) window.lucide.createIcons();
  }
  const textIcons = document.querySelectorAll("#themeToggle .theme-toggle-icon");
  if (textIcons.length) {
    textIcons.forEach((icon) => { icon.textContent = theme === "dark" ? "☀" : "☾"; });
  }
};

const countUp = (element, targetValue, options = {}) => {
  if (!element) return;
  const { duration = 600, prefix = "", suffix = "", decimals = 0 } = options;
  const startTime = performance.now();
  const startValue = 0;
  
  const animate = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const currentValue = startValue + (targetValue - startValue) * easeOut;
    
    if (decimals > 0) {
      element.textContent = `${prefix}${currentValue.toFixed(decimals)}${suffix}`;
    } else {
      element.textContent = `${prefix}${Math.round(currentValue)}${suffix}`;
    }
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };
  
  requestAnimationFrame(animate);
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    parseIsoDate,
    todayIso,
    addDaysIso,
    monthKey,
    isValidDate,
    isNotFutureDate,
    isValidDateRange,
    validateNumber,
    cleanText,
    optionalText,
    formatLiters,
    formatMoney,
    formatTasks,
    formatStockQuantity,
    formatDate,
    escapeHtml,
    PRODUCTION_THRESHOLDS,
    getProductionStatus,
    createStatusBadge,
    THEME_STORAGE_KEY,
    getStoredTheme,
    getPreferredTheme,
    setThemeAttribute,
    persistTheme,
    toggleTheme,
    updateThemeToggleIcon,
    countUp,
  };
}
