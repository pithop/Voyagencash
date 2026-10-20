# Audit consolidé de la documentation — Août 2026
### PayEnCash (application) / AJEK SASU (société) — fondatrice : Emilie Ruiz

> **Méthode** : 5 auditeurs à contexte frais ont lu **intégralement** le corpus (30 fichiers cœur), confrontés au modèle d'affaires autoritaire *AJEK SASU v11 (août 2026)* + décisions verrouillées (voir `MISE-A-JOUR-2026-08.md`).
> **Résultat** : **214 constats**. Ce registre sert de rapport ET de suivi des corrections (colonne Statut).
>
> **⚠️ Bandeau du 2026-09-18 (soir) — ce registre est un document d'archive, il n'est plus une liste de travail.** Deux pivots l'ont vidé d'une grande partie de son objet : le 17/09 (plus de borne, plus de commerçant qui encaisse une commande) et le 18/09 au soir (**l'agent de caisse mobile est supprimé**, avec les espèces, les courses, les dépôts et la paie de terrain ; **deux moyens de paiement** subsistent, le **Bon d’achat PayEnCash** et le **Bon d’achat PayEnCash**, tous deux achetés au comptoir d'un commerce ; côté commerçant, **plus de reversement mensuel** — sa carte est **prélevée à chaque vente** via **Stripe**, et un refus de la banque signifie qu'aucun bon d’achat n'est émis).
>
> **Ce qu'il faut en retenir aujourd'hui :** les **47 constats de l'app agent** (`ui/agent/`) et ceux des 8 écrans manager de l'agent portent sur des fichiers qui **n'existent plus** — `ui/coursier/` a été supprimé (19 écrans), et avec lui `03-livraisons`, `05-coursiers`, `06-zones-dispatch`, `15-coursier-remuneration`, `22-flotte`, `24-planning`, `32-rapprochement`, `33-fonds-caisse`. Des **8 chantiers**, **C1, C2, C3 et C5 sont sans objet** (statut salarié de l'agent, réseau de dépôt Cash Services, seuil de dépôt 400 €, recrutement et carte nominative) ; **C4 est sans objet dans sa forme d'août** (le plafond légal des espèces n'est plus le nôtre — voir `ANALYSE-RISQUES-CRITIQUE.md`, J4) ; **C6, C7 et C8 restent**. Les constats d'août sont conservés tels quels : un registre d'audit ne se réécrit pas, il se date.

## Synthèse par gravité

| Gravité | Nombre |
|---|---|
| 🔴 Bloquant | 52 |
| 🟠 Majeur | 101 |
| 🟡 Mineur | 61 |
| **Total** | **214** |

Répartition par lot : app agent 47 · docs 04-11 45 · espace manager 24 · docs 01-03 50 · écrans client + référentiel 48.

---

## Les 8 chantiers de correction (racines transverses)

La quasi-totalité des 214 constats se ramène à **8 chantiers**. Corriger les chantiers = corriger les constats.

