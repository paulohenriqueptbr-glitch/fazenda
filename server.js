const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = 5173;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
};

http
  .createServer((request, response) => {
    const url = decodeURIComponent(request.url.split("?")[0]);

    if (url === "/api/config.js") {
      const supabaseUrl = process.env.SUPABASE_URL || "";
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

      response.writeHead(200, {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      });
      response.end(
        `window.CONTROLE_LEITE_CONFIG = ${JSON.stringify({
          supabaseUrl,
          supabaseAnonKey,
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
      });
      response.end(data);
    });
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`Controle Leite aberto em http://localhost:${port}`);
  });
