# Mise à jour de la documentation — Août 2026
### PayEnCash / AJEK SASU

> **⚠️ Pivot du 2026-09-18 (soir) — lire d'abord ; remplace le bandeau du 17/09, qui disait encore le contraire.** **Six des sept décisions verrouillées d'août sont sans objet.** L'**agent de caisse mobile est supprimé** : la décision 1 (agents salariés uniquement), la décision 2 (seuil de dépôt 400 €), la décision 3 (réseau Cash Services et cartes nominatives), la décision 4 (double poste encaissement + dépôt) et la décision 6 (plafond de 1 000 € d'espèces) **n'ont plus d'objet** — il n'y a plus d'agent, plus d'espèces reçues par AJEK, plus de dépôt, plus d'encours. Tout le **§B** (le cycle du double poste, les états `collected → declared → reconciled → on_account`) est caduc. **Restent vraies** : la décision 5 (AJEK non assujettie LCB-FT, **toujours à confirmer**) et la décision 7 (ligne Mode en note séparée), ainsi que tout le **§C** (KYB fournisseurs, KYC client gradué).
>
> **Ce qui les remplace** : deux moyens de paiement, achetés au comptoir d'un commerce — le **Bon d’achat PayEnCash** (notre réseau de commerçants sous contrat, art. L521-3 CMF) et le **Bon d’achat PayEnCash**  ; et, côté commerçant, **plus de reversement mensuel** — sa carte bancaire enregistrée est **prélevée à chaque vente**, du montant moins sa commission (1,10 % HT + TVA), via **Stripe** (1,5 % + 0,25 €) ; un refus de la banque = aucun bon d’achat émis. Référence : `ESPACE-COMMERCANT/documents/partie-4-flux.html` et `CLAUDE.md`.
>
> **⚠️ Le §D (« changements document par document ») est périmé** : il désigne `ui/agent/`, `ui/manager/05-agents`, `ui/manager/15-agent-remuneration` et `REFONTE-AGENT-2026/00-PREPARATION-CHANGEMENTS.md`, qui **n'existent plus** — ne pas s'en servir comme feuille de route. Le relevé à jour des écrans est `docs/INVENTAIRE-MAQUETTE.md` (133 écrans au 18/09).
>
> **Source de vérité** : *Note de modèle d'affaires AJEK SASU v11 (août 2026)* + arbitrages de la fondatrice (2026-08-02).
> **Statut** : proposition à valider avant application aux fichiers. Aucune modification n'a encore été apportée au code des documents.
> **Portée** : ce document recense les décisions verrouillées, les changements document par document, et les points à confirmer. Une fois validé, il sert de feuille de route pour éditer les fichiers HTML.

---

## A. Décisions verrouillées (font foi sur toute la doc)

| # | Décision | Ce qui change | Remplace |
|---|----------|---------------|----------|
| **1** | **Agents = SALARIÉS uniquement** | Suppression totale du statut micro-entrepreneur : auto-facturation, factures agent, mandat d'auto-facturation, TVA franchise/293 B, `employment_type`, `agent_invoices`, `self_billing_mandate_at`. | Annule la « révision D11 » du 31/07 qui avait ajouté les micro-entrepreneurs. |
| **2** | **Seuil de dépôt cash = 400 €** | Dès que l'encours d'un agent **dépasse 400 €**, dépôt immédiat obligatoire (course de dépôt). En dessous, il peut enchaîner les encaissements. Tout encaissement unique > 400 € → dépôt immédiat en fin de course. | Annule la règle « tout encours positif → retiré du dispatch » (D15) **et** le seuil de 800 € de la note AJEK. |
| **3** | **Réseau de dépôt = Cash Services** | Automates Cash Services + **cartes de dépôt nominatives** (une par salarié habilité, désactivée au départ). **Recherche géolocalisée** de l'automate le plus proche dans l'app agent. | Remplace « Illicode / La Banque Postale » (72 mentions, 16 fichiers). |
| **4** | **Agent = double poste** | **Encaissement** (collecte cash au domicile, code sécurité + photo — aucune marchandise transportée) **ET dépôt** (dépôt en automate Cash Services). | Précise/clarifie le rôle du « agent ». |
| **5** | **AML : AJEK NON assujettie LCB-FT** | La conformité AML n'est **pas portée** au sens des obligations de vigilance LCB-FT. On intègre à la place : **KYB fournisseurs** + **KYC client gradué par volume** (cadre = prévention fraude / due diligence commerciale). **⚠️ Statut d'assujettissement à confirmer par avis juridique.** | Annule la décision D6 « nous portons la conformité AML/KYC ». |
| **6** | **Plafond paiement espèces = 1 000 €/transaction** | Résidents fiscaux FR (art. L112-6 / D112-3 CMF) + **anti-fractionnement**. Figé sur la commande à la génération du code. *(17/09 : ne concerne que les espèces remises à l'agent ; au-delà, complément carte sur son terminal ; le bon d’achat n'est pas concerné.)* | Remplace le reliquat Paysafecash 500 € laissé « à déterminer ». |
| **7** | **Ligne MODE = note séparée** | Documentée dans l'Étape 4 · flux F11/F12 (`ESPACE-COMMERCANT/documents/partie-4-flux.html`), **non fusionnée** dans la doc technique voyage pour l'instant (fusion trop coûteuse). | Comble l'absence totale de la ligne mode dans la doc. |

