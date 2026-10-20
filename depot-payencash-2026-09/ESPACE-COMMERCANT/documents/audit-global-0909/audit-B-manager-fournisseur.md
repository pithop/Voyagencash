# Audit B — chaîne MANAGER ↔ FOURNISSEUR (Mode)

Dossier audité : `/Users/emilieruiz/Downloads/payencash-documentation-2026-07-31` (lecture seule, 09/09/2026).
Fichiers lus en entier : `ui/assets/payencash-fournisseur.js`, `payencash-docs.js`, `payencash-garde.js`, les 14 écrans `ui/fournisseur/*`, les 15 écrans manager listés, les parties concernées de `payencash-data.js` (comptes, fournisseurs, inventaire, atelier, règlement, factures, expéditions, codes, démarques/campagnes, registre, acceptations, IBAN, reporting, écritures) et de `payencash-bus.js` (noter/journal, payer, SAV, STATUT_SQL), `server/db/schema.sql` (tables fournisseur), `partie-6-donnees.html` (miroir), `tests/test-runner.html` (titres des scénarios).

Convention : **[catégorie · gravité]** — ce qui se passe aujourd'hui → ce qu'il faudrait. Seuls les manques sont listés ; ce qui marche n'est pas repris.

---

## 1. Inscription → code → validation manager → accès actif

**C1. La validation KYB par le manager se fait sans aucun document.**
`ui/fournisseur/00-inscription.html:10-11, 207-216` · `ui/assets/payencash-data.js:2040-2053` · `ui/manager/26-fournisseurs.html:266` · `ui/manager/40-comptes.html:184, 204`
[UX FLUX + LOGIQUE ABSENTE · **bloquant**] — 00-inscription ne charge pas `payencash-docs.js` (« le dossier se constitue APRÈS validation ») ; le compte passe `a_verifier` → `a_valider` avec uniquement enseigne/SIREN/dirigeant. Côté manager, `compteValider(id, moi, {kyb:true})` (26:266) ou une simple case cochée « KYB (Kbis, gérant, RIB) contrôlé » (40:184) suffit : la branche fournisseur de `compteValider` (data 2049-2050) coche `v.kyb = true` sans lire `PEC_DOCS.etat`, contrairement à la branche agent qui exige `dossierCandidatAgent`. Le manager « valide le KYB » d'un dossier qui n'existe pas encore (les 9 pièces ne se déposent que sur 11-verification-kyb, page gardée qui exige déjà une session active). → Soit déposer les pièces obligatoires pendant la candidature (sous l'id du compte, puis `PEC_DOCS.transferer('fournisseur', c.id, refId)` dans `_compteLierMetier` — absent pour le fournisseur, présent pour l'agent 2137), soit remplacer « Valider (KYB) » par une validation conditionnée à `PEC_DOCS.complet('fournisseur', id)` et à `estSigne(...,'contrat')` ; l'ordre attendu par le contrat généré (« n'entre en vigueur qu'après validation du dossier ») est l'inverse de l'ordre implémenté.

**C2. Deux vérités KYB qui ne se parlent pas.**
`payencash-data.js:1264, 1270, 2121, 2969-2976` · `ui/manager/26-fournisseurs.html:341-346` · `ui/manager/25-mode.html:133-134` · `ui/assets/payencash-data.js:987-988 (lancementEtat)`
[SCHÉMA + LOGIQUE · **majeur**] — `fournisseursGet().kyb` vaut `'valide'` dès qu'un accès est activé (`fournisseurAccesSet` 1270 : `over[id].kyb = 'valide'`) ou qu'un compte est lié (2121 `kyb: 'valide'`), tandis que `_fournisseurVerite` (2969) dérive le statut du coffre. Le KPI « KYB en attente » (26:341, 25:133), `lancementEtat` (988) et `fournisseursModeGet` (6332-6337) lisent `f.kyb`, la ligne du tableau 26 (187) lit `PEC_DOCS.etat`. Un fournisseur activé sans pièce est « Vérifié » dans un KPI et « Dossier incomplet » trois colonnes plus loin. → Une seule source : supprimer `kyb` du référentiel/overrides, dériver partout de `PEC_DOCS.etat('fournisseur', id)` ; le SQL `suppliers.status` (`candidate|kyb_pending|active|watch|suspended`) doit être calculé de la même règle.

**C3. Le mot de passe du fournisseur est stocké en clair comme « code d'accès ».**
`payencash-data.js:2121-2122` (`acces: { login: c.identifiant, code: c.motdepasse, statut: 'actif' }`) · `1829` (comptesDemo relit `motdepasse: f.acces.code`)
[PERTE DE DONNÉE / sécurité · **majeur**] — À la liaison métier, le mot de passe choisi est copié dans `pec-fournisseurs-crees.acces.code`. 26-fournisseurs le masque à l'affichage (196-197) mais il est lisible dans le stockage et l'export. → Ne jamais recopier `motdepasse` ; le référentiel fournisseur ne porte que `compteId`, la connexion passe par `accounts.password_hash`.

