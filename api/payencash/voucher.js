const crypto = require("node:crypto");
const {
  endpoint,
  body,
  json,
  HttpError,
  sign,
  verify,
} = require("../../server/http.js");
const { transaction } = require("../../server/database.js");
module.exports = endpoint("POST", async (req, res) => {
  const { holdToken } = await body(req),
    hold = verify(holdToken, "hold");
  if (
    !Number.isInteger(hold.amountCents) ||
    hold.amountCents < 1 ||
    hold.amountCents > 100000 ||
    hold.currency !== "EUR"
  )
    throw new HttpError(
      422,
      "Le plafond espèces est de 1 000 € par réservation.",
    );
  const reference = `VNC-${new Date().getUTCFullYear()}-${crypto.createHash("sha256").update(hold.id).digest("hex").slice(0, 5).toUpperCase()}`;
  const voucher = {
    kind: "voucher",
    orderId: hold.id,
    reference,
    amountCents: hold.amountCents,
    currency: "EUR",
    expiresAt: hold.expiresAt,
    simulation: hold.simulation,
    fiscal: {
      classification: "BUM_SUBJECT_TO_PARTNER_VALIDATION",
      vatAtVoucherIssue: 0,
    },
  };
  if (hold.simulation)
    return json(res, 201, {
      ...voucher,
      token: sign(voucher),
      qrPayload: `DEMO|${reference}|${sign(voucher)}`,
    });
  const result = await transaction(async (db) => {
    const {
      rows: [order],
    } = await db.query("SELECT * FROM flight_orders WHERE id=$1 FOR UPDATE", [
      hold.id,
    ]);
    if (
      !order ||
      order.status !== "awaiting_cash" ||
      new Date(order.expires_at).getTime() <= Date.now()
    )
      throw new HttpError(409, "Réservation indisponible.");
    if (order.voucher) return order.voucher;
    if (!process.env.PAYENCASH_ADAPTER_URL || !process.env.PAYENCASH_API_KEY)
      throw new HttpError(503, "Le service partenaire doit être configuré.");
    const base = new URL(process.env.PAYENCASH_ADAPTER_URL);
    if (base.protocol !== "https:")
      throw new HttpError(503, "L’adaptateur partenaire doit utiliser HTTPS.");
    const response = await fetch(
      new URL(
        "vouchers",
        base.href.endsWith("/") ? base : new URL(base.href + "/"),
      ),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYENCASH_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": hold.id,
        },
        body: JSON.stringify({ ...voucher, reference }),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      throw new HttpError(
        502,
        "Le partenaire ne peut pas émettre le bon pour le moment.",
      );
    const partner = await response.json();
    if (
      typeof partner.qrPayload !== "string" ||
      partner.qrPayload.length < 10 ||
      partner.qrPayload.length > 2048 ||
      partner.reference !== reference
    )
      throw new HttpError(502, "Réponse partenaire invalide.");
    const issued = {
      ...voucher,
      qrPayload: partner.qrPayload,
      token: sign(voucher),
    };
    await db.query(
      "UPDATE flight_orders SET voucher_reference=$2,voucher=$3 WHERE id=$1",
      [hold.id, reference, issued],
    );
    return issued;
  });
  json(res, 201, result);
});
