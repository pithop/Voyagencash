# Complément de modèle de données & API — Août 2026
### AJEK SASU / PayEnCash — « constructible sans oubli »

> Issu de l'**audit de constructibilité** (simulation du parcours de commande, client + agent + manager + argent). Complète l'Étape 6 (`ESPACE-COMMERCANT/documents/partie-6-donnees.html`) (schéma), `docs/03-api-specs.html` (API) et `docs/09-espace-manager.html` (écrans) pour les décisions d'août 2026. Réfère à `NOUVELLES-FONCTIONNALITES` et à l'Étape 4 · flux F11/F12. *(18/09, soir : deux des notes de référence d'origine, `LOGISTIQUE-AGENT-2026-08` et `AGENT-CAISSE-MOBILE-RH`, ont été supprimées du dépôt avec le poste qu'elles décrivaient.)*
> **Types indicatifs** ; à figer avec le dev. **Points fiscaux/RH/juridiques à valider** (expert-comptable, juriste, avis LCB-FT).
>
> ---
>
> **⚠️ BANDEAU DU 2026-09-18 (soir) — LA MOITIÉ DE CE COMPLÉMENT EST CADUQUE. À NE PAS CONSTRUIRE.**
> Ce document proposait des tables **à créer** ; beaucoup ne l'ont jamais été, et **ne doivent plus l'être** : l'**agent de caisse mobile est supprimé** (avec lui le cash, les courses, le dispatch, le planning, la paie, la flotte, le fond de caisse), et le **point de collecte** l'était déjà depuis le 17/09.
> **Sont CADUQUES, en entier : §2.2** (fond de caisse, pourboires, primes) · **§2.3** (RH de l'agent) · **§2.4** (dispatch & planning) · **§2.8** (flotte & assurances) · **§2.11** (points de collecte) · **§2.13** (preuve de restitution en espèces) · et, au **§1**, les colonnes `collection_slot`, `declared_position`, `position_confirmed_at`, `booking_urgency`, `expected_payment_note`, `fulfillment_mode`, `collection_point_id`, `pickup_slot_id`.
> **Restent valables : §2.1** (conformité) · **§2.5** (comptabilité de gestion) · **§2.7** (plateforme, sauf `internal_messages`) · **§2.9** (commercial) · **§2.10** (ligne Mode) · et, au §1, `product_line` et `scheduled_at`.
> **Le schéma qui fait foi est `server/db/schema.sql`** — **125 tables** au 18/09 au soir, après suppression de 27 tables emportées par l'agent. Vérifier là, jamais ici, qu'une table existe. **Le nouveau domaine — le Bon d’achat PayEnCash — y est déjà** : `partners`, `partner_cards`, `partner_charges`, `gift_cards`, `gift_card_movements`, `signature_links`, `payment_tenders` (`method` = `bon` — **plus de `cash` ni de `card`, et plus de moyen en ligne depuis le 20/09**). Le relevé mensuel du commerçant **n'est pas une table** : c'est la vue `v_partner_monthly_statements`, parce qu'un relevé se calcule et ne se stocke pas. Et `partner_remittances` / `partner_remittance_receipts` **n'existent pas** — le reversement mensuel est abandonné au profit d'un **prélèvement carte à chaque vente** (Stripe).

## 0. Ce qui est DÉJÀ complet (constructible tel quel — ne pas retoucher)

Recherche/comparateur · sélection vol+hôtel (Duffel/Hotelbeds, `flight_offers`/`stay_offers`) · voyageurs (`order_travelers`, chiffrés) · génération du code (`payments`: barcode + `security_code_hash` + montant TTC figé) · suivi live (`collection_tracking_events`, WS/SSE) · collecte (scan + code + photo, idempotence sur `collections.id`) · paiement fournisseur Phase 5 (`supplier_bookings`, Duffel solde / Hotelbeds post-payé) · notation (`agent_ratings`) · **chaîne de dépôt Cash Services** (`deposit_cards`, `agent_deposits`, `bank_report_imports`, `bank_deposit_transactions`, `treasury_transfers`, seuil 400 € via `agents.cash_on_hand_cents`).

> **(18/09, soir)** De cette liste d'août, **ne subsistent au schéma** que `flight_offers`, `hotel_offers`, `order_travelers`, `payments`, `supplier_bookings` et `order_ratings`. Le suivi live, la collecte et **toute la chaîne de dépôt** ont été supprimés avec l'agent : les six dernières tables citées n'existent plus. Le règlement d'une commande passe désormais par `payments` + `payment_tenders` + `psp_transactions` (notification du prestataire) ou par le débit d'un `gift_cards` (`gift_card_movements`).

---

## 1. Colonnes à AJOUTER à `orders`

| Colonne | Type | Rôle |
|---|---|---|
| `product_line` | enum(`travel`,`fashion`) | **Discriminant ligne Voyage/Mode** — sans lui, pas de commande Mode ni KPI « collecté Mode » ni TVA cloisonnée. **P4, structurant.** |
| `collection_slot` | jsonb/enum | Créneau de collecte choisi (dans l'heure / après-midi / demain…) + niveau d'urgence (§13). |
| `scheduled_at` | timestamptz | *(déjà présent)* — commande planifiée « plus tard ». |
| `declared_position` | text null | Position future déclarée par le client, ou NULL = « ne sait pas encore » (§14). |
| `position_confirmed_at` | timestamptz null | Horodatage de la confirmation de position (rappel 30 min). |
| `booking_urgency` | int | ~~Poids d'urgence de réservation pour le dispatch.~~ **CADUC (18/09, soir)** : plus de dispatch. *(La volatilité du prix vol, elle, reste un vrai sujet — elle se traite par la marge de sécurité et la stratégie de re-fetch de `docs/04-pricing.html`, seul document qui la porte désormais.)* |
| `expected_payment_note` | text null | Coupure annoncée par le client → préparation du rendu-monnaie (§12). |
| `fulfillment_mode` | enum(`home`,`pickup_point`) | Option d'encaissement (§17) — domicile (frais de déplacement) ou point de collecte (sans frais). |
| `collection_point_id` | fk null → `collection_points` | Point de collecte choisi (si `pickup_point`). |
| `pickup_slot_id` | fk null → `collection_slots` | Créneau de présence réservé (si `pickup_point`). |

---

## 2. Tables à CRÉER (avec relations)

### 2.1 Conformité
- **`kyc_checks`** — `id, user_id→users, level(standard|renforced), status, provider(pvid), triggered_by(3_purchases|1000e_7d), result_ref, checked_at`. + compteur glissant (3 achats OU 1 000 €/7 j) calculé sur `orders`/`users`. Gate à `POST /orders/{id}/payment-code`.
- **`suppliers`** — `id, type(duffel|hotelbeds|fashion_partner), name, siret null, kyb_status, created_at`.
- **`kyb_checks`** — `id, supplier_id→suppliers, siret, activity_declared, invoice_conform, provenance_guarantee, status, checked_at`.

### 2.2 ~~Cash & rémunération~~ — **CADUQUE (18/09, soir)** : plus de fond de caisse, plus d'espèces, plus de salarié en contact avec la clientèle, donc plus de pourboire ni de prime à encadrer. *Le seul cadre social qui survit (PPV, prime indexée interdite) est recueilli au §5 de `PLAN-MAITRISE-RISQUES-2026-08.md`.* **Ne créer aucune de ces tables.**
- **`cash_floats`** — `id, agent_id→agents, nominal_cents(≈10000), assigned_at, active`. Fond de caisse ~100 €, **hors** seuil 400 €, **hors** dépôt.
- **`float_checks`** — `id, cash_float_id→cash_floats, service_session_id→service_sessions, phase(start|end), counted_cents, manager_id, discrepancy_cents, checked_at`.
- **`tips`** — `id, order_id→orders, agent_id→agents, amount_cents, method(cash|card), declared_dsn_at`. **Exclu** du prix, du dépôt et de la TVA. Exonération vérifiée (< 1,6 SMIC).
- **`bonuses`** — `id, agent_id→agents, type(ppv), amount_cents, criteria, period, exoneration_regime, created_at`. Contrôles : plafond 3 000/6 000 €, régime < 3 SMIC / < 50 sal. / date < 31/12/2026, alerte piège RGDU.
- **`quality_bonuses`** — `id, agent_id→agents, period, avg_rating, amount_cents (soumis cotisations+IR)`.
- **`loyalty_rewards`** — `id, order_id→orders, user_id→users, amount_cents(150), choice(pourboire|remise_prochaine)`. Mécanisme 1,50 € (version conforme).

### 2.3 ~~RH — agent de caisse mobile~~ — **CADUQUE (18/09, soir)** : le poste est supprimé. **Ne créer aucune de ces tables.**
- **`applications`** — `id, candidate {nom, contact}, cv_url, cni_url, aptitudes, vehicle, availability, status(candidature_reçue|session_planifiée|entretien_réalisé|embauché|non_retenu)`.
- **`recruitment_sessions`** — `id, date, mode(présentiel|visio), candidates[], result`. *Tout candidat invité.*
- **`job_positions`** — `id, title('agent de caisse mobile'), description`.
- **`contracts`** — `id, agent_id→agents, type(cdi_35h|cdi_25h|cdd…), hours, mission_encaissement(true), no_pecuniary_liability(true), convention_collective(À DÉTERMINER), signed_at`.
- **`equipment_handovers`** — `id, agent_id→agents, items[carte, fond_caisse, casque, gants, gilet, véhicule, smartphone, tenue], signed_at, returned_at`.
- **`service_sessions`** — `id, agent_id→agents, started_at, ended_at, source(app|phone)`. Pointage arrivée/fin.
- **`shift_checklists`** — `id, service_session_id→service_sessions, items{carte_présente, fond_caisse_ok, batterie, gants, éclairage}, manager_validated_at`. **Bloque la mise en ligne si incomplet.**
- **Colonnes à confirmer sur `agents`** : `hired_at, habilitation_at, offboarded_at` — **PAS de `employment_kind`** : l'agent est **toujours salarié** (D11 rév.), un discriminant qui ne peut prendre qu'une seule valeur est une colonne morte (aligné sur le GLOSSAIRE). **Supprimer définitivement** tout `employment_type=contractor`, `commission_rate`, `vat_*`, `self_billing_*` (déjà purgés en surface).

### 2.4 ~~Dispatch & planning~~ — **CADUQUE (18/09, soir)** : plus de course à affecter, plus de zone, plus de créneau à planifier. **Ne créer aucune de ces tables.**
- **`standby_points`** — `id, zone_id→collection_zones, coordinates, capacity`.
- **`dispatch_config`** — `id, zone_id null, max_radius, max_concurrent, reassign_timeout, urgency_weight, deposit_threshold_cents(40000, PARAMÉTRABLE), cash_cap_cents(zone/agent)`.
- **`agent_availability`** — `id, agent_id→agents, slot_start, slot_end`.
- **`shifts`** — `id, agent_id→agents, start, end, night(bool)`. Contraintes légales (durées, repos 11 h, nuit).
- **`demand_forecast`** — `id, zone_id→collection_zones, hour, expected_orders`.

### 2.5 Comptabilité de gestion
- **`ledger_entries`** — `id, date, amount_cents, direction(recette|dépense), result_class(exploitation|financier|exceptionnel), category, source_ref`. Agrégation → **compte de résultat** + **position bénéficiaire/déficitaire** en direct. Règles : TVA collectée ≠ revenu ; prix fournisseur transite ; seule la marge AJEK = produit.

### 2.6 Config tarifaire
- **`collection_fee_config`** — AJOUTER une composante **`urgence/créneau`** (aujourd'hui : fixe/%/per_km/nuit). Le `service_fee_cents` figé = somme des composantes actives.

### 2.7 Plateforme
- **`call_logs`** — `id, manager_id, target(agent|client), target_id, motif(relance_depot|incident|sav…), status, duration, recording_ref null`. Numéros masqués.
- **`message_templates`** — `id, channel(sms|email|push), key(code, checkin_reminder, collecte_window…), body`.
- **`notification_consents`** — `id, user_id→users, channel, purpose(marketing/offres), opt_in, at, revoked_at`. (Distinct de `user_consents` RGPD.)
- **`satisfaction_surveys`** — `id, order_id→orders, user_id→users, score, comment, at`.
- **`internal_messages`** — `id, from, to, content, read_at`. Messagerie temps réel agent↔manager.
- ~~**`push_tokens`** — table à créer~~ → **TRANCHÉ le 2026-08-04 : on garde le modèle COLONNE.** `users.push_token` (et `agents.push_token`) existent déjà et fonctionnent : **un jeton par compte, un appareil**. C'est suffisant au lancement. La table `push_tokens` (plusieurs appareils par personne) est **différée** ; si le multi-appareils devient nécessaire, il faudra la créer **et supprimer les colonnes le même jour** — les deux modèles ne doivent jamais coexister, sinon les notifications partent sur un seul appareil pendant qu'on croit en gérer plusieurs.

### 2.8 ~~Flotte & assurances~~ — **CADUQUE (18/09, soir)** : plus de véhicule en mission ; les polices « vol d'espèces sur la personne », « auto mission » et « faute inexcusable » n'ont plus d'objet. **Ne créer aucune de ces tables.**
- **`fleet_vehicles`** — `id, type(scooter|trottinette|voiture), identifier, agent_id→agents null, status, maintenance_at`.
- **`insurance_policies`** — `id, kind(rc_pro|rc_exploitation|vol_especes|auto_mission|faute_inexcusable), reference, coverage, renewal_at`. **Assurance SOCIÉTÉ** (à ne pas confondre avec la RC pro micro, supprimée).

### 2.9 Commercial
- **`abandoned_orders`** — `id, order_id→orders (DRAFT non finalisé), abandoned_at, step`.
- **`commercial_callbacks`** — `id, source(abandon_tunnel|autre), abandoned_order_id null, scheduled_at, operator, status(à_rappeler|planifié|rappelé|converti|perdu), result`. (Vérifier Bloctel.)

### 2.10 Ligne MODE (chantier produit distinct — voir l'Étape 4 · flux F11/F12 (`ESPACE-COMMERCANT/documents/partie-4-flux.html`))
- **`partners`** (vendeuses) — `id, siret, boutique, kyb_status, contrat_fourniture, contrat_promotion, provenance_guarantee`.
- **`mode_articles`** — `id, partner_id→partners, description, price_cents, provenance, register_ref`.
- **`mobile_objects_register`** — `id, article_id→mode_articles, seller_identity, description, date`. Registre 321-7, alimenté à chaque achat.
- **`shipments`** — `id, order_id→orders, carrier, mr_ref, label_url, relay_id, pickup_code, status` (miroir de `shipments` dans `server/db/schema.sql`).
- **Flux de factures** (2 temps + promotion) — `purchase_invoices` (partenaire→AJEK, après encaissement), `sale_invoices` (AJEK→client, à l'expédition), `promotion_invoices` (partenaire→AJEK, séparé, jamais compensé). Régime TVA (marge/standard) par commande.

### 2.11 ~~Points de collecte~~ — **CADUQUE (17/09, confirmée le 18/09 au soir)** : plus de point, et plus d'agent pour y être présent. **Ne créer aucune de ces tables.**
- **`collection_points`** — `id, label, coordinates, cash_services_borne_ref (borne à proximité), slot_capacity(4-6), active`. Lieu de retour d'agent, près d'une borne Cash Services (dépôt immédiat).
- **`collection_slots`** — `id, collection_point_id→collection_points, slot_start, slot_end, capacity(≤6), agent_id→agents null, reserved_count`. Créneaux horaires de présence ; **plafond 4-6 clients**.

### 2.13 ~~Remboursements & preuve de restitution~~ — **CADUQUE (18/09, soir)**

> **(18/09, soir)** Tout cet appareil de preuve (code de remise, photo du reçu, agent, horodatage) servait à **attester une remise d'espèces**. Il n'y a plus de remise d'espèces : un remboursement **re-crédite le Bon d’achat PayEnCash** (`gift_card_movements`) ou passe par le crédit compte client / un virement. La preuve est le mouvement lui-même, inscrit en `append-only` — il n'y a plus rien à photographier.

Le canal est tranché : **avoir proposé**, ou **remise en espèces au point d'encaissement de droit**.
Il fallait encore **prouver la remise** — la collecte a son appareil de preuve (code de sécurité +
photo), la restitution n'en avait aucun. Elle en a un désormais, **symétrique**.

- **`refunds`** — `id, order_id→orders, payment_id→payments null, component(flight|stay|fashion_item|service_fee|package), amount_cents, method(credit_note|cash_at_pickup), status(pending|ready_for_pickup|handed_over|credited|expired|cancelled), collection_point_id→collection_points null, collection_slot_id→collection_slots null, handover_code_hash, handover_code_sent_at, handed_over_at, handed_over_by_agent_id→agents null, proof_photo_url, receipt_number, requested_at, created_at`.

**Pourquoi une table et non des colonnes sur `payments`.** Un remboursement se fait **composante par
composante** (D2 rév. : vol et hôtel ont des *cancellation policies* distinctes), donc plusieurs
remises peuvent avoir lieu à des moments différents pour une même commande. Une preuve par
événement ne tient pas dans un jeu de colonnes uniques. `payments.refunded_amount_cents` devient
un **cumul dérivé** : `SUM(refunds.amount_cents)` sur les lignes en `handed_over` ou `credited`.

**Le code change de sens — c'est le point important.** À la collecte, PayEnCash génère un code, le
donne au **client**, et le client le montre à l'agent : le code prouve que le client **consent à
payer**. À la restitution, le mécanisme est identique mais le sens s'inverse : le client ne donne
son `handover_code` **qu'une fois les espèces en main**. Le code cesse d'être une autorisation pour
devenir un **reçu**. Conséquence concrète : un agent ne peut pas valider une remise qui n'a pas eu
lieu, puisqu'il ne connaît pas le code — seul le client le détient.

**Contraintes applicatives** (à faire respecter par le code, pas seulement par convention) :

| Condition | Exigence |
|---|---|
| `method = 'cash_at_pickup'` | `collection_point_id` et `collection_slot_id` **NOT NULL** dès `ready_for_pickup` |
| passage à `handed_over` | `handover_code_hash` vérifié, `proof_photo_url`, `handed_over_by_agent_id` et `receipt_number` **tous NOT NULL** — aucun des quatre n'est optionnel |
| `method = 'credit_note'` | **aucune** colonne de preuve physique : il n'y a pas de remise de main à main, la traçabilité est interne. Statut cible `credited`, pas `handed_over` |
| tout statut | `amount_cents > 0` — un remboursement nul ne se matérialise pas en ligne, il s'affiche comme « non remboursable » (D2 rév.) |

**`receipt_number` n'est pas décoratif.** Un remboursement est un **mouvement de caisse**, au même
titre qu'un encaissement : il doit produire une **entrée numérotée séquentiellement** dans le
logiciel de caisse certifié (art. 286-I-3° bis du CGI). Un compteur séquentiel ne se rattrape pas
après coup — c'est à câbler avant la première restitution, pas après.

**`proof_photo_url`** suit le même régime que `payments.proof_photo_url` : bucket sécurisé,
**rétention bornée** (Doc 5 / RGPD). Elle photographie le **reçu numéroté de restitution**, pas le
client.

> **⚠️ Annotation du 2026-08-04 — ce paragraphe reste tel qu'écrit le 2026-08-03 ; ce qui suit le complète et, sur trois points, le corrige.** La référence de la table a été portée au **Doc 2** (l'Étape 6 (`ESPACE-COMMERCANT/documents/partie-6-donnees.html`), section `refunds`) : c'est lui qui fait foi désormais. Le détail des arbitrages est au registre, §3 bis B.
>
> **① `package` est une composante — cinq valeurs (révisé le 2026-08-04).** Une première décision du 2026-08-04 excluait `package` des composantes ; la révision du même jour la réintègre. La *catégorie* d'une commande dit ce qui a été vendu, la *composante* ce qui est rendu. Le remboursement d'une commande `package` est **une seule remise en espèces** : montant = `orders.refund_due_cents` (le total dû), **un seul code de remise, un seul reçu**, une seule ligne `refunds` de composante `package`. Il n'est **plus ventilé en deux lignes** (`flight` + `stay`) : la justification « les *cancellation policies* vol et hôtel diffèrent » ne commande plus deux remises, car `orders.refund_due_cents` est déjà calculé au flip en tenant compte de chaque composante. La colonne `supplier_bookings.refund_due_cents`, qui portait la part par composante, **est supprimée**. Le passage 2.13 ci-dessus (« composante par composante, plusieurs remises pour une même commande ») est **caduc sur ce point** : l'unicité sur `(order_id, component)` garantit qu'une commande `package` ne porte qu'une remise `package`. La liste des composantes compte donc **cinq valeurs** : `flight`, `stay`, `fashion_item`, `service_fee`, `package`.
>
> **② Il n'y a PAS d'avoir (révisé le 2026-08-04).** L'arbitrage du 2026-08-03 proposait un avoir ; la révision du 2026-08-04 le retire. Un seul canal : la remise en espèces au point d'encaissement. Conséquence sur le schéma (qui fait foi au **Doc 2** désormais) : la table `refunds` **n'a pas de colonne `method`** ni de statut `credited`/`pending` (ils n'existaient que pour l'avoir). La définition en tête de ce paragraphe, avec `method(credit_note|cash_at_pickup)` et ces statuts, est donc **caduque** — se reporter au Doc 2, section `refunds`.

>
> **③ La séquence de caisse a un nom : `cash_receipt_seq`**, partagée avec le futur reçu d'encaissement, `NO CYCLE`. Le numéro se tire **à l'intérieur** de l'écriture conditionnelle qui passe la ligne à `handed_over`, jamais avant : une tentative perdue ne doit consommer aucun numéro, sans quoi la séquence se troue à chaque course concurrente.
>
> **S'ajoutent deux éléments que ce paragraphe ne portait pas** : une **unicité** sur `(order_id, component)` limitée aux lignes vivantes — donc une composante ne donne qu'**une** remise — et la liste des états de commande qui ouvrent un remboursement : **`FAILED` et `CANCELLED`**, `PARTIAL` étant supprimé de l'énumération cible par le Doc 2 (D8 rév.).

### 2.12 Trésorerie / fonds de roulement (logique, pas une table neuve)
Le **solde prépayé Duffel** (`provider_wallets` type Duffel) est **avancé par le fonds de roulement** et **rechargé** par les fonds `on_account` (`treasury_transfers`). Prévoir un **indicateur de couverture** (solde Duffel vs. engagements Phase 5 en cours) et une **alerte de solde bas** (déjà partiellement présente). Hotelbeds = post-payé (pas de solde à porter).

---

## 3. Endpoints à AJOUTER (familles)

- **Créneau/planif/position** : `PATCH /orders/{id}/collection` (créneau, maintenant/plus tard, position) ; job `confirm-position-30min` + `POST /orders/{id}/confirm-position`.
- **Points de collecte (§17)** : `GET /collection-points?near={lat,lng}` ; `POST /orders/{id}/fulfillment` (`home` | `pickup_point` + `collection_point_id` + `pickup_slot_id`) ; `/manager/collection-points/*` (CRUD, capacité 4-6, planning des créneaux de présence).
- **KYC/KYB** : `POST /manager/customers/{id}/kyc` + retour PVID ; `POST /manager/suppliers/{id}/kyb`.
- **Collecte enrichie** : payload `POST /collections/{id}/collect` + rendu-monnaie + pourboire ; `POST /orders/{id}/tip`.
- **Cash** : `POST /manager/agents/{id}/deposit-card` (remise/révocation — **P0, débloque la 1re collecte**) ; `GET /treasury/reconciliation-gaps` ; `PUT /manager/dispatch-config` (seuil paramétrable).
- **RH** : `POST /manager/applications`, `/recruitment-sessions`, `/agents/{id}/hire`, `/habilitate`, `/service-sessions` (pointage), `/service-sessions/{id}/checklist`, `/equipment-handovers`.
- **Paie/primes** : `/manager/agents/{id}/bonuses` (PPV), `/quality-bonuses`.
- **Compta** : `GET /manager/accounting/income-statement` (compte de résultat, position).
- **Plateforme** : `/manager/telephony/call`, `/manager/communications/send` (SMS/e-mail) + gabarit `checkin_reminder`, `/manager/crm/*`, `/manager/consents`, `/manager/fleet/*`, `/manager/insurance-policies`, `/manager/sales-callbacks/*`, messagerie `/messages`.
- **Mode** : commande mode, KYB partenaire, registre 321-7, Mondial Relay, factures 2 temps.
- **Remboursements (§2.13)** : `POST /me/orders/{id}/refund` — *annoté le 2026-08-04 : le chemin écrit ici était `/orders/{id}/refund`, raccourci d'écriture ; tout le corpus préfixe `me/` les actions d'un client sur sa propre commande, et le préfixe dit l'autorisation. Spécifié au Doc 3 §4 ter* — (le remboursement est une remise en espèces au point d'encaissement, avec réservation d'un point et d'un créneau (un seul canal, pas d'avoir)) ; `GET /agents/me/refunds` (les restitutions à remettre pendant un créneau de présence) ; `POST /refunds/{id}/handover` (**code de remise + photo du reçu numéroté** — refus en `422` si l'un des deux manque, exactement comme la validation de collecte) ; `GET /me/refunds` (suivi client + rappel du code).
- **À RETIRER** : `/orders/{id}/arrived` (vestige), `/webhooks/payrexx`, `/relay-points/*`, `/me/orders/{id}/refund-iban` (le virement est écarté — clients non bancarisés) — **retiré le 2026-08-04**.

---

## 4. Écrans manager — MAQUETTÉS ✅ (back à câbler)

> Les 5 écrans sont désormais maquettés dans `ui/manager/` (`21-compte-resultat` → `25-mode`) et ajoutés à la navigation. Il reste à câbler leurs **données/endpoints** (§2/§3).

1. **Compte de résultat** — recettes/dépenses par classe (exploitation/financier/exceptionnel), position bénéficiaire/déficitaire en direct.
2. **Flotte & assurances** — véhicules, affectation, entretien, polices.
3. **Appels commerciaux** — silos, relance abandon tunnel, pipeline.
4. **Planning** — rota, disponibilités, prévision, alertes durées légales, pointage.
5. **Ligne Mode** — commandes mode, KYB partenaires, registre 321-7, factures 2 temps.
*(Recrutement/session, téléphonie, CRM/consentement, KYC fiche client = déjà maquettés dans `05-agents`/`09-appels`/`16-communications`/`18-fiche-client` ; il manque surtout leur back.)*

---

## 5. Décisions & écarts

- **⚠️ DÉCISION REQUISE — remboursement** : client non bancarisé → virement pas toujours possible ; « course de retour cash » contredit « l'agent ne fait qu'encaisser ». À trancher avant de câbler `docs/07` et `11`. Par défaut : **NON REMBOURSÉ** si le fournisseur ne rembourse pas.

> ✅ **ARBITRÉ LE 2026-08-03 — réponse apportée après la rédaction de ce document.** Le canal est l'**remise en espèces au point d'encaissement**, ou la **remise en espèces au point d'encaissement**, *de droit*. Le **virement est écarté** : les clients sont réellement non bancarisés. La **course de retour cash au domicile est écartée** : rapporter des espèces n'est ni encaisser ni déposer, et le poste de l'agent reste borné à ces deux gestes (D11 rév.) — le client se déplace, l'agent ne transporte rien. le remboursement est une remise en espèces au point d'encaissement (table `refunds`, un seul canal) ; `collections.is_return` n'a plus de mécanisme derrière lui. Voir §3 bis B du registre de décisions. *(tranché le 2026-08-04 : code de remise + photo du reçu numéroté + agent + horodatage, table `refunds` — `MODELE-DONNEES-COMPLEMENT` §2.13)*

- **⚠️ À confirmer juridiquement** : non-assujettissement LCB-FT ; convention collective + contrats ; PPV/pourboires (expert-comptable).
- **Écarts de portage à retirer (pas des oublis)** : bloc « Frais prestataire de paiement » (ConfigEditor), indicateur « Coût prestataire », solde Hotelbeds affiché (cible = post-payé) — déjà tracés dans `docs/09`.

---

## 6. Ordre de construction conseillé

**P0 (débloque l'argent/opérations)** : endpoint carte de dépôt · `cash_floats`/`float_checks` · `tips` · config circuit cash · `reconciliation-gaps`.
**P1 (pilotage/conformité)** : `ledger_entries` + Compte de résultat · KYC gradué · KYB · décision remboursement.
**P2 (RH salariés)** : tables RH + endpoints embauche/habilitation/pointage/check-list · `bonuses`/`quality_bonuses`.
**P3 (plateforme/logistique)** : flotte+assurances · silos commerciaux · planning/dispo · téléphonie/messagerie/consentements.
**P4 (ligne Mode)** : `orders.product_line` + tables mode + double flux factures + écran.
