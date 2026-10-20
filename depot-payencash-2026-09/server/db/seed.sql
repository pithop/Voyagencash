-- =============================================================================
-- PayEnCash — SEED : le SCÉNARIO CANONIQUE des maquettes (PEC_DATA en SQL)
-- Chaque valeur ici correspond au centime près à ui/assets/payencash-data.js.
-- C'est ce jeu de données qui permet au front maquette de basculer sur l'API
-- sans qu'aucun montant affiché ne change.
-- =============================================================================

-- Compagnies partenaires (miroir PEC_DATA.compagnies — en prod : CRON de sync
-- Duffel GET /air/airlines, les URLs de logos viennent de la réponse)
INSERT INTO airlines (iata_code, name, brand_color) VALUES
('AF', 'Air France',       '#002157'),
('TO', 'Transavia',        '#00A860'),
('VY', 'Vueling',          '#FFCC00'),
('FR', 'Ryanair',          '#073590'),
('U2', 'easyJet',          '#FF6600'),
('V7', 'Volotea',          '#C90C4C'),
('AH', 'Air Algérie',      '#B31F31'),
('TU', 'Tunisair',         '#D5202E'),
('AT', 'Royal Air Maroc',  '#C4122F'),
('TP', 'TAP Air Portugal', '#00785A'),
('IB', 'Iberia',           '#D7192D'),
('TK', 'Turkish Airlines', '#C8102E');

-- Utilisatrice de démo
-- Compte établi : téléphone ET e-mail vérifiés (indispensable avant toute commande).
INSERT INTO users (id, phone, phone_verified_at, email, email_verified_at, full_name, gender, born_on, kyc_level, loyalty_points)
VALUES ('00000000-0000-0000-0000-000000000001', '+33600000001', now(), 'sofiane.m@email.fr', now(), 'Client Démo', 'm', '1991-04-12', 'declaratif', 128);

-- Carte cadeau 50 € (panier MODE : 150 − 10 − 50 = 90). (18/09) C'est le MÊME objet que le Bon d’achat PayEnCash, origine
-- manager : le schéma exige désormais le montant émis, le n° de ticket, l'émetteur et la validité (12 mois =
-- ref.bons.validiteMois) ; le code n'est jamais en clair, l'émission est un mouvement.
INSERT INTO gift_cards (code_masque, code_hash, origin, face_value_cents, balance_cents, ticket_number, issued_by, expires_at, user_id)
VALUES ('••••-••••-DEMO', 'demo-hash', 'manager', 5000, 5000,
        'BV-' || lpad(nextval('gift_cards_ticket_seq')::text, 6, '0'), 'seed', now() + interval '12 months',
        '00000000-0000-0000-0000-000000000001');
INSERT INTO gift_card_movements (gift_card_id, kind, amount_cents, by_who)
SELECT id, 'issue', 5000, 'seed' FROM gift_cards WHERE code_hash = 'demo-hash';

-- (18/09, au soir) LA ZONE ET L'AGENT ONT QUITTÉ LE SEED avec `delivery_zones` et `couriers` : l'agent de caisse
-- mobile est abandonné, personne chez PayEnCash ne touche plus d'espèces. À leur place, le POINT DE VENTE DU BON D’ACHAT —
-- le seul réseau physique qui reste — avec sa CARTE enregistrée (empreinte du prestataire : jamais un numéro) et le
-- prélèvement de sa dernière vente. (20/09) Il n'y a plus d'autre réseau : PayEnCash n'émet qu'un titre, le sien.
INSERT INTO partners (id, name, address, zip, city, phone, email, manager_name, siret, status,
                      contract_signed_at, activated_at, activated_by)
VALUES ('00000000-0000-0000-0000-000000000b01', 'Tabac du Port', '12 quai du Port', '13002', 'Marseille',
        '+33491000001', 'gerant@tabacduport.fr', 'Nadia Belkacem', '81234567800019', 'actif',
        now() - interval '20 days', now() - interval '18 days', 'emilie.r');

-- LA CARTE DU COMMERCE (18/09, soir) : ce que le prestataire nous rend, et RIEN d'autre — une empreinte réutilisable
-- (`card_…`), les quatre derniers chiffres, la marque et l'échéance. Le numéro de carte n'entre jamais ici.
INSERT INTO partner_cards (partner_id, psp, psp_card_id, last4, brand, exp_month, exp_year, holder,
                           psp_customer_id, created_by)
VALUES ('00000000-0000-0000-0000-000000000b01', 'stripe', 'pm_seedTabacDuPort0001', '4242', 'Visa',
        12, 2029, 'SARL TABAC DU PORT', 'cust_seedTabacDuPort', 'gerant@tabacduport.fr');