| # | Chantier | Fichiers concernés | Statut |
|---|----------|--------------------|--------|
| **C1** | **Purge micro-entrepreneur → salarié** (supprimer statut `contractor`, commission à la course, `agent_earnings`/`agent_invoices`, auto-facturation, pièces SIRENE/RC pro, TVA 293 B) | agent 01·13·14·15·16·README ; manager 05·14·15 ; docs 01·02·03·04·08·09 ; GLOSSAIRE ; INDEX | 🔄 **app agent ✅ (01·02·03·04·13·14·15·16·README)** ; reste manager + docs + glossaire/index |
| **C2** | **Illicode / La Banque Postale → Cash Services** (+ rapport quotidien au lieu du SFTP LBP, + recherche géolocalisée de borne) | docs 01·05·08·09 ; agent 09·10·README ; manager 05·07·10 ; GLOSSAIRE·INDEX·GUIDE·NOTE-DEV·README·outils | 🔄 **app agent ✅ (03·04·09·10·16·README)** ; reste docs + manager + référentiel |
| **C3** | **Seuil de dépôt 400 €** (remplacer la règle `cash_on_hand_cents > 0` par `> 40000` ; dépôt immédiat au dépassement ; paramétrable) | agent 03·04·README ; manager 05·06·10 ; docs 01·02·03·08·09 | 🔄 **app agent ✅ (03·04·09·16·README)** ; reste manager + docs |
| **C4** | **Plafond 1 000 €/transaction + anti-fractionnement** (contrôle serveur, figé sur commande, paramétrable) | docs 01·02·03·04·08·09·10 ; manager 10 ; agent 07 ; GLOSSAIRE·GUIDE·README·05-securite·06-faq | ⬜ à faire |
| **C5** | **Recrutement/embauche salarié + carte nominative** (cycle RH : candidature → session pour tous → embauche → habilitation → carte Cash Services → désactivation au départ ; contrat mission d'encaissement sans clause de responsabilité pécuniaire) | agent 01·02·13·15 ; manager 05·19 (+ écran d'embauche à créer) ; docs 01·03·09 | 🔄 **app agent ✅ (01·02·13·15)** ; reste manager (écran d'embauche) + docs |
| **C6** | **Conformité** : « AJEK NON assujettie LCB-FT » **(à confirmer juridiquement)** + **KYB fournisseurs** + **KYC client gradué** (renforcé à 3 achats ou 1 000 €/7 j, PVID) | GLOSSAIRE·GUIDE·README·outils (les 4 bloquants « AML porté en interne ») ; docs 01·02·03·05·09·10 ; manager 05·18 ; 05-securite·06-faq | ⬜ à faire |
| **C7** | **Ligne MODE → renvoi vers note séparée** l'Étape 4 · flux F11/F12 (`ESPACE-COMMERCANT/documents/partie-4-flux.html`) (pas de build-out dans chaque doc) + notions légales rattachées : Colissimo, rétractation 14 j, contrefaçon/provenance, registre des objets mobiliers (321-7) | tous les docs signalant « ligne MODE absente » | ⬜ à faire (renvoi, pas build) |
| **C8** | **Nettoyages** : nom **AJEK SASU** vs PayEnCash (INDEX·NOTE-DEV·07-apropos) ; `on_qonto`→`on_account` ; **Hotelbeds post-payé** (aligner 08-finance sur 13) ; **logiciel de caisse inaltérable + attestation** (286-I-3° bis) ; **assurances** ; numérotations d'étapes/sections ; comptes d'écrans (README) ; résidus **Payrexx/buraliste/relay** ; exemple **FlixBus**→compagnie aérienne ; versions incohérentes | transversal | ⬜ à faire |

---

## Décisions qui vous appartiennent (je ne les invente pas)

1. **🔴 Mécanisme de remboursement** — deux auditeurs (docs 07 et 11) signalent que la « course de retour cash » n'est **pas décrite dans votre note AJEK**, et qu'elle est incompatible avec « l'agent ne fait qu'encaisser + déposer ». **Course de retour cash *ou* virement ?** → à trancher. En attendant je marque les passages concernés « DÉCISION REQUISE », je ne corrige pas au hasard.

> ✅ **ARBITRÉ LE 2026-08-03 — réponse apportée après la rédaction de ce document.** Le canal est l'**remise en espèces au point d'encaissement**, ou la **remise en espèces au point d'encaissement**, *de droit*. Le **virement est écarté** : les clients sont réellement non bancarisés. La **course de retour cash au domicile est écartée** : rapporter des espèces n'est ni encaisser ni déposer, et le poste de l'agent reste borné à ces deux gestes (D11 rév.) — le client se déplace, l'agent ne transporte rien. le remboursement est une remise en espèces au point d'encaissement (table `refunds`, un seul canal) ; `collections.is_return` n'a plus de mécanisme derrière lui. Voir §3 bis B du registre de décisions. *(tranché le 2026-08-04 : code de remise + photo du reçu numéroté + agent + horodatage, table `refunds` — `MODELE-DONNEES-COMPLEMENT` §2.13)*

2. **AML** — le discours reste « **à confirmer par avis juridique** » (non figé), conformément à votre consigne.
3. **Ligne MODE** — confirmée en **note séparée** ; je ne construis pas les écrans/tables/endpoints MODE dans chaque doc, je renvoie vers l'Étape 4 · flux F11/F12 (`ESPACE-COMMERCANT/documents/partie-4-flux.html`).

---

## Registre détaillé (les 214 constats, par fichier)

> Format : `GRAVITÉ · TYPE — description → correction`. G = 🔴 bloquant / 🟠 majeur / 🟡 mineur.

### APP AGENT — `ui/agent/` (47)

**01-inscription.html** ✅ CORRIGÉ
- 🔴 auto-inscription candidat « en attente » → écran de candidature pour poste **salarié**, compte actif à l'embauche ✅
- 🔴 choix Salarié/Micro-entrepreneur (micro présélectionné) → **supprimé**, carte « Ton contrat » ✅
- 🔴 mandat d'auto-facturation → **supprimé** ✅
- 🟠 bloc « Ton entreprise » (SIRET/TVA) → **supprimé** ✅
- 🟠 pièces SIRENE + RC pro → **supprimées** ✅
- 🟠 rien sur contrat/mission d'encaissement/pas de responsabilité pécuniaire → **ajouté** ✅
- 🟡 « sous 48 h » → **retiré**, reformulé embauche ✅

**02-connexion.html** — 🟠 commentaire modèle auto-inscription→embauche · 🟠 CTA « Créer un compte agent »→retirer · 🟡 réassurance « compte pas actif tout de suite »→remise carte à l'embauche
**03-accueil.html** — 🟠 « cash à déposer 438,10 € » avec délai 19:00 → dépôt immédiat dès >400 € · 🟡 seuil 400 € non affiché→l'expliciter
**04-courses.html** — 🔴 règle `cash_on_hand_cents > 0` bloque dès 1 € → corriger en `> 40000` (400 €) · 🟡 état « bloqué » n'explique pas le seuil→l'indiquer
**07-encaissement.html** — 🟡 pas de rappel plafond 1 000 €/anti-fractionnement→ajouter
**09-depot-cash.html** — 🔴 « automates Illicode / La Banque Postale »→Cash Services · 🔴 « La Banque Postale — Marseille Colbert » / « dépôt Illicode »→borne Cash Services · 🟠 « code Illicode »→vocabulaire Cash Services · 🟡 nommer « recherche géolocalisée » · 🟡 rappeler le seuil 400 €
**10-depot-confirme.html** — 🔴 « N° de transaction Illicode »→Cash Services · 🟠 « rapport SFTP LBP (J+1) »→Cash Services
**13-profil.html** — 🔴 en-tête « Micro-entrepreneur »→salarié · 🔴 bloc « Statut & rémunération » (SIRET/commission/TVA)→supprimer · 🔴 lien « mes gains et factures »→supprimer · 🟠 seule la variante micro existe→créer la variante salarié · 🟠 doc « RC pro »→supprimer · 🟠 rien sur habilitation/pas de responsabilité pécuniaire→ajouter
**14-gains.html** — 🔴 écran rémunération à la course (30 % commission)→retirer · 🔴 section « Mes factures »→retirer · 🔴 écran entier fondé sur micro-entrepreneur→**retirer l'écran + son entrée de nav** (DÉCISION : remplacer par « Mon salaire » simple, ou supprimer)
**15-documents.html** — 🔴 en-tête « Micro-entreprise »→salarié · 🔴 « mandat d'auto-facturation »→supprimer · 🟠 section « demandées aux micro-entrepreneurs »→supprimer · 🟡 ajouter contrat de travail/habilitation
**16-notifications.html** — 🔴 notif « ta facture de juillet… ventilation »→supprimer · 🟡 notif dépôt en retard « depuis 6h »→reformuler autour du seuil 400 €
**README.md** (agent) — 🔴 tableau 01 « manager valide »→embauche · 🔴 « Deux statuts (D11 rév.) »→supprimer/réécrire · 🔴 « Illicode/LBP » + « SFTP LBP »→Cash Services · 🔴 ligne 14 « micro-entrepreneurs uniquement »→retirer · 🔴 ligne 15 « auto-facturation »→corriger · 🔴 règle `>0`→seuil 400 € · 🟠 aucun 400 €→ajouter · 🟠 aucun Cash Services/géoloc/1 000 €→documenter · 🟠 aucun processus d'embauche→ajouter

### DOCS 04-11 — `docs/` (45)

**04-pricing.html** — 🔴 pricing MODE absent→renvoi note MODE · 🔴 coût agent avec option micro « à la course »→salarié coût fixe · 🟠 pas de plafond 1 000 €→ajouter · 🟡 proforma/reçu absents→terminologie · 🟡 TVA globale vs voyage=marge/mode=standard→scinder
**05-architecture.html** — 🔴 dépôt SFTP « La Banque Postale »→Cash Services · 🔴 pas de Cash Services/géoloc/`on_account`→réécrire cycle cash · 🟠 logiciel de caisse (286-I-3° bis) absent→ajouter · 🟠 section assurances absente→ajouter · 🟠 KYC/KYB absents→ajouter · 🟠 brique MODE absente→renvoi note · 🟡 seuil 400 €/plafond 1 000 € absents→ajouter
**06-segment-maghreb.html** — 🟠 garde-fous (Cash Services/seuils/KYC) non appliqués→réaligner · 🟠 KYC renforcé absent (segment cash élevé)→ajouter · 🟡 plafond 1 000 € (panier famille)→vérifier
**07-annulations-remboursements.html** — 🟠 remboursement = « course de retour » **non validé par le modèle** → ✅ **ARBITRÉ 2026-08-03** : ni retour cash ni virement — avoir proposé + remise au point d'encaissement de droit · 🟠 rétractation 14 j (mode)/exclusion voyage absente→ajouter cadre légal · 🟡 sort des 2 factures en annulation→clarifier · 🟡 « encours agent pour rembourser » incompatible Cash Services→revoir
**08-mecanisme-financier.html** — 🔴 circuit Illicode/LBP→Cash Services · 🔴 section « TVA déductibl'agents micro-entrepreneurs » + auto-facturation→supprimer · 🟠 pas de seuil 400 €→ajouter · 🟠 pas de plafond 1 000 €/anti-fractionnement→ajouter · 🟠 « avance Duffel » vs « encaissement précède l'engagement »→vérifier · 🟡 pas d'AJEK SASU/LCB-FT→ancrer · 🟡 résidu `payrexx_settlement`→vérifier suppression
**09-espace-manager.html** — 🔴 gestion agent statut dual + commission + auto-facturation→salarié seul · 🔴 trésorerie Illicode/LBP/SFTP→Cash Services · 🟠 pas d'écran KYB fournisseurs→ajouter · 🟠 pas de KYC gradué→ajouter · 🟠 pas de processus RH embauche→refondre · 🟠 pas de seuil 400 €→ajouter · 🟠 pas de plafond 1 000 €→ajouter · 🟡 Hotelbeds « prépayé » vs post-payé→aligner · 🟡 résidu Payrexx (ConfigEditor)→supprimer · 🟡 pas d'AJEK/MODE dans dashboards→scinder
**10-compte-utilisateur.html** — 🟠 pas de KYC gradué→ajouter · 🟡 pas de contrôle serveur 1 000 €→ajouter · 🟡 pas de ligne MODE (Colissimo/rétractation)→renvoi note · 🟡 pas de proforma/reçu→aligner
**11-ui-v2.html** — 🟠 écrans voyage seuls, pas d'écran MODE→renvoi note · 🟡 pas d'étape KYC→ajouter · 🟡 « code interne+sécurité » sans numérotation reçu→vérifier · 🟡 preuve « course de retour »→DÉCISION · 🟡 résidu « écran Buralistes »→vérifier

### ESPACE MANAGER — `ui/manager/` (24)

**05-agents.html** — 🔴 statut micro-entrepreneur au recrutement (SIRET/TVA/commission/mandat)→salarié seul · 🔴 « Inscriptions à valider » (candidatures indépendantes)→workflow d'embauche salarié · 🟠 encours 438,10 € « en course » vs règle retrait dispatch→aligner sur 400 € · 🟠 pas de « Cash Services »/plafond carte/désactivation au départ→ajouter
**10-configuration.html** — 🔴 « rapport de transactions de La Banque Postale »→Cash Services · 🟠 pas de réglage seuil 400 € ni plafond 1 000 €→ajouter
**14-comptabilite.html** — 🔴 « TVA déductible — factures agents » + export auto-facturation→retirer, garder « journal de paie salariés » · 🟠 pas de ventilation TVA marge(297A)/standard ni registre 321-7→ajouter
**15-agent-remuneration.html** — 🔴 écran « rémunération & factures agents, micro-entrepreneurs uniquement »→supprimer ou remplacer par suivi masse salariale
**08-finance.html** — 🔴 Hotelbeds traité comme wallet prépayé (seuil 500 €/recharge) vs 13 « post-payé »→aligner post-payé · 🟠 « revenus par marge » sans ligne MODE→ajouter marge MODE
**04-commandes.html** — 🟠 commandes VOYAGE seules, pas de commandes MODE (Colissimo)→ajouter (ou renvoi note)
**12-commande-detail.html** — 🟠 détail voyage seul, pas de détail MODE→ajouter (ou renvoi note)
**06-zones-dispatch.html** — 🟠 « plafond d'encours » zone non relié au seuil 400 €→ajouter seuil global paramétrable
**README manager / écran manquant** — 🟠 aucun écran d'embauche salarié agent (habilitation, contrat, carte à l'embauche) ; 19-invitation ne couvre que les comptes manager→créer le workflow
**18-fiche-client.html** — 🟠 pas d'affichage du palier KYC gradué→ajouter indicateur
**16-communications.html** — 🟠 e-mail `code_generated` mentionne Paysafecash + « point relais »→réécrire collecte à domicile
**ensemble** — 🟠 pas de validation KYB fournisseurs MODE→ajouter panneau
**02-tableau-de-bord.html** — 🟡 pas de ventilation VOYAGE/MODE→envisager
**07-tresorerie.html** — 🟡 ne nomme jamais « Cash Services »→nommer
**09-appels.html** — 🟡 `pre_relay_reminder` (vestige buraliste)→renommer « pré-collecte »
**11-audit.html** — 🟡 entrée « Frais Payrexx modifiés » au journal→pour mémoire (un journal ne se réécrit pas)
**20-notifications.html** — 🟡 pas de notif KYB/registre 321-7/carte à l'embauche→ajouter après création écrans
**19-invitation.html** — 🟡 pas de flux embauche agent→voir workflow à créer

