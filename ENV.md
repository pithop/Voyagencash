# Configuration de voyagencash

Toutes les variables ci-dessous sont **serveur uniquement**. Sur Vercel : Project → Settings → Environment Variables, sélectionner les environnements souhaités, puis redéployer. Ne jamais préfixer ces secrets avec `PUBLIC_`, `VITE_` ou `NEXT_PUBLIC_`.

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

`vercel.json` configure un appel à `GET /api/orders/fulfil` chaque minute. Renseignez `CRON_SECRET` : Vercel fournit automatiquement l’en-tête `Authorization: Bearer <CRON_SECRET>`. Cette fréquence nécessite un plan Vercel qui autorise les crons à la minute ; sur un plan ne les autorisant pas, retirez `crons` et configurez un ordonnanceur externe avec ce même en-tête. L’alternative sur un worker Node est `npm run fulfil` ; chaque exécution traite une commande. Dimensionnez la fréquence et le nombre de workers pour le volume attendu. Réappliquez `server/schema.sql` pour ajouter `next_attempt_at` aux installations existantes (migration idempotente).

**Ce worker peut débiter le solde Duffel** après une notification partenaire authentifiée et persistée. Il n’est jamais exécuté par les tests contre Duffel. Une réponse de paiement acceptée est persistée avant la relecture des billets. Les tâches `awaiting_documents` relisent ensuite uniquement la commande, au plus une fois par minute. Les tentatives ambiguës sont placées en `reconciliation_required`, sans nouvel essai de débit. Réconcilier avec Duffel et le partenaire avant toute reprise. Une notification tardive est classée `refund_pending`, sans émission automatique du billet.

Avant l’activation : migrations, TLS PostgreSQL, contrat adaptateur, signature HMAC sur corps brut, annuaire confirmé, supervision de l’outbox et limitation des requêtes publiques au niveau du WAF doivent être opérationnels. Les certificats Apple restent chez le service partenaire Wallet ; ils ne sont jamais envoyés au navigateur.

Vercel : [désactivation des helpers Node](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration). Sans secret de signature sur Vercel, le parcours de démonstration se replie explicitement sur un bon local non signé par le serveur.
