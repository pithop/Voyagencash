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
    require(dbPath);
    oldDatabase = require.cache[dbPath].exports;
    require.cache[dbPath].exports = {
      database: () => pool,
      transaction: async (fn) => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const result = await fn(client);
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
          payment_required_by: deadline,
          price_guarantee_expires_at: deadline,
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
});
