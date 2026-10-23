const { test, expect } = require("@playwright/test");

async function liveConfig(page, extra = {}) {
  await page.route("**/api/config", r => r.fulfill({ json: { mode: "live", checkout: false, ...extra } }));
  await page.route("**/api/payencash/stores", r => r.fulfill({ json: { source: "partner", stores: [] } }));
  await page.route("**/api/flights/calendar?*", r => r.fulfill({ json: { simulation: false, days: [] } }));
}

test("private recovery opens an issued dossier on a fresh device without requesting payment", async ({ browser }) => {
  const context = await browser.newContext(), page = await context.newPage();
  await liveConfig(page);
  let vouchers = 0, intents = 0;
  await page.route("**/api/payencash/voucher", r => { vouchers++; return r.fulfill({ json: {} }); });
  await page.route("**/api/stripe/create-intent", r => { intents++; return r.fulfill({ json: {} }); });
  await page.route("**/api/orders/status", r => {
    const body = r.request().postDataJSON();
    return r.fulfill({ json: body.recoveryToken ? { id: "ord_recovered", kind: "order-access", token: "short-access" }
      : { id: "ord_recovered", status: "ticket_issued", amountCents: 14200, ticket: { bookingReference: "REC123", documents: [{ type: "electronic_ticket", unique_identifier: "123456789" }], slices: [] } } });
  });
  await page.goto("http://127.0.0.1:4174/#bookings?recovery=" + "a".repeat(43));
  await expect(page.locator("#live-voucher-content")).toContainText("REC123");
  expect(page.url()).not.toContain("recovery=");
  expect(vouchers).toBe(0); expect(intents).toBe(0);
  await expect(page.locator("[data-live-card-pay]")).toBeHidden();
  await page.reload();
  await page.locator("[data-live-resume]").click();
  await expect(page.locator("#live-voucher-content")).toContainText("REC123");
  await context.close();
});

test("a real offer with unavailable checkout stays real and cannot become a local reservation", async ({ page }) => {
  await liveConfig(page);
  const F = require("../assets/js/flight-engine.js");
  const date = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const f = { ...F.generate({ from: "CDG", to: "RAK", date })[0], id: "off_real", simulation: false, priceKind: "quoted" };
  await page.route("**/api/flights/search", r => r.fulfill({ json: { simulation: false, offers: [f] } }));
  await page.goto("/");
  await page.locator("[data-trip=oneway]").click();
  await page.locator(".search-submit").click();
  await page.locator("[data-select-flight]").click();
  await expect(page.locator("#options-content")).toContainText("Aucun moyen de paiement");
  expect(await page.evaluate(() => BookingManager.loadDraft().flights[0].simulation)).toBe(false);
  expect(await page.evaluate(() => {
    try { BookingManager.create(BookingManager.loadDraft(), "card"); return false; } catch { return true; }
  })).toBe(true);
});

test("missing Stripe Elements leaves card payment disabled and never confirms payment", async ({ page }) => {
  await liveConfig(page, { stripe: true, stripePublicKey: "pk_test_fixture" });
  await page.route("https://js.stripe.com/**", r => r.abort());
  let intents = 0;
  await page.route("**/api/stripe/create-intent", r => { intents++; return r.fulfill({ json: {} }); });
  await page.route("**/api/orders/status", r => r.fulfill({ json: { status: "awaiting_card", amountCents: 14200 } }));
  await page.addInitScript(() => localStorage.setItem("voyagencash_live_orders", JSON.stringify([
    { id: "ord_card", token: "access", holdToken: "hold", paymentMethod: "card", amountCents: 14200 },
  ])));
  await page.goto("/#bookings");
  await page.locator("[data-live-resume]").click();
  await page.locator("[data-live-card-pay]").click();
  await expect(page.locator("#live-card-error")).toContainText("n’a pas chargé");
  await expect(page.locator("#live-card-submit")).toBeDisabled();
  expect(intents).toBe(0);
});

test("flexible dates compare quoted prices separately from indicative minima", async ({ page }) => {
  await liveConfig(page);
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const date = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    const shift = n => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
    FlightAPI.calendar = async () => ({ simulation: false, days: [
      { date: shift(-1), price: 1, priceKind: "indicative", tier: "low" },
      { date, price: 100, priceKind: "quoted", tier: "medium" },
      { date: shift(1), price: 90, priceKind: "quoted", tier: "medium" },
    ] });
    const target = document.createElement("div"); document.body.append(target);
    await FareStrip.mount(target, { from: "CDG", to: "RAK", date, count: 2 }, () => {});
    return { dates: [...target.querySelectorAll("[data-fare-date]")].map(e => e.dataset.fareDate), best: target.querySelector(".best-fare").dataset.fareDate, expected: shift(1), first: shift(-3), last: shift(3) };
  });
  expect(result.dates).toHaveLength(7);
  expect(result.dates[0]).toBe(result.first); expect(result.dates.at(-1)).toBe(result.last);
  expect(result.best).toBe(result.expected);
});

test("configuration failure never produces demonstration flights", async ({ page }) => {
  await page.route("**/api/config", r => r.fulfill({ status: 503, json: { error: "unavailable" } }));
  await page.goto("/");
  await page.locator(".search-submit").click();
  await expect(page.locator("#results-title")).toContainText("pas abouti");
  await expect(page.locator(".flight-card")).toHaveCount(0);
});

test("browser consumers share search promises and reuse a fresh result", async ({ page }) => {
  await liveConfig(page);
  let searches = 0;
  await page.route("**/api/flights/search", async r => {
    searches++;
    await r.fulfill({ json: { simulation: false, offers: [] } });
  });
  await page.goto("/");
  await page.evaluate(async () => {
    const query = { from: "MRS", to: "ALG", count: 2, date: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10) };
    await Promise.all(Array.from({ length: 8 }, () => FlightAPI.search(query)));
    await FlightAPI.search(query);
  });
  expect(searches).toBe(1);
});
