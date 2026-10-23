const crypto = require("node:crypto");
const { endpoint, json, HttpError } = require("../../server/http.js");
module.exports = endpoint("GET", async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (
    !secret ||
    process.env.LIVE_CHECKOUT_ENABLED !== "true" ||
    !process.env.DUFFEL_API_TOKEN
  )
    throw new HttpError(503, "Émission non activée.");
  const provided = Buffer.from(req.headers.authorization || ""),
    expected = Buffer.from("Bearer " + secret);
  if (
    provided.length !== expected.length ||
    !crypto.timingSafeEqual(provided, expected)
  )
    throw new HttpError(401, "Authentification requise.");
  json(res, 200, await require("../../server/fulfil.js").fulfilBatch());
});
