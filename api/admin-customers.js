const allowedStatuses = new Set(["trial", "active", "overdue", "blocked", "canceled"]);
const CLIENT_PROFILE_KEY = "client_profile";
const PRICE_QUOTE_KEY = "milk_price_quote";
const SUBSCRIPTION_ADMIN_KEY = "subscription_admin";

const pickEnv = (...names) => names.map((name) => process.env[name]).find(Boolean) || "";

const sendJson = (response, status, payload) => {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.send(JSON.stringify(payload));
};

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

const supabaseHeaders = (serviceRoleKey) => ({
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
});

const fetchSupabaseJson = async (url, serviceRoleKey, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...supabaseHeaders(serviceRoleKey),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Supabase retornou ${response.status}`);
  }
  return data;
};

module.exports = async function handler(request, response) {
  const adminToken = process.env.ADMIN_TOKEN || "";
  const supabaseUrl = pickEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "VITE_SUPABASE_URL");
  const serviceRoleKey = pickEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY");

  if (!adminToken || !serviceRoleKey || !supabaseUrl) {
    sendJson(response, 500, { error: "Configure ADMIN_TOKEN, SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel." });
    return;
  }

  if (authToken(request) !== adminToken) {
    sendJson(response, 401, { error: "Token de administrador inválido." });
    return;
  }

  if (request.method === "GET") {
    try {
      const settingsUrl = `${supabaseUrl}/rest/v1/app_settings?select=user_id,key,value,updated_at&key=in.(${CLIENT_PROFILE_KEY},${PRICE_QUOTE_KEY},${SUBSCRIPTION_ADMIN_KEY})&order=updated_at.desc`;
      const settings = await fetchSupabaseJson(settingsUrl, serviceRoleKey);
      let users = [];

      try {
        const authData = await fetchSupabaseJson(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, serviceRoleKey);
        users = authData.users || [];
      } catch {
        users = [];
      }

      const customers = new Map();

      users.forEach((user) => {
        customers.set(user.id, {
          userId: user.id,
          email: user.email || "",
          createdAt: user.created_at || "",
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
      sendJson(response, 500, { error: error.message || "Erro ao carregar clientes." });
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
      sendJson(response, 500, { error: error.message || "Erro ao atualizar cliente." });
    }
    return;
  }

  response.setHeader("Allow", "GET, POST");
  sendJson(response, 405, { error: "Método não permitido." });
};
