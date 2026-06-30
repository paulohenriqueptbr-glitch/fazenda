const { sendJson, timingSafeEqual, pickEnv, fetchSupabaseJson } = require("./utils");
const { validateEnvOrError } = require("./validate-env");

const allowedStatuses = new Set(["trial", "active", "overdue", "blocked", "canceled"]);
const CLIENT_PROFILE_KEY = "client_profile";
const PRICE_QUOTE_KEY = "milk_price_quote";
const SUBSCRIPTION_ADMIN_KEY = "subscription_admin";
const MAX_ADMIN_AUTH_ATTEMPTS = 10;
const ADMIN_AUTH_WINDOW_MS = 15 * 60 * 1000;
const adminAuthAttempts = new Map();

const safeParse = (value, fallback = {}) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const defaultProfile = () => ({
  farmName: "",
  ownerName: "",
  whatsapp: "",
  trialStartedAt: "",
  onboardingDone: false,
});

const defaultSubscription = () => ({
  subscriptionStatus: "trial",
  subscriptionDueDate: "",
});

const normalizeProfile = (profile = {}) => ({
  farmName: String(profile?.farmName || ""),
  ownerName: String(profile?.ownerName || ""),
  whatsapp: String(profile?.whatsapp || ""),
  trialStartedAt: String(profile?.trialStartedAt || ""),
  onboardingDone: Boolean(profile?.onboardingDone),
});

const normalizeSubscription = (subscription = {}) => {
  const defaults = defaultSubscription();
  const status = String(subscription?.subscriptionStatus || defaults.subscriptionStatus);

  return {
    subscriptionStatus: allowedStatuses.has(status) ? status : defaults.subscriptionStatus,
    subscriptionDueDate: String(subscription?.subscriptionDueDate || ""),
  };
};

const authToken = (request) => {
  const authorization = request.headers.authorization || "";
  if (authorization.toLowerCase().startsWith("bearer ")) return authorization.slice(7).trim();
  return request.headers["x-admin-token"] || "";
};

