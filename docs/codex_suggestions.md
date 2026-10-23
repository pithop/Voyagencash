# Voyagencash — Audit architectural et recommandations actionnables

Audit du 23 octobre 2026, sur le commit `da27b81`. Point d’entrée : [architecture_graph.md](architecture_graph.md), confronté à l’implémentation et aux tests.

**Décision recommandée : conserver le frontend léger, les fonctions Vercel et PostgreSQL, mais fiabiliser la chaîne encaissement–émission avant d’élargir le catalogue ou de monétiser les options.** Le principal frein à la conversion est actuellement l’écart entre les parcours présentés et les opérations réellement exécutables. Une refonte de framework ne le résoudrait pas.

Les recommandations ci-dessous distinguent les faits observés, les risques déduits et les évolutions proposées. Les délais sont des ordres de grandeur en jours de travail, hors contractualisation partenaire. Les objectifs de performance et de conversion sont des cibles à mesurer, pas des gains démontrés.

## Périmètre et niveau de preuve

Revue des douze handlers `api/`, des six modules `server/`, du schéma SQL, des contrôleurs `assets/js/`, des deux feuilles CSS, du shell HTML, des scripts de build/service/émission et des suites de tests. Lecture du graphe, de `README.md`, `ENV.md`, `IMPLEMENTATION.md` et de `docs/travelfusion.md`. Les documents stratégiques et les dépôts historiques ont été consultés comme contexte, sans reprendre leurs chiffres de coûts ni leurs affirmations réglementaires comme des vérités actuelles.

Les répertoires `depot-payencash-2026-09/` et `depot-grossiste-audits/` contiennent des spécifications, prototypes et audits antérieurs. Ils ne sont pas copiés par [scripts/build.mjs](../scripts/build.mjs). Leurs écrans manager, commerçant ou hotline ne constituent donc pas un back-office livré dans l’application active. Le README historique décrit notamment un mécanisme de bons et de financement commerçant différent du checkout actuel : documenter explicitement lequel s’applique au contrat partenaire réellement déployé.

Des reproductions locales ont utilisé `pg-mem`, des secrets fictifs et un `fetch` bloquant tout accès externe. Elles ne constituent ni une exploitation de production, ni une preuve de fonctionnement des contrats fournisseurs. Aucune réservation, aucun paiement réel, aucune migration ni aucun déploiement n’ont été effectués. Le compte Stripe, la base de production, les logs Vercel et les adaptateurs privés n’ont pas été inspectés.

## 1. Architecture réelle et écarts avec le graphe

### Les fondations à préserver

- Frontend sans framework lourd, police Manrope locale, icônes SVG, dialogues natifs, gestion du focus, prise en charge de `prefers-reduced-motion` et contrôles d’absence d’emoji au build.
- Prix de retenue Duffel relu côté serveur et comparé au montant accepté ; création d’un ordre `hold` sans débit fournisseur immédiat.
- Webhook PayEnCash vérifiant le corps brut, la signature, la référence, le montant et la devise ; écriture de l’événement et de l’outbox dans une transaction.
- Worker conscient des réponses de paiement ambiguës et des documents différés : il évite de répéter aveuglément un débit.
- Données low-cost chiffrées en AES-256-GCM avec identifiant du dossier comme donnée associée, clé d’idempotence persistée et consultation de l’adaptateur par `clientReference`.
- Tests existants couvrant plusieurs règles métier, les fuseaux horaires, les petits écrans et la dégradation de certaines dépendances.

### Les garanties à corriger dans la documentation

| Description actuelle | Implémentation observée | Conséquence |
| --- | --- | --- |
| Trois fournisseurs interrogés simultanément | [server/flights.js](../server/flights.js), l. 115–128 : Duffel **et soit** Travelfusion **soit** Ryanair. Travelfusion configuré remplace Ryanair. | Décrire le routage conditionnel ; une panne Travelfusion ne déclenche pas de repli Ryanair. |
| Fusion et déduplication | Même module, l. 138 : concaténation puis tri. | Aucun regroupement explicite des itinéraires identiques entre sources. |
| Ryanair fournit des tarifs confirmés | [server/ryanair.js](../server/ryanair.js), l. 95–161 : minimum journalier appliqué aux horaires du jour, multiplié par le nombre d’adultes ; `provider: "ryanair-indicative"`. | Ni prix par vol ni disponibilité de plusieurs places ne sont confirmés. |
| Carte disponible sur tous les vols et au-delà de 1 000 € | [api/orders/hold.js](../api/orders/hold.js), l. 108–247 : configuration PayEnCash obligatoire, plafond de 1 000 €, refus du paiement instantané, garantie de deux heures exigée. | La carte Duffel hérite des restrictions espèces avant même de créer un PaymentIntent. |
| Toute confirmation passe par l’outbox | [api/orders/status.js](../api/orders/status.js), l. 14–39 : un PaymentIntent peut directement produire `ticket_issued`. | Paiement client et émission compagnie sont confondus. |
| Émission déclenchée par Vercel Cron | [vercel.json](../vercel.json) ne contient pas de section `crons`, malgré l’affirmation de [ENV.md](../ENV.md). | Aucun déclenchement périodique n’est démontré par le dépôt ; un ordonnanceur externe peut exister, mais reste à vérifier. |
| `SKIP LOCKED` garantit l’absence de double paiement | [server/fulfil.js](../server/fulfil.js), l. 7–17 : revendication transactionnelle, puis appel réseau hors transaction. | Bon contrôle de concurrence, mais pas de transaction distribuée ni de reprise automatique après crash. |
| Fallback mémoire PostgreSQL | [server/database.js](../server/database.js) exige une connexion ; `pg-mem` est injecté dans les tests. | Aucun stockage mémoire de secours en production, ce qui est souhaitable pour les commandes. |
| JWT légers | [server/http.js](../server/http.js) signe un payload Base64url avec HMAC en deux parties. | Ce sont des capacités signées propriétaires, pas des JWT standards. |
| Low-cost intégré au checkout hybride | [server/travelfusion.js](../server/travelfusion.js), l. 118–174 : dossier séparé et appel `bookings`, sans paiement Stripe/PayEnCash préalable dans ce flux. | Le financement fournisseur appartient à l’adaptateur ; l’encaissement client reste à articuler explicitement. |

