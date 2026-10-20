# Audit G — chaîne MODE ↔ FLY ↔ PARTENAIRE (achat / réservation / encaissement au point)

> **Pivot du 17/09/2026 :** cette annexe est un relevé daté du 09/09. Le réseau de points partenaires qui encaissaient pour AJEK, la borne, le mandat B et les flyers de point qu'elle audite ont été **supprimés** le 17/09. Les constats qui les visent ne sont plus à traiter.
>
> **(18/09, soir) — deux décisions fondatrices ont réduit encore le périmètre de ce relevé.** **① L'agent de caisse mobile est supprimé** : plus aucun salarié ne se déplace pour encaisser, donc plus de flotte, de zones de dispatch, de planning de tournées, de paie d'agent, de dépôts d'espèces ni de rendu de monnaie ; l'app coursier et huit écrans manager ont disparu du disque. **② Le reversement mensuel du partenaire est supprimé** : la carte enregistrée du commerce est prélevée à chaque vente d'un bon d’achat (prestataire Stancer), donc plus de créance, d'échéance, de relance ni d'IBAN de reversement — il ne reste qu'un relevé mensuel, support de l'autofacture de commission. Le client paie désormais **avec un bon d’achat** par deux moyens achetés au comptoir d'un commerce : le **Bon d’achat PayEnCash** et le **Bon d’achat PayEnCash**.
>
> **Devenu sans objet :** tout ce qui suit une vente `par:'borne'` (§126 : encours, dépôt, tournée, trésorerie, « Dernier relevé de la borne ») et **C37 — le rendu de monnaie par virement**, qui n'a plus d'objet puisque personne ne rend la monnaie : un bon d’achat ne se rend pas en espèces, son solde reste sur le bon.
>
> **Reste lisible :** toute la chaîne découverte → panier → commande → règlement → remboursement côté Mode et Fly (favoris, fidélité, anti-survente, fenêtre de règlement, avoirs), qui ne dépend d'aucun moyen de paiement en particulier.

Dossier : `/Users/emilieruiz/Downloads/payencash-documentation-2026-07-31` · lecture seule · 09/09/2026.
Périmètre lu dans le code : `ui/assets/payencash-data.js` (PEC_DATA), `payencash-bus.js` (PEC_BUS), `payencash-partenaire.js` (PEC_PART), `payencash-rendu.js`, `payencash-verif.js`, `payencash-garde.js`, `payencash-notif.js`, `payencash-filters.js` ; écrans `ui/mode/01…23`, `ui/fly/01…12`, `ui/ecrans/00, 01, 03, 09, 10, 13, 15, 16, 21, 23`, `ui/parcours/01`, `ui/partenaire/02…05` ; `server/db/schema.sql` ; renvois manager (`04, 07, 12, 27, 29`) uniquement pour vérifier qui appelle `rembourser / annuler / renduVirementEmettre / commissionVirementEmettre`.

Chaque constat : fichier:ligne · catégorie · gravité · ce qui se passe aujourd'hui · ce qu'il faudrait. Ce qui marche n'est pas listé. Tout est vérifié dans le code (les numéros de ligne sont ceux des fichiers au 09/09).

Catégories : TROU (rien ne porte le jalon) · DUR (valeur/logique figée en page) · LOGIQUE ABSENTE OU BÂCLÉE · STATIQUE (affiché sans donnée derrière) · PERTE DE DONNÉE · SCHÉMA (data-layer ≠ SQL) · UX FLUX.

---

## 1 · Découverte (catalogue, favoris, alertes, tendances)

**C1 — Favoris et fidélité Mode ne suivent pas le compte : effacés à chaque connexion.**
`ui/assets/payencash-data.js:1356-1357` (déconnexion), `:1363` (connexion), `:1394` (réhydratation depuis le seed), `:3982` (`favorisPersist` → clé globale `pec-mode-favoris`), `:3748` (`fidelitePut` → clé globale `pec-mode-fidelite`) · **PERTE DE DONNÉE** · **majeur**
- Aujourd'hui : `favorisToggle` et `fideliteAjouter` écrivent des clés globales ; `clientActifSet(id)` les supprime puis `clientHydrater` recopie `c.favoris` / `c.fidelite` du client **construit au boot** (`construireClients`, déterministe). Rien n'est jamais réécrit dans `pec-clients-crees`. Résultat : tout favori ajouté/retiré et tout point gagné (« Bien reçue », `mode/04`) disparaît à la prochaine connexion. `payencash-garde.js:120` promet pourtant « elles te suivent d'un appareil à l'autre ».
- Il faudrait : clés par client (`_clePerso`, comme `cleReglees`) **et** réécriture dans la fiche client (miroir `user_favorites` / `loyalty_ledger`), ou au minimum ne pas purger/réhydrater ces deux clés à la connexion du même compte.

