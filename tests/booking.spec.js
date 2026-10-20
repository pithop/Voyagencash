const { test, expect } = require("@playwright/test");
const { PNG } = require("pngjs");
const jsQR = require("jsqr");
const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const issues = [];
  errors.set(page, issues);
  page.on("pageerror", (e) => issues.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") issues.push(msg.text());
  });
  await page.goto("/");
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});
async function selectFlights(page, type = "oneway", count = 1) {
  await page.locator(`[data-trip="${type}"]`).click();
  await page.locator("#traveler-count").selectOption(String(count));
  await page.locator(".search-submit").click();
  const legs = type === "oneway" ? 1 : 2;
  for (let i = 0; i < legs; i++)
    await page.locator("[data-select-flight]").first().click();
  await expect(page.locator("#view-options")).toBeVisible();
}
async function passengers(page, count = 1) {
  await page.locator("[data-action=to-passengers]").click();
  for (let i = 0; i < count; i++) {
    await page.locator(`[name="firstName-${i}"]`).fill(i ? "Amine" : "Léa");
    await page.locator(`[name="lastName-${i}"]`).fill("Martin");
    await page
      .locator(`[name="birthDate-${i}"]`)
      .fill(i ? "2000-04-08" : "1992-03-12");
    await page.locator(`[name="document-${i}"]`).fill("TEST12345");
  }
  await page.locator("[name=email]").fill("lea@example.test");
  await page.locator("[name=phone]").fill("0600000000");
  await page.locator("#passenger-consent").check();
  await page.locator("#passengers-form [type=submit]").click();
  await expect(page.locator("#view-payment")).toBeVisible();
}
async function pay(page, method) {
  await page.locator(`[name=payment-method][value=${method}]`).check();
  await page.locator("#payment-consent").check();
  await page.locator("#pay-button").click();
}
test("round trip, two passengers, options, scannable voucher, persistence, ticket and cancellation", async ({
  page,
}) => {
  await selectFlights(page, "roundtrip", 2);
  await page.locator("#baggage-option").check();
  await page.locator("#guarantee-option").check();
  await passengers(page, 2);
  await pay(page, "voucher");
  const qr = PNG.sync.read(
    await page.locator(".voucher-center > svg").screenshot(),
  );
  const decoded = jsQR(new Uint8ClampedArray(qr.data), qr.width, qr.height);
  expect(decoded).not.toBeNull();
  expect(decoded.data).toContain("DEMO|BON-VGC-");
  await expect(page.locator("#voucher-timer")).toContainText("min");
  await page.reload();
  await expect(page.locator(".voucher-code")).toBeVisible();
  const before = await page.evaluate(() => BookingManager.all()[0]);
  expect(before.total).toBe(
    before.flights.reduce((s, f) => s + f.price * 2, 0) + 140 + 38,
  );
  expect(before.flights).toHaveLength(2);
  await page.locator("[data-action=validate-voucher]").click();
  await expect(page.locator("#confirmation-title")).toBeVisible();
  await expect(page.locator("#view-confirmation .boarding-pass")).toHaveCount(
    2,
  );
  const stored = await page.evaluate(() => BookingManager.all()[0]);
  expect(stored.status).toBe("confirmed");
  expect(stored.tickets).toHaveLength(2);
  expect(new Set(stored.tickets).size).toBe(2);
  const downloadEvent = page.waitForEvent("download");
  await page.locator("#view-confirmation [data-download]").click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/^voyagencash-VGC-.*\.html$/);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#print-area")).toBeVisible();
  await expect(page.locator(".site-header")).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await page.goto("/#bookings");
  await expect(page.locator(".booking-card")).toHaveCount(1);
  await page.locator("[data-view-ticket]").click();
  await expect(page.locator("dialog[open] .boarding-pass")).toHaveCount(2);
  await page.locator(".dialog-close").click();
  await page.locator("#view-bookings [data-cancel]").click();
  await page.locator("[data-confirm-cancel]").click();
  await expect(page.locator(".booking-card .badge")).toHaveText("Annulée");
  await page.reload();
  await expect(page.locator(".booking-card .badge")).toHaveText("Annulée");
});
test("card refusal and successful 3D Secure retry never create duplicate reservations", async ({
  page,
}) => {
  await selectFlights(page);
  await passengers(page);
  await pay(page, "card");
  await expect(page.locator("#dialog-title")).toContainText("3D Secure");
  await page.locator("[data-action=decline-payment]").click();
  await expect(page.locator("#validate-payment")).toBeEnabled();
  await page.locator("[data-action=resume-payment]").click();
  await page.locator("[data-action=authorize-payment]").click();
  await expect(page.locator("#confirmation-title")).toBeVisible();
  await page.goto("/#payment");
  await expect(page.locator("#confirmation-title")).toBeVisible();
  expect(await page.evaluate(() => BookingManager.all().length)).toBe(1);
});
test("multi destination and Apple Pay", async ({ page }) => {
  await page.locator("[data-trip=multi]").click();
  await page.locator("#add-leg").click();
  await expect(page.locator(".search-leg")).toHaveCount(3);
  await page.locator("#to-2").fill("Lisbonne");
  await page.locator("[data-airport-choice=LIS]").click();
  await page.locator(".search-submit").click();
  for (let i = 0; i < 3; i++)
    await page.locator("[data-select-flight]").first().click();
  await passengers(page);
  await pay(page, "apple");
  await expect(page.locator("#dialog-title")).toContainText("Apple Pay");
  await page.locator("[data-action=authorize-payment]").click();
  await expect(page.locator("#view-confirmation .pass-flight")).toHaveCount(3);
  expect(
    await page.evaluate(() => BookingManager.all()[0].flights.map((f) => f.to)),
  ).toEqual(["RAK", "CDG", "LIS"]);
});
test("filtering, airport keyboard, swap, dates and zero results recovery", async ({
  page,
}) => {
  await page.locator("#from-0").fill("Marseille");
  await page.locator("#from-0").press("ArrowDown");
  await page.locator("#from-0").press("Enter");
  await expect(page.locator("#from-0")).toHaveValue("Marseille (MRS)");
  await page.locator("[data-swap]").click();
  await expect(page.locator("#to-0")).toHaveValue("Marseille (MRS)");
  await page.locator("[data-trip=oneway]").click();
  await page.locator(".search-submit").click();
  await expect(page.locator(".flight-card")).toHaveCount(20);
  await page.locator("#sort-select").selectOption("price");
  const prices = await page.locator(".flight-price strong").allTextContents();
  const numeric = prices.map(
    (p) => +p.replace(/[^\d,]/g, "").replace(",", "."),
  );
  expect(numeric).toEqual([...numeric].sort((a, b) => a - b));
  await page.locator("#direct-filter").check();
  await expect(page.locator(".timeline")).not.toContainText(["1 escale"]);
  await page.locator("[name=period-filter][value=morning]").check();
  await page.locator("[name=carrier-filter]").first().check();
  await page.locator("#budget-filter").fill("0");
  await expect(page.locator("#flight-list")).toContainText("Aucun vol");
  await page.locator("#flight-list [data-action=reset-filters]").click();
  await expect(page.locator(".flight-card")).toHaveCount(20);
});
test("voucher expiration persists and prevents validation", async ({
  page,
}) => {
  await selectFlights(page);
  await passengers(page);
  await pay(page, "voucher");
  await page.evaluate(() => {
    const r = BookingManager.all();
    r[0].expiresAt = Date.now() - 1;
    localStorage.setItem(BookingManager.KEY, JSON.stringify(r));
  });
  await expect(page.locator("#voucher-timer")).toContainText("expiré");
  await expect(page.locator("#validate-payment")).toBeDisabled();
  await page.reload();
  await expect(page.locator("#validate-payment")).toBeDisabled();
  await page.goto("/#bookings");
  await expect(page.locator(".booking-card .badge")).toHaveText("Expirée");
});
test("mobile navigation, store locator, responsive layout and back navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.locator("#home-title")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator("#menu-toggle").click();
  await page.locator("#main-nav [data-nav=stores]").click();
  await page.locator("#store-search").fill("69000");
  await expect(page.locator(".store-item")).toHaveCount(1);
  await expect(page.locator(".store-item")).toContainText("Lyon");
  await page.locator("#store-search").fill("inconnu");
  await expect(page.locator("#store-list")).toContainText("Aucun point");
  await page.goto("/#search");
  await selectFlights(page);
  await passengers(page);
  await pay(page, "voucher");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator("[data-action=validate-voucher]").click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("validation rejects invalid dates and missing airports, escaped input and broken storage", async ({
  page,
}) => {
  await page.locator("#to-0").fill("Atlantide");
  await page.locator("#home-title").click();
  await page.locator(".search-submit").click();
  await expect(page.locator("#search-error")).toContainText(
    "choisissez un aéroport",
  );
  const validation = await page.evaluate(() => {
    try {
      BookingManager.validatePassengers(
        [
          {
            firstName: "<img>",
            lastName: "Martin",
            birthDate: "1999-01-01",
            document: "TEST12345",
            documentType: "passport",
          },
        ],
        { email: "a@b.test", phone: "0600000000" },
        "2030-01-01",
      );
      return false;
    } catch {
      return true;
    }
  });
  expect(validation).toBe(true);
  await page.evaluate(() =>
    localStorage.setItem("voyagencash_reservations", "not-json"),
  );
  await page.goto("/#bookings");
  await expect(page.locator("#bookings-content")).toContainText(
    "Stockage local indisponible",
  );
});
test("engine timezone and overnight consistency, stable offers and distinct ticket issuance", async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const F = FlightEngine,
      date = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
      a = F.generate({ from: "CDG", to: "JFK", date }),
      b = F.generate({ from: "CDG", to: "JFK", date });
    return {
      stable: JSON.stringify(a) === JSON.stringify(b),
      count: F.airports.length,
      all: a.every(
        (f) =>
          f.arrival - f.departure === f.duration * 60000 &&
          f.segments.every((s) => s.arrival > s.departure),
      ),
      cdg: F.time(F.localUTC("2027-03-30", 14, 30, "Europe/Paris"), "CDG"),
      jfk: F.time(F.localUTC("2027-03-30", 14, 30, "America/New_York"), "JFK"),
      stops: a.some((f) => f.stops === 1),
    };
  });
  expect(result).toEqual({
    stable: true,
    count: 48,
    all: true,
    cdg: "14:30",
    jfk: "14:30",
    stops: true,
  });
});
test("passenger draft survives back navigation and reload, storage failure keeps payment uncreated", async ({
  page,
}) => {
  await selectFlights(page);
  await passengers(page);
  await page.locator('#view-payment a[href="#passengers"]').click();
  await expect(page.locator("[name=firstName-0]")).toHaveValue("Léa");
  await page.reload();
  await expect(page.locator("[name=firstName-0]")).toHaveValue("Léa");
  await page.locator("#passenger-consent").check();
  await page.locator("#passengers-form [type=submit]").click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "voyagencash_reservations")
        throw new DOMException("Full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await pay(page, "voucher");
  await expect(page.locator("#toast")).toContainText("ne peut pas enregistrer");
  expect(await page.evaluate(() => BookingManager.all())).toEqual([]);
  await expect(page.locator("#pay-button")).toBeVisible();
});
test("same-day return excludes impossible connections, navigation aliases and static assets load", async ({
  page,
}) => {
  const departure = await page.locator("#date-0").inputValue();
  await page.locator("#return-date").fill(departure);
  await page.locator(".search-submit").click();
  await page.locator("#sort-select").selectOption("duration");
  await page.locator("[data-select-flight]").first().click();
  const valid = await page.evaluate(() => {
    const d = BookingManager.loadDraft();
    return [...document.querySelectorAll("[data-select-flight]")].every(
      (b) =>
        FlightEngine.generate(d.search.legs[1]).find(
          (f) => f.id === b.dataset.selectFlight,
        ).departure >=
        d.flights[0].arrival + 120 * 60000,
    );
  });
  expect(valid).toBe(true);
  for (const [url, selector] of [
    ["/mes-billets", "#bookings-title"],
    ["/ou-payer", "#stores-title"],
    ["/aide", "#faq-title"],
    ["/aller-simple", "#home-title"],
  ]) {
    await page.goto(url);
    await expect(page.locator(selector)).toBeVisible();
  }
  await expect(page.locator("[data-trip=oneway]")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
