const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const APP_ROOT = path.resolve(__dirname, "..", "defense_hero_v2");
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 4174;
const MIME_TYPES = Object.freeze({
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".webm": "audio/webm",
  ".webp": "image/webp",
});

function parsePort(rawValue) {
  if (rawValue === undefined || rawValue === "") return DEFAULT_PORT;
  const port = Number(rawValue);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RangeError(`HERO_DEFENSE_V2_PORT must be an integer from 1 to 65535; received ${rawValue}`);
  }
  return port;
}

function resolveRequestPath(requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  } catch {
    return { status: 400, error: "Bad request" };
  }

  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const target = path.resolve(APP_ROOT, relative);
  if (target !== APP_ROOT && !target.startsWith(`${APP_ROOT}${path.sep}`)) {
    return { status: 403, error: "Forbidden" };
  }
  return { target };
}

function createHeroDefenseV2Server() {
  return http.createServer((request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
      return;
    }

    const resolved = resolveRequestPath(request.url ?? "/");
    if (resolved.error) {
      response.writeHead(resolved.status).end(resolved.error);
      return;
    }

    fs.stat(resolved.target, (statError, stats) => {
      const file = !statError && stats.isDirectory()
        ? path.join(resolved.target, "index.html")
        : resolved.target;
      fs.readFile(file, (error, data) => {
        if (error) {
          response.writeHead(error.code === "ENOENT" ? 404 : 500).end("Not found");
          return;
        }
        response.writeHead(200, {
          "Content-Type": MIME_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
          "Cache-Control": "no-store",
        });
        response.end(request.method === "HEAD" ? undefined : data);
      });
    });
  });
}

if (require.main === module) {
  const host = String(process.env.HERO_DEFENSE_V2_HOST ?? DEFAULT_HOST).trim() || DEFAULT_HOST;
  const port = parsePort(process.env.HERO_DEFENSE_V2_PORT);
  const server = createHeroDefenseV2Server();
  server.once("error", (error) => {
    console.error(`Hero Core Defense V2 server failed: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, host, () => {
    const displayHost = host === "0.0.0.0" ? "127.0.0.1" : host;
    console.log(`Hero Core Defense V2: http://${displayHost}:${port}/`);
    if (host === "0.0.0.0") {
      console.log("LAN access is enabled; use this PC's LAN address from the mobile device.");
    }
  });
}

module.exports = {
  APP_ROOT,
  DEFAULT_HOST,
  DEFAULT_PORT,
  MIME_TYPES,
  createHeroDefenseV2Server,
  parsePort,
};