**C2 — « Échange de taille gratuit, aller-retour inclus » promis sur la fiche, inexistant.**
`ui/mode/02-article.html:549` vs `ui/assets/payencash-data.js:596` (motif « La taille ne me va pas » → `fraisOfferts:false`, 4,90 €) et `ui/mode/13-retour.html` (retour + remboursement uniquement) · **STATIQUE / LOGIQUE ABSENTE** · **majeur**
- Aujourd'hui : la fiche annonce un échange gratuit « depuis Compte → Mes commandes » ; aucun écran d'échange n'existe et le seul flux (13-retour) facture 4,90 € pour ce motif.
- Il faudrait : soit retirer la promesse, soit un vrai flux d'échange (nouvelle réservation de taille + étiquette retour offerte) aligné avec `mode.retour`.

**C3 — Crochet de test `?multi=1` qui modifie le panier depuis l'URL.**
`ui/mode/03-panier.html:285-287` · **DUR** · mineur
- Aujourd'hui : n'importe quelle URL `03-panier.html?multi=1` ajoute 2 sacs au panier de l'utilisateur.
- Il faudrait : retirer le crochet (le banc peut appeler `panierAjouter`).

---

## 2 · Panier → commande groupée (verrou, décompte, plafond, canal)

**C4 — Le sac public est perdu au moment de se connecter pour payer.**
`ui/mode/03-panier.html:609` (« Ton sac est gardé ») vs `ui/assets/payencash-data.js:1363-1372` (`clientActifSet` : `removeItem('pec-mode-panier')` + `items = []`) · **PERTE DE DONNÉE** · **bloquant**
- Aujourd'hui : le panier est public (garde), le CTA dit « Me connecter pour régler », `compteConnecter` → `clientActifSet` vide le sac. Le client revient sur un panier vide.
- Il faudrait : à la connexion, fusionner le sac anonyme dans le panier du compte (miroir `carts` UNIQUE par `user_id`), puis seulement le vider à un **changement** de compte.

**C5 — Réservation de stock sans expiration : une pièce reste bloquée tant que l'appareil du client ne la libère pas.**
`ui/assets/payencash-data.js:4125` (`resa.push({ ref, articleId, taille })` sans `expireTs`), `:4470-4473` et `:4501-4514` (un hold sans `expireMin` est actif), libération uniquement côté client `ui/mode/11-code-paiement.html:170, 288-291`, `ui/mode/03-panier.html:281-284` · **SCHÉMA + LOGIQUE ABSENTE** · **majeur**
- Aujourd'hui : `commanderPanier` pose le hold, le seul relâchement est `libererCommande()` déclenché par un tick de l'écran client. Si le client ferme l'app, la pièce (souvent unique) est invendable indéfiniment. `schema.sql:670` impose `expires_at NOT NULL`.
- Il faudrait : `expireTs` sur chaque réservation, filtré dans `stockIndex` / `stockArticle` (comme `expireMin`), et une expiration dérivée à la lecture (comme `PEC_BUS.commandes()` le fait pour le canal agent).

