const { sendJson, timingSafeEqual, pickEnv, fetchSupabaseJson, supabaseHeaders } = require("./utils");
const { validateEnvOrError } = require("./validate-env");

const tables = [
  "milk_records",
  "animals",
  "lactation_records",
  "breeding_records",
  "medication_records",
  "crop_events",
  "stock_items",
  "reminders",
  "app_settings",
];
const optionalTables = new Set(["crop_events", "stock_items", "reminders"]);
const PAGE_SIZE = 1000;

const headerSecret = (request) => {
  const authorization = request.headers.authorization || "";
  if (authorization.toLowerCase().startsWith("bearer ")) return authorization.slice(7).trim();
  return request.headers["x-cron-secret"] || "";
};

const fetchSupabaseTable = async (supabaseUrl, table, serviceRoleKey) => {
  const rows = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await fetchSupabaseJson(
      `${supabaseUrl}/rest/v1/${table}?select=*&limit=${PAGE_SIZE}&offset=${offset}`,
      serviceRoleKey
    );

    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
};

module.exports = async function handler(request, response) {
  if (request.method !== "GET" && request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    sendJson(response, 405, { error: "Metodo nao permitido." });
    return;
  }

  const expectedSecret = process.env.BACKUP_CRON_SECRET || process.env.CRON_SECRET || "";
  if (!expectedSecret) {
    sendJson(response, 500, { error: "Configure CRON_SECRET ou BACKUP_CRON_SECRET antes de habilitar o backup." });
    return;
  }

  // Validação de env vars
  if (!validateEnvOrError(request, response, ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"])) {
    return;
  }

  if (!timingSafeEqual(headerSecret(request), expectedSecret)) {
    sendJson(response, 401, { error: "Token de backup invalido." });
    return;
  }

  const supabaseUrl = pickEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "VITE_SUPABASE_URL");
  const serviceRoleKey = pickEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY");
  const bucket = process.env.BACKUP_BUCKET || "backups";

  if (!supabaseUrl || !serviceRoleKey) {
    sendJson(response, 500, { error: "Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel." });
    return;
  }

  try {
    const backup = {
      exported_at: new Date().toISOString(),
      source: "vercel-cron",
      tables: {},
    };

    for (const table of tables) {
      try {
        backup.tables[table] = await fetchSupabaseTable(supabaseUrl, table, serviceRoleKey);
      } catch (error) {
        const missingOptionalTable =
          optionalTables.has(table) &&
          (error.status === 404 ||
            ["42P01", "PGRST205"].includes(error.code) ||
            String(error.message || "").includes("does not exist"));
        if (!missingOptionalTable) throw error;
        backup.tables[table] = [];
      }
    }

    const fileName = `terrasyn/${new Date().toISOString().slice(0, 10)}.json`;
    const upload = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${fileName}`, {
      method: "POST",
      headers: {
        ...supabaseHeaders(serviceRoleKey),
        "Content-Type": "application/json",
        "x-upsert": "true",
      },
      body: JSON.stringify(backup, null, 2),
    });

    const uploadBody = await upload.text();
    if (!upload.ok) {
      throw new Error(uploadBody || `Storage retornou ${upload.status}`);
    }

    sendJson(response, 200, {
      ok: true,
      bucket,
      file: fileName,
      tables: tables.length,
    });
  } catch (error) {
    console.error("Erro ao gerar backup:", error);
    sendJson(response, 500, { error: "Erro ao gerar backup." });
  }
};
