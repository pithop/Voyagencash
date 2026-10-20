# Maquettes UI

Toutes les maquettes du produit vivent ici, et nulle part ailleurs.

## Règle de rangement

**Un fichier = un parcours complet, ou une route de l'application.** Rien d'autre. Si un écran
existe déjà à l'intérieur d'un parcours, on n'en fait pas un second fichier : c'est cette
duplication qui a fait diverger les maquettes par le passé.

```
ui/
├── assets/    kit partagé — la charte ne se corrige qu'ici
├── parcours/  un fichier = un parcours d'achat, toutes ses étapes enchaînées
├── ecrans/    un fichier = une route de l'app CLIENTE hors tunnel
├── fly/       un fichier = une route de l'app FLY (voyage)
├── mode/      un fichier = une route de l'app MODE (vêtements d'occasion)
├── partenaire/ un fichier = une route de l'espace COMMERÇANT qui vend le Bon d’achat PayEnCash
└── manager/   un fichier = une route de l'app MANAGER, desktop (voir manager/README.md)
```

## Parcours — `parcours/`

Calqués sur les routes réelles du tunnel (`app/(tunnel)/`) : `TunnelStepper` à fenêtre glissante
en haut, contenu scrollable, CTA fixe en bas. Chaque fichier enchaîne toutes ses étapes en JS.

