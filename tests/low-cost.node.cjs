const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { readFileSync } = require("node:fs");
const { newDb } = require("pg-mem");
const F = require("../assets/js/flight-engine.js");
const { sign } = require("../server/http.js");
const dbPath = require.resolve("../server/database.js");
const modulePath = require.resolve("../server/travelfusion.js");
let pool, env, oldFetch, oldDatabase, T;
const date = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
const passenger = { given_name: "Lea", family_name: "Martin", born_on: "1990-01-01", email: "lea@example.test", phone_number: "+33612345678" };
function input(extra = {}) {
  return { from: "MRS", to: "RAK", date, count: 1, airline: "FR", flightNumber: "FR 2640", passengers: [passenger], idempotencyKey: crypto.randomUUID(), ...extra };
}
function liveInput() {
  Object.assign(process.env, { TRAVELFUSION_ADAPTER_URL: "https://adapter.example.test/v1/", TRAVELFUSION_API_KEY: "private-key", TRAVELFUSION_BOOKING_ENABLED: "true" });
  const bookingToken = sign({ kind: "low-cost-offer", from: "MRS", to: "RAK", date, count: 1, airline: "FR", amountCents: 8199, offerId: "route_123", expiresAt: Date.now() + 3600000 });
  return input({ bookingToken, expectedAmountCents: 8199 });
}
beforeEach(() => {
  env = { ...process.env }; oldFetch = global.fetch;
  delete process.env.TRAVELFUSION_ADAPTER_URL;
  delete process.env.TRAVELFUSION_API_KEY;
  process.env.CONCIERGE_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
  process.env.VOUCHER_SIGNING_SECRET = "test-signing-key";
  const memory = newDb();
  memory.public.none(readFileSync("server/schema.sql", "utf8"));
  const { Pool } = memory.adapters.createPg(); pool = new Pool();
  require(dbPath); oldDatabase = require.cache[dbPath].exports;
  require.cache[dbPath].exports = { database: () => pool };
  delete require.cache[modulePath]; T = require(modulePath);
  global.fetch = async () => { throw new Error("Unexpected network access"); };
});
afterEach(async () => {
  global.fetch = oldFetch;
  require.cache[dbPath].exports = oldDatabase;
  delete require.cache[modulePath];
  for (const k of Object.keys(process.env)) if (!(k in env)) delete process.env[k];
  Object.assign(process.env, env);
  await pool.end();
});

test("official handoff validates calendar/count and excludes all passenger identity", () => {
  const url = new URL(T.createRyanairDirectHandoffUrl(input()));
  assert.equal(url.origin, "https://www.ryanair.com");
  assert.equal(url.searchParams.get("originIata"), "MRS");
  assert.equal(url.searchParams.get("dateOut"), date);
  assert.equal(url.searchParams.get("adults"), "1");
  assert.ok(!url.href.includes("Lea") && !url.href.includes("example.test"));
  for (const extra of [{ count: 10 }, { date: "2027-02-30" }, { from: "MRS&x=1" }, { to: "MRS" }])
    assert.throws(() => T.createRyanairDirectHandoffUrl(input(extra)), { status: 400 });
});

test("unconfigured provider queues encrypted passengers once and status requires a capability", async () => {
  assert.deepEqual(await T.searchLowCost(input()), []);
  const request = input();
  const result = await T.bookFlight(request);
  assert.equal(result.status, "concierge_pending");
  assert.equal(result.bookingReference, null);
  assert.ok(result.handoffUrl.startsWith("https://www.ryanair.com/"));
  assert.equal(result.token, undefined);
  assert.equal((await T.bookFlight(request)).id, result.id);
  await assert.rejects(T.bookFlight({ ...request, to: "ALG" }), { status: 409 });
  const rows = (await pool.query("SELECT * FROM low_cost_bookings")).rows;
  assert.equal(rows.length, 1);
  assert.ok(!JSON.stringify(rows).includes(passenger.email));
  const saved = rows[0].encrypted_payload;
  const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(process.env.CONCIERGE_ENCRYPTION_KEY, "hex"), Buffer.from(saved.iv, "base64"));
  decipher.setAAD(Buffer.from(result.id));
  decipher.setAuthTag(Buffer.from(saved.tag, "base64"));
  const clear = JSON.parse(Buffer.concat([decipher.update(Buffer.from(saved.data, "base64")), decipher.final()]).toString());
  assert.deepEqual(clear.passengers, [passenger]);
  assert.equal((await T.checkBookingStatus({ token: result.accessToken })).status, "concierge_pending");
  await assert.rejects(T.checkBookingStatus({ token: result.accessToken + "bad" }), { status: 401 });
});

test("missing encryption configuration and invalid passengers never create a booking", async () => {
  await assert.rejects(T.bookFlight(input({ passengers: [{ ...passenger, born_on: "2020-01-01" }] })), { status: 400 });
  delete process.env.CONCIERGE_ENCRYPTION_KEY;
  await assert.rejects(T.bookFlight(input()), { status: 503 });
  assert.equal((await pool.query("SELECT * FROM low_cost_bookings")).rows.length, 0);
});

test("easyJet and Wizz Air concierge requests never redirect to Ryanair", async () => {
  for (const airline of ["U2", "W6"]) {
    const result = await T.bookFlight(input({ airline, flightNumber: `${airline} 123` }));
    assert.equal(result.status, "concierge_pending");
    assert.equal(result.handoffUrl, null);
  }
});

