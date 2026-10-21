const { test, expect } = require('@playwright/test');
const { readFile } = require('node:fs/promises');

// Exercise domain rules independently of the UI so a hidden/disabled control
// cannot be the only protection against an invalid payment.
async function seed(page, { price = 142, method = 'voucher', create = true } = {}) {
  await page.goto('/');
  return page.evaluate(({ price, method, create }) => {
    const F = FlightEngine, B = BookingManager;
    const date = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const leg = { from: 'CDG', to: 'ALG', date };
    const flight = { ...F.generate(leg)[0], price };
    const draft = {
      search: { type: 'oneway', count: 1, legs: [leg] },
      flights: [flight], options: { baggage: false, guarantee: false },
      passengers: [{ firstName: 'Léa', lastName: 'Martin', birthDate: '1992-03-12', document: 'TEST12345', documentType: 'passport' }],
      contact: { email: 'lea@example.test', phone: '0600000000' },
    };
    const record = create ? B.create(draft, method) : null;
    B.saveDraft({ ...draft, currentId: record?.id || null });
    return record;
  }, { price, method, create });
}

test('deterministic cash lifecycle, idempotency and refund preserve legacy statuses', async ({ page }) => {
  const record = await seed(page);
  expect(record.voucher).toMatch(/^VNC-2026-[A-Z0-9]{5}$/);
  expect(record.pnr).toMatch(/^[A-Z0-9]{6}$/);
  expect(record.expiresAt - record.createdAt).toBe(7200000);
  expect(record.stateHistory.map(x => x.state)).toEqual(['INITIALIZED', 'HOLD_PENDING', 'AWAITING_CASH']);
  expect(record.fiscal.vatAtVoucherIssue).toBe(0);
  expect(record.hold.type).toBe('hold');
  expect(record.hold.payment_requirements.requires_instant_payment).toBe(false);
  const results = await page.evaluate(id => {
    const duplicate = BookingManager.create(BookingManager.loadDraft(), 'voucher');
    const first = BookingManager.confirm(id);
    const retry = BookingManager.confirm(id);
    const cancelled = BookingManager.cancel(id);
    let rejected = false;
    try { BookingManager.confirm(id); } catch { rejected = true; }
    return { duplicate, first, retry, cancelled, rejected, count: BookingManager.all().length };
  }, record.id);
  expect(results.count).toBe(1);
  expect(results.duplicate.id).toBe(record.id);
  expect(results.first.status).toBe('confirmed');
  expect(results.first.stateHistory.map(x => x.state)).toEqual(['INITIALIZED', 'HOLD_PENDING', 'AWAITING_CASH', 'PAYMENT_CAPTURED', 'TICKET_ISSUED']);
  expect(results.retry.tickets).toEqual(results.first.tickets);
  expect(results.cancelled.status).toBe('cancelled');
  expect(results.cancelled.state).toBe('REFUND_PENDING');
  expect(results.cancelled.refund.status).toBe('pending');
  expect(results.rejected).toBe(true);
});

test('cash ceiling accepts exactly 1000 and blocks over-limit UI and manager', async ({ page }) => {
  await seed(page, { price: 1000 });
  expect(await page.evaluate(() => BookingManager.all()[0].total)).toBe(1000);
  await page.evaluate(() => { localStorage.clear(); });
  await seed(page, { price: 1001, create: false });
  const error = await page.evaluate(() => {
    try { BookingManager.create(BookingManager.loadDraft(), 'voucher'); return null; }
    catch (error) { return error.message; }
  });
  expect(error).toContain('1 000');
  expect(await page.evaluate(() => BookingManager.all())).toEqual([]);
  await page.goto('/?fixture=loaded#payment');
  await expect(page.locator('.notice.amber')).toContainText('1 000');
  await expect(page.locator('#pay-voucher-trigger')).toBeDisabled();
  await expect(page.locator('#pay-button')).toBeDisabled();
  await page.locator('#card-pay').check();
  await expect(page.locator('#pay-button')).toBeEnabled();
  await page.locator('#payment-consent').check();
  await page.locator('#pay-button').click();
  await page.locator('[data-action=authorize-payment]').click();
  await expect(page.locator('#confirmation-title')).toBeVisible();
});

test('amber countdown, persisted expiry and rejection of payment after deadline', async ({ page }) => {
  await seed(page);
  await page.evaluate(() => {
    const records = BookingManager.all();
    records[0].expiresAt = Date.now() + 899000;
    localStorage.setItem(BookingManager.KEY, JSON.stringify(records));
  });
  await page.goto('/?fixture=loaded#payment');
  await expect(page.locator('.countdown')).toHaveClass(/urgent/);
  await expect(page.locator('#timer-warning')).toContainText('15 minutes');
  await page.evaluate(() => {
    const records = BookingManager.all();
    records[0].expiresAt = Date.now() - 1;
    localStorage.setItem(BookingManager.KEY, JSON.stringify(records));
  });
  await expect(page.locator('#validate-payment')).toBeDisabled();
  const record = await page.evaluate(() => JSON.parse(localStorage.getItem(BookingManager.KEY))[0]);
  expect(record.status).toBe('expired');
  expect(record.state).toBe('EXPIRED');
  const rejected = await page.evaluate(id => {
    try { BookingManager.confirm(id); return false; } catch { return true; }
  }, record.id);
  expect(rejected).toBe(true);
  await page.reload();
  await expect(page.locator('#voucher-timer')).toContainText('expiré');
});

