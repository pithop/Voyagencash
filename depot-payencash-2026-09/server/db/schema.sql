-- =============================================================================
-- PayEnCash — SCHÉMA COMPLET (PostgreSQL 16)
-- Source de vérité : Partie 6 (données) + Partie 1b (financier) + Partie 6b (specs dev)
-- Règles transverses :
--   · TOUS les montants en CENTIMES (colonnes *_cents, INTEGER)
--   · plus une seule espèce ne passe par AJEK (18/09, soir) et plus un seul titre tiers (20/09) : le client
--     achète un Bon d’achat PayEnCash au comptoir d'un commerçant, qui encaisse POUR SON PROPRE COMPTE
--   · TVA par ligne de commande (vat_scheme) — jamais recalculée à l'affichage
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉNUMÉRATIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TYPE order_status AS ENUM
  ('DRAFT','PRICE_LOCKED','AWAITING_CASH','PAID','CONFIRMED','FULFILLED','CANCELLED','REFUNDED','FAILED');
-- (18/09, soir — suppression de l'agent de caisse mobile) COLLECTION_FAILED est RETIRÉ : il ne décrivait qu'une chose,
-- « l'agent est venu et l'encaissement à domicile n'a pas abouti » — plus personne ne se déplace compter des espèces.
-- FAILED reste « somme encaissée, émission refusée par le fournisseur ». L'expiration est un CANCELLED horodaté par
-- orders.expired_at.
CREATE TYPE order_line   AS ENUM ('voyage','promo','mode');
-- (18/09, soir — « supprime l'agent qui se déplace » ; 20/09 — « enlève la logique Neosurf ») LE CANAL DE
-- RÈGLEMENT N'EN COMPTE PLUS QUE DEUX. 'agent' est parti avec l'agent de caisse mobile : personne, chez PayEnCash,
-- ne touche plus d'espèces — ni à domicile, ni en tournée, ni au coffre. 'psp' part à son tour avec le réseau
-- tiers : il n'y a plus de page hébergée ni de notification de prestataire pour régler une commande. Restent le
-- Bon d’achat PayEnCash, et l'avoir qui solde tout.
-- 'soldee' = commande entièrement couverte DÈS SA NAISSANCE par un avoir et/ou un Bon d’achat PayEnCash appliqués au sac
-- (PEC_DATA.commanderPanier) : rien ne s'encaisse. (19/09, soir) Elle est malgré tout ANNONCÉE puis DÉCLARÉE PAYÉE par le bus
-- (PEC_BUS.payer par:'soldee', refusé dès qu'il reste un centime dû) : sans ce passage, elle n'existait nulle part ailleurs que
-- sur l'appareil de la cliente — ni reçu, ni date de paiement, invisible du back-office. `payments.method` dit alors ce qui l'a
-- réellement soldée ('bon' ou l'avoir), le débit du bon d’achat restant la preuve dans gift_card_movements.
-- (18/09) 'bon' = commande ENTIÈREMENT réglée par un Bon d’achat PayEnCash (PEC_BUS.payer par:'bon') : le serveur débite le bon d’achat
-- sous verrou, et le mouvement 'debit' de gift_card_movements en est la preuve. Un bon d’achat qui ne couvre qu'une PART de la
-- commande est appliqué (orders.gift_card_id) et le reste se règle par un AUTRE bon : une commande peut en porter
-- plusieurs (au-delà de 250 €, la vente au comptoir se découpe en série).
-- `cash_state` (collected → declared → reconciled → on_account → paid_out) DISPARAÎT du schéma avec le cycle du cash :
-- il ne décrivait que le trajet des espèces de la main de l'agent à l'automate de dépôt.
CREATE TYPE pay_channel  AS ENUM ('bon','soldee');
CREATE TYPE vat_scheme   AS ENUM ('marge_voyage','marge_occasion','tva_20');  -- Partie 1b §5
CREATE TYPE supplier_status AS ENUM ('candidate','kyb_pending','active','watch','suspended');
CREATE TYPE piece_status AS ENUM ('soumis','valide_publie','vendu_achat_ferme','ramasse','controle','expedie');
-- Axe ÉDITORIAL de publication (Blueprint §3) — ORTHOGONAL à piece_status (parcours PHYSIQUE).
-- draft (édition) → in_review (contrôle) → scheduled (publie à publish_at) → live (visible/achetable)
--   → out_of_stock (indexé, non achetable) · archived (retiré).
CREATE TYPE editorial_status AS ENUM ('draft','in_review','scheduled','live','out_of_stock','archived');
CREATE TYPE piece_controle AS ENUM ('conforme','recote','refuse');
-- Cycle de vie de l'ACHAT FERME (purchase_orders) : confirmé à l'encaissement,
-- re-coté (prix ajusté au contrôle atelier) ou annulé (refus atelier).
CREATE TYPE po_status AS ENUM ('confirme','recote','annule');
-- (11/09 — lot 9) LE PARCOURS RÉEL D'UN COLIS. L'enum démarrait à « étiquette créée » : il manquait l'état AVANT
-- l'étiquette (le fournisseur doit encore préparer — c'est là que se mesure son retard) et l'état où le colis part
-- d'abord à l'atelier pour contrôle aléatoire. Trois des six clés ne correspondaient à aucune écriture du JS.
CREATE TYPE shipment_status AS ENUM
  ('to_ship','label_created','picked_up','in_transit','at_relay','delivered','blocked_control','control_refused','returned');
-- 'control_refused' : le contrôle qualité de l'atelier a REFUSÉ la pièce — le colis ne repart pas au client.
CREATE TYPE settlement_status AS ENUM ('not_due','settled','failed');       -- Nuitée post-payé
CREATE TYPE kyc_level AS ENUM ('declaratif','pvid');                        -- gradué (Partie 1b §3)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · COMPTES & IDENTITÉ
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           text UNIQUE NOT NULL,
  phone_verified_at timestamptz,                                 -- N° validé par code SMS — INDISPENSABLE avant la 1ʳᵉ commande (récap bloqué sinon)
  email           text UNIQUE,
  email_verified_at timestamptz,                                 -- e-mail validé par lien — indispensable : c'est là qu'arrivent PNR/e-billets
  full_name       text NOT NULL,
  gender          text CHECK (gender IN ('m','f','x')),          -- civilité du titulaire : m/f (Duffel) + x = autre/non précisé
  born_on         date,                                          -- date de naissance du titulaire → âge (majorité, KYC) ; jamais l'âge stocké, il se calcule
  kyc_level       kyc_level NOT NULL DEFAULT 'declaratif',
  kyc_verified_at timestamptz,
  loyalty_points  integer NOT NULL DEFAULT 0,          -- cagnotte (concours FLY)
  preferences     jsonb NOT NULL DEFAULT '{}',                    -- (07/09) préférences qui SUIVENT le client : tailles habituelles, aéroport de départ par défaut
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Seuil KYC gradué : > 3 achats OU > 1 000 € cumulés / 7 j ⇒ PVID (contrôle applicatif, service identite)

-- ═══ (18/09) LE BON D’ACHAT PAYENCASH ET SON RÉSEAU DE VENTE ═════════════════════════════════════════════════════════════
-- DÉCISION FONDATRICE DU 18/09 : le client achète chez un COMMERÇANT PARTENAIRE (tabac, presse, commerce) un « Bon d’achat
-- PayEnCash » — bon d'achat PRÉPAYÉ à montant libre, payé en espèces au comptoir, utilisable sur payencash.fr (Mode et
-- Fly) en une ou plusieurs fois. (20/09) IL N'Y A QU'UN SEUL MOYEN « sans carte », et c'est le nôtre : l'agent salarié qui
-- se déplaçait compter les espèces est abandonné (18/09, soir), et le titre d'un réseau tiers l'est à son tour (20/09).
-- Le partenaire ne touche à AUCUNE commande : il VEND un titre et en encaisse le prix POUR SON PROPRE COMPTE.
-- (18/09, soir — décision fondatrice) IL NE REVERSE PLUS RIEN : sa carte bancaire enregistrée est DÉBITÉE à chaque
-- vente du montant du bon d’achat moins sa commission (1,10 % HT + TVA 20 % sur la commission, autofacturée par AJEK —
-- art. 289 CGI). Il ne détient donc jamais notre argent, fût-ce un jour : la question de la détention de fonds tombe.
-- FONDEMENT (Légifrance, lu le 18/09) : titre accepté par le seul émetteur, AJEK, « dans les locaux de cette entreprise »
-- — art. L521-3 I 1° CMF (hors agrément d'établissement de paiement ; déclaration à l'ACPR au-delà d'1 M€ d'opérations
-- sur 12 mois, L521-3 II) ; hors monnaie électronique, qui est « acceptée par une personne autre que l'émetteur »
-- (art. L315-1 CMF a contrario) ; bon d’achat à usages multiples, TVA due à l'UTILISATION, pas à la vente (art. 256 ter CGI) —
-- la commission du distributeur est une prestation soumise à TVA. Plafonds LCB-FT : 250 € par bon d’achat, 1 000 € de bons d’achat
-- utilisés par client et par jour, minimum 5 €, validité 12 mois — valeurs VIVES (settings bons d’achat.* / ref.bons), jamais
-- figées ici. Miroir de PEC_DATA : partenaires() → partners · pec-bons → gift_cards + gift_card_movements ·
-- partenaireCarte* → partner_cards · prelevementPartenaire / prelevementRembourser → partner_charges ·
-- releveMensuel → la vue v_partner_monthly_statements (un relevé se CALCULE, il ne se stocke pas).
-- `partners` est DÉFINIE ICI, avant tout ce qui la vise (gift_cards, sales_leads) : une clé étrangère ne peut viser
-- qu'une table déjà créée. Ses deux liens vers des tables définies plus bas (accounts, sales_leads) sont posés en fin
-- de fichier, comme les autres clés circulaires.
CREATE TABLE partners (                                  -- (18/09) LE POINT DE VENTE DU BON D’ACHAT — il vend un titre, il n'encaisse jamais une commande
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,                         -- l'enseigne (« Tabac du Port »)
  address         text,
  zip             text,
  city            text,
  phone           text,
  email           text,                                  -- l'e-mail du gérant : c'est là que part l'invitation à créer l'accès
  manager_name    text,                                  -- le gérant tel qu'il figure au Kbis — le signataire du contrat de distribution
  siret           text CHECK (siret IS NULL OR siret ~ '^[0-9]{14}$'),   -- 14 chiffres : la clé du contrôle KYB et du contrat
  -- LE CYCLE DE VIE (PEC_DATA.PARTENAIRE_STATUTS = STATUT_SQL.partenaire) : un point naît « contrat à signer »
  -- (inscription partenaire/00 ou pipeline commercial), passe « contrat signé — intégration » à la signature
  -- (contratPartenaireSigner), puis « actif » (partenaireActiver : contrat SIGNÉ et dossier KYB VALIDÉ au coffre) —
  -- seul l'état actif ouvre la vente. « suspendu » coupe la vente (status_before rend l'état d'avant à la réactivation) ;
  -- « clos » = contrat résilié : les bons d’achat déjà vendus restent valables pour les clients — rien n'est dû de part ni
  -- d'autre, chaque vente ayant déjà été réglée à la seconde près (partner_charges).
  -- (19/09, soir) 'refuse' : le manager ne pose pas la zone, il ACCEPTE ou REFUSE la relation commerciale — motif obligatoire
  status          text NOT NULL DEFAULT 'contrat_a_signer' CHECK (status IN ('contrat_a_signer','contrat_signe','actif','refuse','suspendu','clos')),
  contract_signed_at timestamptz,                        -- la signature (au comptoir avec le commercial, ou par le lien jetonné)
  signature_proof jsonb,                                 -- la preuve d'une signature par lien : canal (sms | email), destinataire masqué, horodatage (art. 1367 c. civ.)
  activated_at    timestamptz,                           -- partenaireActiver — la porte de la vente
  activated_by    text,                                  -- le manager qui a activé
  suspended_at    timestamptz,                           -- partenaireSuspendre
  suspension_reason text,                                -- motif OBLIGATOIRE : le partenaire le lit
  status_before   text,                                  -- l'état d'avant la suspension — partenaireReactiver le REND, il ne décrète pas « actif »
  closed_at       timestamptz,                           -- partenaireCloturer : résiliation du contrat
  closure_reason  text,                                  -- motif obligatoire (départ, fermeture, manquement…)
  -- (19/09) LE TAUX DE COMMISSION DE CE COMMERCE (= PEC_DATA.commissionPoint / partenaireCommissionSet, réglé par le
  -- manager en 10-configuration). NULL n'est PAS zéro : c'est « le taux du réseau » (settings 'ref.bons.commissionPct')
  -- — la colonne est nullable pour cette seule raison, et c'est ce qui permet de RETIRER une exception sans avoir à
  -- la remplacer par un chiffre. Le taux qui s'applique à une vente est FIGÉ sur sa charge (partner_charges), jamais
  -- relu ici : changer ce taux ne réécrit aucune vente passée. Il est écrit dans le contrat de distribution du point :
  -- dès qu'il bouge, la pièce signée passe « avenant à signer » (conditionsEcart). La borne haute suit le taux de TVA :
  -- au-delà, la commission TTC atteindrait la valeur faciale et il ne resterait rien à prélever.
  commission_pct  numeric(5,3) CHECK (commission_pct IS NULL OR (commission_pct >= 0 AND commission_pct < 100)),
  /* (23/09, fondatrice : « chaque membre affiche SON prix de déplacement, nous le mettons en concurrence ») LE
     TARIF DU COMMISSIONNAIRE MOBILE. Il le pose lui-même et le change quand il veut ; PayEnCash n'en fixe ni
     plancher, ni plafond, ni valeur conseillée — c'est ce qui fait de lui un indépendant, et c'est le critère
     qu'un juge regarde en premier (Cass. soc., 4 mars 2020, n° 19-13.316). NULL = il n'en a pas encore posé. */
  travel_fee_cents integer CHECK (travel_fee_cents IS NULL OR travel_fee_cents > 0),
  -- Le KYB du point n'est PAS une colonne : il se DÉRIVE de kyc_documents (scope 'partenaire' : kbis, cni, video, contrat).
  -- Aucun RIB de point, et (18/09, soir) aucune donnée de carte ici non plus : le moyen de règlement du commerce vit
  -- dans `partner_cards`, sous la forme d'une EMPREINTE rendue par le prestataire — jamais un numéro.
  account_id      text,                                  -- le compte du gérant (accounts, espace 'partenaire') — table définie plus bas : FK en fin de fichier
  lead_id         uuid,                                  -- le prospect du pipeline dont ce point est né (sales_leads) — table définie plus bas : FK en fin de fichier
  referrer        text,                                  -- l'APPORTEUR : l'identifiant du commercial, jamais un libellé
  /* (19/09, soir — décisions fondatrices « réintègre l'app agent » et « le partenaire et l'agent ont le MÊME
     contrat, cependant l'autre est mobile, il se déplace ») LE MODE D'EXERCICE. Le contrat de distribution de
     bons d'achat et de mandat d'encaissement pour compte de tiers est le même pour les deux : dans les deux cas
     un micro-entrepreneur, mandataire TRANSPARENT, qui vend nos bons en notre nom. Ce qui change, c'est où :
       · 'sedentaire' — un commerce, une adresse (address/zip/city renseignés) : le client s'y rend ;
       · 'mobile'     — pas d'adresse : il définit LUI-MÊME sa zone (zone_cities) et se déplace.
     C'est ce qui ramène l'agent supprimé le 18/09 au soir : il n'est plus un salarié qui transporte des fonds,
     c'est un indépendant sous mandat — l'encaissement reste le prélèvement à la vente sur SA carte.
     LE MANAGER NE POSE PAS LA ZONE : il accepte (status 'active') ou refuse (status 'refused', refusal_reason). */
  mode            text NOT NULL DEFAULT 'sedentaire' CHECK (mode IN ('sedentaire','mobile')),
  zone_cities     text[],                                -- les villes où un MOBILE se déplace — choisies dans le réseau, jamais saisies
  zone_radius_km  integer CHECK (zone_radius_km IS NULL OR (zone_radius_km > 0 AND zone_radius_km <= 100)),
  refusal_reason  text,                                  -- pourquoi la relation commerciale a été refusée (motif obligatoire)
  CONSTRAINT mobile_sans_adresse CHECK (mode <> 'mobile' OR address IS NULL OR address = ''),
  CONSTRAINT mobile_a_une_zone   CHECK (mode <> 'mobile' OR status <> 'actif' OR (zone_cities IS NOT NULL AND array_length(zone_cities, 1) >= 1)),
  created_at      timestamptz NOT NULL DEFAULT now()
);

/* ══ (19/09, soir) LES RENCONTRES — « RENCONTRE UN AGENT », l'ancien « paiement à domicile » renommé ════════
   Ce que le client demande, c'est un BON D'ACHAT — pas l'encaissement de sa commande : l'agent ne vend que des
   bons, le client les pose ensuite sur son sac, et le pivot tient (deux moyens, et rien d'autre).
   LE LIEU EST PUBLIC par défaut : on ne demande pas une adresse de domicile pour une rencontre d'argent.
   Une demande n'est pas ATTRIBUÉE : elle est PRISE, par le premier distributeur mobile dont la zone la couvre. */
CREATE TABLE distributor_meetings (
  id            text PRIMARY KEY,                        -- RDV-00001 — la référence que le client et l'agent citent
  client_id     text NOT NULL,                           -- le compte qui demande (accounts / clients)
  partner_id    text REFERENCES partners(id),            -- le distributeur qui l'a PRISE ; NULL tant que personne
  amount_cents  integer NOT NULL CHECK (amount_cents > 0),
  vouchers_n    integer NOT NULL CHECK (vouchers_n >= 1), -- combien de bons la vente demandera (plafond LCB-FT par bon)
  city          text NOT NULL,
  place         text NOT NULL,                           -- ce que le distributeur lit : « Domicile · 12 rue des Lilas, 13001 Marseille »
  /* (19/09, nuit) OÙ IL VIENT — une ADRESSE, et rien d'autre depuis le 20/09 (« enlève chez moi, uniquement
     Adresse de rencontre ») : le duo « chez moi / lieu public » posait une question qui n'en était pas une,
     puisque dans les deux cas le distributeur vient à un endroit qui s'écrit pareil. `place_kind` est donc
     tombé, et l'adresse est obligatoire.
     Elle est RECOPIÉE ici, pas seulement référencée : le client peut la modifier ou la supprimer de son
     carnet après coup, le distributeur doit garder CELLE qu'il a acceptée — même règle qu'un prix convenu.
     address_id ne sert donc qu'à retrouver l'origine, et il tombe à NULL si l'adresse est supprimée. */
  address_id    text,                                    -- → addresses(id) : clé posée en fin de fichier, la table du carnet vit avec les données du client
  addr_line1    text NOT NULL, addr_postcode text, addr_city text NOT NULL,
  addr_floor    text, addr_door text, addr_instructions text,
  /* (20/09, soir — « le choix d'horaire est illogique CAR LES COMMANDES SONT BLOQUÉES, enlève ça »)
     IL N'Y A PLUS D'HEURE. `when_at` / `when_text` sont supprimées : une commande est verrouillée le temps
     de la fenêtre d'encaissement, et un rendez-vous pris au-delà n'aurait pas lieu. La seule durée qui
     vaille est `expires_at`, juste en dessous — la demande vit dans la fenêtre, ou elle tombe. */
  access_note   text,                                    -- (19/09, nuit) les précisions d'accès « devant la pharmacie, veste rouge » : le client les écrit, l'agent les lit
  /* (19/09, nuit) LE POINT DE RENDEZ-VOUS. C'est la position que le client a PARTAGÉE ; s'il ne l'a pas fait,
     c'est le centre de sa ville, et geo_approx le DIT — l'écran ne fait jamais croire à un point au mètre près. */
  lat           numeric(9,6),
  lng           numeric(9,6),
  geo_approx    boolean NOT NULL DEFAULT true,
  /* (23/09) LE DÉPLACEMENT SE FIGE AU CHOIX, PLUS À LA DEMANDE : il naît de la proposition que le client
     retient (distributor_meeting_offers), et il ne bouge plus ensuite. NULL tant que personne n'est choisi —
     on n'écrit jamais un montant que le client n'a pas encore vu. */
  travel_fee_cents integer CHECK (travel_fee_cents IS NULL OR travel_fee_cents > 0),
  status        text NOT NULL DEFAULT 'demandee' CHECK (status IN ('demandee','acceptee','servie','annulee','expiree')),
  cancel_reason text,
  expires_at    timestamptz NOT NULL,                    -- la fenêtre du scénario : passée, la demande tombe d'elle-même
  accepted_at   timestamptz,
  served_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prise_a_un_distributeur CHECK (status IN ('demandee','annulee','expiree') OR partner_id IS NOT NULL)
  -- (20/09) la contrainte « adresse si chez le client » est devenue le NOT NULL de addr_line1 / addr_city :
  -- toute rencontre a une adresse, sinon le distributeur accepterait une course aveugle.
);
CREATE INDEX idx_meetings_open ON distributor_meetings (city, status) WHERE status = 'demandee';

/* ══ (20/09 — décision fondatrice « lorsque je passe par un agent qui se déplace, aucune carte avec l'agent qui
   arrive — or il y avait toute cette logique dans les anciens commits ») LA POSITION VIVE D'UN RENDEZ-VOUS ══
   Le distributeur qui a PRIS une rencontre partage où il en est, le temps d'arriver. Ce n'est pas le suivi d'un
   employé : c'est un indépendant qui dit à quelqu'un qui l'attend qu'il approche. La table est donc bornée des
   deux côtés, et c'est ce qui la rend acceptable :
     · UNE LIGNE PAR RENDEZ-VOUS (clé primaire) — pas d'historique de déplacement, rien à recouper ;
     · UNE DURÉE DE VIE (ref.rencontre.positionTtlMin, 30 min) — au-delà, la position N'EST PLUS RENDUE, et
       l'écran dit « on ne sait pas où il est » plutôt que de montrer une épingle qui ment ;
     · EFFACÉE à la fermeture du rendez-vous (servi, annulé) — PEC_BUS.oublierPosition.
   L'heure d'arrivée estimée ne se stocke JAMAIS : elle se dérive de la distance et de ref.rencontre.vitesseMMin. */
CREATE TABLE meeting_positions (
  meeting_id  text PRIMARY KEY REFERENCES distributor_meetings(id) ON DELETE CASCADE,
  partner_id  text NOT NULL REFERENCES partners(id),     -- qui partage : le distributeur qui a PRIS la rencontre
  lat         numeric(9,6) NOT NULL,
  lng         numeric(9,6) NOT NULL,
  at          timestamptz NOT NULL DEFAULT now()         -- l'heure du point : c'est elle que le TTL compare
);

/* Les bons nés d'une rencontre : un bon appartient à UNE rencontre au plus (une vente découpée en donne N). */
CREATE TABLE meeting_vouchers (
  meeting_id  text NOT NULL REFERENCES distributor_meetings(id),
  gift_card_id uuid NOT NULL,                            -- gift_cards.id — FK posée en fin de fichier avec les autres
  PRIMARY KEY (meeting_id, gift_card_id)
);

/* ══ (19/09, soir — « l'agent est noté ») LA NOTE D'UN DISTRIBUTEUR ═════════════════════════════
   Elle se DÉRIVE : aucune moyenne stockée sur partners. On ne note que ce qu'on a vécu — une note appartient à
   UNE rencontre SERVIE, et il n'y en a qu'une par rencontre (c'est la clé primaire qui l'impose). */
CREATE TABLE distributor_ratings (
  meeting_id  text PRIMARY KEY REFERENCES distributor_meetings(id),
  partner_id  text NOT NULL REFERENCES partners(id),
  client_id   text NOT NULL,
  rating      smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX partners_siret_unique ON partners (siret) WHERE siret IS NOT NULL;   -- un commerce = un point (partenaireParSiret)
CREATE INDEX partners_par_statut ON partners (status, city);                             -- « Où acheter un Bon d’achat » : les actifs, par ville (pointsBons)

-- (18/09) LE BON D’ACHAT. Il naît d'une VENTE au comptoir (origin 'partner' : point ACTIF, espèces reçues confirmées) ou d'une
-- ÉMISSION du manager (origin 'manager' : c'est alors une carte cadeau — le même objet). Le code (12 caractères, alphabet
-- sans 0/O/1/I : il se dicte au téléphone et se relit sur un ticket) n'est JAMAIS stocké en clair : rendu UNE fois à
-- l'émission (ticket imprimé), la base n'en garde que l'empreinte (code_hash) et la forme masquée. Seuls « bloqué » et
-- « annulé » s'ÉCRIVENT : « épuisé » (balance_cents = 0) et « expiré » (expires_at passé) se DÉRIVENT — une seconde
-- vérité stockée à côté du solde finirait par diverger. Le solde ne bouge que par gift_card_movements (issue / debit /
-- recredit) ; un débit ne se fait que sous verrou (FOR UPDATE), de la part que le bon d’achat règle (usage fractionné).
-- Jamais de remboursement en espèces : un remboursement de commande réglée par bon d’achat RE-CRÉDITE le bon d’achat.
CREATE TABLE gift_cards (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_masque     text NOT NULL,                        -- ••••-••••-XXXX (jamais le code en clair)
  code_hash       text NOT NULL UNIQUE,                 -- l'empreinte du code normalisé : c'est par elle qu'un bon d’achat se retrouve (lib/bons.hacherCode)
  origin          text NOT NULL DEFAULT 'manager' CHECK (origin IN ('manager','partner')),   -- (18/09) carte cadeau du manager | Bon d’achat vendu par un partenaire
  partner_id      uuid REFERENCES partners(id),         -- (18/09) le point qui l'a vendu (origin 'partner') — c'est lui qui le reverse
  face_value_cents integer NOT NULL CHECK (face_value_cents > 0),   -- (18/09) le montant payé au comptoir — entre bons.minimum et bons.plafondBon (contrôle service)
  balance_cents   integer NOT NULL CHECK (balance_cents >= 0),      -- le solde restant (usage fractionné) — épuisé = 0
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked','cancelled')),   -- (18/09) = STATUT_SQL.bon ; épuisé / expiré DÉRIVÉS (balance_cents, expires_at)
  ticket_number   text NOT NULL UNIQUE,                 -- (18/09) 'BV-000012' — le n° du ticket imprimé (gift_cards_ticket_seq = pec-bons-seq)
  issued_at       timestamptz NOT NULL DEFAULT now(),   -- (18/09) l'émission (emisLe) — c'est ce mois-là qui entre au relevé du point
  issued_by       text,                                 -- (18/09) qui a émis : l'identifiant du compte partenaire, ou du manager
  expires_at      timestamptz NOT NULL,                 -- (18/09) issued_at + bons.validiteMois (12 mois) ; prolongé par un re-crédit après expiration
  user_id         uuid REFERENCES users(id),            -- posé au PREMIER usage : le bon d’achat anonyme rejoint le compte qui l'utilise (« Mes bons d’achat », plafond client/jour)
  valid_lines     order_line[] NOT NULL DEFAULT '{voyage,promo,mode}',  -- valable FLY et MODE
  /* ══ (20/09 — décision fondatrice « au-delà de 250 € ça crée plusieurs bons ET un code commun sur la
     facture ; envoie les deux codes, les deux sont utilisables ») LA SÉRIE ═════════════════════════
     Le plafond LCB-FT est PAR BON : une vente de 700 € se découpe donc en trois. Les trois bons partagent une
     série (`series_id`) ET un CODE COMMUN (`series_code`) qui les désigne tous. Le code commun n'est PAS un
     bon : il n'a pas de ligne, pas de solde, pas de mouvement à lui. Le présenter revient à présenter les
     bons de sa série, dans l'ordre d'émission — le solde de la série est la somme de leurs soldes, et chaque
     débit reste écrit sur le bon qui l'a supporté (gift_card_movements.by_series le rappelle).
     LES DEUX CHEMINS RESTENT OUVERTS, comme la fondatrice l'a demandé : chaque code individuel marche, et le
     code commun aussi. L'unicité de `series_code` avec `code_hash` est assurée par le contrôle de service
     (PEC_DATA.bonNouveauCode réserve les deux) — deux codes ne peuvent pas se confondre dans le même champ. */
  series_id       text,                                 -- 'SER-...' : la vente découpée dont ce bon fait partie (NULL = bon seul)
  series_code     text,                                 -- le CODE COMMUN de la série, imprimé sur chaque ticket et sur la facture
  series_rank     smallint CHECK (series_rank IS NULL OR series_rank >= 1),   -- son rang dans la série (1..n)
  series_of       smallint CHECK (series_of IS NULL OR series_of >= 1),       -- combien de bons la série compte
  CONSTRAINT serie_complete CHECK (series_id IS NULL OR (series_code IS NOT NULL AND series_rank IS NOT NULL AND series_of IS NOT NULL)),
  cancelled_at    timestamptz,                          -- (18/09) bonAnnuler : au comptoir dans bons.annulationMinutes sans débit, ou par le manager — la charge du commerce est REMBOURSÉE (partner_charges.status = 'refunded')
  cancel_reason   text,                                 -- le motif, obligatoire (erreur de montant, client reparti sans payer…)
  blocked_at      timestamptz,                          -- (18/09) bonBloquer / bonDebloquer (manager : perte, vol, fraude)
  block_reason    text,                                 -- le motif, obligatoire — le client lit la raison au panier
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE SEQUENCE gift_cards_ticket_seq START 1;            -- (18/09) le n° de ticket : 'BV-' || lpad(nextval, 6, '0') — miroir de pec-bons-seq
CREATE INDEX gift_cards_point_mois ON gift_cards (partner_id, issued_at) WHERE origin = 'partner';   -- bonsDuPoint / releveMensuel
CREATE INDEX gift_cards_compte ON gift_cards (user_id) WHERE user_id IS NOT NULL;                    -- bonsDuClient
CREATE INDEX gift_cards_serie  ON gift_cards (series_code) WHERE series_code IS NOT NULL;              -- (20/09) retrouver une série par son code commun (bonsSerie)

-- (18/09) LES MOUVEMENTS D'UN BON D’ACHAT — append-only, comme stock_ledger : l'émission, chaque débit (au règlement d'une
-- commande, de la part que le bon d’achat règle), chaque re-crédit (remboursement). Le solde en DÉRIVE ; le plafond « 1 000 € de
-- bons d’achat par client et par jour » se lit ici (Σ des débits du jour d'un user_id — bonsUtilisesJour) ; un re-crédit ne
-- dépasse jamais Σ débits − Σ re-crédits de la même commande (bonRecrediter). Pièces comptables : 10 ans. Miroir de
-- bon.mouvements[] ({type: emission | debit | recredit}).
CREATE TABLE gift_card_movements (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  gift_card_id  uuid NOT NULL REFERENCES gift_cards(id),
  kind          text NOT NULL CHECK (kind IN ('issue','debit','recredit')),
  amount_cents  integer NOT NULL CHECK (amount_cents > 0),
  order_ref     text,                                     -- la commande réglée (debit) ou remboursée (recredit) — CMD-… · M-…
  at            timestamptz NOT NULL DEFAULT now(),
  by_who        text,                                     -- qui a fait le geste : le compte partenaire, 'client', l'identifiant du manager
  user_id       uuid REFERENCES users(id),                -- le compte qui utilise (debit) — c'est lui que vise le plafond journalier
  by_series     text,                                     -- (20/09) le CODE COMMUN présenté, quand le geste a porté sur toute une série : un seul geste de la cliente, plusieurs bons débités
  reason        text                                      -- le motif d'un re-crédit (remboursement, geste commercial…)
);
CREATE INDEX gift_card_movements_bon  ON gift_card_movements (gift_card_id, at);
CREATE INDEX gift_card_movements_jour ON gift_card_movements (user_id, at) WHERE kind = 'debit';   -- bonsUtilisesJour (plafond client/jour)

-- ═══ (18/09, au soir — DÉCISION FONDATRICE) L'ENCAISSEMENT DU PARTENAIRE : PRÉLÈVEMENT À LA VENTE ═══════════════
-- « Le partenaire paye automatiquement notre service par carte lorsqu'il vend un bon d’achat, moins sa marge. »
-- `partner_remittances` et `partner_remittance_receipts` — la créance mensuelle, son échéance, ses reçus — sont
-- SUPPRIMÉES : elles n'ont plus d'objet. À chaque bon d’achat vendu, la carte bancaire enregistrée du commerce est débitée
-- du montant du bon d’achat MOINS sa commission TTC, dans la seconde. Trois conséquences, et c'est ce qui rend le modèle sûr :
--   ① LE COMMERÇANT NE DÉTIENT JAMAIS NOTRE ARGENT — il encaisse les espèces pour SON compte et nous règle aussitôt.
--   ② LE BON D’ACHAT NAÎT DU PAIEMENT — aucun code n'est généré tant que la banque n'a pas accepté (refus = pas de bon d’achat, le
--      commerçant rend ses espèces). C'est le symétrique de « j'ai reçu les espèces ».
--   ③ PLUS DE CRÉANCE, PLUS D'IMPAYÉ, PLUS DE RELANCE — il ne reste qu'un RELEVÉ mensuel, calculé (vue ci-dessous),
--      qui sert à l'autofacture de commission (art. 289 CGI, que la TVA exige) et à montrer au commerçant ce qu'il gagne.
-- Prestataire : STRIPE (21/09 ; ref.bons.psp : 1,5 % + 0,25 € par transaction carte EEE). La carte se saisit dans le composant
-- Stripe du navigateur (SetupIntent off_session) : l'empreinte est un `pm_…`, le client de la plateforme un `cus_…`.
-- Miroir de PEC_DATA : partenaireCarte* → partner_cards · partenaireDu / prelevementPartenaire / prelevementRembourser
-- → partner_charges · releveMensuel / relevesReseau → v_partner_monthly_statements.

-- (18/09, soir) LE MOYEN DE RÈGLEMENT DU COMMERCE — enregistré UNE fois, réutilisé à chaque vente. Le prestataire
-- TOKENISE la carte : il rend une empreinte réutilisable (`card_…`) rattachée à un objet `customer`, et c'est elle,
-- et elle seule, qui permet de débiter sans que le gérant ressaisisse quoi que ce soit.
-- ⚠ LE NUMÉRO DE CARTE (PAN) N'ENTRE JAMAIS EN BASE, ni dans un journal, ni dans une trace d'API : il part du
-- navigateur du gérant vers le prestataire et ne traverse aucun serveur PayEnCash — c'est ce qui met AJEK hors du
-- périmètre PCI-DSS par construction. Ce qui est gardé ici ne sert qu'à ce que le commerçant RECONNAISSE sa carte
-- (quatre derniers chiffres, marque, échéance) et à ce que le manager voie venir une carte qui expire.
-- Une carte retirée n'est jamais effacée : `removed_at` la sort de la vente, les prélèvements passés gardent leur preuve.
CREATE TABLE partner_cards (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id      uuid REFERENCES partners(id),         -- le commerce partenaire (réseau du Bon d’achat PayEnCash)…
  reseller_id     text,                                   -- (21/09) …ou le point de vente de PayEnCash Solution qui n'est pas (encore) partenaire → tech_resellers(id), clé en fin de fichier
  psp             text NOT NULL DEFAULT 'stripe',         -- le prestataire qui DÉTIENT la carte (ref.bons.psp) — Stripe depuis le 21/09
  psp_card_id     text NOT NULL,                          -- l'EMPREINTE rendue par le prestataire ('card_…') — JAMAIS le PAN
  last4           char(4) NOT NULL,                       -- les quatre derniers chiffres : ce que le commerçant lit à l'écran
  brand           text,                                   -- Visa · Mastercard · CB · American Express
  exp_month       smallint NOT NULL CHECK (exp_month BETWEEN 1 AND 12),
  exp_year        smallint NOT NULL,                      -- une carte expirée ne vend plus (partenairesSansCarte : la file du manager)
  holder          text,                                   -- le titulaire tel qu'il est gravé — jamais un contrôle d'identité
  psp_customer_id text,                                   -- l'objet `customer` du prestataire : c'est lui qui rend la carte réutilisable
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      text,                                   -- le compte qui l'a enregistrée (partenaire ou manager) — journalisé
  removed_at      timestamptz,                            -- partenaireCarteRetirer : retirée de la vente, gardée pour l'historique
  UNIQUE (psp, psp_card_id),
  CONSTRAINT partner_card_proprietaire CHECK ((partner_id IS NOT NULL) <> (reseller_id IS NOT NULL))   -- un propriétaire, un seul
);
CREATE UNIQUE INDEX partner_cards_active ON partner_cards (partner_id) WHERE removed_at IS NULL AND partner_id IS NOT NULL;   -- UNE carte en cours par point
CREATE UNIQUE INDEX partner_cards_active_reseller ON partner_cards (reseller_id) WHERE removed_at IS NULL AND reseller_id IS NOT NULL;   -- (21/09) …et par point de vente Solution

-- (18/09, soir) LE PRÉLÈVEMENT D'UNE VENTE — il naît AVANT le bon d’achat, et le bon d’achat ne naît que s'il est accepté.
-- `amount_cents` est ce qui est RÉELLEMENT débité : la valeur faciale moins la commission TTC du commerçant
-- (= PEC_DATA.partenaireDu : commission HT arrondie au centime, puis TVA arrondie au centime — chaque étape arrondit,
-- c'est ce qui garantit que le serveur et l'écran tombent au même centime). `psp_fee_cents` est ce que le prestataire
-- nous coûte (0,7 % + 0,15 €) : la marge RÉELLE du manager, jamais montrée au commerçant.
-- UN REFUS EST UNE LIGNE : la charge reste en 'refused' avec son motif, aucun bon d’achat n'existe, et le commerçant peut
-- expliquer au client pourquoi il lui rend ses espèces. Un bon d’achat annulé au comptoir REMBOURSE sa charge ('refunded') —
-- le débit a bien eu lieu, il ne s'efface pas, il se contre-passe.
-- ⚠ Aucune donnée de carte ici non plus : `card_last4` sert à lire le relevé, rien de plus.
CREATE TABLE partner_charges (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id           uuid NOT NULL REFERENCES partners(id),
  gift_card_id         uuid REFERENCES gift_cards(id),    -- le bon d’achat que ce prélèvement a payé — NULL sur un refus : il n'y a pas de bon d’achat
  face_value_cents     integer NOT NULL CHECK (face_value_cents > 0),      -- la valeur faciale du bon d’achat vendu
  -- (19/09) LE TAUX RETENU SUR CETTE VENTE, figé : celui du commerce (partners.commission_pct) ou, à défaut, celui du
  -- réseau. Il est ÉCRIT ici et jamais recalculé — c'est ce qui permet au relevé et à l'autofacture de dire le taux
  -- qui a vraiment été appliqué, même si le taux a changé depuis (y compris en cours de mois).
  commission_pct       numeric(5,3) NOT NULL CHECK (commission_pct >= 0 AND commission_pct < 100),
  commission_ht_cents  integer NOT NULL CHECK (commission_ht_cents >= 0),  -- faciale × commission_pct / 100, arrondie au centime
  vat_cents            integer NOT NULL CHECK (vat_cents >= 0),            -- commission HT × bons.tvaCommissionPct / 100, arrondie
  commission_ttc_cents integer NOT NULL CHECK (commission_ttc_cents >= 0), -- ce que le commerçant GARDE
  amount_cents         integer NOT NULL CHECK (amount_cents > 0),          -- CE QUI EST DÉBITÉ sur sa carte
  psp_fee_cents        integer NOT NULL DEFAULT 0,        -- le coût du prestataire sur ce mouvement (manager seulement)
  status               text NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted','refused','refunded')),   -- = PEC_DATA.PRELEVEMENT_STATUTS (accepte | refuse | rembourse)
  decline_reason       text,                              -- le motif du refus, tel que la banque le rend — le commerçant le lit
  psp                  text NOT NULL DEFAULT 'stripe',
  psp_payment_id       text,                              -- l'identifiant du paiement chez le prestataire ('paym_…') : la preuve opposable
  reference            text NOT NULL UNIQUE,              -- 'PAY-000012' (accepté) · 'ECH-000012' (refusé) — partner_charges_ref_seq
  card_last4           char(4),                           -- la carte débitée, telle qu'elle se lit sur le relevé
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by           text,                              -- le compte partenaire qui a vendu — journalisé
  refunded_at          timestamptz,
  refund_reason        text,                              -- « bon d’achat BV-000012 annulé » : un remboursement se motive
  CONSTRAINT partner_charges_ttc   CHECK (commission_ttc_cents = commission_ht_cents + vat_cents),
  CONSTRAINT partner_charges_du    CHECK (amount_cents = face_value_cents - commission_ttc_cents),
  CONSTRAINT partner_charges_refus CHECK (status <> 'refused' OR gift_card_id IS NULL),        -- un refus n'a JAMAIS produit de bon d’achat
  CONSTRAINT partner_charges_motif CHECK (status <> 'refused' OR decline_reason IS NOT NULL)   -- ni de refus muet
);
CREATE SEQUENCE partner_charges_ref_seq START 1;            -- 'PAY-' / 'ECH-' || lpad(nextval, 6, '0') — miroir de PEC_DATA._seq('prelevements')

-- (19/09, nuit — décision fondatrice « supprime le flashcode, il n'a rien à montrer au commerçant, il achète un
-- bon ») `voucher_requests` A VÉCU UNE SOIRÉE. C'était le miroir d'un flashcode que le client affichait au comptoir
-- pour ouvrir la caisse au bon montant et rapatrier le code du bon. Le geste n'existe pas : on demande un bon
-- d'achat de tant, on paie, on repart avec un ticket. La table, sa séquence et ses trois index sont supprimés ;
-- l'émission (gift_cards + partner_charges) n'a jamais dépendu d'eux.
CREATE INDEX partner_charges_point_mois ON partner_charges (partner_id, created_at);           -- le relevé d'un point, mois par mois
CREATE INDEX partner_charges_refus ON partner_charges (created_at) WHERE status = 'refused';   -- la file « cartes qui refusent » du manager

-- (18/09, soir) LE RELEVÉ MENSUEL — ce qui reste du reversement : LA PREUVE, PAS LA CRÉANCE. Tout est déjà encaissé
-- à la vente ; ce relevé ne sert qu'à deux choses, et c'est pourquoi il est une VUE et non une table : l'autofacture
-- de commission du commerçant (art. 289 CGI — la TVA l'exige, numéro AFB-<AAAAMM>-<code du point>, dérivé) et la
-- lecture de ce qu'il a gagné. Aucune échéance, aucun reçu, aucun impayé : il n'y a plus rien à devoir.
-- Un prélèvement REFUSÉ n'a produit aucun bon d’achat : il ne compte ni dans les ventes ni dans la commission, il n'est là
-- que pour expliquer un écart au comptoir. Un prélèvement REMBOURSÉ a bien été débité : il compte dans ce qui est
-- passé sur la carte, et son remboursement vient en face — sinon le relevé mentirait. (= PEC_DATA.releveMensuel.)
CREATE VIEW v_partner_monthly_statements AS
WITH mois AS (
  SELECT partner_id, date_trunc('month', issued_at)::date AS period_month
    FROM gift_cards WHERE origin = 'partner' AND partner_id IS NOT NULL
  UNION
  SELECT partner_id, date_trunc('month', created_at)::date FROM partner_charges
)
SELECT p.id                                   AS partner_id,
       p.name                                 AS partner_name,
       m.period_month,
       COALESCE(v.nb, 0)                      AS bons_vendus,
       COALESCE(v.annules, 0)                 AS bons_annules,
       COALESCE(v.sales_cents, 0)             AS sales_cents,          -- Σ des bons d’achat du point émis dans le mois, non annulés
       COALESCE(c.commission_ht_cents, 0)     AS commission_ht_cents,  -- ce que le commerçant a GARDÉ (HT)
       COALESCE(c.vat_cents, 0)               AS vat_cents,
       COALESCE(c.commission_ttc_cents, 0)    AS commission_ttc_cents,
       COALESCE(c.charged_cents, 0)           AS charged_cents,        -- ce qui est passé sur sa carte (accepté + remboursé)
       COALESCE(c.refunded_cents, 0)          AS refunded_cents,
       COALESCE(c.charged_cents, 0) - COALESCE(c.refunded_cents, 0) AS net_cents,
       COALESCE(c.psp_fee_cents, 0)           AS psp_fee_cents,        -- le coût du prestataire — manager seulement
       COALESCE(c.refused, 0)                 AS charges_refusees,
       CASE WHEN COALESCE(v.nb, 0) > 0
            THEN 'AFB-' || to_char(m.period_month, 'YYYYMM') || '-' ||
                 substr(upper(regexp_replace(p.id::text, '[^a-zA-Z0-9]', '', 'g')), 1, 8)
       END                                    AS self_invoice_number   -- l'autofacture de commission (art. 289 CGI) — DÉRIVÉE, jamais écrite
  FROM mois m
  JOIN partners p ON p.id = m.partner_id
  LEFT JOIN LATERAL (
    SELECT count(*) FILTER (WHERE g.status <> 'cancelled')                                  AS nb,
           count(*) FILTER (WHERE g.status =  'cancelled')                                  AS annules,
           COALESCE(sum(g.face_value_cents) FILTER (WHERE g.status <> 'cancelled'), 0)::int AS sales_cents
      FROM gift_cards g
     WHERE g.partner_id = m.partner_id AND g.origin = 'partner'
       AND date_trunc('month', g.issued_at)::date = m.period_month) v ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(sum(ch.commission_ht_cents)  FILTER (WHERE ch.status <> 'refused'), 0)::int AS commission_ht_cents,
           COALESCE(sum(ch.vat_cents)            FILTER (WHERE ch.status <> 'refused'), 0)::int AS vat_cents,
           COALESCE(sum(ch.commission_ttc_cents) FILTER (WHERE ch.status <> 'refused'), 0)::int AS commission_ttc_cents,
           COALESCE(sum(ch.amount_cents)         FILTER (WHERE ch.status <> 'refused'), 0)::int AS charged_cents,
           COALESCE(sum(ch.amount_cents)         FILTER (WHERE ch.status =  'refunded'), 0)::int AS refunded_cents,
           COALESCE(sum(ch.psp_fee_cents)        FILTER (WHERE ch.status <> 'refused'), 0)::int AS psp_fee_cents,
           count(*) FILTER (WHERE ch.status = 'refused')                                        AS refused
      FROM partner_charges ch
     WHERE ch.partner_id = m.partner_id
       AND date_trunc('month', ch.created_at)::date = m.period_month) c ON true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · (18/09, au soir) L'AGENT DE CAISSE MOBILE A QUITTÉ LE MODÈLE
-- ─────────────────────────────────────────────────────────────────────────────
-- DÉCISION FONDATRICE : « supprime l'agent qui se déplace, elle perd toute sa logique ». Un salarié qui transporte
-- des espèces, c'est un convoyage de fonds (CNAPS), un risque d'agression, une caisse à rapprocher tous les soirs et
-- une paie à tenir — pour un service que le Bon d’achat PayEnCash rend sans qu'un euro ne passe par
-- nos mains. VINGT-CINQ TABLES DISPARAISSENT ICI ET PLUS BAS : `couriers`, `delivery_zones`, `courier_documents`,
-- `courier_expenses`, `courier_positions`, `courier_availability`, `courier_unavailability`, `shifts`,
-- `service_sessions`, `shift_checklists`, `demand_forecast`, `payslips`, `payroll_transfers`, `final_settlements`,
-- `fleet_vehicles`, `insurance_policies`, `cash_deposits`, `cash_handovers`, `collection_rounds`,
-- `bank_deposit_transactions`, `card_settlements`, `change_transfers` (le rendu de monnaie par virement),
-- `delivery_fee_config` (le barème de déplacement), `kiosks` (les automates Cash Services ne servaient qu'à ses
-- dépôts) et `chat_messages` (le fil agent ↔ client), avec le cycle du cash (`cash_state`), le canal 'agent', le
-- statut COLLECTION_FAILED et toutes les colonnes qui les visaient.
-- CE QUI RESTE ET QUI N'ÉTAIT PAS À LUI : `ledger_entries` (le grand livre du compte de résultat — il porte les
-- salaires de TOUTE l'entreprise, pas seulement les siens), `kyc_documents` (le coffre du fournisseur, du client et
-- du point), `refund_transfers` (rembourser un client par virement reste nécessaire), `customer_credits` (l'avoir).
-- Le seul moyen « sans carte » est désormais le BON D’ACHAT PAYENCASH (ci-dessus) : personne, chez PayEnCash, ne
-- touche plus d'espèces, et plus aucun titre tiers n'est accepté (20/09).

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · CATALOGUE VOYAGE & PROMOS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE airlines (                                  -- référentiel compagnies — miroir de Duffel GET /air/airlines
  iata_code        text PRIMARY KEY,                     -- ex. 'VY'
  duffel_id        text UNIQUE,                          -- id Duffel ('arl_...')
  name             text NOT NULL,
  logo_symbol_url  text,                                 -- logo carré servi par Duffel (assets.duffel.com)
  logo_lockup_url  text,                                 -- logo horizontal servi par Duffel
  brand_color      text,                                 -- pastille de repli si le logo ne charge pas
  active           boolean NOT NULL DEFAULT true,
  synced_at        timestamptz NOT NULL DEFAULT now()    -- resynchronisé par CRON depuis /air/airlines
);

CREATE TABLE places (                                    -- référentiel destinations — miroir de Duffel GET /air/places
  duffel_place_id    text PRIMARY KEY,                   -- id Duffel ('arp_...' aéroport / 'cit_...' ville)
  type               text NOT NULL CHECK (type IN ('airport','city')),
  iata_code          text NOT NULL,                      -- ex. 'BCN' — le code que voit le client
  iata_city_code     text NOT NULL,                      -- la VILLE du lieu (CDG+ORY → 'PAR') : clé de regroupement
  iata_country_code  text NOT NULL,                      -- ISO-2, même champ que Duffel
  name               text NOT NULL,                      -- 'Barcelone-El Prat'
  city_name          text NOT NULL,                      -- 'Barcelone' — l'affichage de la combobox
  latitude           double precision,
  longitude          double precision,
  time_zone          text,                               -- IANA, tel que servi par Duffel
  active             boolean NOT NULL DEFAULT true,
  synced_at          timestamptz NOT NULL DEFAULT now()  -- resynchronisé par CRON depuis /air/places
);
CREATE INDEX places_recherche ON places (iata_city_code, type);

CREATE TABLE nuitee_cities (                             -- référentiel villes séjour — miroir Nuitée/LiteAPI GET /data/cities
  id           bigserial PRIMARY KEY,
  city         text NOT NULL,                            -- champ `city` LiteAPI, tel quel
  country      text NOT NULL,                            -- champ `country` LiteAPI (ISO-2), tel quel
  active       boolean NOT NULL DEFAULT true,
  synced_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city, country)
);

CREATE TABLE place_city_links (                          -- LIAISON vol ↔ hôtel : une destination Duffel = une ville Nuitée
  iata_city_code  text NOT NULL,                         -- côté Duffel (places.iata_city_code)
  nuitee_city_id  bigint NOT NULL REFERENCES nuitee_cities(id),
  PRIMARY KEY (iata_city_code, nuitee_city_id)           -- c'est CE pont qui permet « vol + hôtel » sur la même recherche
);

CREATE TABLE flight_offers (                             -- cache d'offres Duffel
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duffel_offer_id  text UNIQUE NOT NULL,
  airline_iata     text REFERENCES airlines(iata_code),  -- compagnie opérante (owner.iata_code Duffel)
  origin           text NOT NULL, destination text NOT NULL,
  depart_at        timestamptz NOT NULL, return_at timestamptz,
  base_cents       integer NOT NULL,                     -- prix fournisseur
  tax_amount_cents integer NOT NULL DEFAULT 0,           -- taxes aériennes Duffel — PAS de la TVA (Partie 1b §5)
  total_cents      integer NOT NULL,                     -- prix client TTC (grille Partie 1b §1)
  expires_at       timestamptz NOT NULL
);

CREATE TABLE hotel_offers (                              -- cache d'offres Nuitée (Booking API : Availability → CheckRates → Booking)
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nuitee_hotel_id   text NOT NULL,                        -- code hôtel Nuitée
  name             text NOT NULL, city text NOT NULL,
  stars            smallint CHECK (stars BETWEEN 1 AND 5),
  checkin          date NOT NULL, checkout date NOT NULL,
  nights           integer GENERATED ALWAYS AS (checkout - checkin) STORED,
  adults           smallint NOT NULL DEFAULT 2,          -- occupancies Nuitée (rooms~adults~children)
  children         smallint NOT NULL DEFAULT 0,
  rooms            smallint NOT NULL DEFAULT 1,
  room_type        text,                                 -- ex. DBL.ST
  board            text,                                 -- RO / BB / HB / FB (pension)
  rate_id            text NOT NULL,                      -- offre LiteAPI (POST /hotels/rates)
  prebook_id         text,                               -- verrou de prix LiteAPI (POST /rates/prebook)
  prebook_expires_at timestamptz,                        -- fenêtre du verrou = le « prix bloqué » hôtel
  refundable       boolean NOT NULL DEFAULT false,       -- NRF = non remboursable
  score            numeric(3,1),                        -- note agrégée voyageurs (LiteAPI /data/reviews)
  max_guests       smallint,                             -- PERSONNES MAX acceptées par le logement — règle SANS ambiguïté
  checkin_time     text,                                 -- checkinCheckoutTimes.checkin (ex. « dès 14 h »)
  checkout_time    text,                                 -- checkinCheckoutTimes.checkout
  house_rules      jsonb NOT NULL DEFAULT '[]',          -- consignes (hotelImportantInformation) — TOUTES affichées
  includes         jsonb NOT NULL DEFAULT '[]',          -- ce que l'offre COMPREND (board, navette…)
  not_included     jsonb NOT NULL DEFAULT '[]',          -- ce qui n'est PAS compris (taxe de séjour, options)
  cancellation_policy jsonb NOT NULL DEFAULT '[]',       -- cancelPolicyInfos DATÉES ligne à ligne + refundableTag NRFN/RFN
  images           jsonb NOT NULL DEFAULT '[]',          -- URLs LiteAPI GET /data/hotel (hotelImages)
  amenities        jsonb NOT NULL DEFAULT '[]',          -- équipements (wifi, petit-déj, clim…)
  base_cents       integer NOT NULL,
  total_cents      integer NOT NULL,
  expires_at       timestamptz NOT NULL,
  CHECK (checkout > checkin)                             -- une nuit a une ARRIVÉE et un DÉPART
);

CREATE TABLE promo_offers (                              -- Promos : éditées à J−45 minimum (ancien repère J−21 abandonné le 26/08)
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           text UNIQUE NOT NULL,                   -- « bucarest »
  travel_mode    text NOT NULL CHECK (travel_mode IN ('spartiate','fute','confort','luxe')),
  title          text NOT NULL,
  detail         text NOT NULL,
  nights         integer NOT NULL,
  price_cents    integer NOT NULL,                       -- TOUJOURS < reference_price_cents
  reference_price_cents integer NOT NULL,                -- « prix en normal » — méthodo Omnibus (Partie 5)
  depart_date    date NOT NULL,                          -- contrôle : depart_date − published_at ≥ 45 j
  published_at   timestamptz NOT NULL DEFAULT now(),
  -- (10/09 — lot 8, constat C29) LA CAPACITÉ EST UN NOMBRE, DÉCOMPTÉ. Côté JS c'était le texte « 4 places » : le récap
  -- y plafonnait le nombre de voyageurs, mais aucune vente ne le faisait bouger — on pouvait vendre quarante fois les
  -- quatre places du même voyage, et l'offre restait affichée « 4 places » indéfiniment. Les places prises se comptent
  -- sur les commandes RÉGLÉES qui portent `orders.promo_offer_id` ; une offre complète cesse d'être proposée.
  capacity       integer CHECK (capacity IS NULL OR capacity > 0),
  mention        text,                                   -- « Coup de cœur » et autres étiquettes : une mention, jamais une capacité déguisée
  tunnel         text NOT NULL CHECK (tunnel IN ('ar','vh')),
  active         boolean NOT NULL DEFAULT true,
  CONSTRAINT promo_moins_cher CHECK (price_cents < reference_price_cents)
);

-- (10/09 — lot 8, constat C33) LES CODES PROMO FLY. « RENTREE10 · fin 31 août » et « DUO15 » étaient ÉCRITS dans le
-- référentiel JS : la page « Promos & astuces » les présentait comme « du moment » des semaines après leur échéance,
-- et aucun écran ne permettait d'en créer un. Ils se créent depuis le manager, portent une VRAIE date de fin, et se
-- désactivent. (À ne pas confondre avec `supplier_promo_codes`, qui appartiennent au fournisseur, ligne MODE.)
CREATE TABLE fly_promo_codes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text UNIQUE NOT NULL,
  label         text NOT NULL,                           -- ce que le client lit
  discount_cents integer NOT NULL CHECK (discount_cents > 0),
  min_total_cents integer CHECK (min_total_cents IS NULL OR min_total_cents > discount_cents),
  min_travelers integer CHECK (min_travelers IS NULL OR min_travelers > 1),
  ends_on       date NOT NULL,                           -- obligatoire : un code sans échéance ne s'éteint jamais
  active        boolean NOT NULL DEFAULT true,
  created_by    text, created_at timestamptz NOT NULL DEFAULT now(),
  disabled_by   text, disabled_at timestamptz
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4 · COMMANDES & LIGNES (toutes lignes confondues)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref              text UNIQUE NOT NULL,                 -- CMD-Z6DNX8HV
  user_id          uuid NOT NULL REFERENCES users(id),
  line             order_line NOT NULL,
  status           order_status NOT NULL DEFAULT 'DRAFT',
  channel          pay_channel,                          -- choisi à « Comment payer » ('bon') ; 'soldee' quand un avoir couvre tout
  -- (17/09 — pivot) LE MOYEN choisi par le client (PEC_DATA.MOYENS_PAIEMENT) : il est connu dès la commande, avant
  -- tout encaissement, parce que « Comment payer » le tranche. Ce que le règlement a RÉELLEMENT utilisé est porté
  -- par payments.method (le client peut revenir en arrière et changer de moyen).
  -- (18/09) 'bon' = le Bon d’achat PayEnCash couvre TOUT le dû (PEC_BUS.payer par:'bon') ; un bon d’achat qui n'en couvre qu'une PART est
  -- APPLIQUÉ (gift_card_id, gift_card_cents) et le reste se règle par un autre moyen — c'est ce moyen-là qui est porté ici.
  -- (18/09, soir) 'agent' est RETIRÉ : plus personne ne se déplace. Avec lui partent le rendu de monnaie (`change_mode`),
  -- la répartition espèces/carte au-dessus du plafond légal (`planned_cash_cents`, `planned_card_cents`), l'appoint
  -- préparé par le client (`exact_change`), les frais de déplacement (`travel_fee_cents`), l'agent qui a pris la course
  -- (`courier_id`, `reassigned_*`) et ses jalons (`accepted_at`, `arrived_at`, `collection_started_at`).
  pay_method       text CHECK (pay_method IN ('bon')),   -- (20/09) un seul titre : le Bon d’achat PayEnCash
  credit_used_cents  integer NOT NULL DEFAULT 0,          -- (09/09 — lot 2) avoir appliqué à la commande (customer_credits), consommé au règlement de payer
  promo_offer_id   uuid REFERENCES promo_offers(id),     -- si commande promo (F2-promo)
  travellers       integer NOT NULL DEFAULT 1,
  subtotal_cents   integer NOT NULL DEFAULT 0,
  expires_at       timestamptz,                          -- (09/09 — lot 3) UNE seule fenêtre : annonce + scenario.fenetreEncaissementMinutes (commande.expireTs)
  expired_at       timestamptz,                          -- (09/09 — lot 3) expirée d'office à la lecture (commande.expire) — plus une regex sur cancel_reason
  cancelled_by_customer boolean NOT NULL DEFAULT false,  -- (09/09 — lot 3) annulerParClient : aucun frais dû, compté pour la règle d'abus
  discount_cents   integer NOT NULL DEFAULT 0,           -- code promo
  -- (19/09) LA REMISE D'UN LIEN PARTAGÉ (= commande.remisePartage). Quand la pièce a été atteinte par le lien qu'un
  -- fournisseur a partagé, PayEnCash prend une marge PLUS FAIBLE (reglages `marge_mode_partage_pct`) et rend la
  -- différence au client, annoncée « remise PayEnCash ». Elle sort de NOTRE marge : la ligne fournisseur et la
  -- facture d'achat ne bougent pas d'un centime. `share_link_id` dit QUEL lien l'a ouverte — c'est le même fait
  -- qui crédite l'atelier à l'encaissement (share_link_events), jamais une seconde vérité à tenir.
  share_discount_cents integer NOT NULL DEFAULT 0 CHECK (share_discount_cents >= 0),
  -- (19/09, soir — décision fondatrice « le prix du colis, c'est le prix du colis de Mondial Relay, on ne rentre
  -- pas dedans ») LE TRANSPORT EST FACTURÉ À PART. Il n'est plus fondu dans le prix des pièces : c'est le tarif
  -- public du transporteur, à la tranche de poids, UN COLIS PAR FOURNISSEUR QUI EXPÉDIE (= PEC_DATA.livraisonPanier,
  -- commande.livraisonCout). PayEnCash ne prend AUCUNE marge dessus : ce montant transite, il n'est pas un produit.
  -- Le détail par colis se relit sur `shipments` (un par fournisseur) ; ici on garde ce qui a été facturé au client.
  shipping_cents   integer NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0),
  share_link_id    uuid,                                 -- → share_links(id) : table définie plus bas, FK posée en fin de fichier
  gift_card_cents  integer NOT NULL DEFAULT 0,           -- (18/09) la part réglée par le Bon d’achat PayEnCash appliqué (commande.bonApplique.montant) — débitée au règlement, jamais avant
  gift_card_id     uuid REFERENCES gift_cards(id),       -- (18/09) le bon d’achat appliqué (bonAppliquer / panierBonAppliquer) — son id, JAMAIS son code
  total_price_cents integer NOT NULL,
  vat_amount_cents integer NOT NULL DEFAULT 0,           -- TVA calculée par ligne (dette fiscale, Partie 1b §5)
  price_locked_until timestamptz,                        -- prix bloqué 1 h
  stock_committed  boolean NOT NULL DEFAULT false,        -- idempotence : le stock (réservé→vendu) n'est engagé qu'UNE fois
  created_at       timestamptz NOT NULL DEFAULT now(),
  failed_at        timestamptz, failure_reason text, failure_detail text,   -- (18/09, soir) FAILED = somme encaissée, émission refusée par le fournisseur
  cancelled_at     timestamptz, cancel_reason text, cancelled_by text,      -- annuler (status CANCELLED)
  CONSTRAINT total_positif CHECK (total_price_cents > 0)
);
CREATE INDEX idx_orders_user   ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);

CREATE TABLE order_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  kind           text NOT NULL CHECK (kind IN ('flight','hotel','promo_package','mode_article')),
  flight_offer_id uuid REFERENCES flight_offers(id),
  hotel_offer_id  uuid REFERENCES hotel_offers(id),
  mode_article_id uuid,                                  -- FK posée après création de mode_articles
  qty            integer NOT NULL DEFAULT 1,
  unit_cents     integer NOT NULL,
  vat_scheme     vat_scheme NOT NULL,                    -- marge_voyage / marge_occasion / tva_20
  vat_cents      integer NOT NULL DEFAULT 0              -- 0 affiché si régime de marge (jamais détaillé client)
);