-- UN BON D’ACHAT VENDU AU COMPTOIR, et le prélèvement qui l'a fait naître. 50 € de bon d’achat au taux du réseau (1,100 %,
-- ce point n'ayant pas de taux propre) → commission 0,55 € HT + 0,11 € de TVA = 0,66 € gardés par le commerce,
-- 49,34 € débités sur sa carte (= PEC_DATA.partenaireDu), 0,50 € de frais prestataire (0,7 % + 0,15 €) pour nous.
-- Le taux est ÉCRIT sur la charge (commission_pct) : il y est figé. Le bon d’achat n'existe QUE parce qu'elle a été acceptée.
INSERT INTO gift_cards (id, code_masque, code_hash, origin, partner_id, face_value_cents, balance_cents,
                        ticket_number, issued_by, expires_at)
VALUES ('00000000-0000-0000-0000-000000000f01', '••••-••••-7KQ4', 'seed-hash-bon-partenaire', 'partner',
        '00000000-0000-0000-0000-000000000b01', 5000, 5000,
        'BV-' || lpad(nextval('gift_cards_ticket_seq')::text, 6, '0'), 'gerant@tabacduport.fr',
        now() + interval '12 months');
INSERT INTO gift_card_movements (gift_card_id, kind, amount_cents, by_who)
VALUES ('00000000-0000-0000-0000-000000000f01', 'issue', 5000, 'gerant@tabacduport.fr');

INSERT INTO partner_charges (partner_id, gift_card_id, face_value_cents, commission_pct, commission_ht_cents, vat_cents,
                             commission_ttc_cents, amount_cents, psp_fee_cents, status, psp, psp_payment_id,
                             reference, card_last4, created_by)
VALUES ('00000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-000000000f01',
        5000, 1.100, 55, 11, 66, 4934, 99, 'accepted', 'stripe', 'pi_seed0001',
        'PAY-' || lpad(nextval('partner_charges_ref_seq')::text, 6, '0'), '4242', 'gerant@tabacduport.fr');

-- Offre hôtel canonique (tunnel 4c : Alger, 15 → 22 août, 7 nuits, 2 voyageurs
-- — rateKey au format Nuitée, alignée sur HOTELS h1 du tunnel 03)
INSERT INTO hotel_offers (nuitee_hotel_id, name, city, stars, checkin, checkout, adults, children, rooms,
                          room_type, board, rate_id, prebook_id, prebook_expires_at, refundable, base_cents, total_cents, expires_at)
VALUES ('110000123', 'Hôtel Méditerranée', 'Alger', 3, DATE '2026-08-15', DATE '2026-08-22', 2, 0, 1,
        'DBL.ST', 'BB', 'rate_2mYQ7fKk3Zp', 'prebook_8Xw2LqBv', now() + interval '25 minutes',
        true, 15400, 15400, now() + interval '30 minutes');
INSERT INTO hotel_reviews (nuitee_hotel_id, source, score, headline, pros, cons, author_name, author_country, stayed_at) VALUES
('110000123', 'nuitee', 8.6, 'Impeccable pour le centre', 'Literie neuve, personnel adorable', 'Rue un peu bruyante côté avenue', 'Nadia', 'France', DATE '2026-07-18'),
('110000123', 'nuitee', 8.1, 'Très bon rapport qualité-prix', 'Petit-déj copieux, check-in rapide', 'Douche un peu petite', 'Karim', 'Belgique', DATE '2026-06-22');

UPDATE hotel_offers SET score = 8.4,
  max_guests = 2, checkin_time = 'dès 14 h', checkout_time = 'avant 12 h',
  house_rules = '["Pièce d''identité demandée à l''arrivée","Chambres non-fumeurs","Animaux non admis"]',
  includes = '["Chambre double climatisée","Petit-déjeuner buffet","WiFi"]',
  not_included = '["Taxe de séjour ≈ 1,50 €/pers/nuit, sur place"]',
  cancellation_policy = '[["Jusqu''au 12 août 23 h 59","Annulation GRATUITE"],["Du 13 au 14 août","1 nuit retenue"],["Après / non-présentation","Non remboursable"]]',
  images = '["hotel-mediterranee-1.jpg","hotel-mediterranee-2.jpg"]',
  amenities = '["Petit-déj inclus","WiFi gratuit","Climatisation","Annulation gratuite 48 h"]'
WHERE nuitee_hotel_id = '110000123';

-- Commande voyage canonique : MRS → BCN, 62,35 € À RÉGLER.
-- (18/09, soir) Le « 70,25 € si un agent se déplace » n'existe plus : ni agent, ni frais de déplacement.
-- (20/09) Elle n'est PAS non plus « en ligne » : le rail d'un prestataire tiers a disparu. Elle attend que le
-- voyageur présente le code de son bon — tant qu'aucun bon n'est débité, `channel` et `pay_method` restent NULL,
-- ce qui est la vérité : le moyen n'est pas encore posé. Aucun tender non plus : un tender naît du débit.
INSERT INTO orders (id, ref, user_id, line, status, channel, pay_method, travellers,
                    subtotal_cents, total_price_cents, vat_amount_cents)
