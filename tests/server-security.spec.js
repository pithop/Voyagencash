const { test, expect } = require("@playwright/test");
const { Readable } = require("node:stream");
const crypto = require("node:crypto");
const { sign } = require("../server/http.js");
async function call(
  handler,
  { data, headers = {}, method = "POST", raw } = {},
) {
  const req = Readable.from([Buffer.from(raw ?? JSON.stringify(data ?? {}))]);
  req.headers = { host: "localhost", ...headers };
  req.method = method;
  req.url = "/api/test";
  const response = {
    headers: {},
    statusCode: 200,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    end(value) {
      this.data = JSON.parse(value);
    },
  };
  await handler(req, response);
  return response;
}
test.describe("provider and security contracts", () => {
  test.describe.configure({ mode: "serial" });
  let env, fetch;
  test.beforeEach(() => {
    env = { ...process.env };
    fetch = global.fetch;
  });
  test.afterEach(() => {
    for (const k of Object.keys(process.env))
      if (!(k in env)) delete process.env[k];
    Object.assign(process.env, env);
    global.fetch = fetch;
  });
  test("Duffel request stays on server, maps offers and never synthesizes fares on upstream failure", async () => {
    process.env.DUFFEL_API_TOKEN = "test-only-token";
    delete process.env.DATABASE_URL;
    const { search, calendar } = require("../server/flights.js");
    let sent;
    const date = new Date(Date.now() + 50 * 86400000)
      .toISOString()
      .slice(0, 10);
    global.fetch = async (url, options) => {
      sent = { url, options };
      return {
        ok: true,
        json: async () => ({
          data: {
            offers: [
              {
                id: "off_test",
                total_currency: "EUR",
                total_amount: "248.00",
                owner: { iata_code: "AH", name: "Air Algérie" },
                expires_at: new Date(Date.now() + 900000).toISOString(),
                passengers: [{ id: "pas_one" }, { id: "pas_two" }],
                payment_requirements: { requires_instant_payment: false },
                slices: [
                  {
                    segments: [
                      {
                        origin: { iata_code: "CDG" },
                        destination: { iata_code: "ALG" },
                        departing_at: date + "T10:00:00",
                        arriving_at: date + "T12:30:00",
                        marketing_carrier: { iata_code: "AH" },
                        marketing_carrier_flight_number: "1001",
                        passengers: [
                          { baggages: [{ type: "carry_on", quantity: 1 }] },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        }),
      };
    };
    const result = await search({ from: "CDG", to: "ALG", date, count: 2 });
    expect(result.source).toBe("duffel");
    expect(result.offers[0].price).toBe(124);
    expect(result.offers[0].simulation).toBe(false);
    expect(result.offers[0].punctuality).toBeNull();
    expect(sent.url).toContain("/air/offer_requests");
    const request = JSON.parse(sent.options.body);
    expect(request.data.passengers).toHaveLength(2);
    expect(sent.options.headers.Authorization).toBe("Bearer test-only-token");
    const matrix = await calendar({
      from: "CDG",
      to: "ALG",
      month: date.slice(0, 7),
      count: 2,
    });
    expect(matrix.days.find((d) => d.date === date).price).toBe(124);
    const benchmark = require("../assets/js/flight-engine.js").calendar({ from: "CDG", to: "ALG", month: date.slice(0, 7) });
    for (const b of benchmark.filter(d => d.date !== date && d.price !== null)) {
      expect(matrix.days.find(d => d.date === b.date)).toMatchObject({
        price: b.price, tier: b.tier, indicative: true, priceKind: "indicative", provider: "indicative",
      });
    }
    global.fetch = async () => ({ ok: false, status: 503 });
    await expect(
      search({ from: "CDG", to: "ALG", date, count: 1 }),
    ).rejects.toThrow("fournisseur");
  });
  test("expired or wrong-scope signed tokens cannot mint vouchers", async () => {
    const handler = require("../api/payencash/voucher.js");
    const expired = sign({
      kind: "hold",
      id: "demo",
      amountCents: 100,
      expiresAt: Date.now() - 1,
    });
    expect(
      (await call(handler, { data: { holdToken: expired } })).statusCode,
    ).toBe(410);
    const wrong = sign({
      kind: "order-access",
      id: "demo",
      amountCents: 100,
      expiresAt: Date.now() + 100000,
    });
    expect(
      (await call(handler, { data: { holdToken: wrong } })).statusCode,
    ).toBe(410);
  });
  test("HMAC validates raw bytes, rejects tampering/replay windows, and fails closed without durable storage", async () => {
    process.env.PAYENCASH_WEBHOOK_SECRET = "test-secret-only";
    delete process.env.DATABASE_URL;
    const handler = require("../api/payencash/webhook.js"),
      timestamp = String(Math.floor(Date.now() / 1000));
    const raw = JSON.stringify({
      id: "evt_one",
      orderId: "ord_one",
      type: "voucher.paid",
      amountCents: 10000,
      currency: "EUR",
      reference: "VNC-2026-ABCDE",
    });
    const signature =
      "sha256=" +
      crypto
        .createHmac("sha256", process.env.PAYENCASH_WEBHOOK_SECRET)
        .update(timestamp + "." + raw)
        .digest("hex");
    expect(
      (
        await call(handler, {
          raw,
          headers: {
            "x-payencash-timestamp": timestamp,
            "x-payencash-signature": signature,
          },
        })
      ).statusCode,
    ).toBe(503);
    expect(
      (
        await call(handler, {
          raw: raw + " ",
          headers: {
            "x-payencash-timestamp": timestamp,
            "x-payencash-signature": signature,
          },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await call(handler, {
          raw,
          headers: {
            "x-payencash-timestamp": "1000000000",
            "x-payencash-signature": signature,
          },
        })
      ).statusCode,
    ).toBe(401);
    expect((await call(handler, { raw })).statusCode).toBe(401);
  });
  test("no live hold is made when checkout infrastructure is missing", async () => {
    process.env.DUFFEL_API_TOKEN = "test-only";
    delete process.env.PAYENCASH_ADAPTER_URL;
    let called = false;
    global.fetch = async () => {
      called = true;
      throw new Error("must not reach provider");
    };
    const handler = require("../api/orders/hold.js");
    const response = await call(handler, {
      headers: { "idempotency-key": crypto.randomUUID() },
      data: {
        offerId: "off_test",
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
      },
    });
    expect(response.statusCode).toBe(503);
    expect(called).toBe(false);
  });
});

test("provider failures are isolated, concurrent searches share work and calendar keeps price provenance", async () => {
  const env = { ...process.env }, oldFetch = global.fetch;
  const R = require("../server/ryanair.js"), oldSearch = R.search, oldCalendar = R.calendarFares;
  const path = require.resolve("../server/flights.js");
  delete require.cache[path];
  try {
    process.env.DUFFEL_API_TOKEN = "test-key";
    delete process.env.TRAVELFUSION_API_KEY;
    delete process.env.DATABASE_URL;
    let calls = 0;
    const date = new Date(Date.now() + 25 * 86400000).toISOString().slice(0, 10);
    const query = { from: "CDG", to: "RAK", date, count: 2 };
    const f = require("../assets/js/flight-engine.js").generate(query)[0];
    R.search = async () => [{ ...f, id: "fr_test", price: 42, priceKind: "indicative", provider: "ryanair-indicative", simulation: false }];
    R.calendarFares = async () => new Map([[date, { price: 20 }]]);
    global.fetch = async () => { calls++; return { ok: false, status: 503 }; };
    const flights = require(path);
    const results = await Promise.all(Array.from({ length: 8 }, () => flights.search(query)));
    expect(calls).toBe(1);
    expect(results.every(r => r.partial && r.offers[0].priceKind === "indicative")).toBe(true);
    const day = (await flights.calendar({ ...query, month: date.slice(0, 7) })).days.find(d => d.date === date);
    expect(day.priceKind).toBe("indicative");
    expect(day.price).toBe(42);
    R.search = async () => { throw new Error("unavailable"); };
    await expect(flights.search(query)).rejects.toThrow("fournisseur");
  } finally {
    R.search = oldSearch; R.calendarFares = oldCalendar; global.fetch = oldFetch;
    for (const k of Object.keys(process.env)) if (!(k in env)) delete process.env[k];
    Object.assign(process.env, env); delete require.cache[path];
  }
});

test("store availability requires fresh dated evidence, supports midnight and never guesses from labels", () => {
  const { availability } = require("../server/stores.js");
  const now = Date.parse("2026-10-24T23:30:00+02:00");
  expect(availability({ hours: "8 h - 23 h" }, now).isOpen).toBeNull();
  const store = { hoursConfirmedAt: new Date(now - 60000).toISOString(),
    scheduleValidUntil: new Date(now + 3 * 3600000).toISOString(),
    openingWindows: [{ opensAt: "2026-10-24T20:00:00+02:00", closesAt: "2026-10-25T02:00:00+02:00" }] };
  expect(availability(store, now).paymentWindowConfirmed).toBe(true);
  expect(availability({ ...store, hoursConfirmedAt: new Date(now - 121 * 60000).toISOString() }, now).isOpen).toBeNull();
  expect(availability({ ...store, openingWindows: [] }, now).isOpen).toBe(false);
  expect(availability({ ...store, openingWindows: [{ opensAt: "2026-10-24T20:00:00+02:00", closesAt: "2026-10-25T00:00:00+02:00" }] }, now).paymentWindowConfirmed).toBe(false);
});
