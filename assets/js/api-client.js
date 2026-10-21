/* A static deployment stays usable; a configured live provider never silently becomes a demo. */
(() => {
  let config;
  const ready = fetch("/api/config", { signal: AbortSignal.timeout(2500) })
    .then(async (r) => {
      if (!r.ok || !r.headers.get("content-type")?.includes("application/json"))
        return { mode: "static", checkout: false };
      const data = await r.json();
      return ["live", "demo"].includes(data.mode)
        ? data
        : { mode: "static", checkout: false };
    })
    .catch(() => ({ mode: "static", checkout: false }))
    .then((value) => {
      config = value;
      document.documentElement.dataset.apiMode = value.mode;
      const bar = document.querySelector(".demo-bar");
      if (value.mode === "live")
        bar.innerHTML =
          '<span class="live-dot"></span> Offres Duffel <span class="demo-detail">· Disponibilités vérifiées à la recherche · Paiement selon éligibilité</span>';
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
      signal: AbortSignal.timeout(28000),
    });
    if (!response.headers.get("content-type")?.includes("application/json"))
      throw new Error("Le service de réservation est indisponible.");
    const value = await response.json();
    if (!response.ok)
      throw new Error(value.error || "Service momentanément indisponible.");
    return value;
  }
  async function search(query) {
    await ready;
    if (config.mode === "static")
      return {
        source: "offline-demo",
        simulation: true,
        offers: FlightEngine.generate(query),
      };
    return request("/api/flights/search", query);
  }
  const cache = new Map();
  async function calendar(query) {
    await ready;
    const key = new URLSearchParams(query).toString();
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
    const value = await request("/api/flights/calendar?" + key);
    cache.set(key, value);
    return value;
  }
  window.FlightAPI = {
    ready,
    search,
    calendar,
    request,
    get mode() {
      return config?.mode;
    },
  };
})();
