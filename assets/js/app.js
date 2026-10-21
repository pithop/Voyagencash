(() => {
  "use strict";
  const F = FlightEngine,
    B = BookingManager,
    $ = (s) => document.querySelector(s),
    $$ = (s) => [...document.querySelectorAll(s)],
    esc = B.escape;
  const icon = (name, cls = "") =>
    `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const localToday = () =>
    F.dateInZone(Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone);
  const addDays = (date, n) => {
    const d = new Date(date + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const initialDate = addDays(localToday(), 14);
  let search = {
    type: "roundtrip",
    count: 1,
    legs: [{ from: "CDG", to: "RAK", date: initialDate }],
    returnDate: addDays(initialDate, 7),
  };
  let draft = {
      search: null,
      flights: [],
      options: { baggage: false, guarantee: false },
      passengers: [],
      contact: { email: "", phone: "" },
    },
    legIndex = 0,
    offers = [],
    currentId = null,
    view = "search",
    filters = {},
    toastTimeout,
    searchGeneration = 0,
    activeAC = null;
  let storageError = null;
  try {
    const saved = B.loadDraft();
    if (
      saved?.search &&
      Array.isArray(saved.flights) &&
      Array.isArray(saved.passengers) &&
      saved.options &&
      saved.contact &&
      saved.search.legs?.every((l) => F.airport(l.from) && F.airport(l.to))
    ) {
      draft = saved;
      search = structuredClone(saved.search);
      currentId = saved.currentId || null;
      if (search.type === "roundtrip") {
        search.returnDate = search.legs[1].date;
        search.legs = search.legs.slice(0, 1);
      }
    }
    B.all();
  } catch (e) {
    storageError = e.message;
  }
  const safe = (fn) => {
    try {
      const result = fn();
      return result instanceof Promise ? result.catch(e => { toast(e.message, true); return null; }) : result;
    } catch (e) {
      toast(e.message, true);
      return null;
    }
  };
  function toast(message, error = false) {
    clearTimeout(toastTimeout);
    $("#toast").textContent = message;
    $("#toast").classList.toggle("error", error);
    $("#toast").hidden = false;
    toastTimeout = setTimeout(
      () => ($("#toast").hidden = true),
      error ? 9000 : 4500,
    );
  }
  function persist() {
    draft.currentId = currentId;
    B.saveDraft(draft);
  }
  function go(name) {
    if (location.hash === "#" + name) route();
    else location.hash = name;
  }
  function closeAutocomplete() {
    if (activeAC) {
      activeAC.list.hidden = true;
      activeAC.input.setAttribute("aria-expanded", "false");
      activeAC.input.removeAttribute("aria-activedescendant");
      activeAC = null;
    }
  }
  const airportLabel = (code) => {
    const a = F.airport(code);
    return a ? `${a.city} (${a.code})` : "";
  };
  function airportField(leg, side, index) {
    return `<div class="search-field"><label for="${side}-${index}">${side === "from" ? "Départ" : "Destination"}</label><input id="${side}-${index}" data-airport="${side}" data-leg="${index}" value="${esc(airportLabel(leg[side]))}" placeholder="Ville ou aéroport" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="suggest-${side}-${index}" autocomplete="off" required><div class="autocomplete" id="suggest-${side}-${index}" role="listbox" aria-label="Aéroports" hidden></div></div>`;
  }
  function renderSearch() {
    availabilityGeneration++;
    $("#search-availability").hidden = true;
    $$("#search-form [data-trip]").forEach((b) => {
      b.classList.toggle("active", b.dataset.trip === search.type);
      b.setAttribute("aria-pressed", String(b.dataset.trip === search.type));
    });
    $("#traveler-count").value = search.count;
    $("#add-leg").hidden = search.type !== "multi" || search.legs.length >= 4;
    $("#search-legs").innerHTML = search.legs
      .map(
        (l, i) =>
          `<div class="search-leg ${search.type === "roundtrip" ? "" : search.type}">${airportField(l, "from", i)}<button type="button" class="icon-button swap-button" data-swap="${i}" aria-label="Inverser le départ et la destination du trajet ${i + 1}">${icon("swap")}</button>${airportField(l, "to", i)}<div class="search-field"><label for="date-${i}">${search.type === "multi" ? `Date du trajet ${i + 1}` : "Date de départ"}</label><input type="date" id="date-${i}" data-date="${i}" value="${esc(l.date)}" min="${i ? search.legs[i - 1].date : localToday()}" max="${addDays(localToday(), 365)}" required></div>${search.type === "roundtrip" ? `<div class="search-field"><label for="return-date">Date de retour</label><input id="return-date" type="date" value="${esc(search.returnDate)}" min="${esc(l.date)}" max="${addDays(localToday(), 365)}" required></div>` : ""}${search.type === "multi" ? `<button class="icon-button remove-leg" type="button" data-remove-leg="${i}" aria-label="Supprimer le trajet ${i + 1}" ${search.legs.length <= 2 ? "disabled" : ""}>${icon("close")}</button>` : ""}</div>`,
      )
      .join("");
    $$("#search-legs input[type=date]").forEach(input => {
      input.setAttribute("aria-haspopup", "dialog");
      input.parentElement.classList.add("date-field");
      const caption=document.createElement("span");caption.className="date-caption";caption.textContent=F.dateLabel(input.value);caption.setAttribute("aria-hidden","true");input.after(caption);
      const fare = document.createElement("small");
      fare.className = "date-fare unknown";
      fare.textContent = "Prix à vérifier";
      input.parentElement.append(fare);
      const returning = input.id === "return-date";
      const leg = search.legs[returning ? 0 : +input.dataset.date];
      if (F.airport(leg.from) && F.airport(leg.to) && leg.from !== leg.to && input.value)
        FlightAPI.calendar({ from: returning ? leg.to : leg.from, to: returning ? leg.from : leg.to, month: input.value.slice(0, 7), count: search.count }).then(data => {
          if (!fare.isConnected) return;
          const day = data.days.find(d => d.date === input.value);
          fare.className = `date-fare ${day?.tier || "unknown"}`;
          fare.textContent = day?.price == null ? (day?.direct === false ? "Aucun vol direct" : "Prix à vérifier") : `Dès ${F.money(day.price)} / adulte`;
          fare.title = data.simulation ? "Prix indicatif de démonstration, vol direct" : "Prix indicatif observé, vol direct";
        }).catch(() => {});
      input.parentElement.addEventListener("click", e => { e.preventDefault(); openSearchCalendar(input); });
      input.addEventListener("keydown", e => { if (["Enter", " "].includes(e.key)) { e.preventDefault(); openSearchCalendar(input); } });
    });
    $$("[data-airport]").forEach((input) => {
      input.addEventListener("focus", () => showAutocomplete(input, true));
      input.addEventListener("input", () => {
        search.legs[+input.dataset.leg][input.dataset.airport] = "";
        availabilityGeneration++;
        $("#search-availability").hidden = true;
        $(".search-fares").hidden = true;
        showAutocomplete(input, false);
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          closeAutocomplete();
          return;
        }
        if (!activeAC || activeAC.input !== input) {
          if (e.key === "ArrowDown") showAutocomplete(input, false);
          else return;
        }
        if (["ArrowDown", "ArrowUp"].includes(e.key)) {
          e.preventDefault();
          const a = activeAC;
          a.index =
            (a.index + (e.key === "ArrowDown" ? 1 : -1) + a.items.length) %
            a.items.length;
          highlightAC();
        }
        if (e.key === "Enter" && activeAC?.items.length) {
          e.preventDefault();
          chooseAirport(activeAC.items[Math.max(0, activeAC.index)].code);
        }
        if (e.key === "Tab") closeAutocomplete();
      });
    });
    refreshSearchFares();
  }
  let availabilityGeneration = 0;
  function refreshSearchFares() {
    const leg = search.legs[0];
    const valid = F.airport(leg.from) && F.airport(leg.to) && leg.from !== leg.to && leg.date;
    $(".search-fares").hidden = !valid;
    if (valid) FareStrip.mount($("#search-fare-strip"), { ...leg, count: search.count }, date => {
      const input = $("#date-0"); input.value = date;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      refreshAvailability();
    });
  }
  async function refreshAvailability(fieldId) {
    const generation = ++availabilityGeneration;
    const selected = search.legs[0];
    const leg = fieldId === "return-date" ? { from: selected.to, to: selected.from, date: search.returnDate } : selected;
    if (!F.airport(leg.from) || !F.airport(leg.to) || leg.from === leg.to) return;
    const node = $("#search-availability");
    node.hidden = false;
    node.textContent = "Actualisation des vols…";
    try {
      const response = await FlightAPI.search({ ...leg, count: search.count });
      if (generation !== availabilityGeneration || view !== "search") return;
      const min = Math.min(...response.offers.map(f => f.price));
      node.textContent = response.offers.length
        ? `${response.offers.length} vols${response.simulation ? " de démonstration" : " disponibles"} · dès ${F.money(min)} par adulte. Lancez la recherche pour comparer.`
        : "Aucun vol trouvé à cette date. Essayez un autre jour.";
    } catch (error) {
      if (generation === availabilityGeneration) node.textContent = error.message;
    }
  }
  function openSearchCalendar(input) {
    closeAutocomplete();
    const returning = input.id === "return-date", i = returning ? 0 : +input.dataset.date;
    const leg = search.legs[i];
    PriceCalendar.open({ ...leg, from: returning ? leg.to : leg.from, to: returning ? leg.from : leg.to, date: input.value, min: input.min, count: search.count, title: returning ? "Choisissez votre retour" : "Choisissez votre départ", onSelect(date) {
      const field = document.getElementById(input.id); field.value = date; field.dispatchEvent(new Event("change", { bubbles: true }));
      const feedback = $("#search-error"); feedback.hidden = true;
      refreshAvailability(input.id);
    }});
  }
  function showAutocomplete(input, all) {
    closeAutocomplete();
    const list = $("#" + input.getAttribute("aria-controls"));
    const items = F.search(all ? "" : input.value);
    activeAC = { input, list, items, index: -1 };
    input.setAttribute("aria-expanded", "true");
    list.hidden = false;
    list.innerHTML = items.length
      ? items
          .map(
            (a, i) =>
              `<div class="airport-option" role="option" id="${list.id}-${i}" aria-selected="false" data-airport-choice="${a.code}">${icon("pin")}<span><strong>${esc(a.city)}</strong><small>${esc(a.name)} · ${esc(a.country)}</small></span><b>${a.code}</b></div>`,
          )
          .join("")
      : '<p class="autocomplete-empty">Aucun aéroport trouvé. Essayez une ville ou un code IATA.</p>';
  }
  function highlightAC() {
    if (!activeAC) return;
    [...activeAC.list.children].forEach((el, i) => {
      el.classList.toggle("selected", i === activeAC.index);
      el.setAttribute("aria-selected", String(i === activeAC.index));
      if (i === activeAC.index) {
        activeAC.input.setAttribute("aria-activedescendant", el.id);
        el.scrollIntoView({ block: "nearest" });
      }
    });
  }
  function chooseAirport(code) {
    if (!activeAC) return;
    const input = activeAC.input;
    search.legs[+input.dataset.leg][input.dataset.airport] = code;
    input.value = airportLabel(code);
    closeAutocomplete();
    renderSearch();
    document.getElementById(input.id).focus();
    closeAutocomplete();
    availabilityGeneration++;
    $("#search-availability").hidden = true;
  }
  $("#search-form").addEventListener("click", (e) => {
    const choice = e.target.closest("[data-airport-choice]");
    if (choice) {
      chooseAirport(choice.dataset.airportChoice);
      return;
    }
    const trip = e.target.closest("[data-trip]");
    if (trip) {
      closeAutocomplete();
      search.type = trip.dataset.trip;
      if (search.type === "multi" && search.legs.length === 1) {
        const l = search.legs[0];
        search.legs.push({
          from: l.to,
          to: l.from,
          date: search.returnDate || addDays(l.date, 7),
        });
      } else if (search.type !== "multi") {
        search.legs = search.legs.slice(0, 1);
      }
      renderSearch();
    }
    const swap = e.target.closest("[data-swap]");
    if (swap) {
      const l = search.legs[+swap.dataset.swap];
      [l.from, l.to] = [l.to, l.from];
      renderSearch();
    }
    const remove = e.target.closest("[data-remove-leg]");
    if (remove && search.legs.length > 2) {
      search.legs.splice(+remove.dataset.removeLeg, 1);
      renderSearch();
    }
  });
  $("#search-form").addEventListener("change", (e) => {
    if (e.target.matches("[data-date]")) {
      const i = +e.target.dataset.date;
      search.legs[i].date = e.target.value;
      if (!e.target.value) return;
      for (let j = i + 1; j < search.legs.length; j++) {
        if (search.legs[j].date < e.target.value)
          search.legs[j].date = e.target.value;
      }
      if (search.returnDate < search.legs[0].date)
        search.returnDate = search.legs[0].date;
      renderSearch();
    }
    if (e.target.id === "return-date") { search.returnDate = e.target.value; renderSearch(); }
    if (e.target.id === "traveler-count") { search.count = +e.target.value; renderSearch(); }
  });
  $("#add-leg").addEventListener("click", () => {
    if (search.legs.length < 4) {
      const last = search.legs.at(-1);
      search.legs.push({ from: last.to, to: "", date: addDays(last.date, 3) });
      renderSearch();
    }
  });
  $("#search-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    closeAutocomplete();
    $("#search-error").hidden = true;
    try {
      const legs = structuredClone(search.legs);
      if (search.type === "roundtrip")
        legs.push({
          from: legs[0].to,
          to: legs[0].from,
          date: search.returnDate,
        });
      legs.forEach((l, i) => {
        if (!F.airport(l.from) || !F.airport(l.to))
          throw new Error(
            `Trajet ${i + 1} : choisissez un aéroport dans les suggestions.`,
          );
        if (l.from === l.to)
          throw new Error(
            "Le départ et la destination doivent être différents.",
          );
        if (
          !l.date ||
          l.date < localToday() ||
          l.date > addDays(localToday(), 365) ||
          (i && l.date < legs[i - 1].date)
        )
          throw new Error(
            "Vérifiez les dates : elles doivent se suivre et être comprises dans les 12 prochains mois.",
          );
      });
      draft = {
        search: { ...structuredClone(search), legs },
        flights: [],
        options: { baggage: false, guarantee: false },
        passengers: [],
        contact: { email: "", phone: "" },
      };
      currentId = null;
      legIndex = 0;
      persist();
      filters = {};
      const generation = ++searchGeneration;
      const button = $(".search-submit");
      button.disabled = true;
      button.innerHTML =
        '<span class="spinner" style="width:17px;height:17px;margin:0"></span> Recherche des vols…';

      if (generation === searchGeneration && view === "search") go("results");
      button.disabled = false;
      button.innerHTML =
        icon("search") + ' Rechercher un vol <span aria-hidden="true">→</span>';
    } catch (err) {
      $("#search-error").textContent = err.message;
      $("#search-error").hidden = false;
    }
  });
  document.addEventListener("click", (e) => {
    if (activeAC && !e.target.closest(".search-field")) closeAutocomplete();
  });
  function progress(step) {
    return `<div class="journey-progress" aria-label="Étapes de réservation">${["Vols", "Options", "Passagers", "Paiement", "Billet"].map((s, i) => `<span class="${i === step ? "current" : i < step ? "done" : ""}" ${i === step ? 'aria-current="step"' : ""}>${i < step ? icon("check") : i + 1} ${s}</span>`).join('<span aria-hidden="true" style="padding:0;background:none">›</span>')}</div>`;
  }
  function summary() {
    const t = B.total(draft);
    return `<aside class="summary-panel" aria-label="Récapitulatif du voyage"><h2>Votre voyage, en un coup d’œil</h2>${draft.flights.map((f) => `<div class="summary-leg"><strong>${esc(F.airport(f.from).city)} → ${esc(F.airport(f.to).city)}</strong><small>${F.dateLabel(f.date)} · ${F.time(f.departure, f.from)} – ${F.time(f.arrival, f.to)}</small><small>${esc(f.airline.name)} · ${f.stops ? "1 escale" : "Direct"}</small></div>`).join("")}<div class="price-line"><span>Vols · ${draft.search.count} passager${draft.search.count > 1 ? "s" : ""}</span><strong>${F.money(t.flights)}</strong></div><div class="price-line"><span>Bagages en soute</span><strong>${t.baggage ? F.money(t.baggage) : "Non inclus"}</strong></div><div class="price-line"><span>Garantie annulation</span><strong>${t.guarantee ? F.money(t.guarantee) : "Non incluse"}</strong></div><div class="price-total"><span>Total TTC</span><strong>${F.money(t.total)}</strong></div><p>Prix simulé en euros, pour tous les passagers et trajets. Aucun débit réel.</p>${t.total > B.CASH_LIMIT ? `<p class="cash-limit-note">${icon("shield")} Au-delà de 1 000 €, choisissez la carte ou Apple Pay. Le règlement en espèces PayEnCash est indisponible (art. L.112-6 CMF).</p>` : ""}</aside>`;
  }
  function selectResultDate(date) {
    draft.search.legs[legIndex].date = date;
    draft.flights = draft.flights.slice(0, legIndex);
    for (let i = legIndex + 1; i < draft.search.legs.length; i++)
      if (draft.search.legs[i].date < date) draft.search.legs[i].date = date;
    search = structuredClone(draft.search);
    if (search.type === "roundtrip") {
      search.returnDate = search.legs[1].date;
      search.legs = search.legs.slice(0, 1);
    }
    persist();
    renderResults();
  }
  let resultsGeneration = 0;
  async function renderResults() {
    const generation = ++resultsGeneration;
    legIndex = Math.min(draft.flights.length, draft.search.legs.length - 1);
    const leg = draft.search.legs[legIndex];
    $("#results-content").innerHTML = `${progress(0)}<div class="results-loading" role="status"><span class="spinner"></span><h2>Recherche de vos vols</h2><p>Comparaison des horaires et des tarifs disponibles…</p></div>`;
    let response;
    try { response = await FlightAPI.search({ ...leg, count: draft.search.count }); }
    catch (error) {
      if (generation === resultsGeneration && view === "results") $("#results-content").innerHTML = `<div class="empty-state"><h1 id="results-title">La recherche n’a pas abouti.</h1><p>${esc(error.message)}</p><button class="button primary" data-action="reset-filters">Réessayer</button><a href="#search" class="button">Modifier la recherche</a></div>`;
      return;
    }
    if (generation !== resultsGeneration || view !== "results") return;
    offers = response.offers.filter(
      (f) =>
        !legIndex ||
        f.departure >= draft.flights[legIndex - 1].arrival + 120 * 60000,
    );
    const max = Math.max(100, ...offers.map((f) => f.price));
    filters = {
      max: Math.ceil(max / 50) * 50,
      direct: false,
      carriers: [],
      periods: [],
      sort: "best",
    };
    const carriers = [
      ...new Map(offers.map((f) => [f.airline.code, f.airline])).values(),
    ];
    $("#results-content").innerHTML =
      `${progress(0)}<div class="results-heading"><div><div class="eyebrow">${draft.search.type === "roundtrip" ? (legIndex ? "VOTRE VOL RETOUR" : "VOTRE VOL ALLER") : `TRAJET ${legIndex + 1} SUR ${draft.search.legs.length}`}</div><h1 id="results-title">${esc(F.airport(leg.from).city)} ${icon("arrow")} ${esc(F.airport(leg.to).city)}</h1><p>${F.dateLabel(leg.date, true)} · ${draft.search.count} passager${draft.search.count > 1 ? "s" : ""} · Économique</p></div><div class="booking-actions">${legIndex ? '<button class="button small" data-action="previous-leg">Modifier le vol précédent</button>' : ""}<a href="#search" class="button small">Modifier la recherche</a></div></div>${legIndex ? `<div class="notice">${icon("check")}<span>${legIndex} trajet${legIndex > 1 ? "s" : ""} sélectionné${legIndex > 1 ? "s" : ""} · ${draft.flights.map((f) => `${f.from} → ${f.to} à ${F.time(f.departure, f.from)}`).join(" · ")}</span></div>` : ""}<div class="date-explorer"><div><span class="eyebrow">VOS DATES, VOTRE BUDGET</span><strong>Choisissez le jour qui vous convient</strong></div><button class="button" data-action="result-calendar">${F.dateLabel(leg.date)} ${icon("chevron")}</button></div><div id="results-fare-strip" class="results-fares"></div><button class="button mobile-filter-button" data-action="open-filters">Filtres ${icon("menu")}</button><div class="results-layout"><aside class="filter-panel" id="result-filters"><button class="icon-button filter-close" data-action="close-filters" aria-label="Fermer les filtres">${icon("close")}</button><div><h2>Filtres</h2><button class="text-button" data-action="reset-filters">Réinitialiser</button></div><div class="filter-fields"><fieldset class="filter-group"><legend>Budget par passager</legend><input type="range" id="budget-filter" min="0" max="${filters.max}" step="1" value="${filters.max}" aria-label="Budget maximal par passager"><div class="budget-label"><span>0 €</span><output id="budget-output">${F.money(filters.max)}</output></div></fieldset><fieldset class="filter-group"><legend>Escales</legend><label><input type="checkbox" id="direct-filter"> Vols directs uniquement</label></fieldset><fieldset class="filter-group"><legend>Bagage cabine</legend><label><input type="checkbox" id="baggage-filter"> Valise cabine incluse</label></fieldset><fieldset class="filter-group"><legend>Heure de départ</legend>${[
        ["morning", "Matin · 06 h – 12 h"],
        ["afternoon", "Après-midi · 12 h – 18 h"],
        ["evening", "Soir · après 18 h"],
      ]
        .map(
          ([v, l]) =>
            `<label><input type="checkbox" name="period-filter" value="${v}">${l}</label>`,
        )
        .join(
          "",
        )}</fieldset><fieldset class="filter-group airline-filters"><legend>Compagnies aériennes</legend><div class="airline-checkboxes">${carriers.map((c) => `<label><input type="checkbox" name="carrier-filter" value="${c.code}">${esc(c.name)}</label>`).join("")}</div></fieldset></div></aside><div><div class="sort-bar"><span id="result-count" role="status"></span><label>Trier par <select id="sort-select"><option value="best">Meilleur rapport</option><option value="price">Prix croissant</option><option value="duration">Durée la plus courte</option></select></label></div><div id="flight-list"></div><p class="muted">${response.simulation ? "Offres de démonstration. Aucun billet réel." : "Offres Duffel. Prix et disponibilité à reconfirmer avant réservation."} Horaires locaux. Prix TTC par passager.</p></div></div>`;
    FareStrip.mount($("#results-fare-strip"), { ...leg, count: draft.search.count, min: legIndex ? draft.search.legs[legIndex - 1].date : localToday() }, selectResultDate);
    $("#results-content").oninput = (e) => {
      if (e.target.matches("input,select")) updateFilters();
    };
    $("#results-content").onchange = (e) => {
      if (e.target.matches("select")) updateFilters();
    };
    renderFlightList();
  }
  function updateFilters() {
    filters.max = +$("#budget-filter").value;
    filters.direct = $("#direct-filter").checked;
    filters.baggage = $("#baggage-filter").checked;
    filters.carriers = $$("[name=carrier-filter]:checked").map((e) => e.value);
    filters.periods = $$("[name=period-filter]:checked").map((e) => e.value);
    filters.sort = $("#sort-select").value;
    $("#budget-output").textContent = F.money(filters.max);
    renderFlightList();
  }
  function renderFlightList() {
    const list = F.filter(offers, filters);
    $("#result-count").textContent =
      `${list.length} vol${list.length > 1 ? "s" : ""} · ${offers[0]?.simulation !== false ? "démonstration" : "Duffel · tarifs vérifiés"}`;
    $("#flight-list").innerHTML = list.length
      ? list
          .map((f, i) => {
            const arrivalDate = F.dateInZone(f.arrival, F.airport(f.to).tz);
            const dayDiff = Math.round(
              (Date.parse(arrivalDate) - Date.parse(f.date)) / 86400000,
            );
            return `<article class="flight-card"><div class="flight-card-top"><span class="airline-badge" style="--carrier:${f.airline.color}">${["AF","AH","AT","TU","TO","FR","U2","TP","TK","VY"].includes(f.airline.code) ? `<img src="/assets/img/airlines/${f.airline.code}.svg" alt="${esc(f.airline.name)}">` : esc(f.airline.code)}</span><div><strong>${esc(f.airline.name)}</strong><small>${f.segments.map((s) => esc(s.number)).join(" · ")} · Économique</small></div>${i === 0 ? `<span class="badge">${filters.sort === "price" ? "Le moins cher" : filters.sort === "duration" ? "Le plus rapide" : "Notre sélection"}</span>` : ""}</div><div class="flight-card-body"><div class="flight-time"><strong>${F.time(f.departure, f.from)}</strong><span>${f.from} · ${esc(F.airport(f.from).city)}</span></div><div class="timeline"><span>${F.duration(f.duration)}</span><div class="timeline-line">${icon("plane")}</div><span>${f.stops ? `1 escale · ${f.segments[0].to}` : "Direct"}</span></div><div class="flight-time"><strong>${F.time(f.arrival, f.to)}${dayDiff ? ` <small>${dayDiff > 0 ? "+" : ""}${dayDiff} j</small>` : ""}</strong><span>${f.to} · ${esc(F.airport(f.to).city)}</span></div><div class="flight-price"><strong>${F.money(f.price)}</strong><small>TTC / passager${draft.search.count > 1 ? ` · ${F.money(f.price * draft.search.count)} au total` : ""}</small><button class="button primary" data-select-flight="${esc(f.id)}" aria-label="Choisir ${esc(f.airline.name)} à ${F.time(f.departure, f.from)}, ${F.money(f.price)}">Choisir ${icon("arrow")}</button></div></div><div class="flight-inclusions"><span>${icon("bag")} ${f.cabinBagIncluded ? "Valise cabine incluse" : "Cabine selon tarif"}</span>${f.co2Kg ? `<span>${icon("leaf")} ${f.co2Kg} kg CO2e ${f.simulation ? "· estimés" : "· fournisseur"}</span>` : ""}<span>${icon("clock")} ${f.simulation ? `${f.punctuality}% ponctualité · simulation` : "Ponctualité non disponible"}</span></div><details class="flight-details"><summary>Détails du vol & bagages</summary>${f.segments.map((s, n) => `<p><b>${esc(s.number)}</b> · ${s.from} ${F.time(s.departure, s.from)} → ${s.to} ${F.time(s.arrival, s.to)} · ${F.duration(s.duration)}${n < f.segments.length - 1 ? `<br>Escale à ${esc(F.airport(s.to).city)} : ${F.duration((f.segments[n + 1].departure - s.arrival) / 60000)}` : ""}</p>`).join("")}<p>${f.cabinBagIncluded ? "Valise cabine et petit sac inclus." : "Petit sac sous le siège inclus."} ${f.simulation ? "Soute 23 kg : +35 € par passager et trajet. Numéros de vol et disponibilités fictifs." : "Bagages, conditions tarifaires et retenue soumis à la compagnie. Aucun supplément local ne s’applique à une offre réelle."}</p></details></article>`;
          })
          .join("")
      : `<div class="empty-state">${icon("search")}<h2>Aucun vol pour cette sélection.</h2><p>${offers.length ? "Élargissez votre budget ou retirez un filtre." : "Essayez une autre date. Les trajets suivants doivent partir au moins deux heures après votre arrivée."}</p><button class="button" data-action="${offers.length ? "reset-filters" : "change-search"}">${offers.length ? "Réinitialiser les filtres" : "Modifier la recherche"}</button></div>`;
  }
  function renderOptions() {
    if (FlightAPI.checkout && draft.flights.some((f) => f.simulation === false)) {
      LiveBooking.mount($("#options-content"), draft).catch((e) =>
        toast(e.message, true),
      );
      return;
    }
    if (!FlightAPI.checkout) {
      draft.flights.forEach((f) => (f.simulation = true));
      persist();
    }
    $("#options-content").innerHTML =
      `${progress(1)}<div class="page-heading"><h1 id="options-title">Un voyage à votre mesure.</h1><p>Emportez ce qui compte. Tous les suppléments sont affichés ici.</p></div><div class="checkout-layout"><div><div class="panel"><h2>Vos bagages</h2><p>Ces options s’appliquent à chaque passager et à chaque trajet sélectionné.</p><div class="option-card">${icon("bag")}<span><strong>Un petit sac sous le siège</strong><small>Inclus pour chaque passager dans cette simulation.</small></span><span class="badge green">Inclus</span></div><label class="option-card">${icon("bag")}<span><strong>Bagage en soute · 23 kg</strong><small>35 € / passager / trajet · ${draft.search.count} × ${draft.flights.length} trajet(s)</small></span><b>+${F.money(35 * draft.search.count * draft.flights.length)}</b><input type="checkbox" id="baggage-option" ${draft.options.baggage ? "checked" : ""} aria-label="Ajouter le bagage en soute"></label></div><div class="panel"><h2>Un peu plus de tranquillité</h2><label class="option-card">${icon("shield")}<span><strong>Garantie annulation</strong><small>Option fictive · 19 € / passager pour tout le voyage. Aucun contrat d’assurance réel.</small></span><b>+${F.money(19 * draft.search.count)}</b><input type="checkbox" id="guarantee-option" ${draft.options.guarantee ? "checked" : ""} aria-label="Ajouter la garantie annulation"></label></div><div class="actions"><button class="text-button" data-action="reselect-last">← Modifier les vols</button><button class="button primary" data-action="to-passengers">Continuer vers les passagers ${icon("arrow")}</button></div></div><div id="options-summary">${summary()}</div></div>`;
    ["baggage", "guarantee"].forEach((k) =>
      $("#" + k + "-option").addEventListener("change", (e) =>
        safe(() => {
          draft.options[k] = e.target.checked;
          persist();
          $("#options-summary").innerHTML = summary();
        }),
      ),
    );
  }
  function passengerFields(p, i) {
    return `<section class="panel"><h2><span class="passenger-number">${i + 1}</span> Passager ${i + 1}</h2><p>Utilisez une identité fictive pour cette démonstration.</p><div class="form-grid"><label>Prénom<input id="p-first-${i}" name="firstName-${i}" value="${esc(p.firstName)}" autocomplete="off" minlength="2" maxlength="60" required></label><label>Nom<input id="p-last-${i}" name="lastName-${i}" value="${esc(p.lastName)}" autocomplete="off" minlength="2" maxlength="60" required></label><label>Date de naissance<input type="date" id="p-dob-${i}" name="birthDate-${i}" value="${esc(p.birthDate)}" min="1900-01-01" max="${localToday()}" required></label><label>Type de document<select id="p-doc-type-${i}" name="documentType-${i}"><option value="passport" ${p.documentType !== "id" ? "selected" : ""}>Passeport</option><option value="id" ${p.documentType === "id" ? "selected" : ""}>Carte nationale d’identité</option></select></label><label class="wide">Numéro de document (fictif)<input id="p-doc-${i}" name="document-${i}" value="${esc(p.document)}" autocomplete="off" minlength="5" maxlength="20" pattern="[A-Za-z0-9 \\-]{5,20}" placeholder="Ex. TEST12345" required></label></div></section>`;
  }
  function collectPassengers() {
    const form = $("#passengers-form");
    if (!form) return;
    const data = new FormData(form);
    draft.passengers = Array.from({ length: draft.search.count }, (_, i) =>
      Object.fromEntries(
        ["firstName", "lastName", "birthDate", "documentType", "document"].map(
          (k) => [k, String(data.get(`${k}-${i}`) || "").trim()],
        ),
      ),
    );
    draft.contact = {
      email: String(data.get("email") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
    };
  }
  function renderPassengers() {
    $("#passengers-content").innerHTML =
      `${progress(2)}<div class="page-heading"><h1 id="passengers-title">Qui embarque avec nous ?</h1><p>Renseignez les passagers et les coordonnées de votre réservation.</p></div><div class="checkout-layout"><form id="passengers-form">${Array.from({ length: draft.search.count }, (_, i) => passengerFields(draft.passengers[i] || {}, i)).join("")}<section class="panel"><h2>Vos coordonnées</h2><p>Aucun message ne sera envoyé. Les données restent sur ce navigateur.</p><div class="form-grid"><label>Adresse e-mail<input type="email" id="contact-email" name="email" value="${esc(draft.contact.email)}" placeholder="prenom@example.test" autocomplete="off" maxlength="150" required></label><label>Téléphone<input type="tel" id="contact-phone" name="phone" value="${esc(draft.contact.phone)}" placeholder="06 00 00 00 00" autocomplete="off" maxlength="22" required></label></div></section><label class="consent"><input type="checkbox" id="passenger-consent" required><span>Je confirme les informations saisies et comprends qu’il s’agit d’une simulation. Mes données fictives seront enregistrées sur ce navigateur.</span></label><p id="passenger-error" class="form-error" role="alert" hidden></p><div class="actions"><a class="text-button" href="#options">← Options</a><button class="button primary" id="confirm-booking" type="submit">Continuer vers le paiement ${icon("arrow")}</button></div></form>${summary()}</div>`;
    $("#passengers-form").addEventListener("input", () => {
      collectPassengers();
    });
    $("#passengers-form").addEventListener("submit", (e) => {
      e.preventDefault();
      try {
        collectPassengers();
        B.validatePassengers(
          draft.passengers,
          draft.contact,
          draft.flights[0].date,
        );
        persist();
        go("payment");
      } catch (err) {
        $("#passenger-error").textContent = err.message;
        $("#passenger-error").hidden = false;
      }
    });
  }
  function renderPayment() {
    const existing = currentId ? B.get(currentId) : null;
    if (existing?.status === "confirmed") {
      go("confirmation");
      return;
    }
    if (existing) {
      renderPending(existing);
      return;
    }
    $("#payment-content").innerHTML =
      `${progress(3)}<div class="page-heading"><h1 id="payment-title">Payez à votre façon.</h1><p>La dernière étape avant votre e-billet de démonstration.</p></div><div class="checkout-layout"><div class="panel"><h2>Choisissez votre mode de paiement</h2><div class="payment-methods">${[
        [
          "voucher",
          "wallet",
          "PayEnCash · en espèces",
          "Paiement en espèces · bon valable 120 minutes",
        ],
        [
          "card",
          "card",
          "Carte bancaire",
          "Carte de test · authentification 3D Secure simulée",
        ],
        ["apple", "apple", "Apple Pay", "Simulation du paiement express"],
      ]
        .map(
          ([v, ic, title, desc]) =>
            `<label class="payment-choice">${icon(ic)}<span><strong>${title}</strong><small>${desc}</small></span><input id="${{voucher: "pay-voucher-trigger", card: "card-pay", apple: "apple-pay"}[v]}" type="radio" name="payment-method" value="${v}" ${v === "voucher" ? "checked" : ""}></label>`,
        )
        .join(
          "",
        )}</div>${B.total(draft).total > B.CASH_LIMIT ? `<div class="notice amber" role="alert">${icon("shield")}<span>Votre panier dépasse 1 000 €. Le paiement en espèces PayEnCash est indisponible (art. L.112-6 et D.112-3 CMF). Choisissez la carte ou Apple Pay.</span></div>` : ""}<div id="payment-detail"></div><label class="consent"><input type="checkbox" id="payment-consent"><span>J’accepte de créer une réservation fictive. Aucun billet réel ne sera émis et aucun montant ne sera débité.</span></label><button class="button primary full" data-action="pay" id="pay-button">Générer mon bon PayEnCash ${icon("arrow")}</button><div class="actions"><a href="#passengers" class="text-button">← Passagers</a><span class="muted">${icon("shield")} Démonstration sans débit</span></div></div>${summary()}</div>`;
    $$("[name=payment-method]").forEach((el) =>
      el.addEventListener("change", renderPaymentDetail),
    );
    renderPaymentDetail();
  }
  function renderPaymentDetail() {
    const method = $("[name=payment-method]:checked").value;
    $("#payment-detail").innerHTML =
      method === "voucher"
        ? `<div class="payment-detail"><strong>Un bon. Deux heures. Votre liberté.</strong><p>Bon prépayé partenaire AJEK / PayEnCash · 120 minutes pour rejoindre un point de vente. Plafond : 1 000 € en espèces. Le QR code de cette démonstration ne peut pas être encaissé.</p></div>`
        : method === "card"
          ? '<div class="payment-detail"><strong>Votre carte de test est prête.</strong><div class="test-card"><span>CARTE DE DÉMONSTRATION</span><strong>4242 4242 4242 4242</strong><span>12 / 30 &nbsp; · &nbsp; CVC 123 &nbsp; · &nbsp; TEST</span></div><p>Aucune coordonnée bancaire réelle n’est nécessaire. L’étape suivante simule la validation 3D Secure.</p></div>'
          : '<div class="payment-detail"><strong>Apple Pay · mode démonstration</strong><p>Une fenêtre de confirmation simulera l’autorisation du paiement. Aucun portefeuille ni compte Apple n’est utilisé.</p></div>';
    const overLimit = B.total(draft).total > B.CASH_LIMIT;
    $("#pay-voucher-trigger").disabled = overLimit;
    $("#pay-button").disabled = method === "voucher" && overLimit;
    $("#pay-button").innerHTML =
      (method === "voucher"
        ? "Générer mon bon PayEnCash"
        : `Simuler le paiement de ${F.money(B.total(draft).total)}`) +
      " " +
      icon("arrow");
  }
  function travelPass(r) {
    const f = r.flights[0];
    const stateText = r.status === "confirmed" ? "ÉMISSION CONFIRMÉE" : r.status === "pending" ? "VOTRE PLACE VOUS ATTEND" : "RÉSERVATION CLÔTURÉE";
    return `<article class="travel-pass" tabindex="0" aria-label="Pass de voyage interactif">
      <div class="travel-pass-top"><span class="airline-badge" style="--carrier:${f.airline.color}">${f.airline.code}</span><div><strong>${esc(f.airline.name)}</strong><small>${f.segments.map(s => esc(s.number)).join(" · ")} · ${esc(f.cabin)}</small></div><span class="pass-edition">TRAVEL PASS / 01</span></div>
      <div class="travel-pass-route"><div><span>${esc(F.airport(f.from).city)}</span><b>${f.from}</b><strong>${F.time(f.departure, f.from)}</strong><small>Terminal ${esc(f.departureTerminal || "1")} · simulé</small></div><div class="route-drawing">${icon("flight")}<span>${F.duration(f.duration)}</span><small>${f.stops ? "1 escale" : "Vol direct"}</small></div><div><span>${esc(F.airport(f.to).city)}</span><b>${f.to}</b><strong>${F.time(f.arrival, f.to)}</strong><small>Terminal ${esc(f.arrivalTerminal || "1")} · simulé</small></div></div>
      <div class="travel-pass-details"><div><small>PASSAGER PRINCIPAL</small><strong>${esc(r.passengers[0].firstName)} ${esc(r.passengers[0].lastName)}</strong></div><div><small>DÉPART</small><strong>${F.dateLabel(f.date)}</strong></div><div><small>PNR SIMULÉ</small><strong class="pnr">${esc(r.pnr || r.id.slice(-6))}</strong></div></div>
      <div class="departure-gauge"><div><span>${icon("clock")} <span data-departure-label></span></span><small>${r.flights.length} trajet(s) · ${r.passengers.length} passager(s)</small></div><progress data-departure-progress max="100" value="0" aria-label="Progression vers le départ"></progress></div>
      <div class="pass-security"><span class="live-dot"></span>${stateText}<span>SPÉCIMEN · NON VALABLE POUR VOYAGER</span></div>
    </article>`;
  }
  function insights(r) {
    const f = r.flights[0], airport = F.airport(f.to);
    return `<div class="insights-grid">
      <article class="insight weather-cell"><div class="insight-label">${icon("sun")} À L’ARRIVÉE <span>${f.to}</span></div><div class="insight-value" id="arrival-weather">— <small>°C</small></div><strong>${esc(airport.city)} <span data-local-clock="${f.to}">${F.time(Date.now(), f.to)}</span></strong><p id="weather-description">Météo actuelle à destination</p><button class="text-button" data-weather="${f.to}">Actualiser la météo ${icon("arrow")}</button></article>
      <article class="insight"><div class="insight-label">${icon("radar")} FLIGHT INTELLIGENCE</div><div class="insight-value">${f.punctuality || 94}<small>%</small><span class="signal-bars"><i></i><i></i><i></i><i></i><i></i></span></div><strong>Vol ponctuel à ${f.punctuality || 94}%</strong><p>Risque de retard très faible</p><small class="data-note">Indicateur de démonstration · sans suivi réel</small></article>
      <article class="insight co2-cell"><div class="insight-label">${icon("leaf")} UNE EMPREINTE PLUS LÉGÈRE</div><div class="insight-value">${f.co2Kg || 142}<small> kg</small></div><strong>CO2e / passager</strong><p><span class="positive">${f.co2VsAverage ?? -18}% vs moyenne simulée</span></p><small class="data-note">Estimation distance × facteur · hors traînées</small></article>
      <article class="insight freeze-cell"><div class="insight-label">${icon("lock")} PRICE FREEZE</div><div class="insight-value">120<small> min</small></div><strong>Votre prix garde les pieds sur terre.</strong><p>Gel de tarif inclus, sans débit pendant la réservation.</p><button class="text-button" data-action="freeze-details">Comprendre la garantie ${icon("arrow")}</button></article>
    </div>`;
  }
  function nearbyPreview(r) {
    const origin = geoPosition || F.airport(r.flights[0].from);
    const nearest = [...stores].sort((a,b) => F.distance(origin,a) - F.distance(origin,b)).slice(0,3);
    return `<section class="nearby-preview"><div class="nearby-heading"><div><span class="eyebrow">LE VOYAGE COMMENCE TOUT PRÈS</span><h3>Votre prochain point de passage.</h3></div>${icon("pin")}</div><p>Points illustratifs · distances à vol d’oiseau depuis ${geoPosition ? "votre position" : esc(origin.city) + " " + origin.code}</p>${nearest.map(s => `<a href="#stores" class="nearby-row"><span class="nearby-icon">${icon("pin")}</span><span><strong>${esc(s.name)}</strong><small>${esc(s.area)} · ${esc(s.city)}</small></span><span>${Math.round(F.distance(origin,s))} km ${icon("chevron")}</span></a>`).join("")}<a href="#stores" class="text-button">Localiser les points avec mon GPS ${icon("arrow")}</a></section>`;
  }
  function renderPending(r) {
    $("#payment-content").innerHTML = `${progress(3)}<div class="page-heading dashboard-heading"><div><div class="eyebrow">VOTRE VOYAGE PREND FORME</div><h1 id="payment-title">Prochain arrêt : <span>${esc(F.airport(r.flights[0].to).city)}.</span></h1><p>Votre réservation est conservée. Il ne reste que le paiement.</p></div><span class="badge green">${icon("lock")} Tarif gelé · simulation</span></div>
    <div class="bento-grid"><div class="bento-main">${travelPass(r)}<div class="hold-steps"><span class="done">${icon("check")} Vol sélectionné</span><span class="current">${icon("clock")} Paiement attendu</span><span>${icon("ticket")} Billet à émettre</span></div><div class="hold-note">${icon("shield")} <p>Retrouvez ce voyage à tout moment dans <a href="#bookings">Mes réservations</a>. Votre place est retenue pendant 120 minutes dans cette simulation.</p></div>${r.flights.length > 1 ? `<div class="next-legs">${r.flights.slice(1).map(f => `<p>${icon("plane")} <strong>${f.from} → ${f.to}</strong><span>${F.dateLabel(f.date)} · ${F.time(f.departure,f.from)} · ${esc(f.airline.name)}</span></p>`).join("")}</div>` : ""}${r.method === "voucher" ? nearbyPreview(r) : ""}</div>
    <aside class="panel voucher-center"><div class="payment-panel-heading"><span class="eyebrow">${r.method === "voucher" ? "VOTRE BON PRÉPAYÉ" : "VOTRE PAIEMENT"}</span><span class="badge">Simulation</span></div><h2>${r.method === "voucher" ? "PayEnCash" : r.method === "apple" ? "Apple Pay" : "Carte bancaire"}<span class="pay-brand-dot">.</span></h2><p>${r.method === "voucher" ? "Le dernier pas vers votre prochain départ." : "Autorisez votre paiement pour confirmer le voyage."}</p>
    ${r.method === "voucher" ? B.qr(`DEMO|BON-VGC-${r.id.slice(4)}|${r.voucher}|${r.voucherToken || r.id}`) + `<div class="voucher-code">${esc(r.voucher)}</div><div class="voucher-actions"><button class="text-button" data-action="copy-voucher">Copier la référence</button><button class="text-button" data-action="print-voucher">Imprimer / PDF</button></div>` : ""}
    <div class="countdown"><div class="countdown-ring"><svg viewBox="0 0 80 80" aria-hidden="true"><circle class="ring-track" cx="40" cy="40" r="34"/><circle id="timer-ring" cx="40" cy="40" r="34" pathLength="100"/></svg>${icon("clock")}</div><div><small>VOTRE TEMPS POUR PAYER</small><span id="voucher-timer" role="timer" aria-label="Temps restant"></span><small id="timer-warning">Votre tarif reste identique.</small></div></div>
    <div class="voucher-total"><span>Montant à régler</span><strong>${F.money(r.total)}</strong></div>
    ${r.method === "voucher" ? `<a class="button primary full" href="#stores">${icon("pin")} Trouver un point PayEnCash ${icon("arrow")}</a>` : ""}
    <button class="button full ${r.method === "voucher" ? "" : "primary"}" id="validate-payment" data-action="${r.method === "voucher" ? "validate-voucher" : "resume-payment"}">${r.method === "voucher" ? "Simuler la validation en caisse" : "Reprendre le paiement simulé"} ${icon("check")}</button><p id="pending-status">Bon de démonstration, non encaissable. Aucun débit réel.</p>
    ${r.method === "voucher" ? `<div class="voucher-legal">Cadre modélisé · <a href="#faq">Conditions du bon</a><br>AJEK / PayEnCash · Bon partenaire · L.521-3 CMF<br>Qualification BUM à valider · art. 256 ter CGI<br>Espèces : 1 000 € maximum par transaction</div>` : ""}
    <button class="text-button cancel-link" id="cancel-booking" data-cancel="${r.id}">Annuler cette réservation</button></aside></div>${insights(r)}`;
    updateTimer(); updateTravelClock();
  }
  function updateTimer() {
    const timer = $("#voucher-timer");
    if (view !== "payment" || !timer || !currentId) return;
    safe(() => {
      const r = B.get(currentId);
      const remaining = Math.max(0, r.expiresAt - Date.now());
      const seconds = Math.ceil(remaining / 1000);
      timer.textContent = remaining
        ? `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")} s restantes`
        : "Bon expiré";
      const expired = remaining === 0 || r.status !== "pending";
      const urgent = seconds > 0 && seconds < 900 && !expired;
      $(".countdown").classList.toggle("urgent", urgent);
      $(".countdown").classList.toggle("expired", expired);
      $("#timer-ring").style.strokeDashoffset = String(100 - Math.min(100, seconds / B.HOLD_SECONDS * 100));
      $("#timer-warning").textContent = expired ? "Votre réservation est clôturée." : urgent ? "Moins de 15 minutes pour régler votre bon." : "Votre tarif reste identique.";
      $("#validate-payment").disabled = expired;
      if (expired)
        $("#pending-status").textContent =
          r.status === "cancelled"
            ? "Réservation annulée. Lancez une nouvelle recherche."
            : "Le délai est écoulé. Lancez une nouvelle recherche pour obtenir un nouveau bon.";
    });
  }
  function openDialog(html, wide = false) {
    $("#app-dialog").classList.toggle("wide", wide);
    $("#dialog-content").innerHTML = html;
    $("#app-dialog").showModal();
  }
  function authDialog(r) {
    openDialog(
      `<div class="secure-icon">${icon(r.method === "card" ? "shield" : "wallet")}</div><h2 id="dialog-title">${r.method === "card" ? "Authentification 3D Secure" : "Autoriser avec Apple Pay"}</h2><span class="badge">Simulation</span><p style="margin-top:16px">${r.method === "card" ? "Confirmez le paiement avec la carte de test se terminant par 4242." : "Confirmez ce paiement fictif. Aucun portefeuille Apple Pay réel n’est sollicité."}</p><div class="dialog-total">${F.money(r.total)}</div><p>Marchand : voyagencash · Aucun débit</p><div class="actions"><button class="button" data-action="decline-payment">Refuser</button><button class="button primary" data-action="authorize-payment">Autoriser la simulation</button></div>`,
    );
  }
  function finishPayment() {
    const r = B.confirm(currentId);
    haptic();
    safe(() => persist());
    $("#app-dialog").close();
    go("confirmation");
    toast(`Réservation ${r.id} confirmée en mode démonstration.`);
  }
  function renderConfirmation() {
    const r = B.get(currentId);
    $("#confirmation-content").innerHTML = `${progress(4)}<div class="confirmation-heading"><div class="success-icon">${icon("check")}</div><div class="eyebrow">LE VOYAGE EST À VOUS</div><h1 id="confirmation-title">L’ailleurs n’attend plus que vous.</h1><p>Réservation simulée confirmée. Votre pass est enregistré sur ce navigateur.</p></div><div class="bento-grid"><div class="bento-main">${travelPass(r)}</div><aside class="panel wallet-panel"><div class="eyebrow">VOTRE VOYAGE, AVEC VOUS</div>${icon("ticket")}<h2>Prêt à vous suivre.</h2><p>Gardez votre pass à portée de main.</p><button class="button primary full" data-download="${r.id}">${icon("download")} Télécharger l’e-billet</button><button class="button full" data-wallet="${r.id}">${icon("apple")} Ajouter à Apple Wallet</button><small>Export .pkpass simulé, non signé et non importable.</small><button class="text-button" data-print="${r.id}">Imprimer / PDF ${icon("arrow")}</button><a href="#bookings" class="text-button">Mes réservations</a></aside></div>${insights(r)}<details class="ticket-details" open><summary>Vos documents de voyage · ${r.passengers.length} passager(s)</summary>${B.ticketHTML(r)}</details>`;
    $("#print-area").innerHTML = B.ticketHTML(r);
    updateTravelClock();
  }
  const statusLabel = {
    pending: "En attente de paiement",
    confirmed: "Simulation confirmée",
    cancelled: "Annulée",
    expired: "Expirée",
  };
  function renderBookings() {
    const records = B.all();
    $("#bookings-content").innerHTML = records.length
      ? `<div class="notice">${icon("shield")}<span>Ces réservations sont stockées uniquement sur ce navigateur. Les billets sont fictifs et ne permettent pas de voyager.</span></div>${records.map((r) => `<article class="booking-card"><div class="booking-top"><strong>${esc(r.id)}</strong><span class="badge ${r.status === "confirmed" ? "green" : r.status === "cancelled" ? "red" : r.status === "expired" ? "gray" : ""}">${statusLabel[r.status] || "Indisponible"}</span></div><h2>${r.flights.map((f, i) => `${i ? " · " : ""}${esc(F.airport(f.from).city)} → ${esc(F.airport(f.to).city)}`).join("")}</h2><p>${F.dateLabel(r.flights[0].date, true)} · ${r.passengers.length} passager${r.passengers.length > 1 ? "s" : ""} · ${r.method === "voucher" ? "Bon d’achat" : r.method === "apple" ? "Apple Pay" : "Carte bancaire"}</p><div class="booking-bottom"><strong>${F.money(r.total)}</strong><div class="booking-actions">${r.status === "pending" ? `<button class="button primary small" data-resume="${r.id}">${r.method === "voucher" ? "Voir mon bon" : "Reprendre le paiement"}</button>` : ""}${["confirmed", "cancelled"].includes(r.status) ? `<button class="button small" data-view-ticket="${r.id}">Voir le billet</button><button class="button small" data-download="${r.id}">${icon("download")} Télécharger</button>` : ""}${["confirmed", "pending"].includes(r.status) ? `<button class="button small danger" data-cancel="${r.id}">Annuler</button>` : ""}${r.status === "expired" ? '<a class="button small" href="#search">Nouvelle recherche</a>' : ""}</div></div></article>`).join("")}`
      : `<div class="empty-state">${icon("ticket")}<h2>Votre prochaine histoire reste à écrire.</h2><p>Vos réservations et bons de paiement apparaîtront ici. Commençons par trouver votre prochain vol.</p><a href="#search" class="button primary">Rechercher un vol ${icon("arrow")}</a></div>`;
  }
  const stores = [
    {
      id: 1,
      name: "Tabac Presse République",
      city: "Paris",
      zip: "75011",
      area: "12 boulevard du Temple",
      hours: "Lun–sam · 9 h – 19 h",
      x: 24,
      y: 38,
    },
    {
      id: 2,
      name: "Le Kiosque Saint-Charles",
      city: "Marseille",
      zip: "13001",
      area: "8 boulevard d’Athènes",
      hours: "Lun–sam · 10 h – 19 h",
      x: 65,
      y: 55,
    },
    {
      id: 3,
      name: "Tabac Presse Part-Dieu",
      city: "Lyon",
      zip: "69003",
      area: "17 rue de la Villette",
      hours: "Lun–ven · 9 h – 18 h",
      x: 43,
      y: 28,
    },
    {
      id: 4,
      name: "Le Comptoir du Capitole",
      city: "Toulouse",
      zip: "31000",
      area: "6 rue du Taur",
      hours: "Lun–sam · 9 h – 18 h",
      x: 31,
      y: 69,
    },
    {
      id: 5,
      name: "Tabac Presse Wazemmes",
      city: "Lille",
      zip: "59000",
      area: "31 rue Léon Gambetta",
      hours: "Mar–sam · 10 h – 19 h",
      x: 77,
      y: 23,
    },
    {
      id: 6,
      name: "Le Kiosque Gambetta",
      city: "Bordeaux",
      zip: "33000",
      area: "14 place Gambetta",
      hours: "Lun–sam · 9 h – 19 h",
      x: 66,
      y: 77,
    },
  ];
  stores.push({ id: 7, name: "Tabac Presse Jean-Médecin", city: "Nice", zip: "06000", area: "22 avenue Jean-Médecin", hours: "Lun–sam · 8 h – 19 h 30", x: 82, y: 66 });
  const storeCoordinates = [[48.866,2.365],[43.299,5.379],[45.759,4.863],[43.605,1.443],[50.627,3.05],[44.841,-0.58],[43.702,7.267]];
  stores.forEach((store, i) => { [store.lat, store.lon] = storeCoordinates[i]; store.estimatedKm = [0.7,0.4,0.8,0.3,1.2,0.6,0.5][i]; });
  let geoPosition = null;
  let activeStore = 1, partnerStores = false;
  FlightAPI.ready.then(async config => {
    if(config.mode !== "live") return;
    stores.length=0;
    $("#view-stores .notice span").textContent="Chargement de l’annuaire partenaire…";
    try {
      const data=await FlightAPI.request('/api/payencash/stores');partnerStores=data.source==='partner';stores.push(...data.stores);
      $("#view-stores .notice span").textContent=partnerStores?"Points fournis par le partenaire. Vérifiez les horaires avant votre déplacement.":"L’annuaire partenaire n’est pas encore disponible. Aucun point fictif n’est présenté comme partenaire.";
      $("#view-stores .notice.subtle").textContent="Présentez un bon valide au commerçant et respectez son échéance. Un billet n’est émis qu’après confirmation du paiement.";
    } catch { $("#view-stores .notice span").textContent="Annuaire momentanément indisponible. Réessayez plus tard."; }
    if(view==='stores')renderStores();
  });
  function renderStores() {
    const q = $("#store-search").value.trim().toLowerCase();
    const matched = stores.filter(
      (s) =>
        `${s.city} ${s.zip} ${s.name}`.toLowerCase().includes(q) ||
        (/^\d{5}$/.test(q) &&
          q.endsWith("000") &&
          s.zip.slice(0, 2) === q.slice(0, 2)),
    );
    if (geoPosition) matched.sort((a, b) => F.distance(geoPosition, a) - F.distance(geoPosition, b));
    if (!matched.some((s) => s.id === activeStore))
      activeStore = matched[0]?.id;
    $("#store-list").innerHTML = matched.length
      ? matched
          .map(
            (s) =>
              `<button class="store-item ${s.id === activeStore ? "active" : ""}" data-store="${s.id}" aria-pressed="${s.id === activeStore}"><strong>${s.id}. ${esc(s.name)}</strong><p>${esc(s.area)} · ${esc(s.zip)} ${esc(s.city)}</p><small>${esc(s.hours)} · indicatifs</small><span class="store-distance">${icon("pin")} ${geoPosition ? F.distance(geoPosition, s).toFixed(1) + " km à vol d’oiseau" : partnerStores ? "Activer le GPS pour la distance" : s.estimatedKm + " km estimés du centre"}</span></button>`,
          )
          .join("")
      : '<div class="empty-state"><h2>Aucun point démo trouvé.</h2><p>Essayez Paris, Marseille, Lyon, Toulouse, Nice, Lille ou Bordeaux.</p></div>';
    if(FlightAPI.mode === "live") {
      const map=$(".locator-map"),selected=matched.find(s=>s.id===activeStore);
      map.setAttribute('aria-label','Localisation du point partenaire');
      map.innerHTML=selected ? `<iframe title="Carte du point partenaire" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=${selected.lon-.03},${selected.lat-.02},${selected.lon+.03},${selected.lat+.02}&layer=mapnik&marker=${selected.lat},${selected.lon}"></iframe>` : '<p class="empty-state">Sélectionnez un point partenaire disponible.</p>';
      if(!matched.length)$("#store-list").innerHTML='<div class="empty-state"><h2>Aucun point disponible.</h2><p>Essayez une autre ville ou réessayez plus tard.</p></div>';
      return;
    }
    $("#map-pins").innerHTML = matched
      .map(
        (s) =>
          `<button class="map-pin ${s.id === activeStore ? "active" : ""}" style="left:${s.x}%;top:${s.y}%" data-store="${s.id}" aria-label="${s.name}" aria-pressed="${s.id === activeStore}"><span>${s.id}</span></button>`,
      )
      .join("");
  }
  function resume(id) {
    const r = B.get(id);
    if (!r || r.status !== "pending")
      throw new Error("Cette réservation n’est plus en attente.");
    currentId = id;
    draft = {
      search: {
        type: r.flights.length === 1 ? "oneway" : "multi",
        count: r.passengers.length,
        legs: r.flights.map((f) => ({ from: f.from, to: f.to, date: f.date })),
      },
      flights: r.flights,
      passengers: r.passengers,
      contact: r.contact,
      options: r.options,
    };
    persist();
    go("payment");
  }
  document.addEventListener("click", (e) =>
    safe(async () => {
      const b = e.target.closest("button,a");
      if (!b) return;
      if (b.dataset.destination) {
        search.legs[0].to = b.dataset.destination;
        if (search.legs[0].from === b.dataset.destination)
          search.legs[0].from = "CDG";
        renderSearch();
        $("#search-form").scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        $("#date-0").focus({ preventScroll: true });
      }
      if (b.dataset.selectFlight) {
        const f = offers.find((f) => f.id === b.dataset.selectFlight);
        if (!f) return;
        const flightToSave = FlightAPI.checkout ? f : { ...f, simulation: true };
        draft.flights = draft.flights.slice(0, legIndex);
        draft.flights.push(flightToSave);
        persist();
        if (draft.flights.length < draft.search.legs.length) {
          renderResults();
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else go("options");
      }
      if (b.dataset.download) B.download(b.dataset.download);
      if (b.dataset.wallet) { B.wallet(b.dataset.wallet); toast("Spécimen .pkpass exporté. La signature Apple est nécessaire pour l’import Wallet."); }
      if (b.dataset.weather) refreshWeather(b.dataset.weather);
      if (b.id === "locate-stores") locateStores();
      if (b.dataset.print) {
        const r = B.get(b.dataset.print);
        $("#print-area").innerHTML = B.ticketHTML(r);
        window.print();
      }
      if (b.dataset.viewTicket) {
        const r = B.get(b.dataset.viewTicket);
        openDialog(
          `<h2 id="dialog-title">Votre e-billet de démonstration</h2>${B.ticketHTML(r)}<div class="center-actions"><button class="button primary" data-download="${r.id}">Télécharger</button><button class="button" data-print="${r.id}">Imprimer / PDF</button></div>`,
          true,
        );
      }
      if (b.dataset.cancel) {
        const r = B.get(b.dataset.cancel);
        openDialog(
          `<h2 id="dialog-title">Annuler cette réservation ?</h2><p>La réservation ${esc(r.id)} sera marquée comme annulée. Cette action est définitive pour cette simulation. Aucun montant n’a été débité et aucun remboursement réel ne sera effectué.</p><div class="actions"><button class="button" data-action="close-dialog">Conserver</button><button class="button danger" data-confirm-cancel="${r.id}">Confirmer l’annulation</button></div>`,
        );
      }
      if (b.dataset.confirmCancel) {
        B.cancel(b.dataset.confirmCancel);
        $("#app-dialog").close();
        toast("La réservation a été annulée.");
        go("bookings");
      }
      if (b.dataset.resume) resume(b.dataset.resume);
      if (b.dataset.store) {
        activeStore = +b.dataset.store;
        renderStores();
      }
      const action = b.dataset.action;
      if (action === "open-filters") { const panel=$("#result-filters");panel.classList.add("filters-open");panel.setAttribute("role","dialog");panel.setAttribute("aria-modal","true");panel.querySelector("button").focus(); }
      if (action === "close-filters") { $("#result-filters").classList.remove("filters-open");$("#result-filters").removeAttribute("role");$("#result-filters").removeAttribute("aria-modal");$(".mobile-filter-button").focus(); }
      if (action === "result-calendar") {
        const leg = draft.search.legs[legIndex];
        PriceCalendar.open({ ...leg, count: draft.search.count, min: legIndex ? draft.search.legs[legIndex - 1].date : localToday(), onSelect: selectResultDate });
      }
      if (action === "print-voucher") { const r=B.get(currentId);$("#print-area").innerHTML=`<div class="printed-voucher"><h1>voyagencash · PayEnCash</h1><p>Bon de démonstration · non encaissable</p>${B.qr(`DEMO|${r.voucher}|${r.voucherToken}`)}<h2>${esc(r.voucher)}</h2><p>${F.money(r.total)} · Échéance : ${new Date(r.expiresAt).toLocaleString("fr-FR")}</p></div>`;window.print(); }

      if (action === "freeze-details") openDialog(`<div class="secure-icon">${icon("lock")}</div><h2 id="dialog-title">120 minutes pour décider.</h2><p>Le gel de tarif est inclus dans votre réservation simulée, sans frais et sans débit. Il démarre à la création du bon et expire après deux heures. Le compte à rebours fait foi, même après un rechargement.</p><p>Une fois ce délai écoulé, le bon ne peut plus être validé. Lancez une nouvelle recherche pour connaître les nouveaux tarifs. Les délais réels dépendent de l’offre et de la compagnie.</p><button class="button primary full" data-action="close-dialog">Compris</button>`);
      if (action === "reset-filters") renderResults();
      if (action === "change-search") go("search");
      if (action === "previous-leg" || action === "reselect-last") {
        draft.flights.pop();
        persist();
        if (view === "results") renderResults();
        else go("results");
      }
      if (action === "to-passengers") {
        persist();
        go("passengers");
      }
      if (action === "pay") {
        if (!$("#payment-consent").checked) {
          toast(
            "Confirmez que vous avez compris le caractère fictif de cette réservation.",
            true,
          );
          $("#payment-consent").focus();
          return;
        }
        const method = $("[name=payment-method]:checked").value;
        const checkoutDraft = draft;
        let r = B.create(draft, method);
        if (method === "voucher" && FlightAPI.mode === "demo") {
          const button=$("#pay-button");button.disabled=true;
          try {
            const hold=await FlightAPI.request('/api/orders/hold',{count:draft.search.count,legs:draft.flights.map(f=>({from:f.from,to:f.to,date:f.date,offerId:f.id})),options:draft.options});
            const voucher=await FlightAPI.request('/api/payencash/voucher',{holdToken:hold.token});
            r=B.attachVoucher(r.id, {voucher:voucher.reference,voucherToken:voucher.token,serverHoldId:hold.id,expiresAt:hold.expiresAt,serverSigned:true});
          } catch(error) { toast("Bon local de démonstration : " + error.message); }
          finally { button.disabled=false; }
        }
        if (draft !== checkoutDraft || view !== "payment") return;
        currentId = r.id;
        safe(() => persist());
        renderPending(r);
        if (method === "voucher") haptic();
        if (method !== "voucher") authDialog(r);
      }
      if (action === "validate-voucher" || action === "authorize-payment")
        finishPayment();
      if (action === "resume-payment") authDialog(B.get(currentId));
      if (action === "decline-payment") {
        $("#app-dialog").close();
        toast(
          "Paiement refusé dans la simulation. Vous pouvez réessayer ou annuler la réservation.",
        );
      }
      if (action === "close-dialog") $("#app-dialog").close();
      if (action === "copy-voucher") {
        const code = B.get(currentId).voucher;
        if (navigator.clipboard?.writeText)
          navigator.clipboard
            .writeText(code)
            .then(() => toast("Code du bon copié."))
            .catch(() => toast(`Copiez ce code : ${code}`));
        else toast(`Copiez ce code : ${code}`);
      }
    }),
  );
  document.addEventListener("keydown", e => {
    const panel=$(".filters-open");if(!panel)return;
    if(e.key==="Escape"){$('[data-action=close-filters]').click();return;}
    if(e.key==="Tab"){const nodes=[...panel.querySelectorAll('button:not(:disabled),input,select')].filter(n=>n.offsetParent!==null);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  });
  $("#store-search").addEventListener("input", renderStores);
  $(".skip-link").addEventListener("click", (event) => {
    event.preventDefault();
    $("#main").focus();
    $("#main").scrollIntoView({ block: "start" });
  });
  $("#menu-toggle").addEventListener("click", () => {
    const open = $("#main-nav").classList.toggle("open");
    $("#menu-toggle").setAttribute("aria-expanded", String(open));
  });
  $(".dialog-close").addEventListener("click", () => $("#app-dialog").close());
  $("#app-dialog").addEventListener("click", (e) => {
    if (e.target === $("#app-dialog")) {
      const r = e.target.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        e.target.close();
    }
  });
  function route() {
    let next =
      location.hash.slice(1) ||
      { "/mes-billets": "bookings", "/ou-payer": "stores", "/aide": "faq" }[
        location.pathname
      ] ||
      "search";
    if (
      ![
        "search",
        "results",
        "options",
        "passengers",
        "payment",
        "confirmation",
        "bookings",
        "stores",
        "faq",
      ].includes(next)
    )
      next = "search";
    const complete =
      draft.search && draft.flights.length === draft.search.legs.length;
    if (
      ["results", "options", "passengers", "payment"].includes(next) &&
      !draft.search
    )
      next = "search";
    if (["options", "passengers", "payment"].includes(next) && !complete)
      next = "results";
    if (next === "payment" && !currentId) {
      try {
        B.validatePassengers(
          draft.passengers,
          draft.contact,
          draft.flights[0].date,
        );
      } catch {
        next = "passengers";
      }
    }
    if (next === "confirmation") {
      const r = safe(() => B.get(currentId));
      if (!r || r.status !== "confirmed") next = "bookings";
    }
    if (["results", "options", "passengers"].includes(next) && currentId) {
      const r = safe(() => B.get(currentId));
      if (r) {
        next = "bookings";
        toast(
          "Ce voyage possède déjà une réservation. Retrouvez-la ici ou lancez une nouvelle recherche.",
        );
      }
    }
    if (view === "passengers" && next !== "passengers")
      safe(() => {
        collectPassengers();
        persist();
      });
    if (next !== view && $("#app-dialog").open) $("#app-dialog").close();
    view = next;
    closeAutocomplete();
    $$(".view").forEach((el) => (el.hidden = el.id !== `view-${view}`));
    $$("[data-nav]").forEach((el) => {
      if (el.dataset.nav === view) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    });
    $("#main-nav").classList.remove("open");
    $("#menu-toggle").setAttribute("aria-expanded", "false");
    const render = {
      search: renderSearch,
      results: renderResults,
      options: renderOptions,
      passengers: renderPassengers,
      payment: renderPayment,
      confirmation: renderConfirmation,
      bookings: renderBookings,
      stores: renderStores,
    };
    try {
      render[view]?.();
      if(view === "bookings") LiveBooking.appendBookings($("#bookings-content"));
    } catch (e) {
      toast(e.message, true);
      if (view === "bookings")
        $("#bookings-content").innerHTML =
          `<div class="empty-state"><h2>Stockage local indisponible</h2><p>${esc(e.message)}</p><a class="button" href="#search">Revenir à la recherche</a></div>`;
    }
    document.title = `voyagencash — ${{ search: "Trouvez votre prochain vol", results: "Choisissez votre vol", options: "Vos options", passengers: "Vos passagers", payment: "Votre paiement", confirmation: "Votre e-billet", bookings: "Mes réservations", stores: "Où payer", faq: "Aide & FAQ" }[view]}`;
    window.scrollTo({ top: 0, behavior: "instant" });
    $("#main").focus({ preventScroll: true });
  }
  function haptic() {
    try { navigator.vibrate?.([15, 30, 20]); } catch { /* Optional capability. */ }
  }
  let soundEnabled = false, audioContext;
  try { soundEnabled = localStorage.getItem("voyagencash_sound") === "on"; } catch { /* Preference is optional. */ }
  function updateSoundButton() {
    const button = $("#sound-toggle");
    button.setAttribute("aria-pressed", String(soundEnabled));
    button.setAttribute("aria-label", soundEnabled ? "Désactiver les sons d’interface" : "Activer les sons d’interface");
    button.title = button.getAttribute("aria-label");
    button.innerHTML = icon(soundEnabled ? "sound" : "mute");
  }
  function mechanicalClick() {
    if (!soundEnabled) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audioContext ||= new Audio();
      audioContext.resume().catch(() => {});
      const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
      const now = audioContext.currentTime;
      oscillator.type = "sine"; oscillator.frequency.value = 1200;
      gain.gain.setValueAtTime(0.035, now); gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);
      oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.start(now); oscillator.stop(now + 0.012);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    } catch { /* Browsers without audio support keep the full booking flow. */ }
  }
  $("#sound-toggle").addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    try { localStorage.setItem("voyagencash_sound", soundEnabled ? "on" : "off"); } catch { /* Optional. */ }
    updateSoundButton(); mechanicalClick();
  });
  document.addEventListener("change", e => { if (e.target.matches("input[type=checkbox],input[type=radio],input[type=date],select,input[type=range]")) mechanicalClick(); });
  document.addEventListener("click", e => { if (e.target.closest("[data-trip],[data-airport-choice],[data-swap]")) mechanicalClick(); });
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  function tilt(card, x, y) {
    if (reducedMotion.matches) return;
    card.style.setProperty("--shine-x", `${Math.max(0, Math.min(100, x))}%`);
    card.style.setProperty("--shine-y", `${Math.max(0, Math.min(100, y))}%`);
  }
  document.addEventListener("pointermove", e => {
    const card = e.target.closest(".travel-pass,.boarding-pass");
    if (!card || e.pointerType === "touch") return;
    const box = card.getBoundingClientRect(); tilt(card, (e.clientX - box.left) / box.width * 100, (e.clientY - box.top) / box.height * 100);
  }, { passive: true });
  let orientationEnabled = false;
  async function enableOrientation() {
    if (orientationEnabled || reducedMotion.matches || !window.DeviceOrientationEvent) return;
    try {
      if (typeof DeviceOrientationEvent.requestPermission === "function" && await DeviceOrientationEvent.requestPermission() !== "granted") return;
      orientationEnabled = true;
      window.addEventListener("deviceorientation", e => {
        if (e.gamma == null || e.beta == null) return;
        $$(".travel-pass,.boarding-pass").forEach(card => tilt(card, 50 + e.gamma, 50 + e.beta / 2));
      }, { passive: true });
    } catch { /* Static hologram remains available. */ }
  }
  document.addEventListener("pointerdown", e => { if (e.target.closest(".travel-pass,.boarding-pass")) enableOrientation(); }, { passive: true });
  function updateTravelClock() {
    $$('[data-local-clock]').forEach(el => { el.textContent = F.time(Date.now(), el.dataset.localClock); });
    if (!currentId || !$("[data-departure-label]")) return;
    safe(() => {
      const r = B.get(currentId), departure = r.flights[0].departure;
      const remaining = Math.max(0, departure - Date.now());
      const hours = Math.floor(remaining / 3600000);
      $("[data-departure-label]").textContent = remaining ? `Départ dans ${Math.floor(hours / 24)} j ${hours % 24} h` : "Heure de départ atteinte";
      $("[data-departure-progress]").value = Math.max(0, Math.min(100, (Date.now() - r.createdAt) / (departure - r.createdAt) * 100));
    });
  }
  async function refreshWeather(code) {
    const button = $(`[data-weather="${code}"]`), output = $("#arrival-weather"), description = $("#weather-description");
    if (!button || button.disabled) return;
    button.disabled = true; description.textContent = "Recherche de la météo actuelle…";
    try {
      const airport = F.airport(code);
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${airport.lat}&longitude=${airport.lon}&current=temperature_2m,weather_code&timezone=auto`, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error("Weather unavailable");
      const data = await response.json();
      if (!Number.isFinite(data.current?.temperature_2m)) throw new Error("Invalid weather");
      if (!output.isConnected) return;
      output.innerHTML = `${Math.round(data.current.temperature_2m)}<small> °C</small>`;
      description.textContent = `Météo actuelle · relevé ${data.current.time.slice(11,16)} locale`;
      button.textContent = "Actualiser · Open-Meteo";
    } catch { if (description.isConnected) description.textContent = "Météo indisponible. Réessayez dans un instant."; }
    finally { button.disabled = false; }
  }
  function locateStores() {
    const status = $("#geo-status"), button = $("#locate-stores");
    if (!navigator.geolocation) { status.textContent = "GPS indisponible. Recherchez votre ville."; return; }
    button.disabled = true; status.textContent = "Recherche de votre position…";
    navigator.geolocation.getCurrentPosition(position => {
      geoPosition = { lat: position.coords.latitude, lon: position.coords.longitude };
      $("#store-search").value = ""; button.disabled = false;
      status.textContent = partnerStores ? "Points partenaires classés par distance à vol d’oiseau." : "Points classés par distance à vol d’oiseau depuis votre position. Adresses de démonstration.";
      renderStores();
    }, () => { button.disabled = false; status.textContent = "Position indisponible ou refusée. Recherchez votre ville ou code postal."; }, { timeout: 10000, maximumAge: 60000 });
  }
  updateSoundButton();
  setInterval(updateTravelClock, 30000);
  window.addEventListener("hashchange", route);
  window.addEventListener("storage", (e) => {
    if (e.key === B.KEY) {
      if (view === "bookings") safe(renderBookings);
      else if (view === "payment") safe(renderPayment);
      else if (view === "confirmation") route();
    }
  });
  window.addEventListener("beforeunload", () => {
    if (view === "passengers") {
      collectPassengers();
      safe(persist);
    }
  });
  setInterval(updateTimer, 1000);
  $("#year").textContent = new Date().getFullYear();
  if (location.pathname === "/aller-simple" && !location.hash)
    search.type = "oneway";
  route();
  if (storageError) toast(storageError, true);
})();
