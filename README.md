# voyagencash

Recherche de vols et réservation PayEnCash en français, avec un calendrier de prix, une interface claire en Manrope et un backend Node/Vercel. Bleu de marque `#016bfd`, ressources graphiques locales, SVG, affichage adapté de 360 px au grand écran.

## Démarrer

Node.js 22 ou supérieur :

```sh
npm ci
npm run dev
```

Ouvrir http://localhost:4173. Le serveur local exécute les **mêmes handlers `/api`** que Vercel. Il ne sert que la page et les ressources publiques ; les fichiers serveur, secrets et anciens dépôts ne sont pas accessibles.

```sh
npm test
node scripts/build.mjs
npm run preview
```

Le build valide la syntaxe JavaScript client/serveur, les ressources référencées, les symboles SVG et l’absence d’émojis. `dist/` contient uniquement `index.html` et `assets/`. Les fonctions restent dans `api/`, à la racine, pour Vercel.

## Modes et limites réelles

| Mode | Recherche et calendrier | Réservation |
| --- | --- | --- |
| Local/Vercel, sans jeton | Catalogue déterministe explicitement fictif, même moteur côté serveur et navigateur. | Parcours de démonstration complet : aller simple, aller-retour, multi-destinations, options, bons, cartes, Apple Pay, billets et annulation. |
| Hébergement statique sans `/api` | Repli local après détection du serveur absent ; aucune clé requise. | Démonstration locale. Les ressources déjà chargées fonctionnent sans backend ; un premier chargement totalement hors réseau n’est pas couvert par un service worker. |
| Duffel configuré | Offres du fournisseur, avec prix observés dans le calendrier. Une erreur fournisseur s’affiche avec possibilité de réessayer, sans substitution de faux vols. | Parcours réel distinct, pour un **aller simple, 1 à 9 adultes, en EUR, éligible à une retenue de deux heures**, après configuration du partenaire et activation explicite. |

Les autres itinéraires Duffel sont consultables ; leur achat n’est pas encore pris en charge. Les règlements réels par carte/Apple Pay, les options tarifées par la compagnie, les enfants et les annulations/remboursements réels restent à intégrer. Aucune carte bancaire n’est collectée. Les indicateurs de ponctualité simulés portent leur provenance ; aucune prédiction n’est inventée pour les offres Duffel. Les émissions réelles ne sont affichées que si fournies par Duffel.

Le projet n’a pas été homologué avec des identifiants partenaires de production. La mise en ligne commerciale nécessite la recette des contrats partenaire, de la fiscalité et du processus d’émission. Les réponses publiques de PayEnCash n’ont pas permis d’établir son protocole privé : **les routes de l’adaptateur ci-dessous définissent notre contrat, pas une API officielle supposée de PayEnCash**.

## Calendrier des prix

Cliquer sur départ ou retour ouvre un dialogue natif accessible ; sur mobile, il devient une feuille en bas d’écran. Les jours portent un prix sous leur numéro. Navigation mensuelle, Escape, focus contenu dans le dialogue et navigation directionnelle entre les jours. Les dates passées et antérieures au départ sont désactivées.

Les tiers du mois utilisent les terciles des prix directs disponibles : bas en vert, moyen en ambre, élevé en rouge. Le libellé accessible donne aussi le niveau, sans dépendre de la couleur. Le prix du calendrier correspond au minimum des offres **directes**, par adulte, pour la liaison et le nombre de voyageurs sélectionnés. Les résultats peuvent aussi contenir des correspondances moins chères.

En mode Duffel, seuls les prix récemment observés sont affichés. Un tiret signifie un prix inconnu ou l’absence de direct confirmée, distingués dans le libellé accessible. Une recherche met à jour le cache ; le calendrier ne déclenche pas 31 recherches payantes. PostgreSQL partage ce cache entre fonctions ; le cache mémoire n’est qu’un complément temporaire. Les valeurs expirent après 15 minutes. Dans les résultats, choisir un autre jour relance la recherche et invalide les sélections suivantes.

## Routes serveur

