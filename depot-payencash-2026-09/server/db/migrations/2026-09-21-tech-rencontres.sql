-- =============================================================================
-- 2026-09-21 — DÉCISION FONDATRICE : « et pour payer, comment tu paies —
-- pourquoi c'est pas comme Fly et Mode, la carte etc. »
--
-- La page de paiement d'une boutique PayEnCash Solution montre désormais LE
-- choix « Comment veux-tu payer ? » de Mode et de Fly. Son chemin « un agent se
-- déplace » ne listait que des noms : il fait maintenant ce que fait celui de
-- Mode — une adresse de rendez-vous, une demande qui part aux revendeurs MOBILES
-- de la boutique, l'un d'eux la prend, vient, et remet un bon de la boutique.
--
-- Ce qui change par rapport à distributor_meetings : pas de compte client (le
-- numéro de rappel est laissé sur la rencontre, et effacé à sa clôture), pas
-- d'hôte qui confirme, pas de position partagée. Aucun fonds ne transite.
-- =============================================================================
BEGIN;

CREATE TABLE tech_meetings (
  id              text PRIMARY KEY,
  merchant_id     text NOT NULL REFERENCES tech_merchants(id),
  payment_link_id text NOT NULL REFERENCES tech_payment_links(id) ON DELETE CASCADE,
  reseller_id     text REFERENCES tech_resellers(id),
  amount_cents    integer NOT NULL CHECK (amount_cents > 0),
  addr_number     text NOT NULL, addr_street text NOT NULL, addr_postcode text NOT NULL, addr_city text NOT NULL,
  addr_floor      text, addr_door text, addr_instructions text,
  lat             numeric(9,6),
  lng             numeric(9,6),
  geo_approx      boolean NOT NULL DEFAULT true,
  contact_phone   text,
  contact_channel text NOT NULL DEFAULT 'appel' CHECK (contact_channel IN ('appel','whatsapp','facetime')),
  consent_text    text NOT NULL,                           -- l'accord d'être appelé, tel qu'il l'a lu (pas de compte où le ranger)
  consented_at    timestamptz NOT NULL,
  note            text,
  status          text NOT NULL DEFAULT 'demandee' CHECK (status IN ('demandee','acceptee','servie','annulee')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  accepted_at     timestamptz, served_at timestamptz, cancelled_at timestamptz,
  cancelled_by    text, cancel_reason text,
  voucher_id      text REFERENCES tech_vouchers(id),
  CONSTRAINT tech_meeting_prise CHECK (status IN ('demandee','annulee') OR reseller_id IS NOT NULL),
  CONSTRAINT tech_meeting_servie CHECK (status <> 'servie' OR (voucher_id IS NOT NULL AND served_at IS NOT NULL))
);
CREATE INDEX tech_meetings_lien ON tech_meetings (payment_link_id, status);
CREATE INDEX tech_meetings_revendeur ON tech_meetings (reseller_id, status);

COMMIT;