---

## B. Le double poste de l'agent — cycle détaillé (décisions 2 + 3 + 4)

**Encaissement (par course de collecte) :**
1. L'agent reçoit une course (dispatch selon zone/distance, priorité distance).
2. Il se rend au domicile, vérifie le **code de sécurité** avec le client, prend une **photo** de preuve.
3. Il encaisse le montant exact en espèces → statut commande `CASH_COLLECTED` puis `PAID`.
4. La validation déclenche le paiement fournisseur (Duffel temps réel / Hotelbeds post-payé).
5. Son encours `cash_on_hand_cents` augmente du montant encaissé.

**Règle de dépôt (nouveau seuil 400 €) :**
- Après chaque encaissement, le système compare l'encours cumulé au seuil **400 € (40 000 centimes)**.
- **Encours ≤ 400 €** → l'agent reste dans le dispatch, il peut prendre une autre course de collecte.
- **Encours > 400 €** (ou un encaissement unique > 400 €) → **course de dépôt obligatoire déclenchée** ; l'agent est **retiré des nouvelles courses de collecte** jusqu'au dépôt déclaré.

**Dépôt (course de dépôt) :**
1. **Recherche géolocalisée** de l'automate Cash Services le plus proche de la position de l'agent.
2. Dépôt avec sa **carte nominative** → reçu numéroté.
3. Déclaration du dépôt dans l'app agent.

**États du cash** (inchangés dans le principe, seule la source « rapport » change de banque) :
`collected → declared → reconciled → on_account`
- Seul l'état confirmé par le **rapport quotidien Cash Services** (rapproché ligne à ligne, par porteur/carte nominative) vaut preuve de réception.
- Aucun décaissement (salaires, provision TVA) ne porte sur du `declared` non confirmé.

> **À vérifier à l'implémentation** : le seuil doit rester **paramétrable** dans l'espace manager (comme le plafond de paiement), figé sur la logique en cours, jamais codé en dur.

---

## C. KYB fournisseurs + KYC client (décision 5)

**KYB — commerçants fournisseurs (ligne mode) :**
- **SIRET obligatoire** + activité de revente déclarée, vérifiés avant référencement au réseau.
- Facture conforme exigée pour chaque article acheté. Condition d'entrée sans exception (aucun achat auprès d'un particulier non enregistré).
- Traçabilité : contrat de fourniture + garantie de provenance + inscription au registre des objets mobiliers.

**KYC — client, gradué par volume :**
- **Vérification simple** : systématique dès la 1re commande, avant attribution d'un agent (le payeur et le bénéficiaire doivent être la même personne).
- **Vérification renforcée** : déclenchée dès qu'un client dépasse **3 achats OU 1 000 € cumulés sur 7 jours glissants** (seuil calculé en continu, sans intervention humaine).
- Prestataire **certifié PVID (référentiel ANSSI)**, spécialisé identité à distance uniquement (ni compte, ni service financier, ni conservation de dossier). Seul le **résultat** de la vérification est conservé, pas les copies de pièces.
- **Finalité unique** : prévention de la fraude + sécurité des agents. Aucun usage commercial, aucun profilage, aucune notation des clients.

> **⚠️ À confirmer par avis juridique** : le positionnement « non assujetti LCB-FT, vérification = intérêt légitime à prévenir la fraude ». Voir §E.

---

## D. Changements document par document

Légende : **REMPL** remplacer · **SUPPR** supprimer · **AJOUT** ajouter.