-- VOYAGEURS (7 champs Duffel) — CHIFFRÉS AES-256 dès la saisie (service identite),
-- jamais en clair côté client. Émission billet impossible sans eux.
CREATE TABLE saved_travelers (                           -- le CARNET réutilisable du compte
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           text,                                  -- mr / mrs / ms (Duffel)
  given_name_enc  text NOT NULL,                         -- prénom (chiffré)
  family_name_enc text NOT NULL,                         -- nom (chiffré)
  born_on_enc     text,                                  -- date de naissance (chiffrée)
  gender          text CHECK (gender IN ('m','f')),
  email_enc       text,
  phone_enc       text,                                  -- E.164 (chiffré)
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_travelers (                           -- voyageurs d'UNE commande (copie figée à l'achat)
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  saved_traveler_id   uuid REFERENCES saved_travelers(id),  -- si repris du carnet
  rank                integer NOT NULL DEFAULT 1,           -- voyageur 1 = adresse d'encaissement par défaut
  title               text,
  given_name_enc      text NOT NULL,
  family_name_enc     text NOT NULL,
  born_on_enc         text,
  gender              text CHECK (gender IN ('m','f')),
  email_enc           text,
  phone_enc           text,                                -- E.164 (chiffré)
  identity_doc_enc    text,                                -- seulement si passenger_identity_documents_required (Duffel)
  duffel_passenger_id text,                                -- id passager renvoyé par Duffel à l'émission
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, rank)
);
CREATE INDEX idx_order_travelers_order ON order_travelers(order_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5 · ENCAISSEMENT & CYCLE DU CASH (Partie 1b §3)
-- ─────────────────────────────────────────────────────────────────────────────

/* ── (20/09 — décision fondatrice « enlève la logique Neosurf, supprime toute mention Neosurf ») ──────────
   DEUX TABLES DISPARAISSENT ICI : `psp_transactions` (la transaction ouverte chez le prestataire en ligne, sa
   notification serveur à serveur, son remboursement par ticket) et `psp_delivery_confirmations` (la Delivery
   Confirmation que ce prestataire exigeait pour les biens physiques), avec la séquence `psp_transactions_seq`,
   les index `psp_transactions_commande` / `psp_transactions_une_ouverte` / `psp_delivery_confirmations_tx` et la
   colonne `payments.psp_transaction_id` qui les visait.
   POURQUOI : PayEnCash n'émet plus qu'un titre, le sien. Il n'y a plus de page hébergée vers laquelle rediriger,
   plus de pingback à vérifier, plus de moyen tiers à rembourser. IL NE RESTE QU'UN VALIDEUR DE RÈGLEMENT, et il
   est en base : le débit d'un Bon d’achat PayEnCash sous verrou, dont `gift_card_movements` garde la preuve.
   Migration : db/migrations/2026-09-20-purge-reseau-tiers.sql. ── */


CREATE TABLE payments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             uuid NOT NULL REFERENCES orders(id),
  ref                  text UNIQUE NOT NULL,             -- PEC-Z6DNX8HV (le code-barres)
  amount_cents         integer NOT NULL,
  collected_amount_cents integer,                        -- = amount_cents exigé à la validation
  channel              pay_channel NOT NULL,
  -- (18/09, soir) QUI A RÉGLÉ, ET AVEC QUOI. Après le point qui encaissait (retiré le 17/09), c'est l'AGENT qui part :
  -- `courier_id`, le code de sécurité qu'il demandait au client, sa photo de preuve, l'état du cash, le ticket TPE de
  -- son complément carte, les billets de 500/200 €, le mode de rendu de monnaie et le contrôle d'identité au comptage
  -- n'ont plus d'objet. (20/09) `psp_transaction_id` part à son tour avec le rail en ligne : IL NE RESTE QU'UN
  -- VALIDEUR, le débit d'un Bon d’achat sous verrou — et il ne compte pas d'espèces.
  method               text CHECK (method IN ('bon')),   -- le moyen qui a RÉELLEMENT réglé (PEC_DATA.libelleMoyen) : le Bon d’achat PayEnCash
  gift_card_id         uuid REFERENCES gift_cards(id),   -- (18/09) le Bon d’achat PayEnCash débité sur ce règlement (tout ou partie) — la preuve est son mouvement 'debit' (order_ref)
  collected_at         timestamptz,
  receipt_code         text,                             -- code de confirmation du reçu (B3K-71)
  CONSTRAINT ecart_collecte CHECK (collected_amount_cents IS NULL OR collected_amount_cents = amount_cents),
  -- RÈGLE (fondatrice 25/08, révisée au pivot du 17/09, resserrée le 18/09 au soir, réduite à l'os le 20/09) : la
  -- VALIDATION d'un paiement appartient au SERVEUR qui débite un Bon d’achat PayEnCash sous verrou (method 'bon',
  -- gift_card_id posé, mouvement 'debit' dans la même transaction) — JAMAIS au client, jamais à un salarié qui
  -- compte, et plus jamais à la notification d'un tiers. Une collecte sans valideur reste impossible en base.
  CONSTRAINT valideur_obligatoire CHECK (collected_at IS NULL
                                         OR (method = 'bon' AND gift_card_id IS NOT NULL))
);
CREATE INDEX idx_payments_order ON payments(order_id);