### DOCS 01-03 — `docs/` (50)

**01-flux-metier.html** — 🔴 ligne MODE absente→renvoi note · 🔴 étape 15 « micro-entrepreneur »→salarié · 🔴 dépôt Illicode/LBP→Cash Services · 🔴 rapprochement SFTP LBP→rapport Cash Services · 🟠 acteur « employé » vs étape micro→unifier · 🟠 virement Qonto sans lien Cash Services→aligner · 🟠 pas de seuil 400 €→ajouter · 🟠 pas de plafond 1 000 €→ajouter · 🟠 pas de KYB/KYC→ajouter · 🟠 registre 321-7 absent→note MODE · 🟠 pas de cycle RH embauche→décrire · 🟠 TVA % standard vs marge(297A)→corriger · 🟠 dépassement marge contradictoire (achat vs remboursement)→harmoniser · 🟡 étape « 6 » dupliquée→renuméroter · 🟡 logiciel de caisse (286-I-3°bis) absent→ajouter
**02-schema-bdd.html** — 🔴 `agents.employment_type('employee','contractor')` + SIRET/mandat→supprimer contractor · 🔴 `deposit_cards`/`agent_deposits`/`bank_report_imports`/`bank_deposit_transactions` = Illicode/LBP→reconfigurer Cash Services · 🔴 `payments` sur `barcode_value`+`security_code_hash` (code-barres)→reçu numéroté plafonné 1 000 € · 🔴 aucune table MODE→ajouter (note MODE) · 🟠 `agent_documents` inclut `rc_pro`/`sirene_notice`→retirer · 🟠 `agent_earnings`→supprimer · 🟠 `agent_invoices`→supprimer · 🟠 `agent_payouts.payout_type=invoice_settlement`→garder 'salary' · 🟠 pas de CHECK 1 000 €/anti-fractionnement→ajouter · 🟠 seuil 400 € absent (`max_cash` 500 € ≠ notion)→ajouter · 🟠 registre 321-7 absent→ajouter · 🟠 table KYB absente→ajouter · 🟠 table KYC absente→ajouter · 🟠 facturation 2 temps + reçu numéroté absents→ajouter · 🟡 pas de service géoloc borne→ajouter · 🟡 `on_qonto`→`on_account`
**03-api-specs.html** — 🔴 intro « salarié ou micro-entrepreneur »→salarié seul · 🔴 endpoints earnings/invoices/commission-rate→supprimer · 🔴 dépôt Illicode + SFTP LBP (secrets `LBP_SFTP_*`)→Cash Services · 🔴 aucun endpoint MODE→section MODE (note) · 🟠 `POST /agents/me/documents` exige RC pro/SIRENE→pièces d'embauche · 🟠 pas d'endpoint cycle carte nominative→ajouter · 🟠 pas de règle 400 €→implémenter · 🟠 pas de validation 1 000 €/anti-fractionnement→ajouter · 🟠 pas d'endpoint KYB→ajouter · 🟠 pas d'endpoint KYC→ajouter · 🟠 pas d'endpoint registre 321-7→ajouter · 🟠 `vatAmountCents` sur TTC vs marge(297A)→corriger · 🟠 états `on_qonto/paid_out` + preuve SFTP→`on_account`/Cash Services · 🟡 logiciel de caisse non documenté→ajouter · 🟡 version « v2.0 » vs « 1.0 »→harmoniser · 🟡 endpoints vestiges (`/webhooks/payrexx`,`/relay-points/nearest`,`/orders/{id}/arrived`,`/refund-iban`)→retirer · 🟡 section « 9 » puis « 11 » (pas de 10)→corriger · 🟡 exemple `marketing_carrier:"FlixBus"`→compagnie aérienne · 🟡 écart cash « tracé sur l'agent »→préciser absence d'imputation

