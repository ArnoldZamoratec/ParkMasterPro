import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("./public", import.meta.url)));
const portArgIndex = process.argv.indexOf("--port");
const port = Number(
  process.env.PORT || (portArgIndex >= 0 ? process.argv[portArgIndex + 1] : 8765)
);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function resolvePublicPath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split("?")[0]);
  const requested = normalize(cleanPath === "/" ? "/index.html" : cleanPath);
  const fullPath = resolve(join(root, requested));
  return fullPath.startsWith(root) ? fullPath : null;
}

createServer(async (req, res) => {
  try {
    const filePath = resolvePublicPath(req.url || "/");
    if (!filePath) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    let body;
    try {
      body = await readFile(filePath);
    } catch {
      body = await readFile(join(root, "index.html"));
    }

    res.writeHead(200, {
      "Content-Type": types[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(body);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(error instanceof Error ? error.message : String(error));
  }
}).listen(port, () => {
  console.log(`ParkMaster Pro backup running at http://localhost:${port}`);
});
