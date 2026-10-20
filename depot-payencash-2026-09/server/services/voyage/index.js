/* VOYAGE — recherche & commande vols/hébergements. Écrans : ecrans/01, parcours/01-03.
   Les fournisseurs sont derrière des ADAPTATEURS : Duffel (prépayé) et
   Nuitée (post-payé) — mock en dev, vraies clés en prod (env). */
const { creerApp, demarrer, h, ErreurMetier } = require('../../lib/http');
const db = require('../../lib/db');

const app = creerApp('voyage');

/* Adaptateur Duffel — interface stable, implémentation branchable (DUFFEL_API_KEY). */
const duffel = {
  chercher: async (q) => {
    const { rows } = await db.query(
      `SELECT * FROM flight_offers
        WHERE origin = $1 AND destination = $2 AND expires_at > now()
        ORDER BY total_cents LIMIT 20`, [q.origin, q.destination]);
    return rows; // en prod : POST https://api.duffel.com/air/offer_requests puis cache
  }
};

app.get('/offers', h(async (req, res) => {
  if (!req.query.origin || !req.query.destination)
    throw new ErreurMetier('origin et destination sont requis.');
  res.json(await duffel.chercher(req.query));
}));

/* Création de commande : prix bloqué 1 h.
   (18/09, au soir) Le PLAFOND ESPÈCES de 1 000 € (art. L112-6 CMF) ne s'applique plus ici : il ne concernait que les
   espèces remises à un agent, et il n'y a plus d'agent. (20/09) Une commande se règle par Bon d’achat PayEnCash,
   et lui seul — les plafonds qui restent sont ceux du BON D’ACHAT (250 € par bon d’achat, 1 000 € par client et
   par jour), et ils vivent dans `lib/bons.js`. Les FRAIS DE DÉPLACEMENT disparaissent avec le canal 'agent'. */
app.post('/orders', h(async (req, res) => {
  const { user_id, offer_id, channel, travellers = 1, services = [] } = req.body;
  const { rows } = await db.query(`SELECT * FROM flight_offers WHERE id = $1`, [offer_id]);
  const offre = rows[0];
  if (!offre) throw new ErreurMetier('Offre expirée — relance la recherche.', 410);
  if (channel && !['bon', 'soldee'].includes(channel))
    throw new ErreurMetier(`Canal de règlement inconnu : ${channel}. Le Bon d’achat PayEnCash, ou un avoir qui solde.`, 422);
  // Bagages & services (Duffel) : ajoutés À LA CRÉATION de l'order, le paiement
  // augmente de amount × quantity — le prix du service TEL QUEL, jamais re-margé.
  const servicesCents = services.reduce((s, sv) => s + (sv.amount_cents | 0) * (sv.quantity || 1), 0);
  const total = offre.total_cents * travellers + servicesCents;
  const ref = 'CMD-' + Math.random().toString(36).slice(2, 10).toUpperCase();
  const out = await db.tx(async (c) => {
    const o = (await c.query(
      `INSERT INTO orders (ref, user_id, line, status, channel, travellers,
                           subtotal_cents, total_price_cents, price_locked_until)
       VALUES ($1, $2, 'voyage', 'PRICE_LOCKED', $3, $4, $5, $6, now() + interval '1 hour')
       RETURNING id`, [ref, user_id, channel, travellers, offre.total_cents * travellers, total])).rows[0];
    const pref = 'PEC-' + Math.random().toString(36).slice(2, 10).toUpperCase();
    await c.query(
      `INSERT INTO payments (order_id, ref, amount_cents, channel)
       VALUES ($1, $2, $3, $4)`, [o.id, pref, total, channel]);
    for (const sv of services) {
      await c.query(
        `INSERT INTO order_services (order_id, service_type, provider_service_id, segment_ref, passenger_ref, quantity, amount_cents, maximum_weight_kg)
         VALUES ($1,'baggage',$2,$3,$4,$5,$6,$7)`,
        [o.id, sv.provider_service_id || null, sv.segment_ref || null, sv.passenger_ref || null, sv.quantity || 1, sv.amount_cents | 0, sv.maximum_weight_kg ?? null]);
    }
    return { ref, ref_paiement: pref, total_cents: total, services_cents: servicesCents };
  });
  res.status(201).json(out);
}));

