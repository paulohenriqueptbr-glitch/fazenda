import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

// Simula a função serverless /api/config.js (api/config.js) durante `vite dev`,
// já que a Vercel só executa esse handler em produção/preview.
function devApiConfigPlugin(env) {
  return {
    name: 'dev-api-config',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/api/config.js') return next();

        const normalizeEnvValue = (value) =>
          String(value || '')
            .trim()
            .replace(/^[`'"\u201c\u201d]+|[`'"\u201c\u201d]+$/g, '');
        const pickEnv = (...names) =>
          names.map((name) => normalizeEnvValue(env[name])).find(Boolean) || '';

        const supabaseUrl = pickEnv('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL');
        const supabaseAnonKey = pickEnv(
          'SUPABASE_ANON_KEY',
          'SUPABASE_PUBLISHABLE_KEY',
          'NEXT_PUBLIC_SUPABASE_ANON_KEY',
          'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
          'VITE_SUPABASE_ANON_KEY',
          'VITE_SUPABASE_PUBLISHABLE_KEY'
        );
        const supportWhatsapp = pickEnv('SUPPORT_WHATSAPP_NUMBER', 'SUPPORT_WHATSAPP');
        const supportEmail = pickEnv('SUPPORT_EMAIL');
        const trialDays = pickEnv('TRIAL_DAYS', 'PLAN_TRIAL_DAYS') || '14';
        const planPrice = pickEnv('PLAN_PRICE', 'MONTHLY_PLAN_PRICE') || '39';
        const localModeEnabled = !(supabaseUrl && supabaseAnonKey);

        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        res.end(
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
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [devApiConfigPlugin(env)],
    root: '.',
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      minify: 'esbuild',
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
        },
        output: {
          entryFileNames: 'assets/js/[name]-[hash].js',
          chunkFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
        },
      },
    },
    server: {
      port: 5173,
      strictPort: false,
      host: true,
    },
    preview: {
      port: 4173,
    },
  };
});
