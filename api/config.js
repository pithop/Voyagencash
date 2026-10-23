const { endpoint, json } = require("../server/http.js");
module.exports = endpoint("GET", async (req, res) => {
  const stripePublicKey =
    process.env.STRIPE_PUBLIC_KEY ||
    process.env.STRIPE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY ||
    null;
  return json(res, 200, {
    mode: (process.env.DUFFEL_API_TOKEN || require("../server/travelfusion.js").configured()) ? "live" : "demo",
    checkout:
      process.env.LIVE_CHECKOUT_ENABLED === "true" &&
      !!(
        process.env.PAYENCASH_WEBHOOK_SECRET &&
        process.env.DUFFEL_API_TOKEN &&
        (process.env.DATABASE_URL || process.env.STORAGE_URL || process.env.POSTGRES_URL) &&
        process.env.PAYENCASH_ADAPTER_URL &&
        process.env.PAYENCASH_API_KEY &&
        process.env.VOUCHER_SIGNING_SECRET
      ),
    stripe: !!stripePublicKey,
    stripePublicKey,
  });
});