test('GPS sorts partner examples by distance and denial keeps city search usable', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 43.702, longitude: 7.267 });
  await page.goto('/#stores');
  await page.locator('#locate-stores').click();
  await expect(page.locator('.store-item').first()).toContainText('Nice');
  await expect(page.locator('.store-item').first()).toContainText('0.0 km');
  await context.clearPermissions();
  await page.evaluate(() => {
    navigator.geolocation.getCurrentPosition = (_, failure) => failure({ code: 1 });
  });
  await page.locator('#locate-stores').click();
  await expect(page.locator('#geo-status')).toContainText('refusée');
  await page.locator('#store-search').fill('69000');
  await expect(page.locator('.store-item')).toHaveCount(1);
  await expect(page.locator('.store-item')).toContainText('Lyon');
});

test('live weather uses destination coordinates and gracefully handles failure', async ({ page }) => {
  await seed(page);
  let requested = '';
  await page.route('https://api.open-meteo.com/**', route => {
    requested = route.request().url();
    return route.fulfill({ json: { current: { temperature_2m: 24.4, weather_code: 0, time: '2026-10-21T15:15' } } });
  });
  await page.goto('/?fixture=loaded#payment');
  await page.locator('[data-weather]').click();
  await expect(page.locator('#arrival-weather')).toContainText('24');
  await expect(page.locator('#weather-description')).toContainText('15:15');
  expect(requested).toContain('latitude=36.69');
  await page.unroute('https://api.open-meteo.com/**');
  await page.route('https://api.open-meteo.com/**', route => route.fulfill({ status: 503, body: '{}' }));
  await page.locator('[data-weather]').click();
  await expect(page.locator('#weather-description')).toContainText('indisponible');
  await expect(page.locator('[data-weather]')).toBeEnabled();
});

test('Wallet export is an explicit unsigned ZIP specimen and carries correct itinerary', async ({ page }) => {
  const record = await seed(page);
  await page.evaluate(id => BookingManager.confirm(id), record.id);
  await page.goto('/?fixture=loaded#confirmation');
  await expect(page.locator('.wallet-panel')).toContainText('non signé');
  const event = page.waitForEvent('download');
  await page.locator('[data-wallet]').click();
  const download = await event;
  expect(download.suggestedFilename()).toMatch(/-simulation\.pkpass$/);
  const bytes = await readFile(await download.path());
  expect(bytes.readUInt32LE(0)).toBe(0x04034b50);
  const nameLength = bytes.readUInt16LE(26), size = bytes.readUInt32LE(18);
  expect(bytes.subarray(30, 30 + nameLength).toString()).toBe('pass.json');
  const pass = JSON.parse(bytes.subarray(30 + nameLength, 30 + nameLength + size));
  expect(pass.boardingPass.primaryFields.map(f => f.value)).toEqual(['CDG', 'ALG']);
  expect(pass.serialNumber).toBe(record.id);
  expect(pass.description).toContain('non signé');
});

test('baggage filter is selective and all strategic airlines are available', async ({ page }) => {
  await page.goto('/');
  const check = await page.evaluate(() => {
    const date = new Date(Date.now() + 30 * 86400000).toISOString().slice(0,10);
    const offers = FlightEngine.generate({ from: 'CDG', to: 'ALG', date });
    const included = FlightEngine.filter(offers, { baggage: true });
    return { valid: included.every(f => f.cabinBagIncluded), filtered: included.length < offers.length && included.length > 0, carriers: FlightEngine.airlines.map(c => c.code) };
  });
  expect(check.valid).toBe(true); expect(check.filtered).toBe(true);
  expect(check.carriers).toEqual(expect.arrayContaining(['AH','AT','TU','TO','FR','AF','AZ','TK']));
  await page.locator('[data-trip=oneway]').click();
  await page.locator('.search-submit').click();
  await expect(page.locator('.flight-card')).toHaveCount(20);
  await page.locator('#baggage-filter').check();
  expect(await page.locator('.flight-card').count()).toBeLessThan(20);
});

test('sound preference persists and reduced motion keeps a static pass', async ({ page }) => {
  await seed(page);
  await page.goto('/?fixture=loaded#payment');
  await page.locator('#sound-toggle').click();
  await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('.travel-pass').hover({ position: { x: 100, y: 100 } });
  expect(await page.locator('.travel-pass').evaluate(el => el.style.getPropertyValue('--shine-x'))).toBe('');
  await page.locator('#sound-toggle').click();
  await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed', 'false');
});
