const { endpoint, body, json, verify } = require("../../server/http.js");
const { database } = require("../../server/database.js");
const { duffel } = require("../../server/flights.js");
module.exports = endpoint("POST", async (req, res) => {
  const input = await body(req);
  try {
    const lowCostAccess = verify(input.token, "low-cost-access");
    if (lowCostAccess) {
      return json(res, 200, await require("../../server/travelfusion.js").checkBookingStatus(input));
    }
  } catch {}
  const access = verify(input.token, "order-access");

  // En environnement de test uniquement (VOYAGENCASH_TEST_MODE="true"), simulation controlee
  if (input.confirmPaymentIntentId && process.env.VOYAGENCASH_TEST_MODE === "true" && (process.env.DATABASE_URL || process.env.STORAGE_URL || process.env.POSTGRES_URL)) {
    try {
      await database().query(
        "UPDATE flight_orders SET status='ticket_issued' WHERE id=$1 AND status IN ('awaiting_cash', 'pending', 'awaiting_card', 'hold')",
        [access.id],
      );
    } catch {}
  }

  const {
    rows: [order],
  } = await database().query(
    "SELECT status,expires_at,amount_cents,voucher_reference FROM flight_orders WHERE id=$1",
    [access.id],
  );
  if (!order) return json(res, 404, { error: "Réservation introuvable." });
  const status =
    order.status === "awaiting_cash" &&
    new Date(order.expires_at).getTime() <= Date.now()
      ? "expired"
      : order.status;
  let ticket = null;
  if (status === "ticket_issued") {
    if (access.id.startsWith("off_") || access.id.startsWith("ord_")) {
      try {
        const issued = await duffel("/air/orders/" + encodeURIComponent(access.id));
        ticket = {
          bookingReference: issued.booking_reference,
          documents: issued.documents || [],
          passengers: (issued.passengers || []).map((p) => ({
            given_name: p.given_name,
            family_name: p.family_name,
          })),
          slices: (issued.slices || []).map((s) => ({
            origin: s.origin.iata_code,
            destination: s.destination.iata_code,
            departingAt: s.segments[0].departing_at,
            arrivingAt: s.segments.at(-1).arriving_at,
          })),
        };
      } catch {
        ticket = {
          bookingReference: order.voucher_reference || ("VNC-" + access.id.slice(-6).toUpperCase()),
          documents: [],
          slices: [],
          pendingDocuments: true,
        };
      }
    } else {
      ticket = {
        bookingReference: order.voucher_reference || ("VNC-" + access.id.slice(-6).toUpperCase()),
        documents: [],
        slices: [],
      };
    }
  }
  json(res, 200, {
    id: access.id,
    status,
    expiresAt: new Date(order.expires_at).getTime(),
    amountCents: order.amount_cents,
    ticket,
  });
});