| Route | Méthode | Entrée / comportement |
| --- | --- | --- |
| `/api/config` | GET | Mode et disponibilité de l’achat, aucun secret. |
| `/api/flights/search` | POST | `{from,to,date,count}` ; codes IATA, date ISO, 1–9 adultes. Renvoie `{source,simulation,offers}`. |
| `/api/flights/calendar` | GET | `?from=CDG&to=ALG&month=2026-11&count=1` ; `{source,simulation,days:[{date,price,tier,direct}]}`. |
| `/api/orders/hold` | POST | Démo : `{count,legs:[{from,to,date,offerId}],options}`. Réel : `{offerId,expectedAmountCents,passengers}` + `Idempotency-Key` UUID v4. |
| `/api/payencash/voucher` | POST | `{holdToken}` signé ; montant serveur, plafond 100 000 centimes, échéance vérifiée. |
| `/api/payencash/webhook` | POST | Notification HMAC signée sur les octets originaux ; déduplication en PostgreSQL. |
| `/api/orders/status` | POST | `{token}` de consultation ; état serveur et documents Duffel après émission. |
| `/api/orders/wallet` | POST | `{token}` ; téléchargement `.pkpass` fourni et signé par le service partenaire, après émission. |
| `/api/payencash/stores` | GET | Annuaire réel de l’adaptateur, sans clé exposée ; recherche ville/code postal et distance GPS côté client. |
| `/api/orders/fulfil` | GET | Worker d’émission protégé par `CRON_SECRET`. À appeler par un ordonnanceur serveur. |

Le montant d’un bon ne provient jamais d’un total arbitraire envoyé par le navigateur. En démonstration, le serveur recalcule les offres et les options ; en mode réel, il relit l’offre chez Duffel, compare le tarif accepté et crée un ordre `hold` **sans propriété `payments`**. Les offres exigeant un paiement immédiat ou sans deux heures de garantie sont refusées. L’échéance effective est le minimum du délai applicatif, du délai de paiement et de la garantie Duffel. Une réponse tardive ne prolonge pas un bon expiré.

Les fonctions contrôlent méthodes, schémas, dates, origine des requêtes navigateur et taille des corps bruts (32 Kio). Les jetons HMAC distinguent retenue, bon et consultation. La courte référence `VNC-AAAA-XXXXX` est un identifiant visuel, pas un secret ; le QR transporte un jeton signé ou le contenu fourni par le partenaire. Les secrets n’apparaissent ni dans les réponses ni dans `dist/`.

## Contrat de l’adaptateur partenaire

`PAYENCASH_ADAPTER_URL` pointe vers **votre service d’intégration**, configuré avec les spécifications privées validées par AJEK/PayEnCash. Tous les appels utilisent HTTPS et `Authorization: Bearer <PAYENCASH_API_KEY>`.

- `POST vouchers` reçoit `{kind,orderId,reference,amountCents,currency,expiresAt,simulation:false,fiscal}` et `Idempotency-Key: <orderId>`. Il doit retourner `{reference,qrPayload}`. La même clé doit toujours désigner le même bon ; l’adaptateur doit refuser l’encaissement après l’échéance. La base impose l’unicité de la référence. Un conflit de référence nécessite rapprochement, jamais une validation aveugle.
- `GET stores` renvoie `{stores:[{name,city,zip,address,lat,lon,hours}]}` avec des partenaires vérifiés. Le navigateur affiche une carte OpenStreetMap du point sélectionné. Sans configuration, les exemples sont montrés uniquement en mode démo.
- `POST wallet` reçoit `{orderId}` et renvoie une archive signée avec `Content-Type: application/vnd.apple.pkpass`. Le partenaire gère les certificats Apple et les données d’enregistrement. Une réservation ne constitue pas une carte d’embarquement ; ne pas fabriquer de code-barres aérien. L’export historique en démonstration reste explicitement non signé et non importable.

Notifications entrantes :

```json
{
  "id": "evt_unique",
  "type": "voucher.paid",
  "orderId": "ord_duffel",
  "reference": "VNC-2026-ABCDE",
  "amountCents": 14200,
  "currency": "EUR"
}
```

En-têtes `X-PayEnCash-Timestamp: <secondes Unix>` et `X-PayEnCash-Signature: sha256=<hex>`. Signature : `HMAC-SHA256(secret, timestamp + "." + corpsBrut)`. Fenêtre de 300 secondes et comparaison à temps constant. Une nouvelle tentative doit être resignée avec l’heure courante et conserver le même identifiant d’événement.

