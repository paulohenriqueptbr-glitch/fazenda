// ─── Logger centralizado com níveis configuráveis ──────────────────────────
// Substitui console.log/error/warn diretos por um logger com controle granular.
//
// Níveis (do menos para o mais restritivo):
//   DEBUG  = 0   — saída detalhada, só para diagnóstico profundo
//   INFO   = 1   — fluxo normal do app (dados carregados, navegação)
//   WARN   = 2   — situações anormais que não quebram o app
//   ERROR  = 3   — falhas que precisam de atenção
//   SILENT = 4   — silencia tudo
//
// Padrão: INFO em dev, WARN em prod. Configurável via localStorage
// (chave: terrasyn_log_level) ou setLogLevel() em runtime.
//
// Uso:
//   import { log, warn, error, setLogLevel, getLogLevel } from "./logger.js";
//   log("Dados carregados:", data);     // nível INFO
//   warn("Cache cheio");                // nível WARN
//   error("Falha crítica:", err);       // nível ERROR (sempre aparece, exceto em SILENT)
//   setLogLevel(0);                     // ativa DEBUG (verbose)
//   setLogLevel(4);                     // silencia tudo

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

/**
 * Retorna o nível de log atual.
 * Lê de localStorage; se inválido ou ausente, usa o padrão (INFO em dev, WARN em prod).
 */
export function getLogLevel() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored !== null) {
    const level = Number(stored);
    if (!isNaN(level) && level >= 0 && level <= 4) return level;
  }
  return IS_DEV ? LOG_LEVELS.INFO : LOG_LEVELS.WARN;
}

/**
 * Define o nível de log em runtime e persiste em localStorage.
 * @param {number} level — valor entre 0 (DEBUG) e 4 (SILENT)
 */
export function setLogLevel(level) {
  if (typeof level !== "number" || level < 0 || level > 4 || !Number.isInteger(level)) {
    console.warn("[Terrasyn Logger] Nível inválido:", level, "— use um inteiro entre 0 e 4");
    return;
  }
  localStorage.setItem(STORAGE_KEY, String(level));
}

/**
 * Verifica se uma mensagem no nível dado deve ser emitida.
 * Mensagem emite se: nível configurado <= nível da mensagem.
 */
const _shouldLog = (messageLevel) => getLogLevel() <= messageLevel;

// ─── Funções exportadas ────────────────────────────────────────────────────
// Assinatura idêntica à versão anterior: log(...args), warn(...args), error(...args).
// Qualquer código que já importe { log, warn, error } continua funcionando.

export const log = (...args) => {
  if (_shouldLog(LOG_LEVELS.INFO)) console.log("[Terrasyn]", ...args);
};

export const warn = (...args) => {
  if (_shouldLog(LOG_LEVELS.WARN)) console.warn("[Terrasyn]", ...args);
};

export const error = (...args) => {
  if (_shouldLog(LOG_LEVELS.ERROR)) console.error("[Terrasyn]", ...args);
};
