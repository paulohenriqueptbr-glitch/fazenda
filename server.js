const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const cors = require('cors');
app.use(cors()); // permite qualquer origem (necessário para chamadas fetch locais)
const PORT = process.env.PORT || 5175;

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Compress responses (gzip/deflate) for better performance
const compression = require('compression');
app.use(compression());
// Rate limiting (basic) – 100 req/min per IP for all routes
const rateLimit = require('express-rate-limit');
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' blob:; style-src 'self'; connect-src 'self' *.supabase.co geocoding-api.open-meteo.com api.open-meteo.com; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  next();
});

// API Routes (Importing existing handlers)
const adminCustomersHandler = require('./api/admin-customers');
const backupHandler = require('./api/backup');
const weatherHandler = require('./api/weather');

// Adaptando handlers antigos (que esperavam req/res do http nativo) para Express
const wrapHandler = (handler) => async (req, res) => {
  try {
    // Simulando a interface simples que o seu código antigo esperava
    // Note: Se os handlers originais usavam res.writeHead, 
    // eles precisarão de pequenos ajustes ou usaremos um wrapper.
    await handler(req, res);
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
};

// Rate limit mais restritivo para endpoints sensíveis (admin e backup)
const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // 20 requisições por 15 minutos
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Tente novamente mais tarde." },
});

app.post('/api/admin-customers', sensitiveLimiter, wrapHandler(adminCustomersHandler));
app.post('/api/backup', sensitiveLimiter, wrapHandler(backupHandler));
app.get('/api/weather', wrapHandler(weatherHandler));

// Rotas de API (inclui login local)
const authRouter = require('./routes/authRoutes');
app.use('/api', authRouter);

// Configuração de ambiente para o cliente
app.get('/api/config.js', (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  
  const config = {
    supabaseUrl,
    supabaseAnonKey,
    localModeEnabled: Boolean(process.env.LOCAL_ADMIN_PASSWORD),
    supportWhatsapp: process.env.SUPPORT_WHATSAPP_NUMBER || "",
    supportEmail: process.env.SUPPORT_EMAIL || "",
    trialDays: process.env.TRIAL_DAYS || "14",
    planPrice: process.env.PLAN_PRICE || "39",
  };

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.send(`window.CONTROLE_LEITE_CONFIG = ${JSON.stringify(config)};`);
});

// Servir arquivos estáticos da raiz (index.html, styles.css, js/, etc)
app.use(express.static(__dirname));

// Fallback para index.html (útil para PWAs/Single Page Apps)
app.get(/^.*$/, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 Servidor reformulado rodando em http://127.0.0.1:${PORT}`);
});
