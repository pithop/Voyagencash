# PayEnCash — Serveur (microservices, prêt CapRover)

**Objectif : le développeur n'a rien à écrire — il branche.** Tout le métier des
Étapes 2/4/6/7 est déjà codé : grille de prix, TVA par régime, prélèvement du
partenaire à la vente, plafonds du Bon d’achat. Le front maquette (PEC_DATA) et le seed
portent **les mêmes montants au centime** : basculer sur l'API ne change aucun
chiffre affiché.

## Démarrer en local (2 commandes)

```bash
cd server
docker compose up --build
```

- La base PostgreSQL 16 se crée avec `db/schema.sql` + `db/seed.sql` (scénario canonique).
- La passerelle écoute sur `http://localhost:8080` et route par préfixe :
  `/promos`, `/mode`, `/encaissement`, `/voyage`, `/fournisseurs`, `/identite`, `/reporting`, `/bons`.
  *(18/09, au soir : `/logistique` a disparu avec l'agent de caisse mobile — plus d'encours, plus de dépôts d'espèces.)*

Vérification express :

```bash
curl http://localhost:8080/promos/promos       # les 9 promos, 4 modes
curl http://localhost:8080/mode/articles/airmax  # la fiche produit : variant_matrix, price_cents 15000, médias, JSON-LD
```

> *(18/09, au soir)* **Il n'y a pas de route `POST /mode/cart/price`** — ce README en documentait une qui n'a jamais
> existé, et `test/k6-charge.js` l'appelait. Le prix d'un panier (remise, part réglée par Bon d'achat, TVA composée)
> se calcule dans `lib/money.js` + `lib/fiscalite.js`, **testés à sec par `npm test`** ; côté HTTP, le panier n'est
> pas une ressource : le service `mode` expose la fiche produit, la réservation et la confirmation de stock. Le
> panier canonique du seed (`M-1209` : 150,00 € − 10,00 € de remise − 50,00 € de Bon d'achat = 90,00 €) vit dans
> `db/seed.sql`, pas derrière une route.

## Déployer sur CapRover

1. **La base** : one-click app « PostgreSQL » → nom `payencash-db`. Charger
   `db/schema.sql` puis `db/seed.sql` (psql ou l'onglet Exec de CapRover).
2. **Les 9 apps** (8 services + gateway) : pour chacune, créer l'app
   `payencash-<service>`, pousser CE dossier (`caprover deploy` — le
   `captain-definition` à la racine pointe le Dockerfile unique), puis poser
   2 variables d'environnement :
   - `SERVICE=<service>` (identite · voyage · promos · encaissement · mode · fournisseurs · reporting · bons d’achat · solution · gateway)
   - `DATABASE_URL=postgres://user:pass@srv-captain--payencash-db:5432/payencash` (pas pour gateway)
3. **Exposer UNIQUEMENT la gateway** (HTTPS + domaine `api.payencash.fr`) ;
   les autres apps restent internes (`srv-captain--payencash-*`, résolu d'office).
4. La gateway trouve les services par convention `srv-captain--payencash-<service>` —
   surchargable par `SVC_<SERVICE>` si vos noms diffèrent.

## Architecture (pourquoi des microservices)

Un service = un domaine = une app CapRover : un bug promo se corrige et se
redéploie **sans toucher** à l'encaissement. Chaque service est découpé en
`routes (index.js) → métier pur (service.js) → SQL (repo.js)` — le métier se
teste sans base ni HTTP.

| Service | Domaine | Écrans servis |
|---|---|---|
| identite | comptes, KYC gradué, cartes cadeaux | ecrans/10 · mode/08 |
| voyage | offres Duffel/Nuitée (adaptateurs), commandes, prix bloqué 1 h | ecrans/01 · parcours/01-03 |
| promos | offres J−21, 4 modes, récap ?o= | fly/06 · fly/07 |
| encaissement | (20/09) l'ÉTAT d'un règlement, et rien d'autre : le rail en ligne est supprimé, le seul valideur est le débit d'un bon (service `bons d’achat`) | mode/11 · fly/02 |
| mode | catalogue, panier (TVA composée), suivi Mondial Relay | mode/01-04 |
| fournisseurs | KYB, wizard 6 étapes, aperçu prix = achat + 7 % + livraison au poids + atelier (money.js, 12/09/2026), factures ≤ 7 j, liens influenceur | fournisseur/* |
| reporting | indicateurs Étape 2 (modèle financier) §7 (avance Duffel, prélèvements du mois, points sans carte, TVA, factures) | manager/07-08-14-21 |
| bons d’achat | (18/09) le **Bon d’achat PayEnCash** et son réseau de vente : émission au comptoir d'un partenaire ACTIF **précédée du prélèvement de sa carte** (code + ticket), vérification, règlement par bon d’achat (sous verrou, plafond client/jour), re-crédit, blocage, annulation (qui rembourse la charge), carte du commerce et relevé mensuel (`lib/bons.js` + `lib/stripe.js` purs, testés) | partenaire/03-04-05-07 · manager/29-41-12 · fly/01 · mode/03-05 |

## Les invariants que le code fait respecter (ne pas les contourner)

- **Centimes partout** (`*_cents`) — l'affichage `62,35 €` est un format, pas une donnée.
- **Plus une seule espèce ne passe par AJEK** *(18/09, au soir — décision fondatrice : « supprime l'agent qui se
  déplace »)* **et plus un seul titre tiers** *(20/09 — « enlève la logique Neosurf »)*. Le client achète un
  **Bon d’achat PayEnCash** à un commerçant ou à un distributeur mobile, qui encaisse **pour son propre compte**. Le plafond de 1 000 € (art. L112-6 CMF) n'a donc plus d'objet côté serveur :
  les plafonds qui restent sont ceux du **Bon d’achat** (250 € par bon d’achat, 1 000 € de bons d’achat utilisés par client et par jour), et
  ils vivent dans `lib/bons.js`. *(17/09 — pivot : plus aucun point partenaire qui encaisse, plus aucune borne.)*
- **Écart de collecte interdit** : `collected_amount_cents = amount_cents` sinon refus + alerte.
- **UN SEUL VALIDEUR, et il ne compte pas d'espèces** *(20/09)* : le **serveur** qui débite un Bon d’achat sous
  verrou — `method = 'bon'` et `gift_card_id` posé, mouvement `debit` dans la même transaction SQL
  (`payments.valideur_obligatoire` le fait respecter en base). *(18/09, au soir : le
  cycle du cash `collected → declared → …` et le rapprochement du rapport Cash Services sont supprimés avec l'agent —
  l'argent arrive par deux virements, celui du prestataire en ligne et le prélèvement carte des commerçants.)*
- **TVA par ligne** (`vat_scheme`) : marge (voyage, occasion) **jamais détaillée** au client ;
  neuf = « dont TVA 20 % » affichable. Mentions générées par `lib/fiscalite.js`.
- **Fournisseur MODE** : facture → virement ≤ 7 j (contrainte BDD `delai_7j`) ;
  occasion = pièce unique ; sneakers neuves = facture d'origine obligatoire.
- **Bon d’achat PayEnCash (18/09)** : le code n'est **jamais stocké en clair** (rendu une seule fois à l'émission ; la base ne
  garde que `gift_cards.code_hash`, SHA-256 salé par `BONS_HASH_PEPPER`) · un **débit ne se fait que sous verrou**
  (`FOR UPDATE` sur le bon d’achat ET le paiement, une seule transaction : solde, mouvement, tender, commande) · **jamais de
  remboursement en espèces** : une commande réglée par bon d’achat se rembourse par **re-crédit du bon d’achat**, au plus ce que le bon d’achat a
  réglé sur cette commande · **1 000 € de bons d’achat par client et par jour** (Σ des mouvements `debit` du compte) et **250 €
  par bon d’achat**, minimum 5 €, valeurs vivantes (`settings` `ref.bons.*`) · **épuisé / expiré se dérivent** (solde, date) — seuls
  bloqué / annulé s'écrivent · **le partenaire ne reverse plus rien** : sa carte est **prélevée à la vente** (voir
  ci-dessous), et l'autofacture de commission `AFB-<AAAAMM>-<code>` se **dérive** du mois et du point (vue
  `v_partner_monthly_statements`), elle ne se stocke plus.

## Le Bon d’achat PayEnCash (18/09 — `services/bons`)

Décision fondatrice du 18/09 : le client achète chez un **commerçant partenaire** (tabac, presse, commerce) un
**Bon d’achat PayEnCash** — bon d'achat prépayé à montant libre, payé en espèces au comptoir, utilisable sur Mode et Fly en une
ou plusieurs fois. Le partenaire **vend un titre**, il n'encaisse jamais une commande (c'est ce qui le distingue du
réseau abandonné le 17/09) : titre à usage limité accepté par le seul émetteur, AJEK — art. L521-3 I 1° CMF (déclaration
ACPR au-delà d'1 M€ / 12 mois), hors monnaie électronique (art. L315-1), bon d’achat à usages multiples (art. 256 ter CGI : TVA
à l'utilisation). Les partenaires vivent dans `partners` (cycle `contrat_a_signer → contrat_signe → actif · suspendu ·
clos`), les bons d’achat dans `gift_cards` + `gift_card_movements`, la carte du commerce et ses prélèvements dans
`partner_cards` + `partner_charges`, le lien de signature du contrat dans `signature_links`
(migrations `db/migrations/2026-09-18-bon-payencash-partenaires.sql`, puis
`db/migrations/2026-09-18-stripe-suppression-agent.sql`, puis
`db/migrations/2026-09-19-commission-par-commerce.sql`, idempotentes).
*(18/09, au soir)* **`partner_remittances` et `partner_remittance_receipts` n'existent plus** : créées le matin avec
le reversement mensuel, elles sont supprimées le soir même avec lui (`DROP TABLE`, même migration du 18/09) — elles ne
figurent plus au schéma. Ce qui les remplace se lit plus bas : la carte est **prélevée à la vente**, et le relevé
mensuel se **calcule** dans la vue `v_partner_monthly_statements`.

Routes (préfixe `/bons` de la passerelle) :
- `POST /partners/:id/bons` `{montant_cents, prix_recu: true, par}` — émettre au comptoir : point **actif** seulement
  (tout autre état répond avec sa phrase), montant entre 5 € et 250 €, **prix reçu confirmé** ; répond 201 avec le **code en
  clair (une seule fois)**, le n° de ticket `BV-…`, la validité. `POST /bons` : la carte cadeau du manager (même objet).
  *(18/09, au soir — pivot de positionnement)* le champ s'appelait `especes_recues` : **on ne dit jamais comment le
  client règle au comptoir** — c'est une vente du commerçant à son client, il paie comme il veut. Le nom (`prix_recu`,
  `prixRecu` côté client) et le refus (« Confirme avoir reçu X € de ton client : le bon d'achat ne s'émet qu'une fois
  payé. ») ne nomment **aucun moyen de paiement**.
- `GET /partners/:id/bons?mois=AAAA-MM` — les bons d’achat vendus par le point, état dérivé, code masqué.
- `GET /bons/:code` — état + solde + validité, **sans donnée personnelle** ; code mal formé, inconnu ou annulé → le même 404.
- `POST /payments/:ref/bon` `{code, user_id}` — dans une transaction, sous verrou : plafond client/jour, débit de
  min(solde, reste dû), mouvement `debit`, compte posé au premier usage, tender `bon d’achat` ; si tout est couvert, la commande
  est réglée (`payments.method = 'bon'`, `orders.status = PAID`, reçu) ; sinon le reste dû est rendu (`reste_du_cents`).
- `POST /bons/:code/recredit` `{montant_cents, order_ref, motif, par}` (manager) — ≤ Σ débits de la commande ; un bon d’achat
  expiré entre-temps reprend une validité.
- `POST /bons/:code/bloquer` `{motif, par}` · `POST /bons/:code/debloquer` `{par}` (manager : perte, vol, fraude).
- `POST /bons/:code/annuler` `{motif, par, partner_id?}` — le partenaire (son point, dans `annulationMinutes`, aucun
  débit) ou le manager ; le prélèvement de la carte est **remboursé** et reste tracé.
- `GET /partners/:id/releve/:mois` — le relevé **calculé** par la vue `v_partner_monthly_statements` (ventes,
  commission HT, TVA, prélevé, remboursé, net, frais du prestataire, refus, n° d'autofacture dérivé) — voir la
  section Stripe ci-dessous.

*(18/09, au soir)* **Les routes `GET /partners/:id/reversements/:mois` et `POST /partners/:id/reversements/:mois/recu`
n'existent pas** — ce README les documentait trente lignes avant la section qui les remplace. Il n'y a plus de créance
à arrêter ni de virement à pointer : **tout est prélevé à la vente**, et le relevé est une preuve, pas une créance.

*(19/09)* **La grille Mode a deux marges.** `reglages.marge_mode_pct` est la marge de l'accueil ;
`reglages.marge_mode_partage_pct` celle d'une pièce atteinte par le **lien qu'un fournisseur a partagé**. La seconde
est **bornée par la première** : `configurerGrilleMode` ignore un réglage supérieur, sinon un lien coûterait plus cher
que l'accueil. L'écart, appliqué au prix d'achat, est la **« remise PayEnCash »** (`money.remisePartageMode`) : elle
sort de NOTRE marge, le fournisseur est facturé à l'identique. La commande garde `share_discount_cents` et
`share_link_id`. Miroir client : `PEC_DATA.margePartageMode / remisePartageMode / partageRemise / prixAvecPartage`.

*(19/09)* **Le taux de commission n'est pas qu'un réglage global.** `settings ref.bons.commissionPct` est le taux du
**réseau** ; un point qui a négocié le sien le porte sur sa ligne (`partners.commission_pct`, **nullable — NULL n'est pas
zéro, c'est « le taux du réseau »**). `B.montantPreleve(faceValueCents, cfg, tauxPoint)` tranche, `B.tauxCommission`
applique la règle et `B.commissionMaxPct(cfg)` donne le dernier taux qui laisse encore quelque chose à prélever. Le taux
retenu est **ÉCRIT sur `partner_charges.commission_pct`** : le relevé (`bilanReleve`) le relit là et annonce un taux
**effectif** (`taux_multiples`) quand il a bougé en cours de mois.

Réglages lus dans `settings` (`ref.bons.minimum`, `plafondBon`, `plafondClientJour` en euros ; `validiteMois`,
`commissionPct`, `tvaCommissionPct`, `annulationMinutes`) — *(18/09, au soir)* `ref.bons.reversementJourLimite` et
`ref.bons.ibanReversement` sont **supprimés des `settings` par la migration du 18/09** : on ne vire plus rien. Les défauts sont
ceux de `lib/bons.CFG_DEFAUT` (= `ref.bons` côté app). Tests à sec de `lib/bons.js` et des refus du service dans
`test/run-tests.js` (`npm test`).

## Stripe — le point de vente est PRÉLEVÉ à la vente, les marques ont leur compte (21/09 — `lib/stripe.js`)

Décisions fondatrice du 21/09 : **« je vais retenir Stripe Connect »**, puis **« supprime Stancer de notre modèle
désormais »**. Un seul prestataire pour les deux lignes :
- **Mode** — la carte enregistrée du partenaire est débitée **sur notre compte** de la valeur du bon d’achat moins sa
  commission TTC (50 € → **49,34 €** débités, 0,66 € gardés — chaque étape arrondie au centime). Tarif Stripe standard :
  1,5 % + 0,25 € par carte EEE (49,34 € coûtent 0,99 €) — `ref.bons.psp`, réglable.
- **Solution** — la **marque est le vendeur officiel** de ses cartes cadeaux : elle a un **compte connecté** (API v1
  « controller » : `fees.payer=account`, `losses.payments=stripe`, `stripe_dashboard.type=full`), la vente est une
  **charge directe** sur son compte, et notre commission est prélevée à la source (`application_fee_amount`). Stripe
  encaisse ses frais chez la marque, porte ses impayés et fait sa vérification (KYB) dans l'inscription hébergée
  (`account_links`). Nous ne détenons jamais de fonds. La carte du point de vente, enregistrée chez nous, est **clonée**
  sur le compte de la marque à chaque vente (`POST /v1/payment_methods {customer, payment_method}` + `Stripe-Account`).

**Les invariants** (ne pas les contourner) :
- **Le PAN n'entre jamais.** La carte se saisit dans le composant Stripe du navigateur du gérant : `POST
  /partners/:id/cards/setup` ouvre un **SetupIntent `off_session`** (client `cus_…` + `client_secret`), l'authentification
  forte se fait là, une fois ; puis `POST /partners/:id/cards {setup_intent_id}` : le serveur **relit chez Stripe**
  l'empreinte `pm_…`, les 4 derniers chiffres, la marque, l'échéance — il n'enregistre que ce qu'il a relu.
  `stripe.refuserDonneesCarte()` refuse (422) toute charge utile qui porterait un numéro ou un cryptogramme.
- **Le bon d’achat naît de la charge acceptée.** `POST /partners/:id/bons` prélève **avant** d'émettre : refus de la
  banque ⇒ aucun bon, la charge reste en `refused` avec son motif en français (`stripe.MOTIFS`), l'API répond **402**.
  La référence de la vente est la **clé d'idempotence** : rejouer la vente ne débite pas deux fois.
- **Un remboursement part d'abord chez Stripe.** `POST /bons/:code/annuler` rembourse le PaymentIntent (et notre
  commission sur une vente Solution), et n'écrit `refunded` en base qu'après ; un refus de Stripe n'annule rien.
- **Deux jeux de clés, un mode.** `STRIPE_*_TEST` et `STRIPE_*_LIVE` dans l'environnement ; le mode courant est le
  réglage `settings 'stripe.mode'` (bascule depuis Configuration, après la vérification de préparation), sinon
  `STRIPE_MODE`. Une clé qui n'est pas de son mode rend le module **inactif** et le dit. **Sans clé, tout est SIMULÉ et
  le dit** (`simulation: true`) : aucun appel réseau n'est fait.
- **Les notifications sont signées.** Deux canaux (`POST /v2/core/event_destinations`) : « notre compte » (`@self`) et
  « comptes connectés » (`@accounts`) ; `stripe.verifierSignature` (HMAC-SHA256 du `t.corps` brut, tolérance 300 s)
  avant toute lecture ; l'identifiant de l'événement fait l'idempotence.

Routes (préfixe `/bons`) : `GET /psp` (prestataire, mode, réel ou simulé, clé publique) · `POST /partners/:id/cards/setup`
· `POST /partners/:id/cards` `{setup_intent_id, par}` (ou, en démonstration, `{psp_card_id: pm_…, last4, brand,
exp_month, exp_year, holder, psp_customer_id}`) · `DELETE /partners/:id/cards/:carteId` · `GET /partners/:id/releve/:mois`.

**Le service `solution`** (préfixe `/solution` — `services/solution`, métier pur `lib/solution.js` : répartition d'une vente,
références VNT-/VNX-, codes TB-…, état d'un compte connecté, préparation au réel, lecture d'une notification) :
- **la marque** — `POST /marchands/:id/stripe/compte {par}` (compte connecté + lien d'inscription hébergée ; simulé sans clé, et
  le lien revient sur tech/02 `?stripe=retour`), `GET /marchands/:id/stripe/lien`, `GET /marchands/:id/stripe` (relit chez
  Stripe), `POST /marchands/:id/stripe/retour {par}`, `GET /marchands/:id/stripe/oauth` → `GET /stripe/oauth/retour` (une
  marque qui a déjà Stripe), `GET /marchands/:id/ventes?mois=` ;
- **le point de vente** — `GET|POST /revendeurs/:id/cards[/setup]`, `DELETE /revendeurs/:id/cards/:carteId` (même deux temps que
  `/bons/partners` ; un point rattaché à un commerce partenaire garde la carte de son point), **`POST /revendeurs/:id/ventes
  {marchand_id, montant_cents, par}`** — la répartition se fige (`tech_charges`), la carte est clonée sur le compte de la
  marque, la charge directe part avec `application_fee_amount`, le bon `TB-…` naît si la banque accepte (sinon **402**,
  la vente reste en `VNX-…`), `POST /ventes/:ref/annuler {motif, par}` (dans `ref.tech.annulationMinutes`, bon jamais
  utilisé : remboursé chez Stripe d'abord, commission rendue), `GET /revendeurs/:id/ventes?mois=` ;
- **le manager** — `GET /stripe/pret` (les dix points de la préparation au réel), `POST /stripe/mode {mode, par}` (refusé en
  `live` tant que tout n'est pas vrai), `POST /stripe/activite-confirmee {confirme, reference, par}` (l'accord écrit de
  Stripe sur les cartes cadeaux), `POST /stripe/destinations {par}` (les deux canaux ; les secrets ne sont rendus qu'une fois) ;
- **Stripe** — `POST /webhooks/stripe` et `POST /webhooks/stripe/connect` : signature sur le corps brut (`req.corpsBrut`),
  idempotence par `psp_events`, un remboursement ou une contestation venus de Stripe s'appliquent, un état de compte s'écrit
  (`account.updated`), une notification qui contredit une vente déjà en base s'inscrit comme **écart** (`stripe_ecart`).
Tables : `tech_charges`, `psp_events`, colonnes `tech_merchants.stripe_*`/`platform_fee_pct`, `tech_resellers.partner_id`,
`tech_distribution_contracts.reseller_discount_pct`, `partner_cards.reseller_id` (migration `2026-09-21-stripe.sql`).

Chemins de l'API, **lus le 21/09 sur `docs.stripe.com`** : base `https://api.stripe.com`, `Authorization: Bearer`,
corps formulaire (`a[b]=…`) pour `/v1/…`, JSON pour `/v2/…` ; `POST /v1/customers`, `POST /v1/setup_intents`, `GET
/v1/setup_intents/{id}`, `GET /v1/payment_methods/{id}`, `POST /v1/payment_methods` (clonage, avec `Stripe-Account`),
`POST /v1/payment_intents` (`off_session`, `confirm`, `application_fee_amount`), `POST /v1/refunds`
(`refund_application_fee`), `POST /v1/accounts` (`controller`), `POST /v1/account_links`, `GET /v1/account`,
`POST /v2/core/event_destinations`, OAuth `connect.stripe.com/oauth/{authorize,token}`. **À confirmer auprès de
Stripe** avant le réel : l'activité « cartes cadeaux » (catégorie soumise à conditions) et le délai de versement.

## Brancher les vrais fournisseurs

Les adaptateurs sont isolés et mockés sur le cache local :
- Duffel : `services/voyage/index.js` (`duffel.chercher`) → `DUFFEL_API_KEY`
- Mondial Relay : la table `shipments` porte étiquette/tracking/relais — le worker
  d'appel API (étiquettes, tracking, retours) se branche sur `shipments.events`
- (20/09 — « enlève la logique Neosurf ») **LE PRESTATAIRE DE PAIEMENT EN LIGNE N'EXISTE PLUS.** `lib/paymentwall.js`
  et ses 25 tests à sec sont supprimés, avec les routes qu'ils servaient (`psp-intent`, `psp/pingback`,
  `payments/:ref/livraison`, `psp/transactions/:id/rembourser`), les tables `psp_transactions` et
  `psp_delivery_confirmations`, et la page hébergée simulée. Le seul prestataire qui reste est **Stripe** (depuis le 21/09), et il
  ne touche pas nos clients : il débite la **carte du commerçant** à chaque bon vendu (`lib/stripe.js`).
  Migration : `db/migrations/2026-09-20-purge-reseau-tiers.sql`.
