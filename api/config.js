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

  response.setHeader("Content-Type", "application/javascript; charset=utf-8");
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.status(200).send(
    `window.CONTROLE_LEITE_CONFIG = ${JSON.stringify({
      supabaseUrl,
      supabaseAnonKey,
    })};`
  );
};