**C6 — Deux fenêtres concurrentes : 120 min sur le code, 60 min dans les notifications et côté Fly.**
`ui/assets/payencash-data.js:4104` (`expireTs = fenetreEncaissementMinutes` 120) vs `:5250` (`notifs` : `prixBloqueMinutes` 60), `ui/ecrans/03-mes-codes.html:162-170`, `ui/fly/02-ordre-paiement.html:371-375`, `ui/fly/04-itineraire-point.html:353` · **LOGIQUE** · **majeur**
- Aujourd'hui : à 61 min, le fil de notifications Mode dit « Commande annulée — prix expiré, rien ne t'a été débité » alors que `mode/11` affiche « Prix garanti — encore 59 min » et que la commande est encaissable. Fly n'a pas d'`expireTs` du tout : chaque écran recalcule 60 min depuis `cmd.at`.
- Il faudrait : **une** échéance portée par la commande du bus (`expireTs` posé à l'annonce, Fly compris), lue par notifs / 03-mes-codes / fly-02 / fly-04 / partenaire-04.

**C7 — Plafond espèces 1 000 € : la répartition espèces/carte est affichée, jamais exécutée.**
`ui/mode/03-panier.html:566-585` et `ui/mode/11-code-paiement.html:237-238` (affichage « dont X par carte (obligatoire) ») ; `ui/partenaire/04-encaisser.html:404` (simple avertissement), `:459-462` (l'envoi refuse tout montant ≠ `du()` = total plein), `:515` (`reglement.especes = inséré`) ; `ui/assets/payencash-bus.js:294-297, 325-331` (aucun contrôle du plafond) · **LOGIQUE ABSENTE** · **bloquant (L112-6 CMF)**
- Aujourd'hui : pour 1 200 €, la borne affiche 1 200 €, le partenaire déclare 1 200 € d'espèces, le bus l'accepte, aucun jalon carte n'existe (l'app n'a « un bon d’achat suffit », le TPE promis n'a pas de représentation).
- Il faudrait : la commande porte `partEspeces` / `partCb` dès `commanderPanier` ; la borne n'affiche que `partEspeces` ; `payer` refuse `especes > plafond` ; un jalon explicite « part carte réglée sur le TPE de la borne » (ou refus de la commande tant qu'elle n'est pas réglée).

**C8 — Fly > 1 000 € : tout l'aval perd la commande (mauvais trajet, mauvais montant, part carte disparue).**
`ui/fly/07-promo-recap.html:296` (`?m=` = plafond×100), `ui/assets/payencash-data.js:5103-5112` (`commandeEnCoursGet(m)` refuse si `totalCents ≠ m`), `ui/fly/01-ou-payer.html:566`, `ui/fly/04-itineraire-point.html:157-159` (`carte` non relayé vers 02), `ui/fly/02-ordre-paiement.html:212-231` · **LOGIQUE BÂCLÉE** · **bloquant**
- Aujourd'hui : un pack Santorin × 2 (1 960 €) → `?m=100000` ; le dépôt du tunnel n'est plus retrouvé → fly/02 affiche la ligne canonique « Marseille → Barcelone · 1 voyageur », annonce 1 000 € au bus, le partenaire encaisse 1 000 €, la facture fly/10 dit 1 000 €, les 960 € de carte n'existent plus nulle part.
- Il faudrait : `commandeEnCoursSet` clé par réf (pas par montant), `?m` = total, la répartition dérivée par `reglementLibelle` en aval.

**C9 — Détail du prix promo rendu « undefined — undefined ».**
`ui/fly/07-promo-recap.html:284-288` (dépose `{ l, v }`) vs `ui/fly/02-ordre-paiement.html:236-238` (lit `l[0]`, `l[1]`) et `ui/partenaire/04-encaisser.html:249-256` (`partVolDuffel` idem) · **LOGIQUE BÂCLÉE** · **majeur**
- Aujourd'hui : toute promo ≤ 1 000 € passe par ce chemin ; l'ordre de paiement affiche des lignes `undefined` ; l'achat fournisseur voyage retombe sur le montant total (majorant).
- Il faudrait : un seul format (`[libellé, valeur]`, celui des 4 tunnels).

**C10 — Décomptes décoratifs qui n'expirent rien.**
`ui/mode/05-ou-payer.html:406-421` (démarre à l'ouverture de la page, avant toute commande → « Prix expiré », points grisés) ; `ui/mode/11-code-paiement.html:199, 296-302` (seed) ; `ui/mode/03-panier.html:421-458` (`carteMono`, `data-minsec`) ; `ui/mode/07-itineraire-point.html:53` (« 57:12 » en dur avant script) · **STATIQUE** · mineur
- Il faudrait : ne compter que depuis `expireTs` d'une commande réelle (05 n'a pas de prix bloqué : ne rien afficher).

**C11 — Points fidélité annoncés à « Où payer », crédités seulement au clic « Bien reçue » ; cagnotte Fly jamais créditée.**
`ui/mode/05-ou-payer.html:565` (« +N pts »), `ui/mode/04-commande.html:142-151` (seul appelant de `fideliteAjouter`), `ui/assets/payencash-data.js:2594-2599` (`cagnotteClient` : lecture seule, aucune écriture hors seed), `ui/fly/03-jeu-concours.html` (« chaque commande réglée en donne un ») · **LOGIQUE ABSENTE** · **majeur**
- Aujourd'hui : « 1 € encaissé = 1 pt » (`infosPubliques`) n'est vrai ni pour Mode (crédit au clic, non persisté au compte — C1) ni pour Fly (rien).
- Il faudrait : crédit dérivé du règlement (bus `payer` → `loyalty_ledger` par `clientId`), cagnotte = somme des points de commandes payées.

---

## 3 · Choix du point (annuaire, distance, horaires, itinéraire)

**C12 — 29 « points partenaires » côté client, 9 partenaires réels : 20 points n'ont ni compte ni encaisseur.**
`ui/assets/payencash-data.js:5434-5463` (`points`, 29) vs `:5478-5486` (`partenairesBase`, 9) ; `ui/mode/05-ou-payer.html:868-880`, `ui/fly/01-ou-payer.html:848-860` listent `bornes()` en entier · **TROU** · **majeur**
- Aujourd'hui : un client choisit « Tabac de la Joliette » ; la commande est annoncée `point:'Tabac de la Joliette'` ; `commandeDuPoint` ne la rattache à aucun partenaire → aucune app ne la voit en « approche », aucune commission, aucun relevé.
- Il faudrait : une seule table (`partners` ↔ `kiosks.partner_id`) ; l'annuaire client dérivé des partenaires **actifs** à borne **active**.

**C13 — Mode : la commande ne porte pas de `pointId`, et « changer de point » ne change rien.**
`ui/mode/05-ou-payer.html:922` (`commanderPanier({ nom, adresse })`), `ui/mode/11-code-paiement.html:73, 273` (annonce `point: cmd.pointNom` seulement) · **LOGIQUE BÂCLÉE** · **majeur**
- Aujourd'hui : rattachement par nom d'enseigne (repli de `commandeDuPoint`). Après « Payer ailleurs », 05 ne relance pas (panier vide), 07 affiche le `?pt` choisi mais 11 ré-annonce l'ancien `pointNom` : le point de la commande ne change jamais.
- Il faudrait : `pointId` sur la commande groupée et dans l'annonce ; un vrai geste « changer de point » qui ré-annonce `{point, pointId}`.

**C14 — Itinéraire Mode à vol d'oiseau, ETA figés.**
`ui/mode/07-itineraire-point.html:152` (ligne droite) vs `ui/fly/04-itineraire-point.html` (routage OSRM + suivi de position) ; ETA depuis `p.trott/p.pied` écrits pour 3 points (`data.js:5434-5436`), absents pour 26 (défaut 2/5 min, `mode/07:194`) · **STATIQUE / DUR** · mineur
- Il faudrait : réutiliser le routage et le calcul de fly/04 (les deux pages ont le même rôle).

---

## 4 · Flashcode / code de paiement (unicité, expiration)

**C15 — Une commande « au point » n'expire jamais dans le bus : le client la croit annulée, le partenaire l'encaisse.**
`ui/assets/payencash-bus.js:232` (expiration uniquement `canal === 'agent'`), `:275-297` (`payer` ne vérifie aucune échéance) ; côté client `ui/ecrans/03-mes-codes.html:317` (« rien ne t'a été débité, tu ne dois rien »), `ui/assets/payencash-data.js:5285-5288` (notif « Commande annulée — prix expiré ») ; côté partenaire `ui/partenaire/04-encaisser.html:203-210` (« reste à régler ») · **LOGIQUE** · **bloquant**
- Aujourd'hui : après 60 min, les deux côtés se contredisent ; le partenaire peut envoyer le montant à la borne et déclarer, le bus accepte, le client bascule « Paiement reçu » sur une commande qu'on lui a dite morte (au prix « garanti » périmé).
- Il faudrait : `commandes()` dérive `annule` (motif expirée) pour tout canal passé `expireTs` ; `payer` refuse une commande expirée (ou re-cote le prix).

**C16 — Replis « seed » qui fabriquent une commande à payer.**
`ui/mode/11-code-paiement.html:183-199` (commande `a_payer` générée pour 25 % des clients de démo, annoncée au bus avec un décompte décoratif) ; `ui/mode/04-commande.html:91` (toute réf inconnue → `D.mode.commande` M-1208 « Tabac du Centre ») ; `ui/assets/payencash-data.js:1072` (`promoCommande` PEC-B7CR31XA « 24 sept 2026 » atteignable par `?res=promo`) · **STATIQUE** · mineur
- Il faudrait : sans commande réelle → état vide ; supprimer `promoCommande` et le chemin `?res=promo`.

---

## 5 · Au point — partenaire (scan, borne, encaissement, rendu, reçu)

**C17 — Pas de scanner : « Visez le flashcode » est une zone décorative.**
`ui/partenaire/04-encaisser.html:74-81` (`#e-scan`, aucun gestionnaire ; seul `#e-code` est écouté, `:319`) · **LOGIQUE ABSENTE** · **majeur**
- Aujourd'hui : le geste fondateur du pivot borne (« le commerçant SCANNE ») n'existe que par saisie manuelle de la réf ; l'app agent, elle, a un vrai scanner (`payencash-qr`).
- Il faudrait : le même lecteur QR que l'agent, qui pré-remplit `#e-code`.

**C18 — Le montant inséré à la borne est recopié à la main par le commerçant.**
`ui/partenaire/04-encaisser.html:385` (`insere()` : « vide = montant dû »), `:515` (`reglement.especes = inséré`, `cb: 0`) · **LOGIQUE BÂCLÉE / UX FLUX** · **majeur**
- Aujourd'hui : l'automate ne remonte rien ; le rendu (espèces ou virement) et la part espèces qui entre au coffre sont calculés sur une saisie libre du partenaire — c'est précisément ce que le pivot borne voulait retirer des mains du commerçant.
- Il faudrait : l'événement de la borne (montant inséré, rendu, reçu imprimé) comme source, journalisé `borne_reglement` ; la déclaration du partenaire ne fait que confirmer.

**C19 — Vente au guichet (03-vendre) : client sans identité, répartition écrasée.**
`ui/partenaire/03-vendre.html:219-221` (`client: nom` texte libre, `reglement {partEspeces, partCb}`) vs `ui/partenaire/04-encaisser.html:515` (`reglement` réécrit sans `partCb`) ; `ui/assets/payencash-bus.js:325-331` · **TROU** · **majeur**
- Aujourd'hui : « la réservation se lance (billet émis) » pour un client dont on n'a ni téléphone, ni e-mail, ni compte ; la commande apparaît dans les Réservations de **tous** les clients de l'appareil (C26) ; au-dessus du plafond, la part carte annoncée disparaît à la déclaration.
- Il faudrait : identifier le client (téléphone → compte, `clientId`) avant de créer la commande ; `payer` conserve `partCb` s'il est annoncé.

**C20 — Le coffre de la borne n'est relevé nulle part : le cash réglé au point disparaît de la chaîne argent.**
`ui/partenaire/02-accueil.html:196-208` (« Dernier relevé » dérivé des `PEC_BUS.depots()` de l'**agent**), `ui/assets/payencash-bus.js:558-575` (`encoursAgent` : `c.par === 'agent'` seulement), aucun écran manager/agent ne relève une borne (`grep` : seule `data.js:1107` mentionne « relevé par l'agent ») · **TROU** · **bloquant**
- Aujourd'hui : une vente `par:'borne'` n'entre dans aucun encours, aucun dépôt, aucune tournée, aucune trésorerie ; « Dernier relevé de la borne » restera « aucune relève » pour toujours.
- Il faudrait : un cycle `coffre_borne` (solde dérivé des ventes `par:'borne'` du point − relèves), un geste de relève (agent ou manager) qui alimente `cash_deposits`, et la trésorerie qui le lit.

**C21 — Numéro de reçu consommé avant le verdict du bus.**
`ui/partenaire/04-encaisser.html:515` (`recu: PEC_BUS.numeroRecu()` passé à `payer`) · **LOGIQUE BÂCLÉE** · mineur
- Aujourd'hui : chaque refus (déjà réglée, montant incohérent) brûle une séquence de reçu.
- Il faudrait : laisser `payer` poser le reçu (il le fait déjà si absent).

---

## 6 · Après règlement — Mode (expédition, suivi, réception, retour)

**C22 — Aucune vraie commande n'atteint « livrée » : le suivi s'arrête à « expédié », la réception n'est pas persistée.**
`ui/assets/payencash-data.js:1587-1592` (statuts transporteur déclarés, écrits par personne), `:4327-4350` (`commandesEnLivraison` ne connaît que `a_expedier / etiquette_prete / expedie`), `ui/mode/22-livraisons.html:195` (« Livrées » = seed `M.commandes` seulement), `ui/mode/04-commande.html:142-151` (« Bien reçue » : aucun `receptionAt`, le bouton revient au rechargement), `:39` (lien retour sans `?ref`) · **LOGIQUE ABSENTE** · **majeur**
- Aujourd'hui : le délai de rétractation « court à partir de la réception » sans date de réception ; le retour d'une vraie commande n'est atteignable que par `13-retour?ref=` que 04 ne passe pas (13 retombe sur la 1re commande seed livrée, `13-retour:154`).
- Il faudrait : événements transporteur (simulés ou ingérés) `en_acheminement → dispo_relais → livre`, `receptionAt` persisté sur la commande réglée, onglet « Livrées » dérivé, liens `?ref=` partout.

**C23 — Facture Mode = SVG statique ; certificat « joint au colis » affirmé sans donnée.**
`ui/mode/04-commande.html:61` (`facture.svg`), `:116` · **STATIQUE** · mineur
- Il faudrait : facture rendue depuis la commande réglée (comme fly/10), certificat conditionné à `a.certificat`.

**C24 — Cartes seed sans `?ref`, carte réelle sans action.**
`ui/mode/03-panier.html:794, 800` (`04-commande.html` sans réf → toujours la 1re commande suivie), `:829-837` (`carteRegleeGroupee` : ni suivi, ni retour) · **UX FLUX** · mineur

---

## 7 · Après règlement — Fly (réservation, billet/PNR, voyageurs, annulation)

**C25 — Le billet / PNR n'est jamais émis par personne.**
`ui/fly/10-reservation-detail.html:190-215` (« en cours d'émission par la compagnie », « transmis par SMS & e-mail dès l'émission », étape « Billet émis » toujours `false`), `ui/ecrans/15-moyens-paiement.html:305-308` (« la compagnie émet ton billet dès l'encaissement ») ; aucun écran/fonction ne pose `pnr`/`eticket` (pas de miroir `supplier_bookings`) · **TROU** · **majeur**
- Il faudrait : un jalon `emission` (manager ou simulation Duffel) qui écrit `pnr`, `eticket`, `emisAt` sur la commande, lu par fly/10, 03-mes-codes et le fil de notifications.

**C26 — Les Réservations et les notifications Fly ne sont scopées à aucun client.**
`ui/ecrans/03-mes-codes.html:331` (`PEC_BUS.commandes().filter(estReservation)`), `ui/assets/payencash-data.js:5254-5300` (`notifs` itère tout le bus) ; aucune annonce ne porte `clientId` (`ui/fly/02:314`, `ui/fly/04:157`, `ui/fly/12:323`, `ui/mode/11:273`) · **TROU / PERTE (isolation)** · **bloquant**
- Aujourd'hui : un client voit les réservations, codes de paiement et reçus de tous les autres (et des ventes guichet) ; Mode, lui, scope `commandesRegleesGet` par client.
- Il faudrait : `clientId` (= `clientActifGet()`) sur toute annonce ; 03-mes-codes / notifs / fly-10 filtrent dessus.

**C27 — Noms des voyageurs 2..n jamais dans la commande, et clés incohérentes entre récap promo et ordre de paiement.**
`ui/assets/payencash-filters.js:256` + `data.js:4901` (`pec-voyageurs:<clé>` local), `ui/fly/07-promo-recap.html:355` (clé = id promo) vs `ui/fly/02-ordre-paiement.html:411-414` (clé = réf) ; `schema.sql:308` (`order_travelers`) jamais matérialisé · **PERTE DE DONNÉE** · **majeur**
- Aujourd'hui : les noms tapés au récap promo n'apparaissent pas sur l'ordre de paiement ; aucun nom de voyageur n'atteint le bus, le partenaire, le manager, ni « l'émission ».
- Il faudrait : `noms` portés par la commande (`commandeEnCoursSet` → annonce), figés au paiement.

**C28 — La fiche complète du titulaire (naissance, e-mail, téléphone) est diffusée dans le bus partagé.**
`ui/parcours/01-vol-aller-simple.html:705` (`voyageur: lireVoyageur()`), `ui/fly/02-ordre-paiement.html:314` (`Object.assign({...}, enCours)` → tout le dépôt part au bus lu par l'app partenaire) · **conformité RGPD (minimisation)** · **majeur**
- Il faudrait : n'annoncer que ce que le point a besoin de voir (réf, montant, nom d'affichage, `clientId`).

**C29 — Les places des promos ne sont jamais décomptées.**
`ui/assets/payencash-data.js:1040-1050` (`stock: "4 places"` texte), `ui/fly/07-promo-recap.html:305-311` (plafonne les voyageurs dessus), aucune vente ne décrémente · **LOGIQUE ABSENTE** · **majeur**
- Il faudrait : une capacité par offre, décrémentée au règlement (miroir `promo_offers`).

---

## 8 · Annulation / expiration / remboursement (avoir, virement)

**C30 — L'« avoir » n'existe pas : promis partout, crédité nulle part, dépensable nulle part.**
`ui/assets/payencash-bus.js:834` (`modeRemboursement:'avoir'` = un mot sur la commande), `ui/assets/payencash-data.js:601` (« Avoir immédiat — crédité tout de suite, valable FLY et MODE »), `ui/ecrans/21-politique-especes.html:66-72` (rendu 500 € « uniquement en avoir »), `ui/manager/27-assistance-reclamations.html:191`, `ui/mode/22-livraisons.html:280` (« Ton avoir est crédité — utilisable sur Mode et Fly ») ; `panierTotal` (`data.js:7354-7436`) ne connaît que promo / campagne / carte cadeau ; `schema.sql` : aucune table de crédit (`refund_method` enum seulement, `:709`) · **TROU** · **bloquant**
- Il faudrait : un livre d'avoirs par compte (émission par `rembourser`/rendu LCB-FT, validité `avoirValiditeMois`), solde visible au compte, déduction au panier Mode et au récap Fly.

**C31 — « Remboursement en espèces au point » promis côté Fly, interdit par le bus.**
`ui/fly/10-reservation-detail.html:129` vs `ui/assets/payencash-bus.js:834` (jamais espèces) et `ui/manager/12-commande-detail.html:99` ; `schema.sql:460` admet `especes_point` · **STATIQUE / contradiction** · **majeur**
- Il faudrait : trancher (LCB-FT : avoir/virement) et aligner texte, bus et enum SQL.

**C32 — Commandes Mode annulées : clé globale non scopée, jamais purgée.**
`ui/assets/payencash-data.js:4213` (`pec-mode-cmd-annulees`), absente des purges `:1356-1357` · **PERTE (isolation)** · mineur

---

## 9 · Fidélité, cartes cadeaux, codes promo, concours, promos Fly

**C33 — Codes promo Fly : statiques, périmés, jamais appliqués.**
`ui/assets/payencash-data.js:301` (`RENTREE10`, fin « 31 août », affiché « du moment » par `ui/fly/11-promos-astuces.html:99`) ; `validerCodePromo` (`data.js:266`) n'est appelé par **aucun** écran (aucune saisie de code dans les tunnels ni sur fly/02) · **STATIQUE / LOGIQUE ABSENTE** · **majeur**
- Il faudrait : codes dans une table éditable (manager), champ de saisie au récap, remise portée par la commande.

**C34 — Tickets du concours figés.**
`ui/assets/payencash-data.js:894` (`tickets: 1, ticketsBonus: 1`), `ui/fly/03-jeu-concours.html:222-224` (« chaque commande réglée en donne un ») ; `concoursParticipations` (`:939-944`) compte des clics · **STATIQUE** · mineur

**C35 — Carte cadeau « valable FLY et MODE » : inutilisable côté Fly.**
`ui/mode/03-panier.html:718-727` (seul point d'application), aucun champ dans les tunnels Fly · **LOGIQUE ABSENTE** · mineur

---

## 10 · Compte client (vérification, RIB, voyageurs, isolation)

**C36 — Carnet de voyageurs (numéros de CNI/passeport en clair) partagé entre comptes sur l'appareil.**
`ui/assets/payencash-data.js:1171` (`pec-voyageurs-fiches` global), `ui/ecrans/13-mes-voyageurs.html:217-222, 292-300`, jamais purgé par `clientActifSet` (`:1356-1357`) · **PERTE (isolation) / RGPD** · **majeur**
- Il faudrait : clé par client (`_clePerso`), purge à la déconnexion (comme 10-compte le fait à la suppression, `:794-796`).

**C37 — Rendu de monnaie par virement : le RIB n'est jamais retrouvé (pas de `clientId`), et deux délais se contredisent.**
`ui/assets/payencash-bus.js:337, 710` (`clientRibPour(c.clientId)` avec `clientId` absent de toute annonce) ; `ui/assets/payencash-data.js:1472` (4 h) vs `:160` (`lcbft.virementHeures` 48 h), les deux affichés sur `ui/fly/12-preparer-paiement.html:232-262` et `ui/ecrans/21-politique-especes.html:64-72` · **TROU** · **majeur**
- Aujourd'hui : le client choisit « virement », le partenaire garde l'écart au coffre, le manager (07-trésorerie) obtient « RIB manquant » même si le RIB existe.
- Il faudrait : `clientId` sur la commande ; un seul délai de virement (ou deux règles nommées : rendu de monnaie vs rendu LCB-FT gros billets).

**C38 — La porte « compte vérifié SMS + e-mail » n'existe pas côté Mode.**
`payencash-verif.js` n'est chargé par aucun de `ui/mode/03, 05, 11, 15` ; `commanderPanier` (`data.js:4069`) ne teste pas `compteVerifieComplet()` ; Fly l'impose (`ui/parcours/01:693`, `ui/fly/07:392-399`) · **LOGIQUE ABSENTE** · **majeur** (règle fondatrice 30/08 : « bloque le récap »)
- Il faudrait : `PEC_VERIF.exiger` avant `commanderPanier` (point et agent), et le refus dans le data-layer.

---

## 11 · Cohérence Mode ↔ Fly

Nommage conforme (« Réservations en cours » / « Panier », Fly filtre `type !== 'MODE'`). Écarts :

**C39 — « MRS → » écrit en dur dans la liste des promos alors que l'aéroport de départ est une préférence.**
`ui/fly/06-promos.html:209` · **DUR** · mineur

**C40 — Compteur de destinations « accessibles » = formule inventée.**
`ui/ecrans/01-accueil.html:432` (`nbDest(b) = b / 4.5`, borné 2–160), `:425` (liste de villes figée) · **STATIQUE** · mineur

---

## 12 · Historique et commissions côté partenaire

**C41 — Historique des virements et idempotence des commissions reposent sur un journal borné à 200 entrées.**
`ui/assets/payencash-bus.js:248` (`journal.slice(0, 200)`), `ui/assets/payencash-data.js:5584` (« déjà émis » cherché dans ce journal), `ui/partenaire/05-commissions.html:200-212` (historique lu dans ce journal) · **PERTE DE DONNÉE** · **majeur**
- Aujourd'hui : avec le trafic (chaque annonce, paiement, appel… écrit une entrée), un virement émis sort du journal → historique partenaire vide **et** le manager peut ré-émettre le même mois.
- Il faudrait : une table `partner_settlements` persistée (déjà au schéma, `schema.sql:892`), le journal ne servant qu'à l'audit.

**C42 — Rattachement d'une vente au point par nom d'enseigne (Mode).** Voir C13 : `partenaireVentes` (`data.js:5564-5570`) repose sur `commandeDuPoint` → `c.point === p.enseigne` pour toute commande Mode ; un renommage du point orphelinerait ses ventes. **LOGIQUE BÂCLÉE** · mineur

---

## 13 · Notifications des trois côtés

**C43 — Aucun fil de notifications partenaire.**
`payencash-data.js` : `notifs` (client) et `notifsAgent` existent, rien pour le point ; commission virée, RIB à contrôler, point suspendu, borne en maintenance ne sont que repeints à l'écran (`PEC_PART.surBus`) · **TROU** · mineur

**C44 — Fil client Fly non scopé (voir C26) et contradiction d'expiration (voir C6/C15).**

---

## 14 · Conformité (plafonds, LCB-FT, CGV/médiateur, RGPD)

**C45 — Règle 200/500 € (LCB-FT) affichée au client, jamais appliquée à l'encaissement.**
`ui/fly/12-preparer-paiement.html:232-262`, `ui/mode/15-comment-tu-paies.html:231-256`, `ui/ecrans/21-politique-especes.html` (texte) ; `ui/partenaire/04-encaisser.html:388-395` et `ui/assets/payencash-bus.js:325-341` ignorent la coupure et le seuil 300 € (rendu espèces sans limite, pas de pièce d'identité, pas d'avoir) · **LOGIQUE ABSENTE** · **majeur**
- Il faudrait : la ventilation par coupure remontée par la borne, la règle (avoir / virement / pièce d'identité) tranchée dans `payer`.

**C46 — « Non-résident : jusqu'à 15 000 € » en dur, non porté par le calcul.**
`ui/ecrans/21-politique-especes.html:80` vs `repartitionEspeces` (`data.js:6730-6735`, plafond unique) · **DUR** · mineur

**C47 — Médiateur Mode : « coordonnées sur la facture » alors que la facture Mode est un SVG statique (C23).**
`ui/mode/18-informations-legales.html:166`, `ui/mode/17-politiques.html:96` · **STATIQUE** · mineur (Fly nomme le MTV avec adresse, `ui/ecrans/18:189`).

---

## 15 · Schéma SQL (data-layer ≠ `server/db/schema.sql`)

**C48 — `kiosks.status` n'admet que `active | inactive` ; le data-layer et le socle partenaire vivent avec `preparation` et `maintenance`.**
`schema.sql:1514` vs `ui/assets/payencash-data.js:2115` (`statut:'preparation'` à l'inscription) et `ui/assets/payencash-partenaire.js:74-76` · **SCHÉMA** · mineur

**C49 — `stock_reservations.expires_at NOT NULL` vs réservations sans expiration** (C5). `schema.sql:670` · **SCHÉMA** · majeur (déjà compté).

**C50 — `orders.change_mode` / `change_transfers.account_id` supposent un compte lié ; le bus n'a pas de `clientId`** (C26/C37). **SCHÉMA** · majeur (déjà compté).

**C51 — Aucune table pour l'avoir** (C30) ni pour la capacité des promos (C29). **SCHÉMA** · majeur (déjà comptés).

---

## Bilan — les 10 manques prioritaires

| # | Manque | Constats | Gravité | Taille |
|---|--------|----------|---------|--------|
| 1 | **Expiration portée par le bus pour le canal point** (une seule échéance `expireTs`, refus d'encaisser une commande expirée) — aujourd'hui client et partenaire se contredisent | C6, C15 | bloquant | **M** |
| 2 | **`clientId` sur toute commande** → Réservations/notifs Fly scopées, RIB du rendu par virement retrouvé, vente guichet rattachée à un compte | C26, C37, C19 | bloquant | **M** |
| 3 | **Plafond espèces exécuté, pas seulement affiché** (partEspeces/partCb sur la commande, borne limitée, jalon carte, `?m` = total côté Fly, format `detailPrix` unique) | C7, C8, C9 | bloquant | **L** |
| 4 | **Coffre de la borne** : solde par point dérivé des ventes `par:'borne'`, geste de relève, entrée en trésorerie | C20 | bloquant | **L** |
| 5 | **Avoir réel** : livre de crédits par compte, solde au compte, déduction au panier Mode et au récap Fly ; texte fly/10 aligné (jamais espèces) | C30, C31 | bloquant | **L** |
| 6 | **Sac, favoris, fidélité, carnet de voyageurs rattachés au compte** (clés `_clePerso`, fusion du sac anonyme à la connexion, purge à la déconnexion) | C4, C1, C36, C32 | bloquant / majeur | **M** |
| 7 | **Réservation de stock avec expiration dérivée** (plus de pièce bloquée à vie) | C5, C49 | majeur | **S** |
| 8 | **Fin de vie Mode et Fly** : événements transporteur → « livrée », `receptionAt` persisté, retour avec `?ref` ; émission billet/PNR ; noms des voyageurs dans la commande ; capacité des promos | C22, C25, C27, C29 | majeur | **L** |
| 9 | **Encaissement partenaire crédible** : scanner QR, montant inséré remonté par la borne, règle 200/500 € et vérification SMS+e-mail imposée côté Mode | C17, C18, C45, C38 | majeur | **M** |
| 10 | **Un seul réseau de points** (annuaire client = partenaires actifs à borne active, `pointId` sur les commandes Mode, historique des commissions hors du journal borné) | C12, C13, C41 | majeur | **M** |

Tailles : S = quelques fonctions du data-layer · M = data-layer + 3-6 écrans · L = nouveau cycle de vie (données + bus + écrans des deux/trois côtés).
