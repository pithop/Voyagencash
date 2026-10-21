const { test, expect } = require("@playwright/test");
const date = new Date(Date.now() + 35 * 86400000).toISOString().slice(0, 10);
const query = { from: "CDG", to: "ALG", date, count: 1 };
test("server search returns consistent deterministic fares, terminals and baggage", async ({
  request,
}) => {
  const response = await request.post("/api/flights/search", { data: query });
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.source).toBe("demo");
  expect(data.offers).toHaveLength(20);
  expect(
    data.offers.every(
      (o) =>
        o.from === "CDG" &&
        o.to === "ALG" &&
        o.price > 0 &&
        o.arrival > o.departure &&
        o.simulation,
    ),
  ).toBe(true);
  const again = await request.post("/api/flights/search", { data: query });
  expect(await again.json()).toEqual(data);
});
test("calendar matches daily minimum direct fares and exposes three tiers", async ({
  request,
}) => {
  const response = await request.get("/api/flights/calendar", {
    params: { ...query, month: date.slice(0, 7) },
  });
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(new Set(data.days.map((d) => d.tier))).toEqual(
    new Set(["low", "medium", "high"]),
  );
  const offers = (
    await (await request.post("/api/flights/search", { data: query })).json()
  ).offers;
  expect(data.days.find((d) => d.date === date).price).toBe(
    Math.min(...offers.filter((o) => o.stops === 0).map((o) => o.price)),
  );
});
test("invalid methods, dates, airports, passenger counts and malformed bodies are rejected", async ({
  request,
}) => {
  expect((await request.get("/api/flights/search")).status()).toBe(405);
  for (const patch of [
    { from: "XXX" },
    { to: "CDG" },
    { date: "2027-02-30" },
    { count: 0 },
    { count: 1.2 },
    { count: 10 },
    { date: "2020-01-01" },
  ])
    expect(
      (
        await request.post("/api/flights/search", {
          data: { ...query, ...patch },
        })
      ).status(),
    ).toBe(400);
  expect(
    (
      await request.get("/api/flights/calendar", {
        params: { ...query, month: "2027-13" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/flights/search", {
        data: "{broken",
        headers: { "Content-Type": "application/json" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/flights/search", {
        data: query,
        headers: { origin: "https://untrusted.example" },
      })
    ).status(),
  ).toBe(403);
  expect((await request.get("/server/http.js")).status()).toBe(404);
  expect((await request.get("/assets/%2e%2e%2fserver/http.js")).status()).toBe(403);
});
test("server computes hold amount, signs vouchers, and rejects tampering and cash over-limit", async ({
  request,
}) => {
  const offers = (
    await (await request.post("/api/flights/search", { data: query })).json()
  ).offers;
  const offer = offers[0];
  const input = {
    count: 1,
    legs: [{ ...query, offerId: offer.id }],
    options: { baggage: true },
    total: 1,
  };
  const response = await request.post("/api/orders/hold", { data: input });
  expect(response.status()).toBe(201);
  const hold = await response.json();
  expect(hold.amountCents).toBe((offer.price + 35) * 100);
  expect(hold.expiresAt - Date.now()).toBeGreaterThan(7190000);
  const voucher = await request.post("/api/payencash/voucher", {
    data: { holdToken: hold.token },
  });
  expect(voucher.status()).toBe(201);
  const value = await voucher.json();
  expect(value.reference).toMatch(/^VNC-\d{4}-[A-F0-9]{12}$/);
  expect(value.qrPayload).toContain("DEMO|");
  expect(value.amountCents).toBe(hold.amountCents);
  const duplicate = await request.post("/api/payencash/voucher", {
    data: { holdToken: hold.token },
  });
  expect((await duplicate.json()).reference).toBe(value.reference);
  expect(
    (
      await request.post("/api/payencash/voucher", {
        data: { holdToken: hold.token + "x" },
      })
    ).status(),
  ).toBe(401);
  const expensive = await request.post("/api/orders/hold", {
    data: { ...input, count: 9 },
  });
  const large = await expensive.json();
  expect(large.amountCents).toBeGreaterThan(100000);
  expect(
    (
      await request.post("/api/payencash/voucher", {
        data: { holdToken: large.token },
      })
    ).status(),
  ).toBe(422);
});