-- CE QUI COMPOSE UN RÈGLEMENT. (18/09, soir) 'cash' et 'card' sont RETIRÉS avec l'agent — plus personne ne reçoit
-- d'espèces ni ne passe une carte sur un terminal, donc plus de plafond d'espèces à porter ici (le plafond LCB-FT qui
-- compte est celui du BON D’ACHAT : 250 € par bon d’achat, 1 000 € de bons d’achat utilisés par client et par jour, et
-- il se lit sur gift_card_movements). (20/09) les moyens du rail en ligne partent avec lui : IL NE RESTE QUE
-- 'bon'. Un tender porte la PART réglée par UN bon d’achat (voucher_ref = l'id du bon) : seul quand il couvre tout,
-- à plusieurs quand la vente au comptoir s'est découpée en série (au-delà de 250 €). Chacun est 'captured' au débit
-- de son bon, dans la même transaction SQL.
CREATE TABLE payment_tenders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id   uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  method       text NOT NULL CHECK (method IN ('bon')),   -- (18/09, soir) plus de 'cash' ni de 'card' ; (20/09) plus de moyen en ligne
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  voucher_ref  text,                                     -- l'id du Bon d’achat PayEnCash débité (ex-psp_ref)
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','authorized','captured','refunded')),
  created_at   timestamptz NOT NULL DEFAULT now()
);
-- Règles service : somme des tenders = payments.amount_cents · un tender 'bon' devient 'captured' au débit du bon,
-- sous verrou, dans la même transaction SQL que le mouvement 'debit' de gift_card_movements.

