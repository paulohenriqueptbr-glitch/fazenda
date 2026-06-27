// ─── Validação de variáveis de ambiente ──────────────────────────────────────
// Valida se todas as env vars necessárias estão configuradas antes de
// processar requisições. Evita erros silenciosos em produção.

const ENV_SCHEMA = {
  SUPABASE_URL: {
    required: true,
    pattern: /^https:\/\/.+\.supabase\.co$/,
    message: "SUPABASE_URL deve ser uma URL válida do Supabase (https://xxx.supabase.co)",
  },
  SUPABASE_ANON_KEY: {
    required: true,
    minLength: 20,
    message: "SUPABASE_ANON_KEY deve ter pelo menos 20 caracteres",
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    required: false, // Só necessária em endpoints server-side
    minLength: 20,
    message: "SUPABASE_SERVICE_ROLE_KEY deve ter pelo menos 20 caracteres",
  },
  ADMIN_TOKEN: {
    required: false,
    minLength: 16,
    message: "ADMIN_TOKEN deve ter pelo menos 16 caracteres",
  },
  CRON_SECRET: {
    required: false,
    minLength: 16,
    message: "CRON_SECRET deve ter pelo menos 16 caracteres",
  },
};

/**
 * Valida variáveis de ambiente
 * @param {string[]} requiredKeys - Chaves obrigatórias para este endpoint
 * @returns {{ valid: boolean, errors: string[] }}
 */
export const validateEnv = (requiredKeys = []) => {
  const errors = [];

  for (const key of requiredKeys) {
    const schema = ENV_SCHEMA[key];
    if (!schema) continue;

    const value = process.env[key];

    if (schema.required && !value) {
      errors.push(`${key} não está configurada. ${schema.message}`);
      continue;
    }

    if (value && schema.minLength && value.length < schema.minLength) {
      errors.push(`${key} parece inválida. ${schema.message}`);
    }

    if (value && schema.pattern && !schema.pattern.test(value)) {
      errors.push(`${key} parece inválida. ${schema.message}`);
    }
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Valida e retorna erro 400 se inválido
 * @param {object} request - Request object
 * @param {object} response - Response object
 * @param {string[]} requiredKeys - Chaves obrigatórias
 * @returns {boolean} - true se válido, false se já respondeu com erro
 */
export const validateEnvOrError = (request, response, requiredKeys) => {
  const { valid, errors } = validateEnv(requiredKeys);

  if (!valid) {
    const { sendJson } = require("./utils");
    sendJson(response, 500, {
      error: "Configuração incompleta.",
      details: errors,
    });
    return false;
  }

  return true;
};

export default validateEnv;