**C4. L'identité légale d'un fournisseur inscrit est fabriquée par un hachage.**
`payencash-data.js:1726-1747` (`entrepriseDeriveeFournisseur`) · `2948` (fusion) · `payencash-docs.js:854-856, 868, 1141-1142, 1157`
[DUR · **bloquant**] — Pour tout compte, SIRET, TVA intracom, RCS, capital, forme « SAS », raison sociale `nom + ' SAS'`, téléphone, **IBAN** (`'FR76 ' + dig(4,13) + …•••• '`) et BIC sont dérivés de l'id. Un fournisseur créé par 00-inscription n'a saisi que SIREN/dirigeant/adresse : sa fiche 10-identite-legale, son **contrat-cadre signé** (« Compte de règlement : IBAN FR76 …•••• », docs 868) et ses **factures** (« SIRET … TVA … IBAN … », docs 1141, 1157) portent des identifiants inventés. Le seed Chez Awa (data 669) porte lui aussi un IBAN masqué `FR76 3000 4•••• …` dans un document juridique. → Aucun repli fabriqué : champs vides tant que le Kbis/RIB validés ne les ont pas fournis (lecture des pièces validées ou saisie contrôlée par le manager à la validation), et blocage de la génération du contrat/facture tant que SIRET, régime TVA et IBAN réel manquent.

**C5. Clôture d'un compte fournisseur = accès réactivé.**
`payencash-data.js:2151` (`_compteSyncMetier` : `statut === 'suspendu' ? 'suspendu' : 'actif'`) · `2057-2064` (`compteCloturer`, agent seulement)
[LOGIQUE BÂCLÉE · **majeur**] — Il n'existe pas de résiliation fournisseur (préavis 1 mois, commandes en cours menées à terme — art. « Durée, résiliation » du contrat généré, docs 1005-1009). Si `compteCloturer` est appelé sur un fournisseur, la synchro métier remet l'accès à `'actif'`. → `fournisseurResilier(id, motif, par)` : accès `'clos'`, publication bloquée, expéditions/factures en cours conservées, journal `contrat_resilie`, miroir `suppliers.status`.

**C6. Suspension depuis 26 : le compte reste actif, le fournisseur est éjecté sans message.**
`ui/manager/26-fournisseurs.html:219` (`fournisseurAccesSet` seul) · `payencash-data.js:7581` (boot : `fournisseurActifSet(null)` si suspendu) · `payencash-garde.js:87`
[UX FLUX · **mineur**] — 26 suspend le référentiel, pas le compte (`compteSuspendre` n'est appelé que par 40). `compteConnecter` réussit (compte `actif`), pose la session, puis la page suivante l'efface au boot : retour à la connexion sans motif. → Suspendre depuis 26 = `compteSuspendre(compteId)` (une seule main), et `_compteConnecterBrut` doit refuser un fournisseur dont `acces.statut !== 'actif'` avec le motif.

**C7. Sélecteur « démo » sur la page de connexion : n'importe qui ouvre n'importe quelle session.**
`ui/fournisseur/01-connexion-kyb.html:168-193` (liste de tous les actifs + code affichable 180-183)
[UX FLUX · **mineur** (maquette)] — Page publique (garde 62-63) qui liste les 13 comptes et permet d'afficher leur code. → À retirer ou à réserver à `?demo=1` derrière une session manager.

**C8. Pièce d'identité toujours « à fournir » sur la fiche de connexion.**
`ui/fournisseur/01-connexion-kyb.html:124` lit `E.kyb.cni`, supprimé par `_fournisseurVerite` (`payencash-data.js:2975 delete r.kyb.cni`)
[STATIQUE · **mineur**] — Le libellé est faux pour un dossier validé. → Lire l'état de la pièce `cni` dans `PEC_DOCS.dossier`.

## 2. Dossier KYB (9 pièces, frais, urgence, assignation, verdict)

**C9. Les pièces « à renouveler » n'ont pas de date d'expiration.**
`payencash-docs.js:56-67` (`expire: true` sur kbis/rbe/rcpro/urssaf) · `130-137` (`statuer` ne saisit aucune date) · `server/db/schema.sql:1265` (`expires_on` existe)
[LOGIQUE ABSENTE · **majeur**] — Le Kbis « de moins de 3 mois » et la RC pro « en cours de validité » sont validés une fois pour toujours ; rien ne redemande la pièce, rien n'alerte le manager, la colonne SQL n'est jamais alimentée. → `statuer(..., {expiresOn})` obligatoire quand `expire`, `etat()` repasse la pièce en `a_renouveler` à l'échéance, tuile manager « pièces expirées ».

**C10. Seuil URSSAF calculé sur un champ inexistant.**
`payencash-docs.js:67` (`!x.at || x.at >= depuis` — les factures portent `creeTs/emiseTs/vireeTs`, jamais `at`)
[LOGIQUE BÂCLÉE · **mineur**] — Le cumul « 12 mois » est en réalité le cumul depuis toujours. → Lire `emiseTs || creeTs`.

**C11. Frais d'examen 2,99 € / 9,99 € : un reçu sans encaissement ni écriture.**
`payencash-docs.js:172-183` (`reglerFrais` : `recu: PEC_BUS.numeroRecu()`, aucun paiement) · `ui/fournisseur/11-verification-kyb.html:96, 102` (« règlement simulé »)
[TROU · **mineur**] — Le reçu est numéroté sur la même séquence que les encaissements clients, mais aucune commande/paiement n'existe, aucune écriture `Ventes`/`Trésorerie` dans `ecrituresGet`. → Créer une commande interne `KYB-<id>` réglée par carte (ou l'inscrire hors bus avec une écriture dédiée), et décider si le fournisseur paie vraiment.