VALUES ('00000000-0000-0000-0000-000000000e01', 'CMD-Z6DNX8HV',
        '00000000-0000-0000-0000-000000000001', 'voyage', 'AWAITING_CASH', NULL, NULL, 1,
        6235, 6235, 0);   -- TVA sur marge : calculée côté compta, jamais détaillée client

INSERT INTO payments (order_id, ref, amount_cents, channel)
VALUES ('00000000-0000-0000-0000-000000000e01', 'PEC-Z6DNX8HV', 6235, 'bon');

-- Avance Duffel (fonds de roulement)
INSERT INTO provider_wallets (provider, balance_cents, alert_threshold_cents)
VALUES ('duffel', 500000, 150000);

-- Voyageurs (7 champs Duffel). En prod ils sont CHIFFRÉS AES-256 dès la saisie
-- (service identite) ; ici, valeurs de DÉMO en clair, alignées sur PEC_DATA.profil
-- (« Sofiane M. », titulaire vérifié = voyageur 1, adresse d'encaissement par défaut).
INSERT INTO saved_travelers (id, user_id, title, given_name_enc, family_name_enc, born_on_enc, gender, email_enc, phone_enc)
VALUES ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000001',
        'mr', 'Sofiane', 'M.', '1994-05-12', 'm', 'sofiane.m@email.fr', '+33600000078');

-- Voyageur 1 de la commande voyage MRS → BCN (orders.travellers = 1) = le titulaire,
-- repris du carnet. duffel_passenger_id : renvoyé à l'émission (démo).
INSERT INTO order_travelers (order_id, saved_traveler_id, rank, title,
                             given_name_enc, family_name_enc, born_on_enc, gender, email_enc, phone_enc, duffel_passenger_id)
VALUES ('00000000-0000-0000-0000-000000000e01', '00000000-0000-0000-0000-000000000701', 1, 'mr',
        'Sofiane', 'M.', '1994-05-12', 'm', 'sofiane.m@email.fr', '+33600000078', 'pas_0000DEMO');

-- Les 11 promos (4 modes de voyage, J−45 min, toujours < prix en normal).
-- depart_date = CURRENT_DATE + (semaines PEC_DATA × 7) — toutes ≥ 49 j, conformes J−45.
-- (13/09) « stock » a été renommé `capacity` au lot 8 du 10/09 : le seed ne suivait pas.
INSERT INTO promo_offers (slug, travel_mode, title, detail, nights, price_cents, reference_price_cents, depart_date, capacity, tunnel) VALUES
('cracovie',   'spartiate', 'Cracovie sac au dos',         'Vol A/R + tente équipée en camping aménagé · Pologne · sanitaires + casiers', 5,  7400, 13800, CURRENT_DATE + 63,  8, 'ar'),
('split',      'spartiate', 'Split à la belle étoile',     'Vol A/R + tente bord de mer · Croatie · plage à 200 m, douches chaudes',      4,  8200, 15100, CURRENT_DATE + 70,  6, 'ar'),
('budapestba', 'fute', 'Budapest les yeux fermés',    'Vol A/R + auberge de jeunesse (dortoir 6) · Hongrie · petit-déj inclus',      4,  8900, 15600, CURRENT_DATE + 56, 12, 'ar'),
('lisbonne',   'fute', 'Lisbonne dortoir & soleil',   'Vol A/R + auberge centre-ville (dortoir 4) · Portugal · casier + café',       3,  9900, 17200, CURRENT_DATE + 49,  6, 'ar'),
('porto',      'fute',      'Porto en douce',              'Vol A/R + hôtel 2★ quartier Ribeira · Portugal · chambre double privée',      4, 12900, 19800, CURRENT_DATE + 56,  7, 'vh'),
('seville',    'fute',      'Séville sans se presser',     'Vol A/R + pension andalouse, patio · Espagne · petit-déjeuner inclus',        4, 13900, 21400, CURRENT_DATE + 63,  9, 'vh'),
('marrakech-palace', 'luxe', 'Marrakech en palace', 'Vol direct + riad-palace 5★ avec spa · Maroc · transferts privés', 4, 69000, 94000, CURRENT_DATE + 77, 4, 'vh'),
('santorin-suite', 'luxe', 'Santorin, suite vue caldeira', 'Vol direct + suite 5★ face caldeira · Grèce · piscine privée', 5, 98000, 129000, CURRENT_DATE + 84, 3, 'vh'),
('bucarest',   'confort',  'Bucarest, la belle surprise', 'Vol A/R + hôtel 3★ centre · Roumanie · petit-déjeuner · 7 nuits',             7, 17900, 28500, CURRENT_DATE + 63,  3, 'vh'),
('budapestga', 'confort',  'Budapest côté thermes',       'Vol A/R + hôtel 3★ bord du Danube · Hongrie · thermes à 10 min',              5, 15900, 24600, CURRENT_DATE + 56,  9, 'vh'),
('tirana',     'confort',  'Tirana l''insoupçonnée',      'Vol A/R + hôtel 4★ · Albanie · la Méditerranée sans la foule ni les prix',    5, 18900, 29700, CURRENT_DATE + 77, 10, 'vh');

