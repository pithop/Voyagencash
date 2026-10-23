const { endpoint, json } = require("../server/http.js");
module.exports = endpoint("GET", async (req, res) => {
  const capabilities = require("../server/capabilities.js").capabilities();
  json(res, 200, { mode: (process.env.DUFFEL_API_TOKEN || require("../server/travelfusion.js").configured()) ? "live" : "demo",
    ...capabilities, checkout: capabilities.cashCheckout, stripe: capabilities.cardCheckout });
});
