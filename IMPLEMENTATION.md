# voyagencash — notes d’implémentation

La refonte conserve l’application statique et les dix tests historiques sans modification. Les offres, paiements, PNR, terminaux, indicateurs de ponctualité et émissions de billets restent simulés. Les adresses et horaires du localisateur sont des exemples réalistes, sans affiliation commerciale vérifiée. La météo est le seul service externe interrogé, sur demande, via Open-Meteo ; aucune identité de passager ne lui est transmise.

## Exécution

- `npm start` : application locale sur le port 4173.
- `node scripts/build.mjs` : contrôle de syntaxe JavaScript, identité, absence d’émojis, symboles SVG et ressources ; copie de production dans `dist/`.
- `npm test` : dix tests historiques et huit tests supplémentaires de règles financières et services.
- `npm run preview` : sert la production. Arrêter le serveur de développement s’il utilise déjà le même port.

## Réservation et compatibilité

`voyagencash_reservations` et les statuts `pending`, `confirmed`, `cancelled`, `expired` sont conservés. Le champ `state` contient l’état métier et `stateHistory` son historique horodaté :

```text
INITIALIZED → HOLD_PENDING → AWAITING_CASH → PAYMENT_CAPTURED → TICKET_ISSUED
                    │               │                              │
                    ├── EXPIRED ────┘                              └── REFUND_PENDING
                    └── CANCELLED (annulation avant paiement)
```

Pour la carte et Apple Pay, `HOLD_PENDING` passe directement à `PAYMENT_CAPTURED`. Les transitions sont internes au gestionnaire et vérifiées ; l’état et l’historique sont enregistrés atomiquement dans un seul document local. Les anciennes réservations sont migrées sans suppression. L’expiration est persistée à la lecture, et le paiement vérifie à nouveau l’échéance. Une même sélection identifiée par `checkoutKey` ne crée pas de deuxième réservation ; confirmer deux fois rend les mêmes billets. L’annulation après paiement conserve `cancelled` pour les consommateurs historiques et ajoute `REFUND_PENDING` au modèle métier.

Le plafond PayEnCash est de 1 000 €, vérifié dans le gestionnaire et signalé dans l’interface. Le panier complet est concerné ; aucune division artificielle du paiement n’est proposée. Un paiement par carte reste disponible au-delà de ce seuil.

La rétention simulée dure exactement 7 200 secondes. Le contrat `hold` comporte `payment_required_by`, `price_guarantee_expires_at` et `requires_instant_payment: false`. L’inventaire est volontairement synthétique : cette valeur n’affirme pas qu’un transporteur réel propose une rétention. En production, l’éligibilité et les échéances viennent de chaque offre Duffel et priment sur la fenêtre proposée par l’interface.

## Bon et documents

La référence affichée est `VNC-2026-XXXXX`, générée avec Web Crypto. Le QR utilise l’encodeur ISO/IEC 18004 existant, avec correction d’erreurs Q et zone blanche. Il contient un jeton aléatoire opaque de démonstration, sans identité ni coordonnées du passager. Le préfixe historique `DEMO|BON-VGC-` est conservé uniquement dans le payload du QR pour compatibilité du lecteur et des tests ; la référence visible et copiée est la référence VNC.

Ce jeton local n’est pas une signature PayEnCash et ne constitue pas une protection contre la modification du stockage navigateur. Le QR reste explicitement non encaissable. Un système réel doit émettre et vérifier le jeton côté serveur, authentifier les notifications PayEnCash, assurer l’idempotence transactionnelle et déclencher l’émission auprès du fournisseur. Aucune clé bancaire ou de signature n’est embarquée dans le client.

L’export e-billet HTML autonome reste compatible. L’impression/PDF utilise une feuille A4 claire, sans navigation et avec ruptures de page contrôlées. L’export `.pkpass` est une archive ZIP contenant `pass.json`, annoncée comme spécimen non signé et non importable dans Apple Wallet. Un pass Apple exploitable nécessite certificats, images et manifeste signé côté serveur.

## Interface et accessibilité

Palette : `#016bfd`, `#0B0F19`, `#FFFFFF`, `#1A2234`, `#00D084`, `#FF9900`. La police variable Manrope est hébergée localement (24,8 ko, licence SIL OFL jointe) et préchargée avec `font-display: swap`. Aucun service de polices distant n’est nécessaire.

Les cartes de suivi sont réparties à 60/40 sur desktop et empilées sur mobile. Les encoches utilisent un masque CSS ; le reflet répond au pointeur et, après interaction et autorisation éventuelle du navigateur, à l’orientation de l’appareil. `prefers-reduced-motion` désactive le mouvement. Les sons sont désactivés par défaut, activables au clavier et persistés : sinus de 1 200 Hz, amortissement de 12 ms. Les confirmations déclenchent `navigator.vibrate([15,30,20])` lorsque disponible.

Le localisateur accepte ville, code postal et GPS facultatif ; un refus conserve la recherche manuelle. Les distances utilisent la formule de Haversine et sont présentées comme estimations à vol d’oiseau. La météo actuelle concerne l’aéroport de destination, avec heure du relevé, indication de la source et reprise possible après échec. Elle n’est pas présentée comme une prévision à la date future du vol. Le CO2e est une estimation simplifiée distance × facteur, sans certification ICAO/Climatiq ni traînées ; les comparaisons et probabilités sont identifiées comme simulées.

## Références et périmètre réglementaire

Le cadre demandé AJEK / PayEnCash, L.521-3 CMF et BUM est modélisé et expliqué dans la FAQ. Il ne constitue pas une validation réglementaire des accords, du réseau limité ou de la qualification fiscale. Le rapport lui-même souligne que l’exemption de réseau limité dépend des conditions du montage. Le site public PayEnCash n’était pas consultable via l’outil de recherche pendant cette implémentation ; aucun annuaire partenaire ni contrat d’intégration n’était fourni dans le dépôt.

- [L.521-3 CMF — réseau limité](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000035430673)
- [Article 256 ter CGI — bons à usages multiples](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000037951759) : le traitement fiscal dépend de la prestation effective. Le modèle associe cet événement à l’émission du billet, conformément au cahier des charges. La version consultée prévoit un changement de codification au 1er janvier 2027.
- [Duffel — création et rétention de commandes](https://duffel.com/docs/api/v2/orders) : vérifier l’éligibilité de chaque offre, créer un ordre `hold` sans objet de paiement, puis payer avant l’échéance fournisseur.
- [PayEnCash](https://payencash.com/)

Les mesures Core Web Vitals et un score Awwwards ne sont pas certifiés par cette livraison. Les captures et tests navigateur valident le rendu et les parcours, pas une intégration bancaire ou aérienne en production.