-- Cockpit marketing (PEC_DATA.commercial, valeurs identiques)

-- (13/09) le CHECK du schéma n'accepte que 'tiktok' | 'meta' | 'snap' | 'geo', en
-- minuscules : « TikTok », « Instagram » et « Snapchat » étaient tous refusés.
INSERT INTO influencer_links (name, network, followers, code, clicks, entries, status) VALUES
('@yasmine.mrs', 'tiktok', '48 k', 'YAS-MRS', 2140, 312, 'actif'),
('@karim_voyage', 'meta', '22 k', 'KAR-VOY', 980, 187, 'actif'),
('@sneak.aix', 'tiktok', '31 k', 'SNK-AIX', 640, 84, 'actif'),
('@leila.plans', 'snap', '15 k', 'LEI-PLN', 210, 29, 'brief');
INSERT INTO flyer_batches (batch_ref, kind, quantity, distributed, place, qr_ref, scans, status) VALUES
('FLY-A3-001', 'Affiche A3 destinations', 200, 200, 'Marseille centre — commerces et halls', 'QR-A3-001', 164, 'distribue'),
('FLY-JEU-002', 'Flyer-jeu (QR concours)', 2000, 1650, 'Marseille centre + Encagnane', 'QR-JEU-002', 388, 'en_cours'),
('FLY-CHEV-003', 'Chevalet QR (salons, événements)', 6, 6, '2 par stand', 'QR-CHEV-003', 92, 'pose');
INSERT INTO ged_assets (ref, name, kind, version, status) VALUES
('GED-001', 'Affiche A3 destinations', 'print', 'v3', 'imprime'),
('GED-004', 'Vidéo 22 s TikTok « billet en cash »', 'video', 'v2', 'en_ligne'),
('GED-006', 'Kit influenceur (brief + mentions légales)', 'doc', 'v2', 'valide'),
('GED-007', 'Pages GEO / FAQ schema.org', 'web', 'v1', 'brouillon');

-- (13/09) `month` ('AAAA-MM', le mois dont la campagne consomme le budget) est NOT NULL
-- au schéma et manquait ici. `creative` référence ged_assets : ces lignes ont été
-- DÉPLACÉES après l'insertion des GED, sans quoi la clé étrangère refuse. GED-005
-- n'existe pas au référentiel — la ligne meta part sans créa plutôt qu'avec une réf morte.
INSERT INTO ad_campaigns (channel, api_ref, month, objective, creative, budget_cents, spent_cents, impressions, clicks, installs, status, ends_on) VALUES
('tiktok', 'tk-conc-08', '2026-08', 'Installs — jeu concours', 'GED-004', 90000, 41200, 184200, 6120, 402, 'active', '2026-08-31'),
('meta',   'ig-conc-08', '2026-08', 'Portée — concours + réassurance', NULL, 60000, 23800, 96400, 2810, 149, 'active', '2026-08-31'),
('snap',   'sn-conc-08', '2026-08', 'Notoriété 18-25 Marseille', NULL, 40000, 9700, 41200, 890, 38, 'paused', '2026-08-31'),
('geo',    NULL, '2026-09', 'Être LA réponse IA « payer un voyage en espèces »', 'GED-007', 0, 0, NULL, 310, 24, 'active', NULL);
INSERT INTO marketing_events (on_day, what, kind) VALUES
(CURRENT_DATE + 1, 'Vague 2 flyers-jeu (350) — marché de Noailles', 'terrain'),
(CURRENT_DATE + 6, 'Story commune 4 influenceurs — J-4', 'influenceur'),
(CURRENT_DATE + 10, 'TIRAGE EN DIRECT — page officielle + réseaux', 'concours');

-- Fournisseur MODE + les 4 articles canoniques
INSERT INTO suppliers (id, name, status, kyb_verified_at, iban_last4, conformity_score)
VALUES ('00000000-0000-0000-0000-000000000f01', 'Chez Awa', 'active', now(), '4412', 96);

-- Référentiel couleurs (HEX + pastille) — aligné sur PEC_DATA.mode.couleurs
INSERT INTO colors (id, code, label, hex, color_family) VALUES
('00000000-0000-0000-0000-0000000c0001', 'ROUGE_FEU', 'Rouge feu', '#C0392B', 'rouge'),
('00000000-0000-0000-0000-0000000c0002', 'BLEU_ROYAL','Bleu royal','#2B4C9B', 'bleu'),
('00000000-0000-0000-0000-0000000c0003', 'EMERAUDE',  'Émeraude', '#0E7A5F', 'vert'),
('00000000-0000-0000-0000-0000000c0004', 'COGNAC',    'Cognac',   '#9A5B2E', 'marron'),
('00000000-0000-0000-0000-0000000c0005', 'NOIR',      'Noir',     '#1A1A1A', 'noir'),
('00000000-0000-0000-0000-0000000c0006', 'BLANC',     'Blanc',    '#EDEDED', 'blanc');

