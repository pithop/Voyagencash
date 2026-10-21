const { endpoint, body, verify, HttpError } = require("../../server/http.js");
const { database } = require("../../server/database.js");
module.exports = endpoint("POST", async (req, res) => {
  const access = verify((await body(req)).token, "order-access");
  const {
    rows: [saved],
  } = await database().query("SELECT status FROM flight_orders WHERE id=$1", [
    access.id,
  ]);
  if (saved?.status !== "ticket_issued")
    throw new HttpError(409, "Le billet doit être émis avant l’export Wallet.");
  if (!process.env.PAYENCASH_ADAPTER_URL || !process.env.PAYENCASH_API_KEY)
    throw new HttpError(
      503,
      "Le service Wallet partenaire doit être configuré.",
    );
  const base = new URL(process.env.PAYENCASH_ADAPTER_URL);
  if (base.protocol !== "https:")
    throw new HttpError(503, "Adaptateur HTTPS requis.");
  // The partner owns Apple certificates and airline check-in data; never fabricate a boarding barcode.
  const response = await fetch(
    new URL(
      "wallet",
      base.href.endsWith("/") ? base : new URL(base.href + "/"),
    ),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYENCASH_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orderId: access.id }),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (
    !response.ok ||
    !response.headers
      .get("content-type")
      ?.includes("application/vnd.apple.pkpass")
  )
    throw new HttpError(
      502,
      "Le pass Apple Wallet signé n’est pas disponible auprès du partenaire.",
    );
  const bytes = Buffer.from(await response.arrayBuffer());
  if (
    bytes.length > 2 * 1024 * 1024 ||
    bytes.length < 4 ||
    bytes.readUInt32LE(0) !== 0x04034b50
  )
    throw new HttpError(502, "Archive Wallet invalide.");
  res.setHeader("Content-Type", "application/vnd.apple.pkpass");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="voyagencash.pkpass"',
  );
  res.setHeader("Cache-Control", "no-store");
  res.statusCode = 200;
  res.end(bytes);
});
