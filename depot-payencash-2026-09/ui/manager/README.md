# Espace manager — maquettes

Application `manager/` (port 5174). **Desktop assumé** : barre latérale fixe, tableaux denses,
plusieurs colonnes. On ne cherche pas à en faire une app mobile — un responsable de zone
travaille sur un écran large, et tasser ces tableaux dans 430 px les rendrait illisibles.

## Palette et typographie cibles

L'app manager actuelle (`manager/src/styles/theme.css`) est restée sur la **palette v1** :
vert sapin `#1f4438`, cuivre `#d8722b`, crème, couple Archivo + Inter. C'est la seule surface
du produit qui ne parle pas la même langue visuelle que l'app cliente.

Ces maquettes l'alignent sur la **charte v2** : mint `#10a06a`, encre `#0f2a24`, Hanken
Grotesk, profondeur par ombres. **La mise en page desktop est conservée** — c'est la couleur,
la typographie et les composants qui changent, pas la densité ni la structure.

Le kit `../assets/payencash-manager.css` **ne redéclare aucun token** : il ajoute les
primitives propres au desktop (coque, tableau, indicateur chiffré, poche de trésorerie,
ligne de réglage) par-dessus `payencash-v2.css`.

**Seule bordure tolérée** : le filet `1px solid var(--color-sep)` entre rangées d'un tableau.
La charte l'autorise explicitement, et un tableau dense sans filet devient illisible.

## Écrans

| Fichier | Route | Rôle |
|---|---|---|
| `01-connexion.html` | `/login` | Identifiant + mot de passe. Le rôle est vérifié par un guard **global**. |
| `02-tableau-de-bord.html` | `/` | Quatre indicateurs et l'activité en direct. |
| `04-commandes.html` | `/reservations` | Quatre filtres, tri par urgence, recherche par référence — **liste de cartes**, chacune avec ses actions. |
| `07-tresorerie.html` | `/tresorerie` | Les poches de l'argent : prélevé sur la carte des commerces, encaissé en ligne chez le prestataire, dû au client, disponible sur le compte (Qonto). Avoirs à rattacher, remboursements à virer. |
| `08-finance.html` | `/finance` | Net réalisé, trésorerie, comptes fournisseurs, potentiel PENDING/DRAFT, détail jour par jour. |
| `09-appels.html` | `/appels` | Sélecteur de jour, **satisfaction du mois**, appels planifiés et questionnaire. |
| `10-configuration.html` | `/config` | Marges avec **un bouton Enregistrer par ligne**, TVA, espèces (plafond, rétention de position), paiement en ligne, Bon d’achat PayEnCash, marketing. |
| `11-audit.html` | `/audit` | Journal en lecture seule — acteur en UUID et détails en JSON, tels qu'ils sortent aujourd'hui. |
| `12-commande-detail.html` | `/reservations/[id]` | Cheminement complet et les **trois actions exceptionnelles** (confirmation manuelle, annulation, annulation forcée). |
| `13-solde-fournisseur.html` | `/finance/wallets` | Avance prépayée Duffel, mouvements, recharge. |
| `14-comptabilite.html` | `/comptabilite` | **Cible.** TVA **encaissée** et TVA **déductible**, net à reverser, provision, exports. |
| `16-communications.html` | `/communications` | **Cible.** Catalogue des e-mails, journal des envois, notifications in-app des 3 surfaces. |
| `17-comptes-manager.html` | `/comptes` | **Cible.** Comptes, invitations, rôles, désactivation. Owner uniquement. |
| `18-fiche-client.html` | `/clients` | **Cible.** Support et demandes RGPD sous vérification OTP. |
| `19-invitation.html` | `/invitation/[token]` | **Cible.** Acceptation hors session — la seule route manager sans garde. |
| `20-notifications.html` | `/notifications` | **Cible.** Écarts à traiter adressés au manager. |
| `29-partenaires.html` | `/partenaires` | (18/09) Le réseau de **commerces partenaires** qui vend le Bon d’achat PayEnCash : candidatures, dossier, activation, suspension, relevés. |

La barre latérale n'est plus recopiée dans chaque fichier : elle est décrite une fois dans
`../assets/payencash-manager-nav.js`, et chaque écran l'accueille avec
`<aside class="pec-aside" data-pec-nav></aside>`. L'entrée active se déduit du nom de fichier —
rien à renseigner écran par écran, donc rien à oublier de mettre à jour.

## L'agent de caisse mobile est abandonné (18/09, soir)

Décision fondatrice : **« supprime l'agent qui se déplace, elle perd toute sa logique »**. L'app agent,
les courses à domicile, les caisses, les tournées, les dépôts d'espèces, le planning, les zones de
dispatch, la flotte et la paie des agents n'existent plus. Ce qui les remplace, ce sont **deux moyens
de payer, tous deux réglés en espèces au comptoir d'un commerce** :

- le **Bon d’achat PayEnCash**, vendu par un **commerce partenaire** sous contrat (écran `29`, bons d’achat en `41`) —
  le commerçant encaisse les espèces pour le compte de PayEnCash et sa carte est débitée dans la seconde ;
