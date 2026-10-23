const { test, expect } = require("@playwright/test");
const { sign, verify } = require("../server/http.js");
const F = require("../assets/js/flight-engine.js");

async function intent(data) {
  const res = { statusCode: 200, setHeader() {}, end(value) { this.data = JSON.parse(value); } };
  await require("../api/stripe/create-intent.js")({ method: "POST", headers: {}, body: data }, res);
  return res;
}

test.describe("Stripe independent configuration", () => {
  let env, fetch;
  test.beforeEach(() => {
    env = { ...process.env }; fetch = global.fetch;
    for (const name of Object.keys(process.env)) {
      if (/STRIPE|DATABASE_URL|STORAGE_URL|POSTGRES|VOUCHER_SIGNING|SESSION_SECRET|PAYENCASH|LIVE_CHECKOUT|DUFFEL/.test(name)) delete process.env[name];
    }
    process.env.VERCEL = "1";
    delete process.env.VOYAGENCASH_TEST_MODE;
  });
  test.afterEach(() => {
    for (const name of Object.keys(process.env)) if (!(name in env)) delete process.env[name];
    Object.assign(process.env, env); global.fetch = fetch;
  });
  for (const publicName of ["STRIPE_PUBLIC_KEY", "STRIPE_PUBLISHABLE_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "NEXT_PUBLIC_STRIPE_PUBLIC_KEY"]) {
    test(`card capability accepts ${publicName} without cash dependencies`, () => {
      process.env[publicName] = "pk_test_fixture";
      process.env.STRIPE_API_KEY = "sk_test_fixture";
      const { capabilities } = require("../server/capabilities.js");
      expect(capabilities()).toMatchObject({ cardCheckout: true, cashCheckout: false, stripePublicKey: "pk_test_fixture" });
      delete process.env.STRIPE_API_KEY;
      expect(capabilities().cardCheckout).toBe(false);
    });
  }
  test("Vercel signatures use each fallback and still reject tampering", () => {
    const value = { kind: "hold", id: "order", expiresAt: Date.now() + 60000 };
    for (const name of [null, "SESSION_SECRET", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "VOUCHER_SIGNING_SECRET"]) {
      if (name) process.env[name] = `fixture-${name}`;
      const token = sign(value);
      expect(verify(token, "hold")).toEqual(value);
      expect(() => verify(token + "x", "hold")).toThrow("Signature");
    }
  });
  for (const simulation of [true, false]) {
    test(`Stripe API intent without database, simulation=${simulation}`, async () => {
      process.env.STRIPE_SECRET_KEY = "sk_test_fixture";
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_fixture";
      const hold = { kind: "hold", id: "order-fixture", amountCents: 8199, currency: "EUR", simulation, expiresAt: Date.now() + 60000 };
      const calls = [];
      global.fetch = async (url, options) => {
        calls.push(options.headers["Idempotency-Key"]);
        expect(url).toBe("https://api.stripe.com/v1/payment_intents");
        expect(options.method).toBe("POST");
        const form = new URLSearchParams(options.body);
        expect(form.get("amount")).toBe("8199");
        expect(form.get("currency")).toBe("eur");
        expect(form.get("metadata[orderId]")).toBe(hold.id);
        expect(form.get("metadata[simulation]")).toBe(simulation ? "true" : null);
        expect(form.get("automatic_payment_methods[enabled]")).toBe("true");
        return { ok: true, json: async () => ({ id: "pi_fixture", client_secret: "pi_fixture_secret_fixture", amount: 8199, currency: "eur", livemode: false, metadata: { orderId: hold.id } }) };
      };
      const data = { holdToken: sign(hold), orderId: hold.id };
      for (let i = 0; i < 2; i++) {
        const result = await intent(data);
        expect(result.statusCode).toBe(200);
        expect(result.data).toMatchObject({ id: "pi_fixture", clientSecret: "pi_fixture_secret_fixture", amountCents: 8199, orderId: hold.id, live: !simulation, simulation });
      }
      expect(calls[0]).toBe(calls[1]);
      expect((await intent({ ...data, orderId: "another" })).statusCode).toBe(403);
      global.fetch = async () => ({ ok: false });
      expect((await intent(data)).statusCode).toBe(502);
    });
  }
  test("unobserved MRS to TUN dates have indicative reference fares in live mode", async () => {
    process.env.DUFFEL_API_TOKEN = "fixture";
    global.fetch = async () => ({ ok: false, status: 503 });
    const query = { from: "MRS", to: "TUN", count: 1, month: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 7) };
    const result = await require("../server/flights.js").calendar(query);
    expect(result.simulation).toBe(false);
    for (const reference of F.calendar(query).filter(d => d.price !== null)) {
      expect(result.days.find(d => d.date === reference.date)).toEqual({ ...reference, indicative: true, priceKind: "indicative", provider: "indicative" });
    }
  });
});