| Fichier | Scénario | Étapes |
|---|---|---|
| `01-vol-aller-simple.html` | Vol aller simple | Vol → récap → voyageurs (bottom sheet) → paiement |
| `02-vol-aller-retour.html` | Aller-retour | Aller → **retour** (rappel de l'aller retenu) → récap une carte par tronçon → voyageurs → paiement |
| `03-vol-hotel.html` | Vol + hôtel | Vol → séjour → récap combiné (marge package) → voyageurs → paiement. Couvre aussi l'hôtel seul (`stay_only`, D12) via `?mode=stay` |
| `04-vol-multi.html` | Multi-tronçons | Tronçons → récap **tous tronçons** → voyageurs → paiement |

(18/09, soir) La dernière étape s'appelle **paiement**, plus « encaissement » : il n'y a plus de
somme à encaisser de la main à la main, seulement un code prépayé à saisir.

Les voyageurs **ne sont pas une étape de tunnel** : ils se saisissent dans une bottom sheet ouverte
depuis le récap, avec le carnet des voyageurs enregistrés. C'est le comportement de l'app.

## Écrans — `ecrans/`

| Fichier | Route de l'app |
|---|---|
| `01-accueil.html` | `/` |
| `03-mes-codes.html` | `/mes-codes` |
| `04-comment-ca-marche.html` | `/comment-ca-marche` |
| `05-securite-confiance.html` | `/securite` |
| `06-faq.html` | `/faq` |
| `07-apropos.html` | `/a-propos` |
| `08-contact.html` | `/contact` |
| `09-notifications.html` | `/notifications` |
| `10-compte.html` | `/compte` |
| `11-suivi-etats-echec.html` | `/suivi/[orderId]` — **états non nominaux** (voir ci-dessous) |

## Payer, état du 18/09 au soir

**Personne chez PayEnCash ne se déplace, ne touche d'espèces, ne rend la monnaie.** L'agent de
caisse mobile a été abandonné le 18/09 au soir (décision fondatrice : « supprime l'agent qui se
déplace, elle perd toute sa logique »). La promesse du produit n'est plus « payer en espèces »
mais **payer avec un bon d’achat** — ni numéro de carte,
ni mandat de prélèvement, ni compte à prouver.

(20/09) Il reste **un seul moyen**, un **code prépayé** acheté auprès d'un distributeur :

| | Bon d’achat PayEnCash |
|---|---|
| Réseau | nos **distributeurs sous contrat** : un commerce (le client s'y rend) ou un **distributeur mobile** (il se déplace) |
| Ce que fait le distributeur | il **vend** le bon d’achat, jamais il n'encaisse une commande |
| Ce que le client saisit | le code du ticket (12 caractères) |
| Qui débite | **PayEnCash**, dans son propre livre (`gift_cards`) |
| Où le trouver | `ecrans/25-ou-acheter-un-bon.html`, ou une rencontre depuis `mode/05` |

Les plafonds qui valent sont ceux du bon d’achat (`D.bonsRef()` : `plafondBon`, `plafondClientJour`,
`plafondClientMois` sur `fenetrePlafondJours` glissants) et celui du ticket anonyme
(`plafondAnonyme`). **Aucune maquette ne les écrit** : elles les lisent.

### Six écrans ont été supprimés le 18/09

Les deux écrans de recherche d'agent (Fly et Mode), celui de préparation du paiement, celui du
suivi de l'agent, celui du suivi de livraison et celui du paiement à domicile ont été **retirés du
dépôt**. **Aucun lien ne doit plus y mener**, ni dans un `href`, ni dans un script, ni dans un
texte : un audit de navigation échoue au premier lien mort.

L'écran de suivi de livraison était présenté ici comme « LA maquette d'encaissement du produit » :
carte live MapLibre, profil de l'agent, ETA, flashcode à faire scanner, code à quatre chiffres
révélé à son arrivée. Tout cela décrivait un face-à-face qui n'a plus lieu. **Il n'est remplacé
par rien** : il n'y a plus d'encaissement à suivre, seulement un code à saisir.

`ecrans/11-suivi-etats-echec.html` reste, et couvre désormais les **quatre états non nominaux**
qui peuvent encore naître :

| État affiché | D'où il vient |
|---|---|
| `BON_REFUSE` | `gift_cards.status` / `balance_cents` — le code a été refusé (bloqué, expiré, épuisé), **rien n'est débité** |
| `EXPIRED` | `orders.status = CANCELLED` + `expired_at` — la fenêtre de paiement s'est fermée |
| `CANCELLED` | `orders.status = CANCELLED` — annulée avant tout paiement |
| `REFUNDED` | `orders.status = REFUNDED` — re-crédit du bon d’achat, avoir, ou virement |

Chaque état dit **ce qui a été débité ou non**, et **où aller** ensuite. Les états
`COLLECTION_FAILED` (l'encaissement à domicile qui n'aboutit pas) et `FAILED` (« somme encaissée,
billet refusé par la compagnie ») ont disparu avec l'agent : le premier ne pouvait naître que
d'un rendez-vous, le second que d'espèces comptées sur un palier.

### Le code de sécurité n'existe plus

Il était le second des « deux codes » : quatre chiffres révélés à l'arrivée de l'agent, dictés
puis saisis par lui pour authentifier la remise. Sans remise, il n'authentifie rien. **Il ne
reste qu'un code** — la référence interne de la commande (`payments.internal_code`, forme
`PEC-Z6DNX8HV`), qui *identifie* le dossier et ne se montre à personne.

## Kit partagé — `assets/`

| Fichier | Rôle |
|---|---|
| `payencash-v2.css` | Tokens (miroir de `frontend/src/styles/theme.css`) + primitives `pec-*` |
| `payencash-icons.js` | Sprite Lucide injecté dans le `body` |
| `payencash-qr.js` | Encodeur QR vanilla — le flashcode d'une réf, là où il sert encore |

**Aucune maquette ne redéclare un token.** Une correction de charte se fait dans
`payencash-v2.css` et se propage partout. La source de vérité visuelle reste l'application réelle
(`payencash/frontend/`), complétée par `../DESIGN_SYSTEM.md`.

## Espace manager — desktop

`ui/manager/` (20 écrans) aligne l'espace manager sur la charte v2. C'était la **seule surface
du produit restée en palette v1** (vert sapin, cuivre, Archivo). La mise en page desktop est
conservée : ce sont les couleurs, la typographie et les composants qui changent, pas la densité.

Son kit `assets/payencash-manager.css` ajoute les primitives desktop (coque, tableau,
indicateur chiffré, poche de trésorerie, ligne de réglage) **sans redéclarer un seul token**.
Le filet entre rangées de tableau est la seule bordure de tout le produit, et la charte
l'autorise explicitement.
