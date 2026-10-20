# Analyse critique des risques — AJEK SASU / PayEnCash

### Revue indépendante du modèle d'affaires · Août 2026

> **⚠️ Pivot du 2026-09-18 (soir) — lecture à jour, et elle remplace celle du 17/09.** Cette analyse d'août évalue un modèle « 100 % espèces » à domicile. **Ce modèle n'existe plus.** L'agent de caisse mobile — le salarié qui se déplaçait encaisser des billets — est **supprimé** ; avec lui disparaissent les courses, les tournées, les dépôts en automate, le fond de caisse, le rendu de monnaie et le découpage « 1 000 € d'espèces + complément carte ». Il reste **deux moyens de paiement**, tous deux achetés au comptoir d'un commerce : le **Bon d’achat PayEnCash** (notre réseau de commerçants sous contrat, art. L521-3 CMF) et le **Bon d’achat PayEnCash** (notre réseau de distribution, sous contrat). Côté commerçant, le reversement mensuel est **abandonné** : la carte bancaire enregistrée du commerce est **prélevée à chaque vente**, du montant moins sa commission, via **Stripe**.
>
> **Ce que cela fait à cette analyse.** **AJEK ne reçoit plus un seul billet** : toute la famille « sécurité physique » (S1-S5), le transport de fonds par un salarié (J7, CNAPS), la collusion de l'agent (A4), le défaut de dépôt (F2), le cycle du cash (F6), la disponibilité des agents (O4-O7), la géolocalisation des salariés et les photos de preuve (R1-R2), la convention collective et le travail de nuit (J1-J2), la prime à la course (J9), la confiance « cash à domicile » et les faux agents (C1, C3, C5), la dépendance au réseau de dépôt (D2) **n'ont plus d'objet** : ces lignes sont **retirées**, et chaque retrait est dit et motivé sous le tableau de sa famille. Le risque n° 1 d'août — le dé-risquage d'un compte massivement alimenté en espèces (D0/A5) — **perd sa cause** et est **recoté**. Cinq risques **apparaissent** avec le nouveau modèle : ils sont écrits au **§2.9**. La heatmap (§3) et le TOP 10 (§4) sont **refaits à la date du 18/09**.
>
> Les constats d'août qui gardent un objet sont conservés tels quels, avec leur cotation d'août : un auditeur ne réécrit pas une observation datée. Ce qui est retiré l'est parce que le risque n'a plus d'objet — pas parce qu'on a choisi de ne pas le traiter.
>
> **Nature du document** : analyse de risques critique et indépendante, conçue selon les standards d'une revue de type cabinet d'audit / risk advisory (approche Big Four). Elle évalue le modèle d'affaires **AJEK SASU / PayEnCash** tel que décrit dans la documentation d'août 2026 (`MISE-A-JOUR-2026-08`, l'Étape 4 · flux F11/F12, `NOUVELLES-FONCTIONNALITES-2026-08`, `MODELE-DONNEES-COMPLEMENT-2026-08`). *(18/09, soir : deux des sources d'origine — `LOGISTIQUE-AGENT-2026-08` et `AGENT-CAISSE-MOBILE-RH` — ont été supprimées du dépôt avec le poste qu'elles décrivaient.)*
> **Posture** : esprit critique, honnête et concret. Ce document ne remplace pas un avis juridique, fiscal ou assurantiel professionnel ; il identifie les risques, les cote et les priorise pour la décision.
> **Échelle de cotation** : Impact (I) de 1 (négligeable) à 5 (existentiel) · Probabilité (P) de 1 (rare) à 5 (quasi-certain) · **Criticité = I × P** (max 25). Seuils : **1-6 faible · 8-12 modéré · 15-19 élevé · 20-25 critique**.

---

## 1. Synthèse exécutive

Le modèle d'AJEK est cohérent, documenté avec sérieux et ses concepteurs ont identifié la plupart des zones de danger (marqueurs « à confirmer », « décision requise » nombreux). Mais il repose sur une **combinaison rare et intrinsèquement à haut risque : encaissement 100 % espèces, à domicile, par des salariés porteurs de fonds, au service d'une clientèle non bancarisée, avec avance de trésorerie sur un fournisseur temps réel (Duffel).**

**Le risque le plus critique n'est pas un risque isolé mais un enchaînement systémique.** Le point de rupture unique est **la relation bancaire adossée à un compte massivement alimenté en espèces**. La banque d'AJEK est, elle, assujettie LCB-FT (contrairement à la position — non confirmée — qu'AJEK revendique pour elle-même) ; face à un flux cash intense, sans historique, corrélé à des voyages internationaux réglés par une clientèle non bancarisée, la probabilité d'un **gel puis d'une clôture du compte (« de-risking »)** est élevée. Or **sans compte bancaire, le modèle s'effondre entièrement** : plus de dépôt Cash Services exploitable, plus d'avance du solde Duffel, plus de paie. Ce risque unique concentre à lui seul un aléa existentiel, et il est aujourd'hui **insuffisamment traité dans la documentation** (aucune stratégie de résilience bancaire, aucun plan B d'établissement de paiement).

En second rang viennent deux risques quasi jumeaux : (a) le **statut LCB-FT non tranché** — si AJEK est requalifiée assujettie, tout le dispositif « KYC allégé, non-assujetti » devient une non-conformité rétroactive ; (b) la **sécurité physique des agents** porteurs d'espèces à domicile, où un seul incident grave (agression, guet-apens) porte un risque humain, pénal (faute inexcusable) et réputationnel majeur. Le fonds de roulement qui avance le solde Duffel constitue le quatrième foyer : mal dimensionné ou attaqué par un défaut de dépôt d'un agent, il provoque une rupture de trésorerie en cascade.

> **(18/09, soir — ce que la synthèse d'août devient.)** Les deux premiers foyers de cette synthèse **tombent avec l'agent** : il n'y a plus de compte massivement alimenté en espèces (le compte reçoit deux virements de prestataires identifiés), et il n'y a plus de salarié porteur de fonds. Ce qui subsiste : le fonds de roulement Duffel (F1/F5) et le statut LCB-FT (A1), qui ne dépendaient pas du mode d'encaissement. Ce qui remplace le point de rupture unique : **deux prestataires de paiement sans substitut immédiat** (§2.9, P1) — le point de rupture a changé d'adresse, il n'a pas disparu.

**Conclusion de synthèse** : le modèle est *opérable* mais *fragile aux extrêmes*. Il ne tombe pas sur son fonctionnement nominal ; il tombe sur les événements de bord (banque, régulateur, incident de sécurité, pic de volume). La priorité n'est pas d'optimiser le nominal mais de **blinder les points de rupture uniques**.

---

## 2. Analyse par famille de risque

### 2.1 Financier / trésorerie

Le cœur économique repose sur un **décalage temporel** : l'encaissement client (espèces, immédiat) déclenche un **paiement fournisseur immédiat** (Duffel, avance sur solde prépayé ; Hotelbeds post-payé) alors que le **dépôt bancaire du cash** intervient plus tard (`collected → declared → reconciled → on_account`), après passage par l'agent puis la borne Cash Services puis le rapport quotidien. AJEK doit donc immobiliser un **fonds de roulement** pour avancer le solde Duffel avant que le cash encaissé ne soit réellement crédité au compte.

> **(18/09, soir) Le décalage change de nature, il ne disparaît pas.** Il n'y a plus de cash, plus de dépôt, plus de rapport quotidien : l'argent arrive par **un seul virement de prestataire** — Stripe, pour le prélèvement du commerçant à chaque bon d’achat vendu. Mais un bon d’achat peut être **vendu en janvier et dépensé en novembre** (validité 12 mois) : AJEK encaisse d'abord et doit le service ensuite. Le fonds de roulement reste donc à dimensionner — sur un décalage désormais **contractuel** (la durée de vie d'un bon d’achat, le délai de versement d'un prestataire) et non plus **logistique**.

| # | Risque détaillé | I | P | Crit. | Cotation |
|---|---|---|---|---|---|
| F1 | **Sous-dimensionnement du fonds de roulement Duffel** : le solde prépayé Duffel doit toujours couvrir le pic d'encaissements en attente de crédit. Un pic de commandes (saisonnalité, campagne) épuise le solde → réservations refusées après encaissement client → obligation de rembourser en cash une clientèle non bancarisée (voir J8). | 5 | 3 | **15** | Élevé |
| F3 | **TVA collectée traitée comme un revenu** : erreur comptable classique. La TVA collectée et le prix fournisseur qui « transite » ne sont **pas** des produits — seule la marge AJEK l'est. Confondre les deux gonfle artificiellement la trésorerie disponible et conduit à sur-avancer / sous-provisionner la dette TVA. | 5 | 2 | **10** | Modéré |
| F4 | **Hotelbeds post-payé = dette différée invisible** : le post-paiement soulage la trésorerie à l'instant T mais crée une **dette fournisseur** à échéance. Un pilotage qui ne provisionne pas ces échéances confond aisance de caisse et solvabilité. | 3 | 3 | **9** | Modéré |
| F5 | **Sensibilité extrême au volume** : à faible volume (5 encaissements/jour/agent au démarrage), le coût fixe salarial (agents, managers, flotte, assurances) écrase la marge unitaire (~30 € sur une commande mode à 221 €, marge voyage sur le régime de la marge). Le seuil de rentabilité est structurellement haut. | 4 | 4 | **16** | Élevé |
| F7 | **Volatilité du prix vol et marge de sécurité** : l'offre Duffel expire ; un re-fetch renchérit. Si le prix est garanti jusqu'au créneau différé (option ① de la doc), AJEK porte le risque de dérive — absorbé « par la marge de sécurité », mais une dérive répétée érode la marge réelle. | 3 | 3 | **9** | Modéré |

**(18/09, soir) Retirés — sans objet** : **F2** (défaut ou retard de dépôt d'un agent) et **F6** (décalage encaissement→dépôt→`on_account`). Il n'y a plus d'agent, plus d'encours porté, plus de dépôt à déclarer : les trois états intermédiaires du cash n'existent plus, et un encaissement est soit notifié par le prestataire, soit prélevé sur la carte du commerce — dans les deux cas sans main humaine entre les deux. *(La contrepartie de cette disparition est au §2.9 : ce n'est plus un salarié qui peut faire défaut, c'est un prestataire.)*

**Dispositifs de maîtrise existants (cités)** : états du cash tracés (`collected → declared → reconciled → on_account`) avec règle « aucun décaissement sur du `declared` non confirmé » ; seuil de dépôt 400 € paramétrable ; rapprochement ligne à ligne du rapport quotidien Cash Services par carte nominative ; règle comptable explicite « TVA collectée ≠ revenu / prix fournisseur transite » (`ledger_entries`, compte de résultat manager, §15 des nouvelles fonctionnalités) ; marge de sécurité + re-fetch sur la volatilité prix.

**Recommandations** :
- **Formaliser un modèle de trésorerie à 13 semaines** avec scénario de stress (pic ×3 du volume, retard de dépôt de 20 % des agents pendant 48 h) et **fixer une réserve minimale de fonds de roulement Duffel** = pic historique d'encours `collected+declared` non encore `on_account`, majoré d'un coussin.
- **Provisionner distinctement** trois passifs qui ne sont pas de la trésorerie disponible : dette TVA collectée, dette fournisseur Hotelbeds post-payée, et remboursements potentiels (mode/voyage).
- Créer un **indicateur de couverture** : solde Duffel disponible ÷ encours cash non reconcilié. Alerte manager sous un seuil.
- Documenter noir sur blanc la **politique de provisionnement** dans `docs/08-mecanisme-financier` (aujourd'hui centrée sur le principe, pas sur le dimensionnement du coussin).

---

### 2.2 Fraude / AML / cash

C'est la famille la plus lourde de conséquences réglementaires. Le modèle est **entièrement cash**, adossé à des produits (voyages internationaux, biens revendables) qui figurent parmi les vecteurs classiques de blanchiment. La documentation revendique une position **« AJEK non assujettie LCB-FT »**, explicitement marquée « à confirmer par avis juridique ».

| # | Risque détaillé | I | P | Crit. | Cotation |
|---|---|---|---|---|---|
| A1 | **Requalification en assujetti LCB-FT** : si un avis juridique (ou le régulateur) conclut qu'AJEK est assujettie — agence de voyages, négociant de biens, encaissement d'espèces —, tout le dispositif « KYC gradué, non-assujetti » devient une **non-conformité rétroactive** : obligations de vigilance, déclarations de soupçon (Tracfin), gel des relations à risque. Sanctions administratives et pénales possibles. | 5 | 3 | **15** | Élevé |
| A2 | **Intensité cash = aimant à blanchiment** : convertir des espèces d'origine douteuse en billets d'avion (transférables, revendables) ou en biens mode revendables est un schéma de blanchiment/structuration connu. Le plafond 1 000 €/transaction limite l'unitaire mais pas l'agrégation. | 5 | 3 | **15** | Élevé |
| A3 | **Fractionnement (smurfing)** : un même bénéficiaire économique répartit ses achats sous le plafond via plusieurs commandes/identités. Le seuil KYC renforcé (3 achats OU 1 000 €/7 j glissants) atténue mais reste contournable par multi-comptes ou faux clients. | 4 | 3 | **12** | Modéré |
| A5 | **Vigilance de la banque (dé-risquage)** — *risque charnière, voir §2.8* : la banque est assujettie et scrutera un compte cash intense. Elle peut exiger, geler, ou clôturer. *(**Recoté 5 × 2 = 10 le 18/09, soir** : le compte n'est plus alimenté en espèces mais par **deux virements de prestataires identifiés et contractualisés**. La banque reste assujettie et reste libre de partir, mais le motif d'août — l'intensité cash — a disparu. Reste à instruire ce que la banque pensera d'un émetteur de bons d’achat.)* | 5 | ~~4~~ **2** | ~~**20**~~ **10** | ~~Critique~~ Modéré |
| A6 | **KYC « résultat seulement » insuffisant en cas de contrôle** : ne conserver que le résultat PVID (pas les pièces) est vertueux RGPD, mais si AJEK est requalifiée assujettie, l'absence de dossier de vigilance conservé devient un défaut de piste d'audit. | 3 | 3 | **9** | Modéré |

**Dispositifs de maîtrise existants (cités)** : plafond 1 000 €/transaction figé à la génération du code + anti-fractionnement (art. L112-6/D112-3 CMF) ; KYC simple systématique dès la 1re commande (payeur = bénéficiaire) + KYC renforcé sur seuil glissant (3 achats OU 1 000 €/7 j), prestataire certifié PVID/ANSSI ; KYB fournisseurs (SIRET, activité de revente, facture conforme, registre des objets mobiliers) ; journal de caisse sécurisé ; chaîne de dépôt tracée par carte nominative et rapprochement quotidien.

**(18/09, soir) Retiré — sans objet** : **A4** (collusion de l'agent de caisse). Il n'y a plus d'agent, donc plus de point de contrôle humain unique en mobilité. **A2** (intensité cash) et **A3** (fractionnement) **changent de main** : ce n'est plus AJEK qui reçoit les billets, c'est le **commerçant partenaire**, pour son propre compte, et c'est lui qui est exposé à ses propres obligations. Ce qui reste à AJEK, et qui devient central, c'est que **le Bon d’achat PayEnCash est un titre au porteur jusqu'à son premier usage** : le rattachement au compte client vérifié dès le premier usage, et les paliers de `ref.kyc`, sont désormais les seules vigilances qui tiennent. **A1** (requalification LCB-FT) est **inchangé** — il ne dépendait pas du mode d'encaissement.

**Recommandations** :
- **Obtenir l'avis juridique LCB-FT écrit AVANT tout lancement commercial** — ce n'est pas un point « non bloquant pour l'édition » comme le classe la doc, c'est un **prérequis de licéité du modèle**. Traiter le pire cas (assujetti) comme hypothèse de conception : c'est le seul moyen de ne pas avoir à tout reconstruire.
- **Concevoir dès maintenant un socle de vigilance « assujetti-ready »** même si non assujetti : conservation d'une piste d'audit (identité vérifiée, historique agrégé par bénéficiaire réel, alertes de fractionnement), procédure interne de déclaration de soupçon activable, nomination d'un référent conformité.
- **Renforcer l'anti-fractionnement au niveau du bénéficiaire réel** (téléphone, adresse, identité PVID), pas seulement du compte, pour bloquer le multi-comptes.
- **Réduire le risque agent** : encaissement contrôlé par montant figé côté serveur (le code porte le montant TTC), photo + code obligatoires, écart de caisse tracé, rotation des agents/zones, contrôle inopiné.

---

### 2.3 Opérationnel

Le modèle est une **chaîne logistique temps réel** : encaisser → collecter → déposer, avec un maillon fournisseur (Duffel ≤ 120 s) et un maillon humain (disponibilité agent). Chaque maillon est un point de défaillance.

> **(18/09, soir) La chaîne logistique n'existe plus.** Il ne reste qu'un maillon fournisseur (Duffel/Hotelbeds) et un maillon **prestataire de paiement** (§2.9). Le maillon humain — l'agent, sa disponibilité, sa tournée, son dépôt — a disparu ; les risques qui en dépendaient sont retirés ci-dessous.

| # | Risque détaillé | I | P | Crit. | Cotation |
|---|---|---|---|---|---|
| O1 | **Échec de réservation APRÈS encaissement** : l'agent a encaissé le cash, mais la réservation Duffel/Hotelbeds échoue (solde insuffisant, offre expirée, erreur fournisseur). Le client non bancarisé a payé et n'a rien → obligation de remboursement cash non résolue (voir J8) + litige immédiat sur le pas-de-porte. | 5 | 3 | **15** | Élevé |
| O2 | **Panne / latence fournisseur (Duffel ≤ 120 s, Hotelbeds)** : dépendance à un tiers pour valider la commande en temps réel. Une indisponibilité fige les collectes ou multiplie les échecs O1. | 4 | 3 | **12** | Modéré |
| O3 | **Volatilité des prix / offre expirante** : entre le choix client et l'encaissement (surtout créneau différé « demain matin »), l'offre expire → re-fetch → prix différent → client mécontent ou marge rognée. Interaction non tranchée (prix garanti vs re-fetché). | 4 | 4 | **16** | Élevé |

**(18/09, soir) Retirés — sans objet** : **O4** (disponibilité et dispatch des agents), **O5** (automate Cash Services indisponible), **O6** (géolocalisation de la borne et carte nominative), **O7** (densité des créneaux au point de collecte). Aucun de ces quatre n'a plus de support : ni agent, ni automate, ni carte de dépôt, ni point de collecte. **O1** (échec de réservation après encaissement) **reste, et devient plus simple à traiter** : le client a payé par bon d’achat, et un remboursement **re-crédite le bon d’achat** — il n'y a plus à organiser une remise d'espèces.

**Dispositifs de maîtrise existants (cités)** : encaissement AVANT tout engagement fournisseur (« aucun article acheté/expédié avant que l'argent soit en caisse ») — protège contre l'impayé mais **déplace** le risque sur l'échec post-encaissement ; idempotence sur `collections.id` ; minuteur de réservation + dispatch prioritaire sur l'urgence (offre expirante) ; marge de sécurité + re-fetch ; recherche géolocalisée de borne ; standby points, pointage, planning avec alertes de dépassement légal ; créneau « dans l'heure » premium qui minimise la dérive prix.

**Recommandations** :
- **Traiter O1 (échec post-encaissement) comme scénario nominal, pas exceptionnel** : définir un protocole clair (re-tentative auto, offre alternative équivalente proposée sur place, et à défaut circuit de remboursement cash — donc trancher J8). C'est le point de friction le plus toxique du parcours.
- **Trancher l'arbitrage prix garanti vs re-fetché (O3)** : recommandation = prix garanti jusqu'au créneau **uniquement** pour les créneaux courts (≤ quelques heures), re-fetch transparent au-delà, avec information claire au client. Sinon la marge de sécurité devient un pari.
- **Dégrader proprement en cas de panne fournisseur (O2)** : file d'attente des commandes payées + engagement de délai + remboursement si non honoré, plutôt qu'échec sec.
- **Redondance de dépôt (O5)** : cartographier au moins 2 bornes Cash Services par zone et gérer un mode « borne indisponible » (report + relèvement temporaire de plafond d'encours encadré).

---

### 2.4 Sécurité physique — **famille CLOSE le 18/09 (soir), sans objet**

Cette famille cotait le risque pris par un **salarié porteur de fonds** : agression et vol d'espèces sur la personne (S1), guet-apens par fausse commande (S2), risque routier de la tournée (S3), perte de discrétion à l'échelle (S4), fond de caisse permanent comme cible supplémentaire (S5). **Ces cinq risques sont retirés** : le poste qui les portait n'existe plus, aucun salarié d'AJEK ne se déplace plus avec de l'argent, il n'y a plus de tournée, plus de fond de caisse, plus de dépôt en automate. Le risque n'a pas été accepté ni transféré : **il a été supprimé à la source, en supprimant l'activité qui l'engendrait** — c'est la première des neuf mesures de prévention de l'art. L4121-2 du code du travail, « éviter les risques ».

Tombent avec eux : le DUERP du poste, le plan d'action sécurité, la procédure d'agression et le bouton SOS, l'anti-usurpation client, les polices « vol d'espèces sur la personne » / « auto mission » / « faute inexcusable », l'équipement individuel et la flotte. Les deux notes qui portaient ce dossier — `DUERP-AGENT-CAISSE-MOBILE.md` et `AGENT-CAISSE-MOBILE-RH.md` — ont été **supprimées du dépôt** le 18/09 au soir.

> **Ce qui survit, et qu'il ne faut pas perdre** : l'obligation d'évaluation des risques professionnels **ne dépend pas du poste, elle dépend de l'existence de salariés**. Tant qu'AJEK emploie quelqu'un, elle doit tenir un **DUERP** (art. L4121-1 et L4121-2, R4121-1 à R4121-4 du code du travail), le mettre à jour **au moins une fois par an** et à **chaque décision d'aménagement** modifiant les conditions de santé, sécurité ou travail — **la suppression du poste d'agent est exactement une telle décision** —, le tenir à disposition des salariés, du CSE, du médecin du travail et de l'inspection du travail, et **conserver ses versions successives 40 ans**. Son absence ou son défaut de mise à jour est sanctionné pénalement et aggrave la responsabilité de l'employeur. L'évaluation à refaire porte désormais sur un travail **sédentaire** (écrans, sédentarité, charge mentale du support client), sans commune mesure avec l'ancienne — mais elle est due. **À valider par un juriste social / le service de santé au travail.**

---

### 2.5 Juridique / réglementaire

Modèle à **forte densité réglementaire** : droit du travail (salariés, nuit, temps partiel), droit de la consommation (rétractation), fiscalité (TVA marge, plafond espèces, logiciel de caisse), droit pénal commercial (objets mobiliers, contrefaçon), et le remboursement d'une clientèle non bancarisée — point explicitement **non tranché**.

| # | Risque détaillé | I | P | Crit. | Cotation |
|---|---|---|---|---|---|
| J3 | **Conformité logiciel de caisse (art. 286-I-3° bis CGI)** : encaissement d'espèces par assujetti TVA → obligation d'un système de caisse **certifié** (inaltérabilité, sécurisation, conservation, archivage). Le « journal de caisse sécurisé » cité doit être **certifié**, pas seulement « sécurisé ». Défaut = amende 7 500 €/logiciel + mise en conformité 60 j. *(18/09, soir : **la question se pose autrement** — AJEK ne reçoit plus d'espèces, les règlements arrivent par virement du prestataire et par prélèvement carte. Le constat n'est ni retiré ni confirmé : **à reposer à l'expert-comptable** dans le nouveau modèle, plutôt qu'à supposer résolu.)* | 4 | 3 | **12** | À rouvrir |
| J5 | **Rétractation 14 j (mode)** : légalement due (L221-18/L221-28), non contournable → un remboursement mode **peut être dû même sans incident**. Sans circuit de remboursement opérationnel, non-conformité consumériste garantie. | 4 | 4 | **16** | Élevé |
| J6 | **Contrefaçon / provenance (mode)** : AJEK est le **vendeur**, donc responsable de l'authenticité et de la garantie légale. Un article contrefait ou d'origine douteuse dans le réseau de partenaires engage sa responsabilité (civile et pénale). | 4 | 3 | **12** | Modéré |
| J8 | **⚠️ Mécanisme de remboursement du client non bancarisé — DÉCISION NON TRANCHÉE** : virement impossible (pas de compte), « course de retour cash » contredit le principe « l'agent ne fait qu'encaisser et déposer ». Sans solution, chaque remboursement dû (rétractation mode J5, annulation voyage remboursable, échec post-encaissement O1) est ingérable → litiges, non-conformité, atteinte réputation. *(**TRANCHÉ, et recoté 5 × 2 = 10 le 18/09, soir** — c'est le bénéfice le plus net du nouveau modèle : un remboursement **re-crédite le Bon d’achat PayEnCash** (`rembourser(ref, {mode:'bon'})`), ou passe par un virement au RIB du client. Plus de remise d'espèces à organiser, plus de « comment atteste-t-on la remise ? ». **Résidu à valider par l'avocat** : un avoir re-crédité éteint-il l'obligation de remboursement de la **rétractation légale** de 14 jours, qui impose le même moyen de paiement que celui utilisé à l'achat ? Si oui, J8 se ferme ; sinon, J5 reste entier.)* | 5 | ~~4~~ **2** | ~~**20**~~ **10** | ~~Critique~~ Modéré |

**(18/09, soir) Retirés — sans objet** : **J1** (convention collective) et **J2** (travail de nuit sans accord) — il n'y a plus d'effectif de terrain, plus d'horaire de nuit, plus de classification à choisir ; **J7** (frontière du transport de fonds réglementé, CNAPS) — **plus personne ne transporte de fonds pour AJEK**, ce qui était l'une des raisons explicites de supprimer le poste ; **J9** (prime à la course = salaire déguisé) — il n'y a plus de course sur laquelle indexer quoi que ce soit ; **J4** (plafond légal des espèces, art. L112-6 CMF) — **ce plafond n'est plus le nôtre** : le règlement du bon d’achat au comptoir relève du commerçant et des moyens qu'il accepte, et nos propres plafonds (5 € minimum, 250 € par bon d’achat, 1 000 € de bons d’achat utilisés par client et par jour) sont ceux de `ref.bons`.

**(18/09, soir) Apparaissent à la place** — voir **§2.9** : le seuil ACPR d'1 M€ sur 12 mois (P3), le sort des soldes expirés (P4) et la qualification du contrat de distribution (P5) sont les trois nouveaux risques juridiques du modèle.

**Dispositifs de maîtrise existants (cités)** : plafond 1 000 € figé + anti-fractionnement ; rétractation 14 j explicitement reconnue et voyage exclu par exception légale ; contrat avec mission d'encaissement **sans clause de responsabilité pécuniaire** (aligné jurisprudence) ; interdiction explicite de la prime à la course (anti-URSSAF) ; KYB + registre des objets mobiliers (art. 321-7) + garantie de provenance + facture d'achat conservée pour la contrefaçon ; positionnement « agent ne transporte aucune marchandise » ; règle remboursement voyage prudente (« jamais plus que ce qu'AJEK récupère du fournisseur »).

**Recommandations** :
- **Trancher J8 (remboursement cash) avant lancement** — c'est un blocage juridique et opérationnel, pas un détail. Options à arbitrer : (a) bon d'achat/remise en espèces au point d'encaissement (réutilisable, évite la sortie de cash) pour le remboursable non légalement exigible ; (b) remboursement en espèces **au point de collecte sur rendez-vous** (pas à domicile, mieux tracé) pour la rétractation légale ; (c) virement si le client fournit un RIB tiers de confiance. La rétractation mode étant d'ordre public, une solution conforme est **obligatoire**.
- **Faire certifier le système de caisse (J3)** ou obtenir l'attestation éditeur — vérifier explicitement la conformité 286-I-3° bis, ne pas se contenter de « sécurisé ».
- **Fixer la convention collective (J1) et l'accord travail de nuit (J2) avant d'embaucher / d'ouvrir la nuit** — impact rétroactif lourd si erreur.
- **Renforcer l'audit fournisseurs mode (J6)** : audits inopinés, échantillonnage d'authentification, clause de garantie de provenance activable, traçabilité article par article.
- **Sécuriser J7 par avis juridique** : confirmer que le dispositif reste hors activité de transport de fonds réglementée aux volumes visés, et documenter la frontière.

---

### 2.6 RGPD / données

Le modèle collecte des données particulièrement sensibles : **géolocalisation temps réel** des agents (salariés) et des clients, **photos de preuve** au domicile, **vérification d'identité (KYC/PVID)**, enregistrement d'appels, position déclarée du client.

> **(18/09, soir) Le périmètre RGPD se rétrécit fortement.** Plus de géolocalisation (ni des salariés, ni des clients), plus de photo prise au domicile, plus d'adresse de collecte ni de position déclarée. Restent la **vérification d'identité**, les **appels** du support et les **logs** — auxquels s'ajoutent deux traitements neufs : le **rattachement d'un bon d’achat au compte** qui l'utilise (c'est lui qui fait sortir le titre de l'anonymat) et les **données du commerce partenaire** (gérant, pièces KYB, empreinte de carte détenue par le prestataire — jamais le numéro chez nous).

| # | Risque détaillé | I | P | Crit. | Cotation |
|---|---|---|---|---|---|
| R3 | **KYC / données d'identité** : même en ne conservant que le résultat PVID, la finalité (prévention fraude/sécurité) doit être documentée, la base légale (intérêt légitime) balancée, et la sous-traitance PVID encadrée (art. 28). Si requalification LCB-FT, la base légale bascule (obligation légale). | 3 | 3 | **9** | Modéré |
| R4 | **Rétention / durées de conservation non spécifiées** : la doc liste les tables mais peu de durées. Absence de politique de rétention = non-conformité par défaut (photos, appels enregistrés, géoloc, logs). | 3 | 4 | **12** | Modéré |
| R5 | **Enregistrement d'appels + démarchage (call logs, Bloctel)** : consentement à l'enregistrement, masquage des numéros, opposition Bloctel pour les silos commerciaux. | 3 | 3 | **9** | Modéré |

**(18/09, soir) Retirés — sans objet** : **R1** (géolocalisation temps réel des salariés) et **R2** (photos de preuve au domicile client). Ces deux traitements, qui étaient les plus lourds du dossier et rendaient l'**AIPD** quasi certaine, **ont disparu avec l'agent** : plus de suivi live, plus d'image prise chez le client. **R4** (politique de rétention) reste le maillon faible, et **R3** (KYC) prend du poids puisqu'il devient la seule vigilance forte du parcours.

**Dispositifs de maîtrise existants (cités)** : PVID conserve **seulement le résultat**, pas les copies de pièces ; finalité KYC restreinte (prévention fraude + sécurité, **pas** de profilage ni notation client) ; masquage des numéros + consentement enregistrement mentionnés ; distinction transactionnel / marketing avec opt-in explicite et révocable (`notification_consents` distinct de `user_consents`) ; `collection_tracking_events` cadré.

**Recommandations** :
- **Rédiger un registre des traitements + une politique de rétention chiffrée** (durée par catégorie : photos preuve, géoloc, KYC résultat, appels, logs) — aujourd'hui le maillon faible RGPD.
- **AIPD (analyse d'impact) obligatoire** : géolocalisation systématique de salariés + vérification d'identité à grande échelle relèvent quasi certainement de l'AIPD.
- **Limiter la géoloc à l'horaire de service** (lien avec le pointage `service_sessions`) et informer/consulter les représentants du personnel.
- **Minimiser la photo de preuve** : cadrer sur le strict nécessaire (colis/remise, pas la personne ni l'intérieur si évitable), flouter par défaut.

---

### 2.7 Réputation / commercial

La proposition de valeur — **« on vient encaisser du cash chez vous »** — est aussi la source du risque réputationnel : elle peut être perçue comme rassurante (inclusion des non-bancarisés) ou comme suspecte (cash à domicile, cible de fraude, image « borne qui remplace le tabac »).

> **(18/09, soir) La promesse a changé, et avec elle le procès qu'on peut nous faire.** Ce n'est plus « on vient encaisser du cash chez vous » mais **« payer sans carte bancaire, aucune donnée bancaire n'est requise »** — un bon d’achat ou un ticket acheté au comptoir d'un commerce, comme des dizaines d'autres titres vendus au même comptoir. Le risque n'est plus l'inconnu qui entre chez le client ; c'est **le commerçant qui vend mal** (voir C4, qui s'étend désormais aux partenaires du réseau de bons d’achat) et le **titre au porteur perdu ou volé**, que le client ne retrouvera pas : « le code du ticket vaut titre ».

| # | Risque détaillé | I | P | Crit. | Cotation |
|---|---|---|---|---|---|
| C2 | **Image « cash + voyage + non-bancarisé »** : association médiatique facile avec l'économie grise, même si l'activité est licite. Un article de presse hostile peut peser lourd. | 4 | 3 | **12** | Modéré |
| C4 | **Dépendance à l'image des partenaires mode** : un partenaire vendant de la contrefaçon ou peu scrupuleux rejaillit sur AJEK (vendeur officiel). | 3 | 3 | **9** | Modéré |

**(18/09, soir) Retirés — sans objet** : **C1** (confiance du cash à domicile), **C3** (faux agents usurpant la tenue) et **C5** (promesse « dans l'heure » non tenue). Plus personne ne se présente au domicile en notre nom — ce qui **supprime d'un coup** le principal vecteur d'escroquerie contre nos clients. **C2** (image « cash + voyage + non-bancarisé ») **reste** : le procès médiatique ne vise pas le moyen, il vise la clientèle. **C4** (image des partenaires) **s'élargit** : au fournisseur mode s'ajoute le **commerçant qui vend le bon d’achat**, et ce qu'il dira au comptoir engagera la marque sans que nous l'entendions.

**Dispositifs de maîtrise existants (cités)** : KYC client (payeur = bénéficiaire), reçu numéroté, code de sécurité + photo (authentifie la transaction), notation agent 1-5★ + enquête de satisfaction, CRM, tenue professionnelle identifiable, transparence publicitaire des partenaires (loi 9 juin 2023).

**Recommandations** :
- **Dispositif anti-usurpation client-facing** : moyen pour le client de **vérifier l'agent** avant d'ouvrir (photo + prénom + code de mission poussés par l'app/SMS, à comparer). C3 est un risque client direct sous-traité aujourd'hui.
- **Charte de communication proactive** anticipant le procès en « cash suspect » : mettre en avant l'inclusion financière, la traçabilité (reçu, KYC, dépôt bancaire), le plafond légal.
- **SLA interne sur les créneaux premium** et honnêteté commerciale (ne pas vendre « dans l'heure » là où la couverture ne le permet pas).

---

### 2.8 Concentration / dépendance

Le modèle dépend de **cinq à six tiers critiques**, plusieurs sans substitut immédiat. Une défaillance de l'un peut suspendre tout ou partie de l'activité.

| # | Risque détaillé | I | P | Crit. | Cotation |
|---|---|---|---|---|---|
| D0 | **Banque (compte cash)** — *risque pivot* : établissement assujetti LCB-FT face à un flux 100 % espèces. Gel/clôture (« de-risking ») **arrête tout** : dépôt, avance Duffel, paie. Aucun plan B documenté. *(**Recoté 5 × 2 = 10 le 18/09, soir** — voir A5 : il n'y a plus de flux espèces. Le compte reste un point de rupture unique, mais son motif de dé-risquage a disparu ; **le nouveau point de rupture est le prestataire, pas la banque** → §2.9, P1.)* | 5 | ~~4~~ **2** | ~~**20**~~ **10** | ~~Critique~~ Modéré |
| D1 | **Duffel** (avance sur solde) : pas de billet d'avion sans Duffel ; le solde prépayé est aussi un point de défaillance financier (F1). Substitution non triviale. | 5 | 2 | **10** | Modéré |
| D3 | **Hotelbeds** (hébergement post-payé) : perte = perte de la ligne hôtel + renégociation des conditions post-paiement. | 3 | 2 | **6** | Faible |
| D4 | **Mondial Relay** (logistique mode) : point unique d'expédition de la ligne mode. | 3 | 2 | **6** | Faible |
| D5 | **Prestataire KYC/PVID** : goulot réglementaire — si indisponible, plus de vérification → blocage de la génération de code (gate). | 3 | 3 | **9** | Modéré |
| D6 | **Fournisseurs téléphonie/SMS** (Twilio/OVH/Brevo, à arbitrer) : dépendance transactionnelle (code, check-in) mais substituable. | 2 | 3 | **6** | Faible |

**(18/09, soir) Retiré — sans objet** : **D2** (réseau de dépôt Cash Services). Il n'y a plus rien à déposer. **Deux dépendances neuves prennent sa place, et elles sont plus critiques que celle qu'elles remplacent** : **Stripe** — écrite en **P1 au §2.9**, parce qu'elles ne sont pas une variante de D2 mais le **nouveau point de rupture unique** du modèle.

**Dispositifs de maîtrise existants (cités)** : KYB fournisseurs (Duffel/Hotelbeds/mode) ; chaîne de dépôt Cash Services documentée et rapprochée ; arbitrage explicite laissé ouvert sur téléphonie/SMS (donc conscience de substituabilité) ; règle remboursement voyage indexée sur le fournisseur (limite l'exposition à leurs conditions).

**Recommandations** :
- **[ARBITRÉ 2026-08-03 — ÉCARTÉ]** ~~**Élaborer une stratégie de résilience bancaire (D0)**~~ : ouvrir des comptes chez ≥ 2 établissements, préparer un dossier de conformité proactif à remettre à la banque (origine des fonds, KYC, dépôt tracé, plafonds), et **identifier un établissement de paiement / EME de repli** habitué au cash. Documenter un **plan de continuité bancaire** dans la doc (absent aujourd'hui).
- **Plans de contingence par fournisseur critique** : identifier un substitut ou un mode dégradé pour Duffel, Cash Services, KYC/PVID (les trois « gates » du parcours).
- **Contractualiser des SLA** avec Duffel/Cash Services/PVID (disponibilité, délais) et suivre un indicateur de dépendance.

---

### 2.9 Les risques du modèle du 18/09 — **nouvelle famille (P)**

*(Ouverte le 18/09 au soir. Un pivot qui retire des risques en crée d'autres : les écrire est la contrepartie honnête des lignes retirées plus haut. Cotations selon la même échelle ; **toutes à faire valider** — avocat pour P3/P5, expert-comptable pour P4, direction pour P1/P2.)*

Le modèle ne repose plus sur des salariés et des billets, mais sur **deux titres achetés au comptoir** et **deux prestataires de paiement**. Il a troqué un risque humain et logistique contre un risque **contractuel et réglementaire** : moins d'aléa quotidien, des points de rupture plus concentrés.

| # | Risque détaillé | I | P | Crit. | Cotation |
|---|---|---|---|---|---|
| P1 | **Dépendance à un prestataire de paiement unique — le nouveau point de rupture** : deux prestataires, chacun sans substitut immédiat. **Stripe** porte le prélèvement du commerçant : s'il se retire, se coupe ou refuse le compte, **plus un seul bon d’achat n'est émis** — le réseau entier s'arrête le jour même. *(20/09 : il n'y a plus de second prestataire — la dépendance est unique, donc plus critique encore.)* Chacun peut résilier, geler les versements, imposer une réserve, ou changer ses conditions unilatéralement ; aucun des deux n'est contractualisé avec une clause de réversibilité documentée. C'est l'exacte transposition de ce que D0 était en août — un tiers dont dépend l'existence de l'activité. | 5 | 3 | **15** | Élevé |
| P2 | **Refus de prélèvement en série** : la vente d'un bon d’achat ne réussit que si la carte du commerce est débitée. Elle peut être refusée pour des motifs quotidiens (plafond de la carte du commerce atteint un samedi, carte expirée, opposition, provision) et pour un motif structurel : **une carte enregistrée sans authentification forte à l'enregistrement** (SetupIntent Stripe non confirmé) fait échouer chaque prélèvement suivant — le montage retenu le 21/09 authentifie une fois, à l'enregistrement, et prélève ensuite en paiement initié par le marchand. Un refus = aucun bon d’achat émis, un client qui repart sans rien, un commerçant qui perd la vente et l'explique mal. **En série, le réseau se décroche** : c'est le risque qui peut tuer le produit sans tuer l'entreprise. | 4 | 4 | **16** | Élevé |
| P3 | **Seuil ACPR d'1 M€ sur 12 mois (art. L521-3 II CMF)** : l'exemption de « réseau limité » qui autorise le Bon d’achat PayEnCash **n'est inconditionnelle que sous 1 000 000 € d'opérations sur les douze derniers mois**. Au-delà, une **déclaration à l'ACPR** est due (silence = approbation, actualisation annuelle). Ce seuil se franchit **mécaniquement avec le succès**, sans qu'aucun événement ne le signale : à 250 € le bon d’achat, il suffit de 4 000 bons d’achat sur l'année. Non déclaré, c'est l'exercice d'un service de paiement sans droit. **Aucun compteur glissant n'est aujourd'hui documenté côté produit.** | 5 | 3 | **15** | Élevé |
| P4 | **Sort des soldes de bons d’achat expirés** : validité 12 mois, « passé ce délai, le solde restant est perdu ». Trois questions ouvertes, aucune tranchée. ① **Consommation** : une clause de déchéance du solde est-elle opposable à un consommateur, ou abusive ? ② **Fiscal** : l'art. 256 ter CGI met la TVA **à l'utilisation** — un bon d’achat jamais utilisé n'a donc jamais été taxé ; le solde acquis à AJEK est-il un produit exceptionnel, et avec quelle TVA ? ③ **Comptable** : jusqu'à son expiration, un bon d’achat vendu est une **dette au bilan**, pas un revenu — le confondre avec du chiffre d'affaires reproduirait, en pire, l'erreur F3. | 3 | 4 | **12** | Modéré |
| P5 | **Qualification du contrat de distribution** : le commerçant vend « au nom et pour le compte d'AJEK », de façon durable, contre une commission — les trois marqueurs du statut d'**agent commercial** (art. L134-1 et s. C. com.), qui emporte notamment une **indemnité compensatrice de fin de contrat** (art. L134-12) difficile à écarter et un formalisme propre. Mandat simple ? contrat de distribution ? La qualification décide du coût de sortie du réseau et du sort de la commission ; elle se tranche **avant** de signer le premier contrat, pas après le centième. | 4 | 3 | **12** | Modéré |

**Ce qui existe déjà comme maîtrise** : le refus de prélèvement est une **ligne inscrite** avec son motif (`partner_charges` en `refused`, aucun bon d’achat créé — un refus ne peut pas produire de titre) ; l'annulation au comptoir sous 30 minutes **contre-passe** la charge plutôt que de l'effacer ; le bon d’achat **se rattache au compte client vérifié dès son premier usage** ; le relevé mensuel du commerçant est une **vue calculée**, pas un solde détenu ; les plafonds vivent dans `ref.bons` et non dans les écrans.

**Recommandations** :
- **Contractualiser la réversibilité (P1)** : exiger de chaque prestataire un préavis, un format d'export et une clause de restitution des flux en cours ; **qualifier un second prestataire** pour le prélèvement du commerçant avant d'en dépendre à l'échelle du réseau — c'est le même raisonnement que la résilience bancaire d'août, sur le tiers qui compte désormais.
- **Obtenir par écrit de Stripe l'acceptation de l'activité « cartes cadeaux » (P2)** avant le déploiement, et instrumenter le taux de refus par point comme un **indicateur de santé du réseau** (alerte manager), au même titre que le chiffre d'affaires.
- **Poser un compteur glissant 12 mois de la valeur des bons d’achat émis (P3)**, avec une alerte à 70 % du seuil et la déclaration ACPR préparée **avant** de l'atteindre. Un seuil qu'on franchit sans le voir est un seuil qu'on franchit en infraction.
- **Trancher le sort des soldes expirés (P4)** avec l'expert-comptable et l'avocat, et **le dire au client** dans les mentions plutôt que de le découvrir à la première réclamation.
- **Faire qualifier le contrat de distribution (P5)** avant la première signature ; si le statut d'agent commercial est retenu, en tirer les conséquences dans le contrat plutôt que de les subir à la rupture.

---

## 3. Matrice de risques (heatmap Impact × Probabilité) — **refaite le 18/09 (soir)**

Chaque cellule liste les identifiants de risque. Zones : **⬜ faible (1-6)** · **🟨 modéré (8-12)** · **🟧 élevé (15-19)** · **🟥 critique (20-25)**.
La matrice d'août est **remplacée** : elle plaçait en tête deux risques (D0/A5 et J8) qui ont perdu leur cause, et une quinzaine de risques retirés depuis. Les risques nouveaux (P1-P5) y figurent.

```
 IMPACT
   5 |  .        A5 · D0 · D1     A1 · A2* · F1     .            .
     |           F3 · J8          O1 · P1 · P3
     |           (Crit=10)        (Crit=15)         (Crit=20)    (Crit=25)
   4 |  .        .                A3 · O2 · J3      F5 · O3      .
     |                            J6 · C2 · P5      J5 · P2
     |                            (Crit=12)         (Crit=16)
   3 |  .        D3 · D4          F4 · F7 · A6      R4 · P4      .
     |                            R3 · R5 · C4
     |                            D5  (Crit=9)      (Crit=12)
   2 |  .        .                D6  (Crit=6)      .            .
   1 |  .        .                .                 .            .
     +----------------------------------------------------------------
         P=1        P=2              P=3               P=4         P=5
                                                          PROBABILITÉ
```

*Lecture (18/09, soir)* : **plus aucun risque n'est dans la bande critique (20-25)**, et la colonne P=5 est vide — c'est le résultat le plus net du pivot, et il vaut d'être dit. La diagonale haute se resserre sur **six risques en Crit=15-16** : **P2** (refus de prélèvement en série) et **P1/P3** (prestataire unique, seuil ACPR), qui sont neufs ; **O3** (volatilité du prix vol), **F5** (sensibilité au volume) et **J5** (rétractation 14 j), qui ne dépendaient pas du mode d'encaissement et **traversent le pivot intacts** ; **F1, A1, O1** juste derrière. *(A2\* : l'intensité cash n'est plus chez AJEK mais chez le commerçant partenaire, pour son propre compte — la ligne est conservée pour mémoire du schéma de blanchiment, pas comme exposition directe. D0/A5/J8 : recotés, voir leur ligne.)*

---

## 4. TOP 10 des risques critiques (classés) — **refait le 18/09 (soir)**

*Le classement d'août est remplacé : sept de ses dix lignes ont perdu leur objet (D0/A5 recoté, J8 tranché, O4 et S1 supprimés avec l'agent, J1 idem, A2 déplacé chez le commerçant).*

| Rang | ID | Risque | I | P | **Crit.** | Pourquoi en tête |
|---|---|---|---|---|---|---|
| **1** | **P2** | **Refus de prélèvement en série** *(nouveau)* | 4 | 4 | **16** | C'est le seul risque qui peut arrêter les ventes **tous les jours, point par point**, sans prévenir : pas de débit accepté, pas de bon d’achat. Aggravé par une exemption DSP2 non confirmée. |
| **2** | O3 | **Volatilité prix vol / offre expirante** | 4 | 4 | **16** | Traverse le pivot intact : l'offre Duffel expire quel que soit le moyen de paiement. Volume élevé → probabilité quasi-certaine. |
| **3** | F5 | **Sensibilité au volume / seuil de rentabilité** | 4 | 4 | **16** | Les coûts fixes salariaux baissent fortement avec l'agent, mais la marge unitaire reste mince et se partage désormais avec **deux prestataires** (1,10 % au commerçant, 1,5 % + 0,25 € à Stripe). **À rechiffrer.** |
| **4** | J5 | **Rétractation 14 j (mode)** | 4 | 4 | **16** | Obligation d'ordre public. Le circuit existe enfin (re-crédit du bon d’achat), mais son **équivalence au « même moyen de paiement »** reste à valider — voir J8. |
| **5** | **P1** | **Dépendance à un prestataire de paiement unique** *(nouveau)* | 5 | 3 | **15** | Le point de rupture unique d'août a changé d'adresse : ce n'est plus la banque, c'est Stripe. Aucune réversibilité contractualisée. |
| **6** | **P3** | **Seuil ACPR d'1 M€ / 12 mois** *(nouveau)* | 5 | 3 | **15** | Se franchit **avec le succès**, sans signal. Non déclaré = service de paiement exercé sans droit, c'est-à-dire la faute que tout le pivot du 17/09 cherchait à éviter. |
| **7** | A1 | **Requalification en assujetti LCB-FT** | 5 | 3 | **15** | Inchangé : ne dépendait pas du mode d'encaissement. Un titre au porteur jusqu'à son premier usage n'aide pas la démonstration. |
| **8** | F1 | **Fonds de roulement / avance Duffel** | 5 | 3 | **15** | Inchangé dans son principe, **nouveau dans son calendrier** : un bon d’achat vendu aujourd'hui peut être dépensé dans onze mois. |
| **9** | O1 | **Échec de réservation après encaissement** | 5 | 3 | **15** | Reste, mais **cesse d'être toxique** : le remboursement re-crédite le bon d’achat au lieu d'exiger une remise d'espèces. |
| **10** | A2 | **Intensité cash = vecteur de blanchiment** | 5 | 3 | **15** | Conservé **pour mémoire** : le schéma existe toujours, mais l'exposition est passée au commerçant, qui encaisse pour son propre compte. À relire avec l'avocat LCB-FT. |

*Suivent de près (Crit=12) : A3 (fractionnement), O2 (panne fournisseur), J3 (système de caisse — à rouvrir), J6 (contrefaçon mode), R4 (rétention RGPD), C2 (image), **P4** (soldes expirés), **P5** (qualification du contrat de distribution).*

---

## 5. Recommandations priorisées

### 5.1 Quick wins (rapides, fort effet, faible coût)

> **(18/09, soir) Cinq des sept quick wins d'août sont retirés — sans objet** : le bouton SOS et la procédure d'agression (1), la vérification de l'agent par le client (2), la minimisation des photos de preuve (3, sa moitié « photos »), le scoring anti-guet-apens (5) et la limitation de la géolocalisation à l'horaire de service (6) supposaient tous un agent qui se déplace. Deux survivent, reformulés, et **trois neufs** les remplacent.

1. **Politique de rétention chiffrée** (KYC, appels, logs, données du commerce partenaire) — comble le trou RGPD R4, désormais le point faible principal de la famille.
2. **Provisionnement séparé** TVA collectée / dette Hotelbeds / remboursements dans le compte de résultat — corrige F3/F4 par une règle de gestion. **À étendre aux bons d’achat vendus non encore dépensés** : c'est une dette, pas un produit (P4).
3. **(nouveau)** **Compteur glissant 12 mois de la valeur des bons d’achat émis**, avec alerte manager à 70 % du million — rend P3 visible avant d'être franchi.
4. **(nouveau)** **Taux de refus de prélèvement par point**, affiché au manager comme un indicateur de santé du réseau — rend P2 mesurable, et distingue une carte expirée d'un problème général.
5. **(nouveau)** **Indicateur de couverture trésorerie**, refait sur les bonnes grandeurs : solde Duffel disponible ÷ (engagements en cours + encours de bons d’achat non dépensés) — remplace l'indicateur d'août, qui divisait par un encours de cash qui n'existe plus.

### 5.2 Structurel (fondamental, préalable au lancement)

1. **[ARBITRÉ 2026-08-03 — ÉCARTÉ]** ~~**Stratégie de résilience bancaire (D0)** : ≥ 2 banques + EME de repli + dossier de conformité proactif + plan de continuité.~~ — ⚠️ **Recommandation ÉCARTÉE par la fondatrice le 2026-08-03** (registre §3 bis A). Le constat d'audit est conservé tel quel : un auditeur ne retire pas une observation parce qu'on choisit de ne pas la suivre. Mais ce n'est plus une action ouverte.
2. **Avis juridique LCB-FT écrit et socle « assujetti-ready »** (A1/A2) : concevoir la vigilance comme si assujetti, quel que soit le verdict.
3. **Trancher et câbler le mécanisme de remboursement (J8/J5/O1)** : avoir/bon d'achat + remboursement encadré au point de collecte + virement optionnel.
4. **Modèle de trésorerie à 13 semaines avec stress-tests** et réserve minimale de fonds de roulement Duffel (F1/F5).
5. ~~**DUERP + polices d'assurance effectivement souscrites avant le 1er encaissement** (S1/S3/faute inexcusable).~~ — **(18/09, soir) SANS OBJET** : le poste est supprimé. Reste l'obligation générale de DUERP tant qu'AJEK emploie quelqu'un, sur un travail désormais sédentaire (§2.4).
6. ~~**Fixer la convention collective + accord travail de nuit**~~ — **(18/09, soir) SANS OBJET** (J1/J2). En revanche, **rouvrir la question du système de caisse certifié (J3)** auprès de l'expert-comptable dans le modèle sans espèces : elle n'est ni résolue ni éteinte.
7. **Plans de contingence des « gates »** : Duffel et KYC-PVID (D1/D5) — et surtout **Stripe (P1)**, qui ont remplacé Cash Services (D2) comme point de rupture unique, en plus critique.
8. **(nouveau — 18/09, soir) Trancher les trois questions juridiques du Bon d’achat PayEnCash avant le premier contrat signé** : déclaration ACPR au-delà d'1 M€/12 mois (P3), sort des soldes expirés (P4), qualification du contrat de distribution et statut d'agent commercial (P5). Ce sont les trois seuls points qui peuvent rendre le nouveau modèle illicite ou coûteux à défaire — exactement le rôle que tenaient LCB-FT et remboursement cash dans la version d'août.

### 5.3 À ajouter ou clarifier dans la documentation (lacunes documentaires)

La documentation est riche mais **cinq zones critiques n'y sont pas traitées** — à intégrer en priorité :

1. **[ARBITRÉ 2026-08-03 — ÉCARTÉ]** ~~**Plan de continuité et de résilience bancaire** : absent.~~ Le constat reste exact — il n'existe aucun plan B bancaire — mais **la fondatrice a arbitré de ne pas en ouvrir un** (registre §3 bis A). Aucune note dédiée n'est à créer, aucune section dans `docs/08-mecanisme-financier`.
2. **Dimensionnement chiffré du fonds de roulement et politique de provisionnement** : `docs/08` décrit le *principe* du cash cycle mais pas le *coussin* (réserve Duffel, scénarios de stress, provisions TVA/Hotelbeds/remboursements). → Ajouter un modèle de trésorerie et des règles de provision.
3. **Décision et circuit de remboursement du client non bancarisé (J8)** : explicitement marqué « DÉCISION REQUISE » dans plusieurs notes et laissé en suspens dans `docs/07` et `11`. C'est un prérequis légal (rétractation) — à trancher et documenter, pas à reporter. *(Annotation 2026-08-04 : **tranché le 2026-08-03** — avoir proposé + remise en espèces au point d'encaissement de droit, virement et course de retour écartés ; l'appareil de preuve a été porté au Doc 7, au Doc 2 et au Doc 3 &sect;4 bis/ter. Registre §3 bis B.)*

> ✅ **ARBITRÉ LE 2026-08-03, RÉVISÉ LE 2026-09-17.** L'arbitrage d'août (« remise en espèces au point d'encaissement, de droit ») est **caduc** : il n'y a plus de point. Le remboursement suit le moyen qui a payé — re-crédit du bon ; à défaut : avoir, virement, ou espèces remises par l'agent sur décision du manager (voyage seulement). Voir `ESPACE-COMMERCANT/documents/partie-4-flux.html`, F10. (table `refunds`, un seul canal) ; `collections.is_return` n'a plus de mécanisme derrière lui. Voir §3 bis B du registre de décisions. ⚠️ Reste ouvert : *comment atteste-t-on la remise ?*

4. **Registre des traitements RGPD + politique de rétention** : la doc liste les tables sensibles sans durées ni base légale consolidée. → Ajouter une note RGPD opérationnelle (au-delà de `05-securite-confiance`). *(18/09, soir : l'**AIPD** n'est plus quasi certaine — la géolocalisation de salariés et les photos au domicile, qui la déclenchaient, ont disparu. Le registre et les durées, eux, restent dus.)*
5. ~~**Traitement du risque de sécurité physique comme livrable**~~ — **(18/09, soir) SANS OBJET** : plus de poste exposé, plus de procédure d'agression, plus de police « vol d'espèces sur la personne » à souscrire. Les deux notes du dossier (`DUERP-AGENT-CAISSE-MOBILE.md`, `AGENT-CAISSE-MOBILE-RH.md`) ont été supprimées du dépôt.
6. **(nouveau — 18/09, soir) Le dossier du Bon d’achat PayEnCash n'a pas encore sa note de risques** : compteur ACPR, soldes expirés, qualification du contrat, réversibilité des prestataires, taux de refus. Le §2.9 en tient lieu aujourd'hui ; il devra devenir un chantier suivi, pas une section d'audit.

*Points secondaires à clarifier également* : harmonisation nommage PayEnCash/AJEK, arbitrage prix garanti/re-fetch (O3). *(18/09, soir : le seuil de dépôt 400 €/800 € et la frontière du transport de fonds n'ont plus d'objet.)*

---

> **Mot de la fin (posture d'auditeur)** : AJEK a fait un travail de cadrage remarquablement lucide — la densité de marqueurs « à confirmer / à trancher » prouve que l'équipe *voit* ses risques. Le danger n'est pas l'aveuglement, c'est le **report** : plusieurs de ces points « non bloquants pour l'édition » sont en réalité **bloquants pour le lancement** (LCB-FT, remboursement cash, DUERP/assurances, convention collective ; la **résilience bancaire** a depuis été **écartée** — registre §3 bis A). Le modèle est viable à condition de traiter d'abord ses points de rupture uniques ; il devient dangereux si on optimise le nominal en laissant les extrêmes ouverts.
>
> **Post-scriptum du 18/09 (soir).** Le pivot est, du point de vue du risque, **un très bon pivot** : il ne mitige pas les deux risques les plus lourds d'août, il les **supprime à la source** en supprimant l'activité qui les produisait — un salarié ne porte plus d'espèces, un compte n'est plus alimenté en billets. Plus aucun risque n'est coté critique, et le remboursement, bloqué depuis août, est enfin tranché. Ce serait mal le lire que d'en conclure que le dossier de risques s'allège : il s'est **déplacé**. Cinq risques neufs (§2.9) le disent, et trois d'entre eux sont **juridiques et se tranchent avant la première signature**, pas après. La leçon d'août vaut encore mot pour mot : le danger n'est pas l'aveuglement, c'est le report.
