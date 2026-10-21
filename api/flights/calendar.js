const { endpoint, json } = require("../../server/http.js");
const { validate, calendar } = require("../../server/flights.js");
module.exports = endpoint("GET", async (req, res) =>
  json(
    res,
    200,
    await calendar(
      validate(
        Object.fromEntries(new URL(req.url, "http://localhost").searchParams),
        true,
      ),
    ),
  ),
);
