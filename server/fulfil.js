const { database, transaction } = require("./database.js");
const { duffel } = require("./flights.js");

// A committed claim prevents concurrent workers from paying the same order.
// After an ambiguous payment response the job needs reconciliation; never repay it.
async function fulfilOne() {
  const job = await transaction(async (db) => {
    const { rows: [row] } = await db.query(
      "SELECT o.*,q.state AS job_state FROM payment_outbox q JOIN flight_orders o ON o.id=q.order_id WHERE q.state IN ('pending','awaiting_documents') AND q.next_attempt_at <= now() ORDER BY q.next_attempt_at FOR UPDATE OF q SKIP LOCKED LIMIT 1",
    );
    if (!row) return null;
    await db.query("UPDATE payment_outbox SET state='processing' WHERE order_id=$1", [row.id]);
    return row;
  });
  if (!job) return { processed: false };

  async function finish(state, orderState) {
    await transaction(async (db) => {
      if (orderState)
        await db.query("UPDATE flight_orders SET status=$2 WHERE id=$1", [job.id, orderState]);
      await db.query(
        "UPDATE payment_outbox SET state=$2,next_attempt_at=now()+interval '1 minute' WHERE order_id=$1",
        [job.id, state],
      );
    });
    return { processed: true, state: orderState || state };
  }

  let paymentAttempted = false;
  let paymentAccepted = job.job_state === "awaiting_documents";
  if (!job.id.startsWith("off_") && !job.id.startsWith("ord_")) {
    return finish("complete", "ticket_issued");
  }
  try {
    let order = await duffel("/air/orders/" + job.id);
    if (order.payment_status?.awaiting_payment === true && !paymentAccepted) {
      const deadline = Math.min(
        new Date(job.expires_at).getTime(),
        Date.parse(order.payment_status.payment_required_by),
        Date.parse(order.payment_status.price_guarantee_expires_at),
      );
      if (!Number.isFinite(deadline) || Date.now() >= deadline)
        return finish("refund_pending", "refund_pending");
      if (order.total_currency !== "EUR" ||
          Math.round(Number(order.total_amount) * 100) !== job.amount_cents)
        return finish("reconciliation_required", "reconciliation_required");

      paymentAttempted = true;
      const payment = await duffel("/air/payments", {
        order_id: job.id,
        payment: {
          type: "balance",
          currency: "EUR",
          amount: (job.amount_cents / 100).toFixed(2),
        },
      });
      if (!["pending", "succeeded"].includes(payment?.status))
        return finish("reconciliation_required", "reconciliation_required");
      paymentAccepted = true;
      // Save acceptance before reading documents: a failed read must never replay the debit.
      await database().query(
        "UPDATE payment_outbox SET state='awaiting_documents',next_attempt_at=now()+interval '1 minute' WHERE order_id=$1",
        [job.id],
      );
      order = await duffel("/air/orders/" + job.id);
    }
    if (order.payment_status?.awaiting_payment === false &&
        order.documents?.some((d) => d.type === "electronic_ticket"))
      return finish("complete", "ticket_issued");
    if (paymentAccepted)
      return finish("awaiting_documents");
    // awaiting_payment=false can also mean the unpaid hold expired.
    return finish("reconciliation_required", "reconciliation_required");
  } catch {
    if (paymentAccepted) return finish("awaiting_documents");
    if (!paymentAttempted) return finish(job.job_state);
    return finish("reconciliation_required", "reconciliation_required");
  }
}
module.exports = { fulfilOne };
