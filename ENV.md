# Configuration de voyagencash

Les secrets ci-dessous sont **serveur uniquement**. Seule la clé publique Stripe peut être exposée au navigateur. Sur Vercel : Project → Settings → Environment Variables, sélectionner les environnements souhaités, puis redéployer. Ne jamais préfixer ces secrets avec `PUBLIC_`, `VITE_` ou `NEXT_PUBLIC_`.

| Variable | Usage | Sans cette variable |
| --- | --- | --- |
| `DUFFEL_API_TOKEN` | Jeton Duffel v2, de test pour la recette, de production après habilitation. | Catalogue de démonstration. |
| `AMADEUS_CLIENT_ID` | Réservée à un futur connecteur Amadeus. | Aucun effet : le connecteur n’est pas implémenté. |
| `AMADEUS_CLIENT_SECRET` | Secret associé au futur connecteur Amadeus. | Aucun effet. |
| `PAYENCASH_API_KEY` | Authentification Bearer de l’adaptateur partenaire. | Aucun bon encaissable ni annuaire partenaire. |
| `PAYENCASH_WEBHOOK_SECRET` | Secret HMAC-SHA256 partagé avec l’adaptateur, au moins 32 octets aléatoires recommandés. | Webhook fermé, réponse 503. |
| `VOUCHER_SIGNING_SECRET` | Secret indépendant pour signer les jetons de retenue et de consultation. Même valeur sur toutes les instances. | Secret éphémère en local ; obligatoire sur Vercel même en démonstration pour partager la signature entre fonctions. |
| `DATABASE_URL` | URL PostgreSQL avec TLS, idéalement via un pool de connexions. | Recherche réelle possible ; réservation et paiement réels refusés. |
| `PAYENCASH_ADAPTER_URL` | URL HTTPS d’un service contrôlé par l’opérateur et agréé par son partenaire, terminée par `/`. Contrat décrit dans README. | Aucune intégration PayEnCash réelle. |
| `LIVE_CHECKOUT_ENABLED` | `true` uniquement après recette partenaire et mise en service du traitement d’émission. | Recherche Duffel consultable ; achat réel désactivé. |
| `CRON_SECRET` | Secret Bearer d’un ordonnanceur appelant `/api/orders/fulfil`. | Endpoint d’émission fermé. |
| `NODEJS_HELPERS` | `0` sur Vercel (déjà déclaré dans `vercel.json`) : conserve les octets bruts du webhook et utilise notre parseur. | Le parsing automatique peut empêcher la vérification HMAC. |
| `PORT` | Port du serveur local, défaut `4173`. | Port 4173. |

Le mode Duffel signifie « API connectée », pas nécessairement « argent réel » : le caractère test/live dépend du jeton fourni par Duffel. Ne pas utiliser un jeton live pour les tests automatisés.

## Préparation du stockage

Appliquer `server/schema.sql` sur votre base avant l’activation :

```sh
psql "$DATABASE_URL" -f server/schema.sql
```

Les tables conservent les identifiants de commande, montants en centimes, échéances, bons et états. Les noms et coordonnées des voyageurs sont transmis à Duffel mais ne sont pas conservés dans ces tables. Les empreintes d’idempotence sont des SHA-256, pas des copies des formulaires.

Les prix observés sont partagés entre fonctions via `fare_observations` et ne sont affichés que pendant 15 minutes. Programmer une purge des anciennes observations et une politique de rétention des commandes avec l’opérateur. Une indisponibilité du cache n’invente aucun prix.

## Démarrage local avec variables

Le projet n’inclut aucune clé. Copiez `.env.example` vers `.env`, puis renseignez vos accès de test. `npm run dev` charge automatiquement ce fichier avec Node 22 ; les variables déjà définies dans le processus restent prioritaires. Une autre possibilité :

```sh
node --env-file=.env scripts/serve.mjs
```

`.env` est ignoré par Git. Ne pas y mettre de clés de production pour la recette. `npm test` lance son propre serveur sur le port 4174, sans charger `.env` et avec les connexions partenaires désactivées. Ses tests fournisseurs utilisent des réponses contrôlées, sans réservation externe.

## Émission et exploitation

`vercel.json` ne configure aucun cron. L’ordonnanceur doit appeler `GET /api/orders/fulfil` avec `Authorization: Bearer <CRON_SECRET>`, ou exécuter `node scripts/fulfil.mjs` sur un worker Node. Les unités `ops/voyagencash-fulfil.service` et `ops/voyagencash-fulfil.timer` fournissent une exécution à la minute sur un serveur systemd. Adapter les chemins et le compte système, installer les dépendances, placer les secrets dans `/etc/voyagencash/worker.env` (lecture limitée au service), puis installer et activer le timer. Aucun timer n’est installé ou activé par le build.

