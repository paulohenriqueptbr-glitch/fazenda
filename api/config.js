module.exports = function handler(request, response) {
  const normalizeEnvValue = (value) =>
    String(value || "")
      .trim()
      .replace(/^[`'"\u201c\u201d]+|[`'"\u201c\u201d]+$/g, "");
  const pickEnv = (...names) => names.map((name) => normalizeEnvValue(process.env[name])).find(Boolean) || "";
  const supabaseUrl = pickEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "VITE_SUPABASE_URL");
  const supabaseAnonKey = pickEnv(
    "SUPABASE_ANON_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_ANON_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY"
  );
  const supportWhatsapp = pickEnv("SUPPORT_WHATSAPP_NUMBER", "SUPPORT_WHATSAPP");
  const supportEmail = pickEnv("SUPPORT_EMAIL");
  const trialDays = pickEnv("TRIAL_DAYS", "PLAN_TRIAL_DAYS") || "14";
  const planPrice = pickEnv("PLAN_PRICE", "MONTHLY_PLAN_PRICE") || "39";
  // Em produção (Vercel) o modo local nunca fica ativo — sempre usa Supabase.
  const localModeEnabled = false;

  response.setHeader("Content-Type", "application/javascript; charset=utf-8");
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  response.status(200).send(
    `window.CONTROLE_LEITE_CONFIG = ${JSON.stringify({
      supabaseUrl,
      supabaseAnonKey,
      localModeEnabled,
      supportWhatsapp,
      supportEmail,
      trialDays,
      planPrice,
    })};`
  );
};
