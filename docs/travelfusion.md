# Réservation low-cost et conciergerie

Le module `server/travelfusion.js` expose `searchLowCost`, `bookFlight`,
`checkBookingStatus` et `createRyanairDirectHandoffUrl`. Les transporteurs acceptés
sont FR, U2, W6, W4, TO, HV et VY. Le parcours prend actuellement en charge
1 à 9 adultes, un trajet à la fois, en EUR.

Travelfusion est un Approved OTA Aggregator de Ryanair :
https://corporate.ryanair.com/news/ryanair-and-travelfusion-partnership-takes-off-further-expanding-ryanairs-approved-ota-network/
L'accès aux API et aux conditions d'émission nécessite un contrat partenaire :
https://corporate.travelfusion.com/resources/xml-api

## Configuration et limite de l'intégration

Ce dépôt implémente l'orchestration et le contrat d'un **adaptateur privé**,
ainsi que le repli durable en conciergerie. Il ne contient pas le connecteur XML
certifié Travelfusion. Ne pas pointer `TRAVELFUSION_ADAPTER_URL` vers le point
d'entrée XML public : les messages JSON ci-dessous sont notre contrat interne,
pas l'API native Travelfusion. Un adaptateur raccordé au compte partenaire et
validé avec Travelfusion doit être déployé pour activer la réservation réelle.
Aucun appel réel ni certification partenaire n'ont été effectués ici.

Appliquer `server/schema.sql` avec PostgreSQL. Configurer :

- `DATABASE_URL` (ou alias déjà accepté par `server/database.js`) ;
- `CONCIERGE_ENCRYPTION_KEY` : 32 octets aléatoires en hexadécimal (64 caractères) ;
- `VOUCHER_SIGNING_SECRET` : secret stable de signature des capacités ;
- `TRAVELFUSION_ADAPTER_URL` : base HTTPS de l'adaptateur privé ;
- `TRAVELFUSION_API_KEY` : secret Bearer de cet adaptateur ;
- `TRAVELFUSION_BOOKING_ENABLED=true` seulement après validation partenaire.

Laisser les deux variables d'adaptateur vides pour la conciergerie. Sans base,
clé de chiffrement ou signature stable, l'enregistrement échoue explicitement
avec 503 : aucune fausse confirmation et aucun stockage des passagers en clair.
La réservation native reçoit un jeton d'offre signé, issu de `searchLowCost`.
Les offres Ryanair indicatives restent des demandes en conciergerie, même si
un adaptateur est configuré ultérieurement.

## Contrat de l'adaptateur privé

Chaque requête est un POST JSON authentifié par `Authorization: Bearer ...`.
Les redirections HTTP sont refusées, le délai est de 25 secondes.

- `search` reçoit `{from,to,date,count,currency,carriers}`. Il retourne
  `{offers:[...]}`. Chaque offre contient `id` opaque (lettres/chiffres/tirets),
  `from`, `to`, `date`, `airline:{code,name,color}`, `currency:"EUR"`,
  `totalAmount` numérique pour tous les adultes, `expiresAt` ISO,
  `cabinBagIncluded` et `segments:[{from,to,departure,arrival,number,aircraft?}]`.
  Les timestamps des segments sont des millisecondes UTC. Les appareils exacts
  et jalons fournisseur ont priorité sur les estimations locales.
- `bookings` reçoit `{clientReference,offerId,expectedAmountCents,currency,passengers}`
  et un en-tête `Idempotency-Key` UUID v4. **L'adaptateur doit** revalider le tarif,
  refuser tout montant différent, contrôler les informations voyageurs, réaliser
  ProcessDetails/ProcessTerms selon son contrat XML puis StartBooking avec le
  moyen de règlement fournisseur autorisé. Aucun numéro de carte n'est stocké
  ou envoyé par ce module. Le financement fournisseur reste une responsabilité
  de l'adaptateur ; aucun bon espèces n'est créé par ce parcours.
- `bookings/status` reçoit `{clientReference}`. Il doit retrouver la demande
  même si la réponse initiale a été perdue, sans soumettre un nouvel achat.
- Les deux dernières opérations retournent `{status,bookingReference?}` avec
  `status` parmi `pending`, `confirmed`, `failed`. `confirmed` exige une vraie
  référence compagnie. `failed` doit être un échec définitif, pas un timeout.
  L'adaptateur traduit les états Travelfusion et attend la résolution des
  éventuelles vérifications compagnie avant de déclarer `confirmed`.

## Persistance et reprise

`POST /api/orders/low-cost` accepte les paramètres de `bookFlight` avec
`Idempotency-Key` dans les en-têtes. Les passagers sont chiffrés AES-256-GCM
avec l'identifiant de dossier comme donnée associée ; seuls les champs utiles
sont conservés. Empreinte HMAC et unicité SQL empêchent une seconde soumission
avec la même clé. Ne jamais renvoyer une nouvelle clé après une réponse ambiguë.

États : `concierge_pending`, `submitting`, `pending`, `confirmed`, `failed`,
`reconciliation_required`. Un timeout d'émission devient
`reconciliation_required`, jamais une nouvelle demande d'achat conciergerie.
`POST /api/orders/low-cost-status` exige le jeton `low-cost-access` retourné
à la création, valable 30 jours. Il ne retourne ni passagers ni secrets.
La file est indépendante de `flight_orders` et du worker PayEnCash ; aucune
entrée low-cost ne devient automatiquement un billet émis.

L'opérateur accède à `low_cost_bookings` via une connexion PostgreSQL restreinte.
Déchiffrement : base64 de `iv`, `tag`, `data`, AES-256-GCM, AAD = identifiant
UTF-8 de la ligne. Ne pas exporter les clés, passagers ou réponses fournisseur
dans les journaux. `expires_at` est l'expiration de la capacité de suivi, pas une
politique automatique d'effacement. Mettre en place la rétention et une interface
opérateur authentifiée avant exploitation ; elles ne sont pas fournies ici.

Le lien Ryanair préremplit uniquement aéroports, date et nombre d'adultes.
`flightNumber` reste une instruction affichée au voyageur : aucun paramètre
public de présélection garantie du vol n'est utilisé. Les identités ne figurent
jamais dans l'URL. Le lien ne constitue ni une retenue ni une émission.

## Interface et vérification

Le graphique utilise le calendrier du fournisseur ; les tarifs inconnus restent
inconnus. Les 7 boutons conservent `#results-fare-strip`, `.fare-day` et
`data-fare-date`. La chronologie calcule H−45/H−40/H−20 en UTC et affiche les
heures locales et les changements de date. Ces jalons sont indicatifs et les
consignes de la compagnie prévalent. L'appareil déduit est signalé comme tel.

Le sac compact demandé (40 × 25 × 20 cm) est affiché comme format compatible,
avec la franchise Ryanair publiée (40 × 30 × 20 cm). Les dimensions ne sont
pas généralisées à easyJet/Transavia/Wizz Air. Source :
https://help.ryanair.com/hc/en-gb/articles/12888036565521-Ryanair-s-Bag-Policy

Validation locale : `node scripts/build.mjs`, `npm test`, et
`node --test tests/low-cost.node.cjs` pour le chiffrement, l'idempotence,
les retours ambigus, le statut et les jalons horaires. Les tests fournisseur
utilisent uniquement un adaptateur simulé.