### ÉCRANS CLIENT + RÉFÉRENTIEL (48)

**ESPACE-COMMERCANT/documents/partie-6-donnees.html** — 🔴 « conformité cash/AML portée en interne »→non assujettie (à confirmer)+KYC/KYB · 🟠 circuit Illicode/LBP/SFTP→Cash Services · 🟠 `employment_type`/`vat_regime`/`commission_rate`/`agent_invoices`→supprimer · 🟠 pas de KYC/KYB→ajouter · 🟠 pas de plafond 1 000 €→ajouter · 🟠 ligne MODE absente→renvoi note · 🟡 « 230+ colonnes » vs 298→recalculer · 🟡 vestiges Payrexx marqués→purger
**INDEX.html** — 🟠 « SASU PayEnCash · Emilie Ruiz »→AJEK SASU (app=PayEnCash) · 🟠 « Automate Illicode/LBP »→Cash Services · 🟠 cartes 14-gains/15 « micro-entrepreneurs »→salarié · 🟠 ligne MODE absente→ajouter/lien · 🟡 n'indexe pas 11-suivi-etats-echec→ajouter · 🟡 « 22 tables » vs GUIDE « 14 »→harmoniser
**GUIDE-DEMARRAGE.html** — 🔴 « AML portée en interne »→non assujettie+KYC/KYB · 🟠 « contrats Illicode/LBP »→Cash Services · 🟠 pas de KYC/KYB/1 000 €/MODE/Cash Services ; `.env` sans seuil/plafond→compléter · 🟡 « 14 tables » vs INDEX « 22 »→harmoniser
**NOTE-DEVELOPPEUR.html** — 🟠 « SASU PayEnCash · Emilie Ruiz »→AJEK SASU · 🟠 « 1bis circuit du cash » Illicode/LBP/SFTP/Qonto `…on_qonto→paid_out`→Cash Services/400 €/géoloc · 🟠 « identité vérifiée à l'aéroport » vs KYC gradué (PVID)→corriger · 🟠 pas de KYC/KYB/1 000 €/MODE→compléter · 🟡 pas d'endpoint KYC→ajouter
**README.md** (racine) — 🔴 « AML portée en interne » (×2)→non assujettie+KYC/KYB · 🟠 « Illicode/LBP » + SFTP (×3)→Cash Services · 🟠 ligne MODE absente→lien note · 🟠 « ui/ecrans 8 écrans » vs 11→corriger · 🟠 arbo `ui/` omet `ui/manager/`→ajouter · 🟡 « agent 13 écrans » vs 16→corriger · 🟡 « 8. » dupliqué→renuméroter · 🟡 pas de 1 000 €/KYC→compléter
**CHANGELOG_DOC.md** — 🟠 document ancré pré-refonte (Payrexx/Buralistes/relay_points)→archiver/marquer historique · 🟡 drift `payrexx_link_id`→sans objet, retirer
**DESIGN_SYSTEM.md** — 🟡 pas de référence ligne MODE→prévoir si écrans MODE
**outils-a-integrer.html** — 🔴 « AML portée en interne » (×2)→non assujettie+KYC/KYB · 🟠 §4 « Retour du cash » Illicode/LBP/SFTP (`LBP_SFTP_*`)→Cash Services · 🟠 pas de KYC/KYB/1 000 €/MODE→compléter
**ui/README.md** — 🟠 « ui/manager 11 écrans » vs 20→corriger
**ui/ecrans/01-accueil.html** — 🟠 pas d'accès ligne MODE→ajouter ou clarifier périmètre voyage
**ui/ecrans/02-suivi-encaissement.html** — ✅ conforme
**ui/ecrans/03-mes-codes.html** — ✅ conforme
**ui/ecrans/04-comment-ca-marche.html** — 🟡 100 % voyage→renvoi MODE
**ui/ecrans/05-securite-confiance.html** — 🟠 pas de KYC gradué (PVID) ; discours « anonymat »→reformuler (prévention fraude, pas AML interne) · 🟡 pas de rappel 1 000 €→ajouter
**ui/ecrans/06-faq.html** — 🟠 pas de Q sur plafond 1 000 €/KYC/anti-fractionnement→ajouter
**ui/ecrans/07-apropos.html** — 🟠 « PayEnCash est une SASU à Marignane »→AJEK SASU · 🟡 pas de MODE ni Aix/Marseille→compléter
**ui/ecrans/10-compte.html** — 🟡 commentaire obsolète « Buralistes »→retirer · 🟡 pas d'indicateur niveau KYC→ajouter
**ui/ecrans/08·09·11, ui/parcours/01·02·03** — 🟡 pas d'étape KYC avant validation (3 tunnels)→ajouter le cas échéant ; ⚠️ `?mode=stay` (hôtel seul) ≠ ligne Mode produit (risque de confusion terminologique)

---

## Ordre d'exécution retenu

1. **C1 + C5** (statut salarié + recrutement) — le plus structurant, en cours.
2. **C2** (Cash Services) — mécanique, fort volume.
3. **C3 + C4** (seuil 400 € + plafond 1 000 €) — règles chiffrées.
4. **C6** (conformité KYB/KYC + AML « à confirmer »).
5. **C7** (renvois ligne MODE).
6. **C8** (nettoyages transverses).

> Chaque fichier corrigé est coché ✅ dans ce registre. ✅ **Les points « DÉCISION REQUISE » ont tous été arbitrés depuis** — le 2026-08-03 pour le **canal de remboursement** et le **prix garanti**, ainsi que pour la **résilience bancaire** (écartée). Le corpus a été aligné en conséquence ; voir §3 bis du registre de décisions.
