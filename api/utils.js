const crypto = require("crypto");

const sendJson = (response, status, payload) => {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  response.send(JSON.stringify(payload));
};

const timingSafeEqual = (a, b) => {
  const bufA = Buffer.from(String(a || ""));
  const bufB = Buffer.from(String(b || ""));
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
};

const pickEnv = (...names) => names.map((name) => process.env[name]).find(Boolean) || "";

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
    const error = new Error(data?.message || data?.error || `Supabase retornou ${response.status}`);
    error.status = response.status;
    error.code = data?.code;
    throw error;
  }
  return data;
};

module.exports = { sendJson, timingSafeEqual, pickEnv, supabaseHeaders, fetchSupabaseJson };
