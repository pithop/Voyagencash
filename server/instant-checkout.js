const crypto = require("node:crypto");
const { HttpError, sign } = require("./http.js");
const { transaction } = require("./database.js");

function encryptionKey() {
  const secret = process.env.VOUCHER_SIGNING_SECRET || process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY;
  if (!secret) throw new HttpError(503, "Le paiement Stripe doit être configuré.");
  return crypto.createHash("sha256").update("duffel-instant-passengers:").update(secret).digest();
}
function encrypt(value, id) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(id));
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return { iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
}
function decrypt(value, id) {
  const cipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(value.iv, "base64"));
  cipher.setAAD(Buffer.from(id));
  cipher.setAuthTag(Buffer.from(value.tag, "base64"));
  return JSON.parse(Buffer.concat([cipher.update(Buffer.from(value.data, "base64")), cipher.final()]).toString("utf8"));
}
async function prepare({ key, offerId, offer, passengers }) {
  const expiresAt = Math.min(Date.parse(offer.expires_at), Date.now() + 30 * 60000);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now() + 60000)
    throw new HttpError(409, "Cette offre a expiré. Relancez la recherche.");
  const hold = { kind: "hold", id: "ord_pending_" + key.replaceAll("-", ""),
    amountCents: Math.round(Number(offer.total_amount) * 100), currency: offer.total_currency,
    expiresAt, simulation: false, instant: true };
  const response = { ...hold, token: sign(hold),
    accessToken: sign({ kind: "order-access", id: hold.id, expiresAt: Date.now() + 90 * 86400000 }),
    payment_required_by: new Date(expiresAt).toISOString() };
  const payload = encrypt({ offerId, passengers, checkoutKey: key }, hold.id);
  await transaction(async db => {
    await db.query("INSERT INTO flight_orders(id,amount_cents,currency,expires_at,provider,status,payment_method,provider_request) VALUES($1,$2,$3,$4,'duffel-instant','awaiting_card','card',$5)",
      [hold.id, hold.amountCents, hold.currency, new Date(expiresAt), payload]);
    await db.query("UPDATE checkout_requests SET state='awaiting_card',response=$2 WHERE idempotency_key=$1", [key, response]);
  });
  return response;
}
module.exports = { prepare, decrypt };
