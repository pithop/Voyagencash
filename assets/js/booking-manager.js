(() => {
  "use strict";
  const KEY = "voyagencash_reservations",
    DRAFT = "voyagencash_draft";
  const random = (n, chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789") =>
    Array.from(
      crypto.getRandomValues(new Uint32Array(n)),
      (v) => chars[v % chars.length],
    ).join("");
  const HOLD_SECONDS = 7200, CASH_LIMIT = 1000;
  const transitions = Object.freeze({
    INITIALIZED: ["HOLD_PENDING"],
    HOLD_PENDING: ["AWAITING_CASH", "PAYMENT_CAPTURED", "EXPIRED", "CANCELLED"],
    AWAITING_CASH: ["PAYMENT_CAPTURED", "EXPIRED", "CANCELLED"],
    PAYMENT_CAPTURED: ["TICKET_ISSUED", "REFUND_PENDING"],
    TICKET_ISSUED: ["REFUND_PENDING"],
    EXPIRED: [], REFUND_PENDING: [], CANCELLED: [],
  });
  function transition(r, next) {
    if (!transitions[r.state]?.includes(next))
      throw new Error(`Transition de réservation interdite : ${r.state} → ${next}`);
    r.state = next;
    (r.stateHistory ||= []).push({ state: next, at: Date.now() });
  }
  const clone = (v) => JSON.parse(JSON.stringify(v));
  function read(key, fallback) {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error(
        "Les données locales sont illisibles. Exportez ou réinitialisez le stockage de ce navigateur avant de continuer.",
      );
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      throw new Error(
        "Le navigateur ne peut pas enregistrer la réservation. Autorisez le stockage local ou libérez de l’espace, puis réessayez.",
      );
    }
  }
  function all() {
    const records = read(KEY, []);
    if (
      !Array.isArray(records) ||
      records.some(
        (r) =>
          !r ||
          !r.id ||
          !Array.isArray(r.flights) ||
          !Array.isArray(r.passengers) ||
          !r.contact ||
          !r.options ||
          !Number.isFinite(r.total),
      )
    )
      throw new Error(
        "Le format des réservations locales est invalide. Les données ont été conservées.",
      );
    let changed = false;
    for (const r of records) {
      if (!r.state) {
        r.state = { confirmed: "TICKET_ISSUED", cancelled: "CANCELLED", expired: "EXPIRED" }[r.status]
          || (r.method === "voucher" ? "AWAITING_CASH" : "HOLD_PENDING");
        r.stateHistory = [{ state: r.state, at: r.createdAt }];
        r.pnr = r.id.replace("VGC-", "").slice(0, 6);
        changed = true;
      }
      if (r.status === "pending" && Date.now() >= r.expiresAt) {
        transition(r, "EXPIRED");
        r.status = "expired";
        changed = true;
      }
    }
    if (changed) write(KEY, records);
    return records;
  }

  const get = (id) => all().find((r) => r.id === id);
  const total = (draft) => {
    const count = draft.search?.count || 1;
    const flights = draft.flights.reduce((s, f) => s + f.price * count, 0);
    const baggage = draft.options.baggage
      ? 35 * count * draft.flights.length
      : 0;
    const guarantee = draft.options.guarantee ? 19 * count : 0;
    return {
      flights,
      baggage,
      guarantee,
      total: flights + baggage + guarantee,
    };
  };
  function validatePassengers(passengers, contact, travelDate) {
    if (!passengers.length) throw new Error("Ajoutez au moins un passager.");
    passengers.forEach((p, i) => {
      const prefix = `Passager ${i + 1} : `;
      if (
        !/^[\p{L}\p{M} '’\-]{2,60}$/u.test(p.firstName) ||
        !/^[\p{L}\p{M} '’\-]{2,60}$/u.test(p.lastName)
      )
        throw new Error(
          prefix +
            "saisissez les noms tels qu’ils figurent sur le document d’identité (2 à 60 caractères).",
        );
      const dob = new Date(`${p.birthDate}T12:00:00Z`);
      const cutoff = FlightEngine.dateInZone(
        Date.now(),
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      );
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(p.birthDate) ||
        isNaN(dob) ||
        dob.toISOString().slice(0, 10) !== p.birthDate ||
        p.birthDate > cutoff ||
        p.birthDate > travelDate ||
        p.birthDate < "1900-01-01"
      )
        throw new Error(prefix + "la date de naissance est invalide.");
      if (
        !/^[A-Z0-9 -]{5,20}$/i.test(p.document) ||
        !["passport", "id"].includes(p.documentType)
      )
        throw new Error(
          prefix +
            "renseignez un numéro de passeport ou de CNI valide (5 à 20 caractères).",
        );
    });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email))
      throw new Error("Saisissez une adresse e-mail valide.");
    if (
      !/^\+?[0-9\s().-]{8,22}$/.test(contact.phone) ||
      contact.phone.replace(/\D/g, "").length < 8
    )
      throw new Error("Saisissez un numéro de téléphone valide.");
  }
  function create(draft, method) {
    if (window.FlightAPI?.checkout && draft.flights.some((f) => f.simulation === false))
      throw new Error("Une offre réelle doit être réservée par le service sécurisé.");
    if (!["voucher", "card", "apple"].includes(method))
      throw new Error("Mode de paiement invalide.");
    if (
      draft.flights.length !== draft.search.legs.length ||
      draft.flights.some((f) => f.departure <= Date.now())
    )
      throw new Error(
        "Votre sélection de vols a expiré. Relancez la recherche.",
      );
    if (draft.passengers.length !== draft.search.count)
      throw new Error("Complétez tous les passagers.");
    validatePassengers(draft.passengers, draft.contact, draft.flights[0].date);
    if (method === "voucher" && total(draft).total > CASH_LIMIT)
      throw new Error("PayEnCash : le plafond de 1 000 € en espèces est dépassé (art. L.112-6 et D.112-3 CMF). Choisissez la carte ou Apple Pay.");
    const records = all();
    draft.checkoutKey ||= crypto.randomUUID();
    const previous = records.find(r => r.checkoutKey === draft.checkoutKey);
    if (previous) return previous;
    const now = Date.now();
    const record = {
      checkoutKey: draft.checkoutKey,
      state: "INITIALIZED",
      stateHistory: [{ state: "INITIALIZED", at: now }],
      pnr: random(6),
      demo: true,
      paymentRail: method === "voucher" ? "PayEnCash" : method,
      voucherToken: method === "voucher" ? random(32) : null,
      fiscal: method === "voucher"
        ? { type: "BUM", issuer: "AJEK / PayEnCash", article: "256 ter CGI", vatAtVoucherIssue: 0, taxEvent: "TICKET_ISSUED" }
        : { type: "FLIGHT", taxEvent: "TICKET_ISSUED" },
      id: `VGC-${random(6)}`,
      createdAt: now,
      expiresAt: now + HOLD_SECONDS * 1000,
      status: "pending",
      method,
      voucher:
        method === "voucher" ? `VNC-2026-${random(5)}` : null,
      flights: clone(draft.flights),
      passengers: clone(draft.passengers),
      contact: clone(draft.contact),
      options: clone(draft.options),
      breakdown: total(draft),
      total: total(draft).total,
      tickets: [],
    };
    if (
      records.some(
        (r) =>
          r.id === record.id ||
          (record.voucher && r.voucher === record.voucher),
      )
    )
      return create(draft, method);
    transition(record, "HOLD_PENDING");
    if (method === "voucher") transition(record, "AWAITING_CASH");
    record.hold = {
      type: "hold", live_mode: false, booking_reference: record.pnr,
      payment_requirements: { requires_instant_payment: false },
      payment_required_by: new Date(record.expiresAt).toISOString(),
      price_guarantee_expires_at: new Date(record.expiresAt).toISOString(),
    };
    write(KEY, [record, ...records]);
    return record;
  }
  function confirm(id) {
    const records = all(),
      r = records.find((b) => b.id === id);
    if (!r) throw new Error("Réservation introuvable.");
    if (r.status === "confirmed") return r;
    if (r.status !== "pending")
      throw new Error(
        "Cette réservation est expirée ou annulée. Lancez une nouvelle recherche.",
      );
    transition(r, "PAYMENT_CAPTURED");
    r.capturedAt = Date.now();
    r.status = "confirmed";
    r.confirmedAt = Date.now();
    const used = new Set(records.flatMap((b) => b.tickets || []));
    r.tickets = r.passengers.map(() => {
      let ticket;
      do {
        ticket = `057-${random(10, "0123456789")}`;
      } while (used.has(ticket));
      used.add(ticket);
      return ticket;
    });
    transition(r, "TICKET_ISSUED");
    r.fiscal = { ...r.fiscal, regularizedAt: r.confirmedAt };
    write(KEY, records);
    return r;
  }
  function cancel(id) {
    const records = all(),
      r = records.find((b) => b.id === id);
    if (!r) throw new Error("Réservation introuvable.");
    if (!["confirmed", "pending"].includes(r.status))
      throw new Error("Cette réservation ne peut plus être annulée.");
    if (r.state === "TICKET_ISSUED" || r.state === "PAYMENT_CAPTURED") {
      transition(r, "REFUND_PENDING");
      r.refund = { status: "pending", amount: r.total, currency: "EUR", simulated: true };
    } else transition(r, "CANCELLED");
    r.status = "cancelled";
    r.cancelledAt = Date.now();
    write(KEY, records);
    return r;
  }
  function qr(payload) {
    const code = qrcode(0, "Q");
    code.addData(payload);
    code.make();
    const size = (code.getModuleCount() + 8) * 3;
    return code.createSvgTag({ cellSize: 4, margin: 16, scalable: true })
      .replace("<svg", `<svg class="qr-code" shape-rendering="crispEdges" style="--qr-size:${size}px"`);
  }
  const escape = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  function ticketHTML(r) {
    const F = FlightEngine;
    return `<div class="ticket-document"><div class="ticket-brand">voyagencash <span>e-billet de démonstration</span></div><div class="ticket-warning">SIMULATION · NON VALABLE POUR VOYAGER · Aucun billet émis par une compagnie</div><div class="ticket-heading"><div><small>Référence de réservation fictive</small><h2>${escape(r.pnr || r.id)}</h2></div><span class="badge">${r.status === "confirmed" ? "Simulation confirmée" : r.status === "cancelled" ? "Annulée" : "Non payé"}</span></div>${r.passengers.map((p, i) => `<article class="boarding-pass" tabindex="0" aria-label="Pass de voyage interactif"><div class="pass-main"><small>PASSAGER ${i + 1} · ÉCONOMIQUE</small><h3>${escape(p.firstName)} ${escape(p.lastName)}</h3><p>N° e-ticket fictif : ${escape(r.tickets[i] || "En attente")}</p>${r.flights.map((f) => `<div class="pass-flight"><div><b>${escape(f.from)}</b><span>${escape(F.airport(f.from).city)}</span><strong>${F.time(f.departure, f.from)}</strong></div><div class="pass-middle">${escape(f.airline.name)}<br>${f.segments.map((s) => escape(s.number)).join(" / ")}<br>${F.duration(f.duration)} · ${f.stops ? "1 escale" : "Direct"}</div><div><b>${escape(f.to)}</b><span>${escape(F.airport(f.to).city)}</span><strong>${F.time(f.arrival, f.to)}</strong></div></div><p class="pass-date">Départ : ${F.dateLabel(f.date, true)} · Arrivée : ${F.dateLabel(F.dateInZone(f.arrival, F.airport(f.to).tz))}<br>Horaires locaux · Terminaux ${escape(f.departureTerminal || "—")} / ${escape(f.arrivalTerminal || "—")} (simulés) · Siège et porte non attribués</p>${f.segments.length > 1 ? `<p class="muted">Escale à ${escape(F.airport(f.segments[0].to).city)} : ${F.duration((f.segments[1].departure - f.segments[0].arrival) / 60000)}</p>` : ""}`).join("")}</div><div class="pass-stub">${qr(`DEMO|${r.id}|${r.tickets[i] || "PENDING"}|${i + 1}`)}<b>${escape(r.id)}</b><small>Spécimen de carte d’embarquement</small></div></article>`).join("")}<div class="ticket-footer"><span>${r.options.baggage ? "Bagage en soute : 23 kg / passager / trajet" : "Petit sac sous le siège inclus"}<br>${r.options.guarantee ? "Garantie annulation simulée incluse" : "Sans garantie annulation"}</span><strong>Total TTC simulé : ${F.money(r.total)}</strong></div><p class="muted">Ce document ne permet ni l’enregistrement ni l’embarquement. Aucun paiement n’a été débité.</p></div>`;
  }
  function download(id) {
    const r = get(id);
    if (!r) throw new Error("Réservation introuvable.");
    const html = `<!doctype html><html lang="fr"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>voyagencash · ${escape(r.id)}</title><style>body{font:15px system-ui;color:#0B0F19;max-width:900px;margin:35px auto;padding:20px}.ticket-brand{font-size:28px;font-weight:800;color:#016bfd}.ticket-brand span,small,.muted{font-size:12px;color:#64748B}.ticket-warning{background:#EBF3FF;padding:14px;margin:20px 0}.ticket-heading,.ticket-footer,.pass-flight{display:flex;justify-content:space-between;gap:20px;align-items:center}.boarding-pass{display:flex;border:1px solid #cbd5e1;border-radius:16px;margin:20px 0;break-inside:avoid}.pass-main{padding:22px;flex:1}.pass-stub{padding:20px;max-width:150px;border-left:1px dashed #cbd5e1;text-align:center}.pass-stub svg{width:130px}.pass-stub small,.pass-flight span,.pass-flight strong{display:block}.pass-flight b{font-size:32px}.pass-middle{text-align:center;font-size:12px}.pass-flight{border-top:1px solid #e2e8f0;padding-top:20px}.pass-date{font-size:12px}.ticket-footer{margin:20px 0}button{padding:12px 20px;background:#016bfd;color:white;border:0;border-radius:8px;cursor:pointer}@media print{button{display:none}body{margin:0;padding:0}}@media(max-width:600px){.boarding-pass{display:block}.pass-stub{border-left:0;border-top:1px dashed #cbd5e1;max-width:none}.pass-flight{gap:8px}}</style><button onclick="window.print()">Imprimer / Enregistrer en PDF</button>${ticketHTML(r)}</html>`;
    const url = URL.createObjectURL(
      new Blob([html], { type: "text/html;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `voyagencash-${r.id}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function wallet(id) {
    const r = get(id);
    if (!r || r.status !== "confirmed") throw new Error("Confirmez votre réservation avant l’export Wallet.");
    const f = r.flights[0];
    const pass = {
      formatVersion: 1, passTypeIdentifier: "pass.voyagencash.demo", serialNumber: r.id,
      teamIdentifier: "DEMOONLY00", organizationName: "voyagencash",
      description: "Spécimen non signé · non valable pour voyager", logoText: "voyagencash",
      foregroundColor: "rgb(255,255,255)", backgroundColor: "rgb(11,15,25)",
      boardingPass: { transitType: "PKTransitTypeAir",
        primaryFields: [{ key: "from", label: "DÉPART", value: f.from }, { key: "to", label: "ARRIVÉE", value: f.to }],
        auxiliaryFields: [{ key: "pnr", label: "PNR SIMULÉ", value: r.pnr }],
        backFields: [{ key: "notice", label: "Démonstration", value: "Archive non signée, non importable dans Apple Wallet. Aucun titre de transport." }],
      },
    };
    const encoder = new TextEncoder();
    const name = encoder.encode("pass.json"), data = encoder.encode(JSON.stringify(pass, null, 2));
    let crc = 0xffffffff;
    for (const byte of data) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = new Uint8Array(30 + name.length + data.length), l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint32(14, crc, true);
    l.setUint32(18, data.length, true); l.setUint32(22, data.length, true); l.setUint16(26, name.length, true);
    local.set(name, 30); local.set(data, 30 + name.length);
    const central = new Uint8Array(46 + name.length), c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); central.set(name, 46);
    const end = new Uint8Array(22), e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, 1, true); e.setUint16(10, 1, true);
    e.setUint32(12, central.length, true); e.setUint32(16, local.length, true);
    const url = URL.createObjectURL(new Blob([local, central, end], { type: "application/vnd.apple.pkpass" }));
    const a = document.createElement("a"); a.href = url; a.download = `voyagencash-${r.id}-simulation.pkpass`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  window.BookingManager = {
    KEY,
    HOLD_SECONDS,
    CASH_LIMIT,
    wallet,
    attachVoucher(id, data) { const records=all(),record=records.find(r=>r.id===id);if(!record || !record.demo)throw new Error("Bon local introuvable.");if(record.status!=="pending")return record;const expiresAt=Math.min(record.expiresAt,data.expiresAt);Object.assign(record,data,{expiresAt});write(KEY,records);return record; },
    all,
    get,
    total,
    validatePassengers,
    create,
    confirm,
    cancel,
    qr,
    ticketHTML,
    download,
    escape,
    saveDraft: (d) => write(DRAFT, d),
    loadDraft: () => read(DRAFT, null),
    clearDraft: () => localStorage.removeItem(DRAFT),
  };
})();
