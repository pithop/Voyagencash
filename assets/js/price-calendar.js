(() => {
  const F = FlightEngine,
    esc = BookingManager.escape;
  const today = () =>
    F.dateInZone(Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone);
  const maxDate = () =>
    new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  const monthName = (m) =>
    new Intl.DateTimeFormat("fr-FR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(m + "-01T12:00:00Z"));
  const shift = (m, n) => {
    const d = new Date(m + "-01T12:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + n);
    return d.toISOString().slice(0, 7);
  };
  const dialog = document.createElement("dialog");
  dialog.id = "price-calendar";
  dialog.className = "price-calendar";
  dialog.setAttribute("aria-labelledby", "calendar-title");
  document.body.append(dialog);
  let context,
    month,
    generation = 0,
    trigger;
  async function render() {
    const request = ++generation;
    dialog.innerHTML = `<div class="calendar-top"><div><span class="eyebrow">CALENDRIER DES PRIX</span><h2 id="calendar-title">${context.title || "Choisissez votre départ"}</h2><p>${esc(F.airport(context.from)?.city || context.from)} <span aria-hidden="true">→</span> ${esc(F.airport(context.to)?.city || context.to)} · prix par adulte, vol direct</p></div><button class="icon-button" data-calendar-close aria-label="Fermer le calendrier"><svg class="icon"><use href="#i-close"/></svg></button></div><div class="calendar-navigation"><button class="icon-button" data-month="-1" aria-label="Mois précédent" ${month <= today().slice(0, 7) ? "disabled" : ""}><svg class="icon flip"><use href="#i-chevron"/></svg></button><h3>${monthName(month)}</h3><button class="icon-button" data-month="1" aria-label="Mois suivant" ${month >= maxDate().slice(0, 7) ? "disabled" : ""}><svg class="icon"><use href="#i-chevron"/></svg></button></div><div class="calendar-week" aria-hidden="true">${["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => `<span>${d}</span>`).join("")}</div><div class="calendar-grid" aria-label="Jours du mois" aria-busy="true"></div><div class="calendar-legend"><span><i class="low"></i>Prix bas</span><span><i class="medium"></i>Prix moyen</span><span><i class="high"></i>Prix élevé</span></div><p class="calendar-disclaimer" role="status">Chargement des prix…</p>`;
    // Date buttons are available immediately, even when price retrieval is slow.
    const count = new Date(+month.slice(0, 4), +month.slice(5), 0).getDate();
    draw(
      Array.from({ length: count }, (_, i) => ({
        date: `${month}-${String(i + 1).padStart(2, "0")}`,
        price: null,
        tier: "unknown",
        direct: null,
      })),
    );
    try {
      const data = await FlightAPI.calendar({
        from: context.from,
        to: context.to,
        month,
        count: context.count || 1,
      });
      if (request !== generation || !dialog.open) return;
      const base = data.simulation ? F.calendar({ from: context.from, to: context.to, month }) : [];
      const days = (data.days || []).map((d) => {
        if (d.price !== null) return d;
        if (data.simulation) {
          const b = base.find((x) => x.date === d.date);
          if (b) return { ...b, indicative: true };
        }
        return d;
      });
      draw(days);
      dialog.querySelector(".calendar-disclaimer").textContent = data.simulation
        ? "Prix indicatifs de démonstration. Le tarif final est affiché dans les résultats."
        : "Prix observés ou indicatifs, à revalider. Sélectionnez un jour pour rechercher les vols.";
    } catch (e) {
      if (request === generation)
        dialog.querySelector(".calendar-disclaimer").textContent =
          e.message + " Vous pouvez choisir une date.";
    } finally {
      if (request === generation)
        dialog
          .querySelector(".calendar-grid")
          .setAttribute("aria-busy", "false");
    }
  }
  function draw(days) {
    const offset = (new Date(month + "-01T12:00:00Z").getUTCDay() + 6) % 7;
    const focused = dialog.contains(document.activeElement) ? document.activeElement.dataset.calendarDate : null;
    dialog.querySelector(".calendar-grid").innerHTML =
      '<span aria-hidden="true"></span>'.repeat(offset) +
      days
        .map((d) => {
          const disabled =
            d.date < (context.min || today()) || d.date > maxDate();
          const price =
            d.price === null
              ? "—"
              : new Intl.NumberFormat("fr-FR", {
                  style: "currency",
                  currency: "EUR",
                  maximumFractionDigits: 0,
                }).format(d.price);
          const label =
            d.price !== null
              ? `${F.money(d.price)}, ${{ low: "prix bas", medium: "prix moyen", high: "prix élevé" }[d.tier]}`
              : d.direct === false
                ? "aucun vol direct"
                : "prix à vérifier";
          return `<button type="button" class="calendar-day ${d.tier}${context.date === d.date ? " selected" : ""}" data-calendar-date="${d.date}" aria-label="${F.dateLabel(d.date, true)}, ${label}, ${d.priceKind === "quoted" ? "prix observé" : "prix indicatif"}" aria-pressed="${context.date === d.date}" ${disabled ? "disabled" : ""}><span>${Number(d.date.slice(-2))}</span><small class="day-price">${price}</small></button>`;
        })
        .join("");
    if (focused) dialog.querySelector(`[data-calendar-date="${focused}"]`)?.focus({ preventScroll: true });
  }
  dialog.addEventListener("click", (e) => {
    const day = e.target.closest("[data-calendar-date]");
    if (day) {
      const value = day.dataset.calendarDate;
      dialog.close();
      context.onSelect(value);
      return;
    }
    const nav = e.target.closest("[data-month]");
    if (nav) {
      month = shift(month, +nav.dataset.month);
      render();
    }
    if (e.target.closest("[data-calendar-close]")) dialog.close();
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        dialog.close();
    }
  });
  dialog.addEventListener("keydown", (e) => {
    if (!e.target.matches("[data-calendar-date]")) return;
    const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(e.key in steps)) return;
    e.preventDefault();
    const buttons = [...dialog.querySelectorAll("[data-calendar-date]")];
    const next = buttons[buttons.indexOf(e.target) + steps[e.key]];
    if (next && !next.disabled) next.focus();
  });
  dialog.addEventListener("close", () => {
    generation++;
    (document.getElementById(trigger?.id) || trigger)?.focus({
      preventScroll: true,
    });
  });
  window.PriceCalendar = {
    open(options) {
      context = options;
      trigger = document.activeElement;
      month = (options.date || options.min || today()).slice(0, 7);
      if (month < today().slice(0, 7)) month = today().slice(0, 7);
      dialog.showModal();
      render();
    },
  };
})();
