const { endpoint, body, json, verify, HttpError } = require("../../server/http.js");
const { database } = require("../../server/database.js");
module.exports = endpoint("POST", async (req, res) => {
  const input = await body(req);
  if (input.recoveryToken) {
    return json(res, 200, await require("../../server/recovery.js").redeem(input.recoveryToken));
  }
  let access;
  try { access = verify(input.token, "low-cost-access"); } catch (error) {
    if (![401, 410].includes(error.status)) throw error;
  }
  if (access) return json(res, 200, await require("../../server/travelfusion.js").checkBookingStatus({ token: input.token, readOnly: true }));
  access = verify(input.token, "order-access");
  const { rows: [order] } = await database().query("SELECT * FROM flight_orders WHERE id=$1", [access.id]);
  if (!order) throw new HttpError(404, "Réservation introuvable.");
  const status = ["awaiting_cash", "awaiting_card"].includes(order.status) && new Date(order.expires_at).getTime() <= Date.now() ? "expired" : order.status;
  const proof = order.ticket?.bookingReference && order.ticket.documents?.some(d => d.type === "electronic_ticket" && d.unique_identifier);
  json(res, 200, { id: access.id, status, expiresAt: new Date(order.expires_at).getTime(),
    amountCents: order.amount_cents, paymentMethod: order.payment_method,
    voucher: order.voucher, ticket: status === "ticket_issued" && proof ? order.ticket : null,
    pendingDocuments: status === "ticket_issued" && !proof });
});
