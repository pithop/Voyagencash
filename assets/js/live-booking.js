/* Real offers never use BookingManager's local payment simulation. */
(() => {
  const esc = BookingManager.escape,
    F = FlightEngine;
  let active, timer, pollTimer, activeContainer, generation = 0;
  function stop() {
    generation++;
    clearInterval(timer);
    clearTimeout(pollTimer);
  }
  const key = "voyagencash_live_orders";
  function records() {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      return [];
    }
  }
  function save(value) {
    localStorage.setItem(
      key,
      JSON.stringify([value, ...records().filter((r) => r.id !== value.id)]),
    );
  }
  function feedback(error) {
    const node = activeContainer?.querySelector("#live-error");
    if (node) {
      node.hidden = false;
      node.textContent = error.message;
    }
  }
  async function mount(container, draft) {
    activeContainer = container;
    stop();
    const config = await FlightAPI.ready;
    const total = draft.flights.reduce(
      (s, f) => s + f.price * draft.search.count,
      0,
    );
    const supported =
      draft.flights.length === 1 &&
      draft.flights[0].payment_requirements?.requires_instant_payment === false;
    container.innerHTML = `<div class="page-heading"><span class="eyebrow">OFFRE DUFFEL</span><h1 id="options-title">Votre prochain départ.</h1><p>${draft.flights.map((f) => `${esc(F.airport(f.from).city)} → ${esc(F.airport(f.to).city)}`).join(" · ")} · ${F.money(total)} pour ${draft.search.count} adulte(s)</p></div><div class="panel" id="live-checkout"></div>`;
    const panel = container.querySelector("#live-checkout");
    if (!config.checkout || !supported || total > 1000) {
      panel.innerHTML = `<h2>${total > 1000 ? "Ce voyage dépasse le plafond espèces." : !supported ? "Cette offre ne permet pas ce parcours PayEnCash." : "Le paiement partenaire n’est pas encore activé."}</h2><p>${!supported ? "La réservation réelle prend actuellement en charge un aller simple, pour des adultes, avec une offre éligible à la retenue. Les autres trajets restent consultables." : "La réservation et l’émission nécessitent le service partenaire opérationnel. Aucun billet n’a été réservé."}</p><a class="button primary" href="#search">Modifier ma recherche</a>`;
      return;
    }
    panel.innerHTML = `<h2>Les voyageurs</h2><p>Informations transmises au fournisseur pour la réservation. Elles ne sont pas enregistrées dans le stockage local.</p><form id="live-passengers">${Array.from({ length: draft.search.count }, (_, i) => `<fieldset class="live-passenger"><legend>Adulte ${i + 1}</legend><div class="form-grid"><label>Prénom<input name="given_name-${i}" minlength="2" maxlength="60" autocomplete="given-name" required></label><label>Nom<input name="family_name-${i}" minlength="2" maxlength="60" autocomplete="family-name" required></label><label>Date de naissance<input type="date" name="born_on-${i}" min="1900-01-01" max="${new Date(Date.now() - 18 * 365.25 * 86400000).toISOString().slice(0, 10)}" required></label><label>Civilité<select name="title-${i}"><option value="mr">Monsieur</option><option value="ms">Madame</option><option value="dr">Docteur</option></select></label><label>Sexe sur le document<select name="gender-${i}"><option value="m">M</option><option value="f">F</option></select></label></div></fieldset>`).join("")}<div class="form-grid"><label>E-mail<input type="email" name="email" autocomplete="email" required></label><label>Téléphone international<input type="tel" name="phone_number" placeholder="+33612345678" pattern="\\+[0-9]{8,15}" required></label></div><label class="consent"><input type="checkbox" required><span>Je demande une retenue sans débit immédiat. Le paiement du bon est nécessaire avant l’échéance pour demander l’émission du billet.</span></label><p class="form-error" id="live-error" role="alert" hidden></p><button class="button primary" type="submit">Retenir le vol · ${F.money(total)}</button></form>`;
    const idempotencyKey = crypto.randomUUID();
    panel.querySelector("form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const button = e.target.querySelector("[type=submit]");
      if (button.disabled) return;
      button.disabled = true;
      const form = new FormData(e.target),
        offer = draft.flights[0];
      const passengers = Array.from({ length: draft.search.count }, (_, i) => ({
        id: offer.passengerIds[i],
        ...Object.fromEntries(
          ["given_name", "family_name", "born_on", "title", "gender"].map(
            (k) => [k, form.get(`${k}-${i}`)],
          ),
        ),
        email: form.get("email"),
        phone_number: form.get("phone_number"),
      }));
      try {
        const hold = await FlightAPI.request(
          "/api/orders/hold",
          {
            offerId: offer.id,
            passengers,
            expectedAmountCents: Math.round(total * 100),
          },
          { "Idempotency-Key": idempotencyKey },
        );
        active = {
          id: hold.id,
          token: hold.accessToken,
          holdToken: hold.token,
          expiresAt: hold.expiresAt,
          amountCents: hold.amountCents,
        };
        // Persist the capability before requesting the voucher so an adapter retry is safe.
        save(active);
        await showVoucher(container, active);
      } catch (error) {
        feedback(error);
        button.disabled = false;
      }
    });
  }
  async function showVoucher(container, record) {
    active = record;
    activeContainer = container;
    stop();
    const session = generation;
    const current = () => generation === session && container.isConnected;
    let checking = false, terminal = false;
    container.innerHTML = `<div class="page-heading"><h1 id="options-title">Votre réservation PayEnCash</h1><p>Réservation réelle · le billet sera émis après réception du paiement.</p></div><div class="panel live-voucher"><div id="live-voucher-content"></div><p id="live-state" role="status">Vérification de votre réservation…</p><p id="live-error" class="form-error" role="alert" hidden></p><div class="booking-actions"><button class="button" data-live-status>Actualiser le paiement</button><a class="button" href="#stores">Points de paiement</a><button class="button" data-live-print>Imprimer / PDF</button></div></div>`;
    const content = container.querySelector("#live-voucher-content");
    async function loadVoucher() {
      try {
        const voucher =
          record.voucher ||
          (await FlightAPI.request("/api/payencash/voucher", {
            holdToken: record.holdToken,
          }));
        if (!current()) return;
        record.voucher = voucher;
        save(record);
        content.innerHTML = `<h2>Bon PayEnCash</h2>${BookingManager.qr(voucher.qrPayload)}<strong class="voucher-code">${esc(voucher.reference)}</strong><p>${F.money(voucher.amountCents / 100)}</p><p id="live-deadline"></p><button class="text-button" data-live-copy>Copier la référence</button>`;
        content.querySelector("[data-live-copy]").onclick = () =>
          navigator.clipboard
            ?.writeText(voucher.reference)
            .catch(() => feedback(new Error("Copiez la référence affichée.")));
        function tick() {
          const target = container.querySelector("#live-deadline");
          if (target) {
            const seconds = Math.max(
              0,
              Math.floor((voucher.expiresAt - Date.now()) / 1000),
            );
            target.textContent = seconds
              ? `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")} s pour payer`
              : "Bon expiré · ne réglez plus ce bon";
            target.classList.toggle("urgent", seconds < 900);
          }
        }
        tick();
        timer = setInterval(tick, 1000);
      } catch (error) {
        if (!current()) return;
        feedback(error);
        content.innerHTML =
          '<button class="button" data-live-retry>Réessayer l’émission du bon</button>';
        content.querySelector("button").onclick = loadVoucher;
      }
    }
    const statusButton = container.querySelector("[data-live-status]");
    async function checkStatus() {
      if (!current() || checking || terminal) return;
      clearTimeout(pollTimer);
      checking = true;
      statusButton.disabled = true;
      try {
        const status = await FlightAPI.request("/api/orders/status", {
          token: record.token,
        });
        if (!current()) return;
        container.querySelector("#live-error").hidden = true;
        container.querySelector("#live-state").textContent =
          {
            awaiting_cash: "Paiement en attente",
            payment_received: "Paiement reçu · émission du billet en cours",
            ticket_issued: "Billet émis par la compagnie",
            expired: "Réservation expirée",
            refund_pending: "Paiement à rapprocher · remboursement à traiter",
            reconciliation_required: "Votre paiement nécessite une vérification par le service de réservation",
          }[status.status] || "Vérification opérateur en cours";
        record.status = status.status;
        save(record);
        terminal = ["ticket_issued", "expired", "refund_pending", "reconciliation_required"].includes(status.status);
        if (status.status !== "awaiting_cash") {
          clearInterval(timer);
          content.innerHTML = `<h2>${status.status === "payment_received" ? "Votre paiement est reçu" : status.status === "expired" ? "Le délai de paiement est terminé" : "Suivi de votre réservation"}</h2><p class="voucher-code">${esc(record.voucher?.reference || record.id)}</p><p>${status.status === "payment_received" ? "La compagnie prépare votre billet. Cette page se met à jour automatiquement." : "Ne réglez plus ce bon. Consultez l’état de votre réservation ci-dessous."}</p>`;
        }
        if (status.ticket) {
          clearInterval(timer);
          content.innerHTML = `<h2>Votre billet électronique</h2><p>Référence compagnie : <strong>${esc(status.ticket.bookingReference)}</strong></p>${status.ticket.slices.map((s) => `<p>${esc(s.origin)} → ${esc(s.destination)} · ${esc(s.departingAt.replace("T", " "))}</p>`).join("")}${(status.ticket.documents || []).map((d) => `<p>${esc(d.type)} · ${esc(d.unique_identifier)}</p>`).join("")}<p>Effectuez l’enregistrement auprès de la compagnie pour votre carte d’embarquement.</p><button class="button" data-live-wallet>Ajouter la réservation à Apple Wallet</button>`;
          content.querySelector("[data-live-wallet]").onclick = async () => {
            try {
              const response = await fetch("/api/orders/wallet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: record.token }),
              });
              if (!response.ok) throw new Error((await response.json()).error);
              const url = URL.createObjectURL(await response.blob());
              const a = document.createElement("a");
              a.href = url;
              a.download = "voyagencash.pkpass";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            } catch (error) {
              feedback(error);
            }
          };
        }
      } catch (error) {
        if (current()) feedback(error);
      } finally {
        checking = false;
        if (current()) {
          statusButton.disabled = false;
          if (!terminal) pollTimer = setTimeout(checkStatus, document.hidden ? 30000 : 5000);
        }
      }
    }
    statusButton.onclick = () => { terminal = false; checkStatus(); };
    container.querySelector("[data-live-print]").onclick = () => {
      document.querySelector("#print-area").innerHTML = content.innerHTML;
      document
        .querySelectorAll("#print-area button")
        .forEach((b) => b.remove());
      window.print();
    };
    await loadVoucher();
    if (current()) await checkStatus();
  }
  function appendBookings(container) {
    const saved = records();
    if (!saved.length) return;
    const section = document.createElement("section");
    section.className = "panel";
    section.innerHTML = `<h2>Réservations partenaire</h2>${saved.map((r, i) => `<button class="button" data-live-resume="${i}">Retrouver ${esc(r.voucher?.reference || r.id)}</button>`).join("")}`;
    section.addEventListener("click", (e) => {
      const button = e.target.closest("[data-live-resume]");
      if (button)
        showVoucher(container, saved[+button.dataset.liveResume]).catch(
          feedback,
        );
    });
    container.prepend(section);
  }
  window.addEventListener("hashchange", stop);
  window.addEventListener("pagehide", stop);
  window.LiveBooking = { mount, appendBookings };
})();