| Fichier | Nb. mentions à traiter | Actions principales |
|---|---|---|
| l'Étape 6 (`ESPACE-COMMERCANT/documents/partie-6-donnees.html`) | 28 micro-entr. | **SUPPR** colonnes/tables `employment_type`, `agent_invoices`, `self_billing_mandate_at`, TVA agent. **REMPL** seuil dépôt (→ 400 €, paramétrable). **REMPL** réseau dépôt (→ Cash Services). **AJOUT** `cash_on_hand_cents` + logique seuil, table config bornes/dépôt, entités KYB/KYC (ou renvoi note mode). |
| l'Étape 6 (`ESPACE-COMMERCANT/documents/partie-6-donnees.html`) | 12 micro-entr. | **SUPPR** entrées micro-entrepreneur/facturation agent. **REMPL** entrées dépôt (Cash Services), seuil. **AJOUT** entrées KYB, KYC gradué, carte nominative, borne Cash Services. |
| `docs/03-api-specs.html` | 7 micro-entr. | **SUPPR** endpoints factures agent. **REMPL** endpoints dépôt (→ Cash Services + recherche géolocalisée bornes). **AJOUT** endpoints KYB fournisseur, KYC gradué. |
| `docs/08-mecanisme-financier.html` | 6 micro-entr. | **REMPL** section rémunération (salariés uniquement, coût d'exploitation fixe). **REMPL** cycle du cash (Cash Services, seuil 400 €). **AJOUT** plafond 1 000 €. |
| `docs/09-espace-manager.html` | 5 micro-entr. | **SUPPR** écrans/config factures agent. **REMPL** réseau dépôt + seuil paramétrable. **AJOUT** validation KYB fournisseurs, paramétrage seuil dépôt + plafond paiement. |
| `docs/04-pricing.html` | 2 micro-entr. | **REMPL** mentions rémunération micro-entrepreneur → coût salarié. |
| `docs/01-flux-metier.html` | 1 micro-entr. | **REMPL** double poste agent (encaissement + dépôt), seuil 400 €. |
| `INDEX.html` | 2 micro-entr. | **REMPL** liens/mentions. |
| `ui/agent/01-inscription.html` | 3 | **SUPPR** choix de statut (salarié/micro) → salarié seul. |
| `ui/agent/13-profil.html` | 3 | **SUPPR** bloc micro-entrepreneur / factures. |
| `ui/agent/15-documents.html` | 3 | **SUPPR** factures agent / mandat auto-facturation. |
| `ui/agent/09-depot-cash.html` + `10-depot-confirme.html` | dépôt | **REMPL** Illicode/Banque Postale → **Cash Services** + **AJOUT** écran recherche géolocalisée d'automate. |
| `ui/agent/README.md` | 4 | **REMPL** description espacet agent (salarié, double poste). |
| `ui/manager/05-agents.html` | 3 | **SUPPR** colonne statut micro/salarié. **AJOUT** validation KYB (côté fournisseurs si applicable). |
| `ui/manager/15-agent-remuneration.html` | 2 | **REMPL entier** : salariés = charge d'exploitation fixe, pas de rémunération à la course. |
| `ui/manager/14-comptabilite.html` | 2 | **REMPL** traitement factures agent → salaires. |
| `ui/manager/10-configuration.html` | dépôt | **REMPL** réseau dépôt → Cash Services. **AJOUT** paramètre seuil dépôt (400 €), plafond paiement (1 000 €). |
| `ui/ecrans/05-securite-confiance.html`, `06-faq.html` | AML/vérif | **REMPL** discours conformité → prévention fraude + KYC. |
| `README.md`, `GUIDE-DEMARRAGE.html`, `NOTE-DEVELOPPEUR.html`, `docs/05-architecture.html`, `outils-integration/*` | Illicode/BP | **REMPL** réseau dépôt → Cash Services. **REMPL** discours AML. |
| `REFONTE-AGENT-2026/00-PREPARATION-CHANGEMENTS.md` | D6/D11/D15 | **REMPL** décisions D6 (AML), D11 (statut), D15 (seuil dépôt) pour refléter les arbitrages ci-dessus. |

**Total estimé** : ~90 mentions « micro-entrepreneur » (18 fichiers) + ~72 mentions réseau dépôt (16 fichiers) + reprise ciblée AML/seuil/plafond.

---

## E. Points à confirmer (juridique / à trancher) — NON bloquants pour l'édition

1. **⚠️ Assujettissement LCB-FT** — la position « AJEK non assujettie, vérification = prévention fraude » est défendable pour un négociant de biens plafonné à 1 000 €/transaction, **mais** : (a) la revente de **voyages** est un métier distinct à qualifier ; (b) un modèle **entièrement cash** attire la vigilance du régulateur au-delà de la lettre ; (c) **la banque, elle, est assujettie** et imposera sa propre vigilance sur un compte cash. → **Confirmation écrite requise** (avocat LCB-FT ou expert-comptable) avant de figer le discours dans la doc.
2. **Mécanisme de remboursement** — la note AJEK décrit une rétractation 14 j (mode) et une exclusion légale (voyage), mais pas le circuit cash de remboursement. La doc du dev prévoyait une « course de retour cash ». À réconcilier.
3. **Nommage** — « PayEnCash » (app) vs « AJEK SASU » (société). À harmoniser si besoin.
4. **Seuil dépôt vs note bancaire** — la note AJEK v11 remise à la banque indique **800 €** ; l'arbitrage retenu est **400 €**. Penser à mettre la note bancaire en cohérence (ou assumer 400 € comme durcissement prudentiel).

---

## F. Ordre d'exécution proposé (après votre validation)

1. **Lot statut salarié** : purge micro-entrepreneur (18 fichiers) — le plus volumineux, le plus net.
2. **Lot cash** : seuil 400 € + Cash Services + recherche d'automates + double poste agent.
3. **Lot conformité** : KYB fournisseurs + KYC gradué + discours AML (avec marqueur « à confirmer »).
4. **Lot plafond** : 1 000 €/transaction + anti-fractionnement.
5. **Note mode** : l'Étape 4 · flux F11/F12 (`ESPACE-COMMERCANT/documents/partie-4-flux.html`) (déjà rédigée, à valider).
