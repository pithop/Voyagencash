import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve(process.argv.includes("--dist") ? "dist" : ".");
const port = Number(process.env.PORT || 4173);
const aliases = new Set([
  "/",
  "/app",
  "/vols",
  "/aller-simple",
  "/mes-billets",
  "/ou-payer",
  "/aide",
]);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
http
  .createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      const file = resolve(
        root,
        "." + (aliases.has(path) ? "/index.html" : path),
      );
      if (!file.startsWith(root + sep)) {
        res.writeHead(403).end();
        return;
      }
      const data = await readFile(file);
      res.writeHead(200, {
        "Content-Type": types[extname(file)] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      res.end(data);
    } catch {
      res
        .writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
        .end("Page introuvable");
    }
  })
  .listen(port, "0.0.0.0", () =>
    console.log(`voyagencash : http://localhost:${port}`),
  );
