/* A static deployment stays usable; a configured live provider never silently becomes a demo. */
(() => {
  let config;
  const ready = fetch("/api/config", { signal: AbortSignal.timeout(2500) })
    .then(async (r) => {
      if (!r.ok) throw new Error("Configuration indisponible.");
      if (!r.headers.get("content-type")?.includes("application/json"))
        return { mode: "static", checkout: false };
      const data = await r.json();
      return ["live", "demo"].includes(data.mode)
        ? data
        : { mode: "static", checkout: false };
    })
    .catch(() => ({ mode: "unavailable", checkout: false }))
    .then((value) => {
      config = value;
      document.documentElement.dataset.apiMode = value.mode;
      const bar = document.querySelector(".demo-bar");
      if (bar && value.mode === "live")
        bar.innerHTML = '<span class="live-dot"></span> Offres des compagnies <span class="demo-detail">· Disponibilités vérifiées à la recherche · Paiement selon éligibilité</span>';
      else if (bar && value.stripe)
        bar.innerHTML = '<span class="live-dot"></span> Offres de démonstration <span class="demo-detail">· Carte bancaire via Stripe · Aucun billet réel</span>';
      return value;
    });
  async function request(path, data, headers = {}) {
    const response = await fetch(path, {
      method: data ? "POST" : "GET",
      headers: {
        ...(data ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
      signal: AbortSignal.timeout(55000),
    });
    if (!response.headers.get("content-type")?.includes("application/json"))
      throw new Error("Le service de réservation est indisponible.");
    const value = await response.json();
    if (!response.ok)
      throw new Error(value.error || "Service momentanément indisponible.");
    return value;
  }
  const pendingSearches = new Map(), searchCache = new Map();
  async function search(query) {
    await ready;
    if (config.mode === "unavailable") throw new Error("Configuration indisponible. Rechargez la page pour réessayer.");
    if (config.mode === "static")
      return {
        source: "offline-demo",
        simulation: true,
        offers: FlightEngine.generate(query),
      };
    const key = JSON.stringify([query.from, query.to, query.date, query.count || 1]);
    const cached = searchCache.get(key);
    if (cached && Date.now() < cached.until) return cached.value;
    if (pendingSearches.has(key)) return pendingSearches.get(key);
    const pending = request("/api/flights/search", query).then(value => {
      const expiry = Math.min(Date.now() + 15000, ...value.offers.map(o => Date.parse(o.expiresAt)).filter(Number.isFinite));
      if (searchCache.size >= 32) searchCache.delete(searchCache.keys().next().value);
      searchCache.set(key, { value, until: expiry });
      cache.clear();
      return value;
    }).finally(() => pendingSearches.delete(key));
    pendingSearches.set(key, pending);
    return pending;
  }
  const cache = new Map();
  const pendingCalendars = new Map();
  async function calendar(query) {
    await ready;
    const key = new URLSearchParams({ from: query.from, to: query.to, month: query.month, count: query.count || 1 }).toString();
    if (config.mode === "unavailable") throw new Error("Configuration indisponible. Rechargez la page pour réessayer.");
    if (config.mode === "static") {
      if (!cache.has(key))
        cache.set(key, {
          source: "offline-demo",
          simulation: true,
          days: FlightEngine.calendar(query),
        });
      return cache.get(key);
    }
    if (cache.has(key) && config.mode !== "live") return cache.get(key);
    if (pendingCalendars.has(key)) return pendingCalendars.get(key);
    const pending = request("/api/flights/calendar?" + key).then(value => {
      cache.set(key, value);
      return value;
    }).finally(() => pendingCalendars.delete(key));
    pendingCalendars.set(key, pending);
    return pending;
  }
  async function createStripeIntent(data) {
    await ready;
    return request("/api/stripe/create-intent", data);
  }
  window.FlightAPI = {
    ready,
    search,
    calendar,
    request,
    createStripeIntent,
    get mode() {
      return config?.mode;
    },
    get checkout() {
      return !!config?.checkout;
    },
    get stripe() {
      return !!config?.stripe;
    },
    get stripePublicKey() {
      return config?.stripePublicKey;
    },
  };
})();