**C12. Contrat-cadre : signature libre, non contresignée, non versionnée.**
`payencash-docs.js:1102-1125` (`signer` : `signataire` = texte libre, aucun lien avec `dirigeant`, aucune vérification e-mail/OTP) · `1118-1122` (méta déposée : `modele, signe, signataire, signeAt, empreinte` — **pas de version de modèle**) · `1008-1012 / DOCS.pied` (« Pour AJEK : (signature et cachet) » jamais rempli) · `payencash-data.js:2983-2988` (`contratConditions` vivantes)
[SCHÉMA + LOGIQUE · **majeur**] — Le PDF signé fige un coefficient (`scenario.coefVenteMode`) et un délai (`ref.juridique.virementJours`), mais 12-contrat-cadre (83-88) et les factures relisent les valeurs **courantes** : si le coefficient change, le fournisseur voit des conditions qu'il n'a pas signées, sans avenant. Le contrat n'est jamais signé par AJEK ; le manager le « valide » comme une pièce (statuer). → Stocker `versionModele` + snapshot des conditions dans la méta ; un changement de conditions crée un avenant à re-signer (`acceptationsRequises` couvre déjà les CGU, pas le contrat) ; contresignature manager (`signer` côté manager avec son identifiant) avant `validee` ; signataire contraint au dirigeant du Kbis.

**C13. Le dossier n'apparaît dans 42-verifications que s'il a été « soumis » (et payé).**
`payencash-docs.js:257-275` (`aVerifier` lit `pec-kyb-soumis:*`) · `ui/manager/42-verifications.html:77`
[UX FLUX · **mineur**] — Un fournisseur qui dépose 8 pièces sans cliquer « Régler et envoyer » n'est visible nulle part côté manager (26 affiche seulement le libellé). → Lister aussi les dossiers « déposés, non soumis » avec leur avancement.

## 3. Publication d'une pièce → atelier → article Mode

**C14. Les photos et la facture d'origine ne sont pas stockées : seul le nom de fichier voyage.**
`ui/fournisseur/03-ajouter-piece.html:268` (`S.factureOrigine = { nom: fic.name }`), `464, 476` (`photoMarquer(i, fic.name)`) · `payencash-data.js:3567, 3574` · `ui/manager/34-atelier.html:126-135, 153-158` (contrôle par nom de fichier)
[PERTE DE DONNÉE · **bloquant**] — Le coffre `PEC_DOCS.deposer` sait lire un fichier (FileReader) mais le wizard ne l'utilise pas. L'atelier « contrôle les photos » en comptant des noms (`vues.length >= exig && !manquantes.length`), le livre de police cite « Facture d'origine · x.pdf » (data 4196) pour un fichier qui n'existe pas, et la fiche Mode (`photoArticle`) affiche une photo Unsplash de famille, jamais la photo du fournisseur. → Déposer chaque vue et la facture via `PEC_DOCS.deposer('lot', ref, role, file)` (miroir `product_media`), l'atelier ouvre les images (`rendreDossier` sait déjà les afficher), la fiche Mode lit `product_media`.

**C15. Le contrôle physique aléatoire n'existe pas : `bloque_controle` n'est jamais écrit.**
grep complet du dépôt : `bloque_controle` n'est lu qu'en `payencash-data.js:3392, 4646, 5353`, `payencash-fournisseur.js:58`, `ui/fournisseur/04-expeditions.html:76`, `08-stock.html:239`, `02-accueil.html:252` — aucun setter · file « Qualité à contrôler » `ui/manager/34-atelier.html:170` (`status === 'a_controler'`) alimentée uniquement par le seed `payencash-data.js:640-642` (3 pièces `PC-…`, `vendu: true`)
[TROU · **bloquant**] — Toute la branche (étiquette atelier, `CYCLE.bloque`, notif client « Contrôle qualité avant envoi », verdict conforme/re-cote/refus sur pièce vendue, certificat) est du code mort ou du seed. Après un verdict `conforme` (1227) rien ne réexpédie au client ; `pieceVerdict('recote'|'refuse')` ne pose qu'un drapeau `remboursementClient` (1228-1229) que personne ne traite (34:190-191 affiche « remboursement déclenché » sans appel à `PEC_BUS.rembourser`). → `controleAleatoire(expedition)` (tirage selon `ref.atelier.tauxControle`, à créer) posant `statut:'bloque_controle'` à la vente ; réception atelier → `pieces.status='a_controler'` ; verdict conforme → nouvelle étiquette client émise par l'atelier ; refus → `PEC_BUS.rembourser(cmd, {mode})` + facture fournisseur annulée (`po_status annule`) ; re-cote → voir C16.

**C16. Une re-cotation change le prix client, jamais le prix d'achat, et sans accord du fournisseur.**
`payencash-data.js:1226, 1243` (`nouveauPrix = sellPrice × 0,85` → `lot.prixVente`) · contrat généré `payencash-docs.js:975-981` (« ne modifie le prix d'achat qu'avec l'acceptation du fournisseur ») · `server/db/schema.sql:759-761` (`final_buy_price_cents`, `controle`)
[LOGIQUE BÂCLÉE · **majeur**] — Le verdict réécrit `lot.prixVente` et l'historique Omnibus immédiatement ; la facture `a_facturer` garde le prix convenu ; aucune proposition n'arrive sur l'accueil fournisseur (qui ne connaît que démarques/campagnes). → Une re-cote = proposition (`demarquer`-like sur le prix d'achat) acceptée/refusée sur 02-accueil ; refus → pièce reprise ; acceptation → facture recalculée.

