import http from "node:http";
import { existsSync } from "node:fs";
if (process.env.VOYAGENCASH_TEST_MODE !== "true" && existsSync(".env")) process.loadEnvFile(".env");
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const apiRoutes = new Set([
  "/api/config",
  "/api/orders/fulfil",
  "/api/orders/status",
  "/api/orders/wallet",
  "/api/payencash/stores",
  "/api/flights/search",
  "/api/flights/calendar",
  "/api/orders/hold",
  "/api/orders/low-cost",
  "/api/orders/low-cost-status",
  "/api/payencash/voucher",
  "/api/payencash/webhook",
  "/api/stripe/create-intent",
  "/api/stripe/webhook",
]);
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
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
};
http
  .createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (apiRoutes.has(path)) {
        const targetPath =
          path === "/api/orders/low-cost"
            ? "/api/orders/hold"
            : path === "/api/orders/low-cost-status"
              ? "/api/orders/status"
              : path;
        await require(`..${targetPath}.js`)(req, res);
        return;
      }
      if (!aliases.has(path) && !path.startsWith("/assets/")) {
        res.writeHead(404).end("Introuvable");
        return;
      }
      const file = resolve(
        root,
        "." + (aliases.has(path) ? "/index.html" : path),
      );
      if (!file.startsWith(root + sep) || (!aliases.has(path) && !file.startsWith(resolve(root, "assets") + sep))) {
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