/* ── ANNULATIONS & REMBOURSEMENTS (F10, spec-annulations) — le flux RÉEL :
   ① QUOTE : on interroge le fournisseur (Duffel : POST order_cancellations →
   devis pending avec expires_at · Nuitée : paliers du rate, refusé si NRFN/hors
   délai) puis la GRILLE calcule la restitution client ; ② le client ACCEPTE →
   CONFIRM avant l'expiration (sinon devis_perime → re-deviser) ; ③ restitution :
   (20/09) sur le MOYEN qui a payé quand c'est possible — un règlement par Bon d’achat PayEnCash se rend
   en RE-CRÉDITANT le bon —, sinon virement au RIB du client ; avoir compagnie transmis tel quel.
   (18/09, soir) Le décaissement « au point » et la remise d'espèces par l'agent n'existent plus : l'agent de caisse
   mobile est supprimé, il ne reste que le re-crédit du bon et le virement au RIB. */
const { grilleRestitution } = require('../../lib/remboursements');

const fournisseurs = {
  // adaptateurs — mock en dev, vraies clés en prod (env). Duffel renvoie un devis
  // QUI EXPIRE ; Nuitée répond selon refundableTag/cancelPolicyInfos.
  devisAnnulation: async (booking, causeVoulue) => {
    if (causeVoulue === 'nrfn') return { rendCents: 0, refundTo: 'payment_source', expiresAt: null, cause: 'nrfn' };
    const cause = causeVoulue || 'client_partiel';
    const taux = { compagnie: 1, client_flex: 1, client_partiel: 0.2 }[cause] ?? 0;
    return {
      rendCents: Math.round(booking.amount_cents * taux),
      refundTo: 'payment_source',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),   // le devis Duffel EXPIRE
      cause
    };
  }
};

/* ✈ CHANGEMENT DE VOL (Duffel Order Changes — vérifié 27/08) : ① éligibilité
   ("change" dans available_actions + change_before_departure du tarif) ; ② la
   COMPAGNIE propose ses vols de remplacement avec le prix EXACT (différence +
   pénalité — 0 si tarif modifiable/pack Flex) ; ③ le client valide ou garde son
   vol. L'HÔTEL n'a pas de route de modification : annuler (politique) + re-réserver. */
app.post('/orders/:ref/change/quote', h(async (req, res) => {
  const { rows } = await db.query(`SELECT o.*, sb.amount_cents FROM orders o
    JOIN supplier_bookings sb ON sb.order_id = o.id WHERE o.ref = $1 AND sb.provider = 'duffel'`, [req.params.ref]);
  const o = rows[0];
  if (!o) throw new ErreurMetier('Commande vol introuvable — un hôtel se modifie en annulant puis re-réservant (politique du tarif).', 404);
  // adaptateur mock : en prod, POST /air/order_change_requests puis lecture des offres
  const penalty = req.body.tarif_modifiable ? 0 : 5000;
  const diff = (req.body.nouvelle_date_plus_chere ? 2400 : 0);
  const { rows: oc } = await db.query(
    `INSERT INTO order_changes (order_id, status, change_total_cents, penalty_total_cents, new_total_cents, new_slices)
     VALUES ($1,'attente_accord',$2,$3,$4,$5) RETURNING *`,
    [o.id, diff, penalty, o.total_price_cents + diff + penalty, JSON.stringify(req.body.slices || [])]);
  res.json(oc[0]);   // le client voit le PRIX EXACT du changement — il valide, ou garde son vol
}));

app.post('/order-changes/:id/confirm', h(async (req, res) => {
  const { rows } = await db.query(`UPDATE order_changes SET status='confirme', decided_at=now() WHERE id=$1 RETURNING *`, [req.params.id]);
  if (!rows[0]) throw new ErreurMetier('Demande introuvable.', 404);
  res.json(rows[0]);
}));

