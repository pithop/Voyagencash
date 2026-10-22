const { endpoint, body, json } = require("../../server/http.js");
const { bookFlight } = require("../../server/travelfusion.js");
module.exports = endpoint("POST", async (req, res) => {
  const input = await body(req);
  json(res, 201, await bookFlight({ ...input, idempotencyKey: req.headers["idempotency-key"] }));
});
