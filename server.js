const http = require("http");
const fs = require("fs");
const path = require("path");

const crypto = require("crypto");

const root = __dirname;
const port = 5173;

// Rate-limit para login local: contador em memória (persiste enquanto o processo roda)
const loginAttempts = { count: 0, lockedUntil: 0 };
const MAX_LOCAL_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutos

const timingSafeEqual = (a, b) => {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA); // consome tempo mesmo na falha
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
};

const loadDotEnv = () => {
  const envPath = path.join(root, ".env");

  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
};

loadDotEnv();

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
};

const pickEnv = (...names) => names.map((name) => process.env[name]).find(Boolean) || "";

http
  .createServer((request, response) => {
    const url = decodeURIComponent(request.url.split("?")[0]);

    if (url === "/api/config.js") {
      const supabaseUrl = pickEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "VITE_SUPABASE_URL");
      const supabaseAnonKey = pickEnv(
        "SUPABASE_ANON_KEY",
        "SUPABASE_PUBLISHABLE_KEY",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        "VITE_SUPABASE_ANON_KEY",
        "VITE_SUPABASE_PUBLISHABLE_KEY"
      );
      // localPassword NÃO é mais exposta no bundle JS do cliente.
      // A validação da senha local agora é feita em /api/local-login (POST).
      const localModeEnabled = (!supabaseUrl || !supabaseAnonKey)
        ? Boolean(process.env.LOCAL_ADMIN_PASSWORD)
        : false;

      response.writeHead(200, {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      });
      response.end(
        `window.CONTROLE_LEITE_CONFIG = ${JSON.stringify({
          supabaseUrl,
          supabaseAnonKey,
          localModeEnabled,
        })};`
      );
      return;
    }

    // Rota de login local — valida senha no servidor, nunca exposta no bundle JS
    if (url === "/api/local-login" && request.method === "POST") {
      const now = Date.now();

      if (loginAttempts.lockedUntil > now) {
        const waitSec = Math.ceil((loginAttempts.lockedUntil - now) / 1000);
        response.writeHead(429, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ ok: false, message: `Bloqueado. Aguarde ${waitSec}s.` }));
        return;
      }

      let body = "";
      request.on("data", (chunk) => { body += chunk; });
      request.on("end", () => {
        let parsed;
        try { parsed = JSON.parse(body); } catch { parsed = {}; }

        const { username, password } = parsed;
        const configuredPassword = process.env.LOCAL_ADMIN_PASSWORD || "";
        const ok =
          configuredPassword.length > 0 &&
          timingSafeEqual(username, "admin") &&
          timingSafeEqual(password, configuredPassword);

        if (ok) {
          loginAttempts.count = 0;
          loginAttempts.lockedUntil = 0;
          response.writeHead(200, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ ok: true }));
        } else {
          loginAttempts.count += 1;
          if (loginAttempts.count >= MAX_LOCAL_LOGIN_ATTEMPTS) {
            loginAttempts.lockedUntil = Date.now() + LOCKOUT_MS;
            loginAttempts.count = 0;
          }
          response.writeHead(401, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ ok: false, message: "Usuário ou senha incorretos." }));
        }
      });
      return;
    }

    const file = path.resolve(root, url === "/" ? "index.html" : url.slice(1));

    if (!file.startsWith(root)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    fs.readFile(file, (error, data) => {
      if (error) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }

      response.writeHead(200, {
        "Content-Type": types[path.extname(file)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      });
      response.end(data);
    });
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`Controle Leite aberto em http://localhost:${port}`);
  });
