const crypto = require("node:crypto");
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
function json(res, status, data) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.statusCode = status;
  res.end(JSON.stringify(data));
}
async function rawBody(req) {
  if (req.rawBody) {
    const value = Buffer.from(req.rawBody);
    if (value.length > 32768)
      throw new HttpError(413, "Requête trop volumineuse.");
    return value;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32768) throw new HttpError(413, "Requête trop volumineuse.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function body(req) {
  let value;
  try {
    if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
      if (Buffer.byteLength(JSON.stringify(req.body)) > 32768)
        throw new HttpError(413, "Requête trop volumineuse.");
      value = req.body;
    } else value = JSON.parse(req.body || (await rawBody(req)).toString());
  } catch (error) {
    if (error.status) throw error;
    throw new HttpError(400, "JSON invalide.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new HttpError(400, "Un objet JSON est requis.");
  return value;
}
function endpoint(method, fn) {
  return async (req, res) => {
    try {
      if (req.method !== method) {
        res.setHeader("Allow", method);
        throw new HttpError(405, "Méthode non autorisée.");
      }
      if (method === "POST" && req.headers.origin) {
        let origin;
        try { origin = new URL(req.headers.origin); }
        catch { throw new HttpError(403, "Origine non autorisée."); }
        if (origin.host !== req.headers.host)
          throw new HttpError(403, "Origine non autorisée.");
      }
      await fn(req, res);
    } catch (e) {
      json(res, e.status || 500, {
        error: e.status ? e.message : "Service momentanément indisponible.",
      });
    }
  };
}
const ephemeralSecret = crypto.randomBytes(32).toString("hex");
function secret() {
  if (
    (process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || process.env.DUFFEL_API_TOKEN || process.env.TRAVELFUSION_API_KEY || process.env.VERCEL || process.env.NODE_ENV === "production") &&
    !process.env.VOUCHER_SIGNING_SECRET
  )
    throw new HttpError(503, "La signature serveur doit être configurée.");
  return process.env.VOUCHER_SIGNING_SECRET || ephemeralSecret;
}
function sign(data) {
  const value = Buffer.from(JSON.stringify(data)).toString("base64url");
  return (
    value +
    "." +
    crypto.createHmac("sha256", secret()).update(value).digest("base64url")
  );
}
function verify(token, kind) {
  if (typeof token !== "string" || token.length > 16000)
    throw new HttpError(401, "Jeton invalide.");
  const [value, signature, extra] = token.split(".");
  const expected = crypto
    .createHmac("sha256", secret())
    .update(value || "")
    .digest("base64url");
  if (
    extra ||
    !signature ||
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    throw new HttpError(401, "Signature invalide.");
  let data;
  try {
    data = JSON.parse(Buffer.from(value, "base64url"));
  } catch {
    throw new HttpError(401, "Jeton invalide.");
  }
  if (
    data.kind !== kind ||
    !Number.isFinite(data.expiresAt) ||
    data.expiresAt <= Date.now()
  )
    throw new HttpError(410, "Cette réservation a expiré.");
  return data;
}
module.exports = { HttpError, json, rawBody, body, endpoint, sign, verify };