test("live calendars and seven-day strip fill missing and null dates across months", async ({ page }) => {
  await page.route("https://js.stripe.com/**", r => r.abort());
  await page.route("**/api/config", r => r.fulfill({ json: { mode: "live", stripe: false, checkout: false } }));
  await page.route("**/api/flights/calendar?*", r => {
    const month = new URL(r.request().url()).searchParams.get("month");
    return r.fulfill({ json: { simulation: false, days: [{ date: `${month}-01`, price: null, direct: null }] } });
  });
  await page.goto("/");
  await page.evaluate(async () => {
    const month = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 7);
    const query = { from: "MRS", to: "TUN", date: `${month}-01`, count: 1 };
    await FareStrip.mount(document.querySelector("#search-fare-strip"), query, () => {});
    PriceCalendar.open({ ...query, onSelect() {} });
  });
  await expect(page.locator(".calendar-disclaimer")).toContainText("observés ou indicatifs");
  expect(await page.locator(".calendar-day .day-price").allTextContents()).not.toContain("—");
  await expect(page.locator("#search-fare-strip .fare-day")).toHaveCount(7);
  for (const price of await page.locator("#search-fare-strip .fare-day strong").allTextContents()) expect(price).toContain("€");
});

async function openPayment(page, stripeScript) {
  await page.route("https://js.stripe.com/**", r => stripeScript ? r.fulfill({ contentType: "application/javascript", body: stripeScript }) : r.abort());
  await page.route("**/api/config", r => r.fulfill({ json: { mode: "demo", stripe: true, stripePublicKey: "pk_test_fixture" } }));
  await page.goto("/");
  await page.evaluate(() => {
    const leg = { from: "CDG", to: "ALG", date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) };
    BookingManager.saveDraft({ search: { type: "oneway", count: 1, legs: [leg] }, flights: [FlightEngine.generate(leg)[0]],
      options: { baggage: false, guarantee: false }, passengers: [{ firstName: "Lea", lastName: "Martin", birthDate: "1992-03-12", document: "TEST12345", documentType: "passport" }], contact: { email: "lea@example.test", phone: "0600000000" } });
  });
  await page.goto("/#payment");
  await page.reload();
  await page.locator("#card-pay").check();
}

