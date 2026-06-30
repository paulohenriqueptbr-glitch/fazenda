const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const cors = require('cors');
app.use(cors());
const PORT = process.env.PORT || 5175;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const compression = require('compression');
app.use(compression());
const rateLimit = require('express-rate-limit');
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' blob:; style-src 'self'; connect-src 'self' *.supabase.co geocoding-api.open-meteo.com api.open-meteo.com; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  next();
});

const adminCustomersHandler = require('./api/admin-customers');
const backupHandler = require('./api/backup');
const weatherHandler = require('./api/weather');

const wrapHandler = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
};

const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Tente novamente mais tarde." },
});

app.post('/api/admin-customers', sensitiveLimiter, wrapHandler(adminCustomersHandler));
app.post('/api/backup', sensitiveLimiter, wrapHandler(backupHandler));
app.get('/api/weather', wrapHandler(weatherHandler));

const authRouter = require('./routes/authRoutes');
app.use('/api', authRouter);

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

app.use(express.static(__dirname));

app.get(/^.*$/, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 Servidor reformulado rodando em http://127.0.0.1:${PORT}`);
});