const clientIp = (request) =>
  String(request.headers["x-forwarded-for"] || request.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();

const adminRateLimitKey = (request) => clientIp(request) || "unknown";

const isAdminRateLimited = (request) => {
  const key = adminRateLimitKey(request);
  const now = Date.now();
  const current = adminAuthAttempts.get(key);

  if (!current || now > current.resetAt) {
    adminAuthAttempts.set(key, { count: 0, resetAt: now + ADMIN_AUTH_WINDOW_MS });
    return false;
  }

  return current.count >= MAX_ADMIN_AUTH_ATTEMPTS;
};

const recordAdminAuthFailure = (request) => {
  const key = adminRateLimitKey(request);
  const now = Date.now();
  const current = adminAuthAttempts.get(key);

  if (!current || now > current.resetAt) {
    adminAuthAttempts.set(key, { count: 1, resetAt: now + ADMIN_AUTH_WINDOW_MS });
    return;
  }

  current.count += 1;
  adminAuthAttempts.set(key, current);
};

const clearAdminAuthFailures = (request) => {
  adminAuthAttempts.delete(adminRateLimitKey(request));
};

module.exports = async function handler(request, response) {
  const adminToken = process.env.ADMIN_TOKEN || "";
  const supabaseUrl = pickEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "VITE_SUPABASE_URL");
  const serviceRoleKey = pickEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY");

  if (!adminToken || !serviceRoleKey || !supabaseUrl) {
    sendJson(response, 500, { error: "Configure ADMIN_TOKEN, SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel." });
    return;
  }

  if (!validateEnvOrError(request, response, ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_TOKEN"])) {
    return;
  }

  if (isAdminRateLimited(request)) {
    sendJson(response, 429, { error: "Muitas tentativas. Tente novamente mais tarde." });
    return;
  }

  if (!timingSafeEqual(authToken(request), adminToken)) {
    recordAdminAuthFailure(request);
    sendJson(response, 401, { error: "Token de administrador inválido." });
    return;
  }

  clearAdminAuthFailures(request);

  if (request.method === "GET") {
    try {
      const settingsUrl = `${supabaseUrl}/rest/v1/app_settings?select=user_id,key,value,updated_at&key=in.(${CLIENT_PROFILE_KEY},${PRICE_QUOTE_KEY},${SUBSCRIPTION_ADMIN_KEY})&order=updated_at.desc`;
      const settings = await fetchSupabaseJson(settingsUrl, serviceRoleKey);

      const userIds = [...new Set(settings.map((s) => s.user_id).filter(Boolean))];

      const usersMap = new Map();
      const PAGE_SIZE = 100;
      for (let offset = 0; offset < userIds.length; offset += PAGE_SIZE) {
        const chunk = userIds.slice(offset, offset + PAGE_SIZE);
        try {
          const filter = chunk.map((id) => `id:eq.${id}`).join(",");
          const authUrl = `${supabaseUrl}/auth/v1/admin/users?select=id,email,created_at&${filter}`;
          const authData = await fetchSupabaseJson(authUrl, serviceRoleKey);
          (authData.users || []).forEach((u) => usersMap.set(u.id, u));
        } catch {
        }
      }

      const customers = new Map();

      userIds.forEach((userId) => {
        const user = usersMap.get(userId);
        customers.set(userId, {
          userId,
          email: user?.email || "",
          createdAt: user?.created_at || "",
          ...defaultProfile(),
          ...defaultSubscription(),
          milkPriceQuote: 0,
        });
      });

      const settingsByUser = new Map();
      settings.forEach((setting) => {
        const userSettings = settingsByUser.get(setting.user_id) || {};
        userSettings[setting.key] = setting.value;
        settingsByUser.set(setting.user_id, userSettings);
      });

      settingsByUser.forEach((userSettings, userId) => {
        const current = customers.get(userId) || {
          userId,
          email: "",
          createdAt: "",
          ...defaultProfile(),
          ...defaultSubscription(),
          milkPriceQuote: 0,
        };
        const profile = safeParse(userSettings[CLIENT_PROFILE_KEY] || "{}", {});
        const subscription = userSettings[SUBSCRIPTION_ADMIN_KEY]
          ? safeParse(userSettings[SUBSCRIPTION_ADMIN_KEY], {})
          : profile;

        Object.assign(current, normalizeProfile(profile), normalizeSubscription(subscription), {
          milkPriceQuote: Number(userSettings[PRICE_QUOTE_KEY] || 0),
        });

        customers.set(userId, current);
      });

      sendJson(response, 200, { customers: Array.from(customers.values()) });
    } catch (error) {
      console.error("Erro ao carregar clientes:", error);
      sendJson(response, 500, { error: "Erro ao carregar clientes." });
    }
    return;
  }

  if (request.method === "POST") {
    try {
      const { userId, subscriptionStatus, subscriptionDueDate } = request.body || {};
      if (!userId) {
        sendJson(response, 400, { error: "Informe userId." });
        return;
      }
      if (!allowedStatuses.has(subscriptionStatus)) {
        sendJson(response, 400, { error: "Status de assinatura inválido." });
        return;
      }

      const nextSubscription = normalizeSubscription({
        subscriptionStatus,
        subscriptionDueDate: subscriptionDueDate || "",
      });

      const upsertUrl = `${supabaseUrl}/rest/v1/app_settings?on_conflict=user_id,key`;
      await fetchSupabaseJson(upsertUrl, serviceRoleKey, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify([
          {
            user_id: userId,
            key: SUBSCRIPTION_ADMIN_KEY,
            value: JSON.stringify(nextSubscription),
            updated_at: new Date().toISOString(),
          },
        ]),
      });

      sendJson(response, 200, { ok: true, subscription: nextSubscription });
    } catch (error) {
      console.error("Erro ao atualizar cliente:", error);
      sendJson(response, 500, { error: "Erro ao atualizar cliente." });
    }
    return;
  }

  response.setHeader("Allow", "GET, POST");
  sendJson(response, 405, { error: "Método não permitido." });
};
