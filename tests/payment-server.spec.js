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
      "INSERT INTO flight_orders(id,amount_cents,currency,expires_at,voucher_reference) VALUES($1,14200,'EUR',$2,'VNC-2026-ABCDE')",
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
      409,
    );
    expect(
      (await pool.query("SELECT * FROM payment_events")).rows,
    ).toHaveLength(0);
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
      total_currency: "EUR", total_amount: "142.00",
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

});
