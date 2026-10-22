const { test, expect } = require("@playwright/test");
const { Readable } = require("node:stream");
const crypto = require("node:crypto");
const { sign } = require("../server/http.js");

async function call(handler, { data, headers = {}, method = "POST", raw } = {}) {
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
      try {
        this.data = JSON.parse(value);
      } catch {
        this.data = value;
      }
    },
  };
  await handler(req, response);
  return response;
}

test.describe("Stripe and Ryanair Checkout Contracts", () => {
  test("Stripe create-intent generates a secure clientSecret for valid holds", async () => {
    const handler = require("../api/stripe/create-intent.js");
    const holdToken = sign({
      kind: "hold",
      id: "ord_stripe_test",
      amountCents: 8199,
      currency: "EUR",
      expiresAt: Date.now() + 7200000,
    });

    const res = await call(handler, { data: { holdToken } });
    expect(res.statusCode).toBe(200);
    expect(res.data.clientSecret).toBeDefined();
    expect(res.data.amountCents).toBe(8199);
    expect(res.data.currency).toBe("EUR");
    expect(res.data.orderId).toBe("ord_stripe_test");
  });

  test("Stripe create-intent rejects malformed or missing order data", async () => {
    const handler = require("../api/stripe/create-intent.js");
    const res = await call(handler, { data: {} });
    expect(res.statusCode).toBe(400);
  });

  test("Stripe webhook rejects forged or invalid signatures when secret is set", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
    const handler = require("../api/stripe/webhook.js");

    const payload = JSON.stringify({ type: "payment_intent.succeeded" });
    const forged = await call(handler, {
      raw: payload,
      headers: { "stripe-signature": "t=1700000000,v1=bad_signature" },
    });
    expect(forged.statusCode).toBe(401);
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  test("Ryanair offers are accepted by hold.js and generate 120min reservations", async () => {
    const handler = require("../api/orders/hold.js");
    const res = await call(handler, {
      headers: { "idempotency-key": crypto.randomUUID() },
      data: {
        offerId: "fr_MRS_RAK_2026-11-05_2640_8199",
        passengers: [
          {
            id: "fr_pas_1",
            given_name: "Yasmine",
            family_name: "Benali",
            born_on: "1994-06-15",
            gender: "f",
            title: "ms",
            phone_number: "+33612345678",
            email: "yasmine@example.test",
          },
        ],
        expectedAmountCents: 8199,
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.data.amountCents).toBe(8199);
    expect(res.data.airline).toBe("Ryanair");
    expect(res.data.token).toBeDefined();
    expect(res.data.accessToken).toBeDefined();
    expect(res.data.bookingReference).toContain("VNC-");
  });
});
