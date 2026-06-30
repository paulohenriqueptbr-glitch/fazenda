export const LOG_LEVELS = Object.freeze({
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4,
});

const STORAGE_KEY = "terrasyn_log_level";

const IS_DEV =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

export function getLogLevel() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored !== null) {
    const level = Number(stored);
    if (!isNaN(level) && level >= 0 && level <= 4) return level;
  }
  return IS_DEV ? LOG_LEVELS.INFO : LOG_LEVELS.WARN;
}

export function setLogLevel(level) {
  if (typeof level !== "number" || level < 0 || level > 4 || !Number.isInteger(level)) {
    console.warn("[Terrasyn Logger] Nível inválido:", level, "— use um inteiro entre 0 e 4");
    return;
  }
  localStorage.setItem(STORAGE_KEY, String(level));
}

const _shouldLog = (messageLevel) => getLogLevel() <= messageLevel;

export const log = (...args) => {
  if (_shouldLog(LOG_LEVELS.INFO)) console.log("[Terrasyn]", ...args);
};

export const warn = (...args) => {
  if (_shouldLog(LOG_LEVELS.WARN)) console.warn("[Terrasyn]", ...args);
};

export const error = (...args) => {
  if (_shouldLog(LOG_LEVELS.ERROR)) console.error("[Terrasyn]", ...args);
};
