const { endpoint, body, json } = require("../../server/http.js");
const { validate, search } = require("../../server/flights.js");
module.exports = endpoint("POST", async (req, res) =>
  json(res, 200, await search(validate(await body(req)))),
);
