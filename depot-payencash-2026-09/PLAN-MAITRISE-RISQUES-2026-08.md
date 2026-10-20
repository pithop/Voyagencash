# Plan de maîtrise des risques — améliorations post-analyse
### AJEK SASU / PayEnCash

> Réponse concrète aux risques identifiés dans **`ANALYSE-RISQUES-CRITIQUE.md`**. Traite en priorité ce que l'analyse qualifie de **bloquant pour le lancement** (et non « non bloquant pour l'édition »). Points juridiques/financiers **à valider** (avocat, expert-comptable, assureur).
> **⚠️ Bandeau d'annotation — 2026-08-04.** Ce plan est daté ; son texte n'est pas réécrit. Trois de ses recommandations ont été **tranchées ou écartées depuis** par le registre de décisions (§3 bis) :
> - **§1 Continuité bancaire** — la **résilience bancaire est ÉCARTÉE** (registre §3 bis A). Multi-bancarisation, EME de repli et indicateur « couverture bancaire » ne sont **pas des chantiers**.
> - **Le virement** cité aux §3 (point 3), §31 (option 3) et dans le tableau de synthèse est **écarté** (clients non bancarisés, registre §3 bis B). Le canal est : avoir + remise en espèces au point d'encaissement.
> - **§6 — le re-fetch à la collecte est écarté** : le prix est **garanti** pour toutes les tranches (registre §3 bis C), pas seulement le créneau premium.
> - Renvoi cassé : `NOTE-BANQUE-AJEK-v12.md` (§1) n'existe pas ; le fichier réel est `NOTE-BANQUE-AJEK-v14.md`. *(18/09, soir : corrigé dans le corps du §1.)*
>
> **⚠️ Bandeau du 2026-09-18 (soir) — le plan a perdu la moitié de son objet, et c'est une bonne nouvelle.** L'**agent de caisse mobile est supprimé** : plus de salarié porteur de fonds, plus de course, plus de dépôt en automate, plus de fond de caisse. Il reste **deux moyens de paiement**, achetés au comptoir d'un commerce — le **Bon d’achat PayEnCash** (réseau de commerçants sous contrat, art. L521-3 CMF) et le **Bon d’achat PayEnCash**  — et, côté commerçant, **plus de reversement mensuel** : sa carte bancaire enregistrée est **prélevée à chaque vente**, du montant moins sa commission, via **Stripe**. Conséquences sur ce plan, section par section : **§1** garde son arbitrage mais perd son motif (le compte n'est plus alimenté en espèces) ; **§3 est RÉSOLU** (un remboursement re-crédite le bon d’achat) ; **§4** se réduit fortement (ni géolocalisation, ni photo au domicile) ; **§5 est SANS OBJET**, sauf un noyau social qu'on ne veut pas perdre (voir la section) ; **§6 et §7** restent, §7 à rechiffrer. Les **cinq risques neufs** du modèle (prestataire unique, refus de prélèvement, seuil ACPR d'1 M€, soldes expirés, qualification du contrat) sont écrits au **§2.9 de `ANALYSE-RISQUES-CRITIQUE.md`** et appellent leur propre plan — voir le **§8** ajouté en fin de document.



## 1. Continuité bancaire — ~~risque n°1 (criticité 20/25)~~ **recoté 10/25 le 18/09 (soir)**

Le compte bancaire est le **point de rupture unique** : sans lui, plus de dépôt, plus d'avance Duffel, plus de paie. Plan :

> **(18/09, soir)** Le compte reste nécessaire, mais **le motif de dé-risquage a disparu** : il n'est plus alimenté en espèces, il reçoit **deux virements de prestataires identifiés et contractualisés**. Le point de rupture unique du modèle n'est plus la banque — **c'est le prestataire** (§8.1).

- **Multi-bancarisation** : ouvrir **≥ 2 comptes** (banque principale + banque de secours), et évaluer un **établissement de monnaie électronique (EME)** de repli.
- **Dossier de conformité proactif** remis à chaque partenaire : `NOTE-BANQUE-AJEK-v14.md`, dispositif KYC/plafonds, **volumes annoncés à l'avance** (déjà prévu §7 note banque). *(18/09, soir : le renvoi au `DUERP` et au « cycle de dépôt » est retiré — le document n'existe plus et il n'y a plus de dépôt. La note bancaire elle-même est à **réécrire de fond en comble** avant tout envoi : elle demande un compte pour recevoir des remises d'espèces, ce qu'AJEK ne fera plus.)*
- ~~**Diversification du dépôt** : Cash Services + une solution de repli identifiée.~~ — **(18/09, soir) SANS OBJET** : il n'y a plus rien à déposer. Le sujet équivalent est désormais la **diversification du prestataire de paiement** (§8.1).
- **Réserve de trésorerie** couvrant **plusieurs semaines** d'exploitation en cas de gel temporaire.
- Écran manager : indicateur **« couverture bancaire »** + alerte.

