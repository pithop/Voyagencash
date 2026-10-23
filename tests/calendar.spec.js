const { test, expect } = require("@playwright/test");
test("calendar exposes indicative daily prices, all price tiers, selection and month navigation", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#date-0").click();
  const calendar = page.locator("#price-calendar");
  await expect(calendar).toBeVisible();
  for (const tier of ["low", "medium", "high"])
    await expect(
      calendar.locator(`.calendar-day.${tier} .day-price`).first(),
    ).toContainText("€");
  await expect(calendar.locator(".calendar-disclaimer")).toContainText(
    "démonstration",
  );
  const month = await calendar.locator("h3").textContent();
  await calendar.getByRole("button", { name: "Mois suivant" }).click();
  await expect(calendar.locator("h3")).not.toHaveText(month);
  await calendar.getByRole("button", { name: "Mois précédent" }).click();
  await expect(calendar.locator("h3")).toHaveText(month);
  const day = calendar.locator(".calendar-day.low:not(:disabled)").last();
  const selected = await day.getAttribute("data-calendar-date");
  await day.click();
  await expect(calendar).not.toBeVisible();
  await expect(page.locator("#date-0")).toHaveValue(selected);
  expect((await page.locator("#return-date").inputValue()) >= selected).toBe(
    true,
  );
  await page.locator("#return-date").click();
  await expect(calendar.locator("h2")).toHaveText("Choisissez votre retour");
  const minimum = await page.locator("#return-date").getAttribute("min");
  const invalid = await calendar
    .locator(".calendar-day:not(:disabled)")
    .evaluateAll((els) => els.map((e) => e.dataset.calendarDate));
  expect(invalid.every((d) => d >= minimum)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(calendar).toBeHidden();
});
test("selecting a result date refreshes the offers and keeps search state consistent", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("[data-trip=oneway]").click();
  await page.locator(".search-submit").click();
  await expect(page.locator(".flight-card")).toHaveCount(20);
  const old = await page
    .locator("[data-select-flight]")
    .first()
    .getAttribute("data-select-flight");
  await page.locator("[data-action=result-calendar]").click();
  const day = page
    .locator(".calendar-day:not(:disabled):not(.selected)")
    .last();
  const date = await day.getAttribute("data-calendar-date");
  await day.click();
  await expect(
    page.locator("[data-select-flight]").first(),
  ).not.toHaveAttribute("data-select-flight", old);
  await expect(page.locator(".flight-card")).toHaveCount(20);
  expect(
    await page.evaluate(() => BookingManager.loadDraft().search.legs[0].date),
  ).toBe(date);
  await page.goto("/#search");
  await expect(page.locator("#date-0")).toHaveValue(date);
});
for (const width of [320, 360, 390, 430, 768, 1440])
  test(`responsive search, calendar and results at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.locator("#date-0").click();
    await expect(page.locator(".calendar-day.low").first()).toBeVisible();
    const bounds = await page.locator("#price-calendar").boundingBox();
    expect(bounds.width).toBeLessThanOrEqual(width);
    await page.keyboard.press("Escape");
    await page.locator("[data-trip=oneway]").click();
    await page.locator(".search-submit").click();
    await expect(page.locator(".flight-card")).toHaveCount(20);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width < 761) {
      await page.locator("[data-action=open-filters]").click();
      await expect(page.locator("#direct-filter")).toBeVisible();
      await page.locator("#direct-filter").check();
      await page.locator("[data-action=close-filters]").click();
      await expect(page.locator("#result-filters")).toBeHidden();
    }
  });
test("static hosting uses the local inventory and prices", async ({ page }) => {
  await page.route("**/api/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html>static fallback",
    }),
  );
  await page.goto("/");
  await page.locator("#date-0").click();
  await expect(
    page.locator(".calendar-day.low .day-price").first(),
  ).toContainText("€");
  await page.keyboard.press("Escape");
  await page.locator("[data-trip=oneway]").click();
  await page.locator(".search-submit").click();
  await expect(page.locator(".flight-card")).toHaveCount(20);
});
test("live provider failure displays a retry and never fabricated results", async ({
  page,
}) => {
  await page.route("**/api/config", (r) =>
    r.fulfill({ json: { mode: "live", checkout: false } }),
  );
  await page.route("**/api/flights/search", (r) =>
    r.fulfill({ status: 502, json: { error: "Fournisseur indisponible" } }),
  );
  await page.goto("/");
  await page.locator(".search-submit").click();
  await expect(page.locator("#results-title")).toContainText("pas abouti");
  await expect(page.locator(".flight-card")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Réessayer" })).toBeVisible();
});
test("live offer stays outside the demo checkout and uses hold, voucher and status endpoints", async ({
  page,
}) => {
  const F = require("../assets/js/flight-engine.js");
  const date = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const f = {
    ...F.generate({ from: "CDG", to: "RAK", date })[0],
    id: "off_live",
    simulation: false,
    passengerIds: ["pas_live"],
    price: 142,
    payment_requirements: { requires_instant_payment: false },
  };
  await page.route("**/api/config", (r) =>
    r.fulfill({ json: { mode: "live", checkout: true } }),
  );
  await page.route("**/api/payencash/stores", (r) =>
    r.fulfill({ json: { source: "partner", stores: [] } }),
  );
  await page.route("**/api/flights/search", (r) =>
    r.fulfill({ json: { source: "duffel", simulation: false, offers: [f] } }),
  );
  let holdBody, holdKey;
  await page.route("**/api/orders/hold", (r) => {
    holdBody = r.request().postDataJSON();
    holdKey = r.request().headers()["idempotency-key"];
    return r.fulfill({
      json: {
        id: "ord_live",
        token: "test-hold",
        accessToken: "test-access",
        amountCents: 14200,
        expiresAt: Date.now() + 7200000,
      },
    });
  });
  await page.route("**/api/payencash/voucher", (r) =>
    r.fulfill({
      json: {
        reference: "VNC-2026-ABCDE",
        qrPayload: "PARTNER|order-fixture|14200",
        amountCents: 14200,
        expiresAt: Date.now() + 7200000,
      },
    }),
  );
  let paymentReceived = false;
  await page.route("**/api/orders/status", (r) =>
    r.fulfill({ json: { status: paymentReceived ? "payment_received" : "awaiting_cash" } }),
  );
  await page.goto("/");
  await page.locator("[data-trip=oneway]").click();
  await page.locator(".search-submit").click();
  await page.locator("[data-select-flight]").click();
  await expect(page.locator("#live-passengers")).toBeVisible();
  await page.locator("[name=given_name-0]").fill("Lea");
  await page.locator("[name=family_name-0]").fill("Martin");
  await page.locator("[name=born_on-0]").fill("1990-01-01");
  await page.locator("[name=email]").fill("lea@example.test");
  await page.locator("[name=phone_number]").fill("+33612345678");
  await page.locator("#live-passengers [type=checkbox]").check();
  await page.locator("#live-passengers [type=submit]").click();
  await expect(page.locator(".voucher-code")).toHaveText("VNC-2026-ABCDE");
  paymentReceived = true;
  await page.locator("[data-live-status]").click();
  await expect(page.locator("#live-state")).toContainText("Paiement reçu");
  expect(holdBody.offerId).toBe("off_live");
  expect(holdBody.expectedAmountCents).toBe(14200);
  expect(holdKey).toMatch(/^[a-f0-9-]{36}$/);
  expect(await page.evaluate(() => BookingManager.all())).toEqual([]);
  expect(
    await page.evaluate(() => localStorage.getItem("voyagencash_live_orders")),
  ).not.toContain("lea@example.test");
  await expect(page.locator("[data-action=validate-voucher]")).toHaveCount(0);
  await page.goto("/#bookings");
  await page.locator("[data-live-resume]").click();
  await expect(page.locator("#view-bookings .voucher-code")).toHaveText(
    "VNC-2026-ABCDE",
  );
});

test("inline fares update the departure, availability and result offers without losing the route", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.date-fare').first()).toContainText('€');
  await expect(page.locator('#search-fare-strip .fare-day')).toHaveCount(7);
  const day = page.locator('#search-fare-strip .fare-day:not(.selected)').last();
  const selected = await day.getAttribute('data-fare-date');
  const refreshed = page.waitForRequest(r => r.url().endsWith('/api/flights/search') && r.postDataJSON().date === selected);
  await day.click();
  await refreshed;
  await expect(page.locator('#date-0')).toHaveValue(selected);
  await expect(page.locator('#search-availability')).toContainText('20 vols');
  await page.locator('[data-trip=oneway]').click();
  await page.locator('.search-submit').click();
  await expect(page.locator('.flight-card')).toHaveCount(20);
  const alternate = page.locator('#results-fare-strip .fare-day:not(.selected)').first();
  const resultDate = await alternate.getAttribute('data-fare-date');
  const search = page.waitForRequest(r => r.url().endsWith('/api/flights/search') && r.postDataJSON().date === resultDate);
  await alternate.click();
  await search;
  await expect(page.locator('.flight-card')).toHaveCount(20);
  await expect(page.locator(`#results-fare-strip [data-fare-date="${resultDate}"]`)).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/#search');
  await expect(page.locator('#date-0')).toHaveValue(resultDate);
});

