const { test, expect } = require("@playwright/test");
const { newDb } = require("pg-mem");
const { readFileSync } = require("node:fs");
const { Readable } = require("node:stream");
const crypto = require("node:crypto");
async function invoke(handler, data, headers = {}) {
  const raw = JSON.stringify(data),
    req = Readable.from([Buffer.from(raw)]);
  req.headers = { host: "localhost", ...headers };
  req.method = "POST";
  req.url = "/api/test";
  const res = {
    statusCode: 200,
    setHeader() {},
    end(v) {
      this.body = JSON.parse(v);
    },
  };
  await handler(req, res);
  return res;
}
test.describe("durable payment lifecycle with a PostgreSQL emulator", () => {
  test.describe.configure({ mode: "serial" });
  let pool, env, oldDatabase, oldFetch;
  const dbPath = require.resolve("../server/database.js");
  const routes = [
    "../api/orders/hold.js",
    "../api/payencash/voucher.js",
    "../api/payencash/webhook.js",
    "../server/fulfil.js",
    "../server/instant-checkout.js",
    "../api/orders/status.js",
    "../api/stripe/create-intent.js",
    "../api/stripe/webhook.js",
    "../server/recovery.js",
    "../server/travelfusion.js",
  ];
  test.beforeEach(async () => {
    env = { ...process.env };
    oldFetch = global.fetch;
    Object.assign(process.env, {
      DUFFEL_API_TOKEN: "test-token",
      DATABASE_URL: "test-in-memory",
      PAYENCASH_ADAPTER_URL: "https://partner.example.test/",
      PAYENCASH_API_KEY: "test-key",
      PAYENCASH_WEBHOOK_SECRET: "test-webhook-secret",
      VOUCHER_SIGNING_SECRET: "test-signing-secret",
      LIVE_CHECKOUT_ENABLED: "true",
    });
    const memory = newDb();
    memory.public.none(readFileSync("server/schema.sql", "utf8"));
    const { Pool } = memory.adapters.createPg();
    pool = new Pool();
    // pg-mem does not implement row locking. Production uses PostgreSQL locks;
    // these tests cover payment transitions and the provider wire contract.
    const query = pool.query.bind(pool);
    pool.query = (sql, values) => query(sql.replace(" FOR UPDATE OF q SKIP LOCKED", ""), values);
    require(dbPath);
    oldDatabase = require.cache[dbPath].exports;
    require.cache[dbPath].exports = {
      database: () => pool,
      transaction: async (fn) => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const result = await fn({ query: (sql, values) => client.query(sql.replace(" FOR UPDATE OF q SKIP LOCKED", ""), values) });
          await client.query("COMMIT");
          return result;
        } catch (e) {
          await client.query("ROLLBACK");
          throw e;
        } finally {
          client.release();
        }
      },
    };
    for (const route of routes) delete require.cache[require.resolve(route)];
  });
  test.afterEach(async () => {
    await pool.end();
    require.cache[dbPath].exports = oldDatabase;
    for (const route of routes) delete require.cache[require.resolve(route)];
    global.fetch = oldFetch;
    for (const k of Object.keys(process.env))
      if (!(k in env)) delete process.env[k];
    Object.assign(process.env, env);
  });
  function notification(data) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    return {
      "x-payencash-timestamp": timestamp,
      "x-payencash-signature":
        "sha256=" +
        crypto
          .createHmac("sha256", process.env.PAYENCASH_WEBHOOK_SECRET)
          .update(timestamp + "." + JSON.stringify(data))
          .digest("hex"),
    };
  }
  async function order(id = "ord_test", expiresAt = Date.now() + 7200000) {
    await pool.query(
      "INSERT INTO flight_orders(id,amount_cents,currency,expires_at,voucher_reference,provider) VALUES($1,14200,'EUR',$2,'VNC-2026-ABCDE','duffel')",
      [id, new Date(expiresAt)],
    );
  }
  test("authenticated payment is stored once and creates exactly one durable issuance job", async () => {
    await order();
    const handler = require("../api/payencash/webhook.js");
    const event = {
      id: "evt_test",
      orderId: "ord_test",
      type: "voucher.paid",
      reference: "VNC-2026-ABCDE",
      amountCents: 14200,
      currency: "EUR",
    };
    const first = await invoke(handler, event, notification(event));
    expect(first.statusCode).toBe(200);
    expect(first.body.state).toBe("payment_received");
    const duplicate = await invoke(handler, event, notification(event));
    expect(duplicate.body.duplicate).toBe(true);
    expect(
      (await pool.query("SELECT * FROM payment_events")).rows,
    ).toHaveLength(1);
    expect(
      (await pool.query("SELECT * FROM payment_outbox")).rows,
    ).toHaveLength(1);
    expect(
      (await pool.query("SELECT status FROM flight_orders")).rows[0].status,
    ).toBe("payment_received");
  });
  test("wrong amount never advances the order and late cash is routed for refund", async () => {
    await order("ord_test", Date.now() - 1000);
    const handler = require("../api/payencash/webhook.js");
    const event = {
      id: "evt_test",
      orderId: "ord_test",
      type: "voucher.paid",
      reference: "VNC-2026-ABCDE",
      amountCents: 100,
      currency: "EUR",
    };
    expect((await invoke(handler, event, notification(event))).statusCode).toBe(
      200,
    );
    expect(
      (await pool.query("SELECT * FROM payment_events")).rows,
    ).toHaveLength(0);
    event.id = "evt_late";
    event.amountCents = 14200;
    const late = await invoke(handler, event, notification(event));
    expect(late.body.state).toBe("refund_pending");
    expect(
      (await pool.query("SELECT state FROM payment_outbox")).rows[0].state,
    ).toBe("refund_pending");
  });
  test("real hold is idempotent, omits payments, binds price, and voucher comes from the partner", async () => {
    let creations = 0,
      vouchers = 0;
    const deadline = new Date(Date.now() + 3 * 3600000).toISOString();
    global.fetch = async (url, options) => {
      url = String(url);
      let data;
      if (url.includes("/air/offers/"))
        data = {
          total_currency: "EUR",
          total_amount: "142.00",
          passengers: [{ id: "pas_test" }],
          payment_requirements: {
            requires_instant_payment: false,
            payment_required_by: deadline,
            price_guarantee_expires_at: deadline,
          },
        };
      else if (url.endsWith("/air/orders")) {
        creations++;
        const payload = JSON.parse(options.body).data;
        expect(payload.type).toBe("hold");
        expect(payload).not.toHaveProperty("payments");
        data = {
          id: "ord_test",
          total_currency: "EUR",
          total_amount: "142.00",
          payment_status: {
            awaiting_payment: true,
            payment_required_by: deadline,
            price_guarantee_expires_at: deadline,
          },
          booking_reference: "ABCDEF",
        };
      } else if (url.endsWith("/vouchers")) {
        vouchers++;
        const payload = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({
            reference: payload.reference,
            qrPayload: "PARTNER|" + payload.reference,
          }),
        };
      } else throw new Error("Unexpected endpoint");
      return { ok: true, json: async () => ({ data }) };
    };
    const input = {
      offerId: "off_test",
      expectedAmountCents: 14200,
      passengers: [
        {
          id: "pas_test",
          given_name: "Lea",
          family_name: "Martin",
          born_on: "1990-01-01",
          gender: "f",
          title: "ms",
          phone_number: "+33612345678",
          email: "lea@example.test",
        },
      ],
    };
    const headers = { "idempotency-key": crypto.randomUUID() };
    const handler = require("../api/orders/hold.js");
    const first = await invoke(handler, input, headers);
    expect(first.statusCode).toBe(201);
    expect(first.body.simulation).toBe(false);
    const repeat = await invoke(handler, input, headers);
    expect(repeat.body.token).toBe(first.body.token);
    expect(creations).toBe(1);
    expect(
      (await invoke(handler, { ...input, expectedAmountCents: 10000 }, headers))
        .statusCode,
    ).toBe(409);
    const voucherHandler = require("../api/payencash/voucher.js");
    const voucher = await invoke(voucherHandler, {
      holdToken: first.body.token,
    });
    expect(voucher.statusCode).toBe(201);
    expect(voucher.body.qrPayload).toContain("PARTNER|");
    expect(voucher.body.simulation).toBe(false);
    await invoke(voucherHandler, { holdToken: first.body.token });
    expect(vouchers).toBe(1);
  });
  async function paidJob(expiresAt = Date.now() + 7200000) {
    await order("ord_test", expiresAt);
    await pool.query("UPDATE flight_orders SET status='payment_received' WHERE id='ord_test'");
    await pool.query("INSERT INTO payment_events(id,order_id) VALUES('evt_worker','ord_test')");
    await pool.query("INSERT INTO payment_outbox(order_id,event_id) VALUES('ord_test','evt_worker')");
  }
  function providerOrder(extra = {}) {
    return {
      booking_reference: "ABCDEF", total_currency: "EUR", total_amount: "142.00",
      payment_status: {
        awaiting_payment: true,
        payment_required_by: new Date(Date.now() + 7200000).toISOString(),
        price_guarantee_expires_at: new Date(Date.now() + 7200000).toISOString(),
      },
      documents: [], ...extra,
    };
  }
  test("provider payment uses the documented nested contract; delayed tickets are read again without paying twice", async () => {
    await paidJob();
    let payments = 0, documentsReady = false;
    global.fetch = async (url, options) => {
      if (String(url).endsWith("/air/payments")) {
        payments++;
        expect(JSON.parse(options.body)).toEqual({ data: {
          order_id: "ord_test",
          payment: { type: "balance", currency: "EUR", amount: "142.00" },
        } });
        return { ok: true, json: async () => ({ data: { id: "pay_test", status: "succeeded" } }) };
      }
      return { ok: true, json: async () => ({ data: providerOrder(payments ? {
        payment_status: { awaiting_payment: false },
        documents: documentsReady ? [{ type: "electronic_ticket", unique_identifier: "123-456789" }] : [],
      } : {}) }) };
    };
    const { fulfilOne } = require("../server/fulfil.js");
    expect((await fulfilOne()).state).toBe("awaiting_documents");
    expect((await pool.query("SELECT status FROM flight_orders")).rows[0].status).toBe("payment_received");
    documentsReady = true;
    await pool.query("UPDATE payment_outbox SET next_attempt_at=now()");
    expect((await fulfilOne()).state).toBe("ticket_issued");
    expect((await fulfilOne()).processed).toBe(false);
    expect(payments).toBe(1);
  });
  test("ambiguous payment response stops issuance and never repeats a debit", async () => {
    await paidJob();
    let payments = 0;
    global.fetch = async (url) => {
      if (String(url).endsWith("/air/payments")) { payments++; throw new Error("connection closed after debit"); }
      return { ok: true, json: async () => ({ data: providerOrder() }) };
    };
    const { fulfilOne } = require("../server/fulfil.js");
    expect((await fulfilOne()).state).toBe("reconciliation_required");
    expect((await fulfilOne()).processed).toBe(false);
    expect(payments).toBe(1);
    expect((await pool.query("SELECT status FROM flight_orders")).rows[0].status).toBe("reconciliation_required");
  });
  test("expired holds and changed provider totals cannot debit the balance", async () => {
    await paidJob(Date.now() - 1000);
    let payments = 0;
    global.fetch = async (url) => {
      if (String(url).endsWith("/air/payments")) payments++;
      return { ok: true, json: async () => ({ data: providerOrder({ total_amount: "145.00" }) }) };
    };
    const { fulfilOne } = require("../server/fulfil.js");
    expect((await fulfilOne()).state).toBe("refund_pending");
    await pool.query("UPDATE flight_orders SET expires_at=$1,status='payment_received'", [new Date(Date.now() + 7200000)]);
    await pool.query("UPDATE payment_outbox SET state='pending',next_attempt_at=now()");
    expect((await fulfilOne()).state).toBe("reconciliation_required");
    expect(payments).toBe(0);
  });

  function holdToken(id = "ord_test") {
    return require("../server/http.js").sign({ kind: "hold", id, amountCents: 14200, currency: "EUR", expiresAt: Date.now() + 7200000 });
  }
  function accessToken(id = "ord_test") {
    return require("../server/http.js").sign({ kind: "order-access", id, expiresAt: Date.now() + 7200000 });
  }
  function stripeEvent(extra = {}) {
    return { id: "evt_stripe", type: "payment_intent.succeeded", created: Math.floor(Date.now() / 1000), livemode: false,
      data: { object: { id: "pi_test", status: "succeeded", amount_received: 14200, currency: "eur", livemode: false, metadata: { orderId: "ord_test" }, ...extra } } };
  }
  function stripeSignature(event) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const sig = crypto.createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET).update(timestamp + "." + JSON.stringify(event)).digest("hex");
    return { "stripe-signature": `t=${timestamp},v1=${"0".repeat(64)},v1=${sig}` };
  }
  async function cardOrder() {
    await order();
    await pool.query("UPDATE flight_orders SET voucher_reference=NULL,payment_method='card',status='awaiting_card'");
    await pool.query("INSERT INTO payment_attempts(order_id,idempotency_key,payment_id,amount_cents,currency,livemode) VALUES('ord_test','stripe-key','pi_test',14200,'EUR',false)");
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  }
  test("status remains read-only even with a simulated payment confirmation and provider outage", async () => {
    await order();
    global.fetch = async () => { throw new Error("Status must not contact a provider"); };
    const handler = require("../api/orders/status.js");
    const result = await invoke(handler, { token: accessToken(), confirmPaymentIntentId: "pi_sim_forged" });
    expect(result.body.status).toBe("awaiting_cash");
    expect((await pool.query("SELECT status FROM flight_orders")).rows[0].status).toBe("awaiting_cash");
    await pool.query("UPDATE flight_orders SET status='ticket_issued'");
    const issued = await invoke(handler, { token: accessToken() });
    expect(issued.body.ticket).toBeNull();
    expect(issued.body.pendingDocuments).toBe(true);
  });
  test("card creation authenticates the hold, locks out cash and reuses one persisted payment", async () => {
    await order();
    await pool.query("UPDATE flight_orders SET voucher_reference=NULL");
    process.env.STRIPE_SECRET_KEY = "sk_test_local";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    let calls = 0;
    global.fetch = async (_url, options) => {
      calls++;
      expect(options.headers["Idempotency-Key"]).toBe("order:ord_test:v1");
      return { ok: true, json: async () => ({ id: "pi_test", client_secret: "pi_test_secret", amount: 14200, currency: "eur", livemode: false, metadata: { orderId: "ord_test" } }) };
    };
    const handler = require("../api/stripe/create-intent.js");
    expect((await invoke(handler, { orderId: "ord_test" })).statusCode).toBe(400);
    expect((await invoke(handler, { holdToken: holdToken(), orderId: "ord_other" })).statusCode).toBe(403);
    const results = await Promise.all(Array.from({ length: 10 }, () => invoke(handler, { holdToken: holdToken() })));
    expect(results.every(r => r.statusCode === 200 && r.body.id === "pi_test")).toBe(true);
    expect((await pool.query("SELECT * FROM payment_attempts")).rows).toHaveLength(1);
    expect(calls).toBeGreaterThan(0);
    expect((await invoke(require("../api/payencash/voucher.js"), { holdToken: holdToken() })).statusCode).toBe(409);
  });
  test("Stripe reconciles exact intent, currency and mode and deduplicates different events for one receipt", async () => {
    await cardOrder();
    const handler = require("../api/stripe/webhook.js");
    const good = stripeEvent();
    expect((await invoke(handler, good, stripeSignature(good))).body.state).toBe("accepted");
    expect((await invoke(handler, good, stripeSignature(good))).body.duplicate).toBe(true);
    const repeat = { ...good, id: "evt_repeat" };
    expect((await invoke(handler, repeat, stripeSignature(repeat))).body.duplicate).toBe(true);
    expect((await pool.query("SELECT * FROM payment_outbox")).rows).toHaveLength(1);
    for (const [i, patch] of [{ id: "pi_other" }, { amount_received: 1 }, { currency: "usd" }, { livemode: true }].entries()) {
      const bad = { ...stripeEvent(patch), id: "evt_bad_" + i };
      expect((await invoke(handler, bad, stripeSignature(bad))).body.reconciliation_required).toBe(true);
    }
    expect((await pool.query("SELECT status FROM flight_orders")).rows[0].status).toBe("payment_received");
    expect((await pool.query("SELECT * FROM payment_receipts WHERE result='reconciliation_required'")).rows).toHaveLength(4);
  });
  test("Stripe fails closed without a secret and asks for retry when intent persistence is racing", async () => {
    await cardOrder();
    const handler = require("../api/stripe/webhook.js"), event = stripeEvent();
    await pool.query("UPDATE payment_attempts SET payment_id=NULL");
    expect((await invoke(handler, event, stripeSignature(event))).statusCode).toBe(503);
    expect((await pool.query("SELECT * FROM payment_receipts")).rows).toHaveLength(0);
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect((await invoke(handler, event)).statusCode).toBe(503);
  });
  test("unexpected and late Stripe receipts remain durable without regressing an issued ticket", async () => {
    await cardOrder();
    const handler = require("../api/stripe/webhook.js");
    await pool.query("UPDATE flight_orders SET expires_at=$1", [new Date(Date.now() - 1)]);
    const late = stripeEvent();
    expect((await invoke(handler, late, stripeSignature(late))).body.state).toBe("refund_pending");
    await pool.query("UPDATE flight_orders SET status='ticket_issued'");
    const other = { ...stripeEvent({ id: "pi_other" }), id: "evt_extra" };
    expect((await invoke(handler, other, stripeSignature(other))).body.reconciliation_required).toBe(true);
    const unknown = { ...stripeEvent({ metadata: { orderId: "missing" } }), id: "evt_unknown" };
    expect((await invoke(handler, unknown, stripeSignature(unknown))).body.reconciliation_required).toBe(true);
    expect((await pool.query("SELECT status FROM flight_orders")).rows[0].status).toBe("ticket_issued");
  });
  test("cash timeout retains its durable payment claim and cannot become a card payment", async () => {
    await order();
    await pool.query("UPDATE flight_orders SET voucher_reference=NULL");
    global.fetch = async () => { throw new Error("Partner accepted voucher before timeout"); };
    expect((await invoke(require("../api/payencash/voucher.js"), { holdToken: holdToken() })).statusCode).toBe(500);
    const saved = (await pool.query("SELECT * FROM flight_orders")).rows[0];
    expect(saved.payment_method).toBe("cash");
    expect(saved.voucher_reference).toMatch(/^VNC-/);
    process.env.STRIPE_SECRET_KEY = "sk_test_local"; process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    expect((await invoke(require("../api/stripe/create-intent.js"), { holdToken: holdToken() })).statusCode).toBe(409);
  });
  test("expired worker leases around a debit reconcile without paying again", async () => {
    await paidJob();
    await pool.query("UPDATE payment_outbox SET state='processing',phase='payment_in_flight',claim_token='old',lease_until=$1", [new Date(Date.now() - 1)]);
    let writes = 0;
    global.fetch = async (_url, options) => { if (options.method === "POST") writes++; return { ok: true, json: async () => ({ data: providerOrder() }) }; };
    expect((await require("../server/fulfil.js").fulfilOne()).state).toBe("reconciliation_required");
    expect(writes).toBe(0);
  });
  test("worker never issues unknown providers and cannot finish a stolen claim", async () => {
    await paidJob();
    await pool.query("UPDATE flight_orders SET provider='unknown'");
    expect((await require("../server/fulfil.js").fulfilOne()).state).toBe("reconciliation_required");
    await pool.query("UPDATE flight_orders SET status='payment_received',provider='duffel'");
    await pool.query("UPDATE payment_outbox SET state='pending',next_attempt_at=now()");
    global.fetch = async () => {
      await pool.query("UPDATE payment_outbox SET claim_token='replacement'");
      return { ok: true, json: async () => ({ data: providerOrder({ payment_status: { awaiting_payment: false }, documents: [{ type: "electronic_ticket", unique_identifier: "123" }] }) }) };
    };
    expect((await require("../server/fulfil.js").fulfilOne()).state).toBe("claim_lost");
    expect((await pool.query("SELECT status FROM flight_orders")).rows[0].status).toBe("payment_received");
  });
  test("durable recovery links expire, rotate and revoke without exposing another dossier", async () => {
    await order();
    const { issue, redeem } = require("../server/recovery.js");
    const first = await issue({ token: accessToken() });
    expect((await redeem(first.recoveryToken)).id).toBe("ord_test");
    expect(JSON.stringify((await pool.query("SELECT * FROM order_recovery")).rows)).not.toContain(first.recoveryToken);
    const second = await issue({ token: accessToken() });
    await expect(redeem(first.recoveryToken)).rejects.toThrow("expiré");
    await issue({ token: accessToken(), revoke: true });
    await expect(redeem(second.recoveryToken)).rejects.toThrow("expiré");
    const third = await issue({ token: accessToken() });
    await pool.query("UPDATE order_recovery SET expires_at=$1", [new Date(Date.now() - 1)]);
    await expect(redeem(third.recoveryToken)).rejects.toThrow("expiré");
    await expect(issue({ token: accessToken("another") })).rejects.toThrow("indisponible");
  });

  test("a lease lost before debit resumes safe reads and the scheduler records completion", async () => {
    await paidJob();
    await pool.query("UPDATE payment_outbox SET state='processing',phase='verify_order',claim_token='old',lease_until=$1", [new Date(Date.now() - 1)]);
    let payments = 0;
    global.fetch = async (url) => {
      if (String(url).endsWith("/air/payments")) {
        payments++;
        return { ok: true, json: async () => ({ data: { status: "succeeded" } }) };
      }
      return { ok: true, json: async () => ({ data: providerOrder(payments ? {
        payment_status: { awaiting_payment: false }, documents: [{ type: "electronic_ticket", unique_identifier: "123456" }],
      } : {}) }) };
    };
    const result = await require("../server/fulfil.js").fulfilBatch();
    expect(result.processed).toBe(1);
    expect(result.jobs[0].state).toBe("ticket_issued");
    expect(payments).toBe(1);
    expect((await pool.query("SELECT * FROM worker_heartbeat")).rows[0].completed_at).toBeTruthy();
    expect((await pool.query("SELECT ticket FROM flight_orders")).rows[0].ticket.bookingReference).toBe("ABCDEF");
  });

  test("card-only Duffel holds accept totals above the cash ceiling without a cash adapter", async () => {
    delete process.env.PAYENCASH_ADAPTER_URL;
    delete process.env.PAYENCASH_API_KEY;
    delete process.env.PAYENCASH_WEBHOOK_SECRET;
    process.env.STRIPE_SECRET_KEY = "sk_test_local";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_local";
    process.env.STRIPE_PUBLIC_KEY = "pk_test_local";
    const deadline = new Date(Date.now() + 30 * 60000).toISOString();
    global.fetch = async url => ({ ok: true, json: async () => ({ data: String(url).includes("/air/offers/") ? {
      total_amount: "1500.00", total_currency: "EUR", passengers: [{ id: "pas_test" }],
      payment_requirements: { requires_instant_payment: false, payment_required_by: deadline, price_guarantee_expires_at: deadline },
    } : { id: "ord_card", total_amount: "1500.00", total_currency: "EUR", booking_reference: "ABCDEF",
      payment_status: { awaiting_payment: true, payment_required_by: deadline, price_guarantee_expires_at: deadline } } }) });
    const result = await invoke(require("../api/orders/hold.js"), {
      offerId: "off_card", paymentMethod: "card", expectedAmountCents: 150000,
      passengers: [{ id: "pas_test", given_name: "Lea", family_name: "Martin", born_on: "1990-01-01", gender: "f", title: "ms", email: "lea@example.test", phone_number: "+33612345678" }],
    }, { "idempotency-key": crypto.randomUUID() });
    expect(result.statusCode).toBe(201);
    const saved = (await pool.query("SELECT * FROM flight_orders")).rows[0];
    expect(saved.status).toBe("awaiting_card"); expect(saved.payment_method).toBe("card");
    expect(saved.amount_cents).toBe(150000);
  });
  for (const outcome of ["success", "ambiguous", "repriced"]) {
    test(`instant Duffel checkout waits for Stripe and handles ${outcome} without duplicate purchases`, async () => {
      process.env.STRIPE_SECRET_KEY = "sk_test_fixture";
      process.env.STRIPE_PUBLIC_KEY = "pk_test_fixture";
      process.env.STRIPE_WEBHOOK_SECRET = "whsec_fixture";
      process.env.LIVE_CHECKOUT_ENABLED = "false";
      delete process.env.VOUCHER_SIGNING_SECRET;
      delete process.env.PAYENCASH_ADAPTER_URL;
      delete process.env.PAYENCASH_API_KEY;
      let purchases = 0, paid = false, orderId, documentsReady = false;
      const expiresAt = new Date(Date.now() + 20 * 60000).toISOString();
      global.fetch = async (url, options) => {
        let data;
        if (String(url).includes("api.stripe.com")) return { ok: true, json: async () => ({
          id: "pi_test", client_secret: "pi_test_secret_fixture", amount: 14200, currency: "eur", livemode: false, metadata: { orderId },
        }) };
        if (String(url).includes("/air/offers/")) data = {
          id: "off_instant", total_currency: "EUR", total_amount: paid && outcome === "repriced" ? "145.00" : "142.00",
          expires_at: expiresAt, passengers: [{ id: "pas_test" }], payment_requirements: { requires_instant_payment: true },
        };
        else if (String(url).endsWith("/air/orders")) {
          expect(paid).toBe(true);
          purchases++;
          const sent = JSON.parse(options.body).data;
          expect(sent).toMatchObject({ type: "instant", selected_offers: ["off_instant"],
            payments: [{ type: "balance", currency: "EUR", amount: "142.00" }],
            passengers: [{ given_name: "Lea", family_name: "Martin" }] });
          if (outcome === "ambiguous") throw new Error("Supplier accepted purchase before timeout");
          data = { id: "ord_purchased", ...providerOrder({ payment_status: { awaiting_payment: false } }) };
        } else if (String(url).endsWith("/air/orders/ord_purchased")) data = {
          id: "ord_purchased", ...providerOrder({ payment_status: { awaiting_payment: false },
            documents: documentsReady ? [{ type: "electronic_ticket", unique_identifier: "123456" }] : [] }),
        };
        else throw new Error("Unexpected provider call");
        return { ok: true, json: async () => ({ data }) };
      };
      const input = { offerId: "off_instant", expectedAmountCents: 14200, paymentMethod: "card", passengers: [{
        id: "pas_test", given_name: "Lea", family_name: "Martin", born_on: "1990-01-01", gender: "f", title: "ms",
        email: "lea@example.test", phone_number: "+33612345678",
      }] };
      const headers = { "idempotency-key": crypto.randomUUID() };
      const hold = await invoke(require("../api/orders/hold.js"), input, headers);
      expect(hold.statusCode).toBe(201);
      expect(hold.body).toMatchObject({ instant: true, simulation: false, amountCents: 14200 });
      orderId = hold.body.id;
      expect(purchases).toBe(0);
      const repeat = await invoke(require("../api/orders/hold.js"), input, headers);
      expect(repeat.body.token).toBe(hold.body.token);
      const stored = (await pool.query("SELECT * FROM flight_orders WHERE id=$1", [orderId])).rows[0];
      expect(stored.status).toBe("awaiting_card");
      expect(JSON.stringify(stored)).not.toContain("lea@example.test");
      expect((await invoke(require("../api/stripe/create-intent.js"), { holdToken: hold.body.token })).statusCode).toBe(200);
      expect((await require("../server/fulfil.js").fulfilOne()).processed).toBe(false);
      const event = stripeEvent({ metadata: { orderId } });
      expect((await invoke(require("../api/stripe/webhook.js"), event, stripeSignature(event))).body.state).toBe("accepted");
      paid = true;
      const worker = require("../server/fulfil.js").fulfilOne;
      expect((await worker()).state).toBe({ success: "awaiting_documents", ambiguous: "reconciliation_required", repriced: "refund_pending" }[outcome]);
      if (outcome === "success") {
        documentsReady = true;
        await pool.query("UPDATE payment_outbox SET next_attempt_at=now()");
        expect((await worker()).state).toBe("ticket_issued");
        const saved = (await pool.query("SELECT * FROM flight_orders WHERE id=$1", [orderId])).rows[0];
        expect(saved.provider_request).toBeNull();
        expect(saved.provider_order_id).toBe("ord_purchased");
      }
      if (outcome === "ambiguous") {
        await pool.query("UPDATE flight_orders SET status='payment_received'");
        await pool.query("UPDATE payment_outbox SET state='processing',phase='payment_in_flight',claim_token='old',lease_until=$1", [new Date(Date.now() - 1)]);
        expect((await worker()).state).toBe("reconciliation_required");
      }
      expect((await worker()).processed).toBe(false);
      expect(purchases).toBe(outcome === "repriced" ? 0 : 1);
    });
  }

  test("low-cost status is a projection and only an explicit refresh can reconcile the provider", async () => {
    process.env.TRAVELFUSION_ADAPTER_URL = "https://adapter.example.test/";
    process.env.TRAVELFUSION_API_KEY = "test-key";
    await pool.query("INSERT INTO low_cost_bookings(id,idempotency_key,fingerprint,provider,state,encrypted_payload,expires_at) VALUES($1,$2,'fingerprint','travelfusion','pending',$3,$4)",
      ["lcc_read", crypto.randomUUID(), {}, new Date(Date.now() + 7200000)]);
    let calls = 0;
    global.fetch = async () => { calls++; return { ok: true, json: async () => ({ status: "confirmed", bookingReference: "ABCDEF" }) }; };
    const token = require("../server/http.js").sign({ kind: "low-cost-access", id: "lcc_read", expiresAt: Date.now() + 60000 });
    const read = await invoke(require("../api/orders/status.js"), { token });
    expect(read.body.status).toBe("pending"); expect(calls).toBe(0);
    const refreshed = await invoke(require("../api/orders/hold.js"), { action: "refresh-low-cost", token });
    expect(refreshed.body.status).toBe("confirmed"); expect(calls).toBe(1);
    expect(refreshed.body.accessToken).toBe(token);
  });

});