test("configured Stripe mounts Elements and retries the same hold after a declined payment and reload", async ({ page }) => {
  let holdCalls = 0;
  page.on("request", r => { if (r.url().endsWith("/api/orders/hold")) holdCalls++; });
  await page.route("**/api/stripe/create-intent", async r => {
    const data = r.request().postDataJSON();
    expect(data.orderId).toMatch(/^demo_/);
    expect(data.holdToken).toContain(".");
    await r.fulfill({ json: { id: "pi_fixture", clientSecret: "pi_fixture_secret_fixture", simulation: true } });
  });
  await openPayment(page, `window.Stripe = key => {
    if (key !== "pk_test_fixture") throw Error("Wrong key");
    const card = { mount(selector) { document.querySelector(selector).textContent = "Secure card field"; }, destroy() {}, on() {} };
    return { elements: () => ({ create(type) { if (type !== "card") throw Error("Wrong element"); return card; } }),
      async confirmCardPayment(secret, options) {
        if (secret !== "pi_fixture_secret_fixture" || options.payment_method.card !== card) throw Error("Invalid confirmation");
        const attempts = Number(sessionStorage.getItem("stripe-attempts") || 0) + 1;
        sessionStorage.setItem("stripe-attempts", attempts);
        return attempts === 1 ? { error: { message: "Carte refusée" } } : { paymentIntent: { status: "succeeded" } };
      } };
  };`);
  await expect(page.locator("#stripe-card-element")).toHaveText("Secure card field");
  await expect(page.locator(".test-card")).toHaveCount(0);
  await expect(page.locator("#pay-button")).toContainText("par carte");
  await page.locator("#payment-consent").check();
  await page.locator("#pay-button").click();
  await expect(page.locator("#stripe-card-error")).toHaveText("Carte refusée");
  await expect(page.locator("#pay-button")).toBeEnabled();
  expect(await page.evaluate(() => BookingManager.all()[0].status)).toBe("pending");
  await page.reload();
  await expect(page.locator("#stripe-card-element")).toHaveText("Secure card field");
  await page.locator("#payment-consent").check();
  await page.locator("#pay-button").click();
  await expect(page.locator("#confirmation-title")).toBeVisible();
  expect(holdCalls).toBe(1);
  expect(await page.evaluate(() => BookingManager.all().map(r => r.status))).toEqual(["confirmed"]);
});

test("configured card payment never falls back to the static card when Stripe.js fails", async ({ page }) => {
  await openPayment(page);
  await expect(page.locator("#stripe-card-error")).toContainText("n’a pas chargé");
  await expect(page.locator("#pay-button")).toBeDisabled();
  await expect(page.locator(".test-card")).toHaveCount(0);
});

test("instant Duffel offers expose only the card option when Stripe is configured", async ({ page }) => {
  await page.route("https://js.stripe.com/**", r => r.abort());
  await page.route("**/api/config", r => r.fulfill({ json: { mode: "live", checkout: true, stripe: true, stripePublicKey: "pk_test_fixture" } }));
  await page.goto("/");
  await page.evaluate(async () => {
    const date = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const flight = { ...FlightEngine.generate({ from: "MRS", to: "TUN", date })[0], simulation: false, payment_requirements: { requires_instant_payment: true } };
    const panel = document.createElement("div"); document.body.append(panel);
    await LiveBooking.mount(panel, { flights: [flight], search: { count: 1 } });
  });
  await expect(page.locator("#live-passengers")).toBeVisible();
  await expect(page.locator('[name=paymentMethod][value=card]')).toBeChecked();
  await expect(page.locator('[name=paymentMethod][value=cash]')).toHaveCount(0);
});

test("a failed hold remains a Stripe checkout after reload", async ({ page }) => {
  await page.route("**/api/orders/hold", r => r.fulfill({ status: 503, json: { error: "Réservation momentanément indisponible" } }));
  await openPayment(page, `window.Stripe = () => ({ elements: () => ({ create: () => ({ mount() {}, destroy() {}, on() {} }) }) });`);
  await page.locator("#payment-consent").check();
  await page.locator("#pay-button").click();
  await expect(page.locator("#stripe-card-error")).toContainText("momentanément indisponible");
  await page.reload();
  await expect(page.locator("#stripe-card-element")).toBeVisible();
  await expect(page.locator("#pay-button")).toContainText("par carte");
  await expect(page.locator(".test-card")).toHaveCount(0);
  await expect(page.locator("#pay-voucher-trigger")).toBeDisabled();
  expect(await page.evaluate(() => BookingManager.all())).toHaveLength(1);
});