## 2. Fonds de roulement — dimensionnement & provisionnement (criticité 16/25) → à ajouter dans `docs/08`

- **Réserve Duffel** = solde prépayé ≥ **pic d'engagements Phase 5** sur la fenêtre de rapprochement (encaissement → `on_account`). Formule + **stress-tests** : volume ×2, retard du rapport +1 j, taux d'échec fournisseur. *(18/09, soir : la fenêtre n'est plus logistique mais **contractuelle** — délai de versement du prestataire, et surtout **durée de vie d'un bon d’achat** : vendu aujourd'hui, il peut être dépensé dans onze mois. Stress-tests à refaire sur ces grandeurs.)*
- **Provisions** distinctes : **TVA collectée** (dette État), **dette Hotelbeds** (réglée immédiatement — provision intra-journée), **remboursements**, et **(18/09, soir)** les **bons d’achat vendus non encore dépensés** — c'est une **dette au bilan**, jamais un produit tant que le bon d’achat n'est pas utilisé (art. 256 ter CGI : la TVA est due à l'utilisation).
- **Seuil d'alerte** de solde Duffel bas (déjà partiel) + indicateur de couverture (solde vs engagements en cours).
- Coussin = f(volume, délai de rapprochement, taux d'échec).

## 3. Remboursement du client non bancarisé — ~~circuit recommandé~~ **RÉSOLU le 18/09 (soir)**

> **(18/09, soir)** Le point qui bloquait le lancement depuis août **est tranché, et par la structure du produit plutôt que par une procédure** : le client paie avec un **Bon d’achat PayEnCash** ou un **Bon d’achat PayEnCash**, donc un remboursement **re-crédite le bon d’achat** (`rembourser(ref, {mode:'bon'})`) ou passe par un **virement au RIB du client**. Il n'y a plus de remise d'espèces à organiser, plus de point où venir la chercher, plus de question « comment atteste-t-on la remise ? ». **Un seul résidu, à valider par l'avocat** : un avoir re-crédité vaut-il remboursement au sens de la **rétractation légale de 14 jours**, qui impose le même moyen de paiement que celui utilisé à l'achat ? Le circuit d'août ci-dessous est conservé comme trace de ce qui avait été envisagé — **il ne doit plus être mis en œuvre** (il n'y a ni point de collecte, ni agent).

Le client n'a pas de compte → virement pas toujours possible ; la « course de retour cash » est exclue par principe (l'agent n'encaisse que). **Le modèle §17 (point de collecte) résout le problème.** Circuit recommandé :

1. **Avoir / bon d'achat** utilisable sur une prochaine commande (immédiat, par défaut) ;
2. **Remboursement en espèces au POINT DE COLLECTE** — le client vient récupérer son cash (utilise l'infrastructure existante, **sans exposer un agent en course de retour**) ;
3. **Virement** en option, si le client fournit un IBAN.

- **Rétractation mode 14 j** (ordre public) : honorée via (1)/(2)/(3).
- **Voyage** : selon cancellation policies ; **NON REMBOURSÉ** affiché si le fournisseur ne rembourse pas ; si un remboursement est dû, même circuit.
- → **Action** : trancher `docs/07` et `11` — remplacer « course de retour cash » par ce circuit. **Décision fondatrice à confirmer**, mais la solution par défaut est prête.
- Données : le remboursement est une remise en espèces au point d'encaissement (table `refunds`, un seul canal ; l'avoir a été retiré le 2026-08-04), `refunds` (montant, mode, statut, point de collecte, **et appareil de preuve : code de remise, photo du reçu numéroté, agent, horodatage** — voir `MODELE-DONNEES-COMPLEMENT` §2.13).

## 4. RGPD — registre + AIPD + rétention chiffrée (criticité RGPD)

- **Registre des traitements** (art. 30) : clients, voyageurs, ~~géolocalisation des agents~~, ~~photos de preuve~~, **KYC**, **appels** — et, depuis le 18/09 : le **rattachement d'un bon d’achat au compte** qui l'utilise, et les **données du commerce partenaire** (gérant, pièces KYB ; l'empreinte de carte reste chez le prestataire, jamais le numéro chez nous).
- ~~**AIPD** obligatoire pour la géolocalisation et les photos~~ — **(18/09, soir)** ces deux traitements **n'existent plus** ; l'AIPD n'est donc plus quasi certaine. À réexaminer sur le seul KYC à grande échelle.
- **Politique de rétention chiffrée** avec **purge automatique** : ~~photos de preuve~~, ~~géoloc live~~, KYC (**résultat seul**, pas les pièces), appels (ex. 6-12 mois), journal des mouvements de bons d’achat. **C'est désormais le point faible principal de la famille RGPD.**
- **Base légale par traitement** : exécution du contrat / obligation légale / intérêt légitime.

## 5. ~~Sécurité physique opérationnelle~~ — **SANS OBJET depuis le 18/09 (soir)**, sauf le noyau social ci-dessous

Le bouton SOS, la procédure d'agression, les polices « vol d'espèces sur la personne » / « auto mission » / « faute inexcusable », l'anti-guet-apens et l'anti-usurpation **n'ont plus d'objet** : plus personne ne se déplace avec de l'argent au nom d'AJEK. Le risque n'a pas été couvert, il a été **supprimé à la source** en supprimant l'activité — c'est la première des mesures de prévention de l'art. L4121-2 du code du travail, « éviter les risques ». Les deux notes qui portaient ce dossier (`DUERP-AGENT-CAISSE-MOBILE.md`, `AGENT-CAISSE-MOBILE-RH.md`) ont été **supprimées du dépôt**.

> **Le noyau social qui survit — recueilli ici parce qu'il n'existe nulle part ailleurs** *(à valider par un juriste social + l'expert-comptable ; ce ne sont pas des avis professionnels)* :
> - **Le DUERP reste dû tant qu'AJEK emploie quelqu'un** — l'obligation tient au fait d'avoir des salariés, pas au poste évalué (art. **L4121-1**, **L4121-2**, **R4121-1 à R4121-4** C. trav.). Il se met à jour **au moins une fois par an** et à **chaque décision d'aménagement** modifiant les conditions de santé, sécurité ou travail : **la suppression du poste d'agent en est une**, et elle appelle donc une mise à jour, pas seulement une suppression. Tenu à disposition des salariés, du CSE, du médecin du travail et de l'inspection du travail ; **versions successives conservées 40 ans** ; absence ou défaut de mise à jour **sanctionné pénalement** et aggravant la responsabilité de l'employeur. L'évaluation à refaire porte sur un travail **sédentaire** (écrans, sédentarité, charge mentale du support client).
> - **Visite d'information et de prévention (VIP)** auprès du service de santé au travail, dans le délai légal après toute embauche.
> - **Règlement intérieur** obligatoire à partir de **50 salariés**, facultatif mais recommandé en dessous.
> - **Prime de partage de la valeur (PPV)** — le seul levier de rémunération complémentaire qui reste applicable : **3 000 €/an/salarié** (6 000 € avec intéressement ou participation), exonération de cotisations **pérenne** dans cette limite, exonération **totale** (cotisations + CSG/CRDS + impôt) réservée aux salariés < 3 SMIC des entreprises < 50 salariés et **seulement jusqu'au 31/12/2026**. ⚠️ **Piège RGDU** depuis le 01/01/2026 : la PPV entre dans l'assiette de la réduction générale des cotisations patronales — sur un bas salaire, la verser **réduit** cette réduction et neutralise une partie du gain. **À chiffrer avec l'expert-comptable.**
> - **Interdit, quel que soit le modèle** : une prime indexée sur le **nombre** ou le **montant** des ventes versée à un salarié est du **salaire déguisé** → requalification et redressement URSSAF. La PPV ne peut se moduler que sur des critères légaux (rémunération, classification, ancienneté, présence effective, durée contractuelle).
>
> *(Ces cinq points étaient les seules parties encore vraies des notes RH supprimées ; ils sont recueillis ici plutôt que perdus. Les pourboires, la prime qualité liée à la notation, le travail de nuit et la convention collective de terrain sont, eux, sans objet : ils supposaient un salarié en contact avec la clientèle.)*

## 6. Volatilité du prix vol × créneau différé (criticité 16/25) → décision pricing

- **Recommandation** : pour un créneau **différé**, **re-fetch au moment de la collecte** avec la **marge de sécurité** qui absorbe la dérive usuelle ; le créneau **« dans l'heure » (premium)** garantit le prix. **Afficher au client** qu'un créneau lointain peut être ajusté.

## 7. Rentabilité / sensibilité au volume (criticité 16/25)

- ~~Piloter le point mort via le volume/agent, la part de l'option B et le remplissage des créneaux de collecte.~~
- **(18/09, soir) À rechiffrer entièrement** : le coût variable par commande n'est plus un salaire d'agent mais **deux commissions** — **1,10 % HT** au commerçant qui vend le bon d’achat et **1,5 % + 0,25 €** au prestataire qui le prélève (`ref.bons`, tarifs relevés le 18/09). Le point mort baisse fortement (les coûts fixes salariaux de terrain disparaissent) mais la **marge unitaire se partage désormais avec deux tiers à chaque vente**. Piloter via le **compte de résultat** (NOUVELLES §15) : mix **Voyage/Mode**, valeur moyenne d'un bon d’achat, et **taux de bons d’achat non dépensés** (qui gonfle la trésorerie sans être un produit — voir P4).

---

## Synthèse — ce qui devient prioritaire pour le lancement

| Risque | Criticité | Traitement |
|---|---|---|
| ~~Clôture/gel du compte bancaire~~ | ~~20~~ **10** | *(18/09, soir)* Recoté : le compte n'est plus alimenté en espèces (§1 — arbitrage inchangé, motif disparu) |
| ~~Remboursement client non bancarisé~~ | ~~20~~ **10** | **RÉSOLU** *(18/09, soir)* : le remboursement re-crédite le bon d’achat (§3). Résidu : équivalence avec la rétractation 14 j, à valider |
| Fonds de roulement / avance Duffel | 16 | Dimensionnement + provisions + stress-tests (§2) — **+ la dette des bons d’achat vendus non dépensés** |
| Volatilité prix vol × créneau | 16 | Re-fetch + marge sécurité, premium garanti (§6) — **inchangé, traverse le pivot** |
| Rentabilité / volume | 16 | Pilotage point mort (§7) — **à rechiffrer sur les deux nouvelles commissions** |
| RGPD (KYC, appels, bons d’achat, partenaires) | — | Registre + rétention (§4) ; AIPD à réexaminer |
| ~~Sécurité agents~~ | — | **SANS OBJET** *(18/09, soir)* — poste supprimé ; reste le noyau social du §5 |
| **Refus de prélèvement en série** *(nouveau)* | **16** | Obtenir l'acceptation écrite de Stripe (activité « cartes cadeaux ») + taux de refus par point (§8) |
| **Prestataire de paiement unique** *(nouveau)* | **15** | Réversibilité contractuelle + second prestataire qualifié (§8) |
| **Seuil ACPR 1 M€ / 12 mois** *(nouveau)* | **15** | Compteur glissant + alerte à 70 % + déclaration préparée (§8) |
| **Soldes de bons d’achat expirés** *(nouveau)* | **12** | Clause, TVA et traitement comptable à trancher (§8) |
| **Qualification du contrat de distribution** *(nouveau)* | **12** | Mandat ou agent commercial ? À trancher avant la 1re signature (§8) |

> Ces points étaient marqués « non bloquants pour l'édition » ; ils sont **bloquants pour le lancement**. Traités ici en priorité, avec une solution par défaut prête pour chacun — les décisions business/juridiques restant à confirmer sont explicitement signalées.

---

## 8. **(18/09, soir) Les cinq chantiers du Bon d’achat PayEnCash**

*Contrepartie honnête des sections qui viennent de perdre leur objet : le pivot retire des risques, il en crée d'autres. Détail et cotation au **§2.9 de `ANALYSE-RISQUES-CRITIQUE.md`**.*

| # | Chantier | Ce qu'il faut faire | Qui valide | Avant quand |
|---|---|---|---|---|
| 8.1 | **Prestataire unique (P1)** | Clause de réversibilité (préavis, export, restitution des flux en cours) chez Stripe ; qualifier un **second prestataire** de prélèvement avant d'y adosser tout le réseau | Direction + avocat | Avant le déploiement du réseau |
| 8.2 | **Refus de prélèvement (P2)** | Confirmation **écrite** de Stripe sur l'acceptation de l'activité « cartes cadeaux » (l'authentification forte est faite une fois, à l'enregistrement de la carte — SetupIntent) ; **taux de refus par point** en indicateur manager, avec alerte | Stripe + produit | Avant la 1re vente réelle |
| 8.3 | **Seuil ACPR 1 M€ / 12 mois (P3)** | **Compteur glissant** de la valeur des bons d’achat émis, alerte à 70 %, déclaration ACPR rédigée d'avance (art. L521-3 II CMF : silence = approbation, actualisation annuelle) | Avocat | Avant d'atteindre 700 000 € |
| 8.4 | **Soldes expirés (P4)** | Trancher : opposabilité de la déchéance à 12 mois, TVA du solde acquis (art. 256 ter CGI : la TVA est due à l'**utilisation**), et comptabilisation en **dette** tant que le bon d’achat n'est pas dépensé | Expert-comptable + avocat | Avant la 1re clôture |
| 8.5 | **Contrat de distribution (P5)** | Qualifier : mandat, distribution, ou **agent commercial** (art. L134-1 et s. C. com. — indemnité de fin de contrat, art. L134-12) ; en tirer les conséquences dans le contrat | Avocat | **Avant la 1re signature** |