-- Arborescence de catégories (familles + sous-catégories)
INSERT INTO categories (id, parent_id, slug, name, path, depth, position) VALUES
('00000000-0000-0000-0000-0000000a1001', NULL, 'sneakers',            'Sneakers',       'sneakers',            0, 0),
('00000000-0000-0000-0000-0000000a1002', NULL, 'pret-a-porter',       'Prêt-à-porter',  'pret_a_porter',       0, 1),
('00000000-0000-0000-0000-0000000a1003', NULL, 'accessoires',         'Accessoires',    'accessoires',         0, 2),
('00000000-0000-0000-0000-0000000a1101', '00000000-0000-0000-0000-0000000a1001', 'sneakers-lifestyle', 'Lifestyle',  'sneakers.lifestyle',      1, 0),
('00000000-0000-0000-0000-0000000a1102', '00000000-0000-0000-0000-0000000a1001', 'sneakers-montantes', 'Montantes',  'sneakers.montantes',      1, 1),
('00000000-0000-0000-0000-0000000a1201', '00000000-0000-0000-0000-0000000a1002', 'robes',              'Robes',      'pret_a_porter.robes',     1, 0),
('00000000-0000-0000-0000-0000000a1202', '00000000-0000-0000-0000-0000000a1002', 'vestes',             'Vestes & manteaux', 'pret_a_porter.vestes', 1, 1),
('00000000-0000-0000-0000-0000000a1301', '00000000-0000-0000-0000-0000000a1003', 'sacs',               'Sacs',       'accessoires.sacs',        1, 0);

-- Guides de tailles
INSERT INTO size_guides (id, name, system, measures, fit_advice) VALUES
('00000000-0000-0000-0000-0000000a2001', 'Sneakers unisexe EU', 'EU',
 '[{"size":"40","eu":"40","uk":"6.5","us":"7","cm":"25"},{"size":"41","eu":"41","uk":"7.5","us":"8","cm":"26"},{"size":"42","eu":"42","uk":"8","us":"8.5","cm":"26.5"},{"size":"43","eu":"43","uk":"9","us":"9.5","cm":"27.5"}]',
 'Cette paire taille normalement — prends ta pointure habituelle.'),
('00000000-0000-0000-0000-0000000a2002', 'Robes femme FR', 'FR',
 '[{"size":"XS","fr":"34"},{"size":"S","fr":"36"},{"size":"M","fr":"38-40"},{"size":"L","fr":"42"}]',
 'Coupe fluide — taille normalement.');

-- Collection / saison courante
INSERT INTO collections (id, code, label, season, year) VALUES
('00000000-0000-0000-0000-0000000a3001', 'AH2026', 'Automne-Hiver 2026', 'AH', 2026);

INSERT INTO mode_articles (id, slug, supplier_id, name, brand, category, genre, condition, is_new, vat_scheme,
                           defects, invoice_required, authenticated, buy_price_cents, sell_price_cents,
                           ref_price_cents, weight_grams, status, piece_unique, favorites, composition, care) VALUES
('00000000-0000-0000-0000-000000000d01', 'airmax', '00000000-0000-0000-0000-000000000f01',
 'Air Max 97', 'Nike', 'sneakers', 'homme', 'Très bon état', false, 'marge_occasion',
 'micro-usure de la semelle (photo 3)', false, true, 12300, 15000, 24000, 1200, 'valide_publie', true, 57, '[["Tige","mesh · cuir"],["Semelle","caoutchouc · unité air"],["Doublure","textile"]]', 'nettoyée & désinfectée en atelier'),
('00000000-0000-0000-0000-000000000d02', 'jordan', '00000000-0000-0000-0000-000000000f01',
 'Jordan 4', 'Jordan', 'sneakers', 'homme', 'Neuf sans étiquette', false, 'marge_occasion',
 NULL, false, true, 17200, 21000, 32000, 1300, 'valide_publie', true, 29, '[["Tige","cuir · toile"],["Semelle","caoutchouc"],["Doublure","textile"]]', NULL),
('00000000-0000-0000-0000-000000000d03', 'robe', '00000000-0000-0000-0000-000000000f01',
 'Robe de soirée', 'Chez Awa · création', 'pret-a-porter', 'femme', 'Neuf', true, 'tva_20',
 NULL, false, false, 7000, 8500, NULL, 400, 'valide_publie', true, 14, '[["Tissu","satin de coton"],["Doublure","viscose"]]', 'lavage main'),
