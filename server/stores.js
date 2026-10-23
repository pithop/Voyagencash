// A text label cannot establish today's opening hours or holiday exceptions.
function availability(store, now = Date.now(), deadline = now + 120 * 60000) {
  const checked = Date.parse(store.hoursConfirmedAt);
  const fresh = Number.isFinite(checked) && checked <= now && now - checked <= 120 * 60000;
  const windows = Array.isArray(store.openingWindows) ? store.openingWindows : [];
  const valid = windows.filter(w => w && Number.isFinite(Date.parse(w.opensAt)) &&
    Number.isFinite(Date.parse(w.closesAt)) && Date.parse(w.closesAt) > Date.parse(w.opensAt));
  const current = fresh && valid.find(w => Date.parse(w.opensAt) <= now && Date.parse(w.closesAt) > now);
  const known = fresh && Number.isFinite(Date.parse(store.scheduleValidUntil)) && Date.parse(store.scheduleValidUntil) >= deadline;
  const closesInMinutes = current ? Math.floor((Date.parse(current.closesAt) - now) / 60000) : null;
  return { hoursConfirmedAt: fresh ? new Date(checked).toISOString() : null,
    isOpen: current ? true : known ? false : null,
    openStatus: current ? closesInMinutes <= 30 ? "closing_soon" : "open" : known ? "closed" : "unknown",
    closesInMinutes, closesAt: current ? current.closesAt : null,
    paymentWindowConfirmed: !!current && Date.parse(current.closesAt) >= deadline,
    paymentDeadline: new Date(deadline).toISOString() };
}
module.exports = { availability };
