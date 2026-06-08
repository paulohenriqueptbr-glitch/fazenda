module.exports = function handler(request, response) {
  const pickEnv = (...names) => names.map((name) => process.env[name]).find(Boolean) || "";
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
  const pixKey = pickEnv("PIX_KEY", "PAYMENT_PIX_KEY");
  const pixReceiver = pickEnv("PIX_RECEIVER", "PAYMENT_PIX_RECEIVER");

  response.setHeader("Content-Type", "application/javascript; charset=utf-8");
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.status(200).send(
    `window.CONTROLE_LEITE_CONFIG = ${JSON.stringify({
      supabaseUrl,
      supabaseAnonKey,
      supportWhatsapp,
      supportEmail,
      trialDays,
      planPrice,
      pixKey,
      pixReceiver,
    })};`
  );
};
