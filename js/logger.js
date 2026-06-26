// ─── Logger centralizado ────────────────────────────────────────────────────
// Substitui console.log/error/warn diretos por um logger que só emite
// logs em desenvolvimento. Em produção, silencia tudo exceto erros fatais.
//
// Uso:
//   import { log, warn, error } from "./logger.js";
//   log("Dados carregados:", data);   // só aparece em dev
//   warn("Cache cheio");              // só aparece em dev
//   error("Falha crítica:", err);     // aparece sempre

const IS_DEV = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

export const log = (...args) => {
  if (IS_DEV) console.log("[Terrasyn]", ...args);
};

export const warn = (...args) => {
  if (IS_DEV) console.warn("[Terrasyn]", ...args);
};

export const error = (...args) => {
  console.error("[Terrasyn]", ...args);
};