('00000000-0000-0000-0000-000000000d04', 'sac', '00000000-0000-0000-0000-000000000f01',
 'Sac bandoulière cuir', 'Accessoire', 'accessoires', 'mixte', 'Neuf', true, 'tva_20',
 NULL, false, false, 3700, 4500, NULL, 600, 'valide_publie', false, 8, '[["Extérieur","cuir pleine fleur"],["Doublure","coton"],["Bandoulière","cuir"]]', NULL);

INSERT INTO article_variants (article_id, size, stock) VALUES
('00000000-0000-0000-0000-000000000d01', '42', 1),
('00000000-0000-0000-0000-000000000d02', '43', 1),
('00000000-0000-0000-0000-000000000d03', 'M', 1),
('00000000-0000-0000-0000-000000000d04', 'Unique', 5);

-- Rattachement couleur normalisée (color_id) + libellé dénormalisé (color)
UPDATE mode_articles SET color_id = '00000000-0000-0000-0000-0000000c0001', color = 'Rouge feu'    WHERE slug = 'airmax';
UPDATE mode_articles SET color_id = '00000000-0000-0000-0000-0000000c0002', color = 'Blanc / bleu'  WHERE slug = 'jordan';
UPDATE mode_articles SET color_id = '00000000-0000-0000-0000-0000000c0003', color = 'Émeraude'      WHERE slug = 'robe';
UPDATE mode_articles SET color_id = '00000000-0000-0000-0000-0000000c0004', color = 'Cognac'        WHERE slug = 'sac';

-- Rattachement catégorie (arbre) + guide des tailles + collection
UPDATE mode_articles SET category_id='00000000-0000-0000-0000-0000000a1101', size_guide_id='00000000-0000-0000-0000-0000000a2001', collection_id='00000000-0000-0000-0000-0000000a3001', subcategory='Lifestyle'  WHERE slug='airmax';
UPDATE mode_articles SET category_id='00000000-0000-0000-0000-0000000a1102', size_guide_id='00000000-0000-0000-0000-0000000a2001', collection_id='00000000-0000-0000-0000-0000000a3001', subcategory='Montantes'  WHERE slug='jordan';
UPDATE mode_articles SET category_id='00000000-0000-0000-0000-0000000a1201', size_guide_id='00000000-0000-0000-0000-0000000a2002', collection_id='00000000-0000-0000-0000-0000000a3001', subcategory='Robes'      WHERE slug='robe';
UPDATE mode_articles SET category_id='00000000-0000-0000-0000-0000000a1301', collection_id='00000000-0000-0000-0000-0000000a3001', subcategory='Sacs'       WHERE slug='sac';

-- Axe éditorial : les articles déjà publiés (piece_status valide_publie) sont 'live'.
UPDATE mode_articles SET editorial_status = 'live', published_at = now() WHERE status = 'valide_publie';

-- Galerie par couleur (product_media) — exemple Air Max (couleur Rouge feu) + un média générique
INSERT INTO product_media (article_id, color_id, role, url, alt, position) VALUES
('00000000-0000-0000-0000-000000000d01','00000000-0000-0000-0000-0000000c0001','face',     'photo-airmax.jpg',   'Air Max 97 rouge — face', 0),
('00000000-0000-0000-0000-000000000d01','00000000-0000-0000-0000-0000000c0001','dos',      'photo-airmax.jpg',   'Air Max 97 rouge — dos',  1),
('00000000-0000-0000-0000-000000000d01','00000000-0000-0000-0000-0000000c0001','etiquette','photo-airmax.jpg',   'Air Max 97 — étiquette',  2),
('00000000-0000-0000-0000-000000000d01', NULL,                                  'detail',   'facture.svg',        'Certificat d''authenticité', 3);

-- Code promo édité par le fournisseur (panier canonique : 150 − 10 − 50 = 90)
INSERT INTO supplier_promo_codes (supplier_id, code, kind, value, valid_from, valid_to, article_ids, max_uses, uses)
VALUES ('00000000-0000-0000-0000-000000000f01', 'AWA10', 'euros', 1000,
        CURRENT_DATE - 9, CURRENT_DATE + 22,
        ARRAY['00000000-0000-0000-0000-000000000d01','00000000-0000-0000-0000-000000000d03']::uuid[], 50, 7);

-- Tendances (PEC_DATA.mode.tendances, valeurs identiques)
INSERT INTO brands (name, active_pieces) VALUES ('Nike', 2), ('Jordan', 1), ('Chez Awa', 2), ('Adidas', 0), ('Levi''s', 0), ('Lacoste', 0);
INSERT INTO trend_looks (id, who, role, photo, outfit) VALUES
('00000000-0000-0000-0000-000000000aa1', '@yasmine.mrs', 'Créatrice · 48 k', 'photo-robe.jpg',
 '[{"piece":"Robe","marque":"Maje","prix_boutique_cents":26500},{"piece":"Sac","marque":"Polène","prix_boutique_cents":39000}]'),
