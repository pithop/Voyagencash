const crypto = require("node:crypto");
const { database } = require("./database.js");
const { verify, sign, HttpError } = require("./http.js");
async function issue(input) {
  let access, kind = "order-access";
  try { access = verify(input.token, kind); } catch (error) {
    if (![401, 410].includes(error.status)) throw error;
    kind = "low-cost-access";
    access = verify(input.token, kind);
  }
  const db = database();
  const table = kind === "order-access" ? "flight_orders" : "low_cost_bookings";
  if (!(await db.query(`SELECT id FROM ${table} WHERE id=$1`, [access.id])).rowCount)
    throw new HttpError(404, "Dossier indisponible.");
  if (input.revoke === true) {
    await db.query("DELETE FROM order_recovery WHERE order_id=$1", [access.id]);
    return { revoked: true };
  }
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = Math.min(access.expiresAt, Date.now() + 86400000);
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  await db.query("INSERT INTO order_recovery(order_id,kind,token_hash,expires_at) VALUES($1,$2,$3,$4) ON CONFLICT(order_id) DO UPDATE SET token_hash=$3,expires_at=$4",
    [access.id, kind, hash, new Date(expiresAt)]);
  return { recoveryToken: token, expiresAt };
}
async function redeem(token) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new HttpError(410, "Lien de reprise indisponible ou expiré.");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const { rows: [row] } = await database().query("SELECT * FROM order_recovery WHERE token_hash=$1 AND expires_at > now()", [hash]);
  if (!row) throw new HttpError(410, "Lien de reprise indisponible ou expiré.");
  const expiresAt = Math.min(new Date(row.expires_at).getTime(), Date.now() + 3600000);
  return { id: row.order_id, kind: row.kind, token: sign({ kind: row.kind, id: row.order_id, expiresAt }), expiresAt };
}
module.exports = { issue, redeem };
