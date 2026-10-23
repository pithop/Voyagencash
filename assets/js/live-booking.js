/* Real offers never use BookingManager's local payment simulation. */
(() => {
  const esc = BookingManager.escape,
    F = FlightEngine;
  let active, timer, pollTimer, activeContainer, mountedCard, generation = 0;
  let memoryRecords = [];
  function stop() {
    mountedCard?.destroy();
    mountedCard = null;
    generation++;
    clearInterval(timer);
    clearTimeout(pollTimer);
  }
  const key = "voyagencash_live_orders";
  function records() {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "[]");
      if (Array.isArray(parsed)) return [...memoryRecords, ...parsed.filter(r => r && typeof r.id === "string" && typeof r.token === "string" && !memoryRecords.some(m => m.id === r.id))];
    } catch { /* The current tab remains usable when browser storage is unavailable. */ }
    return memoryRecords;
  }
  function save(value) {
    const { id, token, holdToken, expiresAt, amountCents, voucher, status, kind, paymentMethod } = value;
    memoryRecords = [{ id, token, holdToken, expiresAt, amountCents, voucher, status, kind, paymentMethod }, ...records().filter(r => r.id !== id)].slice(0, 50);
    try { localStorage.setItem(key, JSON.stringify(memoryRecords)); } catch { /* Recovery links remain available. */ }
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
    const session = generation;
    const config = await FlightAPI.ready;
    if (session !== generation) return;
    const total = draft.flights.reduce(
      (s, f) => s + f.price * draft.search.count,
      0,
    );
    const supported =
      draft.flights.length === 1 &&
      draft.flights[0].payment_requirements?.requires_instant_payment === false;
    container.innerHTML = `<div class="page-heading"><span class="eyebrow">OFFRE DUFFEL</span><h1 id="options-title">Votre prochain départ.</h1><p>${draft.flights.map((f) => `${esc(F.airport(f.from).city)} → ${esc(F.airport(f.to).city)}`).join(" · ")} · ${F.money(total)} pour ${draft.search.count} adulte(s)</p></div><div class="panel" id="live-checkout"></div>`;
    const panel = container.querySelector("#live-checkout");
    const canCash = config.checkout && supported && total <= 1000;
    if (!supported || (!canCash && !config.stripe)) {
      panel.innerHTML = `<h2>La réservation de cette offre n’est pas disponible ici.</h2><p>${!supported ? "Ce parcours nécessite un seul trajet avec retenue confirmée par la compagnie." : "Aucun moyen de paiement n’est actuellement disponible pour ce voyage."}</p><a class="button secondary" href="#search">Modifier ma recherche</a>`;
      return;
    }
    panel.innerHTML = `<h2>Les voyageurs</h2><p>Informations transmises au fournisseur pour la réservation. Elles ne sont pas enregistrées dans le stockage local.</p><form id="live-passengers">${Array.from({ length: draft.search.count }, (_, i) => `<fieldset class="live-passenger"><legend>Adulte ${i + 1}</legend><div class="form-grid"><label>Prénom<input name="given_name-${i}" minlength="2" maxlength="60" autocomplete="given-name" required></label><label>Nom<input name="family_name-${i}" minlength="2" maxlength="60" autocomplete="family-name" required></label><label>Date de naissance<input type="date" name="born_on-${i}" min="1900-01-01" max="${new Date(Date.now() - 18 * 365.25 * 86400000).toISOString().slice(0, 10)}" required></label><label>Civilité<select name="title-${i}"><option value="mr">Monsieur</option><option value="ms">Madame</option><option value="dr">Docteur</option></select></label><label>Sexe sur le document<select name="gender-${i}"><option value="m">M</option><option value="f">F</option></select></label></div></fieldset>`).join("")}<div class="form-grid"><label>E-mail<input type="email" name="email" autocomplete="email" required></label><label>Téléphone international<input type="tel" name="phone_number" placeholder="+33612345678" pattern="\\+[0-9]{8,15}" required></label></div><fieldset class="payment-selection"><legend>Votre règlement</legend>${canCash ? '<label><input type="radio" name="paymentMethod" value="cash" checked> En espèces dans un point partenaire</label>' : ''}${config.stripe ? `<label><input type="radio" name="paymentMethod" value="card" ${!canCash ? 'checked' : ''}> Par carte bancaire</label>` : ''}</fieldset><label class="consent"><input type="checkbox" required><span>Je demande une retenue sans débit immédiat. Le règlement est nécessaire avant l’échéance pour demander l’émission du billet.</span></label><p class="form-error" id="live-error" role="alert" hidden></p><button class="button primary" type="submit">Retenir le vol · ${F.money(total)}</button></form>`;
    const draftKey = "vnc-hold:" + draft.flights[0].id;
    let idempotencyKey;
    try { idempotencyKey = sessionStorage.getItem(draftKey); } catch {}
    idempotencyKey ||= crypto.randomUUID();
    try { sessionStorage.setItem(draftKey, idempotencyKey); } catch {}
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
            paymentMethod: form.get("paymentMethod"),
          },
          { "Idempotency-Key": idempotencyKey },
        );
        active = {
          paymentMethod: form.get("paymentMethod"),
          id: hold.id,
          token: hold.accessToken,
          holdToken: hold.token,
          expiresAt: hold.expiresAt,
          amountCents: hold.amountCents,
        };
        // Persist the capability before requesting the voucher so an adapter retry is safe.
        save(active);
        if (session !== generation) return;
        if (active.paymentMethod === "card") {
          await showCardPayment(container, active);
        } else {
          await showVoucher(container, active);
        }
      } catch (error) {
        feedback(error);
        button.disabled = false;
      }
    });
  }
  async function showCardPayment(container, record) {
    active = record;
    activeContainer = container;
    stop();
    const session = generation;
    const current = () => generation === session && container.isConnected;
    container.innerHTML = `<div class="page-heading"><h1 id="options-title">Paiement par carte bancaire</h1><p>Réservation ${esc(record.id)} · ${F.money(record.amountCents / 100)}</p></div><div class="panel"><div id="stripe-card-element"></div><p id="live-card-error" class="form-error" role="alert" hidden></p><button class="button primary" id="live-card-submit" disabled>Payer ${F.money(record.amountCents / 100)}</button><p id="live-state" role="status">Chargement du paiement sécurisé…</p><a class="button" href="#bookings">Retrouver mes réservations</a></div>`;
    const errorNode = container.querySelector("#live-card-error"), submit = container.querySelector("#live-card-submit");
    try {
      const status = await FlightAPI.request("/api/orders/status", { token: record.token });
      if (!current()) return;
      if (!["awaiting_cash", "awaiting_card"].includes(status.status)) return showVoucher(container, record);
      if (!window.Stripe || !FlightAPI.stripePublicKey) throw new Error("Le formulaire sécurisé n’a pas chargé. Rechargez la page pour réessayer.");
      const pi = await FlightAPI.createStripeIntent({ holdToken: record.holdToken, orderId: record.id });
      if (!current()) return;
      if (pi.simulation) throw new Error("Ce paiement appartient à la démonstration.");
      const stripe = window.Stripe(FlightAPI.stripePublicKey);
      const elements = stripe.elements();
      mountedCard = elements.create("card");
      mountedCard.mount("#stripe-card-element");
      record.paymentMethod = "card";
      save(record);
      submit.disabled = false;
      container.querySelector("#live-state").textContent = "Saisissez vos coordonnées bancaires dans le formulaire Stripe.";
      submit.onclick = async () => {
        submit.disabled = true;
        errorNode.hidden = true;
        try {
          const result = await stripe.confirmCardPayment(pi.clientSecret, { payment_method: { card: mountedCard } });
          if (!current()) return;
          if (result.error) throw new Error(result.error.message);
          await showVoucher(container, record);
        } catch (error) {
          if (!current()) return;
          errorNode.hidden = false; errorNode.textContent = error.message;
          submit.disabled = false;
        }
      };
    } catch (error) {
      if (current()) { errorNode.hidden = false; errorNode.textContent = error.message; }
    }
  }
  async function showVoucher(container, record) {
    active = record;
    activeContainer = container;
    stop();
    const session = generation;
    const current = () => generation === session && container.isConnected;
    let checking = false, terminal = false;
    container.innerHTML = `<div class="page-heading"><h1 id="options-title">Votre réservation</h1><p>Réservation réelle · le billet sera émis après réception du paiement.</p></div><div class="panel live-voucher"><div id="live-voucher-content"></div><p id="live-state" role="status">Vérification de votre réservation…</p><p id="live-error" class="form-error" role="alert" hidden></p><div class="booking-actions"><button class="button primary" data-live-card-pay>Payer par carte bancaire (Stripe)</button><button class="button" data-live-status>Actualiser le paiement</button><a class="button" href="#stores">Points de paiement</a><button class="button" data-live-print>Imprimer / PDF</button></div></div>`;
    const cardButton = container.querySelector("[data-live-card-pay]");
    cardButton.hidden = true;
    cardButton.onclick = () => showCardPayment(container, record);
    attachRecovery(container.querySelector(".booking-actions"), record);
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
            awaiting_card: "Paiement par carte en attente",
            payment_received: "Paiement reçu · émission du billet en cours",
            ticket_issued: "Billet émis par la compagnie",
            expired: "Réservation expirée",
            refund_pending: "Paiement à rapprocher · remboursement à traiter",
            reconciliation_required: "Votre paiement nécessite une vérification par le service de réservation",
          }[status.status] || "Vérification opérateur en cours";
        record.status = status.status;
        record.paymentMethod = status.paymentMethod || record.paymentMethod;
        record.voucher = status.voucher || record.voucher;
        record.amountCents = status.amountCents || record.amountCents;
        record.expiresAt = status.expiresAt || record.expiresAt;
        cardButton.hidden = !((status.status === "awaiting_card" || (status.status === "awaiting_cash" && record.paymentMethod === "card")) && record.holdToken && FlightAPI.stripe);
        save(record);
        terminal = ["expired", "refund_pending", "reconciliation_required"].includes(status.status) || (status.status === "ticket_issued" && !!status.ticket);
        if (status.status === "awaiting_cash" && record.paymentMethod !== "card" && !content.querySelector("#live-deadline") && (record.voucher || record.holdToken)) await loadVoucher();
        if (!current()) return;
        if (status.status !== "awaiting_cash") {
          clearInterval(timer);
          content.innerHTML = `<h2>${status.status === "payment_received" ? "Votre paiement est reçu" : status.status === "expired" ? "Le délai de paiement est terminé" : "Suivi de votre réservation"}</h2><p class="voucher-code">${esc(record.voucher?.reference || record.id)}</p><p>${status.status === "payment_received" ? "La compagnie prépare votre billet. Cette page se met à jour automatiquement." : "Ne réglez plus ce bon. Consultez l’état de votre réservation ci-dessous."}</p>`;
        }
        if (status.ticket) {
          clearInterval(timer);
          content.innerHTML = `<h2>Votre billet électronique</h2><p>Référence compagnie : <strong>${esc(status.ticket.bookingReference)}</strong></p>${(status.ticket.slices || []).map((s) => `<p>${esc(s.origin)} → ${esc(s.destination)} · ${esc((s.departingAt || "").replace("T", " "))}</p>`).join("")}${(status.ticket.documents || []).map((d) => `<p>${esc(d.type || "Document")} · ${esc(d.unique_identifier || d.url || "")}</p>`).join("")}<p>Effectuez l’enregistrement auprès de la compagnie pour votre carte d’embarquement.</p><button class="button" data-live-wallet>Ajouter la réservation à Apple Wallet</button>`;
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
    if (current()) await checkStatus();
  }
  function attachRecovery(container, record) {
    const button = document.createElement("button"), revoke = document.createElement("button"), output = document.createElement("p");
    button.className = revoke.className = "button";
    button.textContent = "Reprendre sur un autre appareil";
    revoke.textContent = "Révoquer le lien de reprise";
    output.className = "recovery-output";
    output.setAttribute("role", "status");
    container.append(button, revoke, output);
    button.onclick = async () => {
      button.disabled = true;
      try {
        const result = await FlightAPI.request("/api/orders/hold", { action: "recovery", token: record.token });
        const link = new URL(location.pathname, location.origin);
        link.hash = "bookings?recovery=" + encodeURIComponent(result.recoveryToken);
        output.textContent = "Lien privé valable 24 heures maximum. Toute personne qui le possède peut consulter ce dossier. ";
        const anchor = document.createElement("a"); anchor.href = link.href; anchor.textContent = link.href; output.append(anchor);
        try { await navigator.clipboard.writeText(link.href); output.prepend("Lien copié. "); } catch {}
      } catch (error) { output.textContent = error.message; }
      finally { button.disabled = false; }
    };
    revoke.onclick = async () => {
      revoke.disabled = true;
      try { await FlightAPI.request("/api/orders/hold", { action: "recovery", token: record.token, revoke: true }); output.textContent = "Lien de reprise révoqué."; }
      catch (error) { output.textContent = error.message; }
      finally { revoke.disabled = false; }
    };
  }
  async function resumeRecord(container, record) {
    if (record.kind !== "low-cost-access") return showVoucher(container, record);
    stop(); activeContainer = container;
    const session = generation;
    container.innerHTML = `<div class="panel"><h1>Votre dossier compagnie</h1><p>${esc(record.id)}</p><p role="status" id="live-state">Chargement du dossier…</p><p id="live-error" role="alert" hidden></p><div class="booking-actions"></div></div>`;
    attachRecovery(container.querySelector(".booking-actions"), record);
    const refresh = document.createElement("button");
    refresh.className = "button"; refresh.textContent = "Actualiser auprès de la compagnie";
    container.querySelector(".booking-actions").prepend(refresh);
    refresh.onclick = async () => {
      refresh.disabled = true;
      try {
        await FlightAPI.request("/api/orders/hold", { action: "refresh-low-cost", token: record.token });
        if (session === generation) await resumeRecord(container, record);
      } catch (error) { if (session === generation) feedback(error); }
      finally { refresh.disabled = false; }
    };
    try {
      const result = await FlightAPI.request("/api/orders/status", { token: record.token });
      if (session !== generation) return;
      container.querySelector("#live-state").textContent = result.message + (result.bookingReference ? ` Référence compagnie : ${result.bookingReference}` : "");
      save({ ...record, status: result.status });
    } catch (error) { if (session === generation) feedback(error); }
  }
  function appendBookings(container) {
    const saved = records();
    const section = document.createElement("section");
    section.className = "panel";
    section.innerHTML = `<h2>Réservations partenaire</h2>${saved.map((r, i) => `<button class="button" data-live-resume="${i}">Retrouver ${esc(r.voucher?.reference || r.id)}</button>`).join("")}<form id="recover-booking"><label>Lien de reprise privé<input name="recovery" autocomplete="off" required placeholder="Collez votre lien de reprise"></label><button class="button" type="submit">Retrouver mon dossier</button><p role="alert" class="form-error" hidden></p></form>`;
    section.addEventListener("click", e => {
      const button = e.target.closest("[data-live-resume]");
      if (button) resumeRecord(container, saved[+button.dataset.liveResume]).catch(feedback);
    });
    const form = section.querySelector("form");
    form.onsubmit = async e => {
      e.preventDefault();
      const session = generation;
      const raw = form.elements.recovery.value.trim();
      let token = raw;
      try { token = new URLSearchParams(new URL(raw).hash.split("?")[1]).get("recovery") || raw; } catch {}
      const button = form.querySelector("button"); button.disabled = true;
      try {
        const record = await FlightAPI.request("/api/orders/status", { recoveryToken: token });
        save(record);
        if (session !== generation || !form.isConnected) return;
        history.replaceState(null, "", location.pathname + "#bookings");
        await resumeRecord(container, record);
      } catch (error) { const node = form.querySelector("[role=alert]"); node.hidden = false; node.textContent = error.message; }
      finally { button.disabled = false; }
    };
    container.prepend(section);
    const recovery = new URLSearchParams(location.hash.split("?")[1]).get("recovery");
    if (recovery) { form.elements.recovery.value = recovery; form.requestSubmit(); }
  }
  window.addEventListener("hashchange", stop);
  window.addEventListener("pagehide", stop);
  window.LiveBooking = { mount, appendBookings, save, resumeRecord };
})();
