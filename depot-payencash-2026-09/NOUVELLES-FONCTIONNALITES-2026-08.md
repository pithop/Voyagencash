# Nouvelles fonctionnalités & décisions — Août 2026
### AJEK SASU / PayEnCash

> **⚠️ Pivot du 2026-09-18 (soir) — lire d'abord ; remplace le bandeau du 17/09.** Deux décisions fondatrices vident une grande partie de cette note d'août.
> **① L'agent de caisse mobile est SUPPRIMÉ** — le salarié qui se déplaçait encaisser des espèces n'existe plus, ni son app (`ui/coursier/`, 19 écrans), ni les courses, tournées, zones, plannings, paies, flotte, dépôts en automate, fonds de caisse, rendu de monnaie.
> **② Il reste DEUX moyens de paiement**, achetés au comptoir d'un commerce : le **Bon d’achat PayEnCash** (notre réseau de commerçants sous contrat, art. L521-3 CMF) et le **Bon d’achat PayEnCash** (notre réseau de distribution, sous contrat). Promesse : « payer sans carte bancaire, aucune donnée bancaire n'est requise » — et **on ne dit jamais comment le client règle au comptoir**, il règle comme il veut, chez le commerçant.
> **③ Côté commerçant, le reversement mensuel est ABANDONNÉ** : sa carte bancaire enregistrée est **prélevée à chaque vente** du montant moins sa commission (**1,10 % HT + TVA**), via **Stripe** (1,5 % + 0,25 €). **Un refus de la banque = aucun bon d’achat émis.** Il reste un **relevé mensuel**, qui sert à l'autofacture de commission (art. 289 CGI).
>
> **Ce qui tombe et ce qui reste dans cette note** (détail au tableau ci-dessous) : **§1, §5, §7 à §14, §16, §17 et §18.1 sont CADUCS** — ils décrivent tous l'agent, sa logistique ou le point d'encaissement. **§0 (annoté), §2, §3, §4, §6, §15, §18.2 et §18.3 restent** : ils ne dépendaient pas du mode d'encaissement. Le reste du texte d'août n'est pas réécrit — une note datée reste datée.
>
> Capture des demandes de la fondatrice (2026-08-03), à spécifier avant implémentation. Complète le registre d'audit (`AUDIT-CONSOLIDE-2026-08.md`) et la note Mode (l'Étape 4 · flux F11/F12 (`ESPACE-COMMERCANT/documents/partie-4-flux.html`)).
> Chaque bloc = objectif · périmètre · écrans · API/intégration · données · points d'attention.

---

## État de cette note au 18/09 (soir) — section par section