Le webhook verrouille la commande, vérifie référence/devise/montant, inscrit l’événement et une tâche d’émission dans une même transaction. Un événement identique ne crée pas une seconde tâche. Les notifications reçues après expiration vont en `refund_pending`. Le worker débite le solde Duffel une seule fois par tentative revendiquée et n’indique `ticket_issued` qu’après vérification du paiement et de documents `electronic_ticket`. Les erreurs ambiguës nécessitent un rapprochement opérateur ; aucun débit n’est réessayé aveuglément. Les migrations et l’ordonnanceur sont décrits dans [ENV.md](ENV.md).

## Données, cadre juridique et fiscal

La démo garde les voyageurs fictifs dans `localStorage`, comme le parcours existant. Le parcours réel transmet les informations à Duffel et ne stocke localement que les identifiants, le bon et les jetons d’accès. Ces jetons sont des capacités d’accès : une personne ayant accès au navigateur peut consulter les voyages. Il n’y a pas de compte utilisateur ni de synchronisation entre appareils. La durée de consultation est actuellement de 90 jours ; ajouter comptes, rotation/révocation et politique de rétention avant une offre commerciale complète.

Le plafond applicatif de **1 000 €** est imposé à tous les bons en espèces. L’article L.112-6 CMF pose le principe ; D.112-3 précise notamment le seuil de 1 000 € pour les personnes fiscalement domiciliées en France ou agissant à titre professionnel. Les exceptions légales ne sont pas mises en œuvre.

L.521-3 CMF vise notamment les réseaux ou biens/services limités et prévoit des obligations déclaratives : afficher « bon partenaire » ne prouve pas à lui seul l’éligibilité à ce régime. L’art. 256 ter CGI distingue bons à usage unique et multiples ; l’absence de TVA sur les transferts préalables d’un BUM dépend de la qualification effective du bon et la TVA sur la prestation dépend de sa nature. La démo modélise `vatAtVoucherIssue: 0`. Le contrat réel doit être validé avec AJEK/PayEnCash et le conseil fiscal ; aucune certification n’est revendiquée.

## Vercel

Importer le dépôt, preset **Other**, build `node scripts/build.mjs`, output `dist`, runtime Node 22+. `vercel.json` conserve les routes de navigation historiques et configure les fonctions serveur. Renseigner les variables de [ENV.md](ENV.md), appliquer les migrations, mettre en place l’adaptateur, puis effectuer la recette avec le jeton Duffel de test avant activation. Aucun déploiement de production n’est effectué par les tests ou le build.

## Validation et ressources

`npm test` couvre le parcours existant, le QR décodé, la persistance, le plafond espèces, l’expiration, le GPS, les formats Wallet, les routes serveur, les erreurs Duffel, les signatures, la déduplication et les paiements tardifs sur émulateur PostgreSQL, le calendrier et les largeurs 360/390/430/768/1440 px. Les tests de flux réel utilisent des réponses contrôlées. Ils ne remplacent pas une recette avec PostgreSQL et les prestataires.

Captures de revue locale : `output/playwright/` (ignoré par Git). Moteur partagé : `assets/js/flight-engine.js`. Contrôleurs séparés : `api-client.js`, `price-calendar.js`, `live-booking.js`. Style de la refonte : `assets/css/refined.css` ; les styles des vues historiques restent dans `style.css`.

Références consultées : [calendrier Skyscanner](https://help.skyscanner.net/hc/en-us/articles/201750142-How-do-I-find-the-cheapest-prices-across-a-month), [recherche Duffel](https://duffel.com/docs/api/v2/offer-requests), [ordres Duffel](https://duffel.com/docs/api/v2/orders), [paiements Duffel](https://duffel.com/docs/api/v2/payments), [L.521-3 CMF](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000035430673), [D.112-3 CMF](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000036824549), [256 ter CGI](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000037951759), [passes Apple Wallet](https://developer.apple.com/documentation/walletpasses/building-a-pass).

Photos locales issues d’Unsplash : Marrakech (`photo-1597212618440-806262de4f6b`), [Alger, Sid Ahmed SAOUD](https://unsplash.com/photos/RCsOlTBX5Tw), [Sidi Bou Saïd](https://unsplash.com/photos/3XflRgZmq-g). Logos de compagnies : ressources publiques `assets.duffel.com/img/airlines/for-light-background/full-color-logo/`. Les noms et marques restent la propriété de leurs titulaires. Générateur QR : qrcode-generator 2.0.4, Kazuhiko Arase, licence MIT conservée.