('00000000-0000-0000-0000-000000000aa2', 'K.O — artiste', 'Rappeur · Marseille', 'photo-airmax.jpg',
 '[{"piece":"Sneakers","marque":"Nike","prix_boutique_cents":24000},{"piece":"Veste","marque":"Schott","prix_boutique_cents":31000}]');
INSERT INTO look_similars (look_id, article_id, note) VALUES
('00000000-0000-0000-0000-000000000aa1', '00000000-0000-0000-0000-000000000d03', 'l''esprit, en pièce unique'),
('00000000-0000-0000-0000-000000000aa1', '00000000-0000-0000-0000-000000000d04', 'cuir pleine fleur'),
('00000000-0000-0000-0000-000000000aa2', '00000000-0000-0000-0000-000000000d01', 'la même, vérifiée atelier, −38 %'),
('00000000-0000-0000-0000-000000000aa2', '00000000-0000-0000-0000-000000000d02', 'jamais portée');
INSERT INTO collab_drops (name, with_who, spirit, status, drop_on, article_ids) VALUES
('Ligne ANONYME · vol. 1', '@yasmine.mrs × Chez Awa', '8 pièces, culture pop, zéro logo dehors', 'drop_en_cours', 'depuis le 12 août',
 ARRAY['00000000-0000-0000-0000-000000000d03']::uuid[]),
('CASH COURT · capsule', 'K.O × Sneak''Hall', 'Sneakers re-cotées atelier + tee-shirt sérigraphié, série numérotée', 'a_venir', 'drop le 30 août · 20 h',
 ARRAY['00000000-0000-0000-0000-000000000d01','00000000-0000-0000-0000-000000000d02']::uuid[]);

-- Commande MODE « À RÉGLER » : réservée, code émis, MINUTEUR 1 h — le stock est
-- RÉSERVÉ (pas encore décrémenté) : disponible = stock − réservations actives
-- (18/09, soir) l'exemple « JE PAIE AVEC MON BON D’ACHAT » : plus de déplacement, donc plus de frais de déplacement — la
-- commande attend que le client présente le code de son Bon d’achat PayEnCash (canal 'bon').
INSERT INTO orders (id, ref, user_id, line, status, channel, pay_method, travellers,
                    subtotal_cents, discount_cents, gift_card_cents, total_price_cents, vat_amount_cents)
VALUES ('00000000-0000-0000-0000-000000000e03', 'M-1209',
        '00000000-0000-0000-0000-000000000001', 'mode', 'AWAITING_CASH', 'bon', 'bon', 1,
        15000, 1000, 5000, 9000, 0);
INSERT INTO order_items (order_id, kind, mode_article_id, qty, unit_cents, vat_scheme, vat_cents)
VALUES ('00000000-0000-0000-0000-000000000e03', 'mode_article',
        '00000000-0000-0000-0000-000000000d01', 1, 15000, 'marge_occasion', 0);
INSERT INTO stock_reservations (order_id, variant_id, qty, status, expires_at)
SELECT '00000000-0000-0000-0000-000000000e03', v.id, 1, 'active', now() + interval '57 minutes'
FROM article_variants v WHERE v.article_id = '00000000-0000-0000-0000-000000000d01' AND v.size = '42';
-- Compteur reserved synchronisé avec la réservation active (modèle 4 niveaux) :
-- Air Max 42 → stock 1, reserved 1, disponible 0 (la pièce unique est réservée par M-1209).
UPDATE article_variants SET reserved = 1
 WHERE article_id = '00000000-0000-0000-0000-000000000d01' AND size = '42';

-- Commande MODE canonique : Air Max 90 € payés (150 − 10 − 50), reçu B3K-71, suivi MR.
-- (20/09) RÉGLÉE PAR UN BON D’ACHAT, comme toutes les autres : c'est le seul valideur qui reste. Le bon de 90 €
-- émis ci-dessous est débité en entier, et son mouvement 'debit' en est la preuve — la contrainte
-- `valideur_obligatoire` l'exige (method 'bon' + gift_card_id).
INSERT INTO orders (id, ref, user_id, line, status, channel, pay_method, travellers,
                    subtotal_cents, discount_cents, gift_card_cents, total_price_cents, vat_amount_cents)
VALUES ('00000000-0000-0000-0000-000000000e02', 'M-1208',
        '00000000-0000-0000-0000-000000000001', 'mode', 'PAID', 'bon', 'bon', 1,
        15000, 1000, 5000, 9000, 0);  -- marge_occasion : TVA sur marge, non détaillée

INSERT INTO order_items (order_id, kind, mode_article_id, qty, unit_cents, vat_scheme, vat_cents)
VALUES ('00000000-0000-0000-0000-000000000e02', 'mode_article',
        '00000000-0000-0000-0000-000000000d01', 1, 15000, 'marge_occasion', 0);

