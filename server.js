const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = 5173;

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
      // LOCAL_ADMIN_PASSWORD só é exposta quando não há Supabase configurado (modo local).
      // Em produção (com Supabase) essa chave não é lida pelo app.
      const localPassword = (!supabaseUrl || !supabaseAnonKey)
        ? (process.env.LOCAL_ADMIN_PASSWORD || "")
        : "";

      response.writeHead(200, {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      });
      response.end(
        `window.CONTROLE_LEITE_CONFIG = ${JSON.stringify({
          supabaseUrl,
          supabaseAnonKey,
          localPassword,
        })};`
      );
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