| § | Sujet | État | Pourquoi |
|---|---|---|---|
| **0** | Remboursement (voyage, mode, mécanisme) | **Reste, RÉSOLU** | La règle « jamais plus que ce qu'on récupère » est intacte. Le mécanisme, bloqué depuis août, est tranché : un remboursement **re-crédite le Bon d’achat PayEnCash**, ou passe par un virement au RIB du client. |
| 1 | Recrutement de l'agent | **CADUC** | Le poste n'existe plus. |
| **2** | Téléphonie (appels sortants, logs) | Reste | Sert le support et le commercial, pas l'agent. |
| **3** | SMS + e-mails transactionnels | Reste | Le catalogue change (plus de « votre agent est en route »), le dispositif reste. |
| **4** | CRM, notation, consentements | Reste | La notation **de l'agent** disparaît ; la satisfaction et les consentements restent. |
| 5 | Flotte de scooters + assurance | **CADUC** | Plus de flotte, plus de véhicule en mission. |
| **6** | Silos d'appel commercial, relance d'abandon | Reste | S'applique désormais aussi au recrutement des **commerces partenaires**. |
| 7 | Point de stationnement (standby) | **CADUC** | Plus d'agent à stationner. |
| 8 | Déclaration de service (pointage) | **CADUC** | Plus de prise de poste de terrain. |
| 9 | Fond de caisse (~100 €) | **CADUC** | Plus d'espèces, donc plus de rendu de monnaie à financer. |
| 10 | Messagerie agent ↔ manager | **CADUC** | Plus d'agent à joindre pendant une course. |
| 11 | Affectation automatique des courses | **CADUC** | Plus de course à affecter. |
| 12 | Rendu-monnaie côté client & discrétion | **CADUC** | Plus de billets échangés avec AJEK. |
| 13 | Créneau de collecte (rendez-vous) | **CADUC** | Plus de rendez-vous : le client paie quand il veut, avec son code. |
| 14 | Commande planifiée, confirmation 30 min, position client | **CADUC** | La position du client n'a plus d'usage : personne ne s'y rend. |
| **15** | Compte de résultat & comptabilité de gestion | Reste | **À rechiffrer** : les charges d'agent disparaissent, deux commissions apparaissent (1,10 % au commerçant, 1,5 % + 0,25 € au prestataire), et un bon d’achat vendu non dépensé est une **dette**, pas un produit. |
| 16 | Rôle « agent de caisse mobile » & pack | **CADUC** | Voir la section. |
| 17 | Double option d'encaissement (domicile / point) | **CADUC** | Voir la section. |
| **18** | Compléments | **18.1 CADUC** (plus d'automate à localiser) · **18.2 et 18.3 restent** | La preuve d'adresse e-mail (18.3) se fait désormais sans agent : à respécifier. |

---

## 0. Décision — Remboursement

### 0.1 Voyage (billets Duffel / hôtels Hotelbeds) — RÈGLE PRUDENTE
- Le remboursement suit **strictement les conditions d'annulation du fournisseur** :
  - **Duffel** — `order_cancellation` : lire montant remboursable, pénalités, fenêtre du tarif.
  - **Hotelbeds** — `rateClass` : `NRF` = **non remboursable** ; `NOR` = lire `cancellationPolicies` (`dateFrom` + `amount`).
- **Règle absolue** : si le tarif est **non remboursable**, OU si l'information est **absente/ambiguë** → **afficher explicitement au client que l'annulation N'EST PAS remboursée**. Ne jamais promettre un remboursement que le fournisseur ne garantit pas.
- AJEK **ne rembourse jamais plus que ce qu'elle récupère** du fournisseur. *(Ceci révise l'ancienne règle « remboursé quoi qu'il arrive » de la refonte D2.)*
- Les **conditions d'annulation sont affichées AVANT l'achat** (transparence, écran récap + e-mail de confirmation).

### 0.2 Mode (articles) — rétractation légale
- **Rétractation 14 jours** (art. L221-18/L221-28) : légalement obligatoire, **non contournable**. Le voyage/hébergement en est exclu par exception légale.
- Donc un remboursement mode **peut être dû** même si tout s'est bien passé.

### 0.3 ⚠️ MÉCANISME de remboursement — DÉCISION REQUISE
Quand un remboursement est dû (rétractation mode, ou annulation voyage remboursable), **comment rend-on l'argent ?**
- La clientèle est **sans carte bancaire** → un **virement** n'est pas toujours possible (client non bancarisé).
- Une **course de retour cash** contredit « l'agent ne fait qu'encaisser et déposer ».
- → **À trancher.** En attendant, les passages concernés (docs 07, 11 ; écrans concernés) sont marqués « DÉCISION REQUISE », non corrigés au hasard.

> ✅ **ARBITRÉ LE 2026-08-03, RÉVISÉ LE 2026-09-17, RÉSOLU LE 2026-09-18 (soir).** L'arbitrage d'août (« remise en espèces au point d'encaissement, de droit ») est **caduc** : il n'y a plus de point. Celui du 17/09 l'est aussi pour sa part « espèces remises par l'agent » : il n'y a plus d'agent. **Le remboursement suit le moyen qui a payé, et les deux moyens sont dématérialisés** — Bon d’achat PayEnCash : le montant **re-crédite le bon d’achat** (`rembourser(ref, {mode:'bon'})`, jamais d'espèces, jamais de rendu de monnaie) ; à défaut de bon : virement au RIB (personne d'autre ne rembourse pas un ticket). ⚠️ **Résidu à valider par l'avocat** : un avoir re-crédité vaut-il remboursement au sens de la **rétractation légale de 14 jours**, qui impose le même moyen de paiement qu'à l'achat ? Voir `ESPACE-COMMERCANT/documents/partie-4-flux.html`, F10. (table `refunds`, un seul canal) ; `collections.is_return` n'a plus de mécanisme derrière lui. Voir §3 bis B du registre de décisions. *(Annotation 2026-08-04 : la question « comment atteste-t-on la remise ? », laissée ouverte ci-dessus, a été tranchée — code de remise + photo du reçu numéroté + agent + horodatage, portés par la table `refunds`, `MODELE-DONNEES-COMPLEMENT` §2.13.)*


---

## 1. Recrutement de l'agent, piloté par le manager

**Objectif** : recruter un agent **salarié efficace**, avec un parcours **simple côté candidat** et **complet côté manager**. Principe fort : **tout candidat, quel que soit son profil, reçoit une invitation à une session de recrutement** — cela entretient un **lien positif** et sert l'image employeur.

**Parcours candidat — simple (« je postule ») :**
- Identité + contact, **CV**, **CNI** (pièce d'identité), permis / véhicule, **disponibilités**, **aptitudes** déclarées. Dépôt en quelques étapes, sans friction.

**Parcours manager — complet :**
1. **Réception de la candidature** (boîte des candidatures).
2. **Session de recrutement planifiée** — **chaque candidat reçoit un créneau** (session individuelle ou collective). Pas de rejet sec avant la session.
3. **Entretien / évaluation** : vérification **CV, CNI, aptitudes** et adéquation au poste (fiabilité, contact client, capacité à gérer l'encaissement en espèces).
4. **Décision** : **embauche** → contrat de travail avec **mission d'encaissement** (créance de l'employeur), **sans clause de responsabilité pécuniaire** → **visite médicale du travail (VIP) obligatoire** → **habilitation à encaisser** → **carte de dépôt nominative Cash Services** (plafond par carte/jour) → remise du **pack d'équipement (signature)** → mise en service ; **ou** non retenu (avec une expérience de session positive).
5. **Sortie** (offboarding) : désactivation de la carte + retrait de l'habilitation.

**Statuts** : `candidature_reçue` → `session_planifiée` → `entretien_réalisé` → `embauché` **ou** `non_retenu` ; puis salarié : `habilité/actif` → `sorti`.

**Écrans** :
- Agent : `01-inscription` = **candidature** simple (CV + CNI + aptitudes) + message « tu seras invité·e à une session de recrutement ».
- Manager : `05-agents` refondu → **boîte des candidatures**, **planification des sessions**, **fiche d'évaluation** (CV/CNI/aptitudes), **embauche**. Distinct de `19-invitation` (comptes manager internes).

**Données** : `applications` (candidat, CV, CNI, aptitudes, statut), `recruitment_sessions` (date, présentiel/visio, candidats, résultat), `agents` (statut salarié, `hired_at`, `habilitation_at`, `offboarded_at`), `deposit_cards` (nominative, `issued_at`, `revoked_at`, plafonds).

---

## 2. Service de téléphonie (API) — appels sortants & suivi

**Objectif** : appeler et relancer depuis l'espace manager, avec un vrai opérateur de téléphonie.

- **Intégration** : service de téléphonie via API (ex. Twilio / OVH Telecom / Voxbone — **à arbitrer**), click-to-call.
- **Cas d'usage** :
  - Appeler un **agent** à tout moment (course en cours, incident).
  - Appeler un **client** (confirmation, incident de collecte, SAV).
  - **Relance en cas de dépôt non réalisé** : un agent dont l'encours dépasse 400 € et qui n'a pas déposé → appel de relance (assisté ou automatique).
- **Écran** : `ui/manager/09-appels` enrichi (journal réel : horodatage, motif, résultat, durée), + bouton « Appeler » relié à l'API.
- **Données** : `call_logs` (appelant manager, cibl'agent/client, motif, statut, durée, enregistrement éventuel).
- **Points d'attention** : **masquage des numéros**, consentement à l'enregistrement, RGPD, journalisation.

---

## 3. SMS automatisés + e-mails transactionnels

**Objectif** : notifier automatiquement client et agent aux moments clés.

- **Intégration** : service SMS via API (ex. Twilio / OVH / Brevo — **à arbitrer**).
- **SMS** :
  - Envoi du **code** (code interne + montant à remettre en espèces).
  - **Rappel de s'enregistrer auprès de la compagnie aérienne** (enregistrement/check-in), avec **informations détaillées reçues par e-mail**.
  - Rappels : fenêtre de collecte, agent en route/proche.
- **E-mail transactionnel** (catalogue e-mails existant à compléter) : billets/PNR, confirmation hôtel, **facture de vente** (à l'expédition), rappel enregistrement compagnie (contenu détaillé).
- **Consentement** : distinguer **transactionnel** (nécessaire à la prestation) et **marketing/offres** (opt-in explicite, voir §4).
- **Données** : `messages_log` (canal, gabarit, cible, statut d'envoi), `message_templates`.

---

## 4. Relation client (CRM) + notation/satisfaction + consentement notifications

**Objectif** : suivre la relation client et gérer les consentements.

- **CRM manager** : sur la fiche client (`18-fiche-client`), historique complet — commandes, **appels** (§2), **messages** (§3), réclamations, **palier KYC** (standard/renforcé).
- **Notation & satisfaction** : **vérifier** que les formulaires existent et fonctionnent — notation **agent 1-5★** (présente `ui/ecrans/03-mes-codes`), enquête de **satisfaction** (présente côté manager). Brancher réellement le stockage + l'agrégation.
- **Consentement notifications (offres)** : opt-in **explicite et révocable** pour push/SMS/e-mail **marketing**, tracé (RGPD + loi du 9 juin 2023 sur l'influence commerciale). Distinct du transactionnel.
- **Données** : `notification_consents` (client, canal, finalité marketing, opt-in, horodatage, révocation), `ratings`, `satisfaction_surveys`.

---

## 5. Gestion de flotte (scooters électriques) + assurance

**Objectif** : gérer les véhicules d'AJEK (2 trottinettes électriques + véhicules) et leurs assurances.

- **Module manager** : parc de véhicules, **affectation à un agent**, état, entretien, **assurance** (auto mission, RC exploitation), contrôles.
- **Lien assurances** (modèle AJEK §6) : RC pro, RC exploitation, **vol d'espèces sur la personne**, infidélité de salariés, **assurance automobile mission**, extension faute inexcusable.
- **Écran** : nouvel écran manager « Flotte » (+ éventuel volet assurances).
- **Données** : `fleet_vehicles` (type scooter/trottinette/voiture, identifiant/immat, assurance, affectation agent, statut, entretien), `insurance_policies`.

---

## 6. Silos d'appel commercial + relance sur abandon de tunnel

**Objectif** : récupérer les prospects qui n'achèvent pas leur commande.

- **Déclencheur** : un utilisateur **abandonne le tunnel** (n'achève pas l'achat) → **planifier un appel commercial** de relance.
- **Silos** : files/campagnes d'appels commerciaux **planifiables** (par source, par priorité), affectées à un opérateur.
- **Écran** : nouvel écran manager « Appels commerciaux » (pipeline : à rappeler → planifié → rappelé → converti/perdu), distinct du journal d'appels opérationnels (§2).
- **Données** : `commercial_callbacks` (source = abandon tunnel / autre, `scheduled_at`, opérateur, statut, résultat), lié à `abandoned_orders` (DRAFT non finalisés).
- **Points d'attention** : consentement démarchage, opposition (Bloctel), traçabilité.

---

## 7. Point de stationnement (standby) des agents

**Objectif** : positionner les agents inactifs pour réduire les délais de dispatch.
- Définir un **point géographique de stationnement** par zone. Quand un agent **n'est pas sur une course**, il **rejoint ce point** (position d'attente).
- Le **dispatch** tient compte de la position standby (temps d'accès aux futures courses) — renforce l'axe logistique.
- **Écrans** : app agent (« rejoins ton point de stationnement »), manager (config des points par zone).
- **Données** : `standby_points` (zone, coordonnées, capacité), état agent `en_attente@standby`.

## 8. Déclaration de service (pointage) — arrivée & fin

**Objectif** : tracer le temps de travail et cadrer les prises/fins de poste.
- L'agent **déclare son arrivée** (prise de poste) et sa **fin de service** — **confirmation dans l'app** (arrivée / départ).
- Côté manager : possibilité de **déclencher/confirmer par appel téléphonique et dans l'app**.
- Sert le **suivi du temps de travail** (obligation légale salariés : durées max, nuit, repos).
- Lien standby (§7) : à la prise de poste, rejoindre le point ; à la fin, pointer le départ. Lien fond de caisse (§9) : vérification au début et à la fin.
- **Check-list de prise de poste, vérifiée par le manager** : **carte de dépôt nominative présente** sur l'agent, **fond de caisse compté** (§9), **batterie chargée** (scooter/trottinette), **gants de sécurité**, **éclairage/feux**, casque — chaque point coché et **validé par le manager** avant la mise en ligne. Une check-list incomplète **bloque** la prise de poste.
- **Données** : `service_sessions` (agent, `started_at`, `ended_at`, source app/téléphone, confirmations), `shift_checklists` (session, items cochés, validation manager).

## 9. Fond de caisse (rendu-monnaie) — ~100 €

**Objectif** : permettre à l'agent de **rendre la monnaie** (le client paie en espèces, parfois sans l'appoint).
- Les agents étant **salariés**, ils sont **autorisés à tenir un fond de caisse** : ~**100 € en pièces et billets**, en permanence.
- **Distinct** de : l'**encours encaissé** (montants de commande → cycle de dépôt), des **pourboires** (à l'agent). **NON compté** dans le seuil de dépôt 400 € — c'est un **fond permanent**, pas de l'encours à déposer.
- **Contrôle** : vérification du fond **en début** (prise de poste) **ET en fin de service**, **avec le manager** (double comptage, écart tracé).
- Salarié = **pas de clause de responsabilité pécuniaire** : le contrôle passe par un comptage partagé, jamais par une imputation automatique sur la paie.
- **Données** : `cash_floats` (agent, montant nominal 100 €, assigné_le), `float_checks` (session, début/fin, montant compté, manager, écart).

## 10. Messagerie & notifications agent ↔ manager (temps réel)

**Objectif** : communication directe en cours de service.
- **Messagerie temps réel** agent ↔ manager (incidents, consignes, course).
- **Notifications temps réel** (WebSocket/SSE — canal déjà prévu §2/archi) : nouvelle course, **dépôt requis (> 400 €)**, fin de fenêtre de collecte, message manager, retard de pointage.
- **Écrans** : app agent (messagerie + centre de notifications `16-notifications`), manager (fil par agent).
- **Données** : `internal_messages` (émetteur, destinataire, contenu, `read_at`), `push_tokens`.

---

## 11. Affectation automatique des courses & discipline

**Objectif** : garantir la couverture et la traçabilité — l'agent exécute, il ne trie pas.
- Les courses sont **affectées automatiquement** par le dispatch (priorité distance, D5). L'agent **ne peut pas refuser** ; il **accuse réception** (« Bien reçu ») et la course démarre.
- **Seul le manager** peut **refuser ou réaffecter** une course (agent indisponible, incident…).
- **Discipline dépôt** : le dépôt est une **obligation stricte**. Tout **manquement aux règles de dépôt** (retard, non-dépôt, écart de caisse non signalé, usage de la carte d'un collègue) constitue une **faute lourde**. Le message d'incitation « déposer = être payé » est **retiré** : le salaire est fixe, le dépôt est une obligation, pas une condition de paie.
- **Écrans** : app agent `04-courses` (plus de « Refuser » ; bouton « Bien reçu ») ; manager (réaffectation/refus, suivi des manquements).

## 12. Rendu-monnaie côté client & discrétion

**Objectif** : préparer la monnaie et **ne pas signaler** que l'agent porte des espèces.
- À la **commande** (côté client), **confirmer la coupure / le montant** avec lequel le client réglera (ex. « réglez-vous avec un billet de 200 € ? ») → l'agent prépare la **monnaie** depuis son **fond de caisse** (§9).
- **Message client** : « l'agent arrive avec **l'appoint précis** ». C'est une mesure de **discrétion / sécurité** — on n'annonce jamais que l'agent détient un fond de caisse ou des espèces.
- **Données** : `orders.expected_payment_note` (coupure annoncée par le client), lien `cash_floats` (§9).

## 13. Prise de rendez-vous — créneau de collecte (côté client)

**Objectif** : le client choisit **quand** l'agent passe encaisser, selon son **urgence**. L'urgence se paie, et les créneaux planifiés **optimisent les tournées**.

- À la commande, le client choisit un **créneau de collecte** : **« Dans l'heure »** (urgent, premium) · **« Aujourd'hui, après-midi »** · **« Demain matin »**… (créneaux paramétrables).
- **Tarification par urgence** : plus le créneau est rapide/prioritaire, plus la **commission de service** est élevée — nouvelle **composante « urgence/créneau »** de `collection_fee_config` (D13). Un créneau différé coûte moins cher.
- **Optimisation des tournées** : les créneaux planifiés permettent de **grouper les collectes** par zone et par horaire (multi-course + standby/pointage §7/§8) → moins de kilomètres, meilleure couverture, planning agent plus lisible (LOGISTIQUE §4).
- **⚠️ Interaction avec la volatilité des prix (LOGISTIQUE §5) — à trancher** : différer la collecte **retarde la réservation fournisseur** → risque de dérive du prix du billet. Deux options : ① **prix garanti** jusqu'au créneau (risque porté par AJEK, absorbé par la marge de sécurité) ; ② **prix re-fetché** au moment de la collecte (le client peut voir un ajustement). → **Décision pricing.** Le créneau « dans l'heure » minimise ce risque — c'est aussi pourquoi il est premium. *(Annotation 2026-08-04 : **tranché le 2026-08-03** — option ① prix garanti, avec le barème de marge de sécurité étendu aux créneaux longs (360 min → +4€/voyageur, 1080 min → +8€). Le re-fetch à la collecte est écarté. Registre §3 bis C.)*
- **Écrans** : tunnel client (nouvelle étape **« Choix du créneau »**), manager (**planning des tournées par créneau**).
- **Données** : `orders.collection_slot` (créneau, niveau d'urgence), composante `collection_fee_config` « urgence/créneau », lien planning.

## 14. Commande immédiate ou planifiée + confirmation 30 min + position client

**Objectif** : une commande peut être **immédiate** ou **planifiée plus tard** ; on **confirme la présence** du client avant le passage, et on **récolte sa position** pour planifier les tournées.

- À la commande, le client choisit **« maintenant »** ou **« plus tard »** (créneau, cf. §13).
- **Rappel automatisé 30 min avant** le passage : **SMS + notification** → le client **confirme sa position** (présence + point de rencontre). Job `confirm-position-30min`.
- À la commande, le client peut **déclarer sa future position** (où il sera) **ou** répondre **« je ne sais pas encore »**. Cela **ne change pas** la demande de confirmation des 30 min, mais **aide la planification** (prévision de charge par zone/heure, LOGISTIQUE §4).
- **Écrans** : tunnel client (maintenant/plus tard + position optionnelle), app (notif de confirmation), manager (planning des tournées).
- **Données** : `orders.scheduled_at`, `orders.declared_position` (nullable = « inconnue »), `orders.position_confirmed_at`.

## 15. Compte de résultat & comptabilité de gestion minimale (PCG) — côté manager

**Objectif** : connaître **en temps réel la position bénéficiaire ou déficitaire** d'AJEK.

- **Compte de résultat** (recettes − dépenses) alimenté par les encaissements et les dépenses.
- **Version minimaliste du PCG** — chaque écriture classée en **trois résultats** :
  1. **Exploitation** — marges de ventes, charges courantes (salaires, carburant, Cash Services, Mondial Relay, fournisseurs…).
  2. **Financier** — produits/charges financières (agios, intérêts…).
  3. **Exceptionnel** — produits/charges exceptionnels (litige, pénalité, cession…).
  - **Résultat net = exploitation + financier + exceptionnel.**
- **Règles** : n'enregistrer en recette que des fonds **réels** ; la **TVA collectée n'est pas un revenu** (dette envers l'État) ; le **prix fournisseur** encaissé transite (pas une recette) — seule la **marge AJEK** est un produit.
- **Position en direct** : tableau de bord **« bénéficiaire / déficitaire »**, résultat cumulé (mois / exercice).
- ⚠️ **Suivi de gestion**, pas la comptabilité légale (qui reste chez l'expert-comptable) — plan de comptes et rattachements **à caler avec lui**.
- **Écrans** : manager « Compte de résultat » (recettes/dépenses par classe, position). **Données** : `ledger_entries` (montant, sens, classe exploitation/financier/exceptionnel, catégorie, date).

## 16. ~~Rôle « agent de caisse mobile » & pack d'équipement~~ — **CADUC depuis le 2026-09-18 (soir)**

Le poste est **supprimé**. La fiche de poste, les contrats 35 h/25 h, le pack d'équipement remis contre signature, la tenue et le règlement **n'ont plus d'objet**, et les tables qui les portaient (`job_positions`, `contracts`, `equipment_handovers`) ne sont pas au schéma. La note dédiée qui détaillait ce dossier a été **supprimée du dépôt** le 18/09 au soir.

> **Ce qui en survit** — l'obligation de DUERP tant qu'AJEK emploie quelqu'un, la visite d'information et de prévention à l'embauche, le règlement intérieur à partir de 50 salariés, le cadre de la **prime de partage de la valeur** et l'interdiction d'une prime indexée sur le volume — est recueilli au **§5 de `PLAN-MAITRISE-RISQUES-2026-08.md`**, seul endroit du dépôt qui le porte désormais.

## 17. ~~Prise de commande « sublime » — double option d'encaissement (domicile / point de collecte)~~ — **CADUC EN ENTIER depuis le 2026-09-18 (soir)**

Les **deux** options tombent, pas seulement la seconde : plus de point de collecte (17/09), et plus d'agent qui se déplace (18/09, soir). Il n'y a plus de « frais de déplacement », plus de comparatif A/B, plus de créneau de présence, plus de `orders.fulfillment_mode` ni de `collection_points`. La note qui détaillait ce parcours (`FICHE-PRISE-DE-COMMANDE.md`) a été **supprimée du dépôt** ; le parcours de commande qui fait foi est celui de `docs/01-flux-metier.html`, et l'étape « Comment payer » se lit sur `ui/mode/05-ou-payer.html` et `ui/fly/01-ou-payer.html`.

> **À la place** : une seule étape, **« Comment payer ? »**, qui propose **deux moyens sans frais ni déplacement** — le **Bon d’achat PayEnCash** et le **Bon d’achat PayEnCash**, tous deux achetés au comptoir d'un commerce. Le comparatif de prix n'a plus lieu d'être : les deux moyens coûtent la même chose au client, c'est-à-dire rien de plus que sa commande.

<details><summary>Texte d'août conservé pour mémoire (ne plus mettre en œuvre)</summary>

**Objectif** : offrir plusieurs façons de payer en espèces — dont une **sans frais de déplacement** — tout en **minimisant les risques** (regroupement, plafonds, présence vérifiée).

### Deux options, choisies à la commande
- **A — « On vient à vous »** (encaissement à **domicile**) : l'agent se déplace. **Plus cher** — frais de service (D13) + éventuelle majoration urgence/créneau (§13).
- **B — « Venez à notre point d'encaissement »** (**point de collecte sur rendez-vous**) : c'est le **client qui se déplace**, sur un **créneau horaire de présence**. **Supprime le coût de l'encaissement.** Le point = le **lieu de retour de l'agent**, **à proximité d'une borne Cash Services** (dépôt immédiat). **Remplace proprement le tabac/buraliste** par un point AJEK maîtrisé.

### Tarification
- Commission AJEK sur le **produit/service** (voyage ou mode) **dans les deux cas**.
- **Frais d'encaissement en plus** pour l'option A (domicile) ; **aucun frais de déplacement** pour l'option B.

### Règles de sécurité (option B — point de collecte)
- **Créneaux horaires de présence** (un agent présent au point).
- **Regroupement** des clients au point le plus proche (optimisation).
- **Position conservée** (§14) mais c'est le **client** qui se déplace ; AJEK **vérifie la présence** (KYC / confirmation).
- **Plafond de risque : maximum 4 à 6 clients par créneau** (paramétrable) — limite l'encours et l'affluence.
- Point **près d'une borne Cash Services** → **dépôt immédiat** de l'encours.

### Écrans
- **Tunnel client** : étape **« Comment payer ? »** — comparatif A (+ frais de déplacement) / B (sans frais) ; si B, choix du **point de collecte** + **créneau** + confirmation de présence.
- **Manager** : gestion des **points de collecte** (lieu, borne proche, **capacité 4-6/créneau**), **planning des créneaux de présence**, suivi des présences.

### Données
- `collection_points` (lieu, coordonnées, borne Cash Services proche, `slot_capacity` 4-6).

</details>
- `collection_slots` (`collection_point_id`, créneau, capacité, agent assigné, clients réservés).
- `orders.fulfillment_mode` (enum `home` | `pickup_point`), `orders.collection_point_id` null, `orders.pickup_slot_id` null.
- `orders.service_fee_cents` : **frais de déplacement inclus si `home`, exclus si `pickup_point`**.

## 18. Compléments — localisation des bornes, relance promo, e-mail anti-fraude

**18.1 ~~Localisation des automates Cash Services~~ — CADUC depuis le 2026-09-18 (soir)** : plus d'agent, plus de dépôt, plus d'automate à chercher. *(La seule carte qui reste est celle des **commerces où acheter** — les partenaires du Bon d’achat sur `ui/ecrans/25-ou-acheter-un-bon.html`, jamais une liste en dur.)*

**18.2 Promotion & relance (push + SMS + e-mail)** — campagnes promotionnelles et **relances** par **notification app + SMS + e-mail**, sous **consentement marketing** (§4). Déclencheurs : abandon de tunnel (§6), offres, alertes prix, réactivation client. (Confirme et regroupe §3 envois, §4 consentement, §6 silos commerciaux.)

**18.3 E-mail lié au code — anti fausses adresses** — le **code** (interne / de sécurité) est **envoyé par e-mail** au client ; à la collecte, le client doit **ouvrir et consulter cet e-mail devant l'agent**. Objectif : **prouver que l'adresse e-mail est réelle et accessible** → filtre les **fausses adresses / spam**, renforce l'anti-fraude (avec le KYC §5 et la confirmation de position §14). Données : `payments.code_email_sent_at`, `collections.email_checked_at` (booléen coché par l'agent).

---

## Impact documentaire (où câbler ces fonctionnalités)

| Document | À ajouter |
|---|---|
| `docs/03-api-specs.html` | Endpoints téléphonie (click-to-call, logs), SMS/e-mail (envoi, gabarits), consentements, CRM, flotte, callbacks commerciaux. |
| `docs/05-architecture.html` | Services téléphonie & SMS, jobs planifiés : relance dépôt (§2), rappel enregistrement compagnie (§3), relance abandon tunnel (§6). |
| `docs/09-espace-manager.html` | Écrans : ~~recrutement (§1)~~, appels/téléphonie (§2), CRM (§4), ~~flotte (§5)~~, silos commerciaux (§6), consentements. *(18/09, soir : recrutement et flotte supprimés ; à la place, l'écran **Commerces partenaires** `manager/29` — activation d'un point, carte de règlement, prélèvements, relevé mensuel.)* |
| l'Étape 6 (`ESPACE-COMMERCANT/documents/partie-6-donnees.html`) | Tables : ~~`deposit_cards`~~, `call_logs`, `messages_log`/`message_templates`, `notification_consents`, `ratings`/`satisfaction_surveys`, ~~`fleet_vehicles`/`insurance_policies`~~, `commercial_callbacks`/`abandoned_orders`. *(18/09, soir — les tables réellement au schéma pour le nouveau modèle : `partners`, `partner_cards`, `partner_charges`, `gift_cards`, `gift_card_movements`, `signature_links`, `psp_transactions`. Le relevé mensuel n'est **pas** une table : c'est la vue `v_partner_monthly_statements`.)* |
| `docs/07-annulations-remboursements.html` | Règle remboursement voyage (§0.1) + rétractation mode (§0.2) + ~~marqueur mécanisme (§0.3)~~ *(caduc 2026-08-04 : ne plus poser de marqueur « décision requise » — le canal est tranché et Doc 7 porte désormais l'appareil complet)*. |
| `ui/manager/` | ~~Refonte `05-agents` (recrutement)~~, `09-appels` (téléphonie) ; ~~nouvel écran Flotte~~, CRM, Appels commerciaux. *(18/09, soir : `05-coursiers` et `22-flotte` sont supprimés, avec six autres écrans manager de l'agent.)* |

> **Priorité de traitement** : d'abord finir les **corrections** de l'audit (statut salarié, Cash Services, seuils, conformité), puis **spécifier** ces nouvelles fonctionnalités dans les documents ci-dessus.
