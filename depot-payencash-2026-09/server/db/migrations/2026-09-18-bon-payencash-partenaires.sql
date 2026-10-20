-- ════════════════════════════════════════════════════════════════════════════
-- 2026-09-18 — LE BON D’ACHAT PAYENCASH ET SON RÉSEAU DE VENTE (partenaires v2)
--
-- DÉCISION FONDATRICE (18/09) : le client achète chez un COMMERÇANT PARTENAIRE
-- (tabac, presse, commerce) un « Bon d’achat PayEnCash » — bon d'achat PRÉPAYÉ à
-- montant libre, payé en espèces au comptoir, utilisable sur payencash.fr
-- (Mode et Fly) en une ou plusieurs fois. Trois moyens « sans carte »
-- coexistent : le Bon d’achat, Neosurf (Paymentwall) et l'agent salarié. Le partenaire
-- ne touche à AUCUNE commande — c'est ce qui le distingue du réseau abandonné
-- le 17/09 : il VEND un titre, en encaisse le prix, et REVERSE chaque mois à
-- AJEK le montant vendu moins sa commission (1,10 % HT + TVA 20 % sur la
-- commission, autofacturée par AJEK — art. 289 CGI), par virement avant le 10
-- du mois suivant. Support : un code généré + un ticket imprimé — pas de carte,
-- pas de borne, pas de matériel.
--
-- FONDEMENT (Légifrance, lu le 18/09) :
--   · art. L521-3 I 1° CMF — moyen de paiement accepté « dans les locaux de
--     cette entreprise » : le Bon d’achat n'est accepté que par AJEK elle-même (sa
--     boutique en ligne) → hors agrément d'établissement de paiement ;
--     L521-3 II : déclaration à l'ACPR dès que la valeur des opérations des
--     12 derniers mois dépasse 1 000 000 € (silence = approbation, actualisation
--     annuelle). ⚠ L521-3-1 est l'exemption TÉLÉCOMS — jamais citée.
--   · art. L315-1 CMF — la monnaie électronique est « acceptée par une personne
--     autre que l'émetteur » : un bon d’achat accepté par le seul émetteur n'en est pas
--     (le pendant e-monnaie, L525-5 / L525-6, ne s'applique pas).
--   · art. 256 ter CGI — bon d’achat à usages multiples (biens Mode ET services Fly) :
--     la TVA n'est due qu'à l'utilisation, pas à la vente ; la commission du
--     distributeur est une prestation de services soumise à TVA 20 %.
--   · Espèces : L112-6 CMF (1 000 €) très au-dessus des 250 € par bon d’achat ; LCB-FT :
--     250 € par bon d’achat, 1 000 € de bons d’achat utilisés par client et par jour.
--   À VALIDER PAR L'AVOCAT : la qualification du contrat de distribution, la
--   déclaration ACPR au seuil, le sort des soldes expirés.
--
-- Ce que ce lot fait :
--   1. `partners` (v2) — le point de VENTE du Bon d’achat : cycle contrat_a_signer →
--      contrat_signe → actif · suspendu · clos ; sans borne, sans RIB (l'argent
--      va du partenaire vers AJEK). Définie AVANT tout ce qui la vise.
--   2. `gift_cards` ÉTENDUE — le Bon d’achat et la carte cadeau sont le MÊME objet :
--      origine (manager | partner), point vendeur, montant émis, solde, statut
--      écrit (active | blocked | cancelled — épuisé et expiré se DÉRIVENT),
--      n° de ticket, émission, validité, compte posé au premier usage.
--   3. `gift_card_movements` — émission, débits, re-crédits : le solde en dérive,
--      le plafond client/jour s'y lit, un re-crédit ne dépasse jamais les débits
--      de la commande.
--   4. `partner_remittances` + `partner_remittance_receipts` — le reversement
--      mensuel (relevé arrêté, échéance, reçus, autofacture AFB-<AAAAMM>-<code>).
--   5. `signature_links` RESTAURÉE — le lien jetonné + code à usage unique par
--      lequel le gérant signe le contrat de distribution (art. 1367 c. civ.).
--   6. Le pipeline retrouve la nature « point » et l'étape « signature » ;
--      `accounts`, `kyc_documents` et `audit_log` retrouvent le partenaire.
--   7. Le MOYEN « bon d’achat » partout où un moyen se lit : orders.pay_method,
--      payments.method, payment_tenders.method, client_invoices.payment_means,
--      le canal pay_channel, le remboursement (refund_method,
--      cancellation_requests) — et le valideur d'un paiement réglé par bon d’achat.
--
-- GARDE-FOU : rien n'est détruit. `gift_cards` existante est complétée ligne à
-- ligne (montant émis = solde, validité = création + 12 mois, ticket généré).
-- Idempotent : relançable sans risque.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

-- 1 ─ LE POINT DE VENTE DU BON D’ACHAT ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS partners (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  address         text,
  zip             text,
  city            text,
  phone           text,
  email           text,
  manager_name    text,
  siret           text CHECK (siret IS NULL OR siret ~ '^[0-9]{14}$'),
  status          text NOT NULL DEFAULT 'contrat_a_signer'
                  CHECK (status IN ('contrat_a_signer','contrat_signe','actif','suspendu','clos')),
  contract_signed_at timestamptz,
  signature_proof jsonb,
  activated_at    timestamptz,
  activated_by    text,
  suspended_at    timestamptz,
  suspension_reason text,
  status_before   text,
  closed_at       timestamptz,
  closure_reason  text,
  account_id      text,
  lead_id         uuid,
  referrer        text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS partners_siret_unique ON partners (siret) WHERE siret IS NOT NULL;
CREATE INDEX IF NOT EXISTS partners_par_statut ON partners (status, city);

-- 2 ─ LE BON D’ACHAT : gift_cards s'étend, ligne à ligne, sans rien perdre ───────────
CREATE SEQUENCE IF NOT EXISTS gift_cards_ticket_seq START 1;
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS origin           text NOT NULL DEFAULT 'manager';
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS partner_id       uuid;
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS face_value_cents integer;
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS status           text NOT NULL DEFAULT 'active';
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS ticket_number    text;
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS issued_at        timestamptz NOT NULL DEFAULT now();
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS issued_by        text;
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS expires_at       timestamptz;
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS cancelled_at     timestamptz;
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS cancel_reason    text;
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS blocked_at       timestamptz;
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS block_reason     text;

-- les cartes déjà en base : émises à leur création, du montant de leur solde, valables 12 mois (ref.bons.validiteMois)
UPDATE gift_cards SET issued_at = created_at WHERE issued_at IS DISTINCT FROM created_at AND face_value_cents IS NULL;
UPDATE gift_cards SET face_value_cents = balance_cents WHERE face_value_cents IS NULL;
UPDATE gift_cards SET expires_at = created_at + interval '12 months' WHERE expires_at IS NULL;
UPDATE gift_cards SET ticket_number = 'BV-' || lpad(nextval('gift_cards_ticket_seq')::text, 6, '0') WHERE ticket_number IS NULL;
ALTER TABLE gift_cards ALTER COLUMN face_value_cents SET NOT NULL;
ALTER TABLE gift_cards ALTER COLUMN expires_at       SET NOT NULL;
ALTER TABLE gift_cards ALTER COLUMN ticket_number    SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gift_cards_origin_check') THEN
    ALTER TABLE gift_cards ADD CONSTRAINT gift_cards_origin_check CHECK (origin IN ('manager','partner'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gift_cards_status_check') THEN
    ALTER TABLE gift_cards ADD CONSTRAINT gift_cards_status_check CHECK (status IN ('active','blocked','cancelled'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gift_cards_face_value_cents_check') THEN
    ALTER TABLE gift_cards ADD CONSTRAINT gift_cards_face_value_cents_check CHECK (face_value_cents > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gift_cards_partner_id_fkey') THEN
    ALTER TABLE gift_cards ADD CONSTRAINT gift_cards_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES partners(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gift_cards_ticket_number_key') THEN
    ALTER TABLE gift_cards ADD CONSTRAINT gift_cards_ticket_number_key UNIQUE (ticket_number);
  END IF;
  -- le code ne se retrouve QUE par son empreinte : elle est unique
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gift_cards_code_hash_key') THEN
    ALTER TABLE gift_cards ADD CONSTRAINT gift_cards_code_hash_key UNIQUE (code_hash);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS gift_cards_point_mois ON gift_cards (partner_id, issued_at) WHERE origin = 'partner';
CREATE INDEX IF NOT EXISTS gift_cards_compte     ON gift_cards (user_id) WHERE user_id IS NOT NULL;

-- 3 ─ LES MOUVEMENTS D'UN BON D’ACHAT ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gift_card_movements (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  gift_card_id  uuid NOT NULL REFERENCES gift_cards(id),
  kind          text NOT NULL CHECK (kind IN ('issue','debit','recredit')),
  amount_cents  integer NOT NULL CHECK (amount_cents > 0),
  order_ref     text,
  at            timestamptz NOT NULL DEFAULT now(),
  by_who        text,
  user_id       uuid REFERENCES users(id),
  reason        text
);
CREATE INDEX IF NOT EXISTS gift_card_movements_bon  ON gift_card_movements (gift_card_id, at);
CREATE INDEX IF NOT EXISTS gift_card_movements_jour ON gift_card_movements (user_id, at) WHERE kind = 'debit';
-- une carte déjà en base porte son émission : le solde doit se dériver des mouvements dès maintenant
INSERT INTO gift_card_movements (gift_card_id, kind, amount_cents, at, by_who)
SELECT g.id, 'issue', g.face_value_cents, g.issued_at, COALESCE(g.issued_by, 'migration')
  FROM gift_cards g
 WHERE NOT EXISTS (SELECT 1 FROM gift_card_movements m WHERE m.gift_card_id = g.id AND m.kind = 'issue');

-- 4 ─ LE REVERSEMENT MENSUEL ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS partner_remittances (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id         uuid NOT NULL REFERENCES partners(id),
  period_month       date NOT NULL,
  sales_cents        integer NOT NULL DEFAULT 0 CHECK (sales_cents >= 0),
  commission_ht_cents integer NOT NULL DEFAULT 0,
  vat_cents          integer NOT NULL DEFAULT 0,
  net_due_cents      integer NOT NULL DEFAULT 0,
  due_on             date NOT NULL,
  status             text NOT NULL DEFAULT 'due' CHECK (status IN ('due','partial','received','late')),
  received_cents     integer NOT NULL DEFAULT 0 CHECK (received_cents >= 0),
  received_at        timestamptz,
  received_by        text,
  bank_reference     text,
  self_invoice_number text UNIQUE,
  self_invoiced_at   timestamptz,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_id, period_month)
);
CREATE INDEX IF NOT EXISTS partner_remittances_echeance ON partner_remittances (due_on) WHERE status IN ('due','partial','late');

CREATE TABLE IF NOT EXISTS partner_remittance_receipts (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  remittance_id  uuid NOT NULL REFERENCES partner_remittances(id) ON DELETE CASCADE,
  amount_cents   integer NOT NULL CHECK (amount_cents > 0),
  bank_reference text NOT NULL,
  received_at    timestamptz NOT NULL DEFAULT now(),
  received_by    text NOT NULL
);
CREATE INDEX IF NOT EXISTS partner_remittance_receipts_mois ON partner_remittance_receipts (remittance_id, received_at);

-- 5 ─ LE LIEN DE SIGNATURE, RESTAURÉ ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS signature_links (
  token          text PRIMARY KEY,
  lead_id        uuid NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  sent_at        timestamptz NOT NULL DEFAULT now(),
  sent_by        text,
  expires_at     timestamptz NOT NULL,
  consumed_at    timestamptz,
  documents      text[] NOT NULL DEFAULT '{}',
  otp_channel    text CHECK (otp_channel IN ('sms','email')),
  otp_sent_at    timestamptz,
  otp_expires_at timestamptz,
  otp_verified_at timestamptz,
  otp_attempts   smallint NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS signature_links_lead ON signature_links (lead_id, sent_at DESC);

-- 6 ─ LE PIPELINE ET LES CONTRAINTES TRANSVERSES RETROUVENT LE PARTENAIRE ────
ALTER TABLE sales_leads DROP CONSTRAINT IF EXISTS sales_leads_lead_type_check;
ALTER TABLE sales_leads ADD  CONSTRAINT sales_leads_lead_type_check CHECK (lead_type IN ('point','fournisseur'));
ALTER TABLE sales_leads DROP CONSTRAINT IF EXISTS sales_leads_stage_check;
ALTER TABLE sales_leads ADD  CONSTRAINT sales_leads_stage_check
  CHECK (stage IN ('repere','visite','pitche','signature','invite','inscrit','signe','ouvert','perdu'));
ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS partner_id uuid;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_leads_partner_id_fkey') THEN
    ALTER TABLE sales_leads ADD CONSTRAINT sales_leads_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES partners(id);
  END IF;
END $$;

ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_espace_check;
ALTER TABLE accounts ADD  CONSTRAINT accounts_espace_check
  CHECK (espace IN ('client','agent','fournisseur','manager','hotline','commercial','partenaire'));
ALTER TABLE kyc_documents DROP CONSTRAINT IF EXISTS kyc_documents_scope_check;
ALTER TABLE kyc_documents ADD  CONSTRAINT kyc_documents_scope_check
  CHECK (scope IN ('fournisseur','client','partenaire'));
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_actor_type_check;
ALTER TABLE audit_log ADD  CONSTRAINT audit_log_actor_type_check
  CHECK (actor_type IN ('user','courier','supplier','manager','system','partner'));

-- 7 ─ LE MOYEN « BON D’ACHAT » PARTOUT OÙ UN MOYEN SE LIT ────────────────────────────
-- Une valeur S'AJOUTE à un enum PostgreSQL (elle ne s'en retire pas) : le canal et le remboursement gagnent 'bon'.
ALTER TYPE pay_channel   ADD VALUE IF NOT EXISTS 'bon';
ALTER TYPE refund_method ADD VALUE IF NOT EXISTS 'bon';

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_pay_method_chk;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_pay_method_check;
ALTER TABLE orders ADD  CONSTRAINT orders_pay_method_check
  CHECK (pay_method IS NULL OR pay_method IN ('neosurf','ideal','agent','bon'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_card_id uuid;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_gift_card_id_fkey') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_gift_card_id_fkey FOREIGN KEY (gift_card_id) REFERENCES gift_cards(id);
  END IF;
END $$;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_chk;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE payments ADD  CONSTRAINT payments_method_check
  CHECK (method IS NULL OR method IN ('neosurf','ideal','agent','bon'));
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gift_card_id uuid;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_gift_card_id_fkey') THEN
    ALTER TABLE payments ADD CONSTRAINT payments_gift_card_id_fkey FOREIGN KEY (gift_card_id) REFERENCES gift_cards(id);
  END IF;
END $$;
-- le valideur d'un règlement : l'agent, le prestataire, ou le serveur qui a débité un Bon d’achat sous verrou
ALTER TABLE payments DROP CONSTRAINT IF EXISTS valideur_obligatoire;
ALTER TABLE payments ADD  CONSTRAINT valideur_obligatoire
  CHECK (collected_at IS NULL OR courier_id IS NOT NULL OR psp_transaction_id IS NOT NULL
         OR (method = 'bon' AND gift_card_id IS NOT NULL));

ALTER TABLE payment_tenders DROP CONSTRAINT IF EXISTS payment_tenders_method_check;
ALTER TABLE payment_tenders ADD  CONSTRAINT payment_tenders_method_check
  CHECK (method IN ('cash','card','neosurf','ideal','bon'));
ALTER TABLE client_invoices DROP CONSTRAINT IF EXISTS client_invoices_payment_means_check;
ALTER TABLE client_invoices ADD  CONSTRAINT client_invoices_payment_means_check
  CHECK (payment_means IN ('especes','avoir','carte','neosurf','ideal','bon'));
ALTER TABLE cancellation_requests DROP CONSTRAINT IF EXISTS cancellation_requests_refund_method_check;
ALTER TABLE cancellation_requests ADD  CONSTRAINT cancellation_requests_refund_method_check
  CHECK (refund_method IN ('especes_agent','virement','psp','avoir_compagnie','bon'));
ALTER TABLE order_refunds ADD COLUMN IF NOT EXISTS gift_card_movement_id bigint;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_refunds_gift_card_movement_id_fkey') THEN
    ALTER TABLE order_refunds ADD CONSTRAINT order_refunds_gift_card_movement_id_fkey
      FOREIGN KEY (gift_card_movement_id) REFERENCES gift_card_movements(id);
  END IF;
END $$;

-- 8 ─ LES CLÉS CIRCULAIRES DU POINT (compte du gérant, prospect d'origine) ───
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'partners_account_fk') THEN
    ALTER TABLE partners ADD CONSTRAINT partners_account_fk FOREIGN KEY (account_id) REFERENCES accounts(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'partners_lead_fk') THEN
    ALTER TABLE partners ADD CONSTRAINT partners_lead_fk FOREIGN KEY (lead_id) REFERENCES sales_leads(id);
  END IF;
END $$;

COMMIT;