Le dépôt contient bien **12 fonctions** ; les deux routes low-cost supplémentaires sont des réécritures. Conserver ce budget est possible. Il ne faut toutefois pas présenter « 12 maximum » comme une règle universelle de Vercel : la documentation actuelle distingue les limites selon le framework. Le cron Hobby est quotidien et l’offre Hobby vise un usage personnel non commercial ; elle n’est pas une base adaptée à une émission commerciale sous deux heures. Vérifier l’offre réellement utilisée avant activation. [Limites Vercel](https://vercel.com/docs/limits), [cron et fréquence](https://vercel.com/docs/cron-jobs/usage-and-pricing), [plan Hobby](https://vercel.com/docs/plans/hobby).

### Registre des priorités

P0 = bloquant pour un encaissement réel fiable ; P1 = prochaine livraison ; P2 = enrichissement après stabilisation.

| ID | Priorité | Action | Effort indicatif | Responsable principal |
| --- | --- | --- | --- | --- |
| A01 | P0 | Faire de `orders/status` une lecture ; supprimer les faux billets | 1–2 j | Backend |
| A02 | P0 | Fermer le webhook Stripe sans secret et rapprocher chaque encaissement | 2–4 j | Backend paiement |
| A03 | P0 | Authentifier et rendre idempotente la création des PaymentIntents | 2–3 j | Backend paiement |
| A04 | P0 | Mettre en service l’ordonnanceur, la reprise et la supervision d’outbox | 3–6 j | Backend / exploitation |
| A05 | P0 | Séparer explicitement démo, devis, carte, espèces et conciergerie | 2–4 j pour les garde-fous | Full-stack |
| A06 | P1 | Isoler les pannes fournisseurs et borner les budgets réseau | 2–4 j | Backend recherche |
| A07 | P1 | Corriger provenance, fraîcheur et comparabilité des prix | 3–5 j | Backend / produit |
| A08 | P1 | Réduire les recherches doublonnées et mutualiser les caches | 2–4 j | Full-stack |
| A09 | P1 | Déployer une machine de commande et un registre des paiements communs | 5–10 j | Backend paiement |
| A10 | P1 | Réparer le parcours carte puis intégrer les wallets éligibles | 3–6 j hors émission instantanée | Full-stack |
| A11 | P1 | Reprise de dossier, instrumentation de conversion et marge | 3–6 j | Produit / full-stack |
| A12 | P1 | Harmoniser les composants, textes et états d’interaction | 3–5 j | Frontend / design |
| A13 | P2 | Lancer les fonctionnalités différenciantes par pilotes mesurables | Voir section 5 | Produit |

Les lots partagent des travaux : ne pas additionner mécaniquement ces estimations. La recette partenaire et les scénarios de compensation sont sur le chemin critique.

## 2. Performance et résilience des connecteurs aériens

### A06 — Rendre la recherche tolérante à une panne partielle

**Constat.** `Promise.all([duffelPromise, lowCostPromise])` fait échouer la recherche entière si Duffel ou Travelfusion rejette. Ryanair transforme, à l’inverse, nombre d’échecs en tableaux vides sans distinguer panne et absence de vol. Une reproduction locale avec Duffel indisponible et une offre low-cost valide retourne bien une erreur 504 globale.

**Implémentation proposée.**

1. Extraire une interface de connecteur dans `server/providers/` : `search`, `reprice`, `capabilities`, puis `createOrder` et `getOrder` lorsqu’ils sont réellement supportés. Garder `server/flights.js` comme orchestrateur.
2. Interroger chaque fournisseur sélectionné avec son propre délai et utiliser `Promise.allSettled`. Cette primitive seule n’améliore pas la latence : les délais doivent aussi être bornés.
3. Retourner `providers: [{name, status, elapsedMs, offerCount, errorCode}]`, `partial`, `requestId` et les offres valides. Distinguer `ok`, `empty`, `timeout`, `unavailable` et `disabled`.
4. Répondre 200 avec `partial: true` lorsqu’un fournisseur a réussi, même si son résultat est vide ; afficher alors une couverture incomplète. Répondre 503 si tous les fournisseurs sélectionnés ont échoué. Ne jamais inventer une offre de remplacement.
5. Ne pas activer systématiquement trois appels : sélectionner les sources selon le trajet, leur couverture observée et leurs contrats. Ryanair indicatif ne remplace jamais une offre réellement réservable sans changement explicite de présentation.
6. Tester un budget de recherche global de 10–12 s, Ryanair à 3,5 s et Duffel/Travelfusion à 8–10 s. Ce sont des valeurs de départ à confronter au taux d’offres reçues, surtout sur les corridors moins couverts. Pour Duffel, fixer `supplier_timeout` en dessous du délai HTTP pour recevoir les résultats déjà disponibles. [Recherche Duffel](https://duffel.com/docs/api/v2/offer-requests).

**Critères d’acceptation.** Duffel en 500 + Travelfusion valide donne des résultats partiels ; Travelfusion bloqué n’empêche pas Duffel ; JSON malformé d’un fournisseur n’annule pas les offres des autres ; aucune réponse tardive ne remplace les résultats d’une recherche plus récente. Mesurer latence p50/p95 et couverture avant/après, par fournisseur et corridor.

**Deuxième étape seulement.** Si le délai reste pénalisant, évaluer les offres par lots Duffel ou un flux HTTP progressif sur la fonction existante. Conserver le même `searchId` et une liste stable ; ne pas relancer une recherche complète toutes les deux secondes. Un retour HTTP ne doit pas laisser des promesses réseau sans mécanisme d’exécution durable. [Offres Duffel par lots](https://duffel.com/docs/api/v2/batch-offer-requests/create-batch-offer-request).

### A07 — Ne plus confondre un prix indicatif et une offre achetable

**Constats.** Le minimum Ryanair d’une journée est attribué à chaque horaire. Le calendrier peut ensuite remplacer un minimum observé par un tarif indicatif inférieur. À chaque lecture, il réécrit `observedAt: Date.now()` même si `fetchFares` a servi un cache vieux de plusieurs minutes. L’ancien prix peut ainsi paraître plus récent qu’il ne l’est. Le libellé global `duffel-cache` masque aussi sa provenance. Enfin, le minimum journalier du moteur privilégie les vols directs lorsqu’il en existe ; ce n’est pas toujours le minimum de toutes les offres.

**Changements précis.**

- Introduire `priceKind: "indicative" | "quoted" | "held"`, `provider`, `observedAt`, `expiresAt`, `passengerMix`, `totalAmountCents`, `unitAmountDisplay` et `cashEligible` calculé côté serveur.
- Conserver séparément `minDirectQuoted`, `minAnyQuoted` et `indicativeFrom`. Le calendrier « vol direct » ne doit pas afficher le prix d’un itinéraire avec escale. Une observation vide issue d’une recherche partielle ne prouve pas l’absence de vol.
- Transmettre la date réelle d’observation depuis le connecteur ; une lecture du cache ne renouvelle ni l’observation ni l’expiration. Remplacer une observation périmée sur sa fraîcheur, pas seulement si le nouveau prix est inférieur.
- Afficher Ryanair comme « Dès …, tarif indicatif à vérifier », sans garantir ce montant pour chaque horaire ou pour neuf voyageurs. Une réservation ou un paiement exige une revalidation par un canal capable de confirmer l’inventaire.
- Étendre `fare_observations` avec des dimensions explicites — origine, destination, date, composition des voyageurs, devise, source, type de prix — plutôt qu’un unique JSON fusionné par trajet. Indexer ces dimensions et purger les observations expirées.
- Au résultat, grouper les offres par itinéraire : aéroports, transporteur opérant, numéro, instants de départ de chaque segment. Conserver les variantes tarifaires, bagages, conditions, fournisseurs et éligibilités au paiement dans ce groupe. Deux tarifs sur le même vol ne sont pas forcément interchangeables.
- Revalider l’offre sélectionnée avant paiement et montrer le delta en centimes. Une hausse exige une nouvelle acceptation ; aucune substitution automatique de vol ou d’options.

**Recette.** Deux horaires Ryanair ne deviennent pas deux devis fermes au minimum journalier ; un prix indicatif inférieur ne remplace pas un prix réservé ; trois adultes sont revalorisés ensemble ; une offre avec bagage et une offre sans bagage restent distinctes ; le calendrier ne rafraîchit pas artificiellement l’âge d’un cache.

### A08 — Économiser les appels avant d’ajouter de l’infrastructure

**Constats.** `refreshAvailability` dans [assets/js/app.js](../assets/js/app.js), l. 185–203, effectue une recherche complète ; `renderResults` en refait une pour les mêmes critères. Les compteurs de génération empêchent un affichage obsolète, mais n’annulent pas le réseau. [api-client.js](../assets/js/api-client.js) mutualise déjà les calendriers simultanés ; il faut préserver cette bonne pratique. Les caches Ryanair sont propres à chaque processus et ne sont pas partagés entre fonctions Vercel.

**Plan minimal.**

1. Ajouter une clé canonique de recherche incluant trajets, dates, composition voyageurs, cabine, devise, filtres envoyés au fournisseur et mode test/live.
2. Mutualiser les promesses simultanées de recherche et réutiliser les résultats entre aperçu et page résultats pendant 20–30 s, sans dépasser l’expiration fournisseur. Séparer cache d’inspiration et session contenant des offres réservables : les identifiants d’offres/passagers ne doivent pas être partagés aveuglément entre clients.
3. Propager un `AbortSignal` depuis le contrôleur de vue vers `FlightAPI.request` ; annuler les lectures devenues inutiles. Une annulation du navigateur ne prouve pas qu’une création de commande ou un débit a été annulé : ces écritures doivent être reprises par leur identifiant durable.
4. Appliquer un debounce de 250–350 ms aux prévisualisations et éviter de rechercher une offre complète à chaque modification qui ne change pas les critères.
5. Utiliser PostgreSQL existant comme premier cache partagé de données publiques, sans voyageurs ni capacités d’achat. Respecter les droits de cache de chaque fournisseur. Une politique « ancienne valeur pendant revalidation » convient au calendrier indicatif, pas à un prix payable expiré.
6. Borner aussi la `Map observations` alimentée par les lectures calendaires ; la limite actuelle de la recherche ne couvre pas toutes les insertions. Centraliser la détection de la base : `POSTGRES_PRISMA_URL` est accepté par `database.js`, mais oublié dans plusieurs garde-fous appelants.
7. Placer base et fonctions au plus près dans les régions contractuellement appropriées. Avec `max: 3` dans chaque pool, N instances peuvent demander environ 3N connexions ; mesurer la concurrence totale et utiliser le pool de connexions de l’hébergement existant.

**Objectifs proposés.** Une seule recherche fournisseur pour un aperçu immédiatement suivi des résultats ; calendrier servi du cache partagé en moins de 300 ms côté API au p95 ; baisse mesurée des appels par recherche utilisateur. Ne pas ajouter un nouveau service de cache tant que le profilage ne justifie pas cette charge d’exploitation.

### Résilience réseau et qualité des contrats

- Ajouter un coupe-circuit par fournisseur pour les lectures : seuil initial proposé de cinq échecs transitoires, ouverture 30 s, une sonde de reprise. Si nécessaire, partager son état entre instances ; une `Map` seule ne protège pas tout le déploiement.
- Réessayer au maximum une lecture transitoire dans le budget restant, avec délai aléatoire et respect de `Retry-After`. Une recherche Duffel est un POST pouvant générer du coût : ne pas la rejouer automatiquement comme un GET gratuit.
- Ne jamais réessayer génériquement `orders`, `payments` ou `StartBooking` après une réponse ambiguë. Chercher l’opération existante ou demander un rapprochement. Duffel avertit qu’un paiement retournant 500 peut néanmoins avoir été créé. [Paiements Duffel](https://duffel.com/docs/api/v2/payments).
- Valider chaque réponse externe : montants finis et positifs, devise, expiration, continuité des segments, nombre de voyageurs, aéroports et horaires. Isoler les offres malformées plutôt que faire échouer toute la normalisation ; conserver un compteur d’erreurs de contrat.
- Remplacer les `catch {}` sans visibilité par des logs structurés expurgés : `requestId`, fournisseur, opération, code et durée. Pas de passager, token, `client_secret`, clé ou corps fournisseur intégral dans les logs.
- Limiter le débit des routes publiques de recherche et création, par session et adresse réseau avec quotas adaptés aux réseaux partagés. Le contrôle d’`Origin` existant n’authentifie pas un client serveur.

## 3. Checkout : fiabilité, conversion et monétisation

### A01 — Le statut de consultation ne doit jamais émettre un billet

**Preuve.** [api/orders/status.js](../api/orders/status.js), l. 14–39, écrit directement `ticket_issued` si un PaymentIntent est `succeeded` et possède la bonne métadonnée, sans débit Duffel ni vérification des documents. Sans clé Stripe, un identifiant commençant par `pi_sim_` suffit, même lorsque `VOYAGENCASH_TEST_MODE` est absent. Reproduction locale : une commande de 142 € passe à `ticket_issued` avec `pi_sim_arbitrary`.

Le même endpoint fabrique des documents `{type: "electronic_ticket", url: "#"}` lorsque la lecture Duffel échoue, ou pour un identifiant ne correspondant pas à Duffel. Côté navigateur, [live-booking.js](../assets/js/live-booking.js), l. 265, suppose pourtant que `ticket.slices` existe : ce faux document peut aussi provoquer une erreur de rendu.

**Action.** Supprimer les écritures de `status`, le paramètre de confirmation et les documents de secours fictifs. Le statut lit une projection persistée ; seul le worker autorisé valide l’émission à partir d’une preuve fournisseur conforme au type de réservation. Pour Duffel, vérifier paiement et documents attendus ; pour un transporteur sans billet électronique classique, définir un contrat de confirmation spécifique. Le navigateur affiche « Paiement reçu, émission en cours » tant que cette preuve manque. Une indisponibilité de consultation ne supprime pas un billet déjà vérifié : servir la preuve persistée, avec son horodatage.

**Recette bloquante.** Un paiement Stripe réussi seul ne produit jamais `ticket_issued`. Un `pi_sim_` fourni sur un dossier réel est refusé. Un échec Duffel n’invente aucun numéro de billet. Une réponse partielle ne casse pas le rendu. Le Wallet ne devient disponible qu’après confirmation fournisseur validée.

### A02 — Rapprocher Stripe avec la même rigueur que PayEnCash

**Preuves.** [api/stripe/webhook.js](../api/stripe/webhook.js) ne vérifie la signature que si le secret est présent. `amountReceived` est lu mais jamais comparé au montant dû ; la devise, le PaymentIntent attendu et l’état métier ne sont pas contrôlés. Une base absente conduit à un accusé 200 sans persistance. Un nouvel événement pour une commande déjà émise peut ramener son statut à `payment_received`, alors que son outbox reste `complete`.

Reproduction locale : un événement non signé annonçant 1 centime en USD pour une commande de 142 € en EUR est accepté avec `payment_received` lorsque le secret webhook manque. Ce résultat démontre le comportement local dans cette configuration ; il ne révèle pas la configuration de production.

**Actions.**

1. Refuser l’endpoint si le secret webhook ou le stockage requis manque. Utiliser la vérification officielle Stripe sur les octets bruts, avec rotation des signatures et horodatage valides, plutôt qu’un parseur HMAC maison. [Webhooks Stripe](https://docs.stripe.com/webhooks).
2. En transaction, verrouiller la commande et la tentative de paiement ; vérifier `payment_intent_id`, montant reçu exact, devise, environnement test/live et état autorisé.
3. Identifier les événements par `(provider, event_id)` et les encaissements par `(provider, payment_id)` : deux événements différents peuvent concerner le même encaissement. Enregistrer la tentative avant toute livraison.
4. Ne pas régresser un état final. Acquitter les doublons déjà enregistrés ; conserver les paiements inattendus dans une boîte de rapprochement durable, sans émettre de billet. Renvoyer une erreur réessayable si la base n’a pas pu enregistrer l’événement.
5. Pour un paiement reçu après expiration, enregistrer séparément l’heure d’encaissement et l’heure de livraison webhook. Vérifier la situation fournisseur avant d’émettre ou de rembourser ; l’heure d’arrivée HTTP n’est pas nécessairement l’heure du paiement.
6. Gérer les remboursements comme des opérations persistées et idempotentes, avec identifiant partenaire, montant, statut et dernier contrôle. `refund_pending` seul n’est pas un remboursement exécuté.

**Recette.** Secret absent, signature invalide, mauvaise devise, montant partiel, mauvais PaymentIntent, événement livré deux fois, événements désordonnés, base indisponible et paiement après expiration. Chaque scénario doit avoir une issue explicite et conserver la trace du rapprochement.

### A03 — Une commande, une tentative active de paiement

**Constats.** [api/stripe/create-intent.js](../api/stripe/create-intent.js) accepte un `orderId` sans capacité d’accès ; si une ligne existe, elle suffit à obtenir un PaymentIntent. Un `orderId` peut être différent du `hold.id`. Le handler ne filtre pas les commandes déjà payées, n’enregistre pas le PaymentIntent et ne transmet pas de clé d’idempotence Stripe. Une erreur SQL est ignorée et le prix peut retomber sur le token. Sans clé Stripe, il fabrique un PaymentIntent simulé. Enfin, `!process.env.VOYAGENCASH_TEST_MODE` traite la chaîne `"false"` comme une valeur activant indirectement le comportement de simulation.

**Correction.** Exiger une capacité valide liée à la commande et à l’opération, vérifier la concordance des identifiants, relire le prix et l’état en base et échouer explicitement si cette lecture est impossible. Centraliser les flags avec comparaison stricte à `"true"` ; distinguer environnement démo et sandbox fournisseur.

Créer `payment_attempts` avec `order_id`, `provider`, `provider_payment_id UNIQUE`, `quote_version`, `amount_cents`, `currency`, `state` et `idempotency_key UNIQUE`. Réserver la tentative en transaction courte ; créer le PaymentIntent hors transaction avec une clé stable telle que `order:{id}:quote:{version}:attempt:{n}`, puis persister sa réponse. Après timeout, reprendre cette tentative avec la même clé et les mêmes paramètres. Si l’ambiguïté persiste au-delà de la durée de conservation d’idempotence du prestataire, rapprocher plutôt que créer une nouvelle tentative.

Réutiliser le PaymentIntent au retour arrière et au rechargement tant que le devis est inchangé. Ne pas changer son montant après confirmation. [Cycle de vie et réutilisation des PaymentIntents](https://docs.stripe.com/payments/payment-intents).

**Recette.** Dix clics concurrents ne créent qu’une tentative active ; aucun PaymentIntent ne peut être créé avec le seul identifiant d’une commande ; un token d’une autre commande est rejeté ; un paiement déjà reçu ne peut pas être relancé ; une configuration réelle incomplète ne produit jamais un succès simulé.

### A04 — Une outbox exploitable après crash, pas seulement après exception

**Constats.** Le worker traite une commande par invocation. Son état `processing` est commité avant le réseau, mais aucun bail, horodatage de revendication ni processus de récupération ne permet de retrouver une tâche abandonnée. Trois appels Duffel successifs de 25 s peuvent dépasser les 60 s configurées pour la fonction. `awaiting_documents` peut tourner sans limite. `refund_pending` et `reconciliation_required` n’ont aucun processeur opérationnel livré. Pour un identifiant ne commençant ni par `off_` ni par `ord_`, le worker déclare même directement un billet émis.

**Plan.**

- Déclarer un ordonnanceur vérifié appelant la fonction existante et surveiller son dernier passage. Une fréquence à la minute est un point de départ, pas une garantie de délai d’émission. Garder un mécanisme de rattrapage périodique même si un déclenchement rapide après paiement est ajouté.
- Ajouter `attempt_count`, `claimed_at`, `lease_until`, `claim_token`, `phase`, `last_error_code`, `updated_at` et une échéance métier à l’outbox. Chaque mise à jour de worker doit vérifier son `claim_token` pour empêcher un ancien worker de modifier une tâche reprise.
- Séparer les phases `verify_order`, `payment_in_flight`, `awaiting_documents` et `complete`. Persister la phase avant le débit ; un crash autour du débit reste ambigu et impose une consultation fournisseur ou un rapprochement.
- Un bail expiré ne doit **jamais** remettre aveuglément un paiement en `pending`. Reprendre automatiquement les lectures sûres ; pour les écritures potentiellement exécutées, vérifier leur résultat avant toute décision.
- Appliquer un budget global inférieur à la durée Vercel, par exemple 45–50 s, avec réserve pour le commit. Borner chaque opération par le temps restant. Décliner tout nouveau travail si la réserve est insuffisante ; ne pas démarrer un débit que l’on sait ne pas pouvoir suivre.
- Traiter plusieurs petites tâches par invocation si le budget le permet, avec concurrence bornée ; ne pas allonger indéfiniment la fonction. Prioriser les commandes dont la limite fournisseur est proche, en évitant la famine des autres.
- Ajouter une reprise exponentielle avec dispersion pour les lectures, une durée maximale d’attente des documents et une alerte opérateur. Supprimer le succès implicite des identifiants inconnus : le `provider` et le `mode` doivent être des colonnes, pas déduits du préfixe.

`SKIP LOCKED` est adapté à la revendication concurrente d’une file ; il ne garantit pas l’unicité d’un effet externe après interruption. La documentation PostgreSQL décrit précisément cette limite de la vue obtenue. [Verrouillage PostgreSQL](https://www.postgresql.org/docs/current/sql-select.html).

**Recette indispensable sur PostgreSQL réel.** Deux workers concurrents ; arrêt après claim ; arrêt après paiement externe mais avant commit ; timeout pendant la relecture ; documents différés ; expiration de bail pendant qu’un ancien worker répond ; backlog supérieur à la capacité. Vérifier qu’aucun débit n’est réessayé sans preuve et qu’aucune tâche ne reste invisible.

### A05 / A09 — Séparer capacités de paiement et cycle de réservation

**Parcours réellement à supporter.**

| Type d’offre | Parcours recommandé | Condition préalable |
| --- | --- | --- |
| Duffel avec retenue | Espèces si éligible ; carte possible avec sa politique propre | Limites et prix garantis confirmés, commande persistée |
| Duffel à paiement immédiat | Parcours carte dédié | Saga émission instantanée, financement fournisseur et compensations testés |
| Travelfusion réservable | Paiement client articulé au contrat d’émission de l’adaptateur | Ne pas déclencher l’achat sans règle de financement explicite |
| Ryanair indicatif | Vérification, conciergerie ou départ vers le canal officiel | Pas de bon encaissable ni de promesse de tarif bloqué |
| Démonstration | Simulation explicitement choisie et isolée | Aucun secret live ni mutation d’un dossier réel |

**Problèmes UI actuels.** `renderOptions` choisit le checkout réel seulement si `FlightAPI.checkout` est vrai ; ce flag représente PayEnCash, pas Stripe. Sinon il convertit les offres en `simulation: true`. Une configuration carte seule n’ouvre donc pas un véritable checkout carte. Pour plusieurs trajets Duffel, `LiveBooking.mount` calcule le total de tous les vols mais envoie seulement le premier `offerId`. Les allers-retours proposés par le formulaire initial ne correspondent pas à une réservation réelle multi-trajets aboutie.

**Contrat cible.** `/api/config` expose des capacités indépendantes : `searchLive`, `cashCheckout`, `cardCheckout`, `lowCostBooking`, `wallet`, avec environnement explicite. La présence d’une clé publique Stripe ne suffit pas à prouver l’activation serveur. Chaque offre expose ensuite les capacités effectivement utilisables. Déterminer le parcours avant la saisie des voyageurs ; ne pas demander tout un formulaire avant d’annoncer une impossibilité connue.

Pour la commande, séparer au minimum `payment_state`, `fulfilment_state` et `reservation_state`. Une commande peut être payée sans être émise ; une réservation fournisseur peut être confirmée alors que la capture client a échoué. Ajouter un historique append-only des transitions avec cause et identifiant de corrélation.

```text
devis accepté → réservation / retenue → paiement client vérifié
                                      → tâche d’émission persistée
                                      → confirmation fournisseur
                                      → billet disponible

Toute réponse ambiguë → rapprochement
Échec définitif après encaissement → compensation suivie → remboursement confirmé
```

**Paiement instantané.** Évaluer une autorisation carte avant émission, suivie d’une capture, uniquement pour les moyens éligibles. L’autorisation Stripe ne réserve ni le prix ni le siège. La saga doit traiter : changement de prix, expiration d’autorisation, refus fournisseur, réponse fournisseur ambiguë, capture refusée après achat et annulation possible ou impossible. Lire `capture_before` et ne pas coder une durée universelle. Prévoir une réserve de financement fournisseur ; l’encaissement Stripe ne crédite pas instantanément le solde Duffel. [Autorisation et capture Stripe](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method).

**Carte et bon simultanés.** Un bouton caché ne suffit pas. Persister le moyen actif et sa version ; avant de basculer vers la carte, invalider le bon chez le partenaire et attendre la confirmation. Si le partenaire ne permet pas cette invalidation fiable, interdire la bascule tant que le bon est payable. Un encaissement tardif sur l’ancien moyen reste à journaliser et à rembourser, sans seconde émission. Le webhook PayEnCash actuel renvoie 409 pour un nouvel événement sur une commande déjà traitée : remplacer cette impasse par un traitement durable des encaissements excédentaires.

**Transactions courtes.** [api/payencash/voucher.js](../api/payencash/voucher.js) conserve aujourd’hui un verrou SQL pendant un appel partenaire pouvant durer 15 s. Créer une tentative d’émission de bon sous verrou, libérer la transaction, appeler l’adaptateur avec sa clé idempotente, puis enregistrer le résultat. Prévoir une recherche par référence pour rapprocher une réponse perdue. Tester également le webhook reçu avant la fin de création du bon.

### A10 — Un checkout qui explique le choix et permet de le terminer

- Afficher avant les voyageurs le total du groupe, les inclusions, le caractère indicatif ou confirmé et les moyens réellement disponibles. Si l’espèce est possible, présenter l’heure limite exacte ; la durée ne doit pas être une promesse fixe de 120 minutes pour toutes les offres. [Retenues Duffel](https://duffel.com/docs/guides/holding-orders-and-paying-later).
- Présenter deux choix explicites « Payer par carte » et « Payer en point partenaire » lorsque tous deux sont possibles. Ne pas créer automatiquement un bon avant ce choix : `preferredPayment` privilégie actuellement le bon et `showVoucher` le charge avant même de vérifier le statut.
- Sur reprise, consulter d’abord le statut, puis afficher uniquement l’action encore utile. Masquer et désactiver le paiement après encaissement ou expiration. Détruire les Elements au démontage de la vue et appliquer les gardes de génération à toutes les réponses asynchrones.
- Remplacer `elements.create("card")` par Payment Element et, si utile, Express Checkout Element. La mention « Carte bancaire & Apple Pay » actuelle ne correspond pas à un bouton Apple Pay implémenté. N’afficher un wallet qu’après détection de sa disponibilité et configuration du domaine. [Express Checkout Element](https://docs.stripe.com/elements/express-checkout-element).
- Corriger d’abord les PaymentIntents existants. Pour une évolution plus large, comparer Checkout Sessions avec Elements au maintien du contrôle PaymentIntents ; documenter la décision selon la retenue aérienne, le rapprochement et les options nécessaires. Ne pas cumuler deux machines de paiement pendant une migration non maîtrisée.
- Filtrer les moyens de paiement selon leur délai de confirmation compatible avec l’échéance aérienne ; activer des moyens dynamiques ne signifie pas accepter toute méthode asynchrone. Tester 3DS, retour de redirection, annulation et perte réseau.
- Supprimer le fallback visuel « carte 4242 » du mode réel. L’échec de montage de Stripe affiche une erreur avec reprise ; il ne devient jamais `confirmed = true`.
- Conserver les passagers pendant une navigation dans le formulaire, sans les placer durablement en clair dans `localStorage`. Persister immédiatement la référence de dossier et la clé de reprise côté serveur ; la clé UUID créée à chaque montage ne protège pas les retours après rechargement.
- Dans le parcours low-cost, conserver un moyen de retrouver le dossier : actuellement le token reste dans la fermeture du bouton d’actualisation et n’apparaît pas dans « Mes réservations » après rechargement.

**Expérimentations après correction.** Comparer le choix de paiement visible dès le récapitulatif à sa présentation après les voyageurs ; mesurer l’accès au paiement, l’encaissement et surtout le billet émis. Comparer le wallet proposé lorsqu’éligible au formulaire carte seul. Répartir les variantes par session stable, segmenter mobile/desktop et carte/espèces, et conserver le taux de remboursement comme garde-fou. Aucun gain en pourcentage n’est présumé.

### A11 — Monétiser un service réel et mesurer la marge nette

**Constat.** Les 35 € de bagage et 19 € de « garantie annulation » appartiennent à la démo de [booking-manager.js](../assets/js/booking-manager.js) et au parcours simulé. Le checkout réel n’a pas de moteur de marge. `flight_orders.amount_cents` sert à la fois de prix client et de montant comparé au débit Duffel : y ajouter simplement une commission ferait échouer le rapprochement fournisseur.

**Modèle à introduire avant toute marge.**

```text
supplier_amount_cents       = prix payable au fournisseur
ancillary_supplier_cents    = options réellement commandées, sans double comptage
service_fee_cents           = service Voyagencash annoncé et accepté
discount_cents             = remise financée identifiée
customer_total_cents       = montant dû par le client
pricing_version            = règle de prix et devis acceptés
```

Si le total fournisseur inclut déjà des options, conserver leur ventilation sans les ajouter une deuxième fois. Le worker paie le prix fournisseur ; Stripe/PayEnCash encaisse le total client. Conserver la devise et les arrondis en centimes de bout en bout. Le plafond espèces applicatif existant s’évalue sur le total client, pas seulement le billet. Il ne s’agit pas ici d’une validation juridique du seuil ou de la qualification des bons.

**Ordre de monétisation conseillé.**

1. Frais de service transparents, annoncés dans le total avant confirmation, en échange d’une assistance et d’un suivi réellement opérés. Formaliser les prestations, les horaires et le traitement des échecs.
2. Bagages et sièges au prix fournisseur revalidé, avec ventilation de la rémunération éventuelle. Relier chaque service à son passager et à son segment. Vérifier le support dans le parcours de retenue avant de proposer un supplément : ne pas réutiliser les options forfaitaires de démo comme inventaire réel.
3. Service de préparation au départ, après avoir démontré l’utilité : rappel d’enregistrement, récapitulatif accessible, assistance aux modifications. Ne pas appeler cela « assurance » ou « garantie annulation » sans produit et conditions correspondants.
4. Recommandations commerciales supplémentaires seulement après stabilité de l’émission et mesure de la satisfaction ; une redirection Ryanair n’implique aucune commission acquise sans accord.

**Économie unitaire.** Calculer par dossier émis : recette de service + rémunération contractuelle − frais d’acquisition − frais de paiement − coût de recherche/émission − coût d’assistance − pertes et compensations. Ne pas confondre volume de billets encaissé et chiffre d’affaires de marge. Simuler les politiques de prix sur des données contractuelles, sans reprendre les coûts chiffrés des anciens documents comme tarifs fournisseurs actuels.

**Instrumentation minimale.** `search_started`, `search_completed`, `offer_selected`, `quote_repriced`, `passengers_validated`, `payment_method_selected`, `payment_started`, `payment_received`, `ticket_issued`, `refund_requested`, `refund_completed`, `concierge_resolved`. Les trois derniers jalons de paiement/émission doivent provenir du serveur. Conserver des identifiants pseudonymes de session, devis et commande ; exclure les coordonnées et tokens. Inclure la version de prix et la variante d’expérience.

**KPI prioritaires.** Billets émis / sessions ayant sélectionné une offre ; paiements reçus / commandes payables ; billets émis / paiements reçus ; bons payés avant échéance / bons émis ; marge nette par billet ; coût de recherche par billet ; taux de changement de prix ; délai paiement–émission ; coût d’assistance et remboursement par dossier. Comparer à périmètre identique de trajet, source, appareil et moyen de paiement.

## 4. Expérience artisanale : lisibilité, précision et interactions utiles

### A12 — Consolider le langage visuel existant

La base fournit déjà Manrope locale avec `font-display: swap`, un préchargement, des pictogrammes SVG et des animations réduites à la demande. L’effort utile est une harmonisation : [style.css](../assets/css/style.css) compte 3 542 lignes et [refined.css](../assets/css/refined.css) 1 861, avec plusieurs redéfinitions successives. Ensemble, elles représentent 140 356 octets bruts ; cela ne mesure pas leur poids transféré compressé. `app.js` représente 89 061 octets bruts. Le build contrôle et copie, sans découpage ni empreinte de contenu des fichiers.

**Système typographique proposé.** Conserver une seule famille, trois graisses courantes et une hiérarchie stable : texte courant 16 px / interligne 1,5 ; informations secondaires 14 px ; libellés 14–16 px ; prix 24–32 px avec chiffres tabulaires ; titres fluides via `clamp`, sans faire disparaître les actions sous un titre trop grand sur mobile. Réserver les capitales espacées aux courts repères. Les petits textes de 10–12 px visibles dans les styles, notamment bandeau et navigation, doivent être revus selon leur importance.

**Travail CSS concret.** Extraire tokens de couleurs, espacements, rayons, ombres, typographie et mouvement ; migrer composant par composant vers une seule définition. Utiliser des couches CSS si cela clarifie la cascade, en traitant explicitement les anciennes règles non placées dans une couche. Commencer par `button`, `form-field`, `flight-card`, `fare-day`, `summary-panel`, `status-message` et `payment-choice`. Supprimer ensuite les règles devenues inactives après comparaison visuelle.

**Zéro emoji.** Conserver le garde-fou du build, les SVG cohérents et les intitulés textuels. Étendre la règle aux nouveaux composants, messages transactionnels et données éditoriales contrôlées ; ne pas remplacer une information par une icône seule. Ne pas modifier les noms personnels des clients pour faire respecter une règle de décoration UI. Le contrôle Unicode actuel n’est pas une certification exhaustive de tous les caractères ressemblant à des symboles.

**Constat visuel à 390 × 844 px, en démonstration.** Sur l’accueil, le bouton de recherche est sous le premier écran, après le bandeau des dates. Sur les résultats, le graphique de comparaison occupe l’essentiel de la hauteur restante après le titre ; le premier vol n’est pas visible sans défiler. Les prix des sept colonnes sont très serrés. Déplacer le bouton de recherche immédiatement après les champs et placer les dates flexibles ensuite. Dans les résultats mobiles, présenter d’abord le nombre d’offres, le tri et une première carte ; réduire le comparateur à un résumé dépliable ou à un rail lisible. Conserver l’exploration des dates sans la faire précéder systématiquement le résultat demandé. Recette : à cette taille, l’action principale et le premier résultat utile sont accessibles plus tôt, sans barre fixe masquant les erreurs ou le clavier virtuel. Mesurer sélection d’offre et changements de date pour vérifier que cette hiérarchie aide les deux usages.

### Micro-interactions à spécifier, pas à multiplier

| Interaction | Comportement cible | Validation |
| --- | --- | --- |
| Recherche | Squelette à géométrie stable ; message de couverture partielle ; résultats conservés pendant un rafraîchissement | Pas de faux pourcentage de progression ni de saut de liste |
| Choix d’une offre | Retour visuel en 120–180 ms, résumé mis à jour, focus sur le prochain titre utile | Clavier et tactile donnent le même résultat |
| Erreur passager | Erreur sous le champ, `aria-describedby`, résumé avec liens ; focus sur la première erreur | Saisie conservée et erreur compréhensible sans couleur |
| Changement de prix | Ancien prix, nouveau prix et delta ; boutons accepter/rechercher | Aucune acceptation implicite |
| Copie de référence | « Référence copiée » pendant environ deux secondes | Confirmation dans une région de statut, sans toast répétitif |
| Compte à rebours | Heure limite explicite + durée ; chiffres tabulaires ; annonce aux seuils utiles | Aucun lecteur d’écran sollicité toutes les secondes |
| Paiement reçu | Retrait immédiat des actions de paiement ; suivi chronologique stable | Aucune animation célébrant un billet avant émission |
| Retour / rechargement | Dossier et paiement retrouvés ; prix revalidé si nécessaire | Aucun nouveau hold ni nouvelle tentative par défaut |

Conserver les sons désactivés par défaut. Les effets de reflet et d’orientation du billet existent déjà ; ils sont secondaires face à la lisibilité. Réduire leur coût avec `requestAnimationFrame` si le profilage montre un problème et ne pas solliciter les capteurs simplement pour décorer un document essentiel. En mode mouvement réduit, retirer les déplacements et les squelettes animés tout en conservant les changements d’état textuels.

### Corriger la rédaction selon la réalité de chaque dossier

- Remplacer les étiquettes globales « OFFRE DUFFEL », « Duffel · tarifs vérifiés » et « Offres Duffel » par la source effective et le type de prix. Ne pas annoncer une confirmation pour les tarifs indicatifs Ryanair.
- Remplacer « SSL 256 bits » par une information utile : « Paiement sécurisé par Stripe », moyens acceptés et issue attendue. Ne pas montrer `LIVE_CHECKOUT_ENABLED=true` dans un message destiné au voyageur.
- Adapter le consentement : « Je demande une retenue… paiement du bon » n’est pas le texte d’un achat par carte instantané. Décrire le montant, l’opération, les conditions et ce qui se passe ensuite.
- Isoler la démonstration derrière une action explicite et une indication persistante. Une panne de `/api/config` ne doit pas faire passer silencieusement une application de production en `offline-demo`.
- Expliquer « réservation », « paiement reçu », « billet émis » et « carte d’embarquement » avec des libellés distincts. Le Wallet de réservation n’est pas une carte d’embarquement.
- Réserver « Aucun vol trouvé » à une recherche terminée sans résultat ; écrire « Certaines compagnies n’ont pas répondu » quand la couverture manque.

### Accessibilité et performance perçue

Conserver le `dialog` natif, le retour de focus du calendrier, les flèches clavier, les labels et le skip-link existants. Ajouter un seul arrêt de tabulation principal dans la grille calendrier, navigation début/fin de ligne et changement de mois cohérent ; ne pas détruire le contrôle qui a le focus lors d’un recalcul des prix. Vérifier que le focus n’est pas masqué par une barre fixe et que les changements de vue asynchrones restent annoncés.

Viser des cibles de 44 × 44 px pour le confort mobile ; le minimum WCAG 2.2 AA est 24 × 24 px sous conditions, pas 44 px universellement. Vérifier contraste du texte courant à 4,5:1, zoom à 200 %, clavier seul et écran étroit de 320 px. Utiliser couleur, texte et symbole ensemble pour les tiers de prix. [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

Réserver les dimensions des images et cartes, produire des tailles adaptées pour les destinations, charger paresseusement ce qui est hors écran et éviter les relayouts de toute la liste au déplacement d’un filtre. Extraire progressivement les vues de `app.js` en modules lisibles ; aucune migration React ou Next.js n’est nécessaire pour cela. Adapter le build si des modules ES ou du découpage sont introduits : son parseur actuel `new Script` suppose des scripts classiques.

Ajouter des empreintes de contenu aux ressources avant un cache navigateur long et immutable ; conserver une politique de revalidation pour le HTML et `no-store` pour les réponses privées. Mesurer séparément le JavaScript tiers et le code applicatif. Toute modification du chargement de Stripe.js doit rester conforme à ses recommandations d’intégration et ne pas casser les signaux antifraude.

**Budget produit proposé**, à mesurer sur mobile réel : LCP ≤ 2,5 s, INP ≤ 200 ms et CLS ≤ 0,1 au 75e percentile ; première réaction visuelle à une action en moins de 100 ms. Ce sont des objectifs de recette, pas des scores observés dans cet audit.

## 5. Fonctionnalités stratégiques différenciantes

Le positionnement le plus crédible est : **trouver un voyage réellement achetable, avec le bon budget, puis accompagner son paiement et son émission jusqu’au bout**. Le réseau de points partenaires et la compréhension des voyages familiaux sont plus différenciants qu’un simple ajout de fournisseurs ou d’un chatbot généraliste.

### F01 — « Je peux payer près de chez moi avant l’échéance »

**Besoin.** Un prix bas n’est pas utile si le point de paiement ferme avant l’arrivée du voyageur.

**MVP.** Combiner offre éligible, heure limite fournisseur et points partenaires ouverts. Proposer ville/code postal avant la géolocalisation ; afficher adresse, horaires confirmés, heure limite et marge recommandée pour le déplacement. Une distance à vol d’oiseau n’est pas un temps de trajet garanti.

**Implémentation.** Étendre le contrat de [api/payencash/stores.js](../api/payencash/stores.js) avec identifiant partenaire stable, fuseau horaire, plages structurées, exceptions de fermeture, modes acceptés et `lastVerifiedAt`. Les identifiants actuellement générés par index de tableau sont insuffisants pour mémoriser un choix fiable. Ajouter `preferred_store_id` au dossier, sans inclure de donnée voyageur dans le QR. Filtrer/paginer l’annuaire au lieu de toujours transférer jusqu’à 10 000 points.

**Validation.** Tester fermeture exceptionnelle, passage de minuit, GPS refusé, annuaire indisponible et échéance trop courte. Si les horaires ne sont pas confirmés, le dire sans afficher « ouvert » comme un fait.

**Mesure et effort.** Bons payés avant échéance, abandons liés à la distance et contacts « magasin fermé » ; 5–8 j après disponibilité des données partenaire. Dépend de A04/A05/A09.

### F02 — Comparateur « budget complet » pour les familles

**Besoin.** Comparer deux prix de base masque souvent le coût du bagage et du groupe.

**MVP.** Comparer un total pour tous les voyageurs avec un profil bagage explicite : petit sac, cabine ou soute. Afficher les éléments inconnus ; ne pas classer une option sans prix connu comme moins chère. Conserver un mode prix par personne pour la lisibilité, dérivé du total faisant foi.

**Implémentation.** Étendre le devis avec services par passager/segment, poids, dimensions, quantité et prix fournisseur. Ajouter progressivement enfants et nourrissons en s’appuyant sur les règles de chaque fournisseur et l’âge au départ ; les validateurs actuels limitent le réel à 1–9 adultes. Ne pas remplacer ce changement par un simple libellé dans le sélecteur.

**Validation.** Revalorisation de toute la famille, passage d’une tranche d’âge pendant le voyage, bagage inclus sur un seul segment, service épuisé et changement de prix. Conserver une séparation claire entre options réelles et simulation.

**Mesure et effort.** Conversion au prix revalidé, variation de prix entre sélection et paiement, marge des options et demandes d’assistance ; 8–15 j selon couverture des services et types de passagers. Dépend de A07/A09 et des capacités partenaires.

### F03 — Calendrier flexible fondé sur des preuves tarifaires

**Besoin.** Trouver une date moins chère sans refaire vingt recherches et sans promesse trompeuse.

**MVP.** Ajouter ±3 jours et une durée de séjour aux voyages pris en charge ; montrer fraîcheur, provenance et niveau de confiance de chaque prix. Pour des allers-retours, ne pas sommer deux minima journaliers indépendants comme un devis ferme.

**Implémentation.** Réutiliser les observations structurées de A07, requêter en priorité les dates consultées, borner le nombre de combinaisons. Une alerte de prix est une observation déclenchant une invitation à revalider, pas une garantie. Les notifications nécessitent consentement, fréquence maximale, désabonnement et une outbox distincte des paiements ; choisir le canal d’envoi lors de l’implémentation, sans préjuger d’un nouveau prestataire.

**Validation.** Cache expiré, hausse du prix, absence de capacité pour le groupe, annulation d’alerte et panne fournisseur. Ne pas extrapoler une réduction à partir d’un calendrier purement simulé.

**Mesure et effort.** Retours utiles vers la recherche, réservations émises issues d’alertes et coût d’API par réservation ; 5–8 j pour la flexibilité aller simple, puis un lot distinct pour les alertes. Dépend de A06–A08.

### F04 — Dossier de voyage durable, retrouvable sur plusieurs appareils

**Besoin.** Un voyage payé ne doit pas disparaître avec le stockage du navigateur.

**MVP.** Retrouver un dossier par référence et vérification du contact, puis voir une chronologie commune : retenue, paiement, émission, documents, remboursement. Inclure les demandes conciergerie et les réservations Travelfusion dans « Mes réservations ».

**Implémentation.** Séparer le payeur, le contact et les voyageurs. Remplacer progressivement les capacités de 90 jours stockées en `localStorage` par une session courte, révocable et limitée au dossier, avec cookie `HttpOnly`, `Secure`, `SameSite` lorsque le modèle le permet. Ajouter limites de tentatives, réponses ne révélant pas l’existence d’un dossier et historique des accès. Prévoir rotation des clés de signature et de chiffrement avec `key_id`, ainsi qu’une politique d’effacement des données chiffrées low-cost ; l’expiration du token n’efface pas la ligne.

**Validation.** Autre navigateur, lien expiré/révoqué, accès à un autre dossier, appareil partagé et dossier low-cost rechargé. Le consentement au service n’autorise pas automatiquement le marketing.

**Mesure et effort.** Dossiers récupérés sans assistance, réachat, tickets support liés aux documents ; 6–10 j. Dépend de A01–A05/A09.

### F05 — Conciergerie opérable et assistance au paiement pour un proche

**Besoin.** La conciergerie actuelle peut enregistrer une demande sans outil livré pour l’attribuer, la traiter et informer le voyageur.

**Premier MVP.** Une console opérateur authentifiée : files par échéance, prise en charge exclusive, demande de complément, consultation fournisseur, proposition de devis et journal d’actions. Le déchiffrement des passagers doit être ponctuel et audité ; aucun accès SQL partagé n’est une interface d’exploitation satisfaisante.

**Extension différenciante.** Un proche peut payer un devis accepté via un lien limité à l’opération de paiement, sans pouvoir consulter toutes les données passagers. Distinguer qui voyage, qui paie et à qui revient un éventuel remboursement. Ne pas créer de portefeuille prépayé ni fractionner artificiellement le panier pour contourner le plafond espèces applicatif.

**Validation.** Deux opérateurs sur le même dossier, réponse d’achat perdue, abandon par l’opérateur, lien transféré et double paiement. Le lien ne peut ni changer le vol ni augmenter le montant autorisé.

**Mesure et effort.** Délai de première réponse, demandes devenues billets émis, temps opérateur par dossier et marge de service ; 7–12 j pour la console minimale, extension paiement séparée de 4–7 j. Dépend de A09/F04 et d’une définition des rôles opérateurs.

### F06 — Aller-retour réellement réservable et suivi après-vente

**Besoin.** L’interface commence par un aller-retour, tandis que le serveur recherche des offres à une seule slice. C’est une rupture plus importante à résoudre qu’une nouvelle vue décorative.

**MVP aller-retour.** Envoyer plusieurs slices dans une même recherche lorsque le fournisseur le supporte, normaliser l’offre complète et réserver l’offre unique correspondante. À défaut, annoncer des billets séparés avant la sélection et ne pas promettre une opération atomique. Un simple intervalle de deux heures entre trajets ne constitue pas une protection de correspondance.

**MVP après-vente.** Recevoir ou consulter les changements de réservation, comparer l’itinéraire confirmé, notifier le voyageur et proposer la prochaine action. Séparer devis d’annulation, confirmation d’annulation et remboursement du moyen de paiement ; aucune annulation locale ne doit promettre un remboursement déjà réalisé.

**Validation.** Échec du retour après succès de l’aller, changement de programme, annulation après émission, remboursement partiel, notifications doublonnées. Pour les billets séparés, définir les compensations possibles avant de commercialiser la combinaison.

**Mesure et effort.** Conversion aller-retour, incidents de réservation partielle, délai de traitement après-vente et satisfaction ; 10–20 j en plusieurs lots selon capacités fournisseur. Dépend de A07/A09/F04.

**À différer.** Virtual interlining, paiement fractionné, solde rechargeable, assurance, compensation carbone vendue et assistant conversationnel capable de réserver. Ces produits ajoutent engagements, argent en circulation ou risques de mauvaise interprétation avant que les fondations actuelles soient garanties. Ils ne sont pas nécessaires pour valider la proposition de valeur initiale.

## 6. Architecture cible et mise en œuvre progressive

### Conserver les fonctions, extraire les responsabilités

```text
Frontend : recherche / sélection / voyageurs / choix paiement / suivi
   │
   ├─ API recherche → orchestrateur → connecteurs → offres normalisées
   │                                  └─ observations publiques horodatées
   │
   └─ API commande → devis accepté → réservation et tentatives persistées
                         │
Webhooks vérifiés → événements et paiements → transition transactionnelle
                         │
                         └─ outbox → worker → preuve fournisseur
                                               └─ projection de suivi / documents
```

Créer progressivement `server/config.js`, `server/providers/`, `server/pricing.js`, `server/payments/`, `server/order-state.js` et des vues frontend plus petites. Les handlers restent des contrôleurs fins : validation, autorisation, appel métier, réponse. Le nombre de modules internes n’augmente pas le nombre de fonctions Vercel.

Pour les prochaines actions de commande, utiliser un dispatch **explicite et validé** dans une fonction existante, ou revoir le budget de fonctions si nécessaire. Éviter le dispatch actuel fondé sur la présence de champs (`bookingToken`, `from`, `legs`) : des formes de payload deviennent implicitement des routes. Conserver temporairement les anciennes routes comme adaptateurs de compatibilité testés. Dans `orders/status`, ne pas attraper toutes les erreurs low-cost avant de réessayer un autre type de token : une panne de l’adaptateur ne doit pas ressortir comme un problème d’authentification.

### Évolution minimale du schéma

| Entité | Ajouts / responsabilité | Invariant |
| --- | --- | --- |
| `quotes` | Offre fournisseur, voyageurs typés, inclusions, prix ventilé, durée et version | Un prix accepté est identifiable et ne se modifie pas rétroactivement |
| `flight_orders` | ID applicatif, ID fournisseur séparé, fournisseur, mode, trois états, montants client/fournisseur | Aucune émission déduite d’un préfixe d’identifiant |
| `payment_attempts` | Moyen, identifiant externe, montant, devise, état, clé idempotente | Une tentative active par version de devis selon politique définie |
| `payment_events` | Source, event ID, payment ID, type, heure fournisseur, heure reçue, résultat | Tout encaissement durablement enregistré, y compris inattendu |
| `payment_outbox` | Phase, bail, token de claim, tentatives, échéance, erreur expurgée | Une reprise ne répète pas une écriture externe ambiguë |
| `order_events` | Transition, acteur, cause, corrélation | Historique expliquant chaque état affiché |
| `refunds` | Moyen d’origine, paiement, montant, identifiant externe, état | Pas de remboursement doublonné ou déclaré terminé sans preuve |
| `low_cost_bookings` | Lien vers dossier commun, état opérateur, version de clé, rétention | Pas de suppression des dossiers existants lors de migration |
| `fare_observations` | Dimensions, source, prix indicatif/confirmé, observation et expiration | Aucun prix périmé présenté comme payable |

Commencer avec des migrations additives versionnées : ajouter les colonnes, remplir depuis les données existantes, vérifier les correspondances, puis renforcer les contraintes et basculer les lectures. Ne pas déduire rétroactivement le moyen de paiement à partir du seul statut `awaiting_cash`, utilisé aujourd’hui comme défaut de la table. Conserver les identifiants externes pour rapprocher les anciens dossiers.

Ajouter des contraintes sur les états, les montants et les clés étrangères, ainsi que les index de travail. L’outbox de paiement, les alertes de prix et les notifications client doivent avoir des types ou files distincts pour qu’une campagne de notifications ne retarde pas l’émission d’un billet.

### Exploitation et observabilité

- Corréler `requestId → searchId → quoteId → orderId → paymentId → providerOrderId` sans faire apparaître les secrets dans les URL ou journaux.
- Surveiller : p95 recherche par source, couverture partielle, changements de prix, saturation du pool, âge du plus ancien paiement non émis, nombre de claims expirés, temps d’attente documents, sommes à rapprocher et à rembourser.
- Définir une alerte urgente dès qu’un paiement reçu approche de l’échéance fournisseur sans émission, et une alerte technique si le worker ne passe plus. Exemple initial : avertissement sur tâche payée non prise en charge depuis deux minutes, à ajuster au SLO et aux limites transporteur.
- Décrire trois procédures concrètes : débit fournisseur ambigu, double encaissement carte/bon, billet non reçu après paiement. Chacune précise preuve à consulter, action autorisée, personne responsable et message au voyageur.
- Introduire une CSP en mode rapport puis l’appliquer après vérification des domaines nécessaires à Stripe, des cartes et des styles existants. Les nombreuses insertions `innerHTML` et les tokens locaux justifient cette défense, sans prétendre qu’une faille XSS a été démontrée dans cet audit.
- Séparer démo, sandbox partenaire et production dans la configuration et la persistance. Tester le comportement de chaque flag absent, `"false"` ou `"true"`. Ajouter les variables Stripe et low-cost à la documentation d’exploitation actuellement centrée sur PayEnCash.

## 7. Feuille de route et validation

### Lot 0 — Avant tout encaissement réel supplémentaire

Livrer A01–A05 : statut en lecture, signatures obligatoires, montants rapprochés, création de paiement autorisée/idempotente, désactivation de tous les succès simulés dans les parcours réels, ordonnanceur effectif et reprise des tâches interrompues. La première livraison peut fermer explicitement les parcours non terminés plutôt que promettre leur disponibilité.

**Sortie du lot :** un paiement ne peut produire qu’une émission justifiée, un échec ne peut devenir une confirmation et toute somme reçue sans billet a une issue opérable. La vérification se fait d’abord en sandbox, puis en recette partenaire contrôlée selon le processus d’exploitation du projet.

### Lot 1 — Recherche fiable et parcours qui aboutissent

Livrer A06–A10 : résultats partiels, prix typés et horodatés, déduplication conservant les variantes, suppression des appels doublonnés, capacités de paiement indépendantes et suivi uniforme. Ouvrir séparément le parcours carte avec retenue, puis l’instantané seulement après sa recette de compensation. Ne pas attendre un redesign complet pour corriger les textes et les impasses multi-trajets.

**Sortie du lot :** aucune perte totale de résultats à cause d’un seul fournisseur ; aucun prix indicatif présenté comme garanti ; achat proposé seulement lorsqu’il peut être exécuté ; rechargement sans double tentative.

### Lot 2 — Conversion, marge et lisibilité

Livrer A11/A12, F01 et le socle F04 : événements serveur, tableau de marge, formulaire repris, wallets réellement disponibles, annuaire exploitable avant expiration, typographie et états cohérents. Établir une baseline sur le trafic réel avant de conclure à un gain de conversion.

**Sortie du lot :** expérience mesurable du résultat au billet émis, récupération des dossiers et amélioration démontrable sur une cohorte comparable, sans hausse des remboursements ou de l’assistance.

### Lot 3 — Différenciation par pilotes

Prioriser F02 et F06 si le trafic familial/aller-retour domine ; F05 si la demande assistée convertit avec une marge viable ; F03 si les recherches flexibles engendrent des retours utiles. Utiliser les métriques du lot précédent pour décider, plutôt que lancer toutes les fonctionnalités simultanément.

### Matrice de tests à compléter

| Domaine | Scénarios indispensables | Niveau de validation |
| --- | --- | --- |
| Recherche | Fournisseur lent/500/429, résultat vide, JSON invalide, double recherche, réponse obsolète | Tests de contrat + navigateur |
| Prix | Groupe de voyageurs, offre expirée, prix indicatif, options différentes, changement de tarif | Tests métier + fixtures fournisseur |
| Stripe | Secret absent, mauvais montant/devise, mauvais PI, rejeu, ordre inversé, base indisponible | Handler + sandbox Stripe |
| Paiements croisés | Bon payé pendant bascule carte, deuxième PI réussi, notification tardive | PostgreSQL réel + adaptateurs contrôlés |
| Émission | Deux workers, crash à chaque frontière réseau/commit, documents différés, bail expiré | PostgreSQL réel + injection de panne |
| Low-cost | Réponse perdue, reprise après reload, réservation confirmée mais financement client incomplet | Contrat adaptateur + E2E |
| UX | 320/360/390/430/768/1440 px, zoom, clavier, mouvement réduit, stockage indisponible | Navigateur + revue manuelle |
| Déploiement | 12 fonctions, routes réécrites, corps brut webhook, secrets requis, ordonnanceur | Preview et recette d’exploitation |

Les tests `payment-server.spec.js`, l. 48–60, retirent explicitement `FOR UPDATE OF q SKIP LOCKED` pour fonctionner dans `pg-mem`. Ils valident les transitions simulées, **pas les verrous PostgreSQL**. Les tests Stripe existants couvrent une signature invalide lorsque le secret est configuré, mais pas son absence, les montants discordants ni les courses carte/bon. Le test Ryanair de `stripe-and-ryanair-checkout.spec.js` tourne en mode test et vérifie une retenue simulée ; il ne prouve pas la disponibilité d’une retenue Ryanair réelle. Conserver ces tests en renommant leur portée et ajouter les scénarios manquants.

### Vérifications réalisées pour cet audit

- Relecture du code actif et confrontation du graphe aux chemins exécutables.
- Reproductions locales avec stockage mémoire et réseau bloqué : webhook Stripe non signé/montant-devise incohérents accepté ; `pi_sim_` conduisant à `ticket_issued` hors flag de test ; création d’intention simulée avec seul `orderId` ; panne Duffel faisant échouer un résultat low-cost valide.
- `node --test tests/low-cost.node.cjs` : **10 tests réussis**.
- `npm test -- --workers=2` : **48 tests réussis**, en environ 3,8 minutes ; fournisseurs simulés et base émulée selon les suites.
- `npm run build` : **réussi**, y compris syntaxe, ressources et garde-fou zéro emoji du code actif.
- Revue navigateur Chromium locale de l’accueil et des résultats à **390 × 844 px**. Captures de travail : `output/playwright/audit-mobile-search.png` et `output/playwright/audit-mobile-results.png`, ignorées par Git. Cette revue n’est pas une certification exhaustive d’accessibilité.
- Vérification des liens locaux du rapport : aucune cible manquante. Douze handlers API confirmés ; aucun emoji de présentation détecté dans le rapport.
- Les latences de production, taux de conversion, scores Core Web Vitals, contrats commerciaux et certifications partenaires restent à mesurer ou vérifier dans les environnements correspondants.

Le premier résultat attendu est un système dont chaque promesse affichée correspond à une capacité vérifiée et dont chaque encaissement possède une issue traçable. C’est la condition pour que la vitesse, la qualité visuelle et les nouveaux services produisent ensuite une conversion durable.
