# Audit C — Chaîne HOTLINE ↔ FOURNISSEUR ↔ MODE ↔ FLY ↔ MANAGER

Lecture seule, 09/09/2026. Tout constat est vérifié dans le code (fichier:ligne). Chemins relatifs à `/Users/emilieruiz/Downloads/payencash-documentation-2026-07-31/`. Ce qui marche n'est pas listé.

Catégories : TROU · DUR · LOGIQUE ABSENTE OU BÂCLÉE · STATIQUE · PERTE DE DONNÉE · SCHÉMA · UX FLUX. Gravité : bloquant · majeur · mineur.

> **(18/09, soir) — l'agent de caisse mobile est supprimé.** Plus aucun salarié ne se déplace chez le client : le client paie avec un bon d’achat par un **Bon d’achat PayEnCash** ou un **Bon d’achat PayEnCash** acheté au comptoir d'un commerce.
>
> **Devenu sans objet :** **C12** (« l'appel de sécurisation ne bloque rien : l'agent part sans attendre l'appel ») — `ui/fly/05-recherche-agent.html` et `ui/coursier/` n'existent plus, il n'y a plus de départ à bloquer ; et, dans **C11**, la seule règle « sans réponse ×2 → la commande repasse au point », le point n'encaissant plus (le reste de C11, l'échéance de rappel jamais recalculée, reste entier).
>
> **Reste lisible intégralement :** tout le reste. ⚠ Le **planning** cité dans cette annexe (C8, C9, C10) est celui des **créneaux de la hotline** (`hotline_shifts`), qui existe toujours — ce n'est pas le planning des agents, supprimé avec eux.

---

## 1. Ouverture de la demande (client / fournisseur → bus → file hotline)

### C1 — Le message du client est écrit dans `texte`, jamais dans `echanges` : la hotline lit « Aucun échange consigné »
- **Où** : `ui/assets/payencash-bus.js:115-118` (`ouvrirDemande` fait `Object.assign({…}, d)` sans convertir `d.texte` en `echanges`) ; émetteurs `ui/ecrans/08-contact.html:165` (`texte: msg`) et `ui/mode/13-retour.html:214-216` (`texte: a.nom + … net …`) ; lecteurs `ui/hotline/01-pilotage.html:551-556` (`rendreFil` n'itère que `d.echanges`), `ui/ecrans/14-assistance.html:502-506` (`tikVive` idem), `ui/manager/27-assistance-reclamations.html:134` (`historique` = `echanges`).
- **Catégorie / gravité** : PERTE DE DONNÉE · majeur.
- **Aujourd'hui** : une demande ouverte depuis le formulaire Contact ou un retour Mode arrive à la hotline avec un sujet mais un fil vide ; le conseiller ne voit ni la question, ni la pièce, ni le mode de remboursement demandé (`retour.remboursement`, `retour.net` ne sont affichés nulle part côté hotline — `ligneDemande` 01-pilotage:516-531 n'affiche que `sujet`).
- **Il faudrait** : dans `ouvrirDemande`, `if (d.texte && !(d.echanges||[]).length) dem.echanges = [{ qui:'moi', texte:d.texte, at }]` ; afficher `d.retour` (étiquette, motif, remboursement choisi, net) dans `ligneDemande`/`rendreFil` et dans 27.

### C2 — Les demandes et appels n'ont pas d'identité de compte : nom en clair, `clientId` absent
- **Où** : `ui/ecrans/14-assistance.html:339,436,602`, `ui/ecrans/08-contact.html:165,169`, `ui/ecrans/11-suivi-etats-echec.html:341`, `ui/fly/10-reservation-detail.html:350`, `ui/mode/13-retour.html:216`, `ui/assets/payencash-filters.js:420,430`, `ui/fly/05-recherche-agent.html:426` — tous passent `client: profil.nomComplet` sans `clientId`. Miroir SQL : `server/db/schema.sql:960` (`support_conversations.user_id uuid NOT NULL`), `:1012` (`hotline_calls.user_id`), `:1636` (`kyc_checks.user_id NOT NULL`).
- **Catégorie / gravité** : SCHÉMA + LOGIQUE · majeur.
- **Aujourd'hui** : toute la chaîne se joint par le nom (`satisfactionEnAttente` data.js:2551-2557, `maVerif` 19-verification:135-138, `mesDemandes` mode/22:270-272, fiche client 18:306). Deux homonymes partagent leurs tickets, leurs questionnaires et leur vérification d'identité ; la seule demande avec `clientId` est celle du banc (tests HL·432).
- **Il faudrait** : `clientId: D.clientActifGet()` posé par `ouvrirDemande`/`demanderAppel`/`ouvrirVerification` eux-mêmes (source unique), et joindre par id partout.

### C3 — L'assistance Fly et le fil de notifications Fly montrent les demandes et appels de TOUS les clients
- **Où** : `ui/ecrans/14-assistance.html:564-566` (`vives = PEC_BUS.demandesSav()`, `appels = PEC_BUS.appels()` sans filtre) ; `ui/assets/payencash-data.js:5313-5339` (`notifs` Fly : `appels().forEach`, `demandesSav().forEach` — seule exclusion : réf Mode). Mode, lui, filtre (`data.js:5366-5368`, `mode/22:270-272`).
- **Catégorie / gravité** : LOGIQUE · bloquant (données personnelles : sujet, réponses du conseiller, compte rendu d'appel, contestation fournisseur, appels entrants journalisés « Ton appel au service client » pour un autre).
- **Aujourd'hui** : changer de client depuis Manager 39 (« Ouvrir l'app ») ou créer un second compte affiche l'historique support du précédent.
- **Il faudrait** : filtre `mienne` (clientId / nom / réf de mes commandes) dans `renderDemandes` et dans `notifs({app:'fly'})`, comme en Mode.

### C4 — Valeurs `canal` / `type` hors des CHECK SQL
- **Où** : bus écrit `canal` = `'app'` (bus.js:115 défaut, 11-suivi:341, fly/10:351, filters.js:430), `'app-auto'` (filters.js:420), `'formulaire'` (08-contact:165,169), `'fournisseur'` (fournisseur/08-stock:423), `'suivi-agent'` (ecrans/02-suivi-livraison:463), `'agent-depot'` (coursier/09-depot-cash:368), `'tel'` (manager/04-commandes:122). SQL : `support_conversations.canal CHECK IN ('chat','rappel','appel','whatsapp','email')` (`schema.sql:963`) ; `hotline_calls.canal CHECK IN ('0805','rappel','appel','whatsapp','facetime')` (`:1021`) ; `hotline_calls.type CHECK IN ('entrant','rappel','securisation','bienvenue','retour_j1')` (`:1011`) alors que manager/04:122 écrit `type: 'enquete'`.
- **Catégorie / gravité** : SCHÉMA · majeur (l'insertion échouerait en base).
- **Il faudrait** : aligner les CHECK (ajouter `app`, `app-auto`, `formulaire`, `fournisseur`, `suivi-agent`, `agent-depot`, type `enquete`) ou normaliser dans le bus ; ajouter la paire à `STATUT_SQL`/ZT·419.

### C5 — L'appel « enquête satisfaction » du manager n'existe pour personne
- **Où** : `ui/manager/04-commandes.html:114-122` (`type:'enquete'`) ; hotline `01-pilotage.html:356-362` (`TYPES` sans `enquete` → libellé « Appel entrant (0 805) »), bus `demanderAppel` :159-165 (`dueAt = null`, `quand = 'avant le départ de l'agent'`), client `14-assistance.html:527-530` (→ « Rappel demandé »).
- **Catégorie / gravité** : LOGIQUE BÂCLÉE · mineur.
- **Il faudrait** : type `enquete` dans le référentiel des types (libellé, échéance `ref.hotline`), dans TYPES hotline et tikAppel.

### C6 — Le chat de l'assistance affiche « undefined » quand il retrouve un ticket du bus
- **Où** : `ui/ecrans/14-assistance.html:397-406` (`repTicket` lit `rc.motif`, `rc.sla`, `cv.hote`, `cv.quand`) alors que `chercherTicket` renvoie l'objet BUS (`sujet`, `ref`, `assigne`, `at`) — `data.js:6816-6819`.
- **Catégorie / gravité** : STATIQUE · mineur.
- **Il faudrait** : `repTicket` sur les champs réels (`sujet`, `assigne`, `statutDemande(d).client`, `at`).

### C7 — La contestation fournisseur part à la hotline, mais le fournisseur ne lit jamais la réponse
- **Où** : `ui/fournisseur/08-stock.html:417-425` (`ouvrirDemande({type:'reclamation', client: fournisseurCourant, canal:'fournisseur'})`) ; aucun écran fournisseur ne lit `demandesSav` sauf `05-ventes-factures.html:122` (compteur `retoursDuMois`) ; `ui/assets/payencash-fournisseur.js:225-239` (`rendreNotifications` = interrupteurs de préférences, « aucun écran de cet espace ne rend de notifications », cf. `14-contact-preferences.html:47`).
- **Catégorie / gravité** : TROU · majeur.
- **Aujourd'hui** : la hotline répond (`repondreDemande`) dans le vide ; la réclamation fournisseur est rangée avec les réclamations clients (`client` = nom de l'enseigne, aucun `espace` exploité par 01-pilotage ni 27) ; une décision KYB (`statuer`) ne remonte au fournisseur qu'en rouvrant 11-verification-kyb.
- **Il faudrait** : `notifs({app:'fournisseur'})` (réponses hotline sur ses REC-, décisions de pièces, frais, retards d'expédition) + un écran/cloche fournisseur ; un champ `espace`/`audience` sur la demande, affiché à la hotline.

---

## 2. File hotline : assignation, charge, retard

### C8 — « Non assigné » n'existe pas : le repli superviseure absorbe tout, y compris hors planning
- **Où** : `ui/assets/payencash-data.js:6942-6948` (`hoteEnPoste` → `dispo[0] || superviseure`) ; consommateurs `bus.js:110,155`, `docs.js:222-223` (commentaire « Sans personne en poste, il reste « à prendre » — jamais assigné à un fantôme » : faux, `hote` vaut la superviseure) ; KPI « Non assignés » `01-pilotage.html:85,331`, `manager/42-verifications.html:79,85` ; `assigneSource:'planning'` posé même hors créneau (`bus.js:116,168`).
- **Catégorie / gravité** : LOGIQUE · majeur.
- **Aujourd'hui** : un dimanche à 23 h, une réclamation est « assignée par le planning » à Naïma (lun–ven 8-13 h) ; charge et retard lui sont imputés ; l'équipe ne voit jamais de ligne « à prendre ».
- **Il faudrait** : `hoteEnPoste()` renvoie `null` hors planning ; `assigne: null`, `assigneSource: null` ; la superviseure reçoit une ALERTE (cf. C9), pas l'assignation.

### C9 — Une seule échéance (15 min) pour tout, le SLA hôte de 2 h n'est jamais calculé, et « la superviseure est alertée » ne déclenche rien
- **Où** : `bus.js:111-117` (`dueAt = at + ref.hotline.rappelDelaiMin`, pour information / réclamation / retour) ; `data.js:1464` (`slaHoteH: 2` lu uniquement pour du texte : `14-assistance.html:515`) ; `data.js:6953` (`en_retard.client: '… la superviseure est alertée'`) ; aucune notification : `manager/20-notifications.html:120-169` ne liste ni demandes en retard ni appels non passés ; hotline sans cloche.
- **Catégorie / gravité** : LOGIQUE ABSENTE · majeur.
- **Aujourd'hui** : toute réclamation est « EN RETARD » rouge 15 minutes après son ouverture ; rien n'est poussé à qui que ce soit ; le retard n'a aucune conséquence (pas d'escalade, cf. C17).
- **Il faudrait** : `dueAt` par type (rappel = `rappelDelaiMin`, demande = `slaHoteH` ouvrées via le planning), un `superviseurAlertes()` dérivé (retards, non assignés) affiché dans 01-pilotage et 20-notifications.

### C10 — Le planning hotline est un seed figé ; aucun écran ne l'édite ; un conseiller invité n'a jamais de créneau
- **Où** : `data.js:38-43` (`planning` en dur) ; `data.js:6929-6939` (compte invité ajouté à l'équipe avec `enPoste = moi` uniquement) ; `manager/17-comptes-manager.html` invite mais ne planifie pas ; miroir `schema.sql:1081-1089` (`hotline_shifts`) sans setter.
- **Catégorie / gravité** : DUR + TROU · majeur.
- **Aujourd'hui** : l'assignation « selon le planning » ne peut viser que Naïma/Karim/Léa/Mehdi ; un conseiller réellement embauché n'est « en poste » que quand il est connecté sur ce navigateur.
- **Il faudrait** : `hotlineCreneauEnregistrer(user, weekday, de, a)` persisté (`pec-hotline-planning`), écran manager (ex. dans 17 ou 09) ; `hotlinePlanning()` lit ce store puis le seed.

### C11 — « Sans réponse » et « À rappeler » n'ont pas de nouvelle échéance ; la règle « ×2 → la commande repasse au point » n'est pas implémentée
- **Où** : `bus.js:184-196` (`traiterAppel` : statut + tentatives, `dueAt` inchangé) ; `schema.sql:1015` (commentaire « sans réponse ×2 → la commande repasse au point ») ; aucune lecture de `tentatives` ailleurs que l'affichage.
- **Catégorie / gravité** : LOGIQUE ABSENTE · mineur (majeur pour la sécurisation).
- **Aujourd'hui** : un appel « à rappeler » reste « en retard de N h » à vie ; rien ne limite les tentatives ni ne bascule la commande.
- **Il faudrait** : `dueAt = now + rappelDelaiMin` sur `rappeler`/`sans_reponse`, `ref.hotline.tentativesMax`, et pour `securisation` au-delà : `annoncerCommande(ref, {canal:null})` + notification client.

### C12 — L'appel de sécurisation ne bloque rien : l'agent part sans attendre l'appel
- **Où** : promesse `ui/fly/05-recherche-agent.html:420-426` (« l'agent ne part qu'APRÈS l'appel ») ; `bus.js:638-652` (`accuserCourse` ne regarde aucun appel) ; grep `securisation` dans `ui/coursier/`, `payencash-coursier.js`, `payencash-data.js` : seule occurrence = libellé de notification (`data.js:5316`).
- **Catégorie / gravité** : LOGIQUE ABSENTE · majeur (c'est la mesure anti-fraude de la première commande à domicile).
- **Il faudrait** : dans `accuserCourse`, refuser (`{ok:false, motif:'securisation_en_attente'}`) tant qu'un `apl_` de type `securisation` sur la réf n'est pas `fait` ; l'écran coursier le dit.

### C13 — Le délai de rappel annoncé au client est faussé par les appels entrants
- **Où** : `ui/ecrans/14-assistance.html:314-320` (`delaiRappel` moyenne `faitAt - at` sur tous les `statut === 'fait'`) ; `bus.js:167-171` (un entrant naît `fait` avec `faitAt = at` → 0 min).
- **Catégorie / gravité** : LOGIQUE · mineur.
- **Il faudrait** : ne moyenner que `type === 'rappel'`.

---

## 3. Réponse au client et lecture côté client

### C14 — Le client Mode ne peut ni répondre ni rouvrir ; le client Fly ne peut pas rouvrir
- **Où** : `ui/mode/22-livraisons.html:280-292` (`carteDemande` sans formulaire) vs `ui/ecrans/14-assistance.html:508` (formulaire `rep-fil`) ; « Rouvrir » n'existe que sur `tikConv` (14:480, seeds `A.conversations` toujours vides, data.js:47) ; le bus refuse `repondreDemande` sur une demande close (`bus.js:127`) et n'a pas de `rouvrirDemande`. Promesses non tenues : `data.js:5337` (« rouvre-la depuis l'Assistance »), `:5376` (« rouvre-la depuis Livraisons »), 14:510.
- **Catégorie / gravité** : TROU + UX FLUX · majeur.
- **Il faudrait** : `PEC_BUS.rouvrirDemande(id, texte, par)` (statut `en_cours`, nouvel `at`/`dueAt`, journal) ; formulaire de réponse et bouton « Rouvrir » dans mode/22 et 14 sur les demandes closes.

### C15 — Pas de propriété de la réclamation : la hotline peut clore une REC-, le manager peut trancher n'importe quelle REC-
- **Où** : `01-pilotage.html:530,568-576` (« Clôturer » sur toute demande, réclamation comprise) ; `27-assistance-reclamations.html:149-150` (Rembourser / Répondre & clore sur toute REC- `en_cours`, aucune condition de niveau) ; doctrine `01-pilotage.html:17` (« Seules les réclamations montent au manager »).
- **Catégorie / gravité** : LOGIQUE · majeur.
- **Il faudrait** : une réclamation se traite à son niveau (`niveau` sur la demande) ; hotline = répondre/escalader, manager = décider après escalade ; la clôture par la hotline d'une REC- exige `niveau === 'hote'`.

---

## 4. Escalade manager / médiateur

### C17 — L'escalade n'existe pas : `niveau_manager` et `mediateur` ne sont jamais écrits
- **Où** : lus seulement — `01-pilotage.html:528`, `14-assistance.html:399,466`, `27:129,138` ; aucun setter dans `bus.js` (grep `niveau_manager|mediateur` = 0 écriture) ; `STATUT_SQL.demande` (`bus.js:886`) les mappe vers `transferee` mais rien ne les produit ; `reclamations.escalated_at` (`schema.sql:990`) jamais posé ; promesse `27:48` (« Escalade AUTOMATIQUE quand le délai hôte est dépassé ») ; `ui/ecrans/20-mediateur.html` = page d'information, aucune saisine enregistrable ; KPI « Saisines médiateur » (`27:129`) structurellement à 0 ; `data.js:51-55` (`escalade` = trois chaînes de texte).
- **Catégorie / gravité** : TROU · bloquant pour la chaîne demandée (hôte → manager → médiateur).
- **Aujourd'hui** : le client lit « non résolu → le manager reprend (48 h) » (14:612) ; rien ne monte, rien ne redescend.
- **Il faudrait** : `PEC_BUS.escaladerDemande(id, {par, motif})` (statut `niveau_manager`, `escaladeAt`, échéance `slaManagerH`), escalade dérivée à la lecture quand `enRetard` dépasse `slaHoteH`, bouton « Escalader » hotline, décision manager = seule sortie de `niveau_manager` ; `PEC_BUS.saisirMediateur(id, {par, dossier})` (statut `mediateur`, `mtv.travel`, `saisineAt`) depuis 20-mediateur, visible en 27 ; `ref.hotline.slaManagerH` et `mediateurJours` utilisés en calcul.

### C18 — Les demandes d'information (INF-) sont invisibles du manager ; la hotline ne peut pas annuler
- **Où** : `27:130-134` (`busConv = /^CNV-/`, `busRec = /^REC-/` — les `INF-` tombent) ; émetteur `ui/ecrans/11-suivi-etats-echec.html:340-343` (« Annuler ma commande » → `type:'information'` → INF-) ; `01-pilotage.html` n'appelle ni `annuler` ni `rembourser` (grep) ; l'annulation est manager-only (`12-commande-detail.html:271-283`).
- **Catégorie / gravité** : TROU · majeur.
- **Aujourd'hui** : la demande d'annulation d'un encaissement en échec est dans la file hotline sans action possible, et n'atteint jamais le manager.
- **Il faudrait** : soit un bouton « Annuler la commande » hotline (appel `PEC_BUS.annuler(ref,{par,motif})` réservé au superviseur), soit escalade (C17) ; 27 liste aussi les INF- (ou une vue « toutes les demandes »).

### C19 — KPI « Réclamations chez moi » compte celles du niveau hôte
- **Où** : `27:138` (`statut === 'niveau_manager' || 'en_cours'`).
- **Catégorie / gravité** : STATIQUE · mineur. Se corrige avec C17.

---

## 5. Décision manager (remboursement, réponse, annulation)

### C20 — « Répondre & clore » ne porte aucune réponse ni acteur : le client lit « Réponse motivée envoyée » sans réponse
- **Où** : `27:187-193` (`PEC_BUS.cloreDemande(id, dec)` — aucun texte, aucun `{par}`) ; `bus.js:208-215` (`cloPar` non posé, journal `par: extra.par || 'hotline'` → l'événement dit « hotline » pour une décision manager) ; client `14-assistance.html:510`, `mode/22:291`.
- **Catégorie / gravité** : PERTE DE DONNÉE · majeur.
- **Il faudrait** : un champ « réponse motivée » obligatoire dans 27, écrit via `repondreDemande(id, texte, par)` puis `cloreDemande(id, dec, {par, motif})` ; `support_conversations.issue`/`reclamations.resolution` (`schema.sql:965,992`) alimentés ; coordonnées du médiateur réellement jointes (texte du référentiel).

### C21 — Le remboursement ignore le mode choisi par le client et le montant net du retour ; une commande groupée est remboursée en entier
- **Où** : `27:191` (`rembourser(cmd.ref, {mode:'avoir', montant: cmd.montant})`) ; choix client `mode/13-retour.html:201,216` (`retour.remboursement` avoir|virement, `retour.net` = payé − frais, `articleId`) ; `bus.js:829-840` (`rembourser` ne connaît qu'une commande entière).
- **Catégorie / gravité** : LOGIQUE · majeur.
- **Il faudrait** : `rembourser(ref, {mode: retour.remboursement, montant: retour.net, ligne: articleId})` ; remboursement partiel par ligne (`order_items`) ; refus si `mode==='virement'` sans RIB (comme `renduVirementEmettre`, `bus.js:711`).

### C22 — L'avoir n'est jamais crédité, le virement de remboursement n'est jamais émis
- **Où** : `bus.js:829-840` (`rembourser` pose un statut et une écriture comptable — `data.js:2638` — rien d'autre) ; grep `avoir` dans data.js → seulement le libellé `6958` ; `gift_cards` (`schema.sql:58`) sans lien ; pas d'équivalent de `renduVirement` (`bus.js:338,706-716`) pour un remboursement par virement (pas de `dueAt`, pas de file « à virer » manager, pas de notification « viré »).
- **Catégorie / gravité** : PERTE DE DONNÉE + TROU · majeur.
- **Aujourd'hui** : le client lit « Remboursée en avoir — crédité sur ton compte, valable FLY et MODE » (14:509, 22:291) mais aucun solde n'existe et rien ne peut le consommer ; un remboursement « virement » n'a ni RIB ni échéance ni émission.
- **Il faudrait** : `avoirCrediter(clientId, montant, ref)` + `avoirSolde()` consommable au panier/récap ; pour `virement` : créance `remboursementVirement {statut:'a_virer', dueAt, iban}` reprise dans `rendusAVirer()` du manager et notifiée.

### C23 — Un retour Mode sur une commande livrée du compte ne peut jamais être remboursé ; le retour n'a pas de cycle de vie
- **Où** : `mode/13-retour.html:139-157` (pièce = `clientCourant().commandes` source `'compte'` ou `commandesRegleesGet()`) ; `27:105-109` (`cmdDe` → `PEC_BUS.commande(ref)` seulement) ; `27:182-186` (« Aucune commande ENCAISSÉE derrière cette réf : rien n'est remboursé ») ; `schema.sql:705,739-751` (`mode_returns` : `demande → etiquette_emise → en_transit → recu_atelier → conforme_rembourse → refuse`, `received_at`, `restock`) sans aucun miroir bus ; ni l'atelier ni le fournisseur ne voient le retour (`04-expeditions.html` ne liste que les ventes).
- **Catégorie / gravité** : TROU + SCHÉMA · majeur.
- **Il faudrait** : objet `retour_` au bus (statut `return_status`), réception atelier (manager/atelier), verdict conforme → `rembourser` par ligne (C21) et restock (`entreeStock`), refus → réponse motivée ; `cmdDe` capable de retrouver une commande réglée du data-layer (`commandesRegleesGet`).

### C24 — L'écran des états d'échec lit le mauvais champ et décrit un remboursement en espèces
- **Où** : `ui/ecrans/11-suivi-etats-echec.html:363-366` (`/expir/i.test(c.motif)`) vs bus qui écrit `motifAnnulation` (`bus.js:233,846`) → `EXPIRED` jamais détecté, une commande expirée s'affiche `CANCELLED` (« Ton remboursement arrive — l'agent a pris la route avec tes espèces », 11:249-262) alors que rien n'a été encaissé ; `REFUNDED` (11:264-278) « t'a remis les espèces » vs `rembourser` = avoir|virement, jamais espèces (`bus.js:827-835`) ; même contradiction dans l'arbre SAV `data.js:6845` (« en espèces au point ») et le chat `14:381`.
- **Catégorie / gravité** : LOGIQUE + STATIQUE · majeur.
- **Il faudrait** : lire `c.motifAnnulation` ; états CANCELLED/REFUNDED alignés sur `modeRemboursement` (avoir / virement, `rembourseAt`), suppression des textes « espèces » du SAV et du chat.

---

## 6. SMS de satisfaction, note, réclamation automatique

### C25 — Un appel clos depuis le Centre d'appels manager n'envoie pas le questionnaire
- **Où** : `ui/manager/09-appels.html:235-243` (`traiterAppel` seul) vs hotline `01-pilotage.html:405-417` (`satisfactionDemander` après `fait`).
- **Catégorie / gravité** : LOGIQUE · mineur.
- **Il faudrait** : déplacer l'envoi du questionnaire dans `traiterAppel` (bus) quand `statut === 'fait'` — une seule règle.

### C26 — La réclamation automatique promet un rappel que rien ne programme
- **Où** : `ui/assets/payencash-satisfaction.js:113-114` (« un conseiller te recontacte ») ; `data.js:2572-2581` (`satisfactionAjouter` ouvre la REC-, aucun `demanderAppel`).
- **Catégorie / gravité** : LOGIQUE · mineur.
- **Il faudrait** : `demanderAppel({type:'rappel', ref, clientId, motif:'note basse'})` avec la réclamation, ou retirer la promesse.

### C27 — Le SMS de notation, la réponse du conseiller et l'appel passé sont absents du catalogue des messages
- **Où** : `data.js:2676-2686` (`MESSAGES_CATALOGUE` : `sav` uniquement) ; événements journalisés `sms_satisfaction` (data.js:2546), `sav_reponse` (bus.js:133), `appel` (bus.js:173,194) non catalogués → `manager/16-communications.html` (lignes 188-235) ne les compte ni ne les liste ; le canal `Brevo (SMS)` de `ref.hotline.satisfactionCanal` n'apparaît nulle part côté communications.
- **Catégorie / gravité** : TROU · mineur.
- **Il faudrait** : entrées `sms_satisfaction` (sms), `sav_reponse` (push/email), `appel` fait (push) dans le catalogue.

---

## 7. Vérifications KYC / KYB (client, fournisseur, partenaire, agent)

### C28 — Deux vérités pour le KYC client : `kyc_` (mock PVID) et le dossier PEC_DOCS, jamais reliés
- **Où** : `ui/ecrans/19-verification-identite.html:215-216` (`PEC_DOCS.soumettre('client', id)` PUIS `PEC_BUS.ouvrirVerification({client: nom})`) ; hotline décide sur `kyc_` (`01-pilotage.html:498-509` → `deciderVerification`) ET sur les pièces (`:739-741` → `statuer`) ; client lit `kyc_` seulement (`19:135-170`) ; `ouvrirVerification` pose un avis PVID mock « conforme 0,97 » sans regarder les pièces (`bus.js:75-84`).
- **Catégorie / gravité** : LOGIQUE · majeur.
- **Aujourd'hui** : « Valider — Renforcé » sans avoir ouvert une seule pièce fait passer le client en Renforcé alors que ses pièces restent « déposées » ; valider toutes les pièces ne change pas son niveau ; « À refaire » ne rejette aucune pièce du dossier.
- **Il faudrait** : une seule vérification : `deciderVerification` exige `PEC_DOCS.complet('client', id)` (ou statue les pièces en même temps), et `a_refaire`/`refusee` posent `refusee` sur la pièce fautive ; `kyc_checks` référence le `kyc_documents` du sujet.

### C29 — Les décisions sont signées d'un prénom, le manager d'un libellé en dur ; SQL attend `manager_users.identifiant`
- **Où** : `01-pilotage.html:200-205` (`moi()` = `m.nom` « Naïma ») → `assigne`, `decidePar` (`bus.js:99`), `faitPar` (`:190`), `cloPar`, `statuePar` (`docs.js:129`) ; `manager/42-verifications.html:122` (`par: 'Manager'` littéral) et `:128` (`s2.role || s2.identifiant` → libellé de rôle « Direction ») ; SQL `kyc_checks.decided_by REFERENCES manager_users(identifiant)` (`schema.sql:1643`), `kyc_documents.reviewed_by` (`:1269`), `hotline_calls.done_by` (`:1016`).
- **Catégorie / gravité** : SCHÉMA + DUR · majeur.
- **Il faudrait** : signer par `managerConnecte().identifiant` (`data.js:1805-1809`) partout ; l'affichage dérive le prénom depuis `managersGet()`.

### C30 — Le dossier refusé reste dans la file avec « 0 pièce à contrôler » et un retard qui grandit
- **Où** : `docs.js:234-251` (`aVerifier` n'exclut que `etat === 'valide'` ; `a_corriger` reste, `enAttente = 0`, `retard`/`escalade` vrais) ; pas de nouvelle échéance au redépôt (`soumettre` n'est rappelé que si le déposant clique « Envoyer »).
- **Catégorie / gravité** : LOGIQUE · mineur.
- **Il faudrait** : état `attente_deposant` (hors file, hors retard) tant qu'une pièce est refusée ; échéance recalculée au redépôt.

### C31 — Les frais d'examen n'entrent nulle part
- **Où** : `docs.js:175-186` (`reglerFrais` : reçu de démo, « règlement simulé ») ; aucune écriture comptable (grep `kyb_frais` dans data.js = 0) ; `fournisseur/11-verification-kyb.html:96,102` le dit.
- **Catégorie / gravité** : TROU · mineur.
- **Il faudrait** : `ledger_entries` (produit « examen dossier ») + moyen de paiement réel (carte) hors maquette.

### C32 — Les alertes manager ignorent les dossiers PEC_DOCS en retard et les demandes en retard
- **Où** : `manager/20-notifications.html:127-132` (réclamations ouvertes, `kyc_` en attente) ; rien sur `DOCS.aVerifier().filter(escalade)`, `demandesSav().filter(enRetard)`, appels `a_faire` dépassés.
- **Catégorie / gravité** : TROU · mineur.

### C33 — Un conseiller « sans accès au back-office » valide Kbis, contrats et identités sans distinction de rôle
- **Où** : `data.js:1783` (droits du rôle `hotline`) ; `01-pilotage.html:739-741` (tout membre connecté a `manager:true` sur PEC_DOCS), `:498` (décision KYC) ; seul `estSuper()` (`:206`) filtre la réassignation ; `ref.verification.controleurs` (`data.js:1415`) ne distingue pas hôte/superviseur.
- **Catégorie / gravité** : LOGIQUE · mineur.
- **Il faudrait** : matrice de droits (`ROLES_MANAGER[*].peut`) lue par 01-pilotage : décision KYC/KYB réservée superviseur/manager, l'hôte instruit.

---

## 8. Expédition en retard / colis (fournisseur ↔ hotline ↔ client)

### C34 — L'échéance d'expédition est un texte : aucun retard n'est dérivé, personne n'est prévenu, la hotline n'a aucune vue des colis
- **Où** : `data.js:4242-4243` (`echeance: 'sous N j ouvrés (contrat fournisseur)'`, pas de `dueTs`) ; `04-expeditions.html:116` l'affiche tel quel ; `commandesEnLivraison` (`data.js:4327-4347`) ne calcule aucun retard ; `01-pilotage.html` n'appelle jamais `expeditionsGet` ; côté client Mode, la seule porte est `13-retour.html` (pièce reçue) ; `notifs` Mode (`data.js:5348-5360`) n'a pas de « colis en retard » ; `shipments.events` (`schema.sql:809`) sans miroir.
- **Catégorie / gravité** : TROU · majeur.
- **Il faudrait** : `dueTs` à la création (jours ouvrés du contrat), `expeditionsEnRetard()` → alerte fournisseur (C7), ligne hotline « colis en retard » avec `demanderAppel`/relance, notification client « ton colis a du retard », KPI manager.

---

## 9. Journal (event_log)

### C35 — Le journal est plafonné à 200 entrées : l'historique support disparaît
- **Où** : `bus.js:248` (`j.slice(0, 200)`) ; lecteurs `27:171` (event_log), `16-communications.html:198` (compteurs 30 j), `20-notifications.html:135,160` (comptes créés, activations), `18-fiche-client.html` (RGPD via `noter`).
- **Catégorie / gravité** : PERTE DE DONNÉE · majeur (event_log est « LE protocole de traçabilité », `schema.sql:995`).
- **Il faudrait** : journal append-only sans plafond (ou archivage par mois), et `event_log.role/espace` posés à l'écriture.

### C36 — Le panneau event_log du manager n'affiche qu'un seul type d'événement et fausse les dates
- **Où** : `27:171` (filtre `reclamation_decision` seulement : `sav`, `sav_reponse`, `sav_assignation`, `appel`, `kyc`, `kyb_soumis`… ignorés) ; `27:134` (chaque échange daté de `d.at` au lieu de `e.at`).
- **Catégorie / gravité** : STATIQUE · mineur.

---

## 10. Comptes hotline, rôles, permissions

### C37 — Le mode « lecture seule sans session » de la hotline est du code mort ; le lien vers les réclamations mène à un mur
- **Où** : `01-pilotage.html:28-30, 255-260` (« Sans session : lecture seule ») vs `payencash-garde.js:320,342` (hors session Hotline/Manager, la page est remplacée) ; `01-pilotage.html:54` (lien `../manager/27-…`) vs `garde.js:319` (espace manager = session Manager seulement).
- **Catégorie / gravité** : STATIQUE + UX FLUX · mineur.
- **Il faudrait** : retirer le mode lecture seule ; soit ouvrir 27 aux superviseurs hotline, soit une vue « réclamations escaladées » dans l'espace hotline.

### C38 — Un conseiller invité est toujours « hôte » ; aucun superviseur hotline n'est invitable
- **Où** : `data.js:6933` (`role: 'hote'` forcé) ; `data.js:1779-1783` (`superviseur` = espace manager).
- **Catégorie / gravité** : LOGIQUE · mineur.

---

## 11. Fiche client manager, notifications croisées

### C39 — La fiche client ne montre aucune demande/réclamation du client
- **Où** : `manager/18-fiche-client.html:304-309` (appels seulement, libellé brut `a.type`) ; `39-clients.html` rien.
- **Catégorie / gravité** : TROU · mineur.

### C40 — Délai KYC en dur dans la notification client
- **Où** : `data.js:5304` (« décision sous 24 h ouvrées ») vs `ref.verification.delaiHeures.standard = 48` (`data.js:1414`).
- **Catégorie / gravité** : DUR · mineur.

### C41 — L'annulation Fly n'a pas de devis : `cancellation_requests` sans miroir
- **Où** : `fly/10-reservation-detail.html:349-356` (REC- « Annulation ») ; `27:191` (avoir du montant total) ; `schema.sql:441-464` (`cancellation_requests` : `devis_pret`, `quote_expires_at`, `refund_method`, `airline_credit_code`).
- **Catégorie / gravité** : SCHÉMA · mineur (design à trancher : la réclamation vaut-elle demande d'annulation ?).

---

## Couverture du banc

`tests/test-runner.html` : HL·432/433, SAV·373, AS·194/195, TK·202, KYC·378, DSP·379 couvrent le chemin heureux (ouverture → file → réponse → clôture → note → réclamation auto ; retour → avoir). Aucun test sur : escalade/médiateur (C17), isolation client (C3), perte du `texte` (C1), réception du retour (C23), retard d'expédition (C34), sécurisation bloquante (C12), échéance par type (C9), fallback non assigné (C8).

---

## Bilan — les 10 manques prioritaires pour que la chaîne fonctionne de bout en bout

| # | Manque | Constats | Taille |
|---|--------|----------|--------|
| 1 | **Escalade hôte → manager → médiateur** : `escaladerDemande`, `saisirMediateur`, `niveau`/`escaladeAt`, SLA hôte 2 h dérivé, alerte superviseure, décision manager réservée au niveau manager, vue 27 des INF- | C17, C9, C15, C18, C19 | L |
| 2 | **Le message ne se perd plus et la décision est écrite** : `texte` → `echanges` dans `ouvrirDemande`, `retour` affiché à la hotline, réponse motivée obligatoire + acteur sur « Répondre & clore » | C1, C20 | S |
| 3 | **Isolation par compte** : `clientId` posé par le bus, filtre « mes demandes / mes appels » dans 14-assistance et `notifs` Fly, jointures par id | C2, C3 | M |
| 4 | **Remboursement réel** : mode choisi par le client, montant net par ligne, avoir crédité et consommable, virement de remboursement avec RIB/échéance/émission, états 11-suivi alignés (plus d'« espèces ») | C21, C22, C24 | M |
| 5 | **Cycle de vie du retour Mode** (`mode_returns`) : étiquette → reçu atelier → verdict → remboursement/restock, `cmdDe` sur les commandes réglées du data-layer, vue atelier/fournisseur | C23 | L |
| 6 | **Fil fournisseur** : `notifs({app:'fournisseur'})` + cloche (réponses hotline, décisions KYB, frais, retards), champ `espace` sur les demandes lu par la hotline et le manager | C7 | M |
| 7 | **Retard d'expédition dérivé** : `dueTs` à la vente, `expeditionsEnRetard()`, ligne hotline « colis en retard », notification client, alerte manager | C34 | M |
| 8 | **Une seule vérification d'identité et des signatures SQL** : `kyc_` ↔ PEC_DOCS reliés (décision sur pièces complètes), `identifiant` au lieu du prénom / de « Manager », `user_id` sur `kyc_`, dossier refusé hors file | C28, C29, C30, C31 | M |
| 9 | **Planning et assignation honnêtes + relances** : `hoteEnPoste()` → `null` hors planning, écran de planning `hotline_shifts` pour les invités, `dueAt` renouvelé sur `rappeler`/`sans_reponse`, tentatives max, sécurisation bloquante dans `accuserCourse` | C8, C10, C11, C12 | M |
| 10 | **Journal, schéma et boucle client** : journal sans plafond, CHECK `canal`/`type` alignés (+ `enquete`), `rouvrirDemande` + réponse client en Mode, questionnaire envoyé par `traiterAppel` (bus), catalogue de messages complété | C35, C4, C5, C14, C25, C27 | S/M |
