const crypto = require("node:crypto");
const { database, transaction } = require("./database.js");
const { duffel } = require("./flights.js");

async function fulfilOne({ budgetMs = 45000 } = {}) {
  const claim = crypto.randomUUID();
  const started = Date.now();
  const job = await transaction(async db => {
    const { rows: [row] } = await db.query(
      "SELECT o.*,q.state AS job_state,q.phase,q.claim_token,q.attempt_count,q.created_at AS queued_at FROM payment_outbox q JOIN flight_orders o ON o.id=q.order_id WHERE ((q.state IN ('pending','awaiting_documents') AND q.next_attempt_at <= now()) OR (q.state='processing' AND (q.lease_until IS NULL OR q.lease_until <= now()))) ORDER BY q.next_attempt_at FOR UPDATE OF q SKIP LOCKED LIMIT 1",
    );
    if (!row) return null;
    await db.query("UPDATE payment_outbox SET state='processing',claim_token=$2,lease_until=now()+interval '1 minute',attempt_count=attempt_count+1,updated_at=now() WHERE order_id=$1", [row.id, claim]);
    return row;
  });
  if (!job) return { processed: false };
  async function phase(value) {
    const result = await database().query("UPDATE payment_outbox SET phase=$3,updated_at=now() WHERE order_id=$1 AND claim_token=$2 AND state='processing' AND lease_until > now()", [job.id, claim, value]);
    if (!result.rowCount) throw new Error("claim_lost");
  }
  async function finish(state, orderState, ticket = null) {
    const owned = await transaction(async db => {
      const result = await db.query("UPDATE payment_outbox SET state=$3,claim_token=NULL,lease_until=NULL,next_attempt_at=now()+interval '1 minute',updated_at=now() WHERE order_id=$1 AND claim_token=$2 AND state='processing' AND lease_until > now()", [job.id, claim, state]);
      if (!result.rowCount) return false;
      if (orderState) await db.query("UPDATE flight_orders SET status=$2,ticket=COALESCE($3,ticket) WHERE id=$1 AND status='payment_received'", [job.id, orderState, ticket]);
      return true;
    });
    return { processed: true, state: owned ? orderState || state : "claim_lost" };
  }
  const request = (path, data) => {
    const remaining = budgetMs - (Date.now() - started);
    if (remaining < 1500) throw new Error("worker_budget_exhausted");
    return duffel(path, data, data ? "POST" : "GET", Math.min(12000, remaining));
  };
  if (job.status !== "payment_received") return finish("reconciliation_required");
  if (job.provider !== "duffel") return finish("reconciliation_required", "reconciliation_required");
  // An expired claim around a write is ambiguous even if the provider still says unpaid.
  let paymentAttempted = job.phase === "payment_in_flight" || (job.job_state === "processing" && !job.claim_token);
  let paymentAccepted = job.phase === "awaiting_documents" || job.job_state === "awaiting_documents";
  // A claim token proves the new phase protocol was used; legacy claims stay ambiguous.
  try {
    let order = await request("/air/orders/" + encodeURIComponent(job.id));
    if (order.payment_status?.awaiting_payment === true && !paymentAccepted && !paymentAttempted) {
      const deadline = Math.min(new Date(job.expires_at).getTime(),
        Date.parse(order.payment_status.payment_required_by), Date.parse(order.payment_status.price_guarantee_expires_at));
      if (!Number.isFinite(deadline) || Date.now() >= deadline) return finish("refund_pending", "refund_pending");
      if (order.total_currency !== job.currency || Math.round(Number(order.total_amount) * 100) !== job.amount_cents)
        return finish("reconciliation_required", "reconciliation_required");
      await phase("payment_in_flight");
      paymentAttempted = true;
      const payment = await request("/air/payments", { order_id: job.id,
        payment: { type: "balance", currency: job.currency, amount: (job.amount_cents / 100).toFixed(2) } });
      if (!["pending", "succeeded"].includes(payment?.status)) return finish("reconciliation_required", "reconciliation_required");
      paymentAccepted = true;
      await phase("awaiting_documents");
      order = await request("/air/orders/" + encodeURIComponent(job.id));
    }
    if (order.payment_status?.awaiting_payment === false && order.booking_reference &&
        order.documents?.some(d => d.type === "electronic_ticket" && d.unique_identifier)) {
      const ticket = { bookingReference: order.booking_reference,
        documents: order.documents.filter(d => d.type === "electronic_ticket").map(d => ({ type: d.type, unique_identifier: d.unique_identifier })),
        slices: (order.slices || []).map(s => ({ origin: s.origin?.iata_code, destination: s.destination?.iata_code,
          departingAt: s.segments?.[0]?.departing_at, arrivingAt: s.segments?.at(-1)?.arriving_at })) };
      return finish("complete", "ticket_issued", ticket);
    }
    if (paymentAccepted && Date.now() - new Date(job.queued_at).getTime() < 24 * 3600000 && job.attempt_count < 120)
      return finish("awaiting_documents");
    return finish("reconciliation_required", "reconciliation_required");
  } catch {
    if (job.attempt_count >= 120 || Date.now() - new Date(job.queued_at).getTime() >= 24 * 3600000)
      return finish("reconciliation_required", "reconciliation_required");
    if (paymentAccepted) return finish("awaiting_documents");
    if (!paymentAttempted) return finish("pending");
    return finish("reconciliation_required", "reconciliation_required");
  }
}
async function fulfilBatch() {
  const started = Date.now(), jobs = [];
  await database().query("INSERT INTO worker_heartbeat(name,started_at) VALUES('fulfil',now()) ON CONFLICT(name) DO UPDATE SET started_at=now()");
  while (jobs.length < 10 && Date.now() - started < 35000) {
    const job = await fulfilOne({ budgetMs: Math.max(1500, 45000 - (Date.now() - started)) });
    if (!job.processed) break;
    jobs.push(job);
  }
  await database().query("UPDATE worker_heartbeat SET completed_at=now() WHERE name='fulfil'");
  return { processed: jobs.length, jobs };
}
module.exports = { fulfilOne, fulfilBatch };