Chaque exécution traite jusqu’à dix tâches dans un budget réseau global de 45 secondes. Le bail dure une minute ; un ancien worker ne peut plus modifier la tâche après remplacement de son jeton. Une interruption avant débit peut reprendre la vérification. Une interruption pendant le débit impose un rapprochement, sans répétition du paiement. Les anciennes tâches `processing` sans jeton restent ambiguës. Les lectures de documents sont bornées à 120 tentatives ou 24 heures.

Réappliquer `server/schema.sql` avant cette version. Les ajouts sont idempotents. La provenance des anciens ordres Duffel est récupérée uniquement depuis la réponse durable de `checkout_requests`; les ordres sans preuve restent `unknown` et nécessitent un rapprochement. Les anciens billets sans documents persistés ne reçoivent aucune référence fabriquée : récupérer leurs preuves fournisseur avant de les exposer. Aucun changement n’est exécuté sur une base distante par le build.

Surveiller `worker_heartbeat.completed_at` (alerte si absent ou vieux de plus de deux minutes), l’âge des commandes `payment_received`, les baux expirés et les lignes `payment_receipts.result='reconciliation_required'`. Un heartbeat ne prouve pas qu’un billet a été émis. Les états `refund_pending` nécessitent un traitement opérateur avec preuve de remboursement ; aucun remboursement automatique n’est simulé.

**Ce worker peut débiter le solde Duffel** après une notification partenaire authentifiée et persistée. Il n’est jamais exécuté par les tests contre Duffel. Une réponse de paiement acceptée est persistée avant la relecture des billets. Les tâches `awaiting_documents` relisent ensuite uniquement la commande, au plus une fois par minute. Les tentatives ambiguës sont placées en `reconciliation_required`, sans nouvel essai de débit. Réconcilier avec Duffel et le partenaire avant toute reprise. Une notification tardive est classée `refund_pending`, sans émission automatique du billet.

Avant l’activation : migrations, TLS PostgreSQL, contrat adaptateur, signature HMAC sur corps brut, annuaire confirmé, supervision de l’outbox et limitation des requêtes publiques au niveau du WAF doivent être opérationnels. Les certificats Apple restent chez le service partenaire Wallet ; ils ne sont jamais envoyés au navigateur.

Vercel : [désactivation des helpers Node](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration). Sans secret de signature sur Vercel, le parcours de démonstration se replie explicitement sur un bon local non signé par le serveur.


## Carte, horaires partenaires et reprise

- `STRIPE_SECRET_KEY` (ou `STRIPE_API_KEY`) : clé serveur Stripe, `rk_` restreinte si les permissions nécessaires sont disponibles ; `STRIPE_WEBHOOK_SECRET` : signature obligatoire dans tous les environnements ; `STRIPE_PUBLIC_KEY` (ou `STRIPE_PUBLISHABLE_KEY`) : clé publique. Le flag `stripe` n’est vrai que si le stockage, Duffel, la signature, le webhook et le checkout sont configurés. Les clés test/live doivent appartenir au même environnement.
- La carte prend en charge une offre Duffel avec retenue, dont la garantie dure encore au moins cinq minutes. L’instantané et les achats multi-trajets restent fermés. Une tentative carte interdit l’émission d’un bon ; une tentative bon, y compris après timeout partenaire, interdit la carte. Les retries conservent la même clé d’idempotence et le même montant.
- La simulation Stripe exige à la fois un hold marqué `simulation: true` et `VOYAGENCASH_TEST_MODE=true`. Le suivi ne confirme jamais un paiement et le worker ne produit aucun billet de test.
- L’annuaire peut fournir `hoursConfirmedAt`, `scheduleValidUntil` et `openingWindows: [{ opensAt, closesAt }]` en ISO 8601 avec fuseau. Ces plages doivent intégrer les jours fériés et fermetures exceptionnelles. Une confirmation vieille de plus de 120 minutes est inconnue. Le champ texte `hours` sert uniquement à l’affichage. `paymentWindowConfirmed` indique une plage couvrant l’échéance demandée, pas un temps de trajet garanti.
- La reprise utilise un lien privé valable au maximum 24 heures, dont seul le hash est conservé dans `order_recovery`. Une nouvelle création invalide le lien précédent. La révocation invalide le lien ; les capacités de consultation déjà délivrées restent valables au maximum une heure. Le secret de reprise reste dans le fragment de l’URL, puis est retiré de l’historique après échange. Cette version ne fournit pas encore une récupération par e-mail vérifié ni une session HttpOnly.
- `POST /api/orders/status` ne réalise que des lectures. `POST /api/orders/hold` accepte les actions explicites `recovery` et `refresh-low-cost`, toutes deux authentifiées par la capacité du dossier. Les anciennes URL low-cost restent des réécritures, sans fonction supplémentaire.

Les tests PostgreSQL émulés ne prouvent pas les verrous ni les transactions en concurrence réelle. La recette de déploiement doit couvrir deux workers sur PostgreSQL réel, un arrêt autour du débit, la livraison webhook avant la persistance du PaymentIntent et le passage effectif de l’ordonnanceur.