test("ambiguous provider booking is reconciled without submitting or purchasing twice", async () => {
  const request = liveInput(); let submissions = 0;
  global.fetch = async (url, options) => {
    assert.equal(options.redirect, "error");
    const payload = JSON.parse(options.body);
    if (String(url).endsWith("/bookings")) {
      submissions++;
      assert.equal(options.headers["Idempotency-Key"], request.idempotencyKey);
      assert.equal(payload.expectedAmountCents, 8199);
      throw new Error("Connection lost after purchase");
    }
    assert.equal(String(url), "https://adapter.example.test/v1/bookings/status");
    assert.ok(payload.clientReference.startsWith("lcc_"));
    return { ok: true, json: async () => ({ status: "confirmed", bookingReference: "ABCDEF" }) };
  };
  const result = await T.bookFlight(request);
  assert.equal(result.status, "reconciliation_required");
  assert.equal(result.handoffUrl, null);
  assert.equal((await T.bookFlight(request)).id, result.id);
  const checked = await T.checkBookingStatus({ token: result.accessToken });
  assert.equal(checked.status, "confirmed"); assert.equal(checked.bookingReference, "ABCDEF");
  await T.checkBookingStatus({ token: result.accessToken });
  assert.equal(submissions, 1);
});

test("repricing mismatch, disabled emission and invalid confirmation cannot issue a ticket", async () => {
  const request = liveInput();
  await assert.rejects(T.bookFlight({ ...request, expectedAmountCents: 8200 }), { status: 409 });
  process.env.TRAVELFUSION_BOOKING_ENABLED = "false";
  await assert.rejects(T.bookFlight(request), { status: 503 });
  process.env.TRAVELFUSION_BOOKING_ENABLED = "true";
  global.fetch = async () => ({ ok: true, json: async () => ({ status: "confirmed" }) });
  assert.equal((await T.bookFlight(request)).status, "reconciliation_required");
});

test("search returns a signed EUR offer and preserves actual aircraft", async () => {
  liveInput();
  const departure = Date.parse(date + "T10:00:00Z"), arrival = departure + 3 * 3600000;
  global.fetch = async (url, options) => {
    assert.equal(String(url), "https://adapter.example.test/v1/search");
    assert.ok(JSON.parse(options.body).carriers.includes("W6"));
    return { ok: true, json: async () => ({ offers: [{ id: "route_123", from: "MRS", to: "RAK", date,
      airline: { code: "FR", name: "Ryanair", color: "#1a3471" }, currency: "EUR", totalAmount: 8199 / 100,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      segments: [{ from: "MRS", to: "RAK", departure, arrival, number: "FR 2640", aircraft: "Boeing 737-8200" }],
    }] }) };
  };
  const [offer] = await T.searchLowCost(input());
  assert.equal(offer.provider, "travelfusion");
  assert.equal(offer.id, "tf_route_123"); assert.ok(offer.bookingToken);
  assert.equal(offer.segments[0].aircraft, "Boeing 737-8200");
  assert.equal(offer.segments[0].aircraftEstimated, false);
  assert.equal(offer.payment_requirements.requires_instant_payment, true);
});

test("boarding milestones cross midnight and daylight saving by elapsed time", () => {
  const departure = F.localUTC("2027-03-28", 0, 20, "Europe/Paris");
  const m = F.boardingMilestones(departure);
  assert.equal(departure - m.checkInCloses, 45 * 60000);
  assert.equal(departure - m.gateOpens, 40 * 60000);
  assert.equal(departure - m.gateCloses, 20 * 60000);
  assert.equal(F.dateInZone(m.checkInCloses, "Europe/Paris"), "2027-03-27");
  const dst = F.localUTC("2027-03-28", 3, 20, "Europe/Paris");
  assert.equal(F.time(F.boardingMilestones(dst).checkInCloses, "CDG"), "01:35");
  assert.equal(F.aircraftFor("FR", "MRS", "RAK"), "Boeing 737-800");
  assert.equal(F.aircraftFor("TO", "ORY", "RAK"), "Airbus A320neo");
  assert.equal(F.aircraftFor("AF", "CDG", "JFK"), "Airbus A350-900");
});

test("concurrent submissions share one durable claim and one provider call", async () => {
  const request = liveInput(); let calls = 0;
  global.fetch = async () => {
    calls++;
    return { ok: true, json: async () => ({ status: "pending" }) };
  };
  const [a, b] = await Promise.all([T.bookFlight(request), T.bookFlight(request)]);
  assert.equal(a.id, b.id);
  assert.equal(calls, 1);
  assert.equal((await pool.query("SELECT * FROM low_cost_bookings")).rows.length, 1);
});

test("production Ryanair hold endpoint queues a request without issuing payment tokens", async () => {
  delete process.env.VOYAGENCASH_TEST_MODE;
  const { Readable } = require("node:stream");
  const path = require.resolve("../api/orders/hold.js");
  delete require.cache[path];
  const handler = require(path);
  const req = Readable.from([Buffer.from(JSON.stringify({
    offerId: `fr_MRS_RAK_${date}_2640_8199`, passengers: [passenger],
  }))]);
  req.method = "POST";
  req.headers = { host: "localhost", "idempotency-key": crypto.randomUUID() };
  const res = { setHeader() {}, end(value) { this.data = JSON.parse(value); } };
  await handler(req, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.data.status, "concierge_pending");
  assert.equal(res.data.token, undefined);
  assert.equal(res.data.bookingReference, null);
  delete require.cache[path];
});
