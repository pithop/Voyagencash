/* A date rail shared by the search form and results. Unknown live fares stay unknown. */
(() => {
  const F = FlightEngine;
  const labels = { low: "prix bas", medium: "prix moyen", high: "prix élevé", unknown: "prix à vérifier" };
  const format = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const dates = (date, min) => {
    const center = new Date(date + "T12:00:00Z");
    center.setUTCDate(center.getUTCDate() - 3);
    const start = center.toISOString().slice(0, 10) < min ? new Date(min + "T12:00:00Z") : center;
    const max = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setUTCDate(d.getUTCDate() + i);
      return d.toISOString().slice(0, 10);
    }).filter(d => d <= max);
  };
  async function mount(container, query, onSelect) {
    if (!container || !F.airport(query.from) || !F.airport(query.to) || query.from === query.to || !query.date) return;
    const version = Symbol();
    container.fareVersion = version;
    const days = dates(query.date, query.min || new Date().toISOString().slice(0, 10));
    container.innerHTML = '<div class="fare-days" aria-label="Comparer les dates de départ"></div><p class="fare-source" role="status">Chargement des prix indicatifs…</p>';
    const rail = container.querySelector('.fare-days');
    function draw(values) {
      rail.innerHTML = days.map(date => {
        const day = values.find(d => d.date === date), tier = day?.tier || "unknown";
        const price = day?.price == null ? "—" : money.format(day.price);
        const label = day?.direct === false ? "aucun vol direct" : labels[tier];
        return `<button type="button" class="fare-day ${tier}${date === query.date ? ' selected' : ''}" data-fare-date="${date}" aria-pressed="${date === query.date}" aria-label="${F.dateLabel(date, true)}, ${price}, ${label}"><span>${format.format(new Date(date + 'T12:00:00Z'))}</span><strong>${price}</strong><i aria-hidden="true"></i></button>`;
      }).join('');
    }
    draw([]);
    rail.onclick = e => { const b = e.target.closest('[data-fare-date]'); if (b) onSelect(b.dataset.fareDate); };
    try {
      const months = [...new Set(days.map(d => d.slice(0, 7)))];
      const responses = await Promise.all(months.map(month => FlightAPI.calendar({ from: query.from, to: query.to, count: query.count, month })));
      if (container.fareVersion !== version || !container.isConnected) return;
      const allDays = responses.flatMap(r => r.days || []);
      const mergedDays = days.map(date => {
        const found = allDays.find(d => d.date === date);
        if (found && found.price !== null) return found;
        const month = date.slice(0, 7);
        const b = F.calendar({ from: query.from, to: query.to, month }).find(x => x.date === date);
        return b ? { ...b, indicative: true } : (found || { date, price: null, tier: "unknown", direct: null });
      });
      draw(mergedDays);
      container.querySelector('.fare-source').textContent = responses[0]?.simulation
        ? 'Prix indicatifs de démonstration · par adulte, vol direct'
        : 'Prix indicatifs et observés · par adulte, vol direct';
    } catch {
      if (container.fareVersion === version && container.isConnected)
        container.querySelector('.fare-source').textContent = 'Prix momentanément indisponibles. Choisissez une date pour rechercher les vols.';
    }
  }
  window.FareStrip = { mount };
})();
