const { endpoint, body, json } = require("../../server/http.js");
const { checkBookingStatus } = require("../../server/travelfusion.js");
module.exports = endpoint("POST", async (req, res) => {
  json(res, 200, await checkBookingStatus(await body(req)));
});