-- (18/09, soir) `cash_deposits` (les dépôts de l'agent aux automates Cash Services), `bank_deposit_transactions`
-- (l'import du rapport du réseau) et `card_settlements` (le lot carte du jour, rapproché du relevé bancaire) sont
-- SUPPRIMÉES avec l'agent : il n'y a plus d'espèces à déposer, plus de rapport à rapprocher, plus de terminal.
-- (20/09) L'argent n'entre plus que par UN canal, et il se rapproche seul : le prélèvement carte du commerçant à
-- chaque bon d’achat vendu (partner_charges, prestataire Stripe).

CREATE TABLE supplier_bookings (                         -- règlements fournisseurs voyage
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid NOT NULL REFERENCES orders(id),
  provider          text NOT NULL CHECK (provider IN ('duffel','nuitee')),
  provider_ref      text,
  confirmation_code text,                               -- PNR compagnie (Duffel) / hotelConfirmationCode (Nuitée) — transmis au client via Brevo
  amount_cents      integer NOT NULL,
  payment_timing    text NOT NULL CHECK (payment_timing IN ('duffel_prepaid','nuitee_postpaid')),
  settlement_status settlement_status NOT NULL DEFAULT 'not_due',
  settled_at        timestamptz
);

CREATE TABLE order_services (                            -- bagages & services Duffel (available_services → services de l'order)
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             uuid NOT NULL REFERENCES orders(id),
  service_type         text NOT NULL DEFAULT 'baggage' CHECK (service_type IN ('baggage')),
  provider_service_id  text,                             -- l'id available_service Duffel (ase_…)
  segment_ref          text,                             -- segment_ids : la soute se choisit PAR SENS
  passenger_ref        text,                             -- passenger_ids : et PAR PASSAGER
  quantity             integer NOT NULL DEFAULT 1,
  amount_cents         integer NOT NULL,                 -- total_amount du service — TEL QUEL, jamais re-margé
  maximum_weight_kg    integer,                          -- du metadata Duffel — NULL si la compagnie ne le publie pas
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_changes (                             -- ✈ changements de VOL (Duffel Order Changes — l'hôtel s'annule et se re-réserve)
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id               uuid NOT NULL REFERENCES orders(id),
  status                 text NOT NULL DEFAULT 'demande'
                         CHECK (status IN ('demande','offres_recues','attente_accord','confirme','abandonne','inéligible')),
  -- l'OFFRE de changement de la compagnie (order_change_offers)
  provider_offer_id      text,
  change_total_cents     integer,                        -- différence de prix (peut être négative = crédit)
  penalty_total_cents    integer,                        -- pénalité du tarif (0 si tarif modifiable / pack Flex)
  new_total_cents        integer,
  new_slices             jsonb,                          -- les vols de remplacement proposés
  created_at             timestamptz NOT NULL DEFAULT now(),
  decided_at             timestamptz
);

CREATE TABLE cancellation_requests (                     -- F10 · l'orchestration annulation/remboursement (spec-annulations)
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id               uuid NOT NULL REFERENCES orders(id),
  scope                  text NOT NULL CHECK (scope IN ('vol','hotel','pack')),
  status                 text NOT NULL DEFAULT 'recue'
                         CHECK (status IN ('recue','devis_en_cours','devis_pret','attente_accord','confirmee','remboursement_du','soldee','refusee','devis_perime')),
  motif                  text,
  reason_kind            text CHECK (reason_kind IN ('compagnie','client_flex','client_partiel','nrfn')),
  -- le DEVIS fournisseur (Duffel : pending order_cancellation · Nuitée : cancelBooking selon paliers)
  provider_refund_cents  integer,
  provider_refund_to     text CHECK (provider_refund_to IN ('payment_source','airline_credits')),
  airline_credit_code    text,                            -- avoir NOMINATIF — transmis au client tel quel
  provider_response      jsonb,                            -- réponse brute Duffel order_cancellations / Nuitée cancelBooking (piste d'audit)
  quote_expires_at       timestamptz,                     -- expires_at Duffel : confirmer AVANT, sinon re-deviser
  -- la GRILLE PayEnCash (lib/remboursements.js) — restitution client
  service_fee_refund_cents integer NOT NULL DEFAULT 0,
  pack_kept_cents        integer NOT NULL DEFAULT 0,
  client_refund_cents    integer,
  voucher_refund_cents   integer NOT NULL DEFAULT 0,      -- (20/09, ex-card_refund_cents) la part réglée par bon RE-CRÉDITE le bon
  -- (18/09, soir) 'especes_agent' est SUPPRIMÉ : plus personne ne se déplace rendre des espèces. (20/09) 'psp' l'est
  -- à son tour avec le rail en ligne. Restent le RE-CRÉDIT DU BON (l'argent repart par où il est venu), le virement
  -- au RIB du client pour le reste, et l'avoir compagnie transmis tel quel.
  refund_method          text CHECK (refund_method IN ('virement','bon','avoir_compagnie')),
  created_at             timestamptz NOT NULL DEFAULT now(),
  decided_at             timestamptz,
  refunded_at            timestamptz
);

CREATE TABLE provider_wallets (                          -- avance Duffel (fonds de roulement, Partie 1b §4)
  provider       text PRIMARY KEY,                       -- 'duffel'
  balance_cents  integer NOT NULL,
  alert_threshold_cents integer NOT NULL                 -- ≈ D × X × Y
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6 · LIGNE MODE (fournisseurs, articles, pièces, expéditions)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE suppliers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  status         supplier_status NOT NULL DEFAULT 'candidate',
  kyb_verified_at timestamptz,
  iban_last4     text,                                   -- RIB pour virement ≤ 7 j — JAMAIS de « solde »
  rib_check_pending_at timestamptz,                      -- (08/09) IBAN modifié par le fournisseur : aucun virement tant que le manager n'a pas contrôlé le RIB déposé (audit_log rib_a_controler / rib_controle)
  conformity_score integer,                              -- surveillance Manager (< 80 % ⇒ watch)
  -- (11/09 — lot 9) CE QUE LA CANDIDATURE ÉCRIT ET QUE LA BASE NE RECEVAIT PAS : la ville, le contact, le compte
  -- d'accès et — depuis le lot 8 — l'APPORTEUR, quand un commercial a recruté l'atelier (`suppliers.recruited_by`
  -- que l'audit réclamait : sans lui, l'entonnoir de prélancement affichait 120 candidatures venues de nulle part).
  city           text,
  contact_email  text,
  contact_phone  text,
  account_id     text,                                   -- le compte de l'atelier (FK posée en fin de fichier : accounts est défini plus bas)   -- (13/09) accounts.id est du TEXTE : `uuid` empêchait la clé étrangère de se créer
  recruited_by   text,                                   -- l'identifiant du commercial qui l'a invité, ou NULL (auto-inscription)
  created_at     timestamptz NOT NULL DEFAULT now()
);

/* ── (11/09 — lot 9) L'IDENTITÉ LÉGALE D'UN FOURNISSEUR EST RELEVÉE, PAS DEVINÉE ────────────────────────────────
   Elle était FABRIQUÉE par un hachage de l'identifiant (lot 4) : la fiche, le contrat-cadre signé et les factures
   portaient des numéros inventés, IBAN compris. Elle vient de ce que le contrôleur LIT sur la pièce au moment où il
   la valide (PEC_DOCS.MENTIONS) — d'où la référence à la pièce d'origine sur chaque bloc. Ce qui manque manque : le
   contrat, la facture et le livre de police sont refusés tant que c'est vide. ── */
CREATE TABLE supplier_legal (
  supplier_id    uuid PRIMARY KEY REFERENCES suppliers(id) ON DELETE CASCADE,
  -- relevé sur le Kbis
  legal_name     text, legal_form text,
  siren          text CHECK (siren IS NULL OR siren ~ '^[0-9]{9}$'),
  siret          text CHECK (siret IS NULL OR siret ~ '^[0-9]{14}$'),
  rcs            text, share_capital text, naf text,
  address        text, director text,
  kbis_document_id uuid,                                 -- la pièce d'où ces mentions ont été relevées (FK posée en fin de fichier : kyc_documents est défini plus bas)
  -- relevé sur la déclaration de TVA
  vat_number     text,                                   -- n° intracommunautaire (vérifiable VIES)
  vat_scheme     text CHECK (vat_scheme IN ('franchise','marge','normal')),   -- 293 B · 297 A · régime normal
  vat_document_id uuid,
  -- relevé sur le RIB
  iban           text,
  bic            text,
  account_holder text,
  rib_document_id uuid,
  recorded_by    text, recorded_at timestamptz NOT NULL DEFAULT now()
);

/* ── (12/09 — demande fondatrice) LES RÉSEAUX DE LA BOUTIQUE ────────────────────────────────────────────────
   L'atelier vit de sa communauté : ses comptes se relient depuis son espace. Ce qui est stocké est un IDENTIFIANT
   (l'URL se dérive du réseau — on ne publie pas un lien libre sur une page ouverte au public), avec sa VISIBILITÉ :
   relier son compte pour la relation commerciale n'oblige pas à l'afficher sur sa boutique. Rien n'est « vérifié » :
   le lien est DÉCLARÉ par le fournisseur, et les écrans le disent. ── */
CREATE TABLE supplier_social_links (
  supplier_id  uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  network      text NOT NULL CHECK (network IN ('instagram','tiktok','snapchat','facebook','whatsapp','site')),
  handle       text NOT NULL,                             -- l'identifiant seul, sans @ ni https:// (le site : le domaine)
  is_public    boolean NOT NULL DEFAULT true,             -- affiché sur la page boutique côté Mode
  declared_by  text,                                      -- le login du compte fournisseur qui l'a relié
  declared_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (supplier_id, network)
);

-- RÉFÉRENTIEL COULEURS (alignement Blueprint §1) : HEX + libellé + pastille + famille
-- (la famille regroupe pour la facette « couleur » : bordeaux/carmin → 'rouge').
CREATE TABLE colors (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text UNIQUE NOT NULL,                     -- 'ROUGE_FEU'
  label        text NOT NULL,                            -- 'Rouge feu'
  hex          char(7) NOT NULL CHECK (hex ~ '^#[0-9A-Fa-f]{6}$'),
  swatch_url   text,                                     -- image de pastille (texture/dégradé réel)
  color_family text NOT NULL                             -- 'rouge' (facette regroupée)
);

-- ARBORESCENCE DE CATÉGORIES (Blueprint §1) : parent_id + chemin matérialisé TEXT
-- (portable, sans extension ltree) — filtrage sous-arbre par prefixe LIKE 'sneakers.%'.
CREATE TABLE categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id  uuid REFERENCES categories(id) ON DELETE RESTRICT,
  slug       text UNIQUE NOT NULL,                        -- 'sneakers-lifestyle'
  name       text NOT NULL,
  path       text NOT NULL,                               -- 'sneakers.lifestyle' (racine → feuille)
  depth      smallint NOT NULL,
  position   integer NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true
);
CREATE INDEX idx_categories_path ON categories (path text_pattern_ops);

-- GUIDES DE TAILLES (Blueprint §1) : réutilisable, associé au produit.
CREATE TABLE size_guides (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,                               -- 'Sneakers unisexe EU', 'Robes femme FR'
  system     text NOT NULL,                               -- 'EU' | 'FR' | 'UK' | 'US' | 'ALPHA'
  measures   jsonb NOT NULL DEFAULT '[]',                 -- [{size:'40', eu:'40', uk:'6.5', us:'7', cm:'25'}]
  fit_advice text                                         -- 'Taille normalement.'
);

-- COLLECTIONS / SAISONS (Blueprint §1) — distinct de collab_drops (drops influenceurs).
CREATE TABLE collections (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code      text UNIQUE NOT NULL,                         -- 'AH2026'
  label     text NOT NULL,                                -- 'Automne-Hiver 2026'
  season    text NOT NULL,                                -- 'AH' | 'PE' | 'PERMANENT'
  year      smallint NOT NULL,
  starts_on date, ends_on date
);

-- MÉDIAS PAR COULEUR (alignement Blueprint §1.4) : rôles typés, galerie rattachée à la
-- COULEUR (color_id NULL = média générique partagé). Supersède mode_articles.photos[].
CREATE TYPE media_type AS ENUM ('image','video');
CREATE TYPE media_role AS ENUM ('face','dos','etiquette','defaut','detail','porte','video');

CREATE TABLE mode_articles (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           text UNIQUE NOT NULL,                   -- « airmax »
  supplier_id    uuid NOT NULL REFERENCES suppliers(id),
  name           text NOT NULL, brand text NOT NULL,
  category       text NOT NULL, subcategory text,         -- libellés dénormalisés (affichage/legacy)
  category_id    uuid REFERENCES categories(id),          -- catégorie normalisée (arbre) — source unique
  size_guide_id  uuid REFERENCES size_guides(id),         -- guide des tailles associé
  collection_id  uuid REFERENCES collections(id),         -- saison / collection (AH2026)
  genre          text NOT NULL DEFAULT 'mixte' CHECK (genre IN ('homme','femme','enfant','mixte')),  -- Pour qui ? (wizard fournisseur)
  sku            text,
  color_id       uuid REFERENCES colors(id),             -- couleur NORMALISÉE (HEX/pastille) — source unique
  color          text, material text,                    -- color = libellé dénormalisé (affichage rapide)
  condition      text NOT NULL,                          -- échelle Vinted
  is_new         boolean NOT NULL,
  vat_scheme     vat_scheme NOT NULL,                    -- occasion ⇒ marge_occasion · neuf ⇒ tva_20
  defects        text,                                   -- décrits + photographiés (occasion)
  invoice_required boolean NOT NULL DEFAULT false,       -- OBLIGATOIRE sneakers neuves
  provenance     text CHECK (provenance IN ('marque','destockage','retour','rachat','fabrication')),  -- (08/09) déclarée par le fournisseur (ref.provenances)
  origin_invoice_name text,                              -- facture d'origine jointe : le NOM affiché au registre
  -- (10/09 — lot 6, constat B8) …et le FICHIER. Le livre de police citait un justificatif introuvable : à un contrôle
  -- (art. 321-7 du code pénal), il n'y avait rien à produire. Le document est déposé sous la réf du lot.
  origin_invoice_url text,
  ownership_certified_at timestamptz,                    -- certification de propriété/authenticité horodatée (contrat-cadre « Propriété et risques »)
  authenticated  boolean NOT NULL DEFAULT false,
  buy_price_cents  integer NOT NULL,                     -- prix d'achat ferme (−8 % marché)
  sell_price_cents integer NOT NULL,                     -- ≈ buy × 1,12/0,92 (grille Partie 1b §1)
  ref_price_cents  integer,                              -- prix neuf barré (Omnibus)
  weight_grams   integer NOT NULL,                       -- tarif Mondial Relay au poids
  photos         text[] NOT NULL DEFAULT '{}',           -- LEGACY (URLs à plat) — superséé par product_media (galerie par couleur/rôle)
  composition    jsonb NOT NULL DEFAULT '[]',            -- [[élément, matière], …] — saisi par le FOURNISSEUR, vérifié atelier
  care           text,                                   -- entretien — saisi par le FOURNISSEUR
  status         piece_status NOT NULL DEFAULT 'soumis', -- axe PHYSIQUE (parcours de la pièce)
  controle       piece_controle,
  editorial_status editorial_status NOT NULL DEFAULT 'draft', -- axe ÉDITORIAL (workflow de publication)
  publish_at     timestamptz,                            -- mise en ligne planifiée (scheduled)
  published_at   timestamptz,                            -- passage effectif en live
  piece_unique   boolean NOT NULL DEFAULT false,         -- occasion = pièce unique
  favorites      integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  /* (19/09, soir — décision fondatrice « aucun article ne peut coûter plus de 1 000 €, c'est impossible »)
     LE PLAFOND DU PRIX CLIENT. Il n'est pas seulement commercial : nos clients paient SANS CARTE, par Bons
     d'achat PayEnCash de 250 € plafonnés à 1 000 € par jour et par compte (gift_cards / app_settings
     bons.plafondClientJour) — au-dessus, aucune commande ne pourrait être réglée. La valeur vit dans les
     paramètres (scenario.grilleMode.plafondClient, réglable en manager/10) ; la contrainte grave ici le
     principe, et vaut à la mise en vente comme à la re-tarification (PEC_DATA.prixPlafondControle). */
  CONSTRAINT prix_client_plafonne CHECK (sell_price_cents <= 100000),
  CONSTRAINT prix_client_au_dessus_achat CHECK (sell_price_cents >= buy_price_cents)
);

-- (08/09) HISTORIQUE DE PRIX CLIENT (loi Omnibus, art. L112-1-1 C. conso) : chaque prix entré en vigueur, daté et
-- motivé (publication, re-cotation atelier). Le prix de référence d'une réduction = le minimum sur les 30 jours
-- qui la précèdent, CALCULÉ ici (prixBasFenetre) — jamais un champ figé.
CREATE TABLE article_price_history (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  article_id   uuid NOT NULL REFERENCES mode_articles(id) ON DELETE CASCADE,
  price_cents  integer NOT NULL,
  reason       text NOT NULL,                             -- 'publication' | 're-cotation atelier'
  effective_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE order_items
  ADD CONSTRAINT fk_mode_article FOREIGN KEY (mode_article_id) REFERENCES mode_articles(id);

-- GALERIE PAR COULEUR (Blueprint §1.4) : changer de couleur change la galerie.
-- Un média color_id = NULL est générique (ambiance, guide) partagé par toutes les couleurs.
CREATE TABLE product_media (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id  uuid NOT NULL REFERENCES mode_articles(id) ON DELETE CASCADE,
  color_id    uuid REFERENCES colors(id),               -- NULL = média générique
  type        media_type NOT NULL DEFAULT 'image',
  role        media_role NOT NULL DEFAULT 'face',
  url         text NOT NULL,
  srcset      jsonb,                                     -- {"400":"…","800":"…","1600":"…"} (responsive, CLS-safe)
  -- (10/09 — lot 6, constat C14) LA VUE RÉELLE, ET SA VIGNETTE. Les photos du fournisseur n'étaient que des NOMS de
  -- fichier : la fiche client montrait une image d'illustration de la même famille à la place de la pièce vendue.
  -- `url` porte l'original (contrôlé en atelier), `thumb_url` la copie réduite que chargent les grilles.
  thumb_url   text,
  alt         text NOT NULL,
  width       integer, height integer, duration_s integer,
  position    integer NOT NULL DEFAULT 0
);
-- galerie affichée = WHERE article_id=:a AND (color_id=:sel OR color_id IS NULL)
--   ORDER BY (color_id IS NULL), position  → les médias de LA couleur passent devant les génériques.
CREATE INDEX idx_product_media_gallery ON product_media (article_id, color_id, position);

CREATE TABLE brands (                                    -- vue marque (Vinted)
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name   text UNIQUE NOT NULL,
  active_pieces integer NOT NULL DEFAULT 0
);

CREATE TABLE trend_looks (                               -- « Porté par » : influenceur/artiste + sa tenue
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  who    text NOT NULL, role text,
  photo  text,
  outfit jsonb NOT NULL DEFAULT '[]'                     -- [{piece, marque, prix_boutique_cents}]
);

CREATE TABLE look_similars (                             -- les mêmes pièces, MOINS CHÈRES, sur le site
  look_id    uuid NOT NULL REFERENCES trend_looks(id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES mode_articles(id),
  note       text,
  PRIMARY KEY (look_id, article_id)
);

CREATE TABLE collab_drops (                              -- lignes spéciales PayEnCash × influenceur × fournisseur
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name     text NOT NULL, with_who text NOT NULL,
  spirit   text,                                         -- culture pop — le consommateur reste anonyme
  status   text NOT NULL CHECK (status IN ('a_venir','drop_en_cours','termine')),
  drop_on  text,
  article_ids uuid[] NOT NULL DEFAULT '{}'
);

CREATE TABLE article_variants (                          -- neuf = multi-tailles ; occasion = 1 taille qté 1
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id  uuid NOT NULL REFERENCES mode_articles(id) ON DELETE CASCADE,
  size        text NOT NULL,
  -- STOCK À 4 NIVEAUX (alignement Blueprint §2) : compteurs matérialisés (lecture O(1)),
  -- réconciliés par stock_ledger. disponible = stock − reserved − sold − quarantine.
  stock       integer NOT NULL DEFAULT 0 CHECK (stock      >= 0),   -- PHYSIQUE en entrepôt (on_hand)
  reserved    integer NOT NULL DEFAULT 0 CHECK (reserved   >= 0),   -- Σ réservations actives (panier)
  sold        integer NOT NULL DEFAULT 0 CHECK (sold       >= 0),   -- payé, en attente d'expédition
  quarantine  integer NOT NULL DEFAULT 0 CHECK (quarantine >= 0),   -- retours en inspection, invendables
  version     integer NOT NULL DEFAULT 0,                           -- verrou optimiste
  UNIQUE (article_id, size),
  -- INVARIANT ABSOLU : le disponible ne peut JAMAIS être négatif (dernier rempart anti-survente)
  CONSTRAINT chk_variant_available_non_neg CHECK (stock - reserved - sold - quarantine >= 0)
);
-- Source UNIQUE du stock disponible (API fiche produit, recherche, facettes)
-- (19/09 — fondatrice « fais le filtre sur la robe aussi, ou toute article, pour que la gestion du stock soit
--  parfaite ») LA VUE NE REGARDAIT QUE LES COMPTEURS. Un article encore « soumis » (photos en attente d'atelier),
--  refusé ou en re-cotation exposait tout de même ses tailles comme disponibles : la même faille que côté app,
--  où le stock se comptait sans regarder le statut du lot. Disponible à la vente = compteurs positifs ET pièce
--  validée. Le stock PHYSIQUE d'un fournisseur se lit sur article_variants, pas ici : ses brouillons et ses
--  pièces à l'atelier existent, ils ne sont simplement pas à vendre.
--  (L'axe ÉDITORIAL `editorial_status = 'live'` est la seconde barrière : il entrera dans cette vue le jour où
--   l'app l'implémentera — aujourd'hui elle ne connaît que l'axe physique, et la vue dit ce que l'app fait.)
CREATE VIEW v_mode_stock_available AS
  SELECT v.id AS variant_id, v.article_id, v.size,
         (v.stock - v.reserved - v.sold - v.quarantine) AS available
    FROM article_variants v
    JOIN mode_articles a ON a.id = v.article_id
   WHERE a.status = 'valide_publie';

-- ═══ CYCLE DU STOCK (audit fondatrice 22/08 · 4 niveaux Blueprint §2) ══════════
-- disponible = article_variants.stock − reserved − sold − quarantine   (compteurs matérialisés,
--   égal à : stock − Σ(stock_reservations actives) − Σ(vendu non expédié) − Σ(retours en inspection))
-- réservation (commande validée, code émis, MINUTEUR 1 h) → active : reserved++
--   · payé (en ligne ou par Bon d’achat) → confirmee : stock décrémenté DÉFINITIVEMENT + achat ferme (purchase_orders)
--   · minuteur expiré      → expiree (CRON) : le stock redevient disponible, le code est invalidé
--   · commande annulée     → annulee : idem
CREATE TYPE reservation_status AS ENUM ('active','confirmee','expiree','annulee');
CREATE TABLE stock_reservations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid NOT NULL REFERENCES orders(id),
  variant_id   uuid NOT NULL REFERENCES article_variants(id),
  qty          integer NOT NULL CHECK (qty > 0),
  status       reservation_status NOT NULL DEFAULT 'active',
  expires_at   timestamptz NOT NULL,                     -- LE MINUTEUR (fenêtre prix bloqué)
  -- LA GRÂCE : une réservation ne meurt pas sous le nez de celui qui paie. (17/09 — pivot) le geste qui la fige
  -- n'est plus le scan d'un partenaire : c'est le scan du flashcode PAR L'AGENT arrivé chez le client
  -- (verifierRef) — (20/09) l'ouverture d'une transaction en ligne ne la fige plus : ce rail n'existe plus.
  scan_hold_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  released_at  timestamptz
);
CREATE INDEX idx_reservations_actives ON stock_reservations (variant_id) WHERE status = 'active';

-- ═══ GRAND-LIVRE DES MOUVEMENTS (alignement Blueprint §2.3) ════════════════════
-- Append-only : jamais d'UPDATE/DELETE. Chaque mouvement laisse une ligne immuable
-- avec le solde résultant du niveau touché — audit et réconciliation des compteurs.
CREATE TYPE movement_type AS ENUM (
  'reception',                                     -- + réception fournisseur (ramassage → entrepôt)
  'reservation_hold','reservation_release',        -- panier : hold TTL / libération
  'sale',                                          -- réservé → vendu (encaissement client = achat ferme)
  'shipment',                                      -- vendu → sorti (Mondial Relay)
  'return_in','return_restock','return_scrap',     -- retours : quarantaine → restock ou rebut
  'adjustment','loss'                              -- inventaire manuel (+/-) · perte/vol/casse
);
CREATE TABLE stock_ledger (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  variant_id    uuid NOT NULL REFERENCES article_variants(id),
  type          movement_type NOT NULL,
  delta         integer NOT NULL,                  -- signé (+/-) sur le niveau concerné
  level_touched text NOT NULL CHECK (level_touched IN ('stock','reserved','sold','quarantine')),
  balance_after integer NOT NULL,                  -- solde du niveau APRÈS mouvement
  ref_type      text, ref_id text,                 -- ('order', …) / ('reservation', …) / ('mode_return', …)
  actor         text NOT NULL,                     -- 'system' | 'user:…' | 'manager:…' | 'cron'
  reason        text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_ledger_variant ON stock_ledger (variant_id, created_at DESC);

-- ═══ RETOURS (process mode/13) ═════════════════════════════════════════════════
-- retour 14 j → étiquette MR retour → reçu atelier → re-contrôle :
--   conforme → remboursé (avoir · virement) + restock (republication) ou retrait
CREATE TYPE return_status  AS ENUM ('demande','etiquette_emise','en_transit','recu_atelier','conforme_rembourse','refuse');
-- MODE : remboursement en AVOIR ou VIREMENT uniquement (jamais en espèces — traçabilité
-- LCB-FT, décision fondatrice 31/08). Le VOYAGE connaît d'autres voies (cancellation_requests :
-- retour sur le moyen en ligne, avoir compagnie, re-crédit du Bon d’achat) — deux régimes distincts.
-- (18/09, soir) Plus aucune voie en espèces nulle part : personne, chez PayEnCash, n'en manipule.
CREATE TYPE refund_method  AS ENUM ('avoir','virement','bon');   -- (18/09) 'bon' = RE-CRÉDIT du Bon d’achat PayEnCash qui a réglé (PEC_BUS.rembourser mode 'bon') : jamais en espèces
CREATE TABLE user_favorites (                            -- FAVORIS par utilisateur — MODE (articles) ET hôtels (fondatrice 23/08)
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id),
  kind       text NOT NULL CHECK (kind IN ('mode_article','hotel')),
  target_id  text NOT NULL,                              -- article id / nuitee_hotel_id
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, target_id)
);

CREATE TABLE stock_waitlist (                            -- ZÉRO VENTE PERDUE : file d'attente sur article épuisé/réservé
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id     uuid NOT NULL REFERENCES article_variants(id),
  user_id        uuid NOT NULL REFERENCES users(id),
  position       integer NOT NULL,
  status         text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','notified','converted','expired')),
  priority_until timestamptz,                            -- fenêtre PRIORITAIRE 15 min après libération : le stock lui est pré-réservé
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (variant_id, user_id)
);

CREATE TABLE product_alerts (                            -- « Me prévenir s'il se libère » : la vente différée n'est pas perdue
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id  uuid NOT NULL REFERENCES article_variants(id),
  user_id     uuid NOT NULL REFERENCES users(id),
  notified_at timestamptz,                               -- notifié à la re-dispo (Brevo) — une fois
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (variant_id, user_id)
);

CREATE TABLE mode_returns (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id  uuid NOT NULL REFERENCES order_items(id),
  reason         text NOT NULL,
  refund_method  refund_method NOT NULL,
  status         return_status NOT NULL DEFAULT 'demande',
  label_ref      text,                                   -- « RET-M-1208 » (étiquette MR retour)
  refund_cents   integer NOT NULL CHECK (refund_cents >= 0),
  restock        boolean,                                -- re-contrôle atelier : republiée (true) ou retirée (false)
  created_at     timestamptz NOT NULL DEFAULT now(),
  received_at    timestamptz,
  refunded_at    timestamptz
);

CREATE TABLE purchase_orders (                           -- ACHAT FERME déclenché à l'encaissement client
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid NOT NULL REFERENCES orders(id),
  supplier_id  uuid NOT NULL REFERENCES suppliers(id),
  article_id   uuid NOT NULL REFERENCES mode_articles(id),
  buy_price_cents integer NOT NULL,                       -- prix d'achat CONVENU (cote −8 %)
  promo_discount_cents integer NOT NULL DEFAULT 0,        -- remise code fournisseur imputée (à sa charge)
  final_buy_price_cents integer,                          -- prix réellement dû (convenu − promo, puis re-coté) ; NULL = convenu
  status       po_status NOT NULL DEFAULT 'confirme',     -- confirmé → re-coté | annulé (contrôle atelier)
  controle     piece_controle,                            -- verdict atelier appliqué à CET achat
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- (10/09 — lot 6, constat C16) LA RE-COTATION EST UNE PROPOSITION, PAS UNE DÉCISION.
--   Le contrat-cadre l'écrit deux fois (« que le fournisseur accepte ou refuse dans son espace » ; « ne modifie le prix
--   d'achat convenu qu'avec l'acceptation du fournisseur ») : l'accord VAUT AVENANT (art. 1193 du code civil) et doit
--   donc être daté, motivé et opposable. Il vivait nulle part — l'atelier réécrivait le prix de l'inventaire séance
--   tenante. Miroir de PEC_DATA.pieceVerdict('recote') / recoteRepondre.
CREATE TABLE mode_recotations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id     uuid NOT NULL REFERENCES mode_articles(id) ON DELETE CASCADE,
  supplier_id    uuid NOT NULL REFERENCES suppliers(id),
  purchase_order_id uuid REFERENCES purchase_orders(id),   -- renseigné si la pièce était DÉJÀ vendue : l'écart suit l'achat ferme
  buy_before_cents  integer NOT NULL,                      -- le prix vendeur convenu avant la proposition
  buy_proposed_cents integer NOT NULL,                     -- ce qui se re-cote, c'est le PRIX VENDEUR (le prix client s'en déduit)
  sell_proposed_cents integer NOT NULL,                    -- prix client dérivé du coefficient de vente en vigueur
  condition_before text, condition_proposed text,          -- l'état déclaré, et celui retenu à l'examen
  reason         text NOT NULL,                            -- un écart à la fiche se motive : il est opposé au fournisseur
  proposed_by    text NOT NULL, proposed_at timestamptz NOT NULL DEFAULT now(),
  status         text NOT NULL DEFAULT 'proposee' CHECK (status IN ('proposee','acceptee','refusee')),
  answered_by    text, answered_at timestamptz, answer_note text,   -- le refus n'a pas à se motiver : il reste sans conséquence
  UNIQUE (article_id, proposed_at)
);
CREATE INDEX mode_recotations_attente ON mode_recotations (supplier_id, status);

CREATE TABLE supplier_invoices (                         -- le fournisseur FACTURE AJEK → virement ≤ 7 j
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id   uuid NOT NULL REFERENCES suppliers(id),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id),
  amount_cents  integer NOT NULL,
  -- (11/09 — lot 9) LE CYCLE DE VIE D'UNE FACTURE. Le JS l'écrit depuis toujours (à facturer → émise → virée) et la
  -- comptabilité s'en sert pour décider ce qui est une écriture : aucune colonne ne le recevait, seules les DATES
  -- laissaient le deviner — et « émise sans virement » ne se distinguait pas de « pas encore émise ».
  status        text NOT NULL DEFAULT 'a_facturer' CHECK (status IN ('a_facturer','emise','viree','annulee')),
  issued_at     timestamptz,                             -- posée à l'ÉMISSION, pas à la création de la ligne
  due_at        timestamptz,                             -- issued_at + 7 jours MAX
  paid_at       timestamptz,
  -- (08/09 — audit fournisseur) la facture est un DOCUMENT : numéro (F-<année>-<achat>) et pièce du coffre (kyc_documents scope fournisseur, kind 'facture-<numéro>')
  invoice_number text UNIQUE,                             -- (10/09 — lot 6, C26) SÉQUENTIEL CONTINU par exercice (F-<année>-<NNNN>), jamais dérivé de la réf de commande : deux fournisseurs d'une même commande recevaient le même numéro
  due_calculated_at timestamptz,                          -- (C28) l'échéance est une DATE (émission + ref.juridique.virementJours) : sans elle, aucun retard n'était mesurable
  paid_late      boolean NOT NULL DEFAULT false,          -- dérivé de paid_at > due_at — « dans les délais » était écrit en dur
  document_kind text,                                    -- pièce du coffre : kyc_documents (scope 'fournisseur', kind 'facture-<numéro>') — pas de FK : le coffre est défini plus loin
  -- (10/09 — lot 5) CE QUE LA FACTURE PORTE VRAIMENT : le brut, moins les débits définitifs compensés, moins la retenue
  -- de garantie quand le palier l'impose. La retenue est ANNONCÉE À L'AVANCE et libérée à date : elle ne porte jamais
  -- sur la totalité, et jamais sur une facture non contestée.
  gross_cents    integer,                                -- le brut avant compensation (amount_cents = le NET viré)
  debits_cents   integer NOT NULL DEFAULT 0,             -- somme des supplier_debits imputés sur cette facture
  holdback_cents integer NOT NULL DEFAULT 0,             -- retenue de garantie (ref.reclamations.retenue.fraction)
  holdback_reason text,                                  -- le palier et le taux qui l'ont déclenchée — dits au fournisseur
  holdback_release_at timestamptz,                       -- libérée à cette date si le taux est redescendu
  -- (10/09 — lot 6, constat C27) AUTOFACTURATION ET RÉGIME DE TVA. La facture est matériellement établie par AJEK au nom
  -- du fournisseur : c'est de l'autofacturation (art. 289, I, 2 CGI), qui suppose un MANDAT écrit préalable — il vit
  -- dans le contrat-cadre signé, et la facture le cite. Elle portait « TVA : selon le régime du fournisseur — mention à
  -- sa charge » : une facture ne délègue pas ses mentions obligatoires. Le régime se relève sur la déclaration validée.
  self_billed    boolean NOT NULL DEFAULT true,          -- mention « Autofacturation » (art. 242 nonies A ann. II CGI)
  mandate_signed_at timestamptz,                         -- date de signature du contrat-cadre qui porte le mandat
  vat_scheme_supplier text CHECK (vat_scheme_supplier IN ('franchise','marge','normal')),  -- kyc_documents kind 'tva', mentions relevées
  vat_rate       numeric(4,2) NOT NULL DEFAULT 0,        -- 0 en franchise (293 B) et sous le régime de la marge (297 A)
  net_ht_cents   integer,                                -- le prix d'achat convenu, hors taxe
  vat_cents      integer NOT NULL DEFAULT 0,             -- TVA déductible par AJEK — non nulle au seul régime normal
  CONSTRAINT delai_7j CHECK (due_at IS NULL OR issued_at IS NULL OR due_at <= issued_at + interval '7 days')
);

-- ─────────────────────────────────────────────────────────────────────────────
--  (10/09 — lot 5) RÉCLAMATIONS MODE — DU CLIENT AU FOURNISSEUR
--      Document de référence : ESPACE-COMMERCANT/documents/politique-reclamations-fournisseur.html
--      PayEnCash ACHÈTE FERME et REVEND EN SON NOM : face au client c'est nous le vendeur (garantie légale,
--      rétractation), face au fournisseur le recours est CONTRACTUEL. D'où la règle du modèle : le client est
--      remboursé sur SA déclaration (`refunded_at`), le fournisseur n'est débité que sur un CONSTAT
--      (`mode_claim_inspections`). Miroir de PEC_DATA.reclamationCreer / reclamationConstater / fournisseurTauxDefaut.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE mode_claims (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_ref      text UNIQUE NOT NULL,                                 -- REC-M-<n>, la clé citée au client et au fournisseur
  order_ref      text NOT NULL REFERENCES orders(ref),
  variant_id     uuid REFERENCES article_variants(id),                 -- la LIGNE en litige (une commande groupée en a plusieurs)
  supplier_id    uuid REFERENCES suppliers(id),                        -- NULL = pièce sans fournisseur identifié : personne n'est débité
  user_id        uuid REFERENCES users(id),
  reason         text NOT NULL,                                        -- ref.reclamations.motifs[].id — la matrice des 11 cas
  description    text,
  amount_cents   integer NOT NULL CHECK (amount_cents >= 0),           -- le prix CLIENT de la ligne
  return_fee_cents integer NOT NULL DEFAULT 0,                         -- frais de retour à la charge du client (0 si offerts)
  first_return   boolean NOT NULL DEFAULT false,                       -- le 1er retour d'une commande est offert (arbitrage 10/09)
  return_required boolean NOT NULL DEFAULT true,                       -- false sous ref.reclamations.sansRetourSous : on rembourse sans reprendre
  return_label   text,                                                 -- RET-<order_ref>, étiquette Mondial Relay
  return_due_at  timestamptz,                                          -- le client dépose avant cette date, sinon le dossier tombe
  dropped_at     timestamptz,                                          -- scan du dépôt en relais
  received_at    timestamptz,                                          -- réception à l'atelier — sans elle, pas de constat
  refunded_at    timestamptz,
  refund_mode    text CHECK (refund_mode IN ('avoir','virement')),     -- jamais d'espèces (LCB-FT)
  refund_cents   integer,
  status         text NOT NULL DEFAULT 'ouverte'
                 CHECK (status IN ('ouverte','remboursee','retour_attendu','retour_recu','constatee','contestee','close')),
  support_ref    text,                                                 -- la demande hotline ouverte en parallèle (support_conversations.ref)
  opened_at      timestamptz NOT NULL DEFAULT now(),
  opened_by      text NOT NULL DEFAULT 'client'
);

CREATE TABLE mode_claim_photos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id    uuid NOT NULL REFERENCES mode_claims(id) ON DELETE CASCADE,
  origin      text NOT NULL CHECK (origin IN ('client','atelier')),    -- les preuves des deux côtés, jamais mélangées
  file_name   text NOT NULL,
  size_bytes  integer,
  taken_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE mode_claim_inspections (                                  -- LE CONSTAT : il rend le débit définitif, ou l'annule
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id     uuid UNIQUE NOT NULL REFERENCES mode_claims(id) ON DELETE CASCADE,
  verdict      text NOT NULL CHECK (verdict IN ('conforme','non_conforme','transport','contrefacon','vide')),
  reason       text NOT NULL,                                          -- un constat se motive : c'est lui qu'on oppose au fournisseur
  inspected_by text NOT NULL,
  inspected_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE supplier_debits (                                         -- la CRÉANCE sur le fournisseur, compensée sur ses factures
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id       uuid UNIQUE NOT NULL REFERENCES mode_claims(id) ON DELETE CASCADE,
  supplier_id    uuid NOT NULL REFERENCES suppliers(id),
  purchase_cents integer NOT NULL,                                     -- le prix d'ACHAT (jamais notre marge perdue : choix assumé)
  return_cents   integer NOT NULL DEFAULT 0,                           -- frais de retour que NOUS avons avancés
  handling_cents integer NOT NULL DEFAULT 0,                           -- forfait de traitement (ref.reclamations.forfaitTraitement)
  total_cents    integer NOT NULL,
  status         text NOT NULL DEFAULT 'gele'
                 CHECK (status IN ('gele','definitif','conteste','annule','impute')),
  frozen_at      timestamptz NOT NULL DEFAULT now(),                   -- gelé DÈS l'ouverture du dossier : la facture ne part pas avec
  settled_at     timestamptz,
  cancelled_at   timestamptz,
  invoice_id     uuid REFERENCES supplier_invoices(id),                -- la facture sur laquelle il a été compensé
  dispute_text   text,                                                 -- la contestation du fournisseur (ref.reclamations.contestationJours)
  disputed_at    timestamptz,
  decision       text CHECK (decision IN ('accepte','rejete')),
  decision_reason text,
  decided_by     text,                                                 -- le MANAGER, jamais le contrôleur qui a rendu le constat
  decided_at     timestamptz
);

CREATE TABLE supplier_promo_codes (           -- édités par le FOURNISSEUR (jamais AJEK, ligne MODE)
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id  uuid NOT NULL REFERENCES suppliers(id),
  code         text UNIQUE NOT NULL,
  kind         text NOT NULL CHECK (kind IN ('euros','pourcent')),
  value        integer NOT NULL CHECK (value > 0),   -- centimes si euros, points si pourcent
  valid_from   date NOT NULL,
  valid_to     date NOT NULL,
  article_ids  uuid[] NOT NULL,
  max_uses     integer NOT NULL,
  uses         integer NOT NULL DEFAULT 0,
  active       boolean NOT NULL DEFAULT true,
  CONSTRAINT periode_valide CHECK (valid_to >= valid_from)
);
-- Règle métier (service) : la remise s'impute sur le PRIX D'ACHAT convenu
-- (purchase_orders.buy_price_cents réduit d'autant) — la marge AJEK est préservée,
-- et un code ne fait jamais passer une pièce sous son prix plancher.

CREATE TABLE shipments (                                 -- Mondial Relay (Partie 6b §3b)
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid NOT NULL REFERENCES orders(id),
  -- (11/09 — lot 9) QUI EXPÉDIE, ET QUOI. Un colis n'était rattaché qu'à la commande : impossible de dire quel
  -- fournisseur devait l'expédier (donc de mesurer SON retard) ni quelle ligne il contenait sur une commande groupée.
  supplier_id    uuid REFERENCES suppliers(id),
  order_item_id  uuid REFERENCES order_items(id),
  carrier        text NOT NULL DEFAULT 'mondial_relay',
  mr_ref         text UNIQUE,                            -- MR-8412007312 (le client suit avec SES réfs)
  label_url      text,
  relay_id       text, relay_name text, relay_address text,
  pickup_code    text,                                   -- code de retrait
  hold_days      integer NOT NULL DEFAULT 8,             -- garde en relais
  status         shipment_status NOT NULL DEFAULT 'to_ship',
  -- (11/09 — lot 9) le contrôle aléatoire est un ÉTAT du colis ('blocked_control'), pas un booléen à côté du statut :
  -- deux vérités pour un même fait, c'est une occasion de plus de se contredire. Seul le motif reste (control_reason).
  events         jsonb NOT NULL DEFAULT '[]',            -- timeline tracking brute API
  -- (10/09 — lot 6, constat C20) LE DESTINATAIRE. Le fournisseur expédiait « au client » sans savoir à qui : ni nom, ni
  -- téléphone, ni e-mail (exigés par l'API Mondial Relay). Ils sont COPIÉS à la vente, jamais dérivés d'une session.
  recipient_name  text,
  recipient_phone text,
  recipient_email text,
  -- (C21) le SUIVI transporteur : sans ces dates, le client n'était jamais « livré », donc la rétractation de 14 jours
  -- « à compter de la réception » n'avait pas de point de départ et le virement fournisseur pas de déclencheur
  /* (10/09 — lot 5, constat C7) L'ÉCHÉANCE D'EXPÉDITION ÉTAIT UNE PHRASE (« sous 2 j ouvrés ») : aucun retard
     n'était mesurable — ni pour le fournisseur, ni pour la hotline qui prend l'appel, ni pour le client qui
     attend. Elle est DATÉE à la vente (jours ouvrés du contrat-cadre) ; le retard se dérive, il ne se stocke pas. */
  ship_by        timestamptz,                            -- à déposer en point relais avant cette date
  shipped_at     timestamptz,                            -- remise au réseau (dépôt en relais par le fournisseur)
  in_transit_at  timestamptz,
  available_at   timestamptz,                            -- disponible au relais destinataire
  hold_until     timestamptz,                            -- available_at + hold_days
  delivered_at   timestamptz,                            -- LA date de réception : elle ouvre la rétractation
  -- (C15) le contrôle qualité aléatoire, qui n'était écrit nulle part
  control_reason   text,                                 -- pourquoi ce colis a été tiré (taux, ou valeur ≥ seuil)
  control_received_at timestamptz,
  control_verdict  text CHECK (control_verdict IN ('conforme','refuse')),
  control_reason_text text,                              -- un verdict se motive : il est opposé au fournisseur
  control_by     text,
  control_at     timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

/* ── (12/09) UN LIEN PAR (PIÈCE, RÉSEAU) ────────────────────────────────────────────────────────────────────
   Le slug ne portait que le modèle (deux pièces d'un même modèle = même slug, contre la contrainte UNIQUE) et
   rien n'écrivait jamais cette table : les compteurs vivaient dans le navigateur. Le slug désigne désormais à lui
   seul la pièce, son fournisseur et le réseau — l'adresse partagée n'a plus de paramètre à forger. ── */
CREATE TABLE share_links (                               -- fournisseur-influenceur : lien tracé par pièce ET par réseau
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  article_id  uuid NOT NULL REFERENCES mode_articles(id),
  slug        text UNIQUE NOT NULL,                      -- payencash.fr/m/<slug>
  network     text NOT NULL DEFAULT 'lien' CHECK (network IN ('lien','instagram','tiktok','snapchat','facebook','whatsapp','qr')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (article_id, network)                           -- un seul lien par pièce et par réseau
);

/* LES FAITS DU LIEN, un par ligne (les compteurs se DÉRIVENT, ils ne se stockent pas) :
     · 'clic'    l'ouverture de la page de la pièce par un lien vivant (anti-rebond côté produit) ;
     · 'vente'   écrite à l'ENCAISSEMENT, jamais à la commande — une commande abandonnée n'est pas une vente ;
     · 'retrait' la vente attribuée a été remboursée : le compteur redescend sans qu'on efface l'histoire ;
     — (19/09) et les gestes du FOURNISSEUR, qui manquaient : sans eux, « 0 ouverture » ne dit pas s'il a essayé :
     · 'partage' la feuille de partage ouverte sur cette pièce ;
     · 'copie'   son lien copié ;
     · 'visuel'  le visuel à poster téléchargé ou partagé. */
CREATE TABLE share_link_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id uuid REFERENCES share_links(id) ON DELETE SET NULL,
  slug         text NOT NULL,
  kind         text NOT NULL CHECK (kind IN ('clic','vente','retrait','partage','copie','visuel')),
  supplier_id  uuid REFERENCES suppliers(id),
  article_id   uuid REFERENCES mode_articles(id),
  network      text,
  order_ref    text,                                     -- la commande encaissée, pour une 'vente' / un 'retrait'
  amount_cents integer,                                  -- ce qui a été RÉELLEMENT réglé pour cette ligne (négatif pour un retrait)
  reason       text,
  reverted_at  timestamptz,                              -- posé sur la 'vente' quand son 'retrait' est inscrit
  at           timestamptz NOT NULL DEFAULT now()
);

/* (19/09 — fondatrice « nombre de lien partagé KPI, nombre de vue, ajouté en favori ») CE QUE SA PIÈCE
   PROVOQUE. Le fournisseur voyait son stock et rien de ce qu'il déclenche. Les liens (share_links), les
   ouvertures par lien (share_link_events 'clic') et les favoris (user_favorites) existaient déjà ; il
   manquait la VUE — l'ouverture de la fiche par n'importe quel chemin, y compris depuis le catalogue.
   Comme partout ici, c'est un FAIT par ligne : les compteurs se dérivent, on ne stocke aucun total.
   Anti-rebond côté produit (même fenêtre que le 'clic') : un aller-retour dans la liste n'est pas
   deux visites. Aucun identifiant de visiteur n'est conservé — on compte des ouvertures, pas des gens. */
CREATE TABLE product_views (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id  uuid NOT NULL REFERENCES mode_articles(id) ON DELETE CASCADE,
  source      text NOT NULL DEFAULT 'fiche' CHECK (source IN ('fiche','lien')),  -- catalogue, ou page d'un lien partagé
  at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_views_article_at ON product_views (article_id, at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6b · COCKPIT MARKETING (F9 — campagnes par API, concours, GED, agenda)
-- ─────────────────────────────────────────────────────────────────────────────
-- (10/09 — lot 8, constats D-42, D-43 et D-44) LE BINAIRE N'EST PLUS DANS LA TABLE. Une créa était lue en data URL et
-- rangée telle quelle dans le stockage local : deux dépôts saturaient le quota, et TOUTES les écritures de la maquette
-- échouaient ensuite en silence. Le fichier va au coffre (portée `ged`), la table n'en garde que la référence, sa
-- taille et son nom. Et la validation demande un SECOND regard : on ne valide pas la créa qu'on vient de déposer.
CREATE TABLE ged_assets (                                -- GED : une créa = une version validée
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref       text UNIQUE NOT NULL, name text NOT NULL,
  kind      text NOT NULL CHECK (kind IN ('print','video','doc','web')),
  version   text NOT NULL,
  file_url  text,                                         -- lien externe déclaré (exclusif du dépôt au coffre)
  vault_piece text,                                       -- pièce du coffre (portée `ged`, id = ref) quand un fichier a été déposé
  file_name text, file_size integer,                      -- ce que porte la pièce, sans son contenu
  status    text NOT NULL CHECK (status IN ('brouillon','valide','imprime','en_ligne','en_distribution')),
  legal_mentions boolean NOT NULL DEFAULT false,          -- (08/09) jeu gratuit, médiation, « collaboration commerciale » — exigé avant validation
  deposited_by text, deposited_at timestamptz NOT NULL DEFAULT now(),
  validated_by  text, validated_at timestamptz,           -- (10/09) jamais le déposant : séparation dépôt / validation
  CHECK (validated_by IS NULL OR validated_by <> deposited_by)
);

-- (10/09 — lot 8, constats D-31 et D-32) UNE CAMPAGNE PORTE SON MOIS ET SA RÉFÉRENCE CHEZ LA RÉGIE. Sans `month`, le
-- plafond mensuel comptait TOUTES les campagnes jamais créées : juillet consommait l'enveloppe de septembre. Sans
-- `api_ref` obligatoire sur les canaux payants, l'écran affirmait une intégration API que rien ne reliait à la régie.
CREATE TABLE ad_campaigns (                              -- lancées DANS le gestionnaire de la régie, suivies ici
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel      text NOT NULL CHECK (channel IN ('tiktok','meta','snap','geo')),
  api_ref      text,                                     -- id de campagne chez la régie (obligatoire hors canal gratuit — contrainte applicative)
  month        text NOT NULL,                            -- 'AAAA-MM' : le mois dont la campagne consomme le budget
  objective    text NOT NULL,
  creative     text REFERENCES ged_assets(ref),          -- réf GED de la créa (version validée uniquement)
  budget_cents integer NOT NULL DEFAULT 0,
  spent_cents  integer NOT NULL DEFAULT 0,               -- dernier relevé (miroir du plus récent ad_campaign_reads)
  impressions  integer, clicks integer NOT NULL DEFAULT 0, installs integer NOT NULL DEFAULT 0,
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','ended')),
  ends_on      date,
  created_by   text, created_at timestamptz NOT NULL DEFAULT now()
);

-- (10/09 — lot 8, constat D-33) LE RELEVÉ N'ÉCRASE PLUS LE PRÉCÉDENT. Un seul jeu de colonnes sur la campagne : la
-- dépense de juillet disparaissait au relevé d'août, donc ni courbe, ni CPI par période, ni contrôle de cohérence.
-- Les relevés s'empilent, et une dépense CUMULÉE ne redescend jamais (contrainte applicative).
CREATE TABLE ad_campaign_reads (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  uuid NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  spent_cents  integer NOT NULL CHECK (spent_cents >= 0),   -- CUMULÉ depuis le début de la campagne
  impressions  integer, clicks integer, installs integer,
  cpi_cents    integer,                                     -- dépense ÷ installs, null si aucun install relevé
  source       text NOT NULL CHECK (source IN ('api','console')),   -- rapatrié par API, ou relevé à la main dans la console de la régie
  read_at      timestamptz NOT NULL DEFAULT now(), read_by text
);

-- (10/09 — lot 8, constats D-39 et D-41) LE CODE SE CAPTURE ENFIN. Le lien portait `?code=`, aucune page ne le lisait :
-- `clicks` restait à zéro et l'attribution des participations était structurellement nulle. Le statut, lui, valait
-- 'brief envoyé' côté JS contre un DEFAULT 'brief' sans CHECK ici : l'enum est désormais fermé et partagé.
CREATE TABLE influencer_links (                          -- codes tracés — retombées incontestables
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL, network text NOT NULL CHECK (network IN ('tiktok','meta','snap','geo')), followers text,
  code          text UNIQUE NOT NULL,
  clicks        integer NOT NULL DEFAULT 0,              -- arrivées par le lien tracé (fly/03?code=…)
  last_click_at timestamptz,
  entries       integer NOT NULL DEFAULT 0,              -- participations concours attribuées
  status        text NOT NULL DEFAULT 'brief' CHECK (status IN ('brief','actif','termine'))
);

CREATE TABLE flyer_batches (                             -- lots terrain, un QR par lot
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_ref   text UNIQUE NOT NULL,
  kind        text NOT NULL, quantity integer NOT NULL, distributed integer NOT NULL DEFAULT 0,
  place       text, qr_ref text UNIQUE NOT NULL, scans integer NOT NULL DEFAULT 0,
  status      text NOT NULL DEFAULT 'imprime',
  -- (17/09 — pivot) le lot n'appartient plus à un POINT : il n'y a plus de comptoir partenaire pour le recevoir ni
  -- pour déclarer sa distribution. Un lot est attribué par le manager (attributed_at) au terrain qu'il couvre (place).
  requested_at timestamptz, attributed_at timestamptz     -- demande de lot (journal demande_lot_flyers) → attribution manager (lot_flyers_attribue)
);


-- (08/09 — audit commercial) LE LOT DU CONCOURS PUBLIÉ par le cockpit marketing (miroir PEC_DATA.concoursPublier) : un voyage
-- concret (photo GED validée, valeur, dates, inclus, date de tirage). La page client lit la dernière publication.
-- (10/09 — lot 8, constats D-36, D-37 et D-41) LA DATE DU TIRAGE EST UNE DATE, PAS UN LIBELLÉ. Elle était saisie en
-- texte libre (« 31 août ») pendant que le code comparait à un 31 août écrit en dur : le client voyait « tirage le
-- 30 septembre » et l'app se comportait comme si c'était passé. Le libellé en DÉRIVE, il ne se saisit plus à côté.
CREATE TABLE contest_prizes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_key     text NOT NULL,                            -- 'AAAA-MM', déduit de draw_at — plus deux champs pour la même chose
  month_label   text NOT NULL,
  title         text NOT NULL, destination text NOT NULL,
  value_cents   integer NOT NULL CHECK (value_cents > 0),
  dates_label   text NOT NULL, included text[] NOT NULL,
  photo_asset   text REFERENCES ged_assets(ref),
  draw_at       timestamptz NOT NULL,                     -- la date ANNONCÉE aux participants : avant elle, aucun tirage
  draw_label    text NOT NULL,                            -- dérivé de draw_at, pour l'affichage client
  entries_goal  integer CHECK (entries_goal IS NULL OR entries_goal > 0),
  published_by  text, published_at timestamptz NOT NULL DEFAULT now()
);

-- (10/09 — lot 8, constat D-37) LE TIRAGE EST UN GESTE, ET IL EST OPPOSABLE. Une gagnante (« Nadia R., Marseille 3e »)
-- était écrite dans le référentiel avant tout tirage, et aucune fonction ne tirait quoi que ce soit. Le tirage se fait
-- parmi les participations réelles, PONDÉRÉ par les tickets, à partir d'une graine TRACÉE : rejouable à l'identique par
-- un tiers, jamais « refaisable » jusqu'au bon nom. Le gagnant n'est publié qu'en initiale et ville (accord requis).
CREATE TABLE contest_draws (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prize_id      uuid NOT NULL UNIQUE REFERENCES contest_prizes(id),   -- un lot, un tirage : il ne se rejoue pas
  winner_ident  text NOT NULL,                            -- l'identité INTERNE du gagnant (jamais publiée)
  winner_public text NOT NULL,                            -- « Prénom N. » — ce que l'app affiche
  winner_city   text,
  entrants      integer NOT NULL CHECK (entrants > 0),
  tickets       integer NOT NULL CHECK (tickets > 0),
  seed          bigint NOT NULL, draw_index integer NOT NULL,          -- la graine et le rang tiré : le tirage se rejoue à l'identique
  drawn_at      timestamptz NOT NULL DEFAULT now(), drawn_by text NOT NULL
);

-- (10/09 — lot 8, constat D-39) LES PARTICIPATIONS SONT DES ENREGISTREMENTS, avec le code qui les a amenées : sans lui,
-- `influencer_links.entries` ne pouvait jamais être autre chose que zéro.
CREATE TABLE contest_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ident       text NOT NULL,                              -- le client (id ou téléphone complet)
  month_key   text NOT NULL,
  prize_title text,
  tickets     integer NOT NULL DEFAULT 1 CHECK (tickets > 0),
  code        text REFERENCES influencer_links(code),     -- le lien tracé d'où vient la participation, s'il y en a un
  entered_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ident, month_key)                               -- une participation par personne et par mois
);

-- (10/09 — lot 8, constat D-46) UNE ACTION EST RELIÉE À CE QU'ELLE CONCERNE. Sans `ref`, l'agenda n'était qu'une liste
-- de post-it : « bilan par canal le lendemain du tirage » ne pointait vers aucun concours, et rien ne le planifiait.
CREATE TABLE marketing_events (                          -- agenda : chaque jour a son action
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  on_day date NOT NULL, what text NOT NULL,
  kind   text NOT NULL CHECK (kind IN ('terrain','influenceur','pub','concours','pilotage')),
  ref    text,                                           -- « concours:<horodatage> », « CMP-n », un id de prospect… ce que l'action concerne
  done_at timestamptz, created_by text                   -- (08/09) planifiée depuis l'espace commercial, cochée faite
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7 · AUDIT & AVIS
-- ─────────────────────────────────────────────────────────────────────────────
-- (17/09 — pivot) `partner_settlements` et `partner_settlement_lines` sont SUPPRIMÉES avec le réseau de points : il
-- n'y a plus de grille de commission à verser, plus de participation mensuelle à solder, plus d'auto-facture AF-… de
-- commerçant. (18/09, soir) Ce que PayEnCash paie encore se règle ailleurs : les factures des fournisseurs Mode
-- (supplier_invoices) et les salaires du siège, qui passent par le grand livre (ledger_entries) — la paie des agents
-- de caisse mobile (payroll_transfers, payslips) a disparu avec eux.
CREATE TABLE hotel_reviews (                             -- AVIS : ceux de la centrale (LiteAPI /data/reviews) + les NÔTRES post-séjour
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nuitee_hotel_id text NOT NULL,                         -- rattaché à l'hôtel (pas à une offre)
  source          text NOT NULL CHECK (source IN ('nuitee','payencash')),
  order_id        uuid REFERENCES orders(id),            -- source 'payencash' : l'avis n'existe QUE si un séjour payé le prouve
  score           numeric(3,1) NOT NULL CHECK (score BETWEEN 0 AND 10),
  headline        text,
  pros            text,
  cons            text,
  author_name     text, author_country text,
  stayed_at       date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT avis_maison_verifie CHECK (source <> 'payencash' OR order_id IS NOT NULL)
);

CREATE TABLE transactional_messages (                    -- Brevo : SMS + email — CE QUE REÇOIT LE CLIENT
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid REFERENCES orders(id),
  channel      text NOT NULL CHECK (channel IN ('sms','email','push')),   -- LE journal SORTANT (07/09 : plus de notification_log en doublon)
  template     text NOT NULL,                            -- code_paiement · paiement_recu · billet_emis (PNR + lien enregistrement compagnie) · voucher_hotel (code confirmation) · rappel_expiration
  provider     text NOT NULL DEFAULT 'brevo',
  provider_ref text,                                     -- messageId Brevo
  payload      jsonb NOT NULL DEFAULT '{}',              -- variables injectées (pnr, eticket, lien…)
  sent_at      timestamptz NOT NULL DEFAULT now(),
  status       text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','delivered','bounced'))
);

CREATE TABLE audit_log (                                 -- piste d'audit continue (porte du client → dépôt)
  id          bigserial PRIMARY KEY,
  -- (18/09, soir) 'courier' RESTE ACCEPTÉ ici, et seulement ici : un journal ne se réécrit pas. Plus rien ne l'écrit
  -- (l'agent de caisse mobile est supprimé), mais les lignes déjà inscrites gardent leur acteur — c'est ce qui fait
  -- la valeur d'une piste d'audit. Même règle pour event_log.role ('coursier').
  actor_type  text NOT NULL CHECK (actor_type IN ('user','supplier','manager','system','partner','courier','merchant')),   -- (18/09) le partenaire vend et annule des Bons d’achat (bon_emis, bon_annule) · (21/09) 'merchant' : la marque de PayEnCash Solution relie son compte Stripe
  actor_id    uuid,
  action      text NOT NULL,
  entity      text NOT NULL, entity_id uuid,
  detail      jsonb,
  at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_log(entity, entity_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8 · TVA COLLECTÉE (vue de déclaration — Partie 1b §5)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE VIEW vat_collected_by_period AS
SELECT date_trunc('month', o.created_at) AS period,
       o.line,
       sum(o.vat_amount_cents) AS vat_cents
FROM orders o
WHERE o.status IN ('PAID','CONFIRMED','FULFILLED')
GROUP BY 1, 2;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12 · ASSISTANCE, RÉCLAMATIONS & TRAÇABILITÉ (24/08) — le flux support complet :
--      client (app) ↔ hôte (chat/rappel) ↔ manager (escalade 48 h) ↔ Médiateur
--      du Tourisme et du Voyage (saisine si 60 j sans accord). Chaque action est
--      journalisée dans event_log : UN espace de log PAR partie prenante.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE support_conversations (
  id            text PRIMARY KEY,                        -- 'CNV-4821'
  user_id       uuid NOT NULL REFERENCES users(id),
  order_ref     text,                                    -- lien réservation ('CMD-…' / 'PEC-…')
  sujet         text NOT NULL,
  canal         text NOT NULL DEFAULT 'chat' CHECK (canal IN ('chat','rappel','appel','whatsapp','email')),
  statut        text NOT NULL DEFAULT 'en_cours' CHECK (statut IN ('en_cours','resolue','transferee')),
  issue         text CHECK (issue IN ('satisfait','rembourse','repondu')),   -- (07/09) l'issue d'une clôture — le bus dit clot_satisfait / clot_rembourse / clot_repondu
  hote          text,                                    -- prénom de l'hôte en charge
  assigned_source text CHECK (assigned_source IN ('planning','reprise')),   -- (08/09)
  due_at        timestamptz,                             -- (08/09) échéance de première réponse (ouverture + hotline_settings.rappel_delai_min) ; EN RETARD = due_at < now() sans réponse de l'hôte — dérivé, jamais stocké
  last_host_reply_at timestamptz,                        -- (08/09) dernière réponse d'un hôte (support_messages.auteur = 'hote')
  /* (10/09 — lot 5, constats C1 et F7) D'OÙ VIENT LA DEMANDE, ET JUSQU'OÙ ELLE EST MONTÉE.
     `user_id` supposait un CLIENT : un fournisseur dont le virement
     tarde n'avaient aucune porte, et la hotline aurait vu « un client » qui n'en est pas un. `scope` range la
     demande du bon côté — c'est lui aussi qui ramène la réponse dans le fil du bon espace.
     Le NIVEAU d'escalade, lui, ne se stocke pas : il se dérive du silence (hotline_settings.escalade) — hôte,
     puis supervision, puis manager, puis le droit du client de saisir le médiateur (art. L612-2 c. conso.). */
  scope         text NOT NULL DEFAULT 'client' CHECK (scope IN ('client','fournisseur','partenaire','commercial')),   -- (18/09, soir) 'agent' retiré ; 'partenaire' revient (le commerce qui vend le Bon d’achat écrit au support)
  subject_ref   text,                                    -- l'acteur concerné quand scope ≠ client : suppliers.id · partners.id · accounts.id
  opened_at     timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz
);

CREATE TABLE support_messages (
  id               bigserial PRIMARY KEY,
  conversation_id  text NOT NULL REFERENCES support_conversations(id),
  auteur           text NOT NULL CHECK (auteur IN ('client','hote','systeme')),
  corps            text NOT NULL,
  sent_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reclamations (
  id            text PRIMARY KEY,                        -- 'REC-2107'
  user_id       uuid NOT NULL REFERENCES users(id),
  order_ref     text NOT NULL,
  motif         text NOT NULL,
  statut        text NOT NULL DEFAULT 'niveau_hote'
                CHECK (statut IN ('niveau_hote','niveau_manager','resolue','geste_commercial','mediateur')),
  opened_at     timestamptz NOT NULL DEFAULT now(),
  escalated_at  timestamptz,                             -- passage au manager (auto si SLA hôte 2 h dépassé)
  closed_at     timestamptz,
  resolution    text                                     -- remboursement / geste / réponse motivée (+ MTV joint)
);

CREATE TABLE event_log (                                 -- LE protocole de traçabilité
  id         bigserial PRIMARY KEY,
  acteur     text NOT NULL,                              -- qui (prénom, 'client', 'systeme')
  role       text NOT NULL CHECK (role IN ('client','hote','manager','commercial','marketing','fournisseur','partenaire','coursier','systeme')),   -- (18/09) 'partenaire' revient (il vend des Bons d’achat) ; (18/09, soir) 'coursier' n'est plus JAMAIS écrit — il reste accepté pour les lignes déjà inscrites : un journal ne se réécrit pas
  espace     text NOT NULL,                              -- l'app d'origine ('app client','espace manager',…)
  action     text NOT NULL,
  ref        text,                                       -- CNV-/REC-/CMD-/PEC-…
  at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_log_par_role ON event_log (role, at DESC);
CREATE INDEX event_log_par_ref  ON event_log (ref);

-- HOTLINE (24/08) — l'équipe support déléguée : le superviseur assigne, l'hôte traite,
-- seules les réclamations montent au manager. Satisfaction : note ≤ 3 ⇒ réclamation AUTO.
CREATE TABLE hotline_calls (                             -- (07/09) UNE table d'appels : l'ancienne table dédiée à l'appel de sécurisation est fondue ici (type 'securisation')
  id           text PRIMARY KEY,                          -- 'APL-9012'
  type         text NOT NULL CHECK (type IN ('entrant','rappel','securisation','bienvenue','retour_j1')),
  user_id      uuid REFERENCES users(id),
  order_id     uuid REFERENCES orders(id),                -- sécurisation : la commande qui attend l'appel
  order_ref    text,
  -- (17/09 — pivot) « sans réponse » ×2 renvoyait la commande « au point » : il n'y en a plus. La commande RESTE
  -- à régler dans sa fenêtre — le client peut présenter son bon d’achat sans que personne ne le rappelle —
  -- et elle expire d'office à la fin de la fenêtre si rien n'est encaissé.
  status       text NOT NULL DEFAULT 'a_faire' CHECK (status IN ('a_faire','fait','sans_reponse','rappeler')),   -- = PEC_BUS.STATUT_SQL.appel
  done_by      text,                                      -- (08/09) l'hôte qui a passé l'appel (manager_users.identifiant / prénom du planning) — signé, plus « hotline »
  attempts     smallint NOT NULL DEFAULT 0,               -- (08/09) tentatives (sans réponse → l'appel reste en file)
  assigned_source text CHECK (assigned_source IN ('planning','reprise')),   -- (08/09) planning (hôte en poste le moins chargé) ou reprise/réassignation
  video_consent boolean,                                  -- visio proposée pendant l'appel : NULL = pas proposée ; jamais sans accord
  notes        text,                                      -- script : confirmer la demande + présenter PayEnCash + comment suivre
  canal        text NOT NULL CHECK (canal IN ('0805','rappel','appel','whatsapp','facetime')),
  priorite     text NOT NULL DEFAULT 'normale' CHECK (priorite IN ('haute','normale')),
  assigne_a    text,                                      -- hôte en charge (une seule voix par client)
  due_at       timestamptz,                               -- échéance de rappel (l'appel de sécurisation d'une grosse commande)
  done_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hotline_calls_file ON hotline_calls (done_at, priorite, due_at);

CREATE TABLE satisfaction_responses (
  id           bigserial PRIMARY KEY,
  order_ref    text NOT NULL,
  call_id      text REFERENCES hotline_calls(id),
  note         integer NOT NULL CHECK (note BETWEEN 1 AND 5),
  verbatim     text,
  reclamation_id text REFERENCES reclamations(id),        -- posée AUTOMATIQUEMENT si note <= 3
  answered_at  timestamptz NOT NULL DEFAULT now()
);

-- (11/09 — lot 9) LA NOTE LAISSÉE AU BOUT D'UNE COMMANDE. `notationEnregistrer` (ecrans/03) écrit un enregistrement que rien
-- ne recevait en base : `satisfaction_responses` répond à un APPEL ou à une demande close, jamais à la commande elle-même.
-- Une note par commande, entre 1 et 5, et la cible. (18/09, soir) la cible 'agent' disparaît avec l'agent ; restent le
-- paiement EN LIGNE (la page du prestataire, le délai, la clarté) et le BON D’ACHAT (l'achat au comptoir du commerçant).
CREATE TABLE order_ratings (
  id          bigserial PRIMARY KEY,
  order_ref   text NOT NULL UNIQUE,                       -- une note par commande — la seconde remplace la première
  rating      integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  target      text NOT NULL CHECK (target IN ('en_ligne','bon')),
  user_id     uuid REFERENCES users(id),
  rated_by    text,
  rated_at    timestamptz NOT NULL DEFAULT now()
);

-- (08/09 — audit hotline) LE QUESTIONNAIRE EST ENVOYÉ : à chaque appel passé et à chaque demande close, un SMS de notation part
-- (canal Brevo) ; la réponse du client (satisfaction_responses) solde la demande. Miroir de PEC_DATA.satisfactionDemander.
CREATE TABLE satisfaction_requests (
  id              text PRIMARY KEY,                        -- 'SATQ-12'
  call_id         text REFERENCES hotline_calls(id),
  conversation_id text REFERENCES support_conversations(id),
  order_ref       text,
  user_id         uuid REFERENCES users(id),
  phone           text,
  channel         text NOT NULL DEFAULT 'sms',             -- Brevo (SMS)
  sent_at         timestamptz NOT NULL DEFAULT now(),
  sent_by         text,                                    -- l'hôte dont le geste a déclenché l'envoi
  answered_at     timestamptz,
  response_id     bigint REFERENCES satisfaction_responses(id),
  CONSTRAINT satisfaction_requests_cible CHECK (call_id IS NOT NULL OR conversation_id IS NOT NULL)
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 13 · EXPLOITATION INTERNE (07/09) — les tables que les écrans invoquaient
--      SANS qu'elles existent. Chaque table ci-dessous est adossée à un écran
--      qui tourne et à une structure réelle du data-layer : rien d'inventé.
--      (Objectif « zéro trou » — audit du 07/09.)
-- ─────────────────────────────────────────────────────────────────────────────

-- COMPTES MANAGER (manager/01 connexion · 17 comptes · 40 validation des comptes).
-- Désactivation, jamais suppression : le compte est référencé par les journaux.
CREATE TABLE manager_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifiant   text UNIQUE NOT NULL,                     -- 'emilie.r' — la clé NATURELLE : les apps parlent par
                                                          -- identifiant, le service résout l'id pour les created_by/updated_by
  full_name     text NOT NULL,
  password_hash text NOT NULL,                            -- jamais le mot de passe en clair
  role          text NOT NULL CHECK (role IN ('direction','superviseur','operateur','hotline','commercial')),   -- = PEC_DATA.ROLES_MANAGER, une seule liste (MU·418) ; (10/09 — lot 4) + commercial, invitable comme la hotline
  active        boolean NOT NULL DEFAULT true,            -- suspension = false (on ne supprime pas)
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- (08/09) LE PLANNING DE LA HOTLINE : « en poste » se CALCULE (jour ISO + heure dans le créneau), il n'est jamais écrit.
-- Miroir de PEC_DATA.assistance.hotline.planning / hotlinePlanning().
CREATE TABLE hotline_shifts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES manager_users(id), -- rôle 'hotline' ou 'superviseur'
  weekday     smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  starts_at   time NOT NULL, ends_at time NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, weekday),
  CONSTRAINT hotline_shifts_ordre CHECK (ends_at > starts_at)
);

-- GRAND LIVRE (manager/21 compte de résultat) : une écriture = un montant, un sens,
-- une classe comptable et une catégorie. Append-only, comme stock_ledger.
CREATE TABLE ledger_entries (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entry_date    date NOT NULL,
  direction     text NOT NULL CHECK (direction IN ('debit','credit')),
  account_class text NOT NULL,                            -- classe PCG ('6','7'…)
  category      text NOT NULL,                            -- 'salaires' · 'carburant' · 'ventes_mode'…
  amount_cents  integer NOT NULL CHECK (amount_cents > 0),
  order_ref     text,                                     -- rattachement facultatif à une commande
  label         text NOT NULL,
  created_by    uuid REFERENCES manager_users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ledger_entries_periode ON ledger_entries (entry_date, account_class);

-- (18/09, soir) LE SERVICE, LE PLANNING, LE DOSSIER, LES FRAIS ET LA PAIE DE L'AGENT sont SUPPRIMÉS :
-- `service_sessions`, `shift_checklists`, `courier_unavailability`, `courier_availability`, `shifts`,
-- `demand_forecast`, `courier_documents`, `courier_expenses`, `payroll_transfers`, `final_settlements`, `payslips`.
-- Aucune de ces tables ne servait à autre chose qu'à l'agent de caisse mobile. Les pièces des AUTRES acteurs
-- (fournisseur, client, point partenaire) vivent dans `kyc_documents`, juste en dessous — elles n'ont jamais partagé
-- cette table. Le grand livre (`ledger_entries`) reste : il porte le compte de résultat de toute l'entreprise.

-- (08/09 — audit partenaire ; 17/09 — pivot ; 18/09, soir) LE COFFRE : le coffre PEC_DOCS (pec-doc:<portée>:<id>:<pièce>)
-- conserve les pièces du fournisseur (9 pièces KYB, contrat), du client et du POINT PARTENAIRE. C'est désormais la
-- SEULE table de pièces du schéma — `courier_documents` est partie avec l'agent. Une pièce GÉNÉRÉE (contrat) porte sa
-- signature ; le KYB se DÉRIVE de cette table (toutes les pièces obligatoires « validee », les générées signées) —
-- jamais d'une colonne écrite.
CREATE TABLE kyc_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope         text NOT NULL CHECK (scope IN ('fournisseur','client','partenaire')),   -- (17/09 — pivot) 'partenaire' retirée ; (18/09) elle REVIENT : le dossier du point qui vend le Bon d’achat (kbis · cni · video · contrat de distribution signé) — le KYB du point s'en DÉRIVE
  subject_id    text NOT NULL,                            -- suppliers.id · users.id · partners.id selon scope
  kind          text NOT NULL,                            -- 'kbis' · 'cni' · 'rib' · 'video' · 'contrat' · …  (PEC_DOCS.PIECES)
  file_url      text,                                     -- vide pour une pièce générée non encore signée
  status        text NOT NULL DEFAULT 'deposee' CHECK (status IN ('a_signer','deposee','validee','refusee')),
  refusal_note  text,                                     -- motif obligatoire si refusee
  expires_on    date,                                     -- Kbis < 3 mois, assurance…
  generated     boolean NOT NULL DEFAULT false,           -- contrat produit par PayEnCash
  signed_by     text, signed_at timestamptz, fingerprint text,   -- signature en ligne (PEC_DOCS.signer : empreinte du texte signé)
  deposited_by  text NOT NULL,
  reviewed_by   text REFERENCES manager_users(identifiant),
  uploaded_at   timestamptz NOT NULL DEFAULT now(),
  reviewed_at   timestamptz,
  UNIQUE (scope, subject_id, kind)
);
CREATE INDEX kyc_documents_subject ON kyc_documents (scope, subject_id);

-- (18/09, soir) `courier_positions` (le suivi en direct de l'agent), `fleet_vehicles` (sa flotte) et
-- `insurance_policies` (les polices des véhicules) sont SUPPRIMÉES : sans agent qui se déplace, il n'y a ni position
-- à suivre, ni scooter à assurer. C'est aussi une donnée personnelle de géolocalisation en moins à conserver (RGPD).

-- PIPELINE COMMERCIAL (app commercial) : l'atelier démarché, son étape.
CREATE TABLE sales_leads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,                            -- 'Atelier Rose'
  address       text,
  -- (11/09 — lot 9 · révisé 17/09 au pivot · 18/09) LA NATURE DU PROSPECT. Le pipeline en porte DEUX (TYPES_PROSPECT) :
  -- le COMMERCE PARTENAIRE qui signera le contrat de distribution du Bon d’achat PayEnCash (repere → visite → pitche → signature
  -- → signe → ouvert), et l'atelier recruté pour MODE (repere → visite → pitche → invite → inscrit → signe → ouvert).
  -- L'entonnoir « point » avait disparu le 17/09 avec le réseau d'encaissement ; il REVIENT avec le Bon d’achat — sans mandat,
  -- sans borne : un contrat de distribution, un ticket imprimé.
  lead_type     text NOT NULL DEFAULT 'fournisseur' CHECK (lead_type IN ('point','fournisseur')),
  stage         text NOT NULL DEFAULT 'repere'
                CHECK (stage IN ('repere','visite','pitche','signature','invite','inscrit','signe','ouvert','perdu')),   -- point : … signature (contrat envoyé — à signer) → signe → ouvert (point actif) ; fournisseur : candidature → KYB → catalogue
  contact       text,
  phone         text,
  email         text,
  siret         text,                                     -- (08/09) repris sur la fiche du fournisseur à son inscription
  city          text,                                     -- (11/09) saisie ou déduite de l'adresse — le pipeline se lit par ville
  lost_reason   text,
  lost_at       timestamptz,                -- (11/09) un prospect perdu porte SA date : « perdu » sans quand n'est pas un fait
  -- `next_action` a été RETIRÉE (11/09 — lot 9) : elle est DÉRIVÉE de l'étape (`prospectAction`). Stockée en base, elle
  -- devenait une seconde vérité qui se désynchronisait de l'étape dès le premier geste.
  supplier_id   uuid,                                     -- rempli quand le lead devient un FOURNISSEUR (FK en fin de fichier)
  partner_id    uuid REFERENCES partners(id),             -- (18/09) rempli quand le lead devient un POINT (contratPartenaireSigner : prospect.pointId) — partners est définie en section 1
  invited_at    timestamptz,
  invited_by    text,             -- (lot 8) l'invitation envoyée à l'atelier : c'est elle qui crée son accès
  created_by    text,                                     -- qui a repéré cet atelier
  -- (10/09 — lot 4) le propriétaire d'un lead est un COMPTE : le commercial vit dans `accounts` (espace 'commercial'),
  -- pas dans manager_users — il ne pouvait donc pas être propriétaire de son propre pipeline en base.
  owner         text,                                     -- (10/09) accounts.id, espace 'commercial' : la table accounts est definie plus loin, pas de FK ici   -- (13/09) accounts.id est du TEXTE : `uuid` empêchait la clé étrangère de se créer
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- (17/09 — pivot) `signature_links` et `partner_onboarding_steps` avaient été supprimées avec le mandat. (18/09) LE LIEN
-- DE SIGNATURE REVIENT avec le contrat de distribution du Bon d’achat PayEnCash : le commercial envoie au gérant un lien
-- JETONNÉ (signatureLienEnvoyer : 'SG-…', valable ref.invitations.validiteH) ; le gérant a les documents sous les yeux
-- (commercial/09), prouve qui il est par un code à usage unique (SMS si un numéro est connu, sinon e-mail — art. 1367
-- c. civ. : le procédé identifie le signataire et garantit le lien à l'acte) et signe : le lien est CONSOMMÉ (une seule
-- signature), le contrat va au coffre (kyc_documents 'partenaire', pièce `contrat`), le point naît « contrat signé »
-- (partners.contract_signed_at, signature_proof). `partner_onboarding_steps` (kit, formation, borne) ne revient PAS :
-- il n'y a plus rien à installer chez le commerçant. Miroir de prospect.signature {jeton, expireAt, consommeAt,
-- documents, otp {canal, at, expireAt, verifieAt}}. Le fournisseur, lui, signe son contrat-cadre dans SON espace.
CREATE TABLE signature_links (
  token          text PRIMARY KEY,                        -- 'SG-A3F19K2C'
  lead_id        uuid NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  sent_at        timestamptz NOT NULL DEFAULT now(),
  sent_by        text,                                    -- le commercial (accounts.id, espace 'commercial')
  expires_at     timestamptz NOT NULL,                    -- sent_at + ref.invitations.validiteH
  consumed_at    timestamptz,                             -- UNE seule signature par lien
  documents      text[] NOT NULL DEFAULT '{}',            -- ce que le gérant a sous les yeux au moment de signer (contrat + ref.documents.partenaire)
  otp_channel    text CHECK (otp_channel IN ('sms','email')),   -- le canal du code qui vaut signature
  otp_sent_at    timestamptz,
  otp_expires_at timestamptz,                             -- otp_sent_at + ref.otp.validiteMin
  otp_verified_at timestamptz,
  otp_attempts   smallint NOT NULL DEFAULT 0
);
CREATE INDEX signature_links_lead ON signature_links (lead_id, sent_at DESC);

-- RAPPELS COMMERCIAUX (manager/23) — distinct de hotline_calls (support client) :
-- ici c'est du démarchage, d'où l'opposition Bloctel qui doit être vérifiable.
CREATE TABLE commercial_callbacks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       uuid REFERENCES sales_leads(id) ON DELETE CASCADE,
  phone         text NOT NULL,
  due_at        timestamptz NOT NULL,
  done_at       timestamptz,
  outcome       text CHECK (outcome IN ('rappeler','interesse','refus','injoignable')),
  bloctel_checked_at timestamptz,                         -- opposition au démarchage vérifiée
  assigned_to   text                                      -- (10/09) accounts.id, espace 'commercial' : definie plus loin, pas de FK ici   -- (13/09) accounts.id est du TEXTE : `uuid` empêchait la clé étrangère de se créer
);
CREATE INDEX commercial_callbacks_file ON commercial_callbacks (done_at, due_at);

-- COMMANDES ABANDONNÉES (manager/23) : le panier lancé puis non réglé dans la fenêtre.
CREATE TABLE abandoned_orders (
  order_id      uuid PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  abandoned_at  timestamptz NOT NULL DEFAULT now(),
  reason        text NOT NULL DEFAULT 'fenetre_expiree'
                CHECK (reason IN ('fenetre_expiree','annulee_client')),   -- (18/09, soir) 'agent_indisponible' retiré : plus d'agent à attendre
  contacted_at  timestamptz,                              -- relance commerciale (jamais automatique)
  recovered_order_id uuid REFERENCES orders(id)           -- la commande qui l'a remplacée
);

-- (18/09, soir) `delivery_fee_config` — le tarif de déplacement, la majoration de nuit, le rayon de dispatch et le
-- seuil de dépôt — est SUPPRIMÉE : aucun de ces quatre réglages ne décrit autre chose que l'agent qui se déplaçait.
-- Les réglages qui restent vivants (bons d’achat.*, lcbft.*, fenêtre d'encaissement…) vivent dans `settings`.

-- NOTIFICATIONS IN-APP (manager/16) : ce que l'utilisateur VOIT et peut lire.
-- Volontairement séparé de transactional_messages (le SORTANT : SMS/e-mail/push
-- expédiés) : fusionner obligerait à inventer un état « lu » pour un e-mail.
CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience    text NOT NULL CHECK (audience IN ('client','supplier','manager','partner')),   -- (18/09, soir) 'courier' retiré avec l'agent ; 'partner' revient (carte à renouveler, bon d’achat annulé)
  subject_id  uuid,                                       -- le destinataire dans SON référentiel ;
                                                          -- NULL = DIFFUSION D'ÉQUIPE (manager/20) : un écart
                                                          -- ne s'adresse à personne en particulier
  title       text NOT NULL,
  body        text NOT NULL,
  ref         text,                                       -- commande / réclamation liée
  read_at     timestamptz,                                -- NULL = non lue (le compteur en dérive)
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_non_lues ON notifications (audience, subject_id, read_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 14 · IDENTITÉ, PRÉFÉRENCES & JOURNAUX TRANSVERSES (07/09 — « zéro trou sur
--      toutes les apps ») : le data-layer se disait « miroir » de tables qui
--      n'existaient pas (comptes, addresses, kiosks) et persistait treize
--      référentiels sans table. Chaque table ci-dessous est calquée sur la
--      structure RÉELLE de PEC_DATA / PEC_BUS — rien d'inventé.
-- ─────────────────────────────────────────────────────────────────────────────

-- LE PROTOCOLE DE COMPTES (03/09) — un compte par espace, six espaces. C'est LA
-- table d'identité transverse ; users / partners / suppliers /
-- manager_users portent le MÉTIER, accounts porte l'ACCÈS (ref_id fait le lien).
-- Miroir de PEC_DATA.comptesTous() ; le journal du compte vit dans audit_log.
CREATE TABLE accounts (
  id              text PRIMARY KEY,                       -- 'cpt-client-012' (protocole) · 'demo-…' (seed)
  espace          text NOT NULL CHECK (espace IN ('client','fournisseur','manager','hotline','commercial','partenaire','tech_marchand','tech_revendeur')),   -- (18/09) le commerce qui vend le Bon d’achat PayEnCash (ESPACES_COMPTE.partenaire : e-mail confirmé, KYB validé) ; (18/09, soir) 'agent' retiré — l'espace agent n'existe plus
  identifiant     text NOT NULL,                          -- téléphone (client) · e-mail · 'emilie.r'
  password_hash   text,                                   -- NULL tant que l'invité n'a pas créé son mot de passe
  statut          text NOT NULL DEFAULT 'a_verifier'
                  CHECK (statut IN ('a_verifier','a_valider','invite','actif','suspendu','refuse','clos','supprime')),   -- = STATUTS_COMPTE (09/09 : + clos = fin de contrat)
  verif_sms_at    timestamptz, verif_email_at timestamptz,          -- les vérifs du protocole
  verif_kyb_at    timestamptz, verif_kyc_at   timestamptz,
  verif_docs_at   timestamptz, verif_habilitation_at timestamptz,
  rib_iban        text, rib_bic text, rib_holder text, rib_at timestamptz,   -- (08/09) RIB du client pour le rendu de monnaie par virement (chiffré au repos en prod)
  ref_id          text,                                   -- la ligne métier : users.id · suppliers.id · manager_users.id · partners.id (18/09)
  invite_par      text REFERENCES manager_users(identifiant),
  invite_expire_at timestamptz,
  motif_refus     text,
  -- le RECRUTEMENT d'un partenaire ou d'un fournisseur : session planifiée par le manager, recandidature après refus, clôture
  session_at      timestamptz, session_planned_by text,   -- compteSessionPlanifier (lue par le candidat à la connexion)
  reapplied_at    timestamptz,                            -- compte_recandidature (même identifiant, nouveau dossier)
  closed_at       timestamptz, close_reason text,         -- compteCloturer
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (espace, identifiant)                            -- compteParIdentifiant : unique PAR espace
);

-- (18/09, soir) `change_transfers` — le RENDU DE MONNAIE par virement — est SUPPRIMÉE : il n'existait que parce
-- qu'un agent recevait des espèces et ne pouvait pas toujours rendre la différence (billet de 500 €, LCB-FT).
-- Un paiement en ligne est au centime, un Bon d’achat PayEnCash se règle au comptoir chez le commerçant, qui rend la monnaie
-- pour son propre compte : plus aucune monnaie à rendre de notre part. `refund_transfers` (rembourser un CLIENT par
-- virement) reste : c'est un autre geste, et il est toujours nécessaire.

-- (09/09 — lot 2 l'argent) REMBOURSEMENT PAR VIREMENT (PEC_BUS.rembourser mode 'virement' → remboursementVirementEmettre) :
-- une créance par remboursement (partiel possible), émise par le manager, refusée sans IBAN.
CREATE TABLE refund_transfers (
  id            text PRIMARY KEY,                         -- 'RMB-31'
  order_id      uuid NOT NULL REFERENCES orders(id),
  account_id    text REFERENCES accounts(id),
  order_item_id uuid REFERENCES order_items(id),          -- remboursement d'UNE ligne (retour Mode) — NULL = toute la commande
  amount_cents  integer NOT NULL CHECK (amount_cents > 0),
  iban_masked   text,
  status        text NOT NULL DEFAULT 'a_virer' CHECK (status IN ('a_virer','vire')),
  reason        text,
  due_at        timestamptz NOT NULL,                     -- décidé + lcbft.virementHeures
  decided_by    text, decided_at timestamptz NOT NULL DEFAULT now(),
  sent_at       timestamptz, sent_by text
);

-- (09/09 — lot 2 l'argent) L'AVOIR : livre de crédits par compte client (PEC_DATA.avoirCrediter / avoirSolde / avoirConsommer).
-- Émis par un remboursement en avoir ou un rendu de monnaie LCB-FT (billet de 500 €) ; consommé au panier Mode et au récap Fly.
CREATE TABLE customer_credits (
  id            text PRIMARY KEY,                         -- 'AV-1001'
  account_id    text NOT NULL REFERENCES accounts(id),
  amount_cents  integer NOT NULL CHECK (amount_cents > 0),
  balance_cents integer NOT NULL CHECK (balance_cents >= 0),
  order_ref     text,                                     -- la commande à l'origine (remboursement, rendu)
  reason        text,
  issued_by     text,
  issued_at     timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL                      -- issued_at + lcbft.avoirValiditeMois
);
CREATE INDEX customer_credits_actifs ON customer_credits (account_id, expires_at) WHERE balance_cents > 0;
CREATE TABLE customer_credit_movements (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  credit_id     text NOT NULL REFERENCES customer_credits(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('credit','debit')),
  amount_cents  integer NOT NULL CHECK (amount_cents > 0),
  order_ref     text,                                     -- la commande qui consomme (debit)
  at            timestamptz NOT NULL DEFAULT now()
);
-- (revue lot 2) CHAQUE GESTE DE REMBOURSEMENT (PEC_BUS.rembourser → commande.remboursements[]) : avoir crédité, avoir en attente de compte,
-- ou virement (→ refund_transfers) — partiel par ligne ; le statut REFUNDED de la commande se dérive des gestes effectifs.
CREATE TABLE order_refunds (
  id            text PRIMARY KEY,                         -- 'RMB-31'
  order_id      uuid NOT NULL REFERENCES orders(id),
  order_item_id uuid REFERENCES order_items(id),          -- une ligne (retour Mode) — NULL = toute la commande
  method        refund_method NOT NULL,                   -- avoir | virement | bon d’achat (18/09 : re-crédit du Bon d’achat PayEnCash qui a réglé)
  amount_cents  integer NOT NULL CHECK (amount_cents > 0),
  credit_id     text REFERENCES customer_credits(id),     -- l'avoir crédité (method = avoir)
  credit_pending boolean NOT NULL DEFAULT false,          -- avoir décidé sans compte client : à rattacher (avoirRattacher)
  transfer_id   text REFERENCES refund_transfers(id),     -- la créance de virement (method = virement)
  gift_card_movement_id bigint REFERENCES gift_card_movements(id),   -- (18/09) le RE-CRÉDIT du bon d’achat (method = bon d’achat) — ≤ Σ débits de cette commande, jamais en espèces
  reason        text,
  decided_by    text NOT NULL,
  decided_at    timestamptz NOT NULL DEFAULT now(),
  attached_by   text, attached_at timestamptz             -- rattachement de l'avoir à un compte
);


-- IDENTITÉS SSO liées à un compte (mode/08 · ecrans/10 : lier, délier, se connecter).
CREATE TABLE sso_identities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider    text NOT NULL,                              -- ssoFournisseur().id
  email       text NOT NULL,
  linked_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, email)                                -- ssoCle(fournisseur, email) → UN compte
);

-- CODES DE VÉRIFICATION (PEC_VERIF — SMS + e-mail, obligatoires avant la 1ʳᵉ commande).
-- Le code n'est jamais stocké en clair ; le succès se reporte sur accounts.verif_*_at
-- et users.phone_verified_at / email_verified_at.
CREATE TABLE verification_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  channel     text NOT NULL CHECK (channel IN ('sms','email')),
  code_hash   text NOT NULL,
  expires_at  timestamptz NOT NULL,
  attempts    smallint NOT NULL DEFAULT 0,
  verified_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX verification_codes_actifs ON verification_codes (account_id, channel, verified_at);

-- JOURNAL DES CONNEXIONS (connexionNoter — succès ET échecs, appareil, motif).
-- Distinct d'audit_log (piste métier) : c'est un journal de SÉCURITÉ à rétention propre
-- (ref.securite.journalConnexionsMax).
CREATE TABLE login_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  espace      text NOT NULL,
  identifiant text NOT NULL,
  account_id  text REFERENCES accounts(id),
  ok          boolean NOT NULL,
  motif       text,                                       -- 'Mot de passe incorrect' · 'Compte suspendu'…
  device      text,                                       -- navigator.platform
  at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_events_par_compte ON login_events (account_id, at DESC);

-- CONSENTEMENTS RGPD (consentir / retirerConsentement) — versionnés par les CGV.
CREATE TABLE consents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES users(id) ON DELETE CASCADE, -- NULL pour un acteur pro (fournisseur, commercial) : voir subject_ref
  scope        text NOT NULL DEFAULT 'client',            -- 'client' · 'fournisseur' · 'partenaire' (18/09 : cgu-partenaire et conditions-bon, posées sous l'identifiant du compte du point ; 18/09 au soir — 'agent' retiré)
  subject_ref  text,                                      -- identifiant du compte pro (e-mail / login) quand user_id est NULL
  document     text,                                      -- clé du document accepté : 'cgu-fournisseur' · 'confidentialite-fournisseur' · 'charte-terminologie'…
  type         text NOT NULL,                             -- 'communications' · 'geolocalisation' · 'cgv' · 'acceptation'…
  texte        text NOT NULL,                             -- ce que le client a lu
  cgv_version  text NOT NULL,                             -- version du document au moment du oui
  granted_at   timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz                                -- NULL = actif (consentementActif)
);
CREATE INDEX consents_actifs ON consents (user_id, type, withdrawn_at);

-- ADRESSES du client (adresses / adresseEnregistrer) : domicile, travail, autre — UNE par défaut ; la géoposition
-- seulement si consentie. Elles servent à la facture, au choix du point relais Mondial Relay le plus proche et aux
-- champs d'expédition qu'exige le prestataire en ligne. (19/09, nuit — « remets le domicile avec carnet d'adresses »)
-- ET DE NOUVEAU À FAIRE VENIR QUELQU'UN : le distributeur MOBILE se déplace chez le client qui le demande, et les
-- champs d'aide (étage, porte / interphone, instructions) sont là pour qu'il trouve la porte sans téléphoner.
-- (20/09) Toute rencontre a désormais une adresse — voir distributor_meetings.address_id et ses colonnes addr_*,
-- où celle qui est convenue est RECOPIÉE.
CREATE TABLE addresses (
  id            text PRIMARY KEY,                         -- 'ADR-3'
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          text NOT NULL CHECK (type IN ('domicile','travail','autre')),
  label         text,
  line1         text NOT NULL, line2 text,
  postcode      text NOT NULL, city text NOT NULL,
  floor         text, door_intercom text,                  -- étage · porte / interphone
  instructions  text,                                     -- « comme un VTC »
  lat           numeric(9,6), lng numeric(9,6),           -- navigator.geolocation, si le client l'a voulu
  is_default    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX addresses_une_par_defaut ON addresses (user_id) WHERE is_default;   -- toujours UNE par défaut

-- (18/09, soir) `kiosks` est SUPPRIMÉE. Elle avait déjà perdu les bornes payEnCash au pivot du 17/09 ; il ne lui
-- restait que les AUTOMATES BANCAIRES Cash Services, où l'agent et le manager déposaient les espèces collectées.
-- Sans collecte, il n'y a plus de dépôt, donc plus d'automate à tenir dans le référentiel.

/* ════════════════════════════════════════════════════════════════════════════════════════════════
   PAYENCASH SOLUTION — L'API DE MISE EN RELATION POUR RÉSEAUX LIMITÉS (19/09, nuit)
   ═══════════════════════════════════════════════════════════════════════════════════════════════
   Seconde ligne, distincte de Mode et Fly : on vend la TECHNOLOGIE à des sites e-commerce qui veulent leurs
   propres bons d'achat, utilisables uniquement chez eux (« réseau limité », art. L521-3 I 1° CMF).
   Miroir de PEC_DATA : techMarchand* → tech_merchants · techRevendeur* → tech_resellers · techConformite* →
   tech_compliance_declarations · techMandat* → tech_mandates · techMatch* → tech_matches · techContrat* →
   tech_distribution_contracts · techCommission* → tech_commission_events · techRedevance* → tech_storage_fees ·
   techFacture* → tech_invoices · techCle* → tech_api_keys · techBon* → tech_vouchers.

   CE QUE CE MODÈLE INTERDIT, PAR CONSTRUCTION (§9 du cahier des charges) :
     · aucune table de solde, de wallet, d'IBAN de reversement ou de flux entre revendeur, client et commerçant
       — la plateforme n'encaisse ni ne détient aucun fonds, et il n'existe nulle part où en écrire ;
     · un bon porte TOUJOURS son commerçant émetteur (tech_vouchers.merchant_id NOT NULL) : la plateforme
       n'en est jamais propriétaire, et aucun bon n'est « du réseau » ;
     · le prix d'achat et le prix de revente du revendeur ne sont PAS stockés : sa marge lui appartient (§5.1).
   CE QU'ON RÉUTILISE : `accounts` (deux espaces de plus), `kyc_documents` (leurs pièces), `settings` (les taux,
   jamais en dur) et `audit_log` (UC-14). ⚠ Qualification à valider par un avocat avant production. ═══ */

-- UC-1 — le REVENDEUR de bons d'achat : il achète au commerçant et revend au client final, pour son compte.
CREATE TABLE tech_resellers (
  id            text PRIMARY KEY,                        -- 'RVD-00001'
  company_name  text NOT NULL,
  siret         text NOT NULL UNIQUE,                    -- contrôlé (14 chiffres + clé de Luhn) avant création
  contact_email text NOT NULL,
  contact_phone text,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','validated','suspended')),
  /* LE MODE D'EXERCICE, repris de nos propres distributeurs (partners.mode) : sédentaire (une boutique, une
     adresse — le client s'y rend) ou mobile (il se déplace). C'est lui qui donne au client final les trois
     chemins de la page d'un bon proposé, chez la marque comme chez nous. */
  mode          text NOT NULL DEFAULT 'sedentaire' CHECK (mode IN ('sedentaire','mobile')),
  city          text, address text,                      -- l'adresse d'un sédentaire ; NULL pour un mobile, qui n'en a pas
  cgu_accepted_at timestamptz, cgu_version text,
  account_id    text,                                    -- → accounts(id), espace 'tech_revendeur' ; clé en fin de fichier
  /* (21/09) LE POINT DE VENTE EST UN COMMERCE : sa carte vit dans partner_cards (enregistrée une fois, clonée sur le compte
     de chaque marque à la vente). Sans commerce rattaché, il ne peut pas acheter un bon. */
  partner_id    uuid REFERENCES partners(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tech_reseller_adresse CHECK (mode <> 'sedentaire' OR city IS NULL OR address IS NOT NULL)
);

-- UC-2 — le COMMERÇANT (site e-commerce) : c'est SON site qui est le réseau limité, et ses bons sont à lui.
CREATE TABLE tech_merchants (
  id            text PRIMARY KEY,                        -- 'MCH-00001'
  company_name  text NOT NULL,
  siret         text NOT NULL UNIQUE,
  website_url   text NOT NULL,                           -- le périmètre du réseau limité, en toutes lettres
  contact_email text NOT NULL,
  contact_phone text,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','validated','suspended')),
  cgu_accepted_at timestamptz, cgu_version text,
  account_id    text,                                    -- → accounts(id), espace 'tech_marchand'
  /* ══ (23/09 — grossiste) LE COMPTE CONNECTÉ STRIPE A DISPARU ══════════════════════════════════════════════
     La marque n'encaisse plus : NOUS lui achetons ses bons et nous les revendons. Ce qui la concerne tient en
     trois choses — l'offre de paiement qu'elle a choisie (elle commande la remise ET le délai), le compte que
     nous virons, et son forfait logiciel, vendu à part. */
  payment_mode  text CHECK (payment_mode IS NULL OR payment_mode IN ('j1','j7','j10')),   -- NULL = l'offre par défaut du référentiel
  software_plan text CHECK (software_plan IS NULL OR software_plan IN ('reseau','essentiel','illimite')),
  plan_since    timestamptz,                             -- le premier mois offert court de cette date
  payout_iban   text, payout_bic text, payout_holder text,   -- le RIB qui reçoit les virements : sans lui, rien ne part
  created_at    timestamptz NOT NULL DEFAULT now()
);

/* UC-3 — LA DÉCLARATION « RÉSEAU LIMITÉ ». La pièce que l'ACPR demanderait : le commerçant déclare, horodaté,
   que ses bons ne serviront QUE chez lui. Une correction n'efface pas la précédente — elle en ajoute une
   (même règle que le registre de police) ; la déclaration COURANTE est la dernière déposée. */
CREATE TABLE tech_compliance_declarations (
  id            text PRIMARY KEY,                        -- 'CNF-00001'
  merchant_id   text NOT NULL REFERENCES tech_merchants(id) ON DELETE CASCADE,
  declared_scope text NOT NULL,                          -- l'usage exclusif, tel que le commerçant l'écrit
  status        text NOT NULL DEFAULT 'to_correct' CHECK (status IN ('validated','to_correct')),
  reason        text,                                    -- un refus se motive : le commerçant doit pouvoir corriger
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  decided_at    timestamptz, decided_by text,
  CONSTRAINT compliance_refus_motive CHECK (status <> 'to_correct' OR decided_at IS NULL OR reason IS NOT NULL)
);
CREATE INDEX tech_compliance_courante ON tech_compliance_declarations (merchant_id, submitted_at DESC);

/* UC-4 — LE MANDAT DE REPRÉSENTATION (art. 1984 s. du Code civil). Signé UNE fois par partie, à l'inscription :
   c'est lui qui permet à la plateforme de générer ET d'exécuter les contrats de distribution à venir, sans
   re-signature. Révocable à tout moment — les contrats déjà exécutés sous son empire restent valables. */
CREATE TABLE tech_mandates (
  id            text PRIMARY KEY,                        -- 'MDT-00001'
  principal_type text NOT NULL CHECK (principal_type IN ('reseller','merchant')),
  principal_id  text NOT NULL,                           -- tech_resellers(id) ou tech_merchants(id) selon le type
  scope         text NOT NULL,                           -- le pouvoir donné, en toutes lettres (périmètre défini)
  signed_at     timestamptz NOT NULL DEFAULT now(),
  signed_by     text,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  revoked_at    timestamptz, revocation_reason text,
  document_url  text,
  CONSTRAINT mandat_revoque_date CHECK (status <> 'revoked' OR revoked_at IS NOT NULL)
);
-- un seul mandat ACTIF par mandant : deux pouvoirs concurrents, on ne saurait plus lequel a servi
CREATE UNIQUE INDEX tech_mandat_un_actif ON tech_mandates (principal_type, principal_id) WHERE status = 'active';

-- UC-5 — la MISE EN RELATION, créée par la plateforme sans validation manuelle dès que tout est en règle.
CREATE TABLE tech_matches (
  id            text PRIMARY KEY,                        -- 'MTC-00001'
  reseller_id   text NOT NULL REFERENCES tech_resellers(id),
  merchant_id   text NOT NULL REFERENCES tech_merchants(id),
  status        text NOT NULL DEFAULT 'accepted' CHECK (status IN ('proposed','accepted','rejected')),
  by_platform   boolean NOT NULL DEFAULT true,           -- l'automatisation remplace l'étape de validation manuelle
  created_at    timestamptz NOT NULL DEFAULT now()
);

/* UC-6 à UC-9, UC-13 — LE CONTRAT DE DISTRIBUTION À USAGE UNIQUE : un an, non reconductible, résiliable à tout
   moment par l'une OU l'autre des parties (ad nutum, sans motif). Deux transitions seulement portent une
   commission : signed (CONTRACTUALISATION) et terminated (EXTINCTION). Le renouvellement crée une NOUVELLE
   instance — l'index partiel ci-dessous l'impose : un seul contrat vivant par couple. */
CREATE TABLE tech_distribution_contracts (
  id            text PRIMARY KEY,                        -- 'CTR-00001'
  match_id      text NOT NULL REFERENCES tech_matches(id),
  reseller_id   text NOT NULL REFERENCES tech_resellers(id),
  merchant_id   text NOT NULL REFERENCES tech_merchants(id),
  duration_months integer NOT NULL DEFAULT 12 CHECK (duration_months > 0),
  termination_clause text NOT NULL DEFAULT 'ad_nutum' CHECK (termination_clause = 'ad_nutum'),
  mandatory_api_clause boolean NOT NULL DEFAULT true CHECK (mandatory_api_clause),   -- §9 : toujours vrai
  state         text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','sent','signed','active','terminated','closed')),
  signed_at     timestamptz, ends_at timestamptz, terminated_at timestamptz, closed_at timestamptz,
  termination_reason text CHECK (termination_reason IN ('term_expired','early_termination_ad_nutum','other')),
  terminated_by text CHECK (terminated_by IN ('reseller','merchant','platform')),
  termination_comment text,
  manual_signature boolean NOT NULL DEFAULT false,       -- vrai quand un mandat manquait : repli manuel
  volume_vouchers integer NOT NULL DEFAULT 0,            -- compteur INDICATIF (UC-7) — aucun fonds, jamais
  volume_amount_cents integer NOT NULL DEFAULT 0,
  reseller_discount_pct numeric(5,2) CHECK (reseller_discount_pct IS NULL OR (reseller_discount_pct >= 0 AND reseller_discount_pct < 100)),   -- (21/09) la remise du point de vente, écrite AU CONTRAT ; NULL = le taux du référentiel
  document_url  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contrat_signe_date CHECK (state NOT IN ('signed','active') OR (signed_at IS NOT NULL AND ends_at IS NOT NULL)),
  CONSTRAINT contrat_fin_motivee CHECK (state <> 'terminated' OR (terminated_at IS NOT NULL AND termination_reason IS NOT NULL))
);
CREATE UNIQUE INDEX tech_contrat_un_vivant ON tech_distribution_contracts (reseller_id, merchant_id) WHERE state IN ('signed','active');
-- les mandats qui ont SERVI à l'exécution automatique : la preuve du pouvoir, contrat par contrat (UC-14)
CREATE TABLE tech_contract_mandates (
  contract_id   text NOT NULL REFERENCES tech_distribution_contracts(id) ON DELETE CASCADE,
  mandate_id    text NOT NULL REFERENCES tech_mandates(id),
  PRIMARY KEY (contract_id, mandate_id)
);

/* UC-10 — L'ÉVÉNEMENT DE COMMISSION. Le taux et la base sont FIGÉS dessus : faire évoluer le référentiel ne
   rejoue jamais une commission déjà née (§9). Un seul événement de chaque type par contrat. */
/* UC-11 — LA REDEVANCE DE STOCKAGE (§5.3) : récurrente, par commerçant et par période, INDIFFÉRENTE aux
   signatures et aux extinctions. Elle paie l'hébergement et la gestion numérique des bons, rien d'autre. */


/* NOS FACTURES, ET RIEN D'AUTRE (§8) : « toute intégration de paiement doit se limiter au règlement de la
   propre facture de commission de la plateforme, jamais aux flux entre partenaire et commerçant ». */
CREATE TABLE tech_invoices (
  id            text PRIMARY KEY,                        -- 'FTC-00001'
  source_type   text NOT NULL CHECK (source_type IN ('subscription')),   -- (23/09) l'abonnement logiciel, et rien d'autre : le prix des bons est une remise sur achat, pas une prestation facturée
  source_id     text NOT NULL,
  merchant_id   text REFERENCES tech_merchants(id),
  reseller_id   text REFERENCES tech_resellers(id),
  amount_ht_cents integer NOT NULL,
  vat_rate      numeric(5,2) NOT NULL,                   -- nos prestations sont soumises à TVA (§5, §9)
  vat_cents     integer NOT NULL,
  amount_ttc_cents integer NOT NULL,
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','overdue')),
  issued_at     timestamptz, paid_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tech_invoice_ttc CHECK (amount_ttc_cents = amount_ht_cents + vat_cents),
  UNIQUE (source_type, source_id)                        -- on ne facture pas deux fois la même chose
);

/* LES CLÉS D'API DU COMMERÇANT. Le secret n'est STOCKÉ NULLE PART : seule son empreinte SHA-256 l'est, comme
   un mot de passe. Perdu, il se révoque et se refait — il ne se retrouve pas. */
CREATE TABLE tech_api_keys (
  id            text PRIMARY KEY,                        -- 'CLE-00001'
  merchant_id   text NOT NULL REFERENCES tech_merchants(id) ON DELETE CASCADE,
  public_key    text NOT NULL UNIQUE,                    -- 'pk_…' : vit dans la page de commande du site de la marque, ne peut rien seule
  secret_sha256 char(64) NOT NULL,                       -- l'EMPREINTE du secret, jamais le secret
  secret_preview text NOT NULL,                          -- 'sk_ABCD…WXYZ' : de quoi reconnaître la clé, pas de quoi s'en servir
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz, revocation_reason text
);
CREATE UNIQUE INDEX tech_cle_une_active ON tech_api_keys (merchant_id) WHERE revoked_at IS NULL;

/* LES BONS DU COMMERÇANT — LES SIENS. `merchant_id` est NOT NULL : il n'existe aucun bon « de la plateforme »,
   et le modèle ne permet pas d'en écrire un. Le prix d'achat du revendeur et son prix de revente ne figurent
   PAS ici : sa marge lui appartient (§5.1), et l'inscrire reviendrait à tenir un flux qui ne nous regarde pas. */
CREATE TABLE tech_vouchers (
  id            text PRIMARY KEY,                        -- 'TBN-00001'
  code          text NOT NULL UNIQUE,                    -- 'TB-XXXX-XXXX-XXXX' (préfixe du référentiel)
  merchant_id   text NOT NULL REFERENCES tech_merchants(id),
  reseller_id   text NOT NULL REFERENCES tech_resellers(id),
  contract_id   text NOT NULL REFERENCES tech_distribution_contracts(id),
  face_value_cents integer NOT NULL CHECK (face_value_cents > 0),
  balance_cents integer NOT NULL CHECK (balance_cents >= 0),
  state         text NOT NULL DEFAULT 'allocated' CHECK (state IN ('issued','allocated','sold','redeemed','cancelled')),
  issued_at     timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,                    -- au moins un an (art. L112-1-1 C. conso)
  sold_at       timestamptz, redeemed_at timestamptz, cancelled_at timestamptz,
  CONSTRAINT tech_voucher_solde CHECK (balance_cents <= face_value_cents),
  CONSTRAINT tech_voucher_utilise CHECK (state <> 'redeemed' OR redeemed_at IS NOT NULL)
);
CREATE INDEX tech_vouchers_marchand ON tech_vouchers (merchant_id, state);
CREATE INDEX tech_vouchers_revendeur ON tech_vouchers (reseller_id, state);

-- LE BON PROPOSÉ (20/09 ; renommé le 23/09 — fondatrice : « attention au vocabulaire juridique »). Ça s'appelait
-- « demande de paiement », et le mot était faux en droit : nous ne demandons aucun paiement, nous ne réglons rien,
-- nous ne tenons pas de dette. La marque PROPOSE à un client un bon d'achat d'un montant précis (sa commande, son
-- devis — sa référence à elle) ; le client l'achète au comptoir d'un commerce du réseau (nous l'achetons à la marque
-- à ce moment-là), puis l'UTILISE chez la marque, et chez elle seule (réseau limité), depuis l'app « Mes bons ».
-- RIEN N'EST ENCAISSÉ ICI : aucun fonds ne transite par la plateforme. PLUSIEURS bons sont admis sur un même bon
-- proposé (règle du 19/09) — d'où la table des usages à côté, une ligne par bon utilisé.
-- Deux états sont DÉRIVÉS et ne s'écrivent donc pas ici : « entamé » se lit dans les usages, « expiré » dans
-- expires_at. La colonne ne garde que l'état POSÉ : proposé, couvert, annulé.
CREATE TABLE tech_bon_offers (
  id            text PRIMARY KEY,                        -- 'TLK-00001'
  slug          text NOT NULL UNIQUE,                    -- ce qui vit dans l'URL : 'boutique-lila-a3f9c1'
  merchant_id   text NOT NULL REFERENCES tech_merchants(id) ON DELETE CASCADE,
  amount_cents  integer NOT NULL CHECK (amount_cents > 0),  -- le montant du bon, fixé par la marque
  reference     text,                                    -- sa référence à elle (commande, devis) — facultative
  customer_label text,                                   -- comment elle nomme son client — jamais une identité vérifiée
  origin_slug   text,                                    -- (23/09) né d'un lien de vente partagé ou d'un article : le slug d'origine
  state         text NOT NULL DEFAULT 'open' CHECK (state IN ('open','used','cancelled')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,                    -- ref.tech.lienValiditeJours
  covered_at    timestamptz, cancelled_at timestamptz,
  CONSTRAINT tech_offre_couverte CHECK (state <> 'used' OR covered_at IS NOT NULL)
);
CREATE INDEX tech_bon_offers_marchand ON tech_bon_offers (merchant_id, state, created_at DESC);

-- CE QUE CHAQUE BON A PRIS SUR UN BON PROPOSÉ. Le montant pris est celui du BON, jamais un encaissement : il
-- décompte ce qui manque encore sur la proposition de la marque, à laquelle nous restons étrangers.
-- (23/09, fondatrice : « l'app est obligatoire pour utiliser un bon de marque, ça permet de retracer »)
-- holder_client_id est le compte du porteur dans l'app « Mes bons » : aucun usage sans lui.
CREATE TABLE tech_bon_offer_uses (
  id            bigserial PRIMARY KEY,
  offer_id      text NOT NULL REFERENCES tech_bon_offers(id) ON DELETE CASCADE,
  voucher_id    text NOT NULL REFERENCES tech_vouchers(id),
  holder_client_id uuid NOT NULL REFERENCES users(id),    -- le porteur (compte de l'app Mes bons — users) : l'usage est retraçable
  taken_cents   integer NOT NULL CHECK (taken_cents > 0),
  used_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tech_offre_un_bon_une_fois UNIQUE (offer_id, voucher_id, used_at)
);
CREATE INDEX tech_bon_offer_uses_offre ON tech_bon_offer_uses (offer_id, used_at);

-- (21/09, fondatrice : « et pour payer, comment tu paies — pourquoi c'est pas comme Fly et Mode, la carte etc. »)
-- UN REVENDEUR SE DÉPLACE : la rencontre demandée depuis la page d'un bon proposé par une marque (techRencontre*).
-- Même cycle que distributor_meetings, avec ce qui change quand le réseau est celui d'un commerçant :
--   · le client n'a pas de compte : l'adresse est RECOPIÉE ici (aucun carnet), et il laisse le NUMÉRO où le
--     revendeur l'appellera — contact_phone s'efface dès que la rencontre se ferme (servie ou annulée) ;
--   · aucun hôte ne confirme : c'est le revendeur qui appelle, la plateforme ne fait que mettre en relation ;
--   · aucune position partagée : lat/lng sont ceux de l'ADRESSE (ou du centre de la commune, geo_approx le dit).
-- « Expirée » se DÉRIVE de expires_at et ne s'écrit pas. AUCUN FONDS : le revendeur encaisse le prix du bon pour
-- son propre compte ; voucher_id dit quel bon il a remis, jamais à quel prix.
CREATE TABLE tech_meetings (
  id              text PRIMARY KEY,                        -- 'TRV-00001'
  merchant_id     text NOT NULL REFERENCES tech_merchants(id),
  offer_id        text NOT NULL REFERENCES tech_bon_offers(id) ON DELETE CASCADE,
  reseller_id     text REFERENCES tech_resellers(id),      -- le revendeur mobile qui l'a PRISE ; NULL tant que personne
  amount_cents    integer NOT NULL CHECK (amount_cents > 0),  -- ce qui manquait encore sur le bon proposé, figé à la demande
  addr_number     text NOT NULL, addr_street text NOT NULL, addr_postcode text NOT NULL, addr_city text NOT NULL,
  addr_floor      text, addr_door text, addr_instructions text,
  lat             numeric(9,6),
  lng             numeric(9,6),
  geo_approx      boolean NOT NULL DEFAULT true,
  contact_phone   text,                                    -- lu par le seul revendeur qui l'a prise ; effacé à la clôture
  contact_channel text NOT NULL DEFAULT 'appel' CHECK (contact_channel IN ('appel','whatsapp','facetime')),
  consent_text    text NOT NULL,                           -- l'accord d'être appelé, tel qu'il l'a lu (pas de compte où le ranger)
  consented_at    timestamptz NOT NULL,
  note            text,                                    -- « je suis en terrasse, veste rouge » : ce jour-là seulement
  status          text NOT NULL DEFAULT 'demandee' CHECK (status IN ('demandee','acceptee','servie','annulee')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,                    -- la fenêtre de rencontreFenetreMin, la même que chez PayEnCash
  accepted_at     timestamptz, served_at timestamptz, cancelled_at timestamptz,
  cancelled_by    text, cancel_reason text,
  voucher_id      text REFERENCES tech_vouchers(id),       -- le bon remis au client
  CONSTRAINT tech_meeting_prise CHECK (status IN ('demandee','annulee') OR reseller_id IS NOT NULL),
  CONSTRAINT tech_meeting_servie CHECK (status <> 'servie' OR (voucher_id IS NOT NULL AND served_at IS NOT NULL))
);
CREATE INDEX tech_meetings_offre ON tech_meetings (offer_id, status);
CREATE INDEX tech_meetings_revendeur ON tech_meetings (reseller_id, status);

-- PARAMÈTRES ÉDITÉS PAR LE MANAGER (parametreSet — ref.* : dispatch, seuils, fenêtres…).
-- Une ligne par chemin ; l'historique avant/après est journalisé ('parametre_modifie').
/* ══ (21/09 — Stripe Connect) LA VENTE D'UN BON DE MARQUE, ET CE QUE STRIPE NOUS DIT ══════════════════════════
   tech_charges : chaque achat d'un bon par un point de vente — la charge DIRECTE sur le compte de la marque, avec la
   répartition FIGÉE (remise du point, commission de la plateforme, net de la marque) ; refusée, elle reste (VNX-…) : c'est
   la preuve que le point montre à son client. Miroir de PEC_DATA.techPrelevements.
   psp_events : chaque notification Stripe reçue, par son identifiant — une notification rejouée est reconnue, jamais
   appliquée deux fois. */
CREATE SEQUENCE tech_charges_ref_seq START 1;              -- 'VNT-' / 'VNX-' || lpad(nextval, 6, '0')
CREATE SEQUENCE tech_vouchers_id_seq START 1;              -- 'TBN-' || lpad(nextval, 5, '0') — le serveur émet lui aussi
REATE INDEX tech_charges_reseller_idx ON tech_charges (reseller_id, created_at DESC);
CREATE INDEX tech_charges_payment_idx  ON tech_charges (psp_payment_id);

/* ══ (23/09 — décisions fondatrice) L'ARGENT DE PAYENCASH SOLUTION : GROSSISTE, PRÉLÈVEMENT SEPA, VIREMENT ══
   Le montage « place de marché » (tech_charges, tech_commission_events, tech_storage_fees, tech_merchants.stripe_*)
   est retiré : « en tant que grossiste j'ai le droit de faire sans marketplace ». Ce qui le remplace :
     · nous ACHETONS les bons de la marque à la valeur faciale moins la remise de SON offre (j1/j7/j10) ;
     · nous les REVENDONS au point de vente à la valeur faciale moins SA part ;
     · le point est débité par PRÉLÈVEMENT SEPA après l'arrêté du soir, la marque est réglée par VIREMENT.
   Miroir exact du data-layer : techVentes, techRemises, techPenalites, techReglements, techAbonnements. ══ */

/* LE MANDAT SEPA — signé UNE fois par acteur (point de vente pour ses ventes, marque pour son abonnement).
   B2B par défaut : le débiteur professionnel renonce au remboursement sur simple demande, et sa banque
   enregistre le mandat avant le premier prélèvement. On ne garde que ce qui sert à prélever. */
CREATE TABLE tech_sepa_mandates (
  rum           text PRIMARY KEY,                        -- référence unique de mandat, dérivée de l'acteur
  actor_type    text NOT NULL CHECK (actor_type IN ('revendeur','marchand')),
  actor_id      text NOT NULL,                           -- tech_resellers(id) ou tech_merchants(id)
  scheme        text NOT NULL DEFAULT 'B2B' CHECK (scheme IN ('B2B','CORE')),
  iban          text NOT NULL, bic text NOT NULL, account_holder text NOT NULL,
  creditor_ics  text,                                    -- notre ICS au moment de la signature
  statut        text NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif','revoque')),
  signed_at     timestamptz NOT NULL DEFAULT now(), signed_by text,
  first_debit_at timestamptz,                            -- pose la séquence : FRST tant qu'il est NULL, RCUR ensuite
  revoked_at    timestamptz, revoked_by text,
  UNIQUE (actor_type, actor_id),
  CONSTRAINT tech_mandat_revoque CHECK (statut <> 'revoque' OR revoked_at IS NOT NULL)
);

/* ══ (23/09, arbitrage fondatrice : « prélèvement SEPA pour tabac etc., et avance pour micro ») ═══════════════
   LE COMPTE D'AVANCE DU COMMISSIONNAIRE MICRO-ENTREPRENEUR. Il ne doit jamais rien : il verse une garantie une
   fois, recharge un solde, et chaque bon vendu le débite de son prix d'achat. L'argent qu'il encaisse ensuite
   auprès du client LUI APPARTIENT — il se rembourse, il ne détient les fonds de personne.
   UN SOLDE NE SE STOCKE PAS : il se dérive de ces mouvements. Écrire un nombre et le corriger à chaque geste,
   c'est fabriquer un solde que rien n'explique — et un solde qu'on ne peut pas justifier ligne à ligne est un
   solde faux le jour où quelqu'un le conteste. ══ */
CREATE TABLE tech_advance_movements (
  reference     text PRIMARY KEY,                        -- 'AVC-000001'
  actor_type    text NOT NULL CHECK (actor_type IN ('revendeur','marchand')),
  actor_id      text NOT NULL,
  type          text NOT NULL CHECK (type IN ('garantie','recharge','achat','remboursement','restitution')),
  amount_cents  integer NOT NULL,                        -- signé : + recharge et garantie, − achat et restitution
  reason        text,
  source_ref    text,                                    -- la référence du virement reçu, ou la vente concernée
  created_at    timestamptz NOT NULL DEFAULT now(), created_by text,
  CONSTRAINT tech_avance_sens CHECK (
    (type IN ('garantie','recharge','remboursement') AND amount_cents > 0)
    OR (type IN ('achat','restitution') AND amount_cents < 0))
);
CREATE INDEX tech_advance_actor_idx ON tech_advance_movements (actor_type, actor_id, created_at DESC);

/* LA VENTE D'UN BON — quatre nombres FIGÉS au comptoir, et DEUX états qui ne se confondent pas : ce que le
   point nous doit (statut) et ce que nous devons à la marque (brand_status). */
CREATE TABLE tech_sales (
  reference     text PRIMARY KEY,                        -- 'VNT-000001'
  merchant_id   text NOT NULL REFERENCES tech_merchants(id),
  reseller_id   text NOT NULL REFERENCES tech_resellers(id),
  contract_id   text NOT NULL REFERENCES tech_distribution_contracts(id),
  voucher_id    text REFERENCES tech_vouchers(id),
  face_value_cents integer NOT NULL CHECK (face_value_cents > 0),
  payment_mode  text NOT NULL CHECK (payment_mode IN ('j1','j7','j10')),   -- l'offre de la marque AU MOMENT de la vente
  discount_pct  numeric(5,2) NOT NULL,                   -- la remise consentie par la marque (figée)
  discount_cents integer NOT NULL CHECK (discount_cents >= 0),
  brand_price_cents integer NOT NULL CHECK (brand_price_cents > 0),      -- ce que nous payons à la marque
  reseller_share_pct numeric(5,2) NOT NULL,              -- ce que garde le point (figé)
  reseller_share_cents integer NOT NULL CHECK (reseller_share_cents >= 0),
  reseller_price_cents integer NOT NULL CHECK (reseller_price_cents > 0),-- ce que le point nous doit
  margin_cents  integer NOT NULL,                        -- notre marge : la différence
  /* (23/09) COMMENT CETTE VENTE EST PAYÉE — et ce n'est pas un détail d'affichage : une vente payée d'avance
     naît RÉGLÉE, elle n'entre dans aucune remise et ne peut pas revenir impayée. */
  payment_kind  text NOT NULL DEFAULT 'sepa' CHECK (payment_kind IN ('sepa','avance')),
  advance_ref   text REFERENCES tech_advance_movements(reference),
  statut        text NOT NULL DEFAULT 'a_prelever' CHECK (statut IN ('a_prelever','en_prelevement','regle','impaye','annulee')),
  brand_status  text NOT NULL DEFAULT 'a_payer' CHECK (brand_status IN ('a_payer','paye','annule')),
  dd_file_id    text,                                    -- → tech_dd_files(reference), clé en fin de fichier (la table est créée après)
  due_debit_at  timestamptz,                             -- l'échéance du prélèvement
  due_brand_at  timestamptz,                             -- l'échéance du virement, posée à l'arrêté
  payout_id     text,                                    -- → tech_payouts(reference), clé en fin de fichier
  mandate_rum   text REFERENCES tech_sepa_mandates(rum),
  created_at    timestamptz NOT NULL DEFAULT now(), created_by text,
  cancelled_at  timestamptz, cancel_reason text,
  CONSTRAINT tech_sale_prix_marque CHECK (brand_price_cents = face_value_cents - discount_cents),
  CONSTRAINT tech_sale_prix_point  CHECK (reseller_price_cents = face_value_cents - reseller_share_cents),
  CONSTRAINT tech_sale_marge       CHECK (margin_cents = reseller_price_cents - brand_price_cents),
  CONSTRAINT tech_sale_part        CHECK (reseller_share_pct <= discount_pct)
);
CREATE INDEX tech_sales_merchant_idx ON tech_sales (merchant_id, created_at DESC);
CREATE INDEX tech_sales_reseller_idx ON tech_sales (reseller_id, statut);

/* LA REMISE DE PRÉLÈVEMENTS — un fichier pain.008 déposé à la banque, une échéance. « Fichier déposé dans les
   15 min de la vérification journalière » : le retard ne se refuse pas, il s'ÉCRIT (deposit_on_time). */
CREATE TABLE tech_dd_files (
  reference     text PRIMARY KEY,                        -- 'RMS-000001'
  nature        text NOT NULL CHECK (nature IN ('ventes','abonnements')),
  payment_mode  text CHECK (payment_mode IS NULL OR payment_mode IN ('j1','j7','j10')),
  window_start  timestamptz, window_end timestamptz,     -- la fenêtre 20:00 → 20:00
  statut        text NOT NULL DEFAULT 'prepare' CHECK (statut IN ('prepare','depose','partiel','traite','annulee')),
  total_cents   integer NOT NULL DEFAULT 0,
  bank_cost_cents integer NOT NULL DEFAULT 0,
  format        text NOT NULL DEFAULT 'pain.008.001.02',
  creditor_ics  text, creditor_iban text, creditor_bic text,
  due_at        timestamptz,                             -- l'échéance : au moins 1 jour ouvré après le dépôt
  deposit_before timestamptz,                            -- la limite des 15 min
  deposited_at  timestamptz, deposited_by text, deposit_on_time boolean,
  returned_at   timestamptz, returned_by text,
  created_at    timestamptz NOT NULL DEFAULT now(), created_by text
);

/* UNE LIGNE PAR DÉBITEUR ET PAR REMISE — ses ventes, ses pénalités, son abonnement, en UN débit. Un débiteur
   sans mandat actif n'entre pas dans le fichier : sa ligne est ÉCARTÉE, et elle dit pourquoi. */
CREATE TABLE tech_direct_debits (
  id            bigserial PRIMARY KEY,
  file_id       text NOT NULL REFERENCES tech_dd_files(reference),
  debtor_type   text NOT NULL CHECK (debtor_type IN ('revendeur','marchand')),
  debtor_id     text NOT NULL,
  mandate_rum   text REFERENCES tech_sepa_mandates(rum),
  sequence      text CHECK (sequence IS NULL OR sequence IN ('FRST','RCUR')),
  scheme        text CHECK (scheme IS NULL OR scheme IN ('B2B','CORE')),
  amount_cents  integer NOT NULL CHECK (amount_cents >= 0),
  statut        text NOT NULL DEFAULT 'prepare' CHECK (statut IN ('prepare','depose','paye','impaye','ecartee')),
  skip_reason   text,                                    -- pourquoi la ligne est écartée (mandat absent)
  bank_reason   text,                                    -- le code de la banque : AM04, MD01, MS03…
  returned_at   timestamptz,
  represented_at timestamptz, represented_by text,
  UNIQUE (file_id, debtor_type, debtor_id)               -- un débiteur n'est débité qu'UNE fois par remise
);
CREATE INDEX tech_dd_debtor_idx ON tech_direct_debits (debtor_type, debtor_id, statut);

/* CE QUE LE CONTRAT MET À LA CHARGE D'UN POINT QUI NE PAIE PAS — montant réglé en Configuration, prélevé sur
   la remise SUIVANTE, sur le même mandat. Un débiteur, un mandat, un débit. */
CREATE TABLE tech_penalties (
  reference     text PRIMARY KEY,                        -- 'PEN-000001'
  reseller_id   text NOT NULL REFERENCES tech_resellers(id),
  amount_cents  integer NOT NULL CHECK (amount_cents > 0),
  reason        text NOT NULL,
  source_ref    text,                                    -- la ligne de prélèvement à l'origine
  statut        text NOT NULL DEFAULT 'a_prelever' CHECK (statut IN ('a_prelever','en_prelevement','regle','impaye')),
  file_id       text REFERENCES tech_dd_files(reference),
  created_at    timestamptz NOT NULL DEFAULT now()
);

/* LE RÈGLEMENT DE LA MARQUE — virement instantané depuis notre banque, à l'échéance de SON offre. `covered`
   dit si les prélèvements qui le couvrent étaient déjà encaissés : en offre « 24 h » ils ne le sont pas, et
   c'est exactement le risque que borne le plafond d'encours. */
CREATE TABLE tech_payouts (
  reference     text PRIMARY KEY,                        -- 'VIR-000001'
  merchant_id   text NOT NULL REFERENCES tech_merchants(id),
  payment_mode  text NOT NULL CHECK (payment_mode IN ('j1','j7','j10')),
  amount_cents  integer NOT NULL CHECK (amount_cents > 0),
  sale_count    integer NOT NULL CHECK (sale_count > 0),
  iban          text NOT NULL, bic text NOT NULL, account_holder text,
  instant       boolean NOT NULL DEFAULT true,
  bank_cost_cents integer NOT NULL DEFAULT 0,
  covered       boolean NOT NULL DEFAULT false,
  due_at        timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(), created_by text
);

/* L'ABONNEMENT AU LOGICIEL — une échéance par marque et par mois, au prix de SON forfait, premier mois offert.
   C'est lui qui justifie l'abonnement : un service réel, facturé pour lui-même (art. L442-1 II C. com.). */
CREATE TABLE tech_subscriptions (
  id            text PRIMARY KEY,                        -- 'ABO-00001'
  merchant_id   text NOT NULL REFERENCES tech_merchants(id),
  period        text NOT NULL,                           -- '2026-09'
  plan          text NOT NULL CHECK (plan IN ('reseau','essentiel','illimite')),
  amount_due_cents integer NOT NULL CHECK (amount_due_cents >= 0),
  statut        text NOT NULL DEFAULT 'du' CHECK (statut IN ('du','en_prelevement','regle','impaye')),
  file_id       text REFERENCES tech_dd_files(reference),
  invoice_id    text,                                    -- → tech_invoices(id), clé en fin de fichier
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, period)                           -- rejouer la tâche ne double pas l'échéance
);

/* ══ (23/09) LA PROPOSITION DE TARIF D'UN COMMISSIONNAIRE ══════════════════════════════════════════════════
   « Chaque membre affiche SON prix de déplacement, nous le mettons en concurrence avec les autres. » Le tarif
   n'est jamais le nôtre : plusieurs indépendants proposent, le CLIENT choisit. C'est aussi ce qui écarte la
   subordination (Cass. soc., 4 mars 2020, n° 19-13.316 : l'absence de liberté tarifaire la caractérise). ══ */
CREATE TABLE distributor_meeting_offers (
  id            bigserial PRIMARY KEY,
  meeting_id    text NOT NULL REFERENCES distributor_meetings(id) ON DELETE CASCADE,
  partner_id    text NOT NULL REFERENCES partners(id),
  fee_cents     integer NOT NULL CHECK (fee_cents > 0),  -- SON tarif, pour CETTE course
  message       text,
  distance_m    integer, eta_min integer,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, partner_id)                        -- réviser REMPLACE, n'ajoute pas
);

CREATE TABLE psp_events (
  id            text PRIMARY KEY,                        -- 'evt_…' : l'identifiant Stripe fait l'idempotence
  type          text NOT NULL,                           -- 'payment_intent.succeeded', 'account.updated', …
  account_id    text,                                    -- le compte connecté d'où vient l'événement (canal « comptes connectés »), sinon NULL
  livemode      boolean NOT NULL DEFAULT false,
  received_at   timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz,
  outcome       text,                                    -- ce qu'on en a fait : 'conforme', 'remboursé', 'écart accepted → refused', 'ignore'…
  payload       jsonb NOT NULL                           -- la notification telle que reçue (signée)
);

CREATE TABLE settings (
  key         text PRIMARY KEY,                           -- 'ref.dispatch.rayonM'
  value       jsonb NOT NULL,
  updated_by  text REFERENCES manager_users(identifiant),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- (18/09, soir) `chat_messages` — le fil entre l'agent en route et le client — est SUPPRIMÉE : il n'y a plus
-- personne en route. Ce qu'un client a à dire passe par le support (support_conversations) ou la hotline.

-- AVIS MODE (avisAjouter — les 5★ de 04-commande) : par pièce et par vendeur, achat vérifié.
CREATE TABLE product_reviews (
  id           text PRIMARY KEY,                          -- 'AV-12'
  article_id   uuid NOT NULL REFERENCES mode_articles(id),
  supplier_id  uuid REFERENCES suppliers(id),             -- le vendeur noté (noteVendeur)
  user_id      uuid REFERENCES users(id),
  author_label text NOT NULL,                             -- 'Karim B.' (jamais le nom complet)
  note         smallint NOT NULL CHECK (note BETWEEN 1 AND 5),
  texte        text,
  verified     boolean NOT NULL DEFAULT false,            -- achat vérifié (order_ref connu)
  order_ref    text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- FIDÉLITÉ (fideliteAjouter / fideliteSolde) : un livre de points, le solde en DÉRIVE.
CREATE TABLE loyalty_ledger (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_ref   text,
  points      integer NOT NULL,                           -- signé
  label       text NOT NULL,
  at          timestamptz NOT NULL DEFAULT now()
);

-- DÉMARQUE (demarquer / demarqueDecider) : AJEK PROPOSE, le fournisseur DÉCIDE — la remise
-- ne s'applique pas tant qu'il n'a pas répondu ; rejouer une proposition remet à zéro.
CREATE TABLE markdowns (
  article_id     uuid PRIMARY KEY REFERENCES mode_articles(id) ON DELETE CASCADE,
  pct            smallint NOT NULL CHECK (pct BETWEEN 1 AND 90),
  min_purchase_cents integer NOT NULL DEFAULT 0,
  supplier_id    uuid REFERENCES suppliers(id),
  status         text NOT NULL DEFAULT 'proposee' CHECK (status IN ('proposee','acceptee','refusee')),
  retired        boolean NOT NULL DEFAULT false,          -- retrait du catalogue
  proposed_at    timestamptz NOT NULL DEFAULT now(),
  proposed_by    text NOT NULL DEFAULT 'AJEK',
  decided_at     timestamptz, decision_note text,
  client_price_cents_at integer, buy_price_cents_at integer   -- les prix au moment de la proposition (jamais réécrits)
);

-- LIVRE DE POLICE (art. 321-7 CP — registreGet / registreSortie) : UNE ligne numérotée par
-- lot entré, le cédant, le prix d'achat ; la sortie solde la ligne. Append-only : une entrée
-- ne se réécrit jamais, une sortie ne se repose jamais.
/* ── (12/09 — constats C39/C40/C41) LE REGISTRE TENAIT UNE LIGNE PAR LOT ─────────────────────────────────────
   `lot_ref UNIQUE` + une sortie portée par la ligne d'entrée : un lot de trois paires vendu une fois déclarait les
   TROIS vendues, et les deux ventes suivantes n'avaient nulle part où s'inscrire. L'article 321-7 demande d'identifier
   CHAQUE objet et de consigner SA sortie : une ligne par PIÈCE, les sorties dans leur propre table append-only, et
   une correction qui s'INSCRIT (entry_kind='rectification' + rectifies_line) au lieu de réécrire l'entrée. ── */
CREATE TABLE police_register (
  line_no         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entry_kind      text NOT NULL DEFAULT 'entry' CHECK (entry_kind IN ('entry','rectification')),
  entered_on      date NOT NULL,
  lot_ref         text NOT NULL,                          -- réf du lot (purchase_orders / inventaire)
  unit_no         integer,                                -- rang de la pièce dans son lot (NULL pour un rectificatif)
  size            text,
  description     text NOT NULL,                          -- marque · modèle · taille · couleurs · réf/taille/rang — FIGÉE à l'inscription
  supplier_id     uuid REFERENCES suppliers(id),
  ceding_identity text NOT NULL,                          -- 'Pro · SIRET •• ••• ••• ••12' (jamais le SIRET en clair)
  provenance      text,                                   -- (08/09) provenance déclarée (libellé ref.provenances)
  proof           text,                                   -- justificatif : 'Facture d'origine · x.pdf' | 'Déclaration de propriété du fournisseur' | 'aucun'
  buy_price_cents integer,                                -- le prix INSCRIT ce jour-là ; une re-cotation acceptée ne le réécrit pas, elle s'inscrit
  rectifies_line  bigint REFERENCES police_register(line_no),   -- rectificatif : la ligne visée, qui reste inscrite
  rectification_reason text,
  recorded_by     text,
  recorded_at     timestamptz NOT NULL DEFAULT now(),
  CHECK ((entry_kind = 'rectification') = (rectifies_line IS NOT NULL))
);

-- LES SORTIES, append-only : une pièce sort UNE fois, datée, avec sa nature — vente, retrait du catalogue,
-- retour client, invendu, refus atelier (une entrée ne se réécrit jamais : la sortie s'inscrit à côté).
CREATE TABLE police_register_exits (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_no      bigint NOT NULL REFERENCES police_register(line_no),
  nature       text NOT NULL CHECK (nature IN ('vente','retrait','retour','invendu','refus')),
  order_ref    text,                                      -- la commande, quand c'est une vente
  exited_at    timestamptz NOT NULL DEFAULT now(),
  recorded_by  text,
  reason       text,
  UNIQUE (line_no)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 15 · CONTRÔLE D'IDENTITÉ PVID (07/09) — un cycle de vie que le bus écrivait sans table
-- ─────────────────────────────────────────────────────────────────────────────
-- (18/09, soir) La TOURNÉE de collecte (`collection_rounds` : le manager venait chercher la caisse d'un agent) et la
-- REMISE d'espèces au manager (`cash_handovers`) sont SUPPRIMÉES avec l'agent : il n'y a plus de caisse à collecter,
-- donc plus de tournée, plus de remise, plus de poche « en main du manager ». Reste le contrôle d'identité.

-- CONTRÔLE D'IDENTITÉ PVID (ouvrirVerification / décision manager) : pièce + selfie transmis
-- au prestataire, résultat, puis contrôle humain. Le succès pose users.kyc_level = 'pvid'.
CREATE TABLE kyc_checks (
  id            text PRIMARY KEY,                         -- 'VRF-…'
  user_id       uuid NOT NULL REFERENCES users(id),
  status        text NOT NULL DEFAULT 'transmise_pvid'
                CHECK (status IN ('transmise_pvid','a_controler','validee','refusee','a_refaire')),   -- = STATUT_SQL.verification
  pvid_ref      text,                                     -- 'PVID-…'
  pvid_result   text,                                     -- 'conforme' · 'non_conforme'
  pvid_score    numeric(3,2),
  motif         text,                                     -- OBLIGATOIRE hors validation
  decided_by    text REFERENCES manager_users(identifiant),
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  decided_at    timestamptz
);
CREATE INDEX kyc_checks_file ON kyc_checks (status, submitted_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 16 · LE PANIER MODE (07/09 — fondatrice « oui créer la table panier ») : jusqu'ici
--      sur l'appareil (pec-mode-panier / -promo / -carte). Un panier suit désormais
--      le CLIENT d'un appareil à l'autre. Miroir de PEC_DATA.mode.panier.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE carts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,   -- UN panier ouvert par client (vidé au changement de compte)
  promo_code        text REFERENCES supplier_promo_codes(code),                   -- panierPromoAppliquer : le code FOURNISSEUR appliqué
  promo_amount_cents integer,                                                     -- la remise calculée sur les pièces concernées
  promo_supplier_id uuid REFERENCES suppliers(id),                                -- qui la finance (finance = 'fournisseur')
  gift_card_id      uuid REFERENCES gift_cards(id),                               -- carteCadeau appliquée (masque + solde)
  locked_order_ref  text,                                                         -- VERROU : la commande groupée en cours (fenêtre 120 min) — NULL = panier libre
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════
-- (11/09) LA FACTURE DU CLIENT. Elle n'existait NULLE PART : deux écrans Mode renvoyaient vers la même
-- image décorative sous l'étiquette « PDF ↓ ». Or PayEnCash achète ferme au fournisseur et REVEND EN SON
-- NOM : face au client, c'est nous le vendeur, et la vente à distance exige la confirmation écrite des
-- mentions (art. L221-13 C. conso). Le document se REND à la demande depuis l'instantané gelé de la
-- commande ; cette table garde ce qui doit être opposable : le numéro, la date, l'identité du vendeur au
-- moment de la vente et le montant. Pas de TVA détaillée : régime de la marge (art. 297 A du CGI).
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE client_invoices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid NOT NULL REFERENCES orders(id),
  invoice_number text UNIQUE NOT NULL,                   -- FC-<réf de commande> : la séquence des commandes EST la séquence des factures (continue, sans trou)
  issued_at      timestamptz NOT NULL,
  amount_cents   integer NOT NULL,                       -- ce que le client a RÉELLEMENT payé (après avoir, carte cadeau, promo, campagne)
  -- (17/09 — pivot ; 18/09, soir ; 20/09) COMMENT LE CLIENT A PAYÉ, tel qu'imprimé sur sa facture : elle doit dire
  -- « réglée par Bon d’achat PayEnCash », jamais « en espèces » — AJEK n'en encaisse aucune.
  payment_means  text NOT NULL CHECK (payment_means IN ('avoir','bon')),   -- (18/09, soir) 'especes' et 'carte' retirés : plus aucun encaissement de la main à la main ; (20/09) les moyens du rail en ligne retirés avec lui
  vat_scheme     text NOT NULL DEFAULT 'marge' CHECK (vat_scheme IN ('marge','normal')),
  -- l'identité du VENDEUR au moment de la vente : une facture rééditée dans un an ne porte pas le siège d'aujourd'hui
  seller_name    text NOT NULL,
  seller_siren   text,
  seller_rcs     text,
  seller_vat     text,
  seller_address text,
  withdrawal_days smallint NOT NULL DEFAULT 14,          -- rétractation annoncée sur la facture (art. L221-18 C. conso)
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX client_invoices_order_idx ON client_invoices(order_id);

CREATE TABLE cart_items (
  cart_id     uuid NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id  uuid NOT NULL REFERENCES article_variants(id),                      -- = (articleId, taille CHOISIE sur la fiche)
  qty         integer NOT NULL CHECK (qty >= 1),                                  -- un entier ≥ 1, point (06/09) ; ≤ v_mode_stock_available (anti-survente, service)
  added_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cart_id, variant_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- CLÉS ÉTRANGÈRES CIRCULAIRES (11/09 — lot 9)
-- Certaines tables visent une cible définie PLUS BAS dans le fichier : poser le lien ici garde le schéma lisible de
-- haut en bas sans renoncer à l'intégrité. (17/09 — pivot) les trois clés de `partners` (vers sa borne, le compte de
-- son gérant, son prospect) et `payments_kiosk_fk` (la borne qui avait encaissé) sont retirées avec leurs colonnes.
-- (18/09) Deux d'entre elles REVIENNENT avec le point de vente du Bon d’achat PayEnCash — le compte de son gérant et le prospect
-- dont il est né ; plus aucune borne.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE suppliers ADD CONSTRAINT suppliers_account_fk FOREIGN KEY (account_id) REFERENCES accounts(id);
ALTER TABLE sales_leads ADD CONSTRAINT sales_leads_owner_fk    FOREIGN KEY (owner)       REFERENCES accounts(id);
ALTER TABLE sales_leads ADD CONSTRAINT sales_leads_supplier_fk FOREIGN KEY (supplier_id) REFERENCES suppliers(id);
ALTER TABLE commercial_callbacks ADD CONSTRAINT commercial_callbacks_owner_fk FOREIGN KEY (assigned_to) REFERENCES accounts(id);
-- L'identité légale d'un fournisseur est RELEVÉE sur ses pièces : chaque bloc pointe la pièce d'où il vient.
ALTER TABLE supplier_legal ADD CONSTRAINT supplier_legal_kbis_fk FOREIGN KEY (kbis_document_id) REFERENCES kyc_documents(id);
ALTER TABLE supplier_legal ADD CONSTRAINT supplier_legal_vat_fk  FOREIGN KEY (vat_document_id)  REFERENCES kyc_documents(id);
ALTER TABLE supplier_legal ADD CONSTRAINT supplier_legal_rib_fk  FOREIGN KEY (rib_document_id)  REFERENCES kyc_documents(id);

-- (18/09) LE POINT DE VENTE DU BON D’ACHAT vise deux tables définies après lui : le compte de son gérant et le prospect dont il est né.
ALTER TABLE partners ADD CONSTRAINT partners_account_fk FOREIGN KEY (account_id) REFERENCES accounts(id);
ALTER TABLE partners ADD CONSTRAINT partners_lead_fk    FOREIGN KEY (lead_id)    REFERENCES sales_leads(id);

-- (19/09) LA COMMANDE VISE LE LIEN PARTAGÉ QUI LUI A OUVERT UNE REMISE — `share_links` est définie plus bas qu'`orders`.
ALTER TABLE orders ADD CONSTRAINT orders_share_link_fk FOREIGN KEY (share_link_id) REFERENCES share_links(id);
-- (19/09, nuit) la rencontre pointe l'adresse d'où elle vient ; `addresses` est définie avec les données du client,
-- bien après `distributor_meetings`. ON DELETE SET NULL : l'adresse recopiée sur la rencontre reste, la référence tombe.
ALTER TABLE distributor_meetings ADD CONSTRAINT meetings_address_fk FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL;
-- (19/09, nuit) PayEnCash Solution : les comptes des deux acteurs, et les factures qui closent les événements.
ALTER TABLE tech_resellers ADD CONSTRAINT tech_resellers_account_fk FOREIGN KEY (account_id) REFERENCES accounts(id);
ALTER TABLE tech_merchants ADD CONSTRAINT tech_merchants_account_fk FOREIGN KEY (account_id) REFERENCES accounts(id);
-- (21/09) la carte d'un point de vente Solution qui n'est pas (encore) partenaire : `partner_cards` est définie bien avant `tech_resellers`.
ALTER TABLE partner_cards ADD CONSTRAINT partner_cards_reseller_fk FOREIGN KEY (reseller_id) REFERENCES tech_resellers(id);
-- (23/09) le modèle grossiste : la vente pointe sa remise et son virement, l'abonnement sa facture.
ALTER TABLE tech_sales ADD CONSTRAINT tech_sales_payout_fk FOREIGN KEY (payout_id) REFERENCES tech_payouts(reference);
ALTER TABLE tech_sales ADD CONSTRAINT tech_sales_file_fk FOREIGN KEY (dd_file_id) REFERENCES tech_dd_files(reference);
ALTER TABLE tech_subscriptions ADD CONSTRAINT tech_sub_invoice_fk FOREIGN KEY (invoice_id) REFERENCES tech_invoices(id);