/* (18/09, soir) NOS FRAIS DE SERVICE À RENDRE — correction d'un bug d'argent réel.
   AVANT : `fraisServiceCents: o.travel_fee_cents === 0 ? Math.max(300, Math.round(o.subtotal_cents * 0.15)) : 0`.
   Deux défauts, et le second coûtait au client :
     ① `orders.travel_fee_cents` N'EXISTE PLUS — la colonne est tombée avec l'agent de caisse mobile
       (db/migrations/2026-09-18-stripe-suppression-agent.sql, `ALTER TABLE orders DROP COLUMN travel_fee_cents`) ;
       elle ne survit qu'en commentaire dans schema.sql. `undefined === 0` étant FAUX, la branche prise était
       toujours `: 0` — autrement dit NOS FRAIS DE SERVICE N'ÉTAIENT JAMAIS RENDUS, alors que la grille F10 les rend
       intégralement quand la compagnie annule et quand le tarif est remboursable (Super Flex).
     ② la condition elle-même n'a plus d'objet : elle distinguait la commande où un agent s'était déplacé (frais de
       déplacement dus) de celle où il ne s'était pas déplacé. Plus personne ne se déplace : il n'y a plus de cas où
       les frais de service ne seraient pas dus. La condition disparaît, elle ne se remplace pas.
   APRÈS : les frais de service sont ce que nous avons GARDÉ sur cette réservation — le prix payé par le client moins
   ce que le fournisseur reçoit (`orders.subtotal_cents` − `supplier_bookings.amount_cents`, deux colonnes qui
   EXISTENT). Ce n'est pas un montant inventé : c'est la marge réelle, au centime, et elle reproduit la grille du
   data-layer sur le prix canonique (62,35 € = 41,74 base + 14,35 taxes + 6,26 de frais ; le fournisseur reçoit
   56,09 €, il reste 6,26 € — soit bien les 15 % du tarif de base). Pourquoi ne PAS recalculer la grille
   `max(3 €, 15 % du tarif de base)` : le TARIF DE BASE n'est pas atteignable depuis la commande — il vit dans
   `flight_offers.base_cents` et `orders` ne garde pas l'offre ; et le prix client est en outre plafonné au relevé
   Opodo − 0,02 €, que la formule seule ne reproduirait pas. La marge réelle, elle, est toujours exacte.
   Bornée à zéro : on ne rend jamais des frais qu'on n'a pas pris (une réservation vendue à perte n'ouvre pas un dû).
   La MÊME ligne de réservation que le devis (rows[0]) : les frais rendus couvrent exactement ce que le devis annule. */
app.post('/orders/:ref/cancel/quote', h(async (req, res) => {
  const { rows } = await db.query(`SELECT o.*, sb.id AS sb_id, sb.provider,
                                          sb.amount_cents, sb.amount_cents AS fournisseur_cents
    FROM orders o JOIN supplier_bookings sb ON sb.order_id = o.id WHERE o.ref = $1`, [req.params.ref]);
  const o = rows[0];
  if (!o) throw new ErreurMetier('Commande introuvable.', 404);
  const devis = await fournisseurs.devisAnnulation(o, req.body.cause);
  const fraisServiceCents = Math.max(0, Number(o.subtotal_cents) - Number(o.fournisseur_cents));
  const g = grilleRestitution({
    cause: devis.cause, fournisseurRendCents: devis.rendCents,
    fraisServiceCents,
    packPlusCents: 0, partBonCents: 0
  });
  const { rows: cr } = await db.query(
    `INSERT INTO cancellation_requests (order_id, scope, status, motif, reason_kind,
       provider_refund_cents, provider_refund_to, quote_expires_at,
       service_fee_refund_cents, pack_kept_cents, client_refund_cents, voucher_refund_cents, refund_method)
     VALUES ($1,'vol','attente_accord',$2,$3,$4,$5,$6,$7,$8,$9,$10,'virement') RETURNING *`,
    [o.id, req.body.motif || null, devis.cause, devis.rendCents, devis.refundTo, devis.expiresAt,
     g.fraisRendusCents, g.packConserveCents, g.clientCents, g.bonCents]);
  res.json(cr[0]);   // le CLIENT voit le montant exact — et accepte, ou pas
}));

app.post('/cancellations/:id/confirm', h(async (req, res) => {
  const { rows } = await db.query(`SELECT * FROM cancellation_requests WHERE id = $1`, [req.params.id]);
  const cr = rows[0];
  if (!cr) throw new ErreurMetier('Demande introuvable.', 404);
  if (cr.quote_expires_at && new Date(cr.quote_expires_at) < new Date()) {
    await db.query(`UPDATE cancellation_requests SET status='devis_perime' WHERE id=$1`, [cr.id]);
    throw new ErreurMetier('Le devis a expiré — on redemande le montant au fournisseur.', 409);
  }
  const { rows: up } = await db.query(
    `UPDATE cancellation_requests SET status='remboursement_du', decided_at=now() WHERE id=$1 RETURNING *`, [cr.id]);
  res.json(up[0]);   // puis : restitution (retour sur le moyen en ligne, ou virement au RIB — 18/09, soir : plus d'agent) → soldee
}));

app.get('/cancellations/:id', h(async (req, res) => {
  const { rows } = await db.query(`SELECT * FROM cancellation_requests WHERE id = $1`, [req.params.id]);
  if (!rows[0]) throw new ErreurMetier('Demande introuvable.', 404);
  res.json(rows[0]);
}));

demarrer(app, 'voyage');