test("live payment confirmation arrives automatically and removes the payable QR", async ({ page }) => {
  let state = "awaiting_cash", statusCalls = 0;
  await page.route('**/api/config', r => r.fulfill({ json: { mode: 'live', checkout: true } }));
  await page.route('**/api/payencash/stores', r => r.fulfill({ json: { source: 'partner', stores: [] } }));
  await page.route('**/api/flights/calendar?*', r => r.fulfill({ json: { source: 'duffel-cache', simulation: false, days: [] } }));
  await page.route('**/api/orders/status', r => {
    statusCalls++;
    return r.fulfill({ json: { status: state, ...(state === 'ticket_issued' ? { ticket: {
      bookingReference: 'ABCDEF', slices: [{ origin:'CDG', destination:'RAK', departingAt:'2026-12-01T10:00:00' }],
      documents:[{type:'electronic_ticket',unique_identifier:'123-456789'}],
    } } : {}) } });
  });
  await page.goto('/');
  await page.clock.install();
  await page.evaluate(() => localStorage.setItem('voyagencash_live_orders', JSON.stringify([{
    id:'ord_test', token:'capability', expiresAt:Date.now()+7200000, amountCents:14200,
    voucher:{reference:'VNC-2026-ABCDE',qrPayload:'PARTNER|ABCDEF|14200',expiresAt:Date.now()+7200000,amountCents:14200},
  }])));
  await page.goto('/#bookings');
  await page.locator('[data-live-resume]').click();
  await expect(page.locator('#live-state')).toHaveText('Paiement en attente');
  await expect(page.locator('#live-voucher-content > svg')).toBeVisible();
  state = 'payment_received';
  await page.clock.runFor(5100);
  await expect(page.locator('#live-state')).toContainText('Paiement reçu');
  await expect(page.locator('#live-voucher-content > svg')).toHaveCount(0);
  state = 'ticket_issued';
  await page.clock.runFor(5100);
  await expect(page.locator('#live-voucher-content')).toContainText('ABCDEF');
  await expect(page.locator('#live-state')).toContainText('Billet émis');
  const finalCalls = statusCalls;
  await page.clock.runFor(11000);
  expect(statusCalls).toBe(finalCalls);
});
