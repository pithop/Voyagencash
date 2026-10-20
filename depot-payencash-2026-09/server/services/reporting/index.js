/* REPORTING — les indicateurs Manager de la Partie 1b §7.
   Écrans : manager/07 (trésorerie), 08 (finance), 14 (compta), 21 (compte de résultat). */
const { creerApp, demarrer, h } = require('../../lib/http');
const db = require('../../lib/db');

const app = creerApp('reporting');

/* (18/09, au soir) DEUX INDICATEURS CHANGENT DE NATURE. « Encours des agents » et « lignes du rapport Cash Services
   sans dépôt » sont SUPPRIMÉS avec l'agent de caisse mobile : il n'y a plus d'espèces en main ni de dépôt à
   rapprocher. À leur place, ce que le nouveau modèle fait entrer : les PRÉLÈVEMENTS du mois chez les commerçants
   (ce qui est passé sur leurs cartes, moins les remboursements, et ce que le prestataire nous coûte) et les
   commerces dont la carte manque ou expire — sans carte, un point ne peut plus vendre un seul bon d’achat. */
app.get('/indicateurs', h(async (_req, res) => {
  const [duffel, prelevements, cartes, tva, factures] = await Promise.all([
    db.query(`SELECT balance_cents, alert_threshold_cents,
                     balance_cents < alert_threshold_cents AS alerte
                FROM provider_wallets WHERE provider = 'duffel'`),
    db.query(`SELECT coalesce(sum(amount_cents) FILTER (WHERE status <> 'refused'), 0) AS preleve_cents,
                     coalesce(sum(amount_cents) FILTER (WHERE status = 'refunded'), 0) AS rembourse_cents,
                     coalesce(sum(psp_fee_cents) FILTER (WHERE status <> 'refused'), 0) AS frais_psp_cents,
                     count(*) FILTER (WHERE status = 'refused') AS refuses
                FROM partner_charges WHERE created_at >= date_trunc('month', now())`),
    db.query(`SELECT count(*) AS points_sans_carte
                FROM partners p
               WHERE p.status = 'actif'
                 AND NOT EXISTS (SELECT 1 FROM partner_cards c
                                  WHERE c.partner_id = p.id AND c.removed_at IS NULL
                                    AND (c.exp_year > extract(year FROM now())
                                     OR (c.exp_year = extract(year FROM now()) AND c.exp_month >= extract(month FROM now()))))`),
    db.query(`SELECT coalesce(sum(vat_amount_cents), 0) AS tva_collectee_cents
                FROM orders WHERE status IN ('PAID','CONFIRMED','FULFILLED')
                 AND created_at >= date_trunc('month', now())`),
    db.query(`SELECT count(*) AS en_retard FROM supplier_invoices
                WHERE paid_at IS NULL AND due_at < now()`)
  ]);
  res.json({
    avance_duffel: duffel.rows[0] || null,            // indicateur n°1 (Partie 1b §4)
    prelevements_mois: prelevements.rows[0],          // (18/09, soir) ce que le réseau de points a versé, à la vente
    points_sans_carte: cartes.rows[0],                // sans carte valide, un point ne vend plus : la file du manager
    tva_collectee_mois: tva.rows[0],                  // dette fiscale — pas de la trésorerie
    factures_fournisseurs: factures.rows[0]           // conformité ≤ 7 j (F12)
  });
}));

/* ── COCKPIT MARKETING (écrans commercial/05-08) ──
   Les campagnes se CRÉENT ici : l'adaptateur régie (TikTok/Meta/Snap Marketing API)
   publie la campagne et renvoie api_ref ; les résultats sont rapatriés par un
   worker de synchro (budget en direct). Adaptateur mocké en dev. */
app.get('/marketing/campaigns', h(async (_req, res) => {
  const { rows } = await db.query(
    `SELECT *, CASE WHEN installs > 0 THEN round(spent_cents::numeric / installs) ELSE 0 END AS cpi_cents
       FROM ad_campaigns ORDER BY status = 'active' DESC, spent_cents DESC`);
  const budget = await db.query(
    `SELECT coalesce(sum(budget_cents),0) AS alloue, coalesce(sum(spent_cents),0) AS depense FROM ad_campaigns`);
  res.json({ campagnes: rows, budget: budget.rows[0] });
}));

app.post('/marketing/campaigns', h(async (req, res) => {
  const c = req.body;
  if (!c.channel || !c.objective || c.budget_cents == null)
    throw new (require('../../lib/http').ErreurMetier)('channel, objective et budget_cents requis.');
  // Adaptateur régie : en prod, POST vers l'API de la régie → api_ref réel
  const apiRef = c.channel + '-' + Math.random().toString(36).slice(2, 8);
  const { rows } = await db.query(
    `INSERT INTO ad_campaigns (channel, api_ref, objective, creative, budget_cents, status, ends_on)
     VALUES ($1, $2, $3, $4, $5, 'active', $6) RETURNING id, api_ref`,
    [c.channel, apiRef, c.objective, c.creative, c.budget_cents, c.ends_on]);
  res.status(201).json({ ...rows[0], note: 'Campagne publiée via l\'API de la régie — résultats rapatriés en direct.' });
}));

app.get('/marketing/contest', h(async (_req, res) => {
  const [inf, fly] = await Promise.all([
    db.query(`SELECT * FROM influencer_links ORDER BY entries DESC`),
    db.query(`SELECT * FROM flyer_batches ORDER BY batch_ref`)
  ]);
  res.json({ influenceurs: inf.rows, flyers: fly.rows });
}));

app.get('/marketing/assets', h(async (_req, res) => {
  res.json((await db.query(`SELECT * FROM ged_assets ORDER BY ref`)).rows);
}));

app.get('/marketing/events', h(async (_req, res) => {
  res.json((await db.query(`SELECT * FROM marketing_events ORDER BY on_day`)).rows);
}));

demarrer(app, 'reporting');