**C17. Réassort et retrait : mouvements sans contrôle ni journal, retrait compté comme vente.**
`payencash-data.js:3603-3620` (`sortieStock` : `lg.vendu++` même pour `'retrait'`, 3611-3612) · `3623-3635` (`entreeStock` : aucun `PEC_BUS.noter`, aucune borne `stockMax`, boucle dupliquée 3626/3628)
[LOGIQUE BÂCLÉE · **mineur**] — `lotStock().vendu`, `fournisseurReporting.venduesMois` (7137-7141) et `vendeur().nbVentes` (7043) comptent les retraits comme des ventes ; 08-stock corrige localement (114) mais pas les autres écrans. Un réassort sur un lot refusé/photos à refaire est accepté. → Champ `retire` distinct de `vendu` dans `lotStock`, `stock_reassort` journalisé, réassort refusé hors `valide_publie|epuise`.

**C18. `publierPiece` accepte n'importe quoi ; seul l'écran filtre.**
`payencash-data.js:3547-3600` (aucun contrôle de `provenance`, `factureOrigine` obligatoire sur neuf, `cedant` sur rachat, `certifie`, `prix > 0`, plafond `stockMax`, verrou `fournisseurPeutPublier`) — tout est dans `03-ajouter-piece.html:595-612, 632`
[LOGIQUE ABSENTE · **majeur**] — Le banc et tout appel direct contournent le verrou juridique (CGU art. 1.1) et les obligations du livre de police. → Reporter `okStep`/`verrouPublication` dans `publierPiece` (retour `{ok:false, motif}`), comme `compteCreer` le fait.

**C19. Les pièces du seed atelier ne correspondent à aucun lot.**
`payencash-data.js:639-645` (`PC-1042…` avec `vendu:true`, réfs absentes de `mode.inventaire` 830-841)
[DUR · **mineur**] — `pieceVerdict` ne trouve pas de lot homonyme (1233-1234) : les verdicts sur ces 5 pièces n'ont aucun effet stock/expédition ; 26-fournisseurs et 34 les affichent comme de vraies pièces. → Supprimer le seed ou le dériver de l'inventaire.

## 4. Vente → expédition Mondial Relay → suivi

