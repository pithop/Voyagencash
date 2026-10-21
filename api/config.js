const { endpoint, json } = require("../server/http.js");
module.exports = endpoint("GET", async (req, res) =>
  json(res, 200, {
    mode: process.env.DUFFEL_API_TOKEN ? "live" : "demo",
    checkout:
      process.env.LIVE_CHECKOUT_ENABLED === "true" &&
      !!(
        process.env.PAYENCASH_WEBHOOK_SECRET &&
        process.env.DUFFEL_API_TOKEN &&
        process.env.DATABASE_URL &&
        process.env.PAYENCASH_ADAPTER_URL &&
        process.env.PAYENCASH_API_KEY &&
        process.env.VOUCHER_SIGNING_SECRET
      ),
  }),
);