-- LE BON QUI A RÉGLÉ CETTE COMMANDE : vendu au comptoir du Tabac du Port trois jours plus tôt, épuisé depuis
-- (solde 0). Il porte le compte de la cliente : un bon anonyme rejoint le compte au PREMIER usage.
INSERT INTO gift_cards (id, code_masque, code_hash, origin, partner_id, face_value_cents, balance_cents,
                        ticket_number, issued_by, issued_at, expires_at, user_id)
VALUES ('00000000-0000-0000-0000-000000000f02', '••••-••••-3M8P', 'seed-hash-bon-m1208', 'partner',
        '00000000-0000-0000-0000-000000000b01', 9000, 0,
        'BV-' || lpad(nextval('gift_cards_ticket_seq')::text, 6, '0'), 'gerant@tabacduport.fr',
        now() - interval '3 days', now() - interval '3 days' + interval '12 months',
        '00000000-0000-0000-0000-000000000001');
INSERT INTO gift_card_movements (gift_card_id, kind, amount_cents, by_who)
VALUES ('00000000-0000-0000-0000-000000000f02', 'issue', 9000, 'gerant@tabacduport.fr');

INSERT INTO payments (order_id, ref, amount_cents, collected_amount_cents, channel, method,
                      gift_card_id, collected_at, receipt_code)
VALUES ('00000000-0000-0000-0000-000000000e02', 'PEC-M1208PAY', 9000, 9000, 'bon', 'bon',
        '00000000-0000-0000-0000-000000000f02', now() - interval '3 days', 'B3K-71');

-- LE DÉBIT : la preuve du règlement. Écrit dans la même transaction SQL que le paiement, jamais après coup.
INSERT INTO gift_card_movements (gift_card_id, kind, amount_cents, order_ref, at, by_who, user_id)
VALUES ('00000000-0000-0000-0000-000000000f02', 'debit', 9000, 'M-1208', now() - interval '3 days',
        'client', '00000000-0000-0000-0000-000000000001');

INSERT INTO payment_tenders (payment_id, method, amount_cents, status, voucher_ref)
SELECT id, 'bon', amount_cents, 'captured', '00000000-0000-0000-0000-000000000f02'
  FROM payments WHERE ref = 'PEC-M1208PAY';

-- Retour exemple (process mode/13) : M-1208, remboursement en AVOIR (jamais en espèces — Mode)
INSERT INTO mode_returns (order_item_id, reason, refund_method, status, label_ref, refund_cents, restock)
SELECT oi.id, 'La taille ne va pas', 'avoir', 'etiquette_emise', 'RET-M-1208', 9000, NULL
FROM order_items oi WHERE oi.order_id = '00000000-0000-0000-0000-000000000e02' LIMIT 1;

-- Commande M-1208 : vente PASSÉE déjà engagée (expédiée) — idempotence : stock_committed.
UPDATE orders SET stock_committed = true WHERE ref = 'M-1208';

INSERT INTO purchase_orders (id, order_id, supplier_id, article_id, buy_price_cents)
VALUES ('00000000-0000-0000-0000-000000000a91', '00000000-0000-0000-0000-000000000e02',
        '00000000-0000-0000-0000-000000000f01', '00000000-0000-0000-0000-000000000d01', 12300);

INSERT INTO supplier_invoices (supplier_id, purchase_order_id, amount_cents, due_at)
VALUES ('00000000-0000-0000-0000-000000000f01', '00000000-0000-0000-0000-000000000a91',
        12300, now() + interval '7 days');

INSERT INTO shipments (order_id, mr_ref, relay_name, relay_address, pickup_code, status)
VALUES ('00000000-0000-0000-0000-000000000e02', 'MR-8412007312',
        'Presse de la Poste', '8 pl. du Marché', 'B3K-71', 'in_transit');

-- Lien influenceur (fournisseur/06-partage)
-- (13/09) `clicks` et `attributed_sales` ne sont plus des colonnes de share_links : les
-- retombées se COMPTENT sur share_link_events (une ligne par clic, par vente, par
-- retrait) — c'est ce qui rend une attribution contestable... et défendable.
INSERT INTO share_links (id, supplier_id, article_id, slug, network)
VALUES ('00000000-0000-0000-0000-000000000f11', '00000000-0000-0000-0000-000000000f01',
        '00000000-0000-0000-0000-000000000d03', 'robe-soiree-awa', 'whatsapp');
INSERT INTO share_link_events (share_link_id, slug, kind, supplier_id, article_id, network)
SELECT '00000000-0000-0000-0000-000000000f11', 'robe-soiree-awa', 'clic',
       '00000000-0000-0000-0000-000000000f01', '00000000-0000-0000-0000-000000000d03', 'whatsapp'
FROM generate_series(1, 212);
