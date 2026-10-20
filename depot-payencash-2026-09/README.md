> **⚠️ PIVOT 2026-09-18, le soir (décision fondatrice) — ce qui fait foi, et ce qui remplace le bandeau du 17/09 :**
>
> **① L'agent de caisse mobile est SUPPRIMÉ.** Le salarié qui se déplaçait encaisser des espèces chez le client n'existe plus. Disparaissent avec lui : l'app coursier (`ui/coursier/`, 19 écrans), les zones de dispatch, le planning, la paie des agents, la flotte, les tournées de collecte, les dépôts en automate Cash Services, le rendu de monnaie, le découpage « part espèces + complément carte obligatoire », le canal `agent`, 8 écrans manager et 27 tables côté serveur.
>
> **② Il reste DEUX moyens de paiement**, tous deux **achetés au comptoir d'un commerce** : le **Bon d’achat PayEnCash** (bon d'achat prépayé émis par AJEK, vendu par notre réseau de commerçants sous contrat — art. **L521-3** CMF) et le **Bon d’achat PayEnCash** (notre réseau de distribution, sous contrat — c'est le **débit du bon sous verrou**, côté serveur, qui règle la commande). La promesse : **« payer avec un bon d’achat »**. ⚠️ **On ne dit jamais comment le client règle au comptoir** : il règle comme il veut, chez le commerçant.
>
> **③ Côté commerçant, le reversement mensuel est ABANDONNÉ.** Quand il vend un bon d’achat, la **carte bancaire enregistrée de son commerce est prélevée** du montant moins sa commission (**1,10 % HT + TVA 20 %**), via **Stripe** (1,5 % + 0,25 €). **Un refus de la banque = aucun bon d’achat émis.** Il reste un **relevé mensuel**, qui sert à l'autofacture de commission (art. 289 CGI) — c'est une **vue calculée**, pas une table.
>
> Pays : France · lignes Fly et Mode. Voir `ESPACE-COMMERCANT/documents/partie-4-flux.html` et le fil rouge `ESPACE-COMMERCANT/documents/diagramme-principal.html`. **Tout ce qui, plus bas dans ce README, parle d'agent, de livreur, de coursier, de collecte, de dépôt ou de circuit du cash est daté d'avant ce pivot** — les passages les plus trompeurs ont été corrigés le 18/09 au soir et sont signalés comme tels.
>
> *Mise à jour 2026-08-19 (historique) :* le remboursement « intégral quoi qu'il arrive, par course de retour » est **annulé** — circuit : avoir → moyen d'origine → virement → espèces par l'agent (F10) ; `ui/manager/` compte 25 écrans ; ligne MODE intégrée. *(18/09, soir : le circuit de restitution est désormais **le re-crédit du Bon d’achat PayEnCash** — plus aucune espèce ne circule. `ui/manager/` compte **38 écrans**.)*

# PayEnCash — Documentation technique et prototypes

Ce dossier contient l'ensemble de la documentation technique et des prototypes fonctionnels du projet PayEnCash, à destination du développeur en charge de l'implémentation.

## Glossaire central

**ESPACE-COMMERCANT/documents/partie-6-donnees.html**, à la racine de ce dossier, répertorie l'intégralité des colonnes du schéma de données, avec leur origine précise (appel API externe, saisie utilisateur, ou généré par PayEnCash). Toutes les colonnes ont désormais une origine confirmée : le code-barres et le code de sécurité sont **générés en interne**. *(18/09, soir : **le domaine livraison n'existe plus** — `couriers`, `delivery_zones`, `deliveries`, `delivery_tracking_events`, `courier_ratings` et `delivery_fee_config` ont été supprimés du schéma avec l'agent. Le domaine qui les remplace est celui du **Bon d’achat PayEnCash** : `partners`, `partner_cards`, `partner_charges`, `gift_cards`, `gift_card_movements`, `signature_links`, plus `psp_transactions` côté paiement en ligne.)* Les points de vigilance portent désormais sur les **données personnelles sensibles** *(18/09, soir : plus de géolocalisation ni de photo de collecte ; restent le KYC, les appels et le rattachement d'un bon d’achat à un compte)* et sur le statut d'**AJEK SASU au regard de la LCB-FT** — a priori non assujettie, à confirmer par avis juridique — encadré en attendant par le plafond de 1 000 €/transaction, le KYC client gradué et le KYB fournisseurs.

