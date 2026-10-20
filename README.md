# voyagencash

Application statique de démonstration de réservation de vols, en français. Aucun compte, clé API, service externe ou backend n’est nécessaire à l’exécution de l’interface. Les ressources graphiques et le générateur de QR codes sont servis localement.

## Démarrage

Node.js 22 ou supérieur :

```sh
npm install
npm run dev
```

Ouvrir http://localhost:4173. Le serveur fourni sert uniquement des fichiers statiques ; il ne traite ni réservation ni paiement.

```sh
npm run build
npm run preview
```

Le build crée `dist/` avec seulement `index.html` et `assets/`. Les anciens dépôts de maquettes restent dans le projet et ne sont pas publiés.

## Vercel

Importer le dépôt avec le preset **Other**. La configuration `vercel.json` définit la commande de build et le répertoire `dist`. Aucune variable d’environnement n’est requise. Les anciennes routes `/app`, `/vols`, `/aller-simple`, `/mes-billets` et les routes `/ou-payer`, `/aide` ouvrent la nouvelle application.

## Parcours disponibles

- Aller simple, aller-retour et multi-destinations (2 à 4 trajets), de 1 à 9 passagers.
- Autocomplétion de 48 aéroports, inversion des villes, dates et navigation clavier.
- Inventaire déterministe de vols simulés : transporteurs connus, codes IATA, durées calculées à partir des distances, fuseaux horaires locaux et correspondances.
- Filtres budget, escales, compagnies et créneaux ; tri par prix, durée ou score prix/durée.
- Soute 23 kg : 35 € par passager et trajet ; garantie fictive : 19 € par passager pour le voyage.
- Validation de chaque passager et des coordonnées, sauvegarde du brouillon.
- Bon d’achat avec QR code décodable, compte à rebours persistant de 120 minutes et validation simulée en caisse.
- Carte de test prédéfinie et simulation 3D Secure avec refus/reprise ; confirmation Apple Pay simulée.
- Références et numéros d’e-ticket fictifs, billets par passager, consultation, annulation et téléchargement HTML autonome. Le document téléchargé contient un bouton d’impression / export PDF via le navigateur.
- Localisateur interactif avec six points fictifs, recherche par ville ou code postal et schéma de localisation.

## Données et limites

Les compagnies et aéroports portent leurs vrais noms. Les offres, numéros de vol, tarifs, stocks, PNR et e-tickets sont **simulés**, sans validation auprès d’un transporteur. Les points de paiement sont fictifs. Aucun billet utilisable, paiement, assurance, remboursement ou e-mail réel n’est créé. Les cartes d’embarquement sont explicitement marquées comme spécimens.

Une commercialisation réelle nécessiterait un fournisseur aérien, un backend pour protéger ses secrets et gérer l’émission, un prestataire de paiement, ainsi qu’un annuaire de partenaires vérifiés. Ne jamais intégrer de clés secrètes dans ces fichiers client.

Les réservations sont enregistrées sous `voyagencash_reservations` et le brouillon sous `voyagencash_draft`, dans `localStorage`. Utiliser des identités fictives ; le stockage local n’est pas un coffre sécurisé. Les réservations restent sur le navigateur et l’origine utilisés ; elles ne sont pas synchronisées entre appareils. L’heure du navigateur fait autorité pour l’expiration de cette démonstration.

## Validation

```sh
npx playwright install chromium
npm test
```

Tests Chromium : aller-retour à deux passagers, options, décodage QR, persistance, téléchargement, impression, annulation, refus puis reprise 3D Secure, Apple Pay, multi-destinations, filtres, autocomplétion clavier, expiration, petit écran, validation, stockage corrompu ou saturé, fuseaux horaires et correspondances.

## Fichiers principaux

- `index.html` : page unique, navigation, recherche, vues et FAQ.
- `assets/css/style.css` : charte responsive, composants et impression.
- `assets/js/flight-engine.js` : aéroports, horaires, inventaire simulé et filtres.
- `assets/js/booking-manager.js` : validation, prix, stockage, bons, billets et téléchargements.
- `assets/js/app.js` : contrôleur, navigation et interactions.
- `assets/js/vendor/qrcode.js` : qrcode-generator 2.0.4, Kazuhiko Arase, licence MIT conservée dans le fichier.
