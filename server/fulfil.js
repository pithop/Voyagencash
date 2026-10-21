const { database, transaction } = require("./database.js");
const { duffel } = require("./flights.js");
// A committed claim prevents concurrent workers or retries from making a second payment.
// An interrupted claim is deliberately left for reconciliation, never blindly paid again.
async function fulfilOne() {
  const job = await transaction(async (db) => {
    const {
      rows: [row],
    } = await db.query(
      "SELECT o.*,q.state AS job_state FROM payment_outbox q JOIN flight_orders o ON o.id=q.order_id WHERE q.state='pending' ORDER BY q.created_at FOR UPDATE OF q SKIP LOCKED LIMIT 1",
    );
    if (!row) return null;
    await db.query(
      "UPDATE payment_outbox SET state='processing' WHERE order_id=$1",
      [row.id],
    );
    return row;
  });
  if (!job) return { processed: false };
  try {
    let order = await duffel("/air/orders/" + job.id);
    if (order.payment_status?.awaiting_payment) {
      if (Date.now() >= new Date(job.expires_at).getTime()) {
        await database().query(
          "UPDATE flight_orders SET status='refund_pending' WHERE id=$1",
          [job.id],
        );
        await database().query(
          "UPDATE payment_outbox SET state='refund_pending' WHERE order_id=$1",
          [job.id],
        );
        return { processed: true, state: "refund_pending" };
      }
      if (
        order.total_currency !== "EUR" ||
        Math.round(Number(order.total_amount) * 100) !== job.amount_cents
      )
        throw new Error("Provider amount mismatch");
      await duffel("/air/payments", {
        order_id: job.id,
        type: "balance",
        currency: "EUR",
        amount: (job.amount_cents / 100).toFixed(2),
      });
      order = await duffel("/air/orders/" + job.id);
    }
    if (
      order.payment_status?.awaiting_payment !== false ||
      !order.documents?.some((d) => d.type === "electronic_ticket")
    )
      throw new Error("Awaiting provider issuance");
    await transaction(async (db) => {
      await db.query(
        "UPDATE flight_orders SET status='ticket_issued' WHERE id=$1",
        [job.id],
      );
      await db.query(
        "UPDATE payment_outbox SET state='complete' WHERE order_id=$1",
        [job.id],
      );
    });
    return { processed: true, state: "ticket_issued" };
  } catch {
    await database().query(
      "UPDATE payment_outbox SET state='reconciliation_required' WHERE order_id=$1",
      [job.id],
    );
    return { processed: true, state: "reconciliation_required" };
  }
}
module.exports = { fulfilOne };