## Premier réflexe : le guide de démarrage

**GUIDE-DEMARRAGE.html**, à la racine de ce dossier, est le point d'entrée pratique : prérequis, commandes d'installation, arborescence de projet suggérée, fichier `.env.example` complet, comptes à créer avant de coder, et ordre de développement suggéré. À lire avant les documents de spécification ci-dessous, ou en parallèle.

## Index visuel du projet

**INDEX.html**, à la racine, est la page d'accueil visuelle qui recense tout le dossier : parcours d'achat (`ui/parcours/`), écrans clients (`ui/ecrans/`), **espace commerçant partenaire** (`ui/partenaire/`), documentation technique (`docs/`) et note développeur. *(18/09, soir : l'espace livreur `ui/coursier/` a été supprimé.)* À ouvrir en premier dans un navigateur pour naviguer dans l'ensemble.

## Ordre de lecture recommandé pour la documentation de spécification

1. **docs/01-flux-metier.html** — Comprendre le parcours complet : de la sélection du voyage par l'utilisateur jusqu'à la confirmation du règlement (par Bon d’achat PayEnCash — **bandeau du 18/09 en tête**, à lire avant le corps du document). Contient un diagramme visuel des 5 phases avec les statuts de commande associés, puis une section **« Retour du cash »** — le circuit qui ramène les espèces jusqu'au compte de l'entreprise, distinct du cycle de vie de la commande. Lire ce document en premier, il pose le vocabulaire et la logique métier utilisés partout ailleurs.
2. **docs/05-architecture.html** — Vue d'ensemble technique : composants, flux de données, séparation des responsabilités.
3. **ESPACE-COMMERCANT/documents/partie-6-donnees.html** — Modèle de données complet (tables, relations, contraintes), avec un diagramme entité-relation visuel. Nécessaire avant tout développement backend. *(18/09, soir : le diagramme du **sous-système de retour du cash** n'a plus d'objet. Le schéma qui fait foi est `server/db/schema.sql` — **108 tables**, après suppression de 27 tables emportées par l'agent.)*
4. **docs/03-api-specs.html** — Contrats d'interface exacts avec les fournisseurs externes (Duffel, Hotelbeds) et le **KYC client gradué** : endpoints, payloads, codes d'erreur à gérer. *(18/09, soir : **l'API d'encaissement par l'agent et le circuit de retour du cash sont supprimés**. À spécifier à la place : l'émission d'un bon d’achat au comptoir — avec le **prélèvement Stripe qui la conditionne** —, son débit au règlement, son re-crédit au remboursement, et le relevé mensuel du commerce.)*
5. **docs/04-pricing.html** — Logique de calcul du prix final affiché au client (marge fixe, marge de sécurité, stratégie de re-fetch en cas d'offre expirée).
6. **docs/06-segment-maghreb.html** — Spécificités techniques pour les vols vers le Maroc, l'Algérie et la Tunisie (Royal Air Maroc, Air Algérie, Tunisair) : couverture Duffel, point de vigilance sur l'accréditation par compagnie, particularités de schéma et de pricing. À lire une fois le flux généraliste compris, avant l'activation commerciale de ce segment.
7. **docs/07-annulations-remboursements.html** — Logique complète d'annulation et de remboursement : conditions réelles Duffel et Hotelbeds (*cancellation policies*), et le principe retenu depuis août — **AJEK ne rembourse jamais plus que ce qu'elle récupère**. *(18/09, soir : la restitution suit le moyen qui a payé, et les deux sont dématérialisés — **re-crédit du Bon d’achat PayEnCash**. Plus d'espèces remises par un agent.)* Contient aussi le catalogue des e-mails transactionnels et les rappels liés à la fenêtre de paiement.
8. **docs/08-mecanisme-financier.html** — Détaille le cycle réel de l'argent. *(18/09, soir : **il n'y a plus de retour du cash**. L'argent entre par **un seul virement de prestataire** — Stripe, qui prélève la carte du commerçant à chaque bon d’achat vendu — et se rapproche seul ; le dépôt en automate, le seuil de 400 €, le rapport quotidien et l'état `on_account` sont supprimés.)* Duffel exige un **solde prépayé** à avancer ; **Hotelbeds est post-payé** (booking confirmé puis facture réglée immédiatement, aucun fonds de roulement à porter). Contient également le traitement de la **TVA collectée** (dette envers l'État, exclue du bénéfice net) et le statut LCB-FT (AJEK a priori non assujettie, à confirmer par avis juridique).
9. **docs/09-espace-manager.html** — Spécifie l'interface interne de pilotage (distincte de l'app client) : centre d'appels clients, suivi financier en direct (revenus, dépenses fournisseurs, TVA collectée, bénéfice), comptabilité, comptes, clients, ligne Mode. *(18/09, soir : la supervision des livraisons, la gestion des livreurs, les zones, le dispatch et les frais de service **sont supprimés** — huit écrans manager avec eux. Le nouvel écran du modèle est `manager/29-partenaires` : activation d'un point, carte de règlement, prélèvements, relevé mensuel.)*
10. **outils-integration/outils-a-integrer.html** — Synthèse pratique : quels comptes créer, quelles clés obtenir, dans quel ordre, avant de commencer l'intégration.

## Le chemin de l'argent *(réécrit le 18/09 au soir — il n'y a plus de « circuit du cash »)*

Le produit ne s'arrête pas au règlement, mais **AJEK ne reçoit plus un seul billet**. L'argent entre par **deux canaux, tous deux scripturaux, qui se rapprochent seuls** :

- **Bon d’achat PayEnCash** — le commerçant vend le bon d’achat au comptoir ; **sa propre carte bancaire enregistrée est prélevée** de la valeur faciale **moins sa commission TTC** (1,10 % HT + TVA 20 %), via **Stripe**. Le prélèvement naît **avant** le bon d’achat, et **le bon d’achat n'existe que s'il est accepté** : un refus reste inscrit comme une ligne motivée, sans produire de titre. Le commerçant **ne détient donc jamais notre argent**, pas même un jour — c'est tout l'intérêt d'avoir abandonné le reversement mensuel.
- *(20/09 — « enlève la logique Neosurf » : le second titre et son rail en ligne sont supprimés.)* Les fonds arrivent par virement du prestataire.

Ce qui **n'existe plus** : les états `collected → declared → reconciled → on_account`, le dépôt en automate Cash Services, le seuil de dépôt de 400 €, la carte de dépôt nominative, le rapport quotidien à rapprocher, le fond de caisse, le rendu de monnaie, et la règle « une course = encaisser puis déposer ».

Ce qu'il faut **savoir de neuf** : un **bon d’achat vendu mais non dépensé est une dette au bilan**, pas un produit — la TVA est due **à l'utilisation** (art. 256 ter CGI), et la validité est de 12 mois. Et la **valeur des bons d’achat émis sur 12 mois glissants** doit être comptée : au-delà d'**1 M€**, une déclaration à l'ACPR est due (art. L521-3 II CMF).

## Maquettes — `ui/`

Toutes les maquettes vivent sous **`ui/`**, et nulle part ailleurs. Une seule règle de rangement : **un fichier = un parcours complet, ou une route de l'app**. Rien n'est dupliqué d'un dossier à l'autre.

**133 écrans au 18/09** (`ls ui/*/*.html`) :

```
ui/
├── assets/       kit partagé (charte, icônes, PEC_DATA, bus)
├── parcours/       4  un fichier = un parcours d'achat, toutes ses étapes enchaînées
├── ecrans/        23  app CLIENTE Fly, hors tunnel
├── fly/            8  app CLIENTE Fly, écrans de paiement et de promos
├── mode/          21  app CLIENTE Mode (compte séparé de Fly)
├── fournisseur/   18  app FOURNISSEUR Mode (KYB, stock, expéditions)
├── partenaire/     8  app COMMERÇANT PARTENAIRE — vend le Bon d’achat PayEnCash
├── commercial/    11  app COMMERCIAL & marketing
├── hotline/        2  app SUPPORT
└── manager/       38  espace de pilotage interne AJEK
```

⚠️ **`ui/coursier/` a été supprimé le 18/09 au soir** (19 écrans), avec l'agent de caisse mobile.

Ces maquettes suivent la **direction artistique réelle de l'application** (`payencash/frontend/`) : elles partagent un kit unique — `ui/assets/payencash-v2.css` (tokens et primitives, miroir de `theme.css`), `ui/assets/payencash-icons.js` (sprite Lucide) et `ui/assets/payencash-tracking.js` (carte live MapLibre). **Aucun token n'est redéclaré dans une maquette** : une correction de charte se fait à un seul endroit.

- **ui/parcours/** (3 parcours) — calqués sur les routes réelles du tunnel (stepper à fenêtre glissante, contenu scrollable, CTA fixe). `01-vol-aller-simple.html`, `02-vol-aller-retour.html` (avec **étape « Vol retour »** dédiée : rappel de l'aller + pill « Aller choisi »), `03-vol-hotel.html` (vol + hôtel, et **hôtel seul `stay_only`** via `?mode=stay`). Chaque parcours enchaîne choix → récap → voyageurs (bottom sheet) → collecte. ⚠️ Dans l'app, **les voyageurs ne sont pas un écran de tunnel** : ils se saisissent dans une bottom sheet ouverte depuis le récap, avec le carnet des voyageurs enregistrés.
- **ui/ecrans/** (23 écrans) — `01-accueil.html` (budget-first), `03-mes-codes.html` (suivi de commande, alertes prix, historique), les pages éditoriales `04-comment-ca-marche.html` à `08-contact.html`, `09-notifications.html`, `10-compte.html`, `11-suivi-etats-echec.html`, puis les pages arrivées depuis : `15-moyens-paiement.html`, `19-verification-identite.html`, **`25-ou-acheter-un-bon.html`** (la liste des commerces partenaires actifs).
- **ui/partenaire/** (8 écrans, 18/09) — l'espace du **commerçant partenaire**, qui **vend le Bon d’achat PayEnCash et n'encaisse aucune commande** : inscription du point, connexion (invitation du gérant), accueil, **vendre un bon d’achat**, bons d’achat vendus, reversements, mon point (dossier, carte de règlement), notifications.
- **ui/manager/** (38 écrans) — l'espace de pilotage interne : connexion, tableau de bord, commandes, trésorerie, suivi financier, centre d'appels, configuration, journal d'audit, détail commande, solde fournisseur, comptabilité & TVA, communications, comptes manager, fiche client, invitation, notifications, compte de résultat, ligne Mode, fournisseurs, atelier, stock, facturation, livre de police, clients, cartes cadeaux, vérifications, réclamations, expéditions, paiements en ligne, **commerces partenaires (`29`)**. Voir `ui/README.md`.

**(18/09, soir) Il n'y a plus d'UI de livraison.** `ui/ecrans/02-suivi-livraison.html` et le composant `CourierTrackingView` ont été supprimés avec l'agent : plus de carte live, plus d'ETA, plus de profil livreur, plus de code de sécurité révélé à l'arrivée. Le suivi d'une commande se lit sur `ui/ecrans/03-mes-codes.html` et `ui/mode/16-mes-commandes.html`.

**NOTE-DEVELOPPEUR.html** (racine) accompagne cette v2 : diff v1→v2, formules de pricing exactes (flight_only = `max(300, vol × 15 %)`, package = `(vol + hôtel) × 8 %`), mapping des champs voyageurs Duffel, bus `sessionStorage` (42 clés ↔ colonnes BDD), 12 endpoints backend à créer (dont le **KYC client**) et checklist d'intégration en 17 points. À lire avant de brancher le tunnel sur le backend. Voir aussi **l'Étape 4 · flux F11/F12** (`ESPACE-COMMERCANT/documents/partie-4-flux.html`) pour la deuxième ligne de produits (articles, achat ferme, expédition Mondial Relay par le fournisseur), qui partage l'encaissement cash mais a sa propre logique de facturation et de TVA.

## Points d'attention à ne pas manquer

- **(18/09, soir) Le règlement reste le seul évènement qui déclenche le paiement fournisseur** — mais ce n'est plus une validation de collecte : c'est le **débit du Bon d’achat PayEnCash**, sous verrou. Aucun appel Duffel ou Hotelbeds ne doit partir avant. **Ne jamais se fier au retour du navigateur** : il dit seulement que le client est revenu, pas que l'argent est arrivé.
- **(18/09, soir) L'émission d'un bon d’achat est conditionnée par le prélèvement du commerçant.** Le débit de sa carte naît **avant** le bon d’achat ; **un refus ne produit aucun titre**, et la ligne de refus reste inscrite avec son motif. L'idempotence porte sur ce prélèvement : un rejeu ne doit jamais émettre deux bons d’achat.
- **Configurer un timeout client HTTP d'au moins 130 secondes sur tous les appels Duffel** — leur API peut occasionnellement prendre jusqu'à 120 secondes à répondre, et un timeout plus court côté PayEnCash risquerait de perdre le suivi d'une réservation pourtant réussie côté fournisseur. Voir `docs/03-api-specs.html`.
- **Hotelbeds est retenu comme fournisseur d'hébergement** — accès self-service immédiat (inscription en ligne, clé API en quelques clics), contrairement à Expedia Rapid API qui est très sélectif dans l'acceptation de nouveaux partenaires et n'offre aucune garantie d'acceptation pour une jeune structure. Voir `outils-integration/outils-a-integrer.html`.
- Pour le segment Maghreb, l'éligibilité de Royal Air Maroc, Air Algérie et Tunisair à la vente sans accréditation IATA/ARC propre doit être confirmée directement avec Duffel avant développement spécifique — voir `docs/06-segment-maghreb.html`.
- **AJEK ne rembourse jamais plus que ce qu'elle récupère** — ce que l'on récupère côté fournisseur dépend des *cancellation policies* (Hotelbeds `rateClass` NRF/NOR, Duffel `order_cancellation`) et peut être nul ; **(18/09, soir)** la restitution **re-crédite le Bon d’achat PayEnCash**, ou passe par un virement au RIB du client. **Jamais d'espèces, jamais de rendu de monnaie.** Voir `docs/07-annulations-remboursements.html`.
- **(18/09, soir) Les plafonds sont les nôtres, et ils ont changé** : le plafond légal des espèces ne nous concerne plus (AJEK ne reçoit plus de billets ; le règlement au comptoir relève du commerçant). Les plafonds qui s'appliquent sont ceux du Bon d’achat PayEnCash, lus dans `ref.bons` et jamais écrits en dur : **minimum 5 €**, **250 € par bon d’achat**, **1 000 € de bons d’achat utilisés par client et par jour**, **validité 12 mois**, **annulation au comptoir sous 30 minutes**. Voir `docs/09-espace-manager.html`.
- **AJEK SASU n'est a priori pas assujettie à la LCB-FT — à confirmer par avis juridique.** En attendant, PayEnCash porte les plafonds, le **KYC client gradué** (3 achats ou 1 000 €/7 jours, PVID) et le **KYB fournisseurs** (ligne Mode). **(18/09, soir)** Vigilance neuve : un **Bon d’achat PayEnCash est un titre au porteur jusqu'à son premier usage** — c'est son rattachement au compte client vérifié, dès ce premier usage, qui le fait sortir de l'anonymat.
- **(18/09, soir) Compter la valeur des bons d’achat émis sur 12 mois glissants.** Au-delà d'**1 000 000 €**, une déclaration à l'**ACPR** est due (art. **L521-3 II** CMF ; silence = approbation, actualisation annuelle). Ce seuil se franchit avec le succès, sans qu'aucun évènement ne le signale : il faut un compteur et une alerte.
- **(18/09, soir) Un bon d’achat vendu et non dépensé est une DETTE, pas un revenu.** La TVA est due **à l'utilisation** (art. **256 ter** CGI), la validité est de 12 mois, et le sort du solde expiré (clause, TVA, comptabilisation) **reste à trancher** avec l'expert-comptable et l'avocat.
- ~~Géolocalisation temps réel et photos de collecte~~ — **(18/09, soir)** ces deux traitements **n'existent plus**. Les données sensibles qui restent : le **résultat** du KYC, les appels du support, et le rattachement d'un bon d’achat à un compte. Rétention bornée et purge automatique, voir `docs/05-architecture.html`.
- **Trésorerie : seul Duffel exige une avance.** L'argent du client arrive par le **prélèvement de la carte du commerçant** à chaque bon d’achat vendu (Stripe) ; Hotelbeds est **post-payé**. Il reste à provisionner le **solde prépayé Duffel** — et, **(18/09, soir)**, la dette des bons d’achat vendus non dépensés. La **TVA collectée n'est pas un revenu** : c'est une dette envers l'État. Voir `docs/08-mecanisme-financier.html`.
- Aucune stratégie de test automatisé n'est documentée à ce stade côté backend : la mise en place de tests (unitaires sur la logique de pricing, tests d'intégration sandbox Duffel/Hotelbeds) reste à la charge du développeur. *(Côté maquettes, le banc `tests/test-runner.html` couvre 360 scénarios.)*

## Contact

Pour toute question sur la logique métier ou les choix de conception, se référer en priorité à la fondatrice du projet avant toute supposition.