- (20/09) le ticket d'un réseau tiers et l'écran `45` qui suivait ses transactions sont **supprimés** :
  il n'y a plus qu'un titre, le nôtre.

Conséquence principale, et raison de la décision : **le client ne remet plus jamais d'espèces à
quelqu'un de PayEnCash**, ce qui supprime le risque de transport de fonds (CNAPS) relevé le 17/09.
PayEnCash ne détient d'ailleurs plus un seul billet — l'argent arrive par virement de deux
prestataires. Écrans supprimés avec l'agent : `03-livraisons`, `05-coursiers`, `06-zones-dispatch`,
`15-coursier-remuneration`, `22-flotte`, `24-planning`, `33-fonds-caisse` et `32-rapprochement`
(il ne rapprochait que les dépôts d'espèces et le terminal carte de l'agent).

Plafond espèces **1 000 €/transaction**, paramétrable (écran `10`) ; plafond par bon d’achat et plafond
journalier par client au même endroit. Côté fournisseurs, seul Duffel est prépayé ; **Nuitée est
post-payé** (aucun solde, aucune recharge).

## Trois partis pris qui ne sont pas décoratifs

**Les poches de trésorerie ne s'additionnent jamais.** Deux d'entre elles sont détenues par des
prestataires — le prélèvement sur la carte des commerces, les transactions acceptées en ligne — et
ne deviennent de la trésorerie qu'au **versement** sur le compte, que la poche `on_account`
constate. Une troisième est **due aux clients** : elle se retranche. Les cumuler ferait croire à
une trésorerie qu'on n'a pas. Seule la poche « disponible » est ventilable : elle est en encre
pleine pour qu'on ne la confonde pas avec les autres.

**La TVA encaissée a son propre écran.** C'est de l'argent qu'on encaisse sans qu'il nous
appartienne. Fondue dans le chiffre d'affaires, elle fausserait le bénéfice net et, de proche en
proche, le dimensionnement de l'avance Duffel. La Doc 8 n'exige pas seulement de l'afficher :
elle exige de la **mettre de côté**. Un montant qu'on affiche sans le provisionner est un montant
qu'on dépense — d'où `14-comptabilite`, et l'écart « non provisionné » en liseré ambre.

**Aucun mouvement d'argent ne se constate d'un clic.** Un avoir se rattache à un compte client,
un remboursement s'émet en deux clics et se journalise, un versement de prestataire ne se
« marque » pas comme arrivé. Un bouton qui constaterait en masse reviendrait à payer avec de
l'argent qui n'est pas là.

## Ce que le manager ne fait pas

- **Il n'émet pas de bon d’achat à la place d'un commerçant.** Un bon d’achat naît du paiement : la carte du
  commerce est débitée avant que le code existe. Sans débit, pas de code.
- **Il ne décide pas qu'un versement est arrivé.** Seule la confirmation bancaire fait passer
  l'argent en `on_account` — c'est elle, et rien d'autre, qui autorise à payer.
- **Il ne corrige pas un montant bancaire.** Le relevé fait foi ; l'écart se tranche et se
  journalise, il ne se réécrit pas.

## Ce que l'audit de traçabilité a révélé

L'app manager réelle appelle **17 chemins sous `/manager/*`** via `manager.facade.ts`. Aucun
n'était documenté : la Doc 3 ne décrivait que les endpoints du terrain. Deux fonctionnalités
entières n'avaient donc **aucune maquette** — le détail d'une commande (avec ses trois actions à
haut risque) et la gestion du solde prépayé Duffel.

La matrice de traçabilité de la **Doc 9** relie désormais chaque fonctionnalité à son écran, son
endpoint et sa section de documentation. Cinq contrats restent à figer : ils y sont listés
explicitement plutôt que d'être découverts au moment de câbler l'écran.

## Pourquoi ces maquettes ont été refaites

La première version avait été reconstituée **depuis les routes et la façade**, jamais depuis
l'écran lui-même. Une liste d'endpoints ne dit pas ce qu'un écran montre : elle a produit des
blocs inventés et laissé de côté des blocs bien réels.

| Écran | Inventé | Manquant |
|---|---|---|
| `/reservations` | Colonne « dont TVA », colonne « Trajet », tableau dense | Les quatre filtres, le tri par urgence, les quatre actions par ligne |
| `/appels` | Motifs et statuts d'appel qui n'existent pas | Le sélecteur de jour, la satisfaction du mois, le questionnaire |
| `/config` | Un bouton « Enregistrer » global en haut d'écran | Un bouton par ligne de marge — l'écran envoie une catégorie à la fois |
| `/audit` | Barre de recherche, filtre « 30 derniers jours », noms lisibles | La réalité : acteur en UUID brut, détails en JSON brut |
| `/finance` | Une structure entièrement différente | Trésorerie, comptes fournisseurs, potentiel PENDING/DRAFT, détail jour par jour |

Les valeurs restent illustratives — une maquette n'est pas un export de production — mais la
**structure, les libellés et les états** sont ceux de l'application. Deux valeurs relevées en
production sont reprises telles quelles parce qu'elles étaient fausses : le seuil d'alerte des
comptes fournisseurs (**500 €**) et la marge « séjour seul » (**10 %**, et non 12).