**C20. L'expédition ne porte ni le client ni un point relais identifiable.**
`payencash-data.js:4237-4241` (`client: cmd.client || ''`, `relais: relaisLabel()` — libellé) · `commanderPanier` 4069-4120 : l'objet `cmd` (4106-4116) n'a **aucun champ `client`** · `ui/fournisseur/04-expeditions.html:83` affiche `esc(e.client)` vide · `server/db/schema.sql:803-805` (`relay_id`, `relay_name`, `relay_address`)
[TROU · **bloquant**] — Le fournisseur est censé expédier « au client, Point Relais X » : nom, téléphone, e-mail du destinataire et identifiant du relais (exigés par l'API Mondial Relay) n'existent pas sur l'expédition. → Copier à la vente `{clientNom, clientTel, clientEmail, relaisId, relaisNom, relaisAdresse}` depuis `clientCourant()`/`relaisChoisiOuDefaut()` (ils sont disponibles à `commanderPanier:5, 28`) ; l'étiquette ne se génère pas sans.

**C21. Aucun suivi transporteur après le dépôt.**
`payencash-data.js:1587-1591` (`ref.mondialRelay.transporteur` : `en_acheminement`, `dispo_relais`, `livre`) — aucune fonction ne les pose ; `marquerExpedie` 4664-4672 s'arrête à `expedie` ; `commandesEnLivraison` 4331-4345 ne connaît que 3 étapes ; `shipments.events` (SQL 809) jamais alimenté
[TROU · **majeur**] — Le client ne sera jamais « livré », la garantie de rétractation (14 j « à compter de la réception », docs 990) et le déclencheur de virement « après contrôle » n'ont pas de date de réception. → `expeditionSuivi(ref, statutMR, at)` (simulateur/webhook), `livreTs` sur l'expédition, lu par `virerFacture`, la fiche client et le SAV.

**C22. L'étiquette est une phrase, pas un document.**
`payencash-data.js:4632-4636, 4658` (`e.etiquette = 'Étiquette Mondial Relay — … à imprimer'`, `numeroMR` déterministe) · `shipments.label_url` (SQL 802)
[STATIQUE · **majeur**] — Rien à imprimer, rien au coffre, l'expéditeur est celui de la fiche de la **session** (4655 `fournisseurEntreprise()` sans nom : si l'appel vient d'un autre contexte, mauvaise adresse). → Générer un PDF d'étiquette via `PEC_DOCS.deposerPdf('expedition', ref, 'etiquette', …)` avec expéditeur AJEK c/o fournisseur, destinataire (C20), n° MR, code-barres ; `editerEtiquette(ref)` lit `fournisseurEntreprise(e.fournisseur)`.

**C23. Réservation / vente d'une pièce dont le fournisseur est suspendu ou dont le contrat n'est plus accepté.**
`payencash-data.js:4218-4318` (`reglerCommande` ne regarde jamais `fournisseur.acces.statut` ni `fournisseurPeutPublier`) ; le catalogue (`synchroniserArticlesPublies` 3541-3549) garde en vente les lots d'un fournisseur suspendu
[LOGIQUE ABSENTE · **majeur**] — Suspendre un fournisseur (26) ne retire rien de la vente ; une commande crée une expédition qu'il ne peut pas traiter. → Suspension = lots masqués (`STATUTS_EN_VENTE` filtré sur accès actif), réservations libérées, commandes en cours transférées/annulées avec remboursement.

## 5. Retour / SAV

**C24. Le retour client ne revient jamais au fournisseur ni à la facture.**
`ui/mode/13-retour.html:214-216` (`ouvrirDemande` type réclamation, `retour.etiquette 'RET-…'`) · `payencash-bus.js:208-215` (`cloreDemande` : statut + note, rien d'autre) · `payencash-bus.js:829-840` (`rembourser` : commande seulement) · `payencash-data.js:7171-7190` (`retoursDuMois` = comptage) · contrat généré `payencash-docs.js:988-994` (« pièce non conforme … reprise, frais inclus, prix d'achat restitué ») · `server/db/schema.sql:739-751` (`mode_returns` : `restock`, `received_at`, `refunded_at`)
[TROU · **majeur**] — Aucune entité retour : pas de réception atelier, pas de décision « remise en stock / retour au fournisseur / avoir sur facture », pas d'étiquette retour réelle, la facture du fournisseur reste due/virée même si la pièce est non conforme. Côté fournisseur, aucun écran ne montre un retour (grep `ui/fournisseur/*` : seul le compteur « Retours ce mois »). → `retourCreer(cmd, ligne, motif)` → `retourRecevoir(atelier, verdict)` → si non conforme : `factureAvoir(f, montant)` + expédition retour vers le fournisseur (étiquette) + ligne « retour » dans 04/05 fournisseur ; si conforme : `entreeStock` chez AJEK (pas chez le fournisseur) + `registreSortie`… « retour ».

**C25. La contestation d'un refus part à la hotline sans délai ni issue.**
`ui/fournisseur/08-stock.html:235-238, 302-309` (`ouvrirDemande` canal `fournisseur`) · `payencash-data.js:1600` (`contestationJours: 15`) — aucune fonction ne calcule « sans réponse sous 15 j, admise » ; `ui/hotline/01-pilotage.html` ne distingue pas le canal fournisseur (grep)
[LOGIQUE ABSENTE · **mineur**] — Le contrat promet une réponse écrite sous 15 jours et l'admission tacite ; rien ne le trace. → Échéance sur la demande (`dueAt = at + 15 j`), escalade manager, et réponse qui met à jour le lot (`refuse` → `valide_publie` ou reprise).

## 6. Facture fournisseur → RIB → virement → compta

**C26. Une commande à plusieurs fournisseurs produit des factures au même identifiant et au même numéro.**
`payencash-data.js:4252` (`idF = 'AF-' + cmd.ref`), `4297-4304` (une facture par `(id, fournisseur)` mais **même `id`**) · `4573-4577` (`emettreFacture(id)` prend la première `a_facturer` d'id égal ; `numero = 'F-<année>-' + chiffres(id)` → **même numéro** pour les deux fournisseurs) · `4591-4602` (`virerFacture(id)` idem) · `ui/manager/36-facturation-fournisseurs.html:94, 98` (`data-emettre="AF-M-1234"` deux fois)
[LOGIQUE BÂCLÉE · **bloquant**] — Deux factures distinctes, deux fournisseurs, un seul numéro `F-2026-1234` (SQL `invoice_number UNIQUE` 774 refuserait l'insertion). Cliquer « Émettre » sur la seconde émet la première. → `id = 'AF-' + cmd.ref + '-' + fournisseur.id`, numérotation **séquentielle continue** par exercice (`pec-factures-seq`, miroir `invoice_number`), jamais dérivée de la réf de commande.

**C27. L'auto-facturation est faite par AJEK sans mandat, et le PDF affirme un contrôle qui n'a pas eu lieu.**
`ui/manager/36-facturation-fournisseurs.html:109` (le **manager** émet la facture du fournisseur) · `payencash-docs.js:1135-1160` (modèle `facture_fournisseur` : « Émise depuis l'espace fournisseur … les pièces facturées ont été contrôlées en atelier » 1158 ; « TVA : selon le régime du fournisseur — mention à sa charge » 1155) · pièce KYB `tva` (docs 65) jamais lue
[LOGIQUE BÂCLÉE · **majeur**] — Une facture émise par le client (AJEK) au nom du fournisseur est une auto-facturation (art. 289 I-2 CGI : mandat écrit préalable, mention « autofacturation »). Le document n'a ni régime TVA (franchise 293 B / assujetti), ni montant de TVA, ni mention d'exonération : `14-comptabilite.html:335-339` le constate (« aucune ne porte sa TVA »). Le contrat promet l'inverse (« Le fournisseur émet sa facture », docs 865). → Décider : soit mandat d'autofacturation dans le contrat + mention légale + régime TVA lu du dossier (`tva` validée) et montant calculé ; soit le fournisseur dépose sa propre facture (PDF au coffre, `deposer`) et le manager la contrôle avant virement. Retirer la phrase « contrôlées en atelier » tant que C15 n'existe pas.

**C28. Le virement part sans contrôle atelier, sans expédition, sans réception, et se déclare toujours « dans les délais ».**
`payencash-data.js:4591-4602` (seul garde-fou : `ribAControler`) · `4597` (`vireeLe = … + ' (dans les délais)'`) · `4578` (échéance = texte « sous 7 j après contrôle »)
[LOGIQUE ABSENTE · **majeur**] — Une facture peut être virée avant que le colis soit déposé. Aucune date d'échéance calculée (SQL `due_at` + `CHECK ≤ 7 j`, 771-777), donc aucun retard mesurable. → `virerFacture` exige `expedition.statut ∈ {expedie, livre}` (et le verdict si contrôle) ; `echeanceTs = declencheurTs + virementJours × 86400000` ; `vireeLe` dérivé (`retard` si `vireeTs > echeanceTs`).

**C29. Le contrôle du RIB ne vérifie rien.**
`payencash-data.js:3007-3016` (`fournisseurRibControle` : efface le drapeau) · `ui/manager/26-fournisseurs.html:192-193` (bouton « RIB contrôlé — virements autorisés » sans ouvrir la pièce)
[LOGIQUE BÂCLÉE · **majeur**] — Le manager peut lever le blocage sans qu'un nouveau RIB ait été déposé (`PEC_DOCS.get('fournisseur', id, 'rib')` non consulté) ; l'IBAN saisi n'est pas comparé au document. → Un changement d'IBAN remet la pièce `rib` en `manquante` (ou `a_remplacer`), le drapeau ne tombe qu'à `statuer(rib, 'validee')` avec la date de dépôt postérieure au changement, et le virement lit `iban_last4` de la pièce validée.

**C30. Les écritures d'achat sont datées « maintenant » à chaque rendu.**
`payencash-data.js:2645-2647` (`at: f.at || Date.now()` — les factures n'ont jamais `at`)
[LOGIQUE BÂCLÉE · **majeur**] — 14-comptabilite et 21-compte-resultat filtrent par mois sur `at` : toute facture émise apparaît dans le mois **courant**, quel que soit son mois d'émission, et change de mois avec le temps. → `at: f.emiseTs` (journal Achats) et une seconde écriture Trésorerie à `f.vireeTs`.

**C31. « Solde fournisseur » et « Finance » ignorent les fournisseurs Mode.**
`ui/manager/13-solde-fournisseur.html` (uniquement Duffel/Nuitée : `D.soldeVoyage`, `achatsVoyage`) · `ui/manager/08-finance.html:118-125, 186-191` (« coût fournisseur » = voyage) · `08-finance.html:290` (marge Mode = `ttc − ttc/coef`, jamais les factures réelles)
[TROU · **majeur**] — Aucun écran ne donne, par fournisseur Mode : dû (`a_facturer`), émis non viré, viré, avoirs, exposition (retard). La marge Mode affichée ignore remises, campagnes, re-cotes qui réduisent le prix d'achat. → Un onglet « Fournisseurs Mode » dans 13 (ou 36) : soldes par fournisseur dérivés de `facturesGet`, marge Mode = `Σ prix client − Σ montant facture` par commande.

**C32. Le journal du bus est plafonné à 200 événements ; plusieurs écrans en dépendent pour des faits contractuels.**
`payencash-bus.js:246-247` (`j.slice(0, 200)`) · `ui/manager/26-fournisseurs.html:203-206, 225` (fiche modifiée / IBAN) · `ui/fournisseur/09-compte-entreprise.html:183-186` (avenants acceptés = `campagne_acceptee`/`demarque_acceptee` du journal)
[PERTE DE DONNÉE · **majeur**] — Après 200 événements (le banc en produit des centaines), la preuve d'acceptation d'un avenant de prix (art. 1193 C. civ., docs 996-1000) et l'alerte « IBAN modifié » disparaissent. → Persister les acceptations d'avenant dans leur propre table (`consents`/`markdowns.decided_at`, déjà prévues), et le journal d'audit sans plafond (ou archivage), à part du fil « live ».

**C33. Réinitialisations de démo sur des données légales.**
`ui/manager/36-facturation-fournisseurs.html:115` (`facturesReset`) · `34-atelier.html:210` (`atelierReset`) · `38-invendus-mode.html:125` (`invendusReset`) · `35-stock-mode.html:123` (`stockReset`) · `payencash-data.js:4212` (`registreReset`)
[PERTE DE DONNÉE · **mineur** (maquette) / majeur en prod] — Un bouton efface factures, verdicts et démarques (conservation 10 ans, docs 1602). → Retirer des écrans manager (ou garder sous `scenario.demo`).

## 7. Invendus, démarques, remise AJEK, codes promo

**C34. La liste des invendus est figée : l'ancienneté n'est jamais calculée.**
`payencash-data.js:3536` (`ageJours: 0` pour tout article dérivé d'un lot) · `3970-3974` (`catalogueInvendus` lit `a.ageJours`) · seed `328-363` (`ageJours: 6/3/34/41` écrits) · `ui/manager/38-invendus-mode.html:98-116`
[STATIQUE · **majeur**] — 38 ne montre que les articles du seed dont `ageJours ≥ 30` (robe, sac) ; aucune pièce publiée par un fournisseur n'y entrera jamais. → `ageJours = (Date.now() − lot.publieTs) / 86400000`, sans vente depuis (`mouvements`).

**C35. « Retirer du catalogue » écrase la démarque, sans motif, sans journal, sans retour.**
`payencash-data.js:3963` (`retirerCatalogue` : `m[id] = { pct, retire: true }` — perd `statut, fournisseur, minAchat, proposeeAt, decideeAt, motif`) · aucune fonction inverse · `ui/manager/38-invendus-mode.html:123-124`
[PERTE DE DONNÉE + LOGIQUE ABSENTE · **mineur**] — Le fournisseur n'est pas prévenu (contrat : « le fournisseur peut la retirer librement », rien sur AJEK), la pièce reste dans son stock « Retirée » sans pouvoir la réactiver. → `Object.assign`, motif, `PEC_BUS.noter('retrait_catalogue')`, `remettreCatalogue`, ligne sur 02-accueil.

**C36. Décisions de remise/campagne sans contrôle de propriété.**
`payencash-data.js:3789-3800` (`demarqueDecider` : n'importe quel `fournisseurCourant` décide) · `3843-3853` (`campagneRepondre` : le nom passé n'est pas vérifié dans `c.fournisseurs`)
[LOGIQUE ABSENTE · **mineur**] — Les écrans filtrent, la couche données non. → Refuser si `d.fournisseur !== fournisseurCourant` / `c.fournisseurs.indexOf(nom) === -1`.

**C37. Codes promo : validation minimale et statut mal lu côté manager.**
`payencash-data.js:4722-4741` (`ajouterCodeFournisseur` : ni `valeur > 0`, ni `pourcent < 100`, ni appartenance des `articles` au fournisseur) · `4744` (`codesDuFournisseur` : `!c.fournisseur ||` — un code sans propriétaire est « à tout le monde ») · `ui/manager/26-fournisseurs.html:398-401` (`STC[c.statut]` lit le statut brut : un code expiré s'affiche « Actif », `desactive` s'affiche en brut) · SQL `supplier_promo_codes.value > 0` (785)
[LOGIQUE BÂCLÉE · **mineur**] → Contrôles dans la couche données, `codeStatut(c)` dans 26.

**C38. Campagne AJEK : seul le type « euros » est exposé et il n'existe pas de table miroir.**
`ui/manager/38-invendus-mode.html:155-162` (`type: 'euros'` figé) · `payencash-data.js:3806-3836` (`pec-campagnes`) · `server/db/schema.sql` : seule `ad_campaigns` (marketing) existe ; `markdowns` (1565) ne porte pas les campagnes de panier
[SCHÉMA · **mineur**] → Table `basket_campaigns` + `basket_campaign_responses`, et le choix `pourcent` à l'écran (déjà géré par `campagneCreer`).

## 8. Livre de police (art. 321-7)

**C39. Une ligne par lot, une seule sortie par lot : le registre ne suit pas chaque objet.**
`payencash-data.js:4206-4212` (`registreSortie(lotRef, cmdRef)` : `if (m[lotRef]) return false`) · `4179-4204` (`registreGet` : une ligne par lot, `tailles×qté` agrégées) · `server/db/schema.sql:1585` (`lot_ref UNIQUE`)
[LOGIQUE BÂCLÉE · **majeur**] — Un lot de 7 pièces vendu en 3 commandes : la première vente marque tout le lot « Vendu · M-1234 », les deux autres ne sont jamais inscrites ; les retraits (`sortieStock 'retrait'`) et retours n'ont aucune sortie. Le schéma reproduit le défaut. → Une ligne par **unité** (lot × taille × n°), sortie par unité avec nature (vente / retrait / retour / destruction), `police_register_exits` ou `exit_*` par unité.

**C40. Registre ni daté, ni immuable, ni numéroté de façon stable.**
`payencash-data.js:4187` (`entree: lot.cree` = libellé « à l'instant » / « il y a 3 j » figé à la création, alors que `creeTs` existe) · `4185` (`ligne = seed.length + i` recalculé : un `inventaireReset` ou un lot supprimé renumérote tout) · `881-886` (4 lignes de seed écrites, dont « Particulier (M. D.) », `réf 2408/820/97` inexistante) · `ui/manager/37-livre-police.html:60` (rendu une fois, sans écoute du bus) · `ui/manager/14-comptabilite.html:413` (export = seed seulement)
[DUR + STATIQUE · **majeur**] — Un registre « coté et paraphé » qui affiche « à l'instant » comme date d'entrée, dont la numérotation dépend de l'ordre d'un tableau réinitialisable, et dont l'export CSV ignore les vraies pièces. → Écriture **append-only** d'une ligne numérotée à la publication (`registreEntree(lot)` avec `creeTs` formaté), stockée à part de l'inventaire ; supprimer le seed ; export depuis `registreGet`.

**C41. Le cédant « Pro · identité au dossier KYB » n'identifie personne.**
`payencash-data.js:4192` (repli quand `e.siret` manque — cas de tout fournisseur inscrit, cf. C4) et sinon SIRET **fabriqué** masqué
[DUR · **majeur**] — Le registre doit identifier le cédant (dénomination, SIREN réel, adresse). → Lire les mentions du Kbis validé ; bloquer la publication tant qu'elles manquent.

## 9. Contact, notifications, journal, miroir SQL

**C42. Aucun canal manager ↔ fournisseur.**
`ui/fournisseur/14-contact-preferences.html:47` (« aucun écran de cet espace ne rend de notifications ») · `payencash-data.js:5234-5375` (`notifs()` = clients uniquement) · `payencash-fournisseur.js:246-263` (préférences seulement) · côté manager : aucun bouton « écrire au fournisseur » (26, 34, 36, 38)
[TROU · **majeur**] — Refus atelier, IBAN à contrôler, facture virée, pièce retirée, campagne proposée : rien n'est notifié ; le fournisseur découvre en naviguant. Les préférences `ventes/expeditions/virements/messages/offres` ne pilotent rien. → `notifsFournisseur(nom)` dérivé (verdicts, factures, expéditions, propositions, refus de pièce KYB, contestations) + cloche sur 02, et `support_conversations` scope fournisseur pour le message libre (`chat_messages` existe).

**C43. Le journal des flux ignore les événements fournisseur.**
`ui/manager/27-journal-flux.html:61-66` (4 types typés) · `payencash-data.js:1639` (`auditLibelles` : absents `photos_resoumises`, `atelier_verdict`, `demarque_acceptee/refusee`, `campagne_acceptee/refusee`, `campagne_creee` est libellée « Campagne marketing créée », `kyb_frais`, `export` sans espace…)
[STATIQUE · **mineur**] → Compléter `auditLibelles`, acteur = `e.par || e.fournisseur`.

**C44. Miroir SQL incomplet ou contradictoire.**
`server/db/schema.sql:475-485` (`suppliers` : ni SIREN/SIRET, ni adresse, ni contact, ni catégories/spécialités, ni `compte`) · `798-812` (`shipments` : pas de `supplier_id`, ni lot/article, ni expéditeur — impossible de savoir qui expédie) · `753-764` (`purchase_orders` par article vs facture `AF-<cmd>` groupée par fournisseur, `final_buy_price_cents`/`controle` jamais alimentés) · `766-778` (`supplier_invoices` : pas de régime/montant TVA, pas d'avoir) · `payencash-bus.js:879-888` (`STATUT_SQL` : aucun cycle `lot.status`, `pieces.status`, `expedition.statut`, `facture.statut`, `demarque.statut`, `acces.statut`) · `ESPACE-COMMERCANT/documents/partie-6-donnees.html:114` (suppliers = 6 colonnes, conforme au SQL donc mêmes trous)
[SCHÉMA · **majeur**] → Ajouter `supplier_legal (siren, siret, vat_regime, rcs, address…)` alimenté par les pièces validées, `shipments.supplier_id/order_item_id/sender_*`, `supplier_invoice_lines`, `credit_notes`, et étendre `STATUT_SQL` aux 6 cycles fournisseur (ZT·419 ne les contrôle pas).

**C45. Écran 25-mode : colis, contrats et KYB statiques.**
`ui/manager/25-mode.html:130` (« Colis en cours » = commandes `en_cours`, jamais `expeditionsGet`) · `161-166` (`fournisseursModeGet` : `contrat: "Contrat-cadre d'achat ferme"` dès `kyb === 'valide'`, sans lire le coffre) · `133-135` (KYB depuis `f.kyb`, cf. C2)
[STATIQUE · **mineur**] → Dériver de `expeditionsGet()`, `PEC_FOURN.contratEtat`/`PEC_DOCS`.

**C46. 26-fournisseurs : blocs rendus une seule fois et compteur mort.**
`ui/manager/26-fournisseurs.html:325-410` (KPI atelier/factures/codes calculés au chargement, seul `kpis()` réécoute `pec-comptes-maj` ; pas d'écoute `pec-bus`) · `351-354` (`nbQuali = aControler.length − nbPhotos` = toujours 0)
[UX FLUX · **mineur**] → Envelopper dans une fonction rejouée sur `pec-bus`/`storage`, supprimer le compteur.

**C47. Publication visible côté Mode seulement au rechargement.**
`payencash-data.js:7574` (`synchroniserArticlesPublies()` appelé uniquement au boot) — après `pieceVerdict('photos_ok')` dans un onglet, `mode.articles` de l'onglet client déjà ouvert n'est pas mis à jour tant que la page ne recharge pas
[UX FLUX · **mineur**] → Appeler `synchroniserArticlesPublies` sur `pec-bus`/`storage` (ou dans `pieceVerdict`).

---

## Bilan — les 10 manques prioritaires pour que la chaîne tienne de bout en bout

| # | Manque | Constats | Taille |
|---|--------|----------|--------|
| 1 | **Ordre KYB inversé** : validation du compte sans pièce, activation = KYB « valide », deux vérités KYB. Un seul état dérivé du coffre, validation conditionnée à `PEC_DOCS.complet` + contrat signé, transfert du dossier de candidature. | C1, C2, C13 | **M** |
| 2 | **Identité légale et IBAN fabriqués** dans la fiche, le contrat et les factures : zéro repli, champs issus des pièces validées, blocage des documents tant qu'ils manquent. | C4, C41 | **M** |
| 3 | **Photos et facture d'origine réellement stockées** (coffre par lot), atelier qui ouvre les images, fiche Mode qui les affiche, livre de police qui pointe un vrai fichier. | C14 | **M** |
| 4 | **Destinataire et relais sur l'expédition** + étiquette-document + suivi transporteur (livré) : sans quoi rien ne s'expédie ni ne se livre. | C20, C21, C22 | **M** |
| 5 | **Contrôle aléatoire réel** (`bloque_controle` posé à la vente, réception atelier, verdict → réexpédition / remboursement / avoir) et re-cote soumise à l'accord du fournisseur. | C15, C16, C19 | **L** |
| 6 | **Facturation juridiquement tenable** : ids/numéros uniques et séquentiels (multi-fournisseurs), mandat d'autofacturation ou dépôt de facture par le fournisseur, régime et montant TVA lus du dossier, échéance calculée, virement conditionné à l'expédition/réception, écritures datées à l'émission. | C26, C27, C28, C30 | **L** |
| 7 | **Retour / SAV bouclé jusqu'au fournisseur** : entité retour, réception atelier, remise en stock ou avoir sur facture, écran fournisseur, contestation avec délai. | C24, C25 | **L** |
| 8 | **Livre de police par unité, append-only, daté, non réinitialisable**, cédant identifié ; suppression du seed. | C39, C40, C33 | **M** |
| 9 | **Canal manager ↔ fournisseur** (fil de notifications dérivé + messagerie) et preuves d'avenants hors du journal plafonné à 200. | C42, C32, C43 | **M** |
| 10 | **Cycle de vie du compte fournisseur complet** : suspension propagée au compte et au catalogue, résiliation avec préavis, contrat versionné/contresigné, pièces à renouveler avec échéance, invendus calculés sur la date réelle. | C5, C6, C23, C12, C9, C34 | **M** |

Restent en « petit » (S) : C3 (mot de passe en clair), C7, C8, C10, C11, C17, C18, C29, C35, C36, C37, C38, C44 (partie STATUT_SQL), C45, C46, C47 — chacun se règle en une fonction ou un écran, mais C3, C18 et C29 sont à traiter avant toute démonstration à un tiers.
