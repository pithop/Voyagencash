

######## marque-compte — La marque et son compte Solution (39 confirmés, 7 oublis, 0 réfutés)

[0] g1 impasse | ui/marchand/00-inscription.html ; ui/marchand/10-compte.html ; ui/assets/payencash-data.js ; ui/manager/42-verifications.html | #ti-benef-plus-tard → techMarchandSoumettre → techMarchandValider
  Une marque qui choisit « Déclarer plus tard » peut envoyer son inscription, mais aucun écran ne lui permet ensuite de déclarer ses bénéficiaires : la validation par le manager est alors refusée à jamais, et ni Compte ni « À faire » ne disent pourquoi.
  corr: Ajouter dans 10-compte › Identité une carte « Mes bénéficiaires effectifs » (ancre #beneficiaires) qui monte PEC_INSCRIPTION.beneficiaires et appelle D.techMarchandBeneficiairesSet. Ajouter un manque { cle:'beneficiaires', libelle:'Bénéficiaires effectifs à déclarer', href:'10-compte.html?s=identite#beneficiaires' } dans techMarchandPeutTravailler et dans PEC_TECH.aFaire (branche pending), quand D.beneficiairesEtat(...).ok est faux. Le lister dans finir() de 00-inscription, dans actifs() et suiteHTML de 42 (étape « Bénéficiaires déclarés », bouton seulement si c'est fait) et dans 46. Corriger le motif de techMarchandValider pour qu'il pointe vers cette carte.

[1] g1 casse | ui/assets/payencash-data.js ; ui/assets/payencash-docs.js ; ui/marchand/10-compte.html | techKycDirigeant / techMarchandDirigeantSet / DOCS.signer (signataireAttendu)
  Le KYC du signataire n'est lié à aucune personne : on peut changer le dirigeant après le contrôle de la pièce et garder « Identité vérifiée », puis signer le contrat-cadre au nom du nouveau dirigeant avec la pièce de l'ancien. Le contrôle du représentant légal lu sur le Kbis est aussi court-circuité.
  corr: Ajouter DOCS.MENTIONS.cni (nom, prénom, date de naissance, fin de validité), relevées par le contrôleur à la validation. techKycDirigeant compare ces mentions à m.dirigeant et refuse avec {refus:'kyc_autre_personne'} si elles diffèrent, ou {refus:'kyc_expire'} si piece.expireLe est dépassé. techMarchandDirigeantSet remet l'étape identité à faire quand nom, prénom ou date de naissance changent. DOCS.signer compare le nom complet, et aussi mentions.dirigeant du Kbis quand ce relevé existe. 10-compte et 46 signalent un contrat signé par une autre personne que le dirigeant courant.

[2] g1 promesse_sans_logique | ui/assets/payencash-docs.js ; ui/manager/10-configuration.html ; ui/marchand/10-compte.html | DOCS.CONDITIONS (absence de contrat_marchand) / conditionsEcart
  Le contrat-cadre de la marque ne fige aucune condition : un changement de taux en Configuration, un changement d'offre ou de réponses TVA s'appliquent sans avenant, alors que le contrat et le code annoncent un avenant. Le manager peut payer les marques à un taux qu'elles n'ont pas signé.
  corr: Ajouter CONDITIONS.contrat_marchand(ctx), qui fige la grille des offres (remise et délai de chaque offre, pas seulement de l'offre choisie), le régime TVA dérivé (techMarchandTva), dureeContratMois et le préavis. Lire explicitement DOCS.conditionsEcart('marchand', id, 'contrat') dans 10-compte › Documents (#contrat, « Signer l'avenant »), dans 46 et dans techMarchandPeutTravailler : dossier() ne le calcule pas pour une pièce horsDossier. Le changement d'offre de la marque reste libre, comme l'écrit le contrat. Corriger le commentaire l.886 dans ce sens.

[3] g1 promesse_sans_logique | ui/assets/payencash-docs.js ; ui/assets/payencash-data.js ; ui/marchand/08-paiement.html | contrat_marchand art. FACTURATION / techFactureEmettre
  Le contrat signé promet l'autofacturation des ventes de bons de la marque (mise à disposition dans l'Espace) et, pour un bon à usages multiples, une facture de notre prestation de distribution avec TVA : aucune de ces factures n'existe. Seules les factures d'abonnement sont possibles.
  corr: Générer l'autofacture à chaque techReglementEmettre : pour un bon à usage unique (BUU), TVA au taux des biens et remise en réduction ; pour un BUM, un document hors champ plus la facture de distribution avec TVA. Créer les modèles DOCS.MODELES.autofacture_marque et facture_distribution, rangés au coffre sous pec-doc:marchand:<id>:autofacture-<VIR>, listés dans 08-paiement et 46, avec une table au schéma. Aligner le motif de techFactureEmettre. À défaut, retirer ces promesses du contrat et de la CGU 8.4.

[4] g1 casse | ui/assets/payencash-data.js ; ui/marchand/10-compte.html ; ui/manager/45-marchand-paiements.html | techMarchandRib / techMarchandRibEnregistrer / techReglementEmettre
  Le RIB tapé par la marque, jamais contrôlé, passe avant le RIB contrôlé du dossier : un compte compromis détourne les virements d'un geste, et le manager ne voit aucun écart au moment de virer.
  corr: Faire du RIB saisi une pièce rib « déposée » au coffre, à contrôler. techMarchandRib ne rend que le RIB des mentions validées ; plus de copie figée dans m.rib, ou alors une copie invalidée dès que la pièce change. techReglementEmettre refuse avec {refus:'rib_a_controler'} tant qu'un RIB saisi n'est pas contrôlé ou que le titulaire diffère de la raison sociale. 45 et 46 affichent l'écart. Journal et e-mail à la marque à chaque changement d'IBAN.

[5] g1 impasse | ui/assets/payencash-data.js ; ui/marchand/10-compte.html ; ui/marchand/02-espace.html ; documents/cgu-espace-solution.html | techQuota.seuilAtteint / techBonEmettre refus 'seuil_acpr'
  Une fois le seuil atteint, l'édition est bloquée « jusqu'à la déclaration », mais rien ne permet d'enregistrer cette déclaration : la marque reste bloquée jusqu'à ce que les 12 mois glissent. L'accompagnement promis et la communication mensuelle de la valeur n'ont aucune logique.
  corr: Ajouter un état m.acpr { declareeLe, reference, pieceCoffre, actualiseeLe } posé par techMarchandAcprDeclarer (dépôt dans Compte › Règles, constat par le manager en 46) ; seuilAtteint ne bloque que si aucune déclaration à jour n'existe ; un geste « Préparer ma déclaration » qui génère le document ; un relevé mensuel (coffre + e-mail) ou retirer la promesse.

[6] g1 casse | ui/assets/payencash-data.js ; documents/conditions-logiciel-solution.html ; ui/marchand/10-compte.html ; ui/manager/45-marchand-paiements.html | techMarchandFormuleChoisir / techAbonnementsFacturer / techAbonnementDu
  Le changement de formule « s'applique au mois en cours » mais n'est jamais facturé : la facturation du mois lit la formule au moment du clic du manager. Une marque passe à l'Illimité* le 2, édite sans limite avec son site tout le mois, revient à l'Offert avant le 1er suivant : rien n'est facturé.
  corr: Au passage vers une formule payante, générer et émettre immédiatement l'échéance du mois en cours (prix plein ou prorata dit dans l'annexe 2), ou facturer à terme échu la formule la plus haute détenue dans le mois (historique des formules daté sur la marque) ; la rétrogradation n'efface jamais un mois consommé.

[7] g1 manque_fonctionnel | ui/assets/payencash-data.js ; ui/marchand/10-compte.html ; ui/manager (aucun écran) | techAbonnementsFacturer / techMarchandCarteEnregistrer / techFactureDebiter
  Un débit refusé n'est jamais relancé : la tâche ne traite que le mois courant, enregistrer une nouvelle carte ne redébite rien, aucun écran du manager ne liste les factures, et l'impayé n'a aucune conséquence (formule et site conservés). L'argent est perdu sans que personne ne le voie.
  corr: techAbonnementsFacturer traite toutes les échéances 'du' et 'impaye', quelle que soit leur période. techMarchandCarteEnregistrer redébite les factures en échec. Ajouter un écran manager (45 ou 46) listant factures et échecs, avec « Redébiter ». Appliquer la règle écrite à l'annexe 2 : une facture impayée au-delà d'un délai du référentiel ramène la marque à la formule offerte (fin du site et du quota), dans techMarchandFormule. Exiger une carte valide dans techMarchandFormuleChoisir vers une formule payante.

[8] g1 incoherence | ui/marchand/00-inscription.html ; ui/assets/payencash-docs.js ; ui/assets/payencash-data.js ; ui/assets/payencash-bons.js ; ui/marchand/08-paiement.html | #ti-sans-site / contrat_marchand / techMarchandDestination / techBlocBon
  L'option « Ma marque n'a pas de site » produit trois vérités contradictoires : la déclaration dit « ses propres points de vente », le contrat signé garantit un usage « exclusivement sur son propre site » (« exploitant le site — »), et Mes bons, le bloc et le partage écrivent « Utilisable uniquement sur » suivi de rien ou « notre site ». Aucun point de vente ne peut être déclaré, et une marque sans site qui prend l'Illimité* fait utiliser ses bons en ligne hors du périmètre déclaré.
  corr: Créer une seule fonction D.techMarchandPerimetre(m) (site propre, site hébergé, ou points de vente déclarés avec leurs adresses), lue par la déclaration, le contrat (objet, réseau limité, parties), payencash-bons.js, techBlocBon, le texte de partage de 08-paiement, portes.tech et Mes bons. Exiger une nouvelle déclaration quand le site hébergé s'active ou change de domaine. Si l'option « sans site » est gardée, ajouter la saisie des points de vente propres ; sinon, la retirer.

[9] g1 promesse_sans_logique | ui/marchand/00-inscription.html ; ui/assets/payencash-docs.js ; documents/cgu-espace-solution.html | DOCS.statuer (pièce video)
  La vidéo du dirigeant est annoncée « regardée par une personne, puis supprimée » ; elle reste au coffre indéfiniment après le contrôle (règle RGPD affichée et fausse).
  corr: Dans DOCS.statuer, pour une pièce `video`, dès 'validee' ou 'refusee' : supprimer d.data (garder date, contrôleur, empreinte) et noter 'video_supprimee' ; afficher « supprimée après contrôle le … » dans 42/46.

[10] g1 promesse_sans_logique | ui/assets/payencash-data.js ; documents/cgu-espace-solution.html | techMarchandPeutTravailler / techBonEmettre
  Les CGU acceptées disent qu'une pièce périmée (Kbis, RBE) suspend l'édition de nouveaux bons ; le coffre marque bien la pièce « à renouveler », mais ni le verrou ni l'émission ne la lisent : la vente continue.
  corr: Ajouter à techMarchandPeutTravailler un manque { cle:'dossier', libelle:'Pièce à renouveler : …', href:'10-compte.html?s=identite#dossier' } quand PEC_DOCS.etat('marchand', id).etat n'est pas 'valide' (avec garde si le coffre n'est pas chargé) ; notification manager et À faire.

[11] g2 incoherence | ui/assets/payencash-data.js ; ui/marchand/10-compte.html | techMarchandPeutTravailler manque 'statut'
  Une marque suspendue (ou en brouillon) lit « Compte en attente de vérification. » dans Compte › Documents, et le comptoir refuse ses bons avec ce même motif ; le lien mène au dossier au lieu de l'aide. Le hub dit aussi « il s'active quand ton dossier est contrôlé » alors que l'activation est un geste du manager qui exige aussi la déclaration et les bénéficiaires.
  corr: Libellé et adresse dérivés du statut : draft → « Inscription à terminer » (00-inscription.html), pending → D.techStatutLbl('pending'), suspended → « Compte suspendu — » + motif (10-compte.html?s=aide) ; hub : « il s'active quand nous avons contrôlé ton dossier, validé ta déclaration et tes bénéficiaires ».

[12] g2 incoherence | ui/marchand/10-compte.html ; ui/manager/46-marques.html | #tc-decl-txt / #tc-decl-go ; libellé 'rejected' en 46
  Après un refus, la marque corrige sa déclaration dans un champ libre, contre la décision « texte type coché » : elle peut écrire n'importe quoi (le placeholder est même vide sans site). Le manager voit une déclaration refusée comme « à statuer » en 46 mais « refusée, à corriger » en 42.
  corr: Dans Compte : le texte type (techMarchandDeclarationTexte) et une case → techMarchandDeclarer, avec le motif du refus au-dessus ; le geste n'apparaît qu'après un refus. Créer D.techConformiteEtat(c) → a_statuer | refusee | validee, lue par 46, 42, 20-notifications et 10-compte. Dans 46, pas de « Valider » sur une déclaration refusée tant qu'aucune correction n'a été déposée.

[13] g2 impasse | ui/marchand/00-inscription.html ; ui/marchand/10-compte.html | carte « Mon identité légale » ; #tc-rappel-go
  Après l'envoi, la marque ne peut plus changer son site, son téléphone ni son adresse, alors que les CGU l'obligent à signaler tout changement sous quinze jours ; sans téléphone, la demande de rappel renvoie à « Identité », où aucun champ n'existe.
  corr: Ajouter dans Compte › Identité un formulaire « Mon entreprise » (site ou sans site, téléphone, adresse) via techMarchandEntrepriseSet ; un changement de site ou de raison sociale relance la déclaration (techMarchandDeclarer) et un contrôle ; le message du rappel vise ce champ (#entreprise).

[14] g2 incoherence | ui/assets/payencash-data.js (techBoutiques) ; ui/titres/07-boutiques.html ; ui/titres/08-boutique.html ; ui/assets/payencash-comment-payer.js | techBoutiques / techRencontre / PEC_OU
  Mes bons et le parcours « Où l'acheter » proposent le bon d'une marque dont le forfait du mois est épuisé ou le seuil ACPR atteint : le client se déplace ou fait venir un nomade, et la vente est refusée au comptoir.
  corr: Brancher D.techMarchandVendable (ou techMarquesVendables) dans techBoutiques (achat:null + phrase « ne vend plus de bons ce mois-ci »), PEC_OU, la demande de rencontre, partenaire/03-vendre marques(), 02-accueil, techLienCreer, techVenteLienCreer et techBlocBon.

[15] g2 contourne | ui/assets/payencash-data.js ; ui/marchand/03-documentation.html ; ui/manager/20-notifications.html | techLienCreer / techBlocBon / techMarchandPeutTravailler (contrat)
  Le bon proposé et le bloc « bon d'achat » testent seulement le statut (et la déclaration) au lieu du verrou : une marque sans contrat signé ni documents acceptés propose quand même des bons. Le verrou n'exige pas la contresignature, alors que la documentation dit que le contrat n'est complet qu'à ce moment ; 20-notifications présente le contrat contresigné comme préalable de la validation, que techMarchandValider n'exige pas.
  corr: techLienCreer et techBlocBon appellent techMarchandPeutTravailler ; trancher la contresignature : manque 'contrat_contresigne' (« en attente de notre contresignature ») ou texte disant que la signature de la marque suffit ; aligner le détail de 20-notifications sur techMarchandValider.

[16] g2 casse | ui/assets/payencash-data.js ; ui/assets/payencash-docs.js ; ui/marchand/10-compte.html | techMarchandContratSigner
  Le tampon « signé » est écrit même si le PDF n'a pas pu entrer au coffre (coffre plein, fréquent avec la vidéo) : la marque est dite signée, le manager ne peut jamais contresigner (« Document introuvable »), et Compte n'offre plus aucun geste pour re-signer.
  corr: N'écrire le tampon qu'après la résolution de PEC_DOCS.signer (rendre une promesse ou un rappel), afficher l'échec ; tant que contratSigneLe existe sans PDF au coffre, proposer « Régénérer le contrat signé » et le signaler en 46.

[17] g2 manque_fonctionnel | ui/assets/payencash-data.js ; ui/assets/payencash-docs.js ; ui/marchand/03-documentation.html ; ui/manager/46-marques.html | TECH_STATUTS / état 'echu' / dureeContratMois
  Aucune fin n'existe pour une marque : pas de refus d'inscription, pas de clôture ni de résiliation, pas de terme du contrat « 12 mois fermes sans reconduction », pas de rappel de la clause de rendez-vous à 6 mois, et les brouillons ne sont jamais purgés. L'état « echu » de la documentation n'est produit par rien.
  corr: Ajouter les statuts 'refused' (motif) et 'closed' (fin de contrat ou résiliation, date, motif), une échéance dérivée techMarchandContratEcheance(m) = contratSigneLe + dureeContratMois (manque 'contrat_echu' + renouvellement = nouveau contrat), un rappel à 6 mois dans 20-notifications, un geste « Résilier » motivé (bons en circulation honorés), et une règle de purge des brouillons.

[18] g2 manque_fonctionnel | ui/assets/payencash-data.js (MESSAGES_CATALOGUE) ; ui/assets/payencash-fil.js ; ui/marchand/* | MESSAGES_CATALOGUE / fil de la marque
  La marque n'a aucun fil de notifications, et le catalogue d'e-mails ne couvre ni la déclaration refusée, ni une pièce refusée, ni la contresignature, ni le quota épuisé ou le seuil proche : elle n'apprend ces décisions qu'en ouvrant Compte.
  corr: Ajouter au catalogue declaration_refusee (tech_conformite_a_corriger), piece_refusee (document_refuse si portée marchand), contrat_contresigne, quota_epuise, seuil_acpr_proche ; un fil dérivé pour la marque (même principe que filPro) avec une cloche dans PEC_TECH.entete.

[19] g2 promesse_sans_logique | ui/marchand/10-compte.html ; ui/assets/payencash-data.js (ref.juridique.conservation) ; documents/cgu-espace-solution.html | carte « Le cadre juridique » (CONS_LBL)
  Compte et les CGU promettent une copie de pièce d'identité « filigranée » et la suppression d'un compte « après 2 ans sans connexion » : aucune de ces deux règles n'est exécutée.
  corr: Filigraner les images à leur dépôt (texte « Copie PayEnCash — vérification — date ») dans DOCS.deposer, et ajouter une tâche manager de purge des comptes inactifs depuis 2 ans ; sinon reformuler ce qui est réellement fait.

[20] g2 promesse_sans_logique | ui/marchand/10-compte.html ; ui/assets/payencash-data.js ; ui/marchand/11-site.html | carte « Mon site web » / techMarchandSite.actif
  L'écran promet un enregistrement DNS communiqué à l'activation, qui n'existe nulle part. Et le site hébergé s'éteint dès une suspension ou un retour à une formule sans site : pour une marque sans site propre, les porteurs de bons en circulation perdent le seul endroit où les dépenser, alors que le contrat oblige à les honorer.
  corr: Afficher l'enregistrement DNS depuis ref.tech.siteHebergement (ou retirer la phrase) ; garder un espace de dépense (commande + bouton du bon) actif tant que des bons de la marque sont en circulation ; prévenir la marque avant une rétrogradation qui éteint son site.

[21] g2 promesse_sans_logique | ui/marchand/03-documentation.html ; ui/marchand/10-compte.html | EP '/api-keys' DELETE, '/merchants/{id}/status', '/payouts', '/direct-debits', '/audit-logs'
  La documentation promet de révoquer une clé (DELETE /api-keys → techCleRevoquer) : la fonction n'existe pas, et Compte ne propose que « Régénérer ». Elle expose aussi à la marque des points d'entrée réservés au manager (valider sa propre marque, virements, prélèvements, journal d'audit complet).
  corr: Ajouter techCleRevoquer(marchandId, motif) et un bouton « Révoquer sans remplacer » dans Compte › Intégration ; marquer les points d'entrée du back-office « réservés à PayEnCash » ou les retirer de la documentation des marques.

[22] g2 manque_fonctionnel | ui/marchand/10-compte.html ; ui/marchand/08-paiement.html ; ui/assets/payencash-docs.js | liste des factures (fac.slice(0, 6))
  Une facture d'abonnement n'est qu'une ligne : aucun document à ouvrir ou télécharger, et l'identité de l'acheteur n'est pas figée à l'émission ; l'écran promet « la facture t'arrive par e-mail ».
  corr: Modèle DOCS.MODELES.facture_abonnement (mentions obligatoires, identité de la marque relevée au coffre et figée par techFactureEmettre), rangé au coffre, bouton « Télécharger » dans Compte et Paiement.

[23] g2 incoherence | ui/marchand/02-espace.html ; ui/marchand/10-compte.html ; ui/assets/payencash-data.js | quotaHTML / carte « Seuils et règles »
  La jauge présente comme « % du seuil » légal la seule valeur vendue par notre réseau, alors que le contrat laisse la marque vendre ses bons en direct : la marque peut se croire loin d'un seuil qu'elle a dépassé.
  corr: Libeller « part vendue par notre réseau » et dire que le seuil porte sur l'ensemble de ses opérations ; optionnellement un champ déclaratif du volume direct additionné à la jauge (base de calcul à faire valider par l'avocat).

[24] g2 promesse_sans_logique | ui/manager/10-configuration.html ; ui/assets/payencash-data.js ; documents/conditions-logiciel-solution.html | data-p tech.formule.*.prix / bonsMax
  Le manager change le prix ou le quota d'une formule en Configuration ; l'annexe 2 acceptée garde sa version, aucune ré-acceptation n'est demandée et la marque est facturée au nouveau prix, alors que l'annexe promet une nouvelle version présentée à l'acceptation.
  corr: Dériver la version de l'annexe 2 des paramètres (version + empreinte des formules) pour que documentsEtat marque aRelire ; figer le prix accepté par marque et facturer ce prix jusqu'à la nouvelle acceptation.

[25] g2 incoherence | ui/assets/payencash-docs.js ; ui/assets/payencash-data.js | PIECES.marchand rbe
  L'extrait du registre des bénéficiaires effectifs est obligatoire pour toute marque, y compris une entreprise individuelle que le data-layer dispense de bénéficiaires ; le commerce partenaire, qui déclare aussi ses bénéficiaires, n'a pas cette pièce.
  corr: `condition: function (id) { return !PEC_DATA.estEntrepriseIndividuelle((PEC_DATA.techMarchand(id) || {}).formeJuridique); }` sur la pièce rbe (dossier() gère p.condition) ; aligner la règle entre marque et partenaire.

[26] g2 contourne | ui/manager/42-verifications.html ; ui/assets/payencash-data.js | suiteHTML « Activer le compte » → techMarchandValider
  Une marque suspendue se réactive par « Activer le compte » dans le dossier de 42, sans le geste Réactiver. techMarchandValider ne refuse pas le statut 'suspended', et 42 affiche le bouton dès que le statut n'est pas 'validated'. La suspension décidée par un autre manager (motif, statutAvant) est effacée sans journal tech_marchand_reactive. Un compte suspendu depuis 40 reste suspendu : la marque « Validée » ne peut pas se connecter.
  corr: Dans techMarchandValider : `if (m.statut === 'suspended') return { ok:false, motif:'Marque suspendue : la réactivation se fait par Réactiver (46), motif lu.' }`. Dans 42 suiteHTML, n'afficher « Activer le compte » que pour `m.statut === 'pending'`, et un lien vers 46 pour une marque suspendue.

[27] g2 promesse_sans_logique | ui/assets/payencash-data.js ; ui/assets/payencash-docs.js ; documents/cgu-espace-solution.html | techMarchandContratSigner / DOCS.MENTIONS_REQUISES / contrat_marchand (parties)
  Le contrat-cadre se signe dès que la pièce d'identité est validée, avant tout contrôle du Kbis et du dossier. Il est alors généré sans les mentions relevées : pas d'adresse, un SIRET seulement déclaré, pas de RCS, pas de représentant légal lu sur le Kbis. Le contrat et la CGU 5.1 affirment pourtant qu'il est généré « à partir des mentions du dossier », signé « après contrôle … du dossier de la société ».
  corr: Ajouter DOCS.MENTIONS_REQUISES.contrat_marchand = ['raisonSociale','siret','adresse','dirigeant'] et exiger dans techMarchandContratSigner `PEC_DOCS.etat('marchand', id).etat === 'valide'`, refus {refus:'dossier', href:'10-compte.html?s=identite#dossier'}. Le dire dans la carte contrat de 10-compte et dans le pied du lecteur.

[28] g2 promesse_sans_logique | ui/marchand/10-compte.html ; documents/cgu-espace-solution.html ; documents/politique-confidentialite-solution.html | CGU 11.3 « s'exercent depuis l'Espace »
  La CGU acceptée promet que les droits d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité s'exercent depuis l'Espace. L'espace marchand n'offre aucun de ces gestes : ni export, ni demande d'effacement, ni rectification de l'entreprise (voir constat 13).
  corr: Ajouter dans 10-compte › Aide une carte « Mes données » : export JSON de la fiche marque, du dirigeant, des bénéficiaires, des acceptations et du journal ; demande d'effacement ou de rectification qui crée une demande hotline journalisée (réutiliser les événements rgpd_* du bus). Sinon, réécrire 11.3 (« par écrit à … ») dans une nouvelle version.

[29] g2 manque_fonctionnel | ui/assets/payencash-data.js ; ui/marchand/10-compte.html ; ui/assets/payencash-bons.js | techMarchandSiteSet (domaine) → techMarchandDestination / techBlocBon
  La marque à l'Illimité* peut saisir n'importe quel domaine pour son site hébergé. Ce domaine n'est ni comparé au site déclaré (déclaration « réseau limité », contrat) ni vérifié (DNS). Il devient pourtant le lieu d'usage imprimé sur le bon, dans Mes bons et dans le bloc.
  corr: N'accepter comme domaine que le site déclaré (hôte de m.siteUrl), ou un nouveau domaine déclaré : techMarchandSiteSet refuse un domaine différent tant qu'une nouvelle déclaration (techMarchandDeclarer avec {site}) n'est pas validée. Marquer le domaine « à relier » tant que l'enregistrement DNS (ref.tech.siteHebergement) n'est pas constaté, et ne l'imprimer sur le bon qu'une fois relié.

[30] g2 incoherence | ui/marchand/03-documentation.html ; ui/assets/payencash-data.js (ref.tech.mentions) | #dc-mentions ← R.mentions
  La documentation lue par les marques affiche des mentions contraires au contrat-cadre signé. Elles parlent d'un contrat « à usage unique » (modèle abandonné), « résiliable à tout moment par l'une ou l'autre des parties », alors que le contrat-cadre est de 12 mois fermes, résiliable seulement au rendez-vous des six mois ou pour manquement. Elles disent aussi que le point de vente est toujours débité par prélèvement SEPA, en oubliant le distributeur nomade qui paie d'avance.
  corr: Réécrire ces deux mentions à partir des mêmes données que le contrat : « Le contrat-cadre dure {duree} mois fermes, sans reconduction tacite ; rendez-vous au sixième mois ; résiliation pour manquement ». Et : « le commerce sédentaire est prélevé après la vente, le distributeur nomade achète sur son avance ». Supprimer « à usage unique ».

[31] g2 incoherence | ui/assets/payencash-tech.js ; ui/marchand/02-espace.html | PEC_TECH.aFaire (branche pending)
  Une marque dont l'inscription est envoyée lit toujours « nous contrôlons ton identité légale », quel que soit l'état réel. Or le dossier peut n'avoir jamais été envoyé (documents « plus tard » : DOCS.soumettre n'est appelé que pour un dossier complet), une pièce peut avoir été refusée, être périmée, ou les bénéficiaires peuvent manquer. Personne ne contrôle rien et la marque ne le sait pas.
  corr: Dériver la ligne de DOCS.etat('marchand', id). a_completer : « Il reste à déposer : … ». a_soumettre : « Envoie ton dossier à la vérification ». a_corriger : « Pièce refusée : … — motif ». en_verification : « nous contrôlons ton dossier ». Ajouter les bénéficiaires manquants (constat 0) et la déclaration refusée avec son motif.

[32] g3 incoherence | ui/manager/40-comptes.html ; ui/assets/payencash-data.js | _compteSyncMetier / techMarchandReactiver
  40 affirme que les marques n'entrent pas dans sa table, mais leurs comptes y figurent avec Suspendre/Réactiver ; suspendre le compte suspend la marque, mais réactiver la marque en 46 laisse le compte suspendu : la marque « Validée » ne peut plus se connecter.
  corr: techMarchandReactiver réactive aussi le compte suspendu avec MOTIF40 (symétrie) ; corriger le commentaire de 40.

[33] g3 code_en_dur | ui/marchand/00-inscription.html | #ti-code-go (message d'erreur)
  Le message d'erreur du code dit « six chiffres » en dur alors que la longueur du code vient du référentiel (ref.otp.longueur, appliquée au champ).
  corr: `'… vérifie les ' + D.ref.otp.longueur + ' chiffres.'` (même correction dans ui/distributeur/00-inscription.html:317).

[34] g3 code_en_dur | ui/marchand/08-paiement.html ; ui/assets/payencash-data.js | carte « Mon abonnement »
  Paiement écrit « débitée le 1er de chaque mois » en dur, quand Compte lit abonnementJour ; ce paramètre n'est d'ailleurs lu par aucune logique (la facturation part au clic du manager).
  corr: Lire R.paiement.abonnementJour dans 08-paiement (même formule que 10-compte) et faire lire ce jour par la tâche de facturation (ou supprimer le paramètre).

[35] g3 code_en_dur | ui/assets/payencash-data.js ; ui/assets/payencash-docs.js | modesPaiement[].detail, formules illimite.detail/inclus, techMarchandTva, contrat_marchand, mentions
  Des valeurs réglables sont recopiées en dur dans des phrases : « 20:00 », « sept jours », « dix jours » (arrêté et cadence réglables), « 1 000 000 € » (seuil réglable), « TVA à 20 % » (tech.tvaPct réglable), « d'une durée d'un an » (dureeContratMois réglable).
  corr: Remplacer par des jetons remplis à l'affichage : {arrete} (paiement.arreteHeure) et {cadence} (cadenceJours) dans techModes, {seuil} (seuils.acprMontant12Mois) dans techFormules, {duree} (dureeContratMois) dans ref.tech.mentions. Pour la TVA de distribution, lire une seule valeur « taux normal » au référentiel juridique, dans techMarchandTva et dans contrat_marchand.

[36] g3 incoherence | ui/marchand/00-inscription.html ; ui/marchand/10-compte.html ; ui/assets/payencash-data.js | #ti-tva-unique/#ti-tva-france ; #tc-tva-unique
  L'état « Régime à qualifier » est inatteignable depuis les écrans : deux cases laissées décochées valent « non / non » et donnent d'office un bon à usages multiples. Et la même case dit « couvrir » à l'inscription, « payer » dans Compte.
  corr: Deux choix explicites Oui/Non (radio) avec un état non répondu, pour garder « à qualifier » ; un seul libellé, lu au référentiel.

[37] g3 genre | ui/marchand/10-compte.html ; ui/marchand/00-inscription.html ; ui/manager/42-verifications.html ; ui/assets/payencash-data.js | titres et motifs « celui qui signe », « c'est lui qui signe », « Inscrit le »
  Les textes restent au masculin même quand la civilité déclarée est « Madame » (« Le dirigeant — celui qui signe », « c'est lui qui signe ») ; « Inscrit le » est genré sans objet.
  corr: Tournures neutres (« la personne qui signe », « signataire du contrat-cadre ») ou accord dérivé de la civilité comme pour « Né/Née » ; « Inscription le … ».

[38] g3 vocabulaire | ui/assets/payencash-data.js (ref.portes.tech) | portes.tech.titre
  La porte d'entrée des marques dit « Tes bons d'achat, vendus par notre réseau. », contre la règle côté marque (« le réseau ACHÈTE », jamais « vente du réseau »).
  corr: « Tes bons d'achat, achetés par notre réseau. » (ou « Vos bons d'achat, notre réseau » via D.slogan()).

[39] g3 code_mort | ui/assets/payencash-data.js ; ui/assets/payencash-docs.js ; ui/marchand/10-compte.html | TECH_MANDAT_ACTEURS.marchand, techMarchandRib via 'mandat', CONDITIONS.contrat_fournisseur, MODELES.facture_fournisseur/facture_client/etiquette_mr, MENTIONS.tva, ref.juridique essaiMois/virementJours, placeholder d'accroche
  Restent autour du compte de la marque : le mandat SEPA de la marque (abandonné le 24/09 pour la carte), les modèles fournisseur/Mode (contrat, facture d'achat, facture client, étiquette Mondial Relay), les régimes TVA « fournisseur de PayEnCash », des paramètres Mode ; le délai de contestation Mode est réutilisé par le contrat de la marque ; l'exemple d'accroche est une phrase de Mode.
  corr: Supprimer TECH_MANDAT_ACTEURS.marchand et la branche mandat de techMarchandRib, les modèles et conditions fournisseur/Mode, MENTIONS.tva et les paramètres Mode ; donner au contrat marque son propre délai de contestation au référentiel ; placeholder neutre lu au référentiel.

[40] g3 incoherence | documents/cgu-espace-solution.html ; ui/assets/payencash-data.js | CGU 4.2 / ref.kyc.piecesIdentite
  Les CGU acceptées listent carte d'identité, passeport ou permis français ; l'écran accepte aussi le titre de séjour.
  corr: Aligner le texte des CGU sur ref.kyc.piecesIdentite (nouvelle version) ou retirer le titre de séjour du référentiel.

[41] g3 contourne | ui/marchand/10-compte.html | carte « Mon dossier de vérification (KYB) »
  L'écran lit directement la clé localStorage du coffre au lieu de passer par PEC_DOCS.
  corr: Ajouter `assigne` (et `soumisAt`, déjà rendu) au retour de DOCS.etat, et le lire dans 10-compte à la place de la clé localStorage.

[42] g3 manque_fonctionnel | ui/assets/payencash-data.js ; ui/manager/46-marques.html | techMarchandCreer / techMarchandPeutTravailler / fiche 46
  La catégorie, exigée à l'écran d'inscription, n'est exigée ni par le geste unique (banc/démo) ni par le verrou, et le manager ne la voit nulle part : une boutique peut apparaître « Catégorie à venir » dans Mes bons.
  corr: Exiger la catégorie dans _techEntrepriseControle (donc dans techMarchandCreer), l'ajouter à PEC_TECH.aFaire si elle manque, et l'afficher dans la fiche 46.

[43] g3 incoherence | ui/marchand/08-paiement.html ; ui/manager/45-marchand-paiements.html | carte « Mes virements reçus »
  Un virement est dit « reçu » par la marque dès que le manager clique « Virer », alors que 45 le dit « émis » et qu'aucun retour bancaire ne confirme un virement sortant.
  corr: « Mes virements » avec l'état « émis le … » (et « reçu » seulement si un statut bancaire est ajouté).

[44] g3 incoherence | ui/marchand/10-compte.html | carte « Seuils et règles »
  Compte dit que le bon est « rattaché au compte vérifié du client », ce qui laisse entendre une identité vérifiée, alors que l'identité n'est vérifiée qu'au-delà des seuils de vigilance (confusion que la documentation 03 demande d'éviter).
  corr: « rattaché au compte Mes bons du client (téléphone et e-mail confirmés) ; son identité est vérifiée au-delà des seuils de vigilance ».

[45] g3 genre | documents/cgu-espace-solution.html | articles 4.1 et 4.3
  La CGU de l'espace marchand emploie l'écriture « ·e », bannie par la règle d'écriture neutre, et un masculin d'office. Elle écrit en dur un seuil réglable. Elle omet aussi les bénéficiaires dans les conditions d'activation, alors que techMarchandValider les exige.
  corr: Nouvelle version de la CGU : lister les qualités sans « ·e » (« gérance, présidence, direction générale, entreprise individuelle, autre représentant légal »), écrire « la personne qui signe », remplir le seuil par data-ref sur ref.kyc.beneficiaires.seuilPct, et ajouter en 4.3 « et que les bénéficiaires effectifs ne sont pas déclarés ».


######## articles — Articles et publications (33 confirmés, 5 oublis, 0 réfutés)

[0] g1 casse | ui/marchand/09-outils.html | paiementsDe / pli « Bons achetés par le réseau sur cet article »
  Le pli lit un champ qui n'existe pas : il affiche toujours « · 0 bon », « 0,00 € que nous te devons · 0,00 € payés » et « Aucun bon présenté pour l'instant » sous chaque proposition, alors que la pastille de la même carte annonce « N bons achetés par nous ». La marque lit un montant dû faux.
  corr: Dans paiementsDe : partir de `D.techLiens({ marchandId: s.id }).filter(function (x) { return x.origineLien === a.slug; })` (état dérivé), puis pour chaque proposition prendre `D.techLienBons(x.slug)` (bons vendus sur l'ordre, usages et rencontres, sans doublon), avec la part prise lue dans `x.usages` (code → pris). Banc : un article couvert par un bon doit afficher « 1 bon » et le prixMarque dû dans le pli ; une proposition échue doit afficher « Expiré ».

[1] g1 casse | ui/assets/payencash-data.js | techArticleStock
  Le stock compte des BONS UTILISÉS, pas des articles : une commande couverte par deux bons retire deux unités (épuisement à tort, et techArticleMajTailles refuse alors de descendre « N bon(s) sont déjà vendus »), une commande couverte par un bon acheté au comptoir sur l'ordre mais pas encore utilisé n'en retire aucune (survente), une proposition annulée après usage partiel retire une unité. La promesse « chaque bon acheté par le réseau sur cet article se déduit de son stock » est fausse dans les deux sens.
  corr: techArticleStock : compter UNE unité par bon proposé né de l'article, dès qu'il est entamé ou couvert (usages non vides), quel que soit le nombre de bons ; ajouter en option une réservation pour une proposition ouverte dont un bon est déjà vendu sur l'ordre ; exclure une proposition annulée sans usage. techArticleMajTailles et la pastille lisent le même compte (« N commandes couvertes »). Les deux textes deviennent « chaque commande couverte retire une unité ».

[2] g1 contourne | ui/assets/payencash-data.js | techLienCreer, techLienPourCommande, techLienUtiliserBon, techArticleSupprimer
  La règle « épuisé ou retiré, rien ne s'ouvre » est recopiée dans deux écrans et absente du data-layer : un onglet resté ouvert, l'API /offers, le widget d'un site propre, 05-offre ou un bon proposé né avant le retrait laissent acheter au comptoir puis consommer un bon pour un article qui n'a plus de stock ou n'existe plus — le client perd la valeur utilisée sans recevoir l'article.
  corr: Même correction, plus un point : techOrdreVente doit rendre `vendable: false` quand l'article d'origine est retiré ou épuisé, pour qu'aucun commerce ne vende un bon au comptoir pour un article qui n'existe plus.

[3] g1 promesse_sans_logique | ui/marchand/11-site.html | Ta commande / #c-ok, techLienPourCommande, 06-demandes
  Une commande d'article couverte (le bon du client est débité) n'arrive nulle part chez la marque sous une forme exploitable : ni l'article lisible, ni la taille choisie, ni le compte ou un moyen de joindre le client, ni notification (Solution n'a aucun fil). « La prépare et te tient au courant » (11-site) et « en est prévenue » (05-offre) sont des promesses sans mécanisme.
  corr: Porter sur le bon proposé `article: { slug, modele, taille }` : techLienPourCommande et techLienCreer reçoivent `o.taille`, contrôlée contre les tailles déclarées, et le widget lit `data-taille`. Dans 06-demandes, afficher l'article, la taille et le compte Mes bons qui a couvert la commande (u.par → nom). Passer marque, référence, article et taille dans les données du journal `tech_lien_couvert`, et prendre l'adresse de la marque comme destinataire de l'e-mail. Tant que ce n'est pas fait, retirer « la prépare et te tient au courant » (11-site) et « en est prévenue » (05-offre).

[4] g1 promesse_sans_logique | index.html | §05 « La promotion de vos articles » et « Le mur des dernières tendances »
  La vitrine vend aux marques une promotion de leurs articles par les commerces et les nomades (affichage mural au comptoir, flyers, partage de visuels et de vidéos) : aucun écran de l'app partenaire ne montre un article, un visuel, un flyer ou une vidéo de marque. Le « mur » n'est que la liste des 8 derniers articles publiés, pas « ce que les commerces affichent ».
  corr: Soit créer dans l'app partenaire un onglet « Vitrine des marques » (articles des marques du contrat, visuel PEC_VSOL téléchargeable, affichage plein écran, flyer imprimable avec le flashcode du lien de vente), soit réécrire les trois textes sur ce qui existe et renommer le mur « Les derniers articles publiés ».

[5] g2 manque_fonctionnel | ui/marchand/09-outils.html | bouton « Retirer » / techArticleSupprimer
  Un toucher sur « Retirer » efface définitivement l'article, sans confirmation : plus de carte, plus de suivi des bons achetés dessus ; le visuel déjà posté mène à « n'est plus proposé … elle seule peut le remettre en ligne » alors qu'aucun geste ne le remet en ligne (republier donne un autre slug). En base, la clé étrangère des bons proposés interdirait cette suppression : data-layer et schéma divergent.
  corr: Remplacer la suppression par un état `retireLe` : l'article sort des boutiques, du site et de la vitrine, garde son historique dans une section « Retirés » de 09-outils avec « Remettre en ligne » (même slug) ; confirmation « N bons proposés ouverts seront annulés » ; colonne `retired_at` dans products.

[6] g2 incoherence | ui/assets/payencash-visuel-solution.js | « TAILLES DISPONIBLES », carteArticle, mur, boutons de taille 11-site, panier de démo
  Partout sauf sur 07-lien, les quantités déclarées sont présentées comme disponibles : après trois ventes de M sur trois M déclarés, le visuel, la vitrine et le site annoncent encore « M (3) » et laissent choisir M ; la démo invente la taille. Le data-layer ne connaît aucune vente par taille (la taille choisie sur 11-site n'est écrite nulle part).
  corr: Enregistrer la taille sur le bon proposé (constat commande) et dériver dans techArticleStock `tailles[].dispo` = qté − commandes couvertes ou réservées de cette taille ; lire `dispo` partout (visuel, carteArticle, index, 11-site désactive une taille à 0, 04-demo fait choisir) ; supprimer la phrase d'excuse de 07-lien.

[7] g2 promesse_sans_logique | ui/marchand/09-outils.html | étapes Identité et Photos (description, couleurs, matière, photos 2 à 4)
  Description, couleurs, matière et photos 2 à 4 sont saisies (couleurs et matières bloquent même « Continuer » pour une marque de mode) mais aucune page ne les montre : ni 07-lien, ni Mes bons, ni le site, ni le visuel, ni la carte de 09-outils. « Il apparaît sur la fiche » est faux.
  corr: Afficher description, couleurs, matière et galerie photos[0..3] sur 07-lien?a=, sur 11-site (Ta commande) et dans un détail d'article de Mes bons ; à défaut, retirer ces champs de la modale et leur blocage d'étape.

[8] g2 manque_fonctionnel | ui/marchand/09-outils.html | reduire() / PHOTOS_MAX / pec-tech-articles.photos
  Chaque article embarque jusqu'à quatre images de plusieurs centaines de Ko en base64 dans le même localStorage que toute l'application (quota d'environ 5 Mo par origine) : quelques articles suffisent pour que _ecrit refuse la publication suivante, alors que trois photos sur quatre ne servent à rien.
  corr: N'écrire que `photos` (l'ordre fait foi) et dériver `photo` = photos[0] à la lecture. Tant que la galerie n'est affichée nulle part, ne garder qu'une image. Le plafond et le côté maximal passent au référentiel (ref.tech.articles.photosMax / photoCote), et la modale affiche le poids restant.

[9] g2 manque_fonctionnel | ui/assets/payencash-data.js | absence de techArticleModifier
  Une erreur de prix, de remise, de nom ou de photo ne se corrige pas : il faut retirer (perte d'historique) puis republier, ce qui change le slug et rend morts les visuels et légendes déjà postés.
  corr: Ajouter techArticleModifier(id, champs, par) (mêmes contrôles que la création, slug conservé, journal tech_article_modifie, montant figé sur les bons proposés déjà nés) et un geste « Modifier » qui rouvre la modale pré-remplie.

[10] g2 incoherence | ui/assets/payencash-data.js | techArticleCreer, techBoutiques, index.html peindrePromo, 11-site, 07-lien?a=
  Une marque en attente ou suspendue publie et poste des visuels dont le flashcode ouvre une fiche complète avec « Où acheter ce bon » qui échoue au clic ; une marque validée sans contrat signé est absente de Mes bons mais présente sur la vitrine et sur son site. Trois règles de visibilité pour un même article.
  corr: Écrire `techArticleVisible(a)` = techMarchandPeutTravailler(a.marchandId).ok et non retiré, lu par techBoutiques, index.html, 11-site et 07-lien?a= (« pas encore proposé »). techLienCreer refuse avec `refus: 'marque'` quand techMarchandPeutTravailler échoue, comme techVenteLienCreer. Dans 09-outils, dire que les articles ne seront visibles qu'une fois les manques levés.

[11] g2 impasse | ui/marchand/07-lien.html | « Où acheter ce bon » (?a=), techArticleUrl, techDestinationUrl, panier 04-demo
  Un même article a trois chemins incohérents : depuis le visuel, on n'achète qu'un bon (la proposition « Article X » ne sera jamais couverte en vue « achat » et expire, en gonflant à chaque clic de visiteur les « En attente » de 06-demandes) ; depuis Mes bons, on commande sur le site hébergé (stock décompté) ; sur un site propre ou dans le panier de démo à deux articles, le stock n'est jamais décompté. Le porteur arrivé par le visuel n'a aucun chemin vers « Commander ».
  corr: techArticleUrl renvoie techDestinationUrl(marchandId, slug) quand la marque a un site (hébergé ou démo) et garde 07-lien?a= pour l'achat seul ; ne plus créer de bon proposé d'article depuis 07-lien?a= (proposer le lien de vente à montant précis, techVenteLienCreer montant = net) ou dédoublonner par (article, client) ; porter l'article par ligne de commande (data-articles) pour un panier de plusieurs articles.

[12] g2 manque_fonctionnel | ui/marchand/03-documentation.html | code du widget (dc-widget), table des points d'entrée /articles
  Le seul moyen pour qu'une vente sur le site propre d'une marque décompte le stock de son article (data-article) n'est dit nulle part à la marque ; l'API documentée des articles ne permet ni de corriger le stock, ni de retirer, ni de poser l'avant-première, ni d'importer un catalogue.
  corr: Documenter `data-article` (et `data-taille`) aux quatre endroits : 03-documentation l.183 et l.280, 10-compte:306, 04-demo majCfg. Compléter EP avec les points d'entrée de stock, de retrait et d'avant-première.

[13] g2 incoherence | ui/assets/payencash-data.js | ref.tech.logiciel.formules[cinquante].inclus
  La formule à 5,90 € présente « Lien de vente et visuels » comme un avantage alors que la formule Offerte publie des articles, génère des visuels et crée son lien de vente : argument commercial faux.
  corr: Soit contrôler la formule dans techArticleCreer et techVenteLienCreer (refus 'formule' avec lien vers Compte › Abonnement), soit retirer « Lien de vente et visuels » à la fois du référentiel et des conditions du logiciel (l.93).

[14] g2 incoherence | ui/marchand/09-outils.html | editeurStock, fiche 07-lien, visuel, 11-site, 04-demo
  Pour une marque hors mode (compagnie aérienne, revendeur de billets de la démo), la publication parle d'« options » mais le stock, la fiche, le visuel, le site et la démo écrivent « Taille Aller simple » ou « TAILLES DISPONIBLES : Aller-retour (8) ».
  corr: Un libellé au data-layer, `techArticleLibelleTaille(a)` (« Taille » pour une marque de catégorie mode, sinon « Option »), lu par editeurStock, 07-lien, PEC_VSOL, 11-site, 04-demo et carteArticle.

[15] g2 manque_fonctionnel | ui/manager/46-marques.html | absence de vue des articles (manager, hotline)
  Nous exposons sur notre vitrine les visuels publiés par les marques sans aucun écran manager pour les voir ni geste pour retirer un article signalé ; la hotline ne peut pas voir l'article d'une commande qu'un client conteste.
  corr: Section « Articles publiés » dans manager 46-marques (liste, filtre, geste motivé et tracé « Masquer de la vitrine ») ; lecture de l'article d'origine d'un bon proposé dans la hotline ; la vitrine exclut un article masqué.

[16] g2 promesse_sans_logique | ui/marchand/10-compte.html | carte « Mon site web », ref.tech.siteHebergement, techBoutiques.source
  Les articles « venant du site de l'abonnement » n'existent pas : aucun import, aucune API lue, aucun réglage manager ; le domaine saisi n'est relié à rien et l'« activation » annoncée n'a ni écran ni fonction, alors que 10-compte laisse croire à un site sur le domaine de la marque.
  corr: Ajouter un état du domaine par marque, `site.domaineEtat` : saisi / DNS communiqué / actif, avec un geste manager tracé. Tant que le domaine n'est pas actif, techMarchandDestination.lbl et techBlocBon.domaine affichent l'adresse réelle du site hébergé, pas le domaine saisi ; 10-compte dit « ton domaine sera relié après validation ». Les conditions (l.94) se réécrivent sur ce qui existe. La fiche du prestataire (societe, apiBase, apiDoc) se pose en Configuration manager. Pas d'importeur avant la documentation de l'API.

[17] g2 incoherence | ui/assets/payencash-visuel-solution.js | bloc ⑤ du dessin et legende()
  Le visuel et la légende taisent le distributeur nomade, écrivent « commerçant » au lieu du terme du référentiel, et pour une marque sans site propre annoncent « valable uniquement sur son site » alors que son bon se dépense sur sa boutique hébergée, dont le domaine est connu.
  corr: Dans PEC_VSOL, lire `D.techMarchandDestination(a.marchandId).lbl` pour « valable uniquement sur … » et reprendre la phrase `techBlocBon(...).ou` (D.terme commerce/nomade) pour « à acheter … ».

[18] g2 casse | ui/marchand/11-site.html | choix.ref / techLienPourCommande (reprise) / 07-lien prevenir('couvert')
  La référence de commande du site hébergé est tirée de l'horloge modulo 1 000 000 ms : elle revient à l'identique toutes les 16 min 40 s. Deux commandes qui tombent sur la même référence et le même montant (le même article, par exemple) récupèrent le même bon proposé, car techLienPourCommande le reprend. S'il est déjà couvert, 07-lien prévient « couvert » dès le chargement : le second client lit « Commande … couverte » sans qu'aucun bon n'ait servi. Le commentaire affirme le contraire. 04-demo a le même défaut, avec un cycle d'environ 27 h.
  corr: Tirer la référence au data-layer : `techCommandeRef(marchandId)`, sur le générateur sûr (_techAlea, comme _techRefOrdre), unique parmi les références des bons proposés de la marque. 11-site et 04-demo la lisent. En plus, techLienPourCommande ne reprend un bon proposé que si l'article d'origine (et le client quand il est connu) est le même. Banc : deux commandes du même article donnent deux bons proposés distincts.

[19] g2 manque_fonctionnel | ui/titres/02-titre.html | détail du bon : aucune liste des usages
  Quand un bon couvre une commande d'article (site hébergé ou widget), le porteur ne retrouve cette commande nulle part dans Mes bons. Le détail du bon ne dit ni où il a servi, ni pour quelle référence, quel article, quelle taille, quand ni combien. Le message « Commande … couverte » de 11-site ne vit que dans la page. La section « Bons proposés » ne reçoit que les propositions ouvertes dans 05-offre. Le porteur ne peut donc pas prouver sa commande à la marque ni à la hotline.
  corr: Dériver au data-layer `techBonUsages(code)` : les bons proposés dont un usage porte ce code, avec la référence, la marque, l'article d'origine, la taille, la part prise, la date et le compte. 02-titre l'affiche dans une section « Où il a servi », avec un lien vers l'article (08-boutique ou le site). La hotline le lit aussi.

[20] g2 incoherence | ui/assets/payencash-visuel-solution.js | bloc ⑤ « Bon d’achat … », legende(), 07-lien cadreBonHTML(nom)
  Le visuel, la légende et la fiche 07-lien nomment le bon d'après `a.marque`, la griffe du produit, et non d'après la boutique qui émet le bon. Or techArticleCreer accepte une marque libre par l'API documentée (POST /articles), et le schéma annonce ce champ modifiable. Un revendeur qui publie un article « Nike » produit donc un visuel « Bon d’achat Nike » et une mention de réseau limité « Ce bon d’achat ne vaut que chez Nike » : l'émetteur est faux. La carte de Mes bons, elle, écarte délibérément ce cas.
  corr: Le nom du bon et la mention de réseau limité se lisent toujours sur `techMarchand(a.marchandId).raisonSociale` : bloc ⑤ et légende de PEC_VSOL, titre, cadreBonHTML et « Demande à … » de 07-lien. `a.marque` ne sert qu'à nommer le produit (« Nike · Air Max »).

[21] g2 promesse_sans_logique | ui/marchand/09-outils.html | étape Prix & remise, widget, techLienPourCommande
  Le visuel, le mur de la vitrine, les cartes de Mes bons et 07-lien annoncent « <net> avec ce bon d’achat », prix d'origine barré. Seuls 11-site et 04-demo calculent le montant avec la remise. Sur le site propre d'une marque (widget), le montant est le total de sa page : rien ne lui dit qu'elle doit appliquer la remise quand on paie par bon, et rien ne compare le montant reçu au prix net de l'article. Le prix que nos pages annoncent n'est donc pas garanti là où la carte « Commander › » envoie le client.
  corr: Dans 09-outils, quand la destination est de type 'site', dire à la marque : « cette remise, c'est ton site qui l'applique quand on paie avec le bon » ; le documenter dans 03 et dans Compte › Intégration. Quand une commande porte `data-article`, techLienPourCommande compare le montant au prix net attendu, garde l'écart sur le bon proposé et l'affiche dans 06-demandes. Sinon, retirer le prix barré des pages qui mènent à un site propre.

[22] g3 manque_fonctionnel | ui/marchand/09-outils.html | #ed-avp, bouton « Ouvrir à tous », _techAvantPremiereFin, PEC_VSOL, 11-site, mur
  L'avant-première ne se pose qu'à la naissance, ne se prolonge ni ne se repose ; le défaut du référentiel n'est pas proposé ; une durée invalide est avalée sans message ; le visuel, le site et la vitrine présentent l'article comme ouvert à tous, le refus n'arrivant qu'au clic « Commander » / « Où acheter ».
  corr: Ajouter un geste « Avant-première » sur la carte (durées du référentiel, pour poser et prolonger) et présélectionner defautJours dans la modale. techArticleCreer refuse `{ champ: 'avantPremiereJours' }` une durée hors référentiel. Les durées deviennent un réglage vif (param('tech.avantPremiere.jours')) en Configuration manager. Le visuel, 11-site et le mur affichent « Avant-première jusqu'au … ».

[23] g3 incoherence | ui/assets/payencash-data.js | techArticleCreer → _journal('tech_article_publie')
  La publication d'un article est attribuée au titulaire de la session générique de l'appareil (pec-session) ou à « manager », pas à la marque qui l'a publiée.
  corr: Ajouter `par: o.par || m.id` au journal tech_article_publie, et `marchand: l[i].marchandId` aux journaux tech_article_stock et tech_article_retire.

[24] g3 contourne | ui/assets/payencash-data.js | techArticleMajTailles, techArticleSupprimer, techArticleAvantPremiereSet
  N'importe quel appelant qui connaît un identifiant TAR-… peut corriger le stock, lever l'avant-première ou retirer l'article d'une autre marque : aucune fonction ne vérifie l'appartenance, alors que /articles est documenté comme point d'API.
  corr: Exiger `marchandId` (ou le dériver de la session) et refuser si `l[i].marchandId !== marchandId` dans les trois fonctions ; même contrôle côté API.

[25] g3 obsolete | ui/marchand/09-outils.html | CATS / GENRES / SYS / proposer() → D.brouillonPiece
  L'éditeur des marques de mode repose sur le référentiel de la revente Mode (arbre à trois catégories de fripe, grille UK/US de sneakers, suggestion de fiche fournisseur avec SKU, poids, composition, état « échelle Vinted ») : une marque de chaussures de ville ou de lingerie n'a pas sa catégorie, et le code Mode reste vivant par cette dépendance.
  corr: Créer `ref.tech.articles` (catégories par activité, grilles de tailles, couleurs, matières) lu par l'éditeur, remplacer brouillonPiece par une suggestion minimale (techArticleSuggestion), puis supprimer mode.categoriesArbre, etatsPiece, brouillonPiece et refFournisseurSuggeree une fois sans lecteur.

[26] g3 code_mort | ui/assets/payencash-data.js | techArticleCreer.etat, techLienCreer.origineLien
  Un champ d'état hérité de la revente est écrit sur chaque article sans lecteur ; l'origine « article » partage le champ de l'origine « lien de vente », que chaque lecteur doit démêler (techLienRefClient, techVenteLienStats, techArticleStock).
  corr: Retirer `etat` de techArticleCreer ; écrire `origineArticle` distinct d'`origineLien` dans techLienCreer, techLienPourCommande et 07-lien, et le lire dans techArticleStock et paiementsDe.

[27] g3 redondance | ui/titres/08-boutique.html | fonction photo(src) recopiée
  La règle « photo d'article affichable » est écrite six fois, dont une copie désormais sans appel dans 08-boutique.
  corr: Écrire une seule fonction `D.techPhoto(src)` au data-layer, lue par T.photo, carteArticle, PEC_VSOL, 04-demo et 07-boutiques, et supprimer les copies. Pour 08-boutique, c'est déjà fait.

[28] g3 vocabulaire | ui/marchand/07-lien.html | #tl-a-epuise
  Le client lit « aucune demande ne s’ouvre » : « demande » est banni (c'était « demande de paiement »), la notion est un bon proposé.
  corr: « … trouvé preneur : aucun bon ne se propose plus pour cet article. »

[29] g3 incoherence | ui/marchand/09-outils.html | placeholders de l'étape Identité, état vide
  Une compagnie aérienne ou une marque de beauté se voit proposer des exemples de vêtements dans la modale et une icône de t-shirt dans l'état vide.
  corr: Exemples et icône par catégorie d'activité, lus au référentiel (`ref.tech.categoriesActivite[].exemples`, `.ico`).

[30] g3 obsolete | ui/marchand/09-outils.html | commentaires d'en-tête
  Les commentaires de la page décrivent un état passé (six étapes, écran fournisseur Mode, vocabulaire banni) et induiront en erreur la prochaine correction.
  corr: Réécrire les commentaires des lignes 28, 37, 81, 231 et 455.

[31] g3 manque_fonctionnel | ui/titres/07-boutiques.html | dims() / recherche data-fsearch
  On ne peut ni filtrer ni trier les articles par prix, ni par « pour qui », ni par taille ; deux recherches de boutiques coexistent (texte de la ligne dans 07, `texte` du data-layer dans 03-rechercher) et ne trouvent pas la même chose.
  corr: Le prix et le tri sont déjà faits. Reste à ajouter « Pour qui » (les genres présents) et une taille disponible, puis à faire de techBoutiques({q}) la seule règle de recherche, lue par 07 et par 03.

[32] g3 code_en_dur | ui/assets/payencash-visuel-solution.js | VIDEO_SECONDES, format
  La durée de la vidéo (décision fondatrice) et le format du visuel sont écrits dans le module au lieu du référentiel.
  corr: Créer `ref.tech.visuel = { largeur: 1080, hauteur: 1350, videoSecondes: 10 }`, lu par PEC_VSOL, et supprimer le repli `|| 10` de 09-outils.

[33] g3 manque_fonctionnel | ui/marchand/09-outils.html | rendreListe / carte()
  La marque ne voit ni quand un article a été publié ou corrigé, ni l'historique de son stock ; au-delà de quelques articles, la liste n'a ni recherche ni pagination.
  corr: Sur la carte : « publié le …, stock corrigé le … » et un pli « Historique » (événements tech_article_* du journal pour cet id) ; data-fsearch et data-fpage sur #ed-liste.

[34] g3 incoherence | index.html | mur de la vitrine, 11-site, techBoutiques
  Un article épuisé disparaît de Mes bons, reste « Épuisé » sur le site de la marque et figure sans mention sur la vitrine comme s'il était en vente.
  corr: Règle unique au data-layer (techArticleVisible + épuisé) : la vitrine exclut les épuisés ou les marque « Épuisé » comme le site.

[35] g3 manque_fonctionnel | ui/titres/05-offre.html | en-tête du bon proposé ; 02-titre
  Le porteur qui ouvre une proposition née d'un article ne voit ni la photo, ni la taille, ni le prix barré, seulement « Réf. Article X » (ou « CMD-… ») ; depuis le détail de son bon, rien ne le mène aux articles de la marque où le dépenser.
  corr: 05-offre : quand l'origine est un article, afficher sa vignette, son nom, sa taille et son prix. 02-titre : ajouter un lien « Voir les articles de <marque> » vers 08-boutique.html?m=.

[36] g3 manque_fonctionnel | ui/marchand/12-promouvoir.html | espace collaborateur (12/13/14)
  Le collaborateur chargé de « promouvoir la marque » n'a accès ni aux articles ni à leurs visuels ; une vente née d'un visuel qu'il a partagé ne lui est jamais attribuée.
  corr: Section « Articles » en lecture dans 12-promouvoir (visuel, légende signée de son lien) et paramètre `&c=<collaborateur>` sur techArticleUrl, repris par techLienCreer.

[37] g3 impasse | ui/marchand/07-lien.html | #tl-a-avp « Connecte-toi à Mes bons »
  Un porteur qui ouvre le visuel d'un article en avant-première sans être connecté reçoit un lien de connexion à Mes bons sans adresse de retour. 06-connexion n'accepte d'ailleurs qu'un retour vers une page de Mes bons. Une fois connecté, il atterrit sur la liste de ses bons et a perdu l'article qu'il voulait.
  corr: Faire pointer le lien vers `../titres/06-connexion.html?retour=` + encodeURIComponent('08-boutique.html?m=' + a.marchandId), une page de l'app où l'article s'affiche avec son badge d'avant-première. Autre solution : ajouter à 06-connexion un paramètre `a=<slug>` qui ramène sur la fiche de l'article.


######## vente-en-ligne-api — Bon proposé, lien de vente, widget, API et site de la marque (34 confirmés, 6 oublis, 1 réfutés)

[0] g1 casse | ui/marchand/07-lien.html | Liste « Acheté pour cette commande » (#tl-achetes) et bouton Utiliser (data-achete)
  N'importe quel compte Mes bons qui ouvre la vue « ton bon » d'un bon proposé voit les bons achetés au comptoir sur son ordre par quelqu'un d'autre et peut les ranger dans SON compte puis les utiliser, sans connaître le code : le bouton passe le code complet à enregistrer(), et le filtre n'exclut que les bons déjà rangés chez le lecteur, pas chez leur acheteur.
  corr: (1) Dans 07-lien, ne plus proposer « Utiliser » d'un geste pour un bon absent de la liste du lecteur. Un bon vendu au comptoir n'a aucun identifiant d'acheteur : c'est son ticket (flashcode 05-offre?code=) qui le range. Ne montrer #tl-achetes que pour les bons d'une rencontre nomade dont le clientId est celui du compte connecté. (2) Dans le data-layer, poser un titulaire au premier rangement : PEC_BONS.ajouter appelle une nouvelle fonction D.techBonRattacher(code, clientId) qui écrit b.porteur et un journal tech_bon_rattache. Cette fonction refuse si b.porteur existe et diffère (motif « Ce bon est déjà rangé dans un autre compte — la hotline peut vérifier »). (3) techLienUtiliserBon refuse u

[1] g1 promesse_sans_logique | ui/assets/payencash-data.js | techLienCreer, techLienPourCommande, techVenteLienCreer, techBonEmettre
  Aucun plafond par bon (250 €), ni plafond client jour/mois, ni minimum (5 €) n'est appliqué aux bons de marque : un panier de 1 800 € ouvre un bon proposé de 1 800 €, le comptoir vend un bon unique de 1 800 € sur l'ordre, et un lien de vente à montant libre accepte 0,01 € ou 9 999 €. Pourtant Solution affiche « Par bon : de 5 € à 250 € — au-delà, l'achat se découpe en plusieurs bons » (politique de prévention de la fraude) et 07-lien « Jusqu'à 250 € par bon, à partir de 5 € ».
  corr: Créer un référentiel des bons de marque (techRef().bons : minimum, plafondBon, plafondClientJour, plafondClientMois, fenetrePlafondJours, validiteMois). Le lire dans : techLienCreer (refus sous le minimum) ; techVenteLienCreer (montant précis entre le minimum et plafondBon) ; techBonEmettre (refus hors bornes). Au-delà du plafond, appliquer la règle fondatrice du 20/09 : la vente sur un ordre se découpe en plusieurs bons, chacun ≤ plafondBon et portant le même `ordre`. Appliquer aussi plafondClientJour et plafondClientMois dès qu'un client est connu (rencontre nomade, porteur au rangement). Les placeholders de 07-lien, 08-paiement et 12-promouvoir lisent les mêmes bornes.

[2] g1 casse | ui/assets/payencash-data.js | techLienPourCommande / techLienAnnuler / expiration (_techLienVif)
  Ce qu'un bon a déjà pris sur un bon proposé est perdu pour le client dans trois cas : le panier change (un nouveau bon proposé du montant entier naît, l'ancien reste « Entamé » sans lien avec la commande), la marque annule un bon proposé entamé (un clic, sans confirmation), ou il expire entamé. Aucune fonction ne rend le montant pris au bon, le widget ne prévient la marque que d'une couverture totale, et la page dit au client « Un bon que tu aurais déjà reste valable ». La documentation promet « Une commande ouvre un bon proposé ».
  corr: techLienPourCommande : retrouver le bon proposé vivant par référence quel que soit le montant et en ajuster le montant (refus si nouveau montant < pris), ou annuler l'ancien en reportant ses usages. techLienAnnuler : refuser l'annulation d'un bon proposé entamé, ou recréditer chaque usage (solde du bon, etat sold, journal tech_bon_recredite). À l'expiration d'un bon proposé entamé, même recrédit. Le widget émet aussi un événement 'payencash:entame' (montant pris, reste) pour que la marque connaisse une couverture partielle.

[3] g1 impasse | ui/marchand/07-lien.html | Vue « acheter » d'un lien partagé ouvert par un porteur connecté (#tl-jai masqué, #tl-app masqué)
  Un porteur connecté à Mes bons qui ouvre un bon proposé partagé (06-demandes, 12-promouvoir, lien de vente, flashcode d'un article) n'a aucun moyen d'utiliser le bon qu'il possède : « J'ai un bon » n'existe plus qu'en vue « ton bon » dans le widget, et l'invitation qui mène à Mes bons 05-offre est masquée justement quand il est connecté. La proposition n'est pas non plus rangée dans ses « Bons proposés » (propositionRecue n'est appelée que par 05-offre), donc il ne la retrouve pas dans l'app. Même impasse pour le client déjà porteur qui arrive par l'article (seul bouton : « Où acheter ce bon »).
  corr: Dans 07-lien, vue « acheter », pour un porteur connecté : (1) appeler PEC_BONS.propositionRecue(slug) ; (2) remplacer l'invitation masquée par une carte « Ce bon proposé est dans Mes bons » avec un lien vers ../titres/05-offre.html?o=<slug> (nouvel onglet si integre). (3) S'il a déjà des bons actifs de cette marque (PEC_BONS.bonsDeMarque), dire en une ligne où ils se dépensent (le libellé de techMarchandDestination, le lien de techDestinationUrl). Aucun champ de code. Même carte sous « Où acheter ce bon » dans la vue article.

[4] g1 impasse | ui/assets/payencash-data.js | techMarchandDestination type 'points' (marque « sans site »)
  Une marque inscrite « Je n'ai pas de site » sans la formule qui comprend le site hébergé vend des bons (réseau, ordre, lien de vente) qu'aucun écran ne permet d'utiliser : la destination est « ses propres points de vente », mais Solution n'offre à la marque aucun geste pour vérifier/utiliser un bon au comptoir, Mes bons n'affiche aucun bouton « Utiliser », et le porteur lit « Ton code — à saisir au paiement, sur ses propres points de vente ».
  corr: Soit refuser la vente des bons d'une marque dont la destination est 'points' tant qu'elle n'a ni site équipé ni site hébergé (techMarchandPeutTravailler : manque « lieu d'utilisation »), soit ajouter dans l’espace marchand un écran « Accepter un bon » (référence → techBonVerifier → bon proposé du montant de l'achat couvert via Mes bons) et l'afficher comme destination dans Mes bons.

[5] g1 promesse_sans_logique | ui/marchand/03-documentation.html | §6 « le code ne se tape jamais dans ta page — tu n'en reçois qu'un aperçu voilé » (et commentaire d'en-tête du widget)
  La promesse de sécurité est fausse : le champ « La référence de ton bon » est monté par le widget DANS le DOM de la page de la marque ; ses scripts (et tout script tiers chargé sur la page) lisent le code complet pendant la frappe, alors que le code vaut titre.
  corr: Soit déplacer la saisie dans notre cadre (le bouton ouvre la fenêtre vue « ton bon » avec un champ, rien dans la page de la marque), soit corriger la documentation, le commentaire et 10-compte : « la référence se tape dans ta page, dans un champ que nous posons ; nous ne te renvoyons qu'un aperçu voilé — ne journalise jamais ce champ ».

[6] g1 impasse | ui/marchand/06-demandes.html, ui/marchand/07-lien.html, ui/titres/05-offre.html | Bons proposés nés hors du widget : 06-demandes, 12-promouvoir, lien de vente 07-lien?v=, article 07-lien?a=
  Aucun chemin ne permet plus de couvrir un bon proposé qui n'est pas né du widget avec la même référence ET le même montant. La vue « ton bon » n'existe que dans la fenêtre du widget, qui n'ouvre que le bon proposé de sa propre commande. 05-offre ne fait plus utiliser : son « Utiliser mon bon sur … » ouvre le site de la marque, où le widget crée un AUTRE bon proposé. Conséquences : l'onglet « Couverts » de 06-demandes ne se remplit jamais pour un devis ou un cadeau ; 07-lien promet « Dès que le montant est couvert par tes bons, X en est prévenue : c'est elle qui valide ta commande » ; après l'achat du bon au comptoir, le bon proposé reste « Proposé », puis « Expiré » avec « Demande-en une nouvelle à X », adressé à quelqu'un qui détient un bon valable.
  corr: Distinguer dans le data-layer deux sortes de bons proposés. (1) Ceux d'une COMMANDE (widget, techLienPourCommande), qui se couvrent. (2) Les ORDRES (lien de vente, article, cadeau), qui se terminent quand leur bon est acheté : un état dérivé « Acheté » dès que techOrdreVente(slug).bonsVendus > 0 et !vendable, lu par 06-demandes, 07-lien et 05-offre. Pour un devis de 06-demandes, documenter que la marque passe la même référence dans data-commande pour que le widget le retrouve, et que techLienPourCommande le retrouve par référence seule. Réécrire tl-r-fin et le message d'expiration selon la sorte : un bon déjà acheté reste valable, le message le dit.

[7] g1 promesse_sans_logique | ui/marchand/11-site.html | Commande d'un article couverte : « X la prépare et te tient au courant »
  Sur le site hébergé, le client choisit un article et une taille, puis couvre la commande avec son bon (son bon est débité). La marque ne reçoit pourtant ni l'article, ni la taille, ni le client, ni un moyen de le joindre ou de le livrer. techLienCreer ne garde pas le clientId qu'on lui passe, la taille ne vit que dans une variable de la page, et 06-demandes n'affiche que montant, référence et usages. La promesse « la prépare et te tient au courant » n'a rien derrière : le client perd la valeur de son bon sans commande exploitable.
  corr: Porter sur le bon proposé de commande les lignes { article, taille, quantité } (passées par 11-site et 04 au widget, par exemple data-lignes) et le compte du porteur qui le couvre (déjà dans usages[].par). Sur 11-site, demander avant la couverture le minimum pour livrer : e-mail du compte Mes bons, adresse. Les afficher dans 06-demandes sur la ligne du bon proposé couvert, avec la finalité RGPD. Décompter le stock par taille (voir [13]).

[8] g2 obsolete | ui/marchand/03-documentation.html | §6, 10-compte › Intégration, 02-espace « Ouvrir le simulateur » : description du parcours du bouton
  Trois écrans décrivent l'ancien parcours (« au clic, notre page du bon proposé s'ouvre ; ton client choisit « J'ai un bon » ») alors que le bouton actuel déplie un champ de référence dans la page, que « J'ai un bon » n'existe plus que dans la vue « ton bon », et que « En acheter un » ouvre la vue achat sans saisie.
  corr: Une phrase unique dans le data-layer (par exemple techRef().widget.parcours) : « le bouton déplie la référence de son bon ; « Utiliser mon bon » ouvre notre fenêtre qui la relie à son compte Mes bons et couvre la commande ; « En acheter un » montre où l'acheter ». 03-documentation §6, 10-compte (Intégration) et 02-espace (simulateur) la lisent. Corriger aussi la ligne /vouchers/{code}/redeem : « depuis la fenêtre du bouton, sous le compte Mes bons du porteur ».

[9] g2 promesse_sans_logique | ui/marchand/payencash-tech-widget.js | Bout de code « en deux lignes » (10-compte, 03-documentation) et note de 04-boutique-demo
  Les deux lignes données à la marque ne suffisent pas : le widget exige window.PEC_DATA et affiche sinon « la couche de données n'est pas chargée sur cette page ». La démonstration fonctionne parce qu'elle charge payencash-data.js, bus et docs à part, tout en affirmant montrer « exactement ce qu'elle obtient en collant deux lignes ».
  corr: Faire charger par le widget ce dont il a besoin (comme il charge déjà payencash-qr.js depuis ICI), ou mettre les scripts requis dans le bout de code de 10-compte et de la documentation, et retirer de 04 les chargements que la marque n'aura pas pour que la démonstration dise vrai.

[10] g2 promesse_sans_logique | ui/marchand/03-documentation.html | Point d'entrée « /api-keys POST / DELETE … techCleRevoquer »
  La documentation annonce une révocation de clé (DELETE, techCleRevoquer) qui n'existe pas : une clé ne tombe qu'en en générant une autre. Une marque suspendue garde une clé vivante (son bouton s'affiche toujours), et ni la marque (révoquer sans remplacer) ni le manager (clé fuitée) ne peuvent l'arrêter.
  corr: Créer techCleRevoquer(marchandId, motif, par) (revoqueLe, motif, journal tech_cle_revoquee), l'appeler depuis 10-compte (« Révoquer sans remplacer »), depuis manager 46-marques et depuis techMarchandSuspendre ; ou retirer DELETE et techCleRevoquer de la documentation.

[11] g2 promesse_sans_logique | ui/marchand/03-documentation.html | État « echu » du cycle du contrat-cadre
  La documentation décrit un état echu (terme des 12 mois ou résiliation) que rien n'atteint : aucune fonction ne fait échoir un contrat, techMarchandPeutTravailler ne lit que contratSigneLe, donc la clé, le bouton, les bons proposés et la vente continuent indéfiniment après le terme.
  corr: Ajouter au data-layer techMarchandContratFin(m) = contratSigneLe + dureeContratMois mois, et un état dérivé « echu ». Dans techMarchandPeutTravailler, ajouter le manque « Contrat arrivé à son terme — un nouveau contrat à signer ». Ce manque ferme l'ACHAT : techBonEmettre, techVenteLienCreer, techOrdreVente.vendable, le bloc, les nouveaux bons proposés à acheter. Il ne ferme PAS l'usage des bons déjà vendus : techLienPourCommande en vue « ton bon » et techLienUtiliserBon restent ouverts jusqu'à l'échéance de chaque bon.

[12] g2 incoherence | ui/marchand/03-documentation.html | §7 « sans lui, le bloc dit ce qui manque, dans ta page »
  La documentation dit que, sans lien de vente, le bloc affiche ce qui manque dans la page ; depuis l'audit du 24/09 le widget efface le bloc et ne l'écrit qu'en console et dans un attribut.
  corr: Remplacer par « sans lui, le bloc ne s'affiche pas chez tes clients : la raison est dans la console et dans l'attribut data-pect-absent (et dans Compte › Intégration) ».

[13] g2 incoherence | ui/marchand/11-site.html | Section « Le bon d'achat » (#s-bon-p)
  Sur le site public de la marque, sans lien de vente, le texte destiné à la marque s'affiche aux clients : « Aucun lien de vente pour X — crée-le dans ton espace (Paiement) : c'est lui que ce bloc ouvre. » — exactement le défaut corrigé dans le widget le 24/09.
  corr: Sur 11-site, sans bb.ok, masquer toute la section #bon (ou n'y laisser que « Où l'acheter ») ; le motif reste dans 10-compte pour la marque.

[14] g2 incoherence | ui/assets/payencash-data.js | Portes de techLienCreer, techLienPourCommande, techBlocBon, widget marqueParCle, 07-lien?v=
  Les portes ne tiennent pas la même règle : techVenteLienCreer, techBonEmettre et techBoutiques exigent techMarchandPeutTravailler (documents à jour, contrat signé), mais techLienCreer/techLienPourCommande/techBlocBon et le widget non. Une marque dont une nouvelle version de CGU attend d'être acceptée garde son bouton et son bloc, fait naître des bons proposés et envoie ses clients vers « Où l'acheter », où chaque comptoir refusera la vente. Une marque suspendue voit s'afficher à ses clients « Cette marque n'est pas vérifiée », et son lien de vente s'affiche encore puis refuse au « Continuer ».
  corr: Séparer deux règles dans le data-layer. (1) Règle ACHAT = techMarchandPeutTravailler. Elle est lue par techOrdreVente (vendable = … && peutTravailler), techBlocBon, techVenteLienCreer, 07-lien?v= et ?a= avant d'afficher la vente, et par la vue « acheter » du widget. Motif côté client neutre : « Les bons {marque} ne s'achètent pas en ce moment ». (2) Règle USAGE : un bon proposé de commande (techLienPourCommande appelé avec un code, vue « ton bon ») et techLienUtiliserBon restent ouverts pour une marque suspendue ou en attente de documents, tant que le bon n'est ni échu ni annulé. marqueParCle monte le bouton en mode « usage seul » (sans « En acheter un ») si l'achat est fermé.

[15] g2 casse | ui/assets/payencash-data.js | techArticleStock
  Le stock d'un article compte une unité par USAGE de bon, pas par commande ni par achat : une commande couverte par deux bons retire deux exemplaires ; un bon acheté au comptoir sur l'ordre d'un article ne retire rien tant qu'il n'est pas utilisé (l'article peut se revendre au-delà du stock) ; le panier par défaut de 04-boutique-demo (deux articles) ne pose pas data-article et ne décompte jamais, et techLienPourCommande ne sait porter qu'un seul article. techArticleMajTailles s'appuie sur ce « vendus » faussé.
  corr: Compter UNE unité par bon proposé né de l'article, dès que son ordre est acheté (techOrdreVente(slug).bonsVendus > 0) ou qu'il a un usage. Ne pas compter une seconde fois le bon proposé de commande (widget) couvert par un bon dont `ordre` est un bon proposé du même article. Porter sur le bon proposé des lignes { article, taille, quantité } (techLienPourCommande o.lignes, posées par 11-site et 04), et décompter par taille. techArticleMajTailles lit le même compte.

[16] g2 casse | ui/marchand/07-lien.html | Invitation Mes bons (#tl-app-creer, #tl-app-connexion) dans la fenêtre intégrée
  Dans la fenêtre du widget (vue achat), « Créer mon compte » et « J'ai déjà un compte — ouvrir ce bon » n'ont pas de target : ils remplacent notre page par Mes bons DANS le cadre du site de la marque ; le client y utilise son bon sur 05-offre, qui ne poste rien à la page parente, donc payencash:couvert n'est jamais émis et le tunnel de la marque n'apprend rien. En vue « ton bon » sans compte, deux blocs disent la même chose avec deux comportements (#tl-jai-connexion en nouvel onglet, #tl-app-* dans le cadre).
  corr: Si integre : ouvrir inscription et connexion dans un nouvel onglet et garder la fenêtre à l'écoute (storage). N'afficher #tl-app qu'en vue « acheter » et #tl-jai-sans qu'en vue « ton bon ». Ne jamais naviguer le cadre hors de 07-lien.

[17] g2 promesse_sans_logique | ui/marchand/07-lien.html | prevenir() (référent) et « Connecte-toi, puis reviens ici : cette fenêtre le verra »
  Deux hypothèses ne tiendront pas hors de la maquette mono-origine : ① la fenêtre intégrée doit voir la session Mes bons ouverte dans un autre onglet via localStorage, or un cadre tiers sur le site de la marque a un stockage partitionné (Chrome, Safari) — la connexion faite à côté ne sera jamais vue ; ② prevenir() ne parle qu'à l'origine lue dans document.referrer : une page de marque en Referrer-Policy no-referrer ne reçoit ni 'couvert' ni 'fermer' (« Revenir à {marque} » ne fait plus rien).
  corr: Faire annoncer son origine par le widget au chargement (postMessage {type:'bonjour'} du parent, origine lue dans e.origin) ; porter la session Mes bons par le serveur (jeton/Storage Access API) plutôt que par localStorage partagé ; écrire la limite dans la documentation.

[18] g2 manque_fonctionnel | ui/titres/02-titre.html | Détail d'un bon : aucun historique des usages
  Mes bons relit bien le solde, mais ne montre nulle part où, quand et pour quelle commande un bon a été utilisé, alors que 07-lien promet « il s'y enregistre à ton nom, et chaque usage y garde sa trace ». Les usages existent (pec-tech-liens.usages avec code, pris, at, par) et le manager les voit (18-fiche-client), pas le porteur.
  corr: Ajouter au data-layer techBonUsages(code) (dérivé des usages des bons proposés) et une carte « Utilisations » dans 02-titre : date, marque, référence de commande (techLienRefClient), montant pris, reste après.

[19] g2 manque_fonctionnel | ui/manager/46-marques.html | Fiche marque (manager) et hotline
  Ni le manager ni la hotline ne voient les bons proposés d'une marque, ses liens de vente, ni l'état de sa clé d'API ; un client qui appelle pour « ma commande n'est pas couverte » ne peut pas être aidé, et une clé compromise ne peut pas être coupée par le back-office.
  corr: Dans 46-marques : onglets « Bons proposés » (techLiens, état, usages), « Liens de vente » (techVenteLiens, stats) et « Intégration » (clé active, dernier appel, bouton Révoquer via techCleRevoquer) ; dans la hotline, une recherche par référence OV- ou slug (techLien).

[20] g2 manque_fonctionnel | ui/marchand/08-paiement.html | Mes liens de vente à partager (libre et à montant précis)
  Un lien de vente n'a pas de fin : aucune désactivation ni suppression, même pour un montant précis créé par erreur ou un lien qui circule sur un réseau où la marque ne veut plus vendre ; la table sales_links n'a pas de colonne d'état.
  corr: Ajouter techVenteLienRetirer(slug, par, motif) (champs retireLe, motif ; journal). Proposer un bouton « Retirer ce lien » dans 08-paiement et 12-promouvoir. Faire dire à 07-lien?v= « Ce lien n'est plus proposé par {marque} ». Colonne retired_at dans sales_links. Enfin, le retrait de l'accès d'un collaborateur retire ses liens de vente (ou 07-lien?v= refuse quand _techCollabActif échoue).

[21] g2 casse | ui/marchand/10-compte.html | Lien « Mon bouton, en situation » sans clé
  Une marque sans clé voit le lien « Mon bouton, en situation » avec ?pk=pk_ta_cle_publique ; la démonstration ne trouve pas cette clé et se rabat sur la première marque de l'appareil qui en a une : la marque voit la boutique, les articles et la clé publique d'une AUTRE marque présentés comme les siens.
  corr: Dans 10-compte, n'afficher le lien qu'avec une clé active (comme 02-espace) ; dans 04, ne jamais se rabattre sur une autre marque quand un ?pk= est donné : dire « Clé inconnue ou révoquée ».

[22] g2 manque_fonctionnel | ui/marchand/03-documentation.html | §6 vérification serveur de la commande couverte
  Le montant et la référence du bon proposé viennent des attributs data-montant/data-commande, modifiables par le client dans son navigateur : il peut réduire le montant à 1 € et faire émettre payencash:couvert. La documentation dit seulement que le serveur « vérifie le bon proposé avec ta clé secrète », sans dire de comparer montant et référence à la commande ni exposer le point d'entrée qui les rend.
  corr: Écrire dans la documentation : « Avant de valider, ton serveur lit GET /offers/{offre} avec sk_ et vérifie etat = used, montant = total de la commande, reference = ta référence » ; à terme, faire créer le bon proposé par le serveur de la marque (sk_) et ne passer au widget qu'un identifiant signé.

[23] g2 vocabulaire | ui/marchand/payencash-tech-widget.js | « La référence de ton bon » (code TB-) contre « réf. du bon à acheter » (OV-)
  Le mot « référence » désigne deux choses différentes : le code du bon à utiliser (TB-XXXX-XXXX-XXXX, champ du widget, 07-lien) et la référence de l'ordre de vente à acheter (OV-XXXXXX, ticket, flashcode, 09-marques). Un client qui tape dans le widget la référence OV- imprimée sur son ticket de bon proposé reçoit « Bon inconnu » ; Mes bons, lui, dit « code ».
  corr: Garder « la référence de ton bon » pour le code TB- (mot de la fondatrice), mais lever l'ambiguïté. (1) Sous le flashcode, dans ordreVenteBlocHTML et techLienTicketHTML, écrire « Référence de l'ordre, à lire par le commerce : OV-… ». (2) _techBonControle reconnaît une saisie qui commence par techRef().prefixeOrdre et répond « C'est la référence de l'ordre (pour acheter ton bon au comptoir), pas celle de ton bon : saisis celle de ton ticket d'achat (TB-…) ». (3) Mes bons 02-titre et 08-boutique emploient le même mot que le widget.

[24] g2 obsolete | ui/assets/payencash-data.js | bonsRef / ref.bons (« Bon d'achat PayEnCash »), _techBonControle, PEC_BONS.familleAutre
  L'ancien « Bon d'achat PayEnCash » (Mode, Fly, Stripe) reste dans le data-layer : son référentiel ref.bons porte encore le nom, les mentions « utilisable uniquement sur payencash.fr (Mode et Fly) », un PSP Stripe Connect et une commission, et c'est pourtant lui qui fournit aux bons de marque leur validité, minimum et plafonds (bonsRef). La vérification d'un code affiche encore « Ce code est un Bon d'achat PayEnCash : il s'utilise sur payencash.fr (Mode, Fly) » — branche morte car pec-bons n'est plus jamais écrit (bonEmettre n'a aucun appelant).
  corr: Créer techRef().bons (minimum, plafondBon, plafondClientJour/Mois, fenetrePlafondJours, validiteMois) pour les bons de marque et y brancher techBonEmettre, techLienCreer, techBlocBon, 07-lien, 10-compte ; supprimer ref.bons, bonsRef, bonsGet/_bonsPut, bonEmettre, bonEmettreSerie, bonParCode, bonSerieVue, bonValider, prelevementPartenaire, la branche reseauAutre de _techBonControle et PEC_BONS.familleAutre (et leurs usages dans 01/02).

[25] g2 incoherence | ui/assets/payencash-data.js | techLienTicketHTML, techBlocBon, note de 04-boutique-demo
  Le lieu d'utilisation imprimé sur le ticket, le bloc et la démonstration vient de m.siteUrl (copié sur le bon proposé), pas de techMarchandDestination : pour une marque inscrite sans site, la mention légale devient « utilisable uniquement sur . » ; pour une marque au site hébergé, elle nomme son site propre alors que Mes bons envoie le client sur le site hébergé.
  corr: Une seule fonction, techMarchandLieuUtilisation(m) → { lbl, url }, dérivée de techMarchandDestination, lue par : le ticket, techBlocBon, 07-lien, 04, 05-offre (cadre), les textes de partage de 08-paiement et 12-promouvoir, et Mes bons. Ne plus recopier `site` sur le bon proposé ni sur le bon.

[26] g2 incoherence | ui/marchand/06-demandes.html | KPI « X € de bons à acheter au comptoir » et ligne d'un bon proposé
  06-demandes additionne le « restant » de tous les bons proposés ouverts ou entamés, y compris ceux dont le bon a déjà été acheté sur l'ordre. Aucune ligne ne montre le bon acheté que le partage a produit. 13-mes-ventes (le même suivi côté collaborateur) lit pourtant techOrdreVente(...).vendable et techLienBons. Deux écrans disent donc la même chose différemment, et la marque lit un montant « à acheter » déjà acheté.
  corr: Dans 06-demandes, calculer le KPI sur techOrdreVente(x.slug).montant (ce qui reste à VENDRE). Sur chaque ligne, lister techLienBons(x.slug) (code voilé, commerce, date), comme 13-mes-ventes. Même libellé dans les deux écrans.

[27] g2 incoherence | ui/marchand/payencash-tech-widget.js | monter() et ouvrir() : messages d'intégration affichés aux clients de la marque
  Le 24/09, le bloc de pied de page a été corrigé : sans lien de vente, il s'efface, écrit en console et porte data-pect-absent, parce que « crée-le dans ton espace » s'adressait à la marque sur la page de ses clients. Le bouton affiche toujours, dans le tunnel de commande, des messages destinés à l'intégrateur : « Clé publique inconnue ou révoquée — vérifie-la dans ton espace PayEnCash Marchand », « Aucun montant (data-montant) — le bouton ne s'affiche pas », « Aucune référence de commande (data-commande) ». Au clic, il affiche aussi les refus bruts du data-layer, par exemple « Sa déclaration « réseau limité » n'est pas validée — rien ne s'ouvre avant ».
  corr: Même règle que le bloc. Une erreur d'intégration (clé, montant, référence) efface le bouton et part dans console.warn et data-pect-absent ; 04-boutique-demo et 10-compte (Intégration) la montrent à la marque. Au clic, un refus de la marque s'affiche au client sous une forme neutre, rédigée au data-layer (par exemple « Le bon d'achat {marque} n'est pas disponible pour cette commande »), et le motif détaillé va en console.

[28] g2 manque_fonctionnel | ui/marchand/11-site.html, ui/marchand/04-boutique-demo.html, ui/assets/payencash-data.js | Bouton « Commander » et widget pour un article réservé aux porteurs
  11-site et 04 n'affichent pas l'avant-première : tout client peut cliquer « Commander » et choisir sa taille. Le refus n'arrive qu'au clic du widget, sous le bouton. Pire, un vrai porteur qui tape la référence de son bon est aussi refusé s'il n'est pas connecté à Mes bons sur cette page : techLienPourCommande → techLienCreer teste clientPorteurDe(clientActifGet) AVANT de regarder le code saisi, alors que ce code prouve qu'il tient un bon de la marque.
  corr: 11-site et 04 lisent techArticleAvantPremiere(a) et affichent « Réservé aux porteurs d'un bon {marque} jusqu'au … » avec le lien de vente. techLienPourCommande accepte o.code : un code valide pour cette marque (techBonVerifier(code, { marchandId })) vaut preuve de porteur. Sinon, le contrôle d'avant-première se fait à l'usage et non à la naissance du bon proposé.

[29] g3 incoherence | ui/assets/payencash-data.js | techOrdreVenteUrl → partenaire/09-marques.html?vendre=
  Le flashcode de l'ordre de vente vise 09-marques, qui ne fait que rediriger vers 03-vendre ; le commentaire de la fonction interdit précisément un flashcode qui mène à une redirection.
  corr: Faire pointer techOrdreVenteUrl sur '03-vendre.html?vendre=' et garder la redirection de 09-marques pour les anciens tickets.

[30] g3 code_en_dur | ui/assets/payencash-data.js | Adresses et valeurs écrites en dur
  Plusieurs valeurs sont écrites dans le code au lieu du référentiel : domaine de repli 'https://solution.payencash.fr' (techLienUrl, PEC_TECH.origine, dont le commentaire promet de « dire » plutôt qu'inventer une adresse), exemple curl 'https://api.payencash.fr/v1/merchants/MCH-00001/offers' (chemin absent de la liste des points d'entrée), préfixe 'TB-' de repli dans 07-lien.
  corr: Ajouter à techRef() un bloc `api` ({ base, originePublique }), vide tant que ce n'est pas décidé, sans réutiliser siteHebergement.apiBase. Construire techLienUrl comme techVenteLienUrl (racine /ui/marchand/, sans domaine de repli). Quand l'adresse manque, PEC_TECH.origine dit « adresse à venir ». L'exemple curl utilise un chemin listé (/offers) et un identifiant fictif hors format réel. Retirer le repli 'TB-'.

[31] g3 code_en_dur | ui/marchand/03-documentation.html | « Les trois offres de paiement » et bandeau de réserve
  Le nombre d'offres est écrit (« trois ») alors que la liste vient de techModes(), et les deux points juridiques « à faire valider » sont écrits dans l'écran au lieu du référentiel juridique.
  corr: « Les offres de paiement (' + D.techModes().length + ') » ; déplacer les points à valider dans ref.juridique (ou techRef().fondement.aValider) et les lister depuis là.

[32] g3 obsolete | ui/assets/payencash-data.js | Commentaires obsolètes (Mode, Fly, contrat marque↔point, fournisseur Mode, mise en relation)
  Des commentaires de la famille décrivent encore l'ancien modèle : ordre de vente « on n'encaisse pas un code PayEnCash Mode ou Fly », « techBonEmettre refuse s'il n'a pas de contrat vivant avec CETTE boutique », « trois cartes À régler (Mode, Fly…) », ticket « son contrat avec CETTE boutique fait la loi », article « même mécanique que la publication d'un fournisseur Mode », socle PEC_TECH « API de mise en relation » ; 07-lien affirme en tête « Aucun code ne se tape ici » puis l'inverse.
  corr: Supprimer ces passages (règle « supprimer l'obsolète ») et ne garder que la décision actuelle datée : grossiste, pas de contrat marque↔point, deux réseaux (commerce, nomade).

[33] g3 code_mort | ui/assets/payencash-bons.js | État 'vierge' (« Pas encore vendu »)
  L'état « Pas encore vendu » (code édité sans montant) ne peut plus arriver : le bon naît à la vente avec son montant depuis le 23/09 ; les refus et filtres qui le testent sont morts.
  corr: Retirer 'vierge' de ETATS, de vueMarque, de ajouter, enAttente et rangerAttente.

[34] g3 incoherence | ui/marchand/06-demandes.html | Copier le lien (#td-copier, data-copier)
  Le bouton affiche « Lien copié » même quand le presse-papiers refuse, alors que 08-paiement et 12-promouvoir disent « Sélectionne et copie » en cas d'échec.
  corr: Reprendre la fonction de 08-paiement (promesse then/échec, sélection du texte, libellé honnête), idéalement partagée dans PEC_TECH.

[35] g3 vocabulaire | ui/marchand/08-paiement.html | Compteurs « bons vendus par ce lien » et ligne « Couvert : les achats du réseau sont encaissés »
  Les mêmes statistiques disent « bons vendus » dans 08-paiement et « bons achetés » dans 12-promouvoir ; et « Couvert » y désigne des prélèvements encaissés, alors que partout ailleurs « couvert » désigne un bon proposé couvert par des bons.
  corr: « bons achetés grâce à ce lien » partout ; remplacer « Couvert : » par « Encaissé : » (ou « Prélèvements revenus payés ») pour la ligne d'échéance.

[36] g3 redondance | ui/titres/08-boutique.html | Fonction texteSur recopiée
  La règle du texte lisible sur la couleur de la marque (WCAG) est recopiée dans le widget et dans 08-boutique, avec des sorties différentes ('#0f2a24' contre 'var(--color-ink)').
  corr: Une fonction D.couleurTexteSur(hex) dans payencash-data.js, lue par le widget (qui charge déjà PEC_DATA) et 08-boutique.

[37] g3 incoherence | ui/titres/02-titre.html | Lien « Ouvrir {site} » du détail d'un bon
  Le détail d'un bon ouvre dest.url, alors que 08-boutique et les cartes d'article passent par techDestinationUrl : en démonstration, la même marque mène au site simulé depuis la boutique mais au vrai domaine (fictif) depuis le détail du bon.
  corr: vueMarque expose url: techDestinationUrl(tb.marchandId) et 02-titre l'utilise (lien relatif accepté, pas seulement http).

[38] g3 vocabulaire | ui/marchand/07-lien.html | Message d'article épuisé
  Le texte visible parle encore de « demande » (l'ancienne « demande de paiement ») pour un bon proposé.
  corr: « … trouvé preneur : aucun bon ne se propose sur cet article. Demande à {marque} s'il revient. »

[39] g3 obsolete | ui/titres/05-offre.html, ui/assets/payencash-bons.js, ui/distributeur/03-vendre.html, ui/assets/payencash-data.js | Passages qui disent encore que 05-offre utilise ou range les bons
  Depuis la décision du 24/09 (« les bons s'utilisent sur le site de la marque »), 05-offre ne fait plus utiliser. Plusieurs passages décrivent encore l'ancien parcours : l'en-tête de 05-offre se contredit, le socle PEC_BONS situe l'usage « page 05 », le ticket du comptoir annonce que le bon « s'y utilise », et le data-layer dit qu'une fenêtre de widget « ne peut pas utiliser un bon : elle mène à l'app », alors que c'est aujourd'hui le seul endroit où l'on utilise un bon.
  corr: Supprimer ces passages et les remplacer par la règle en vigueur, datée : l'usage se fait dans la fenêtre du bouton de la marque (07-lien, vue « ton bon »), sous le compte Mes bons ; 05-offre montre la proposition, où acheter, et mène au site de la marque.


######## bon — Le bon d'achat lui-même (33 confirmés, 5 oublis, 1 réfutés)

[0] g1 promesse_sans_logique | ui/assets/payencash-data.js (techBonEmettre, techLienCreer) · ui/marchand/10-compte.html · ui/marchand/07-lien.html · documents/conditions-bons-de-marque.html | techBonEmettre ~l.8180 ; techLienCreer ~l.8706 ; 10-compte l.667-668 ; 07-lien l.365-366 ; conditions art. 7.2
  Le minimum par bon (5 €), le plafond par bon (250 €, « au-delà, l'achat se découpe en plusieurs bons ») et les plafonds par client (1 000 €/jour, 3 000 €/30 jours) sont promis à la marque (Compte › Règles), au client (page du lien de vente) et dans le contrat (« Une vente qui les dépasserait n'a pas lieu »). Aucune fonction de la chaîne des bons de marque ne les applique : un bon de 0,01 € ou de 5 000 € s'émet, un bon proposé de 10 000 € se crée et se vend en UN seul bon.
  corr: Même correction. Ajouter à la liste des appelants techVenteLienCreer (montant du lien de vente) et techMiseEnRelationBonVerifier (branche carte), qui ne vérifient que le minimum. Les plafonds par client ne peuvent pas être tenus au comptoir, qui ne connaît pas le client : soit on les applique au rangement et à l'usage dans le data-layer (et non dans PEC_BONS), soit on les retire de 10-compte:668, 07-lien et de l'art. 7.2.

[1] g1 contourne | ui/assets/payencash-bons.js · ui/titres/01-mes-titres.html · ui/titres/02-titre.html · server/db/schema.sql | PEC_BONS.retirer (l.~351), PEC_BONS.kyc (l.~262), ajouter (contrôle de doublon), customer_vouchers PK
  Le palier d'identité (250 € en espèces, 500 € par carte, sur 30 jours) se contourne de deux façons. (1) « Retirer » un bon fait baisser le cumul : il suffit de ranger un bon, de l'utiliser, de le retirer, puis d'en ranger un autre, sans limite. (2) Un même code se range dans plusieurs comptes à la fois : on répartit ses bons sur plusieurs comptes, chacun sous le palier. Les textes « rangé à ton nom », « Le bon s'y range au nom de son utilisateur » et « jamais anonyme à l'usage » sont donc faux.
  corr: Même correction : rattachement dans le data-layer (b.porteurId posé au premier rangement), UNIQUE(voucher_code), retrait qui ne fait que masquer. En plus, le cumul de vigilance se calcule sur les bons rattachés au clientId côté data-layer, pas sur la liste de l'appareil. La suppression du compte ne détache pas les bons (anonymisation, comme A-02 pour la fiche).

[2] g1 casse | ui/assets/payencash-data.js | techBonEmettre : _techVenteEnregistrer avant le tirage et l'écriture du bon
  La vente (et le débit de l'avance du nomade) est écrite AVANT le tirage du code et l'écriture du bon, sans retour arrière. Si le compteur, le générateur d'aléa ou l'écriture de pec-tech-bons échoue, il reste une vente « à prélever » sans bon : elle entre dans l'arrêté, le commerce est prélevé et la marque est payée pour un bon qui n'existe pas. Côté nomade, l'avance reste débitée. L'ancien bonEmettre remboursait son prélèvement en cas d'échec ; le nouveau ne défait rien. Le schéma le signale (C-02) mais le code n'est pas corrigé.
  corr: Même correction. Tester en plus le retour de _techVenteLier, ou mieux, écrire la vente avec `bon` déjà posé (id TBN réservé avant) pour supprimer la seconde écriture.

[3] g1 incoherence | ui/assets/payencash-data.js (techBonTicketHTML, techBlocBon, techMarchandDestination) · ui/assets/payencash-bons.js (vueMarque) · ui/distributeur/03-vendre.html | Ticket « utilisable uniquement sur … », mentions Mes bons, flashcode du ticket
  Une marque inscrite avec « pas de site » (sansSite, siteUrl null) déclare des bons « valables dans ses propres points de vente ». Pourtant le ticket imprimé indique « utilisable uniquement sur » suivi de rien. Mes bons indique « Utilisable uniquement sur ses propres points de vente — le site de X ». Le flashcode, le cadre et les notes de 03-vendre et 04-titres, ainsi que les conditions art. 1.1, disent « uniquement sur le site de la marque ». Enfin, aucun outil ne permet de dépenser un bon en magasin. Le titre remis au client porte donc une mention fausse ou vide sur le seul endroit où il vaut.
  corr: Même correction (techBonOu unique, lu par le ticket, vueMarque, techBlocBon, reglesAchatHTML, RAPPEL, 03-vendre, 04-titres, 07-mon-point, conditions art. 1.1). Pour le type 'points', nommer le geste existant : « la marque crée en magasin un bon proposé que tu couvres depuis Mes bons ». Il faut aussi corriger RAPPEL (payencash-bons.js:48, « sur son site, et nulle part ailleurs »), faux pour cette marque.

[4] g1 contourne | ui/marchand/07-lien.html · ui/marchand/payencash-tech-widget.js · ui/assets/payencash-data.js (techLienPourCommande) | Section « Acheté pour cette commande » (achetes, bouton data-achete « Utiliser ») et reprise du bon proposé par (clé publique, référence, montant)
  La page d'un bon proposé liste, pour tout compte Mes bons connecté, les bons vendus sur son ordre et pas encore rangés par CE compte. Elle offre « Utiliser », qui les range dans ce compte (PEC_BONS.ajouter) sans que la personne connaisse le code. Or le bon proposé d'une commande se retrouve avec la seule clé publique de la marque (publique par nature), la référence de commande et le montant : techLienPourCommande rend le même lien (`reprise: true`). N'importe qui peut donc ouvrir la fenêtre d'une commande qui n'est pas la sienne et s'approprier le bon payé par le vrai client : il le range, voit son code en entier dans 02-titre, puis le dépense sur sa propre commande. Le client qui l'a déjà rangé le voit toujours s'afficher chez l'autre compte, puisqu'aucun rattachement n'existe (constat 1).
  corr: Supprimer le raccourci « Acheté pour cette commande » pour qui n'a pas le code. Ne le montrer qu'au compte qui a demandé la rencontre (rencontre.clientId) ou qui a ouvert le bon proposé en premier (techLien.clientId posé à la première ouverture sous un compte). Dans tous les autres cas, exiger la saisie du code imprimé sur le ticket. Lier la reprise de techLienPourCommande à la même session ou au même clientId, sinon ouvrir un nouveau bon proposé. Et poser le rattachement du bon à un seul porteur (constat 1), qui ferme le reste.

[5] g1 promesse_sans_logique | ui/assets/payencash-data.js (techLienCreer, techMarchandSuspendre) · ui/titres/08-boutique.html · ui/assets/payencash-bons.js (vueMarque) · documents/conditions-bons-de-marque.html | Refus de tout bon proposé dès que la marque n'est plus 'validated'
  Quand le manager suspend une marque, techLienCreer refuse tout nouveau bon proposé en son nom. Or c'est le seul chemin d'usage d'un bon, par le widget du site ou le site hébergé via techLienPourCommande. Les porteurs ne peuvent donc plus dépenser des bons payés, alors que Mes bons les affiche « Actif » (vueMarque ignore l'état de la marque), que 08-boutique affirme « Ses bons déjà achetés restent valables sur son site, jusqu'à leur date de fin » et que les conditions (art. 4.1) font honorer tout bon « y compris après l'extinction du contrat-cadre ». La suspension ne dit rien aux porteurs, et aucun écran manager ne montre la valeur bloquée.
  corr: Séparer les deux gestes. La suspension ferme la VENTE (techBonEmettre, techVenteLienCreer, 03-vendre), mais pas l'USAGE des bons déjà vendus : techLienCreer et techLienPourCommande acceptent une marque suspendue pour couvrir une commande avec des bons existants, et la page le dit. Si la fondatrice veut au contraire bloquer l'usage, dériver un état « marque suspendue » dans vueMarque, prévenir les porteurs dans leur fil, afficher dans 46-marques la valeur en circulation bloquée, et corriger 08-boutique:149 et l'art. 4.1.

[6] g2 incoherence | ui/distributeur/04-titres.html · ui/marchand/02-espace.html · ui/marchand/13-mes-ventes.html · ui/manager/30-carte-operations.html | pillEtat / techBonEtatLbl(b.etat) ; compteur « En circulation »
  L'expiration n'est dérivée que dans Mes bons et dans les contrôles. Les écrans professionnels affichent un bon expiré comme vivant (« Remis au client », pastille verte), et le tableau de bord de la marque compte son solde dans « En circulation — X € encore à dépenser chez toi ». Mes bons dit « Expiré » pour le même bon.
  corr: Ajouter au data-layer techBonEtatVif(b) → 'expired' si now > expireLe (et non redeemed ni cancelled), 'partial' si solde < montant, sinon l'état écrit. Ajouter 'expired' et 'partial' à TECH_BON_ETATS (« Expiré », « Entamé ») et une fonction techBonPill(b) partagée. Remplacer les trois pillEtat recopiés et le filtre de 02-espace par ces fonctions.

[7] g2 manque_fonctionnel | ui/assets/payencash-data.js · ui/titres/01-mes-titres.html · ui/marchand/02-espace.html | Fin de vie d'un bon non épuisé
  L'expiration n'a aucune suite : pas d'événement journalisé, aucun rappel au porteur avant l'échéance (alors que « passé ce délai, ce qu'il reste est perdu »), et ni la marque ni le manager ne voient la valeur tombée à l'échéance. La notion naît (expireLe), mais aucun écran ne la montre à celui qui y perd de l'argent avant qu'il ne soit trop tard.
  corr: Dériver techBonsExpirantBientot(clientId, jours) (délai d'alerte au référentiel, réglable) et l'afficher en tête de 01-mes-titres et sur la carte du bon, avec une ligne dans le fil de notifications du porteur. Ajouter côté marque (02-espace) et manager (46-marques) un compteur dérivé « valeur non utilisée à l'échéance » par mois. Journaliser tech_bon_expire au premier passage qui constate l'expiration, par une tâche idempotente comme celles de l'arrêté.

[8] g2 promesse_sans_logique | ui/distributeur/04-titres.html · ui/assets/payencash-data.js (techBonAnnuler) · documents/conditions-bons-de-marque.html | « seule la marque peut encore rembourser », « Fais une reprise avec la marque », « blocage sur signalement motivé »
  Au-delà du délai d'annulation au comptoir, les motifs et la note renvoient à un remboursement par la marque ou à une « reprise convenue entre AJEK et la Marque » (conditions 5.2). Les conditions (art. 2) promettent aussi un blocage du bon sur signalement de perte ou de vol. Aucune de ces trois opérations n'existe : ni fonction, ni état 'bloqué' côté bon de marque, ni écran hotline, manager ou marque pour le faire.
  corr: Soit créer techBonBloquer(code, motif, par) et techBonDebloquer côté hotline ou manager (état 'blocked' dans TECH_BON_ETATS, contrôlé par _techBonControle et affiché dans Mes bons), ainsi que techBonReprise(code, motif, par) côté manager (vente → annulee ou note de crédit, marque non payée ou à rembourser selon marqueStatut, bon → cancelled). Soit retirer ces phrases des motifs, de 04-titres et des conditions art. 2 et 5.2, et dire à la place ce qui se passe réellement.

[9] g2 incoherence | ui/assets/payencash-data.js (techBonTicketHTML) · ui/distributeur/03-vendre.html | Contenu du ticket
  Le ticket est le seul document que le client emporte, et 03-vendre annonce qu'il « lui sert de reçu ». Il ne porte pourtant ni la date d'achat, ni le point ou le nomade qui l'a vendu, ni la référence de la vente, ni les mentions « ni remboursable en espèces, pas de rendu de monnaie », ni « le code vaut titre », ni l'obligation de ranger le bon dans Mes bons pour l'utiliser. Seule la copie locale flashHTML le dit, et elle manque sur le ticket d'une rencontre et sur celui renvoyé par l'API. Il affiche aussi l'adresse brute copiée à l'émission (« https://lila.fr »), alors que Mes bons affiche la destination vivante (domaine ou boutique hébergée).
  corr: Même correction, en gardant l'absence de flashcode « à scanner » pour le ticket d'une rencontre (bon déjà rangé). À la place, mettre une ligne « rangé dans Mes bons de <compte masqué> le … ».

[10] g2 obsolete | ui/assets/payencash-data.js (ref.bons, bonsRef) · ui/manager/10-configuration.html · server/db/schema.sql | bonsRef().validiteMois, minimum, fenetrePlafondJours, annulationMinutes
  La validité des bons de marque, le minimum et la fenêtre de vigilance viennent de ref.bons, le référentiel du « Bon d'achat PayEnCash » (« utilisable uniquement sur payencash.fr (Mode et Fly) », prestataire Stripe, prefixeTicket 'BV-', mentions « re-crédité sur le bon d'achat »). Aucun champ de Configuration ne règle 'bons.*' : la validité est figée à 12, sans réglage manager. Le délai d'annulation existe en double (ref.bons.annulationMinutes, mort, et ref.tech.annulationMinutes, vivant). vueMarque ajoute une phrase écrite en dur, « (au moins un an : c'est un engagement de la marque) », quel que soit validiteMois, alors que fondement.validite parle d'un « Engagement contractuel du réseau ».
  corr: Créer ref.tech.bon = { validiteMois, validiteMinMois:12, minimum, plafondBon, plafondClientJour, plafondClientMois, fenetreJours } et une fonction techBonRef(), réglable dans 10-configuration (tech.bon.*), qui refuse une validité inférieure au minimum contractuel. Remplacer tous les appels à bonsRef() (03-vendre, 04-titres, 07-mon-point, 10-compte, 07-lien, 08-paiement, 12-promouvoir, index.html, techBlocBon, reglesAchatHTML, kycPorteurRef, techBonEmettre, techVenteLienCreer, techMiseEnRelationBonVerifier). Dériver la phrase de vueMarque du nombre de mois et de fondement.validite (une seule formulation : engagement de la marque, comme dans les conditions). Supprimer ref.bons et bonsRef, ainsi 

[11] g2 contourne | ui/assets/payencash-data.js (techLienUtiliserBon, techBonUtiliser) · ui/marchand/03-documentation.html | Règles « bon rangé », « app obligatoire » et palier appliquées dans PEC_BONS.utiliser seulement
  Les règles de l'usage (bon rangé dans le compte, compte réel, palier d'identité respecté) sont écrites dans le module d'écran PEC_BONS, pas dans le data-layer. techLienUtiliserBon accepte n'importe quelle chaîne comme `par` et un bon rangé nulle part. Or l'API documente POST /vouchers/{code}/redeem sur techLienUtiliserBon : ce chemin contourne toutes ces règles.
  corr: Déplacer dans techLienUtiliserBon (ou dans un techBonUsagePeut(code, clientId) du data-layer) : le compte existe et est actif (this.client(par)), le bon est rattaché à ce compte (b.porteurId === par, voir le constat sur la vigilance), et aucun palier n'est franchi sans identité vérifiée. PEC_BONS.utiliser se contente alors d'afficher le refus.

[12] g2 manque_fonctionnel | ui/titres/02-titre.html · ui/distributeur/04-titres.html · ui/marchand/02-espace.html | Historique des usages d'un bon
  Chaque usage (montant pris, date, commande) est gardé sur le bon proposé, jamais sur le bon. Aucun écran ne montre l'historique d'UN bon : le porteur voit « Ce qu'il te reste » sans savoir où ni quand il a dépensé le reste. utiliseLe n'est posé qu'à l'épuisement, et un usage partiel n'a donc aucune date côté bon.
  corr: techBonUsages(code) dérivé de techLiensGet() ; l'afficher d'abord dans 02-titre (porteur), puis dans 04-titres (détail). Côté marque, 06-demandes le montre déjà par bon proposé : une colonne dans 02-espace suffit.

[13] g2 incoherence | ui/titres/09-rencontre.html · ui/assets/payencash-bons.js (recuEtat) · ui/assets/payencash-data.js (techBonAnnuler) | Rencontre servie dont le bon est ensuite annulé
  Le nomade peut annuler dans le délai un bon remis lors d'une rencontre. La rencontre reste « servie ». Dans 09-rencontre, le porteur lit « Il est rangé dans Mes bons, à ton nom : il se dépense sur le site de la marque » s'il l'avait déjà rangé. Sinon, il lit « Il rejoint Mes bons dès que ce point est fait — Ce bon a été annulé … », ce qui laisse croire qu'une action de sa part le débloquera. Aucune notification ne prévient le porteur qu'il doit se faire rembourser.
  corr: Dans recuEtat, lire l'état vif du bon : s'il est annulé, renvoyer {etat:'annule', motif}. 09-rencontre et la carte « L'achat de ton bon » disent alors « <vendeur> a annulé ce bon le … (motif) : il ne vaut plus rien, demande-lui le remboursement de ce que tu as payé ». techBonAnnuler ajoute, pour un bon présent dans rencontre.codes, une note sur la rencontre (annuleApresRemise) et un événement dans le fil du porteur.

[14] g2 casse | ui/assets/payencash-data.js (techRencontreServir) | Échec d'écriture de la rencontre après émission
  techRencontreServir émet le bon et la vente, puis écrit la rencontre. Si cette dernière écriture échoue, il renvoie une erreur alors que le bon existe et que la vente est enregistrée. La rencontre reste « acceptée » : un second clic sur « Émettre le bon » dans 03-vendre émet un SECOND bon et une seconde vente pour le même client, et le point est prélevé deux fois.
  corr: Même correction : écrire la rencontre et le bon ensemble, ou annuler le bon et la vente nés à l'instant si l'écriture de la rencontre échoue. À défaut, renvoyer ok:true avec {rencontreNonEcrite:true} et poser les codes par une seconde tentative, pour que le bon rejoigne le compte du client.

[15] g2 casse | ui/assets/payencash-data.js (techBonAnnuler) | Ordre des écritures : vente et avance avant le bon
  techBonAnnuler recrédite l'avance du nomade et annule la vente (marqueStatut 'annule') AVANT d'écrire l'état du bon. Si l'écriture de pec-tech-bons échoue, le bon reste valable et utilisable, alors que le point est recrédité et que la marque ne sera jamais payée. C'est une perte pour la marque, ou pour nous si elle réclame.
  corr: Écrire d'abord le bon (etat 'cancelled'), puis la vente et l'avance. Si l'une de ces deux écritures échoue, remettre le bon dans son état précédent et renvoyer le refus.

[16] g2 incoherence | ui/distributeur/04-titres.html · ui/distributeur/03-vendre.html | flashHTML (deux copies), cible du flashcode
  Le ticket réimprimé d'un bon vendu sur l'ordre d'un bon proposé perd son lien : son flashcode ouvre 02-titre au lieu de 05-offre?o=<slug>, alors que le ticket d'origine y menait. Le client ne retrouve plus la commande à couvrir. La fonction flashHTML est recopiée dans les deux pages avec deux logiques différentes. Le ticket d'une rencontre n'a pas de flashcode à la vente, mais en reçoit un à la réimpression.
  corr: Écrire une seule fonction techBonAppUrl(b) dans le data-layer : 05-offre?o=b.ordre si le bon porte un ordre encore ouvert, sinon 02-titre. Rendre le flashcode dans techBonTicketHTML (voir le constat « Ticket ») et supprimer les deux flashHTML locaux.

[17] g2 contourne | ui/distributeur/04-titres.html · ui/marchand/02-espace.html · ui/marchand/08-paiement.html · ui/manager/30-carte-operations.html | Code complet d'un bon vivant accessible aux professionnels
  Le code vaut titre et quiconque le connaît peut ranger et dépenser le bon. Pourtant n'importe quel vendeur du point peut réimprimer sans limite le code COMPLET d'un bon vendu, même entamé ou déjà rangé par son porteur. La marque voit tous les codes en clair (02-espace, 08-paiement), et le manager aussi (30-carte-operations), alors que 13-mes-ventes, 06-demandes, 04-titres (liste) et 18-fiche-client les masquent. Le masquage est lui-même recopié quatre fois.
  corr: Limiter la réimpression au délai d'annulation (ou à un bon ni rangé ni entamé) et journaliser chaque réimpression (tech_bon_reimprime, par). Masquer partout avec D.bonMasque (02-espace, 08-paiement, 30-carte-operations) et supprimer les masques locaux.

[18] g2 incoherence | ui/distributeur/03-vendre.html · ui/distributeur/04-titres.html · ui/titres/01-mes-titres.html · ui/titres/09-rencontre.html · ui/marchand/payencash-tech-widget.js | Code complet dans les adresses (02-titre.html?code=, 05-offre.html?…&code=)
  Le widget pose une règle explicite : la référence du bon passe par message, « jamais par l'adresse ». Mais le flashcode de chaque ticket, les liens « Voir le code » et « Voir mon bon » de Mes bons, et 05-offre mettent le code COMPLET (un titre au porteur) dans l'adresse. Il se retrouve alors dans l'historique, dans les journaux du serveur et dans les photos du ticket.
  corr: Faire porter au flashcode et aux liens un identifiant non secret (b.id TBN-…, ou un jeton à usage unique), puis résoudre le code dans la page, derrière la session du porteur rattaché. Pour les liens internes de Mes bons, passer ?id=TBN-… et vérifier que le bon est rattaché au compte connecté.

[19] g2 incoherence | ui/assets/payencash-data.js (techMiseEnRelationBonVerifier) · ui/assets/payencash-comment-payer.js | identite.depasse calculé sur ce seul bon
  Avant une mise en relation, l'écran annonce la vérification d'identité (« ton bon t'attend dans Mes bons le temps du contrôle ») seulement si CE bon dépasse à lui seul un palier. Or le palier est un CUMUL sur 30 jours (PEC_BONS.kyc). Un porteur qui a déjà 200 € de bons en espèces et en commande 100 € n'est pas prévenu, et son bon partira pourtant en attente à la remise.
  corr: Dans l'écran, quand un porteur est connecté, calculer avec PEC_BONS.kyc({code:'(à venir)', montant, moyen, partEspeces, venduLe: Date.now()}), ou déplacer ce cumul dans le data-layer (techPorteurCumul(clientId, candidat)) et le faire lire aux deux endroits. Afficher l'avertissement dès que requis && !verifie.

[20] g2 incoherence | ui/assets/payencash-data.js (reglesAchatHTML) · ui/distributeur/03-vendre.html | « au comptoir, le prix est celui de ton bon, rien de plus » / « tu le revends au prix que tu affiches »
  Deux écrans disent le contraire sur le prix payé par le client dans un commerce. Au client (carte de Mes bons, page du bon proposé, widget) : « le prix est celui de ton bon, rien de plus ». Au commerce (03-vendre) : il revend le bon « au prix que tu affiches — la valeur faciale est le prix conseillé ». Si un commerce vend au-dessus de la valeur faciale, la promesse faite au client est fausse.
  corr: La relecture du 24/09 a fixé que le commerce sédentaire revend au prix qu'il affiche, la valeur faciale n'étant qu'un prix conseillé. Corriger donc la règle 'frais-point' (reglesAchatHTML, lue par Mes bons, 07-lien et le widget) : « pas de frais de déplacement ; le prix est affiché par le commerce, la valeur faciale est le prix conseillé ». Seul le nomade vend à la valeur faciale. Faire confirmer par la fondatrice avant d'écrire, sans citer de texte non vérifié.

[21] g2 promesse_sans_logique | ui/assets/payencash-data.js (ref.tech.encaissement.consommation) · ui/marchand/10-compte.html | Droit de rétractation de quatorze jours cité sans flux
  Le référentiel, lu par Compte › Règles de la marque, annonce un droit de rétractation de quatorze jours quand le bon est acheté à distance. Aucun flux ne le permet : l'annulation est limitée à 30 minutes, au comptoir, par le vendeur. Le cas du nomade qui vend au domicile du client (contrat hors établissement) n'est pas traité non plus.
  corr: Faire vérifier par un juriste, à la source, le régime de la vente au domicile par un distributeur nomade (contrat hors établissement ?) et de la vente au comptoir d'un tiers. Selon l'avis : ajouter techBonRetracter(code, par) avec son écran (04-titres côté nomade), ou réécrire la phrase du référentiel. Tant que ce n'est pas tranché, ne pas l'afficher dans 10-compte.

[22] g2 incoherence | ui/marchand/08-paiement.html | « Les bons achetés par le réseau » : compte et somme
  L'en-tête de la carte additionne tous les bons, annulés compris (« N bons · X € de valeur faciale »), mais « que nous t'achetons » vient de techVentesTotaux, qui exclut les ventes annulées. Deux chiffres voisins ne portent donc pas sur le même ensemble, et les bons annulés sont présentés comme « achetés par le réseau ».
  corr: Filtrer les bons annulés dans le compte et la somme de l'en-tête (b.etat !== 'cancelled'), ou mieux, lire tot.ventes et tot.valeur. Garder les lignes annulées dans la liste, avec leur mention « achat annulé ».

[23] g2 contourne | ui/assets/payencash-data.js (techBonAnnuler) · ui/distributeur/04-titres.html | Contrôle de qui annule
  techBonAnnuler annule n'importe quel bon, dans le délai, pour n'importe quel appelant. Il ne vérifie pas que o.par appartient au point ou au nomade qui a vendu le bon (b.revendeurId). La règle « seul le vendeur annule au comptoir » ne tient que parce que 04-titres ne liste que les bons du point (bonsDuPoint). Tout autre chemin (API, autre écran) peut annuler la vente d'un autre point, faire recréditer son avance et priver la marque de son paiement. techRencontreServir, lui, contrôle bien `r.revendeurId !== o.revendeurId`.
  corr: Exiger o.revendeurId dans techBonAnnuler et refuser si `o.revendeurId !== b.revendeurId` (« ce bon a été vendu par un autre point : lui seul l'annule »). Vérifier aussi que o.par est le titulaire ou un collaborateur actif de ce point. 04-titres passe alors P.revendeur().id.

[24] g3 redondance | ui/assets/payencash-data.js (techBonTicketHTML, techBlocBon, reglesAchatHTML) · ui/assets/payencash-bons.js (vueMarque, RAPPEL) | Cinq rédactions des mêmes mentions
  Les mentions du bon (où il vaut, validité, non remboursable, pas de rendu de monnaie, code valant titre) sont rédigées cinq fois, avec cinq formulations. Une correction juridique devra être refaite à cinq endroits, et il y en a déjà un (le ticket) qui en omet la moitié.
  corr: Créer techBonMentions(marchandId, b?) → [{cle, texte, source}] dans le data-layer (lieu via techBonOu, validité via techBonRef, non-remboursement, code valant titre, app Mes bons), et la faire lire par le ticket, vueMarque, techBlocBon, reglesAchatHTML et RAPPEL.

[25] g3 code_mort | ui/assets/payencash-data.js · ui/assets/payencash-bons.js | bonEmettre, _bonNouveau, bonNouveauCode, bonsSerie, bonSerieVue, bonEtat, bonParCode, branche reseauAutre de _techBonControle, familleAutre, ETATS.vierge, branche 12 caractères de bonSaisieFormater
  Tout le cycle de l'ancien bon (magasin pec-bons, que plus rien n'écrit) reste dans le data-layer. Il garde un texte visible qui parle de Mode et de Fly, et des branches d'écran pour une « autre famille » de codes et un état « vierge » que plus rien ne produit. Le schéma le déclare mort (C-24).
  corr: Même liste, plus prelevementPartenaire (3808-3840) et son commentaire (3837), dont bonEmettre est le seul appelant. Garder clientIdentiteVerifiee. Retirer aussi ref.bons.psp, ref.bons.mentions et prefixeTicket avec bonsRef (voir constat 8).

[26] g3 incoherence | ui/assets/payencash-data.js (bonSaisieFormater) | Saisie d'un code sans son préfixe
  Un code de marque tapé sans son préfixe « TB- » (ce que fait souvent un client qui recopie ses 12 caractères) est reformaté selon l'ancien format de 12 caractères du Bon d'achat PayEnCash. La saisie est alors refusée avec « n'a pas la forme d'un bon de marque » au lieu d'être complétée.
  corr: Une fois l'ancien bon retiré, faire préfixer d'office par la saisie tout groupe de 12 caractères alphanumériques (prefixeBon + groupes de 4).

[27] g3 redondance | ui/assets/payencash-data.js (TECH_BON_ETATS) · ui/assets/payencash-bus.js · server/db/schema.sql | issued jamais écrit ; allocated→sold dans le même geste ; table 'tech_vouchers'
  Le cycle de vie annonce cinq états, mais 'issued' n'est jamais écrit et 'allocated' (« Acheté par le réseau ») est aussitôt écrasé par 'sold' dans le même geste (03-vendre, techRencontreServir). Aucun écran ne montre donc réellement ces deux états distincts. En revanche, il manque les états réellement vécus (expiré, entamé, bloqué). Le miroir du bus vise une table 'tech_vouchers' qui n'existe pas (la table s'appelle vouchers).
  corr: Faire naître le bon 'sold' dans techBonEmettre (venduLe = emisLe) et supprimer techBonVendu, ou refuser dans _techBonControle tout bon qui n'est pas 'sold'. Retirer 'issued' de TECH_BON_ETATS, de STATUT_SQL et du CHECK de vouchers.state. Aligner STATUT_SQL sur les vrais noms de tables (vouchers, merchants, voucher_proposals, …) et retirer « demande de paiement » du commentaire.

[28] g3 redondance | ui/distributeur/04-titres.html | annulable(b, R) recopie la règle de techBonAnnuler
  La règle d'annulabilité est recopiée dans l'écran (le commentaire le dit : « la même règle que techBonAnnuler »), avec un écart de borne (>= côté écran, > côté data-layer). Elle devra être modifiée à deux endroits.
  corr: Exposer techBonAnnulable(code) → {ok, resteMin, motif} dans le data-layer, et l'utiliser à la fois dans techBonAnnuler et pour afficher le bouton de 04-titres (avec resteMin).

[29] g3 incoherence | ui/assets/payencash-bons.js (kyc) | Bons annulés comptés dans le cumul
  Le cumul de vigilance additionne tous les bons de la liste, y compris un bon annulé après avoir été rangé (par exemple le bon d'une rencontre, rangé d'office puis annulé par le nomade). Le porteur peut alors se voir demander son identité pour un bon qui ne vaut plus rien. enAttente, lui, exclut bien les annulés.
  corr: Exclure etat 'annule' du cumul. Ce cumul doit ensuite migrer au data-layer (voir le constat sur le contournement de la vigilance).

[30] g3 incoherence | server/db/schema.sql (vouchers.payment_method) | payment_method nullable, commenté « facultatif »
  Le schéma présente le moyen comme facultatif (« un comptoir qui ne le dit pas n'est pas bloqué »), alors que le data-layer l'exige depuis le 24/09, précisément parce qu'un bon sans moyen échappait aux paliers d'identité. Le miroir SQL autoriserait ce contournement.
  corr: Passer payment_method en NOT NULL et corriger son commentaire. Supprimer aussi le commentaire « Facultatif » de _bonNouveau, qui partira avec le code mort.

[31] g3 redondance | ui/assets/payencash-data.js (techBonEmettre) · ui/manager/30-carte-operations.html · server/db/schema.sql | Copies site, prixPoint, prixMarque sur le bon
  Le bon recopie le site de la marque et les prix de la vente, alors que le schéma les déclare dérivés (⊘ C-31). Le ticket et 30-carte-operations lisent ces copies : si la marque change de site, le ticket réimprimé indique l'ancien site tandis que Mes bons indique le nouveau.
  corr: Retirer site, prixPoint et prixMarque de l'objet bon. Lire le lieu par techBonOu(b.marchandId) et les prix par techVente(b.venteRef).

[32] g3 obsolete | ui/assets/payencash-data.js | Commentaires obsolètes du modèle « intermédiaire »
  Plusieurs commentaires qui disent le POURQUOI décrivent l'ancien modèle et contredisent le code actuel. Ils parlent de « redevance de stockage », d'« aucun flux d'argent », de prix « ni stockés », d'un « contrat VIVANT entre ce commerçant et ce revendeur », d'un nomade qui reçoit le prix « POUR SON PROPRE COMPTE » (alors que vendeurStatutHTML dit « commissionnaire, pour le compte de »), de Mode et de Fly dans ordreVenteBlocHTML, et d'un délai d'annulation « comme le Bon d'achat PayEnCash ».
  corr: Réécrire ces commentaires selon le modèle grossiste (nous achetons le bon à la marque, le commerce nous l'achète, le nomade vend pour notre compte en commissionnaire) ou les supprimer. Retirer les mentions de Mode, Fly, de l'agent et du Bon d'achat PayEnCash.

[33] g3 incoherence | ui/assets/payencash-bons.js (recuEtat) | Écriture pendant une peinture
  recuEtat, appelée par 09-rencontre et Mes bons pour AFFICHER l'état d'une rencontre servie, appelle recevoir(). Cette fonction range des bons et écrit le magasin du porteur à chaque peinture : une lecture qui écrit, et qui redéclenche le bus.
  corr: Faire lire à recuEtat un résultat mémorisé du dernier recevoir(), déjà appelé au chargement et sur l'événement storage (recevoirAuChargement), ou un peutRanger(resoudre(c)) sans écriture.

[34] g3 incoherence | ui/assets/payencash-data.js (techBonEmettre, techOrdreVente) | Gel du bon proposé pendant une rencontre non appliqué au comptoir
  Un bon proposé est gelé pendant une rencontre vivante pour l'usage dans Mes bons (techLienUtiliserBon) et pour une nouvelle demande (techMiseEnRelationVerifier). Il ne l'est pas pour une vente au comptoir sur son ordre : un commerce peut vendre le bon pendant que le nomade se déplace. Le techRencontreServir du nomade est alors refusé (« n'attend plus que … ») après que le client l'a payé.
  corr: Rendre techOrdreVente(slug).vendable faux, avec un motif « un distributeur nomade vient vendre ce bon (réf.) », pendant une rencontre vivante, sauf pour le nomade de cette rencontre (techRencontreServir passe alors un drapeau interne).

[35] g3 manque_fonctionnel | ui/assets/payencash-data.js (techBonVendu, techBonEmettre) | Journal sans auteur ni moyen
  L'événement tech_bon_vendu n'inscrit pas qui a remis le bon (o.par est ignoré), et tech_bon_emis n'inscrit ni le moyen de règlement ni l'ordre. Le journal d'audit ne permet donc pas de retracer ces deux faits de vigilance.
  corr: Ajouter moyen, partEspeces et ordre à tech_bon_emis (ou à tech_vente), et par à tech_bon_vendu. Pas besoin de dupliquer l'auteur de la vente, déjà dans tech_vente.

[36] g3 incoherence | ui/assets/payencash-data.js (techBonEmettre, _techAlea) | Alphabet du code TB-XXXX-XXXX-XXXX
  Le code est tiré dans un alphabet de 56 caractères mélangeant majuscules et minuscules, puis passé en majuscules. Le « i » minuscule devient donc un « I » majuscule, lettre que l'alphabet majuscule évitait exprès parce qu'on la confond à l'oral et à la lecture. La répartition devient aussi inégale : 33 symboles, avec A-H deux fois et demie plus fréquents que I, L et les chiffres. L'entropie tombe à environ 59,6 bits pour 12 caractères. Un client qui recopie son ticket peut lire « I » pour « 1 » ou « L » : rien ne le corrige à la saisie.
  corr: Tirer le code dans un alphabet dédié sans caractère ambigu (majuscules sans I ni O, et chiffres 2-9, comme BON_ALPHABET), avec un tirage sans biais (rejet des octets ≥ 256 − 256 % n). Ne plus appeler toUpperCase sur le résultat, et vérifier l'unicité contre techBonsGet() avant d'écrire, comme le faisait bonNouveauCode.

[37] g3 obsolete | ui/assets/payencash-data.js (commentaire du bon proposé, techLienUtiliserBon) | Usage « par son code saisi dans la fenêtre de paiement de la marque (`via: 'code'`) »
  Le commentaire qui décrit l'usage d'un bon annonce un second chemin, le code saisi sur le site de la marque avec `via: 'code'`, dont « chaque usage garde qui, et comment ». Ce chemin n'existe pas. techLienUtiliserBon ne lit aucun `via`, l'usage enregistré est `{ code, pris, at, par }`, et le code tendu par le widget passe par le rangement dans Mes bons puis PEC_BONS.utiliser. Le commentaire contredit aussi celui de techLienUtiliserBon (« La fenêtre de paiement de la marque enregistre le code DANS ce compte, puis l'utilise avec lui — jamais sans »).
  corr: Réécrire le commentaire : l'usage passe toujours par un compte Mes bons (le code tendu par le widget s'y range d'abord). Ou, si l'on veut tracer le canal, ajouter réellement `via` ('app' | 'widget') à l'usage, posé par 07-lien selon `integre`.


######## porteur — L'utilisateur de Mes bons (46 confirmés, 6 oublis, 0 réfutés)

[0] g1 obsolete | ui/titres/04-compte.html + ui/assets/payencash-docs.js | « Envoyer ma vérification » → pièce générée 'cgu' (modèle cgu_client)
  À l'envoi de la vérification, l'app génère et SIGNE au coffre, au nom du porteur et sans le lui montrer, une « Acceptation des conditions générales » qui est le texte de Mode : prix ferme bloqué pendant une fenêtre d'encaissement de 120 minutes, pièces relibérées, rétractation de 14 jours à compter de la réception, garanties de conformité, pièces d'occasion en TVA sur la marge, vérification pour toute commande dépassant 300 € en espèces, version CGV_VERSION 2026-08-28. Ce document sert de preuve et vaut « signature au sens de l'article 1366 du code civil ».
  corr: Réécrire MODELES.cgu_client en « Attestation des acceptations » : pour chaque document de D.documentsEtat('bons', id) (titre, clé, version, date de consultation et d'acceptation) + identité du compte ; retirer tous les blocs Mode (prix ferme, fenêtre, plafond espèces 1000, rétractation, garanties, occasion, seuil 300 €, livraisonInfo, scenario.lcbft) et la phrase « vaut signature ». Si l'on garde une signature, l'ouvrir dans le lecteur de 04 (le porteur lit et signe) ; sinon passer la pièce en `genere` non signée (horodatage + empreinte), et ne plus l'exiger comme « Conditions générales acceptées » au coffre.

[1] g1 impasse | ui/titres/09-rencontre.html, ui/titres/01-mes-titres.html, ui/assets/payencash-data.js | Rendez-vous au palier « remise » (flashcode reconnu) jamais servi
  Une fois le flashcode reconnu, le client paie puis le nomade émet. Si le nomade n'émet jamais (ou disparaît), la rencontre reste 'acceptee' pour toujours : elle n'expire plus, le client ne peut plus l'annuler, le bouton d'annulation disparaît, et « une demande à la fois » lui interdit toute nouvelle demande. Aucun bouton « Signaler un problème » sur la rencontre, et la hotline ne voit pas les rencontres : le client a payé, n'a pas de bon et aucun recours dans l'app.
  corr: (1) Échéance de la remise vérifiée non servie : nomadeRef().remiseMaxMin (réglable en manager/10) ; passée, la rencontre se lit 'annulee' motivée « flashcode reconnu mais bon jamais émis » et S'ÉCRIT à la première lecture ; (2) sur 09 et la carte 01 au palier 'remise' : « Signaler un problème avec cette rencontre » → PEC_BUS.ouvrirDemande({type:'reclamation', motif:'rencontre', ref:r.id, clientId, echanges:[…]}) ; (3) dans la fiche d'une demande de la hotline, lire D.techRencontre(ref) (statut, remise.verifieeTs, nomade, montant, règlement) et offrir l'annulation motivée par la hotline (par:'hotline') ; (4) libérer « une demande à la fois » dès qu'une réclamation 'rencontre' est ouverte.

[2] g1 promesse_sans_logique | ui/titres/03-rechercher.html, ui/assets/payencash-data.js, documents/politique-confidentialite-solution.html | Accord « Mon numéro … s'efface quand la demande se ferme » ; confidentialité 5.5
  La phrase de consentement enregistrée et la politique de confidentialité promettent que le numéro (et l'adresse, le canal) ne vivent que le temps de la rencontre. Or une demande expirée (sans appel, ou rendez-vous non tenu) ou fermée par son bon proposé n'est expirée qu'à la LECTURE : rien n'est écrit, le numéro, le prénom, l'adresse avec étage / porte / consignes, la note et la position restent stockés indéfiniment ; la suppression du compte n'efface que prénom et numéro. Pire, techRencontresClient retrouve encore ces demandes expirées par le numéro.
  corr: Un seul passage d'écriture (_techRencontresFermer, appelé par techRencontresGet ou par chaque lecture qui constate l'échéance ou la proposition fermée) qui écrit statut 'expiree'/'annulee' motivé ET vide tel, prenom, adresse, adresseId, aide, note, consentement (garder consentiTs + empreinte), geo ramené au centre de la commune, puis PEC_BUS.oublierPosition(id) ; compteSupprimer vide les mêmes champs + les commentaires de notes du client ; retirer la clause `tel` de techRencontresClient (cf. [4]).

[3] g1 promesse_sans_logique | documents/politique-confidentialite-solution.html, documents/cgu-mes-bons.html, ui/assets/payencash-bus.js | Vidéo de vérification du porteur « supprimée après contrôle »
  La politique de confidentialité promet que la vidéo de vérification est supprimée après contrôle ; aucune fonction ne la supprime : ni la décision de la hotline, ni la suppression du compte. Elle reste au coffre (pièce obligatoire du dossier client). Par ailleurs la CGU 4.3 ne mentionne que la pièce d'identité alors que l'app exige aussi une photo tenant la pièce et une vidéo.
  corr: Ajouter DOCS.retirerContenu(portee, id, piece, trace) (garde les métadonnées : déposée le, regardée le, par, décision) et l'appeler dans PEC_BUS.deciderVerification (validee/refusee) pour la pièce `video` du client, et dans la décision KYB pour la vidéo du dirigeant ; DOCS.etat ne compte plus une vidéo « retirée après décision » comme manquante ; compteSupprimer purge le coffre client selon ref.juridique.conservation ; CGU 4.3 : pièce, photo tenant la pièce, courte vidéo, et la durée de chacune.

[4] g1 contourne | ui/assets/payencash-bons.js, ui/assets/payencash-data.js, ui/marchand/07-lien.html | ajouter() / techBon sans porteur / liste « Acheté pour cette commande — Utiliser »
  Un même code se range dans autant de comptes qu'on veut : le contrôle de doublon ne regarde que la liste du compte connecté, et le bon ne garde aucun titulaire. Qui voit ou photographie un ticket (ou tape `?code=` dans 02) range le bon dans SON compte et le dépense : le porteur légitime perd son argent, et « l'app obligatoire, qui permet de retracer » ne retrace rien. Pire, tech/07-lien liste à TOUT compte connecté qui ouvre le lien d'un bon proposé les bons achetés sur son ordre et pas encore rangés, avec « Utiliser » (enregistrer → B.ajouter) : un lien transféré suffit à s'approprier le bon acheté par un autre. Les deux comptes ont aussi l'avant-première (clientPorteurDe) et comptent le même bon dans leur palier.
  corr: Au data-layer, techBonRanger(code, clientId) : au premier rangement, écrire tb.porteurId (+ journal 'tech_bon_range') ; refuser le rangement par un autre compte (« Ce bon est déjà rangé sur un autre compte : si c'est le tien, signale-le » → réclamation motif perte/vol, cf. [12]) ; techLienUtiliserBon exige par === tb.porteurId ; PEC_BONS.ajouter passe par techBonRanger ; dans 07-lien, ne lister « Acheté pour cette commande » qu'au compte du lien (techLien.clientId) ou au titulaire déjà posé ; retirer() ne libère pas le titulaire (ou seulement par la hotline).

[5] g2 incoherence | ui/titres/01-mes-titres.html, ui/titres/09-rencontre.html, ui/assets/payencash-data.js | Rencontres retrouvées par numéro de téléphone (techRencontresClient tel)
  01 et 09 listent les rencontres dont le numéro égale celui du compte connecté. Or le numéro d'une demande est libre (champ « Changer » de la fenêtre, ou saisie sans compte) et jamais vérifié : la personne dont le numéro a été tapé voit dans SON Mes bons la demande d'un autre — adresse, consignes d'accès, montant — et son flashcode de remise, qui est justement la preuve de « la bonne personne ». Elle peut aussi l'annuler ou la noter.
  corr: Retirer `tel` de techRencontresClient et des trois appels ; le numéro ne sert qu'à « une demande à la fois » (_techRencontreMiseVivante). techRencontreFlashcode(id, o) exige o.clientId === r.clientId ou o.ids contenant r.id ; techRencontreAnnuler(par 'client') et distributeurNoter exigent le même rattachement.

[6] g2 incoherence | ui/assets/payencash-comment-payer.js, ui/assets/payencash-data.js | Fenêtre « Ton bon d'achat » — ligne agt-identite
  Deux règles pour le même palier. La fenêtre d'achat nomade ne prévient que si CE bon seul dépasse 250 € en espèces ou 500 € par carte, alors que Mes bons applique le CUMUL des bons sur la fenêtre glissante : trois bons de 100 € en espèces passent sans avertissement, puis le troisième reste « en attente » après paiement. Le message s'affiche aussi à un porteur déjà vérifié (« ton identité est vérifiée : ton bon t'attend … le temps du contrôle »).
  corr: Porter le cumul au data-layer (kycPorteurCumul(clientId, candidat) : bons rangés + en attente + historique des bons retirés, cf. oubli palier) et l'appeler dans techMiseEnRelationBonVerifier quand clientId est connu ; la ligne agt-identite ne s'affiche que si le cumul avec ce bon franchit un palier ET que clientIdentiteVerifiee est faux ; texte : « … ton identité sera vérifiée : ton bon t’attendra dans Mes bons le temps du contrôle ».

[7] g2 casse | ui/assets/payencash-bons.js | recevoir() / rangerAttente() / retirer()
  Un bon remis par un nomade, mis en attente pour vérification puis rangé seul après validation, n'est jamais noté dans « recus ». Si le porteur le retire, il revient d'office au prochain chargement de n'importe quelle page — le contraire de ce que dit recuEtat (« reçu, puis retiré : on ne le remet pas d'office »). Vérifié par simulation node (stubs) : retirer → {ok:true}, liste vide ; recevoir() suivant → rangé de nouveau.
  corr: Dans recevoir(), noter le code dans st.recus dès que ajouter() le met en attente (a.enAttente) ; ou, dans rangerAttente(), ajouter r.code à st.recus pour tout code qui provient d'une rencontre servie (codes des techRencontresClient).

[8] g2 manque_fonctionnel | ui/titres/01-mes-titres.html, ui/assets/payencash-bons.js | Bon « gardé ici, en attente »
  Le refus pour palier dit « Ton bon est gardé ici, en attente : il se rangera seul dès la validation. » mais la page Mes bons n'affiche jamais les bons en attente : en revenant, le porteur ne voit aucune trace du bon qu'il vient de saisir. Seul le texte de Compte › Vérification d'identité les énumère.
  corr: Dans 01, une section « En attente de ta vérification » (B.enAttente() : marque, montant, date d'achat, moyen) avec l'état du dossier B.kyc().dossier et le lien 04-compte.html#identite ; dans 04, lister aussi ces bons dans la branche « En contrôle ».

[9] g2 manque_fonctionnel | ui/titres/04-compte.html (absence), ui/assets/payencash-comment-payer.js | Adresses Domicile / Travail / Autre
  Le carnet naît dans la fenêtre nomade et sert d'office de point de rendez-vous et de point de mesure de la carte, mais aucun écran ne permet de le voir, de changer l'adresse par défaut ni d'en supprimer une (domicile avec digicode compris). adresseSupprimer et adresseDefautSet n'ont aucun appelant.
  corr: Ajouter une carte « Mes adresses » dans 04 (liste D.adresses(), « Par défaut » → D.adresseDefautSet, « Supprimer » → D.adresseSupprimer, « Modifier » → adresseEnregistrer avec id).

[10] g2 manque_fonctionnel | ui/distributeur/*, ui/manager/*, ui/hotline/* (absence) ; ui/titres/01-mes-titres.html ; ui/titres/09-rencontre.html | distributeurNote
  La note naît dans Mes bons mais n'est montrée qu'aux clients : ni le distributeur (son retour), ni le manager qui accepte ou refuse la relation, ni la hotline ne la voient. Le commentaire prévu par le data-layer n'est jamais saisi, et une note basse n'ouvre rien (contrairement à la note de satisfaction de la hotline).
  corr: Afficher D.distributeurNote(p.id) (moyenne, avis, derniers commentaires) dans partenaire/07-mon-point et manager/29-partenaires ; ajouter un champ « Un mot (facultatif) » sous les étoiles ; une note ≤ 2 ouvre une demande hotline (même règle que satisfactionAjouter).

[11] g2 manque_fonctionnel | ui/titres/* (absence), ui/assets/payencash-data.js MESSAGES_CATALOGUE | Fil / cloche / messages vers le porteur
  Mes bons n'a ni fil ni cloche, et le catalogue n'envoie au porteur que ses codes et la réponse à une réclamation. Il n'est prévenu ni de l'annulation de son rendez-vous par le nomade ou le manager, ni de son expiration, ni du bon remis, ni de la décision sur sa vérification d'identité (que la CGU 4.3 promet « notifiée »), ni d'un usage de son bon, ni d'un bon qui expire. Un commentaire du bus affirme que le client lit les réponses « dans son Assistance et dans son fil de notifications » : aucun des deux n'existe.
  corr: Ajouter au catalogue les évènements porteur (rencontre validée / annulée / expirée / servie, décision kyc, bon utilisé, bon expirant à J-30) avec cible 'client' ; dériver un fil Mes bons (filPro('bons', clientId) sur le modèle de PEC_FIL) et poser une cloche dans l'en-tête des pages 01 / 03 / 04.

[12] g2 manque_fonctionnel | ui/titres/02-titre.html | Fiche d'un bon — historique d'usage
  Chaque usage est tracé (techLien.usages : code, montant pris, date, compte) et le manager les lit sur la fiche client, mais le porteur ne voit jamais où, quand et par qui son bon a été utilisé : seul le reste baisse. Un code copié ou volé et utilisé par un autre compte (rien n'empêche deux comptes de ranger le même code) passe inaperçu.
  corr: Ajouter au data-layer techBonUsages(code) (parcourt techLiensGet : date, marque, référence client du bon proposé, montant pris, par) et l'afficher dans 02 (« Utilisations ») ; signaler « utilisé depuis un autre compte » quand par ≠ B.porteurId(), avec le lien vers « Signaler un problème » (motif perte/vol, cf. [12]).

[13] g2 promesse_sans_logique | documents/conditions-bons-de-marque.html, ui/titres/02-titre.html | « Perte ou vol : … sous réserve d'un blocage sur signalement motivé »
  Les conditions remises au porteur promettent un blocage du bon sur signalement de perte ou de vol ; il n'existe ni état « bloqué » pour un bon de marque, ni fonction de blocage, ni motif « perte / vol » dans Mes bons (02 ne propose que « Bon refusé par la marque »).
  corr: Soit ajouter l'état 'blocked' (techBonBloquer(code, motif, par) par la hotline, refus dans _techBonControle) et un motif « Perte ou vol » dans 02 ; soit retirer la phrase des conditions.

[14] g2 impasse | ui/titres/02-titre.html | rendreProbleme / reclamation(code)
  Dès qu'une réclamation existe sur le code — même close, même ouverte par un autre compte qui avait rangé ce bon — le bouton « Signaler un problème » disparaît pour toujours : impossible de signaler un nouveau refus plus tard. Le porteur ne peut pas non plus répondre à l'hôte (aucun appel à repondreDemande dans l'app), et il lit la réponse faite à un autre porteur.
  corr: Filtrer sur d.clientId === B.porteurId() ; ne masquer le formulaire que si la réclamation est 'en_cours' ; afficher le fil des échanges et un champ réponse (PEC_BUS.repondreDemande(id, texte, porteur, 'moi')).

[15] g2 incoherence | ui/assets/payencash-garde.js, ui/titres/02-titre.html | CONTEXTES 'bons/02-titre'
  L'invitation de la garde affirme que le code « ne s'affiche que sur le compte qui l'a rangé ». Or 02 affiche en entier le code, son flashcode et ce qu'il reste de n'importe quel code passé dans l'adresse à tout compte connecté, rangé ou non.
  corr: Tant que B.estRange(code) est faux : masquer le code (D.bonMasque), le QR et le reste, ne montrer que la marque, l'état et « Ranger ce bon » ; ou corriger la phrase de la garde (« le détail d'un bon s'ouvre sous ton compte »).

[16] g2 impasse | ui/assets/payencash-garde.js, ui/titres/00-inscription.html, ui/distributeur/03-vendre.html | Flashcode du ticket comptoir → 02-titre.html?code= → « Créer un compte »
  Le flashcode du ticket ouvre 02-titre.html?code=<code>. Un nouvel utilisateur (le premier usage type) tombe sur la garde ; « Créer un compte » ne garde que ?o=, l'inscription l'envoie sur 01 : le code scanné est perdu, il faut le retaper à la main.
  corr: La garde passe aussi ?retour= à l'inscription ; 00-inscription accepte ?retour= avec la même validation que 06 (regex fichier du dossier) et y renvoie après la connexion.

[17] g2 incoherence | ui/titres/05-offre.html | « Où acheter un bon » après un achat au comptoir sur l'ordre
  Quand un bon a déjà été acheté sur l'ordre de vente mais pas encore rangé, le texte dit « présente le flashcode ci-dessous » alors que le flashcode est masqué (l'ordre n'est plus vendable) : le porteur ne comprend pas qu'il doit ranger le code de son ticket.
  corr: Si ov.bonsVendus > 0 && !ov.vendable : remplacer le texte par « Un bon a déjà été acheté pour cette proposition : scanne le flashcode de ton ticket (il le range dans Mes bons) ou ajoute son code dans Mes bons » avec le lien 01-mes-titres.html (formulaire « Ajouter un bon »), et ne plus dire « présente le flashcode ci-dessous ».

[18] g2 incoherence | ui/titres/01-mes-titres.html | Carte et feuille d'un bon proposé non vendable
  Un bon proposé dont le bon a été acheté mais pas encore utilisé devient une carte grisée « Proposé » et sa feuille dit « Ce bon proposé est proposé : il n'a plus de flashcode à présenter. », sans lien vers 05 pour ranger / utiliser le bon : l'étape suivante est cachée.
  corr: Distinguer p.bonsVendus > 0 && (etat open|partial) : pastille « Bon acheté », phrase « Ton bon est acheté : range son code (flashcode du ticket) puis couvre cette proposition » et un lien vers la page qui couvre réellement la proposition (07-lien?l=<slug>, cf. oubli « bon proposé reçu »), dans la carte et la feuille.

[19] g2 incoherence | ui/titres/09-rencontre.html, ui/titres/01-mes-titres.html, ui/assets/payencash-data.js | Rencontre expirée — titre et motif
  Le titre d'une rencontre fermée reprend RENCONTRE_STATUTS : « Expirée — sans appel dans le délai », y compris quand le rendez-vous avait été validé par un appel puis non tenu (la ligne dessous dit le contraire), et quand le canal choisi était WhatsApp (« Pas d'appel de … »).
  corr: Libellé de statut « Expirée » ; techRencontreFermetureTxt(r) au data-layer (echueApresValidation → « validé mais pas tenu » + techRencontreEcheanceTxt(r) ; sinon « pas de nouvelles (appel ou WhatsApp selon r.canal) dans les reponseMin min ») lue par 01, 09, techRencontreSuivi et le fil partenaire.

[20] g2 incoherence | ui/titres/00-inscription.html, ui/assets/payencash-bons.js, ui/assets/payencash-comment-payer.js | Statut « à vérifier » sans conséquence
  L'inscription exige deux codes mais « tu peux finir plus tard » : un compte dont le mobile n'est pas confirmé range, utilise des bons et envoie des demandes à un nomade, qui appellera un numéro jamais vérifié (la fenêtre de demande le présente comme « numéro connu »). La vérification n'a donc aucun effet.
  corr: Ajouter à peutRanger / utiliser / techMiseEnRelationVerifier une exigence verifs.sms (manque 'mobile' → 04-compte.html avec « Confirmer ton mobile ») ; ne présenter le numéro du compte comme connu que s'il est vérifié.

[21] g2 promesse_sans_logique | ui/titres/00-inscription.html, ui/assets/payencash-data.js | Champ « Nom — facultatif, comme sur ta pièce d'identité »
  Le nom saisi « comme sur ta pièce d'identité » est jeté à la création : seule l'initiale est gardée (« Prénom N. »), et c'est ce « Prénom N. » que le dossier de vérification transmet à la hotline pour comparaison avec la pièce.
  corr: Garder le nom de famille complet (profil.nomFamille → customers.last_name) et dériver « Prénom N. » à l'affichage ; transmettre prénom + nom complets au dossier de vérification.

[22] g2 promesse_sans_logique | ui/titres/04-compte.html, ui/assets/payencash-data.js | Information avant « Confirmer la suppression »
  L'écran dit que le compte est fermé, la fiche retirée et la liste effacée, et que seules les acceptations et consentements sont conservés. En réalité restent aussi : les pièces du coffre (pièce d'identité, photo, vidéo), le dossier kyc_ avec le nom en clair, les appels (nom, mobile), les réclamations (nom, récit), les notes au distributeur (clientId), l'adresse et la position des rencontres.
  corr: Anonymiser à compteSupprimer (coffre client purgé sauf pièces à durée légale choisie, customer_name des kyc_ remplacé, tel / client des apl_ et sav_ vidés, commentaires de notes effacés) et écrire dans cp-sup-info la liste exacte de ce qui est gardé et combien de temps (ref.juridique.conservation).

[23] g2 promesse_sans_logique | ui/assets/payencash-data.js reglesAchatHTML (affiché sous la carte 03 et sur 07-lien) | Règle « moyens »
  « Bon à savoir » dit que le réseau accepte espèces et carte « selon les moyens que le point affiche », mais aucun point n'affiche ses moyens : pointsBons ne les rend pas et la ligne d'un commerce ne les montre pas. Le client ne sait pas s'il peut payer par carte au comptoir.
  corr: Soit ajouter une déclaration « carte acceptée » au commerce sédentaire (Mon point → partenaireEnregistrer accepteCarte), l'exposer dans pointsBons et l'afficher dans ligneCommerce comme pour les nomades ; soit retirer « selon les moyens que le point affiche ».

[24] g2 incoherence | ui/assets/payencash-bons.js vueMarque, ui/titres/08-boutique.html | Où se dépense le bon d'une marque sans site
  Une marque peut n'avoir aucun site (sansSite : bons valables dans ses propres points de vente). Ses bons s'affichent alors « Utilisable uniquement sur  — le site de X, qui l'a émis » (phrase vide) dans 01 / 02, tandis que 08 dit « se dépense dans ses propres points de vente » et que le rappel commun affirme « sur son site, et nulle part ailleurs ».
  corr: vueMarque construit la phrase depuis dest.type (« sur <domaine> » / « dans ses propres points de vente ») ; RAPPEL, reglesAchatHTML et bt-regle de 08 dérivés de la même fonction (techUsageLieuTxt) ; pour type 'points', dire comment s'utilise le bon (la marque te présente un bon proposé à couvrir depuis Mes bons) et le montrer en 01/08.

[25] g2 obsolete | ui/assets/payencash-data.js | bonsRef() (référentiel du Bon d'achat PayEnCash) utilisé pour les bons de marque
  Des règles des bons de MARQUE lisent encore le référentiel de l'ancien Bon d'achat PayEnCash : le montant minimum de la fenêtre nomade (« Un bon d'achat part de 5 € »), la validité d'émission et de « Bon à savoir » (validiteMois), la fenêtre des paliers d'identité (fenetrePlafondJours). Deux minimums coexistent (l'émission accepte tout montant > 0), et la validité « engagement de la marque » n'est posée par aucune marque.
  corr: Porter minimum, validiteMois dans techRef() (ref.tech.bons, réglables en manager/10) et fenetreJours dans ref.kyc.porteur ; une seule règle de minimum lue par techBonEmettre et techMiseEnRelationBonVerifier ; retirer bonsRef des chemins Mes bons.

[26] g2 contourne | ui/assets/payencash-data.js, ui/assets/payencash-bons.js | Règle « le bon doit être rangé par ce compte »
  La règle qui fait l'« app obligatoire » (n'utiliser qu'un bon rangé sous son compte) vit seulement dans le socle de l'écran (PEC_BONS.utiliser). Le data-layer accepte n'importe quel `par` non vide sans vérifier que ce compte a rangé le code, et techBonUtiliser (public) débite sans compte.
  corr: Au data-layer : techLienUtiliserBon vérifie que par est un compte client actif et qu'il est le titulaire du bon (tb.porteurId posé au premier rangement, cf. oubli) ; techBonUtiliser devient _techBonDebiter, appelé seulement par techLienUtiliserBon.

[27] g2 promesse_sans_logique | ui/titres/01-mes-titres.html, ui/titres/09-rencontre.html, ui/assets/payencash-data.js | Reçu du total payé et du déplacement
  « Bon à savoir » et la caisse du nomade disent que le déplacement est « facturé en son nom », mais aucun reçu n'est produit ni montré au client : après la remise, Mes bons ne dit ni ce qu'il a payé (bon + déplacement, moyens, monnaie rendue), ni qui lui a facturé le déplacement.
  corr: À techRencontreServir, poser `recu: { bon: em.bon.montant, deplacement: r.tarif, total, moyen: em.bon.moyen, partEspeces: em.bon.partEspeces, vendeur: raison sociale + SIRET du partenaire, at }` et l'afficher (« Ce que tu as payé ») sur la carte servie de 01 et la feuille de 09 ; lier au détail du bon (02).

[28] g2 incoherence | ui/assets/payencash-comment-payer.js, ui/titres/09-rencontre.html | Demande faite sans compte
  La fenêtre promet « ton bon t'attend dans Mes bons dès que ton compte est ouvert », mais une demande sans compte n'est reliée que par la liste locale de l'appareil : le numéro est effacé au service, donc un compte ouvert sur un autre appareil (ou après avoir vidé le navigateur) ne retrouve jamais le bon payé ; 09 le dit (« sur cet appareil »), la fenêtre non.
  corr: Aligner la phrase de la fenêtre sur 09 (« sur cet appareil »), et relier la demande au compte par le numéro VÉRIFIÉ à l'inscription (garder une empreinte du numéro jusqu'au rattachement) ; ou demander la création du compte avant d'envoyer la demande.

[29] g2 incoherence | ui/assets/payencash-data.js (lu par partenaire/11-remise) | Code de remise stocké en clair sur la rencontre
  Le flashcode qui prouve que le bon est remis « à la bonne personne » repose sur un code que l'enregistrement de la rencontre porte en clair et que l'app du distributeur lit en entier : la preuve montrée au client n'en est pas une vis-à-vis de celui qui la vérifie.
  corr: techRencontresRevendeur (et toute lecture côté partenaire) rend une copie sans remise.code (garder essais, verifieeTs, mode) ; 11-remise ne relit plus le code : après vérification, il lit remise.verifieeTs/mode ; côté serveur, stocker une empreinte du code, pas le code.

[30] g2 impasse | ui/titres/05-offre.html, ui/titres/01-mes-titres.html, ui/assets/payencash-garde.js | « Utiliser mon bon sur … » (bo-utiliser) ; texte de l'offre « Utilise-le depuis ici »
  05 ne fait plus utiliser ni ranger (réécriture en cours) : son seul geste d'usage mène au site générique de la marque (techDestinationUrl sans le bon proposé), où le widget crée une NOUVELLE commande ; la proposition reçue (un devis, une commande de la marque) n'est donc jamais couverte depuis Mes bons, et reste « Proposé » jusqu'à expiration. Pendant ce temps, 01 dit encore « Tu as déjà un de ses bons ? Utilise-le depuis ici », la garde dit « Un bon de marque s'utilise depuis l'app », et l'en-tête de 05 garde « c'est ICI, et nulle part ailleurs, qu'un bon de marque s'UTILISE ». La seule page qui couvre la proposition (tech/07-lien?l=<slug>, « J'ai un bon ») n'est liée que pour le nomade.
  corr: Dans 05, quand l'utilisateur a des bons actifs de la marque et que la proposition est ouverte : « Couvrir cette proposition avec mon bon » → ../marchand/07-lien.html?l=<slug> (section « J'ai un bon », qui fait déjà B.ajouter + B.utiliser), ou faire porter le slug par techDestinationUrl pour que le widget reprenne CETTE commande ; aligner le texte de 01 (rendreOffre), la phrase de la garde, et supprimer le commentaire d'en-tête périmé de 05.

[31] g2 contourne | ui/assets/payencash-bons.js | kyc() / retirer()
  Le cumul « sur 30 jours glissants » ne compte que les bons présents dans la liste (et en attente). Retirer un bon efface sa trace : il suffit d'utiliser un bon de 240 € acheté en espèces, de le retirer, puis de ranger le suivant, pour ne jamais franchir le palier de 250 €. Combiné aux comptes multiples (oubli « titulaire »), la politique de prévention de la fraude n'a aucun effet.
  corr: Compter au data-layer les bons dont ce compte est ou a été titulaire (tb.porteurId / journal 'tech_bon_range'), plus les usages `par` ce compte, sur la fenêtre, qu'ils soient encore dans la liste ou non ; kyc() lit ce cumul (kycPorteurCumul) ; retirer un bon ne le sort pas du décompte, et l'écran le dit.

[32] g2 casse | ui/assets/payencash-data.js, ui/titres/04-compte.html | compteSupprimer / « Confirmer la suppression »
  Supprimer son compte pendant une demande ou un rendez-vous validé efface le prénom et le numéro de la rencontre mais la laisse 'demandee' ou 'acceptee' : le nomade garde une demande qu'il ne peut plus appeler (rencontreContactUrl rend null), peut se déplacer pour un rendez-vous validé, et un bon servi ensuite ne se rangera jamais (compte supprimé). Rien ne prévient le porteur avant la suppression.
  corr: Dans compteSupprimer, annuler les rencontres vivantes du client (techRencontreAnnuler(id, 'le client a fermé son compte', 'client')) ; refuser la suppression tant qu'une remise est vérifiée (flashcode reconnu) ; dans cp-sup-info, dire « ta demande en cours avec X sera annulée ».

[33] g3 incoherence | ui/titres/05-offre.html | Carte « Un distributeur nomade se déplace »
  Depuis un bon proposé, le chemin nomade quitte Mes bons pour la page publique de l’espace marchand (tech/07-lien, sans barre de l'app, suivi ouvert dans un autre onglet), et le nombre affiché est calculé avec agentsMobiles (l'ancienne recherche par zone) filtré à la main, pas avec nomadesDisponibles comme la carte 03.
  corr: Monter PEC_OU dans 05 avec le réseau du bon proposé (PEC_TECH.reseauOu(slug), suiviUrl '09-rencontre.html?rdv={rdv}') et compter avec D.nomadesDisponibles().

[34] g3 incoherence | ui/titres/04-compte.html, ui/assets/payencash-bus.js | Dossier au statut « a_completer »
  Un envoi jugé incomplet prend le statut a_completer ; Compte ne le nomme pas (il ne traite que a_controler, transmise_pvid, a_refaire, refusee) et rouvre le dépôt comme si rien n'avait été envoyé. Ce statut manque aussi à STATUT_SQL.verification.
  corr: Dans rendreKyc, cas 'a_completer' : « Ton dossier KYC-… est incomplet : <pvid.manquantes> — complète ci-dessous et renvoie » ; ajouter a_completer à STATUT_SQL.verification.

[35] g3 incoherence | ui/titres/01-mes-titres.html | Bandeau « Avant de ranger un bon » → « Ouvrir mon compte »
  Chaque manque porte son ancre (#documents, #identite) mais le bandeau n'a qu'un bouton vers le haut de Compte ; 02 et 05 disent seulement « Tout se passe dans Compte » sans lien.
  corr: Un lien par manque (m.href) dans le bandeau 01 et sous les messages de refus de 02 / 05.

[36] g3 casse | ui/titres/09-rencontre.html | Annuler ma demande / le rendez-vous
  Le résultat de l'annulation est ignoré : un refus (remise vérifiée entre deux peintures, écriture refusée) ne se dit pas, la feuille se repeint comme si de rien n'était (01 affiche, lui, achatErreur).
  corr: var an = D.techRencontreAnnuler(…) ; si !an.ok, afficher an.motif dans la feuille (role=alert).

[37] g3 incoherence | ui/titres/01-mes-titres.html, ui/titres/04-compte.html | Demande de rappel en attente
  Une demande « sans réponse » ou « à rappeler » est affichée comme « la hotline te rappelle sous 15 min », libellé figé à la création, même des heures plus tard ; le porteur n'apprend pas qu'on a essayé de le joindre.
  corr: Dériver la phrase de dueAt et du statut (échéance passée, sans_reponse : « la hotline a essayé de te joindre à HH:MM et te rappelle ») ; même fonction pour 01 et 04.

[38] g3 redondance | ui/titres/01-mes-titres.html, ui/titres/09-rencontre.html, ui/assets/payencash-comment-payer.js | Libellés et contrôle de notation
  Trois libellés pour l'absence de note (« Pas encore noté », « pas encore noté », « Pas encore d’avis ») et deux dessins de notation (étoiles seules sur 01, boutons « n ★ » sur 09) pour le même geste.
  corr: Une fonction D.distributeurNoteLbl(id) et un rendu de notation unique dans PEC_BONS (noteHTML), lus par 01, 09 et PEC_OU.

[39] g3 genre | ui/titres/09-rencontre.html, ui/assets/payencash-data.js reglesAchatHTML | Phrases sur la personne choisie
  La règle maison est de ne pas supposer le genre de la personne choisie (03 le dit en commentaire) ; plusieurs phrases l'ignorent et oublient le canal WhatsApp.
  corr: « la personne choisie vient te vendre ton bon », « ton choix », « fixé par la personne choisie, facturé en son nom ; elle te contacte (appel ou WhatsApp) pour valider le rendez-vous ».

[40] g3 design | ui/titres/01-mes-titres.html, ui/titres/03-rechercher.html, ui/titres/09-rencontre.html, ui/assets/payencash-comment-payer.js | Couleurs écrites en dur
  Plusieurs couleurs ne passent pas par les jetons du thème (mode sombre non suivi).
  corr: var(--color-danger) pour les erreurs, var(--color-star) pour les étoiles, var(--color-amber*) ou un jeton --color-nomade pour l'orange du nomade et du secteur, var(--color-primary) lu par getComputedStyle pour les couches MapLibre.

[41] g3 obsolete | ui/assets/payencash-comment-payer.js, ui/assets/payencash-data.js | Commentaires et code hérités de Mode / Fly / agent
  Des commentaires décrivent un monde disparu et contredisent le code : « le client n'a pas de compte chez nous … n'entre dans aucun carnet » (le carnet existe), références Fly 05-recherche-agent / Mode 25-rencontre, « Rencontre un agent … le Bon d'achat PayEnCash », « on ne demande pas une adresse de domicile » (le domicile du carnet est prérempli) ; rencontresGet / _rencontreVive / rencontreFenetreMin (pec-rencontres de Mode) sont du code mort.
  corr: Supprimer ces commentaires et les fonctions rencontresGet, rencontre, _rencontreVive, rencontreFenetreMin ; réécrire le commentaire du volet (carnet du compte, adresse recopiée).

[42] g3 code_mort | ui/assets/payencash-bons.js, ui/assets/payencash-data.js | familleAutre / message « Mode, Fly » de _techBonControle
  L'app reconnaît encore les codes du Bon d'achat PayEnCash (pec-bons, sans émetteur vivant) et le contrôle d'un bon de marque renvoie un motif qui cite Mode et Fly.
  corr: Retirer le bloc pec-bons du data-layer, la branche bonParCode de _techBonControle et familleAutre (et ses appels dans ajouter, liste, 02).

[43] g3 incoherence | ui/titres/03-rechercher.html | Demande de position au chargement
  L'en-tête affirme que la position n'est demandée « qu'au geste, jamais au chargement », mais la page ouvre la fenêtre d'accord (ou localise directement si l'accord est connu) dès le chargement.
  corr: Trancher : soit ne demander qu'au clic sur « Me localiser » (retirer le bloc 513-516), soit réécrire le commentaire en disant que la fenêtre d'explication s'ouvre au premier chargement.

[44] g3 incoherence | ui/titres/01-mes-titres.html, ui/titres/05-offre.html | Site où se dépense le bon proposé
  Le bon proposé cite son site recopié (x.site) alors que les bons de la même marque citent la destination dérivée (boutique hébergée de l'abonnement si active) : deux adresses différentes pour la même marque sur le même écran.
  corr: Lire partout D.techMarchandDestination(x.marchandId).lbl.

[45] g3 obsolete | ui/titres/04-compte.html, ui/assets/payencash-data.js | Version portée par un consentement
  Chaque consentement (communications, modification du profil, suppression) enregistre comme version CGV_VERSION 2026-08-28, les CGV de Mode, et non la version d'un document de l'app.
  corr: Enregistrer la version du document applicable (ref.documents.bons, confidentialite) ou aucune version pour un consentement qui n'en dépend pas ; retirer CGV_VERSION.

[46] g3 incoherence | ui/assets/payencash-bons.js, ui/titres/01-mes-titres.html | recuEtat() appelé pendant la peinture
  La lecture de l'état d'un bon remis (recuEtat) déclenche recevoir(), qui rattache, range, met en attente et écrit : une lecture faite à chaque peinture de 01 (signature et carte) et de 09 (chaque seconde) modifie les données et émet pec-bus.
  corr: Séparer : recevoir() au chargement et sur storage seulement ; recuEtat() en lecture pure (estRange, recus, attente, dernier motif mémorisé).

[47] g3 incoherence | ui/titres/01-mes-titres.html | mesDemandes().slice(0, 3)
  Seules les trois demandes les plus récentes s'affichent : une rencontre servie dont le bon attend encore les documents ou la vérification (qu'on ne peut pas refermer par « OK ») disparaît dès que trois demandes plus récentes existent.
  corr: Ne pas tronquer les rencontres vivantes ni les servies en refus ; tronquer seulement les fermées déjà lues, avec « Voir les N autres ».

[48] g3 impasse | ui/titres/09-rencontre.html | Flèche retour → 01-mes-titres.html#achat
  09 est public pour suivre une demande faite sans compte, mais sa flèche retour mène à 01 (personnel) : l'invité tombe sur le mur de connexion, et l'ancre #achat est perdue dans le retour de la garde.
  corr: Sans session, faire pointer la flèche vers 03-rechercher.html?onglet=nomades ; la garde ajoute location.hash au retour.

[49] g3 redondance | ui/titres/02-titre.html | delaiHotline()
  02 recalcule le délai de réponse depuis ref.hotline alors que la demande créée porte déjà son échéance (dueAt, due) : deux sources pour la même promesse.
  corr: Lire dem.due / dem.dueAt renvoyés par PEC_BUS.ouvrirDemande.

[50] g3 promesse_sans_logique | ui/assets/payencash-bus.js, ui/titres/01-mes-titres.html, ui/titres/04-compte.html | PEC_BUS.demanderAppel → « Demande enregistrée »
  demanderAppel ignore le résultat de l'écriture : sur un appareil au stockage plein, 01 et 04 affichent « Demande enregistrée : la hotline te rappelle sous 15 min » pour une demande que la hotline ne verra jamais (la règle maison « une écriture refusée se dit » est appliquée à ouvrirDemande, pas ici).
  corr: « if (!ecrire('apl_' + id, apl)) return refusEcriture('Ta demande de rappel'); » et, dans 01/04, tester « !a || a.ok === false ».

[51] g3 casse | ui/assets/payencash-data.js, ui/titres/00-inscription.html | compteCreer — profil.nom d'un client sans nom de famille
  Le nom étant facultatif, un compte créé sans nom devient « Marie . » : c'est ce libellé qui part dans le dossier de vérification (client), sur la pièce cgu signée et dans les écrans.
  corr: Garder profil.nomFamille tel quel (cf. [20]) et dériver le libellé court à l'affichage : prenom + (nomFamille ? ' ' + initiale + '.' : '').


######## sedentaire — Le commerce sédentaire (45 confirmés, 0 oublis, 0 réfutés)

[0] g1 casse | ui/assets/payencash-data.js | techRetourImporter
  Un retour bancaire importé en deux fois (retour « partiel » puis la suite) rejoue les effets sur TOUTES les lignes déjà payées ou impayées de la remise : une seconde pénalité d'impayé est créée pour le même impayé, et une ligne déjà représentée voit ses ventes rebasculer en « impaye » avec remiseRef nulle — elles ne repartent plus dans aucune remise, la ligne est déjà « représentée » (pas de seconde représentation), le point reste suspendu sans issue.
  corr: Dans techRetourImporter, ne traiter que les lignes lues DANS CE retour dont le statut était 'depose' avant l'import (garder la liste des références mises à jour dans la boucle de lecture) ; refuser de modifier une ligne déjà 'paye'/'impaye' ou représentée ; rendre la pénalité idempotente par (remise, débiteur, nature).

[1] g1 incoherence | ui/assets/payencash-data.js | techRepresenter → _techPenaliteCreer(coutRepresentation)
  La représentation crée une pénalité « Frais de représentation » à la charge du commerce, alors que le contrat signé, les CGU et tous les écrans du commerce ne prévoient qu'une pénalité forfaitaire par impayé. Le commerce est débité d'une somme sans base contractuelle ; ce réglage n'est même pas dans les conditions figées du contrat (aucun avenant quand il change).
  corr: Choisir : soit supprimer la pénalité de représentation (le coût reste chez nous), soit l'écrire à l'art. 5.5 du modèle contrat_partenaire et de documents/contrat-distribution-bons.html, l'ajouter à CONDITIONS.contrat_partenaire (avenant), à rendreConditions (07), à la note de 05 et aux CGU 4.1 e.

[2] g1 promesse_sans_logique | ui/distributeur/07-mon-point.html | #mp-part-note ; 09 blocDroit ; contrat 5.6/5.7
  Le contrat (5.6 : « PayEnCash émet, par arrêté, la facture des bons achetés » ; 5.7 : autofacture de la part), les CGU 4.3 et les écrans 07 et 09 (« elle figure sur ton autofacture mensuelle ») promettent des pièces comptables qu'aucun code n'émet : aucune facture par arrêté, aucune autofacture, aucun écran qui les montre, aucune déclaration du régime de TVA du commerce (franchise / assujetti) alors que le contrat dit qu'il « déclare son régime ». Le seul modèle d'autofacture (facture_commission_bons) est l'héritage du Bon d'achat PayEnCash (« sa carte n'est prélevée que du solde ») et n'est jamais appelé ; la table invoices ne porte que les abonnements des marques.
  corr: Ajouter au data-layer techFactureArrete(remiseRef, revendeurId) (bons achetés de l'arrêté, régime BUU/BUM par marque, part en réduction de prix ou autofacture), techAutofacturePart(revendeurId, periode) (mention « Autofacturation », délai de contestation du référentiel) rangées au coffre ; faire déclarer le régime de TVA (franchise 293 B / assujetti + n° TVA) dans 00 ou 07 ; les lister dans 05 ; supprimer facture_commission_bons. À défaut, retirer la promesse des écrans et du contrat.

[3] g1 casse | ui/assets/payencash-data.js | techRemiseDeposer / techRemiseFichier
  Le dépôt ne revérifie pas le mandat : un commerce qui révoque son mandat entre la préparation et le dépôt est quand même prélevé — le fichier relit l'IBAN et la date de signature d'un mandat RÉVOQUÉ (techSepaMandatToute) ; s'il a re-signé avec un autre compte, c'est le nouvel IBAN qui part alors que la ligne affiche l'ancien.
  corr: Dans techRemiseDeposer, pour chaque ligne 'prepare', relire techSepaMandat (actif) : si absent ou si la RUM/IBAN diffère de la préparation, passer la ligne en 'ecartee' avec motif et rendre ses ventes 'a_prelever' ; techRemiseFichier doit écrire l'IBAN figé à la préparation (le stocker complet sur la ligne, chiffré en prod).

[4] g1 impasse | ui/distributeur/07-mon-point.html | #mp-sepa-revoquer → techSepaMandatRevoquer ; techRemisePreparer (ligne écartée)
  Le commerce peut révoquer son mandat avec un encours en cours (jusqu'au plafond). Ses ventes restent « à prélever » pour toujours : à chaque remise sa ligne est écartée (ventes et pénalités gardées sur la ligne), aucune alerte ne part vers le manager ni vers le commerce, et aucun autre chemin de règlement n'existe. La dette n'est jamais recouvrée ; un point clos dans cet état garde l'encours.
  corr: Refuser la révocation tant que techEncours(r).montant > 0 (motif : « signe d'abord un nouveau mandat ») ou, à défaut, ouvrir au manager un geste « créance à recouvrer » (relance, mise en demeure, virement constaté comme pour l'avance) et pousser une alerte au fil du manager et du commerce quand une ligne est écartée.

[5] g1 promesse_sans_logique | ui/assets/payencash-data.js | techBonEmettre (plafonds du réseau)
  Les CGU (5.2 : plafonds « par bon, par client et par jour, par client sur trente jours glissants, lus dans l'application, qui fait foi ») et le contrat (3.1 : « L'application refuse la vente tant qu'une condition manque : … plafonds du réseau ») promettent des plafonds que la vente d'un bon de marque n'applique pas : techBonEmettre ne contrôle que le montant > 0, le plafond légal des espèces et l'encours. Un commerce peut émettre un bon de 1 500 € par carte ; les plafonds plafondBon / plafondClientJour / plafondClientMois n'existent que dans l'ancien référentiel du Bon d'achat PayEnCash (bonEmettre, sans appelant).
  corr: Créer un référentiel des plafonds du bon de marque (ref.tech.plafonds : par bon, par jour et par 30 jours, lu via techRef) et le contrôler dans techBonEmettre (par bon au comptoir ; par client quand le bon est rangé dans Mes bons, avec refus de rangement au-delà) ; afficher la borne sous le champ montant de 03. Sinon corriger CGU 5.2 et contrat 3.1.

[6] g2 incoherence | ui/distributeur/03-vendre.html | majCadre (#v-cadre), panneau (#v-encours) ; 02 majRegle ; 05 #rv-arg-note ; 07 #mp-sepa-pourquoi, rendreConditions ; 09 blocDroit ; 00 finir ; index.html
  Deux vérités sur l'arrêté. Le data-layer arrête et prélève par offre de la marque, tous les 1, 7 ou 10 jours (techArrete, cadenceJours) et la même page 03 le dit une fois (« tous les N jours ») ; partout ailleurs le commerce lit un arrêté quotidien (« arrêtés à 20:00 puis prélevés », « chaque soir », « des bons vendus entre deux arrêtés de 20:00 »), le contrat 5.3 et les CGU 4.1 d écrivent « Les ventes sont arrêtées chaque jour », et la vitrine promet « Chaque soir à 20:00 … prélevés ». 05 annonce aussi « le premier naît à l'arrêté de 20:00 qui suit ta première vente », alors qu'une remise naît d'un geste du manager selon la cadence.
  corr: Une seule phrase au data-layer (ex. D.techArreteTxt(modeId) : « arrêté tous les N jours à 20:00 selon l'offre de la marque ») lue par 02, 03, 05, 07, 09, 00 et la vitrine ; réécrire contrat 5.3 et CGU 4.1 d (arrêté par offre, cadence du référentiel) ; en 05, dire que le prélèvement naît au prochain arrêté de l'offre, préparé par PayEnCash.

[7] g2 casse | ui/assets/payencash-data.js | techArrete().prochaineFin / echeanceProchaine (lus par 03 majDu, 04 rendreDu, 45)
  La date d'arrêté montrée au commerce avant la vente (03) et dans « Ce que je dois » (04) est fausse dès qu'une remise existe pour l'offre : prochaineFin = dernier 20:00 + cadence, alors que l'arrêté réellement dû est dernière remise + cadence. Sans remise antérieure, la vente part au prochain 20:00 mais l'écran annonce 7 ou 10 jours plus tard. L'échéance du prélèvement n'est jamais dite avant la vente, alors que le contrat 5.3 promet « la date d'échéance de chaque vente est affichée dans l'application avant la vente ».
  corr: Remplacer prochaineFin par une fonction D.techArreteProchain(modeId) qui rend le premier arrêté où la vente sera réellement retenue (règle de techArrete().du) et l'échéance de prélèvement correspondante (+ remiseJoursOuvresAvant) ; l'afficher dans majDu (avant la vente), dans v-fait et dans 04.

[8] g2 incoherence | ui/assets/payencash-data.js | techArrete (regroupement par offre courante) ; 04 rendreDu
  Une vente garde son offre (modeId figé), mais l'arrêté la range selon l'offre ACTUELLE de sa marque : après un changement d'offre, une vente faite sous « 24 heures » part à la cadence et à l'échéance marque de « 10 jours » — le commerce est prélevé plus tard (encours gonflé), la marque est payée plus tard que ce qu'elle a acheté avec sa remise de 5,5 %. 04 regroupe au contraire par v.modeId et annonce la date de l'ancienne offre, qui ne retiendra jamais ces ventes.
  corr: Dans techArrete, filtrer les ventes sur v.modeId === mode.id (l'offre figée sur la vente) au lieu de l'offre courante de la marque ; calculer echeanceMarque avec l'offre de la vente.

[9] g2 manque_fonctionnel | ui/distributeur/05-releves.html | rendrePrelevements (#rv-arg)
  Le contrat (5.3, 5.6) fait du « relevé de chaque arrêté (bons vendus, prix réseau, part conservée, ventes annulées, état des prélèvements) » la pré-notification SEPA et la pièce qui « fait foi entre les parties ». Il n'existe pas : 05 ne montre par remise qu'un nombre de bons, un montant et un statut ; aucun détail des ventes de l'arrêté, aucun document ni export, aucune notification au fil quand une remise est préparée, déposée, payée ou quand un impayé est représenté.
  corr: Dans 05, rendre chaque ligne de remise dépliable (ventes VNT : date, marque, valeur, part, prix réseau ; annulées de la fenêtre ; pénalités), avec un « Relevé d'arrêté » rangé au coffre (PEC_DOCS, modèle releve_arrete) ; pousser au fil partenaire « Prélèvement de X € le <échéance> (remise RMS-…) » à la préparation, puis « représenté le … » et « payé ».

[10] g2 manque_fonctionnel | ui/distributeur/07-mon-point.html | #mp-sepa-form, #mp-sepa-sig-txt
  Le mandat B2B doit être enregistré par le commerce auprès de sa banque avant le premier prélèvement (contrat 5.2, mention du mandat), mais l'app ne produit aucun formulaire de mandat (PDF avec RUM, ICS, créancier et son adresse, débiteur et son adresse, type B2B, date et lieu) à lui remettre, ne l'archive pas au coffre et ne demande pas de confirmer l'enregistrement : le premier prélèvement FRST part à l'aveugle. Le formulaire ne demande ni l'adresse du débiteur ni le lieu ; la phrase d'autorisation nomme la marque commerciale « PayEnCash » alors que le créancier du fichier est la société (AJEK).
  corr: Ajouter un modèle PEC_DOCS mandat_sepa (mentions obligatoires du règlement SEPA B2B, créancier = ref.societe), généré et signé à la signature, rangé au coffre et téléchargeable ; ajouter adresse du débiteur et lieu au formulaire ; ajouter une case « mandat enregistré auprès de ma banque » que techRemisePreparer exige pour une séquence FRST ; utiliser ref.societe.nom dans la phrase d'autorisation.

[11] g2 casse | ui/assets/payencash-data.js | techSepaMandatSigner (RUM dérivée)
  La RUM est dérivée de la fiche de vente et l'objet mandat est écrasé : un mandat révoqué puis re-signé (autre IBAN, autre date) repart sous la MÊME référence, alors qu'une RUM désigne un mandat unique ; l'historique est perdu et la banque du débiteur, qui a enregistré puis annulé le mandat B2B, rejette le prélèvement (MD01).
  corr: Tirer une RUM neuve par signature (suffixe séquentiel), garder la liste des mandats (actifs et révoqués) et faire porter à chaque ligne de remise la RUM figée.

[12] g2 contourne | ui/distributeur/07-mon-point.html | #mp-iban → techSepaMandatSigner
  L'IBAN du mandat est tapé librement et n'est rapproché ni du RIB déposé et contrôlé au dossier (pièce 'rib', « le compte prélevé par le mandat SEPA »), ni de la raison sociale : le titulaire est un texte libre de 3 caractères. Un compte tiers peut être mandaté sans que personne ne le voie.
  corr: Relever l'IBAN du RIB au contrôle (mentions du coffre, comme pour la marque) et faire refuser par techSepaMandatSigner un IBAN différent (ou le passer « à contrôler » par le manager avant toute remise) ; exiger un titulaire égal à la raison sociale du point.

[13] g2 impasse | ui/assets/payencash-data.js | partenaireSuspendre → compte du gérant suspendu ; compteConnecter
  Suspendre un point suspend aussi le compte de son gérant : il ne peut plus se connecter (« Compte suspendu — contacte PayEnCash », sans le motif). Tout ce qui a été écrit pour lui dire pourquoi et quoi faire devient inaccessible : bandeau « Point suspendu — motif » (partenaireEtat), fait « Point suspendu » du fil, À faire, relevés de ce qu'il doit. Le contrat 10.2 présente pourtant la suspension comme une attente de régularisation, pas une sanction.
  corr: Ne pas suspendre le compte du gérant à la suspension du point (la garde ferme déjà la vente) ; ou, si l'accès doit être coupé, afficher à la connexion le motif du point (motifSuspension) et laisser l'accès en lecture à 05, 07 et 08.

[14] g2 impasse | ui/assets/payencash-data.js | partenaireRefuser ; partenaireEtat ; manager 29 message
  Un refus de relation (29 « Refuser… », motif « que le commerce lira ») n'atteint jamais le commerce : son compte reste actif, l'app affiche « Point non actif — statut « refuse » » (le code brut, sans motif), aucun fait « relation refusée » n'existe dans le fil, « À faire » continue de proposer le dossier et le contrat, et 07 propose toujours de signer. Le message du manager affirme « Le compte du gérant suit », ce qui est faux pour le refus.
  corr: Ajouter T.refuse = ['Relation refusée', enseigne + ' : ' + motifRefus] dans partenaireEtat, un fait 'pt-refus' dans filPro, arrêter P.aFaire sur ce statut, masquer la signature du contrat en 07 ; clore (ou passer « refuse ») le compte du gérant, ou corriger le message de 29.

[15] g2 obsolete | ui/assets/payencash-data.js | compteConnecter (statut clos)
  Le commerce dont le contrat est résilié lit à la connexion « tes bulletins restent disponibles auprès de PayEnCash » : reste de l'agent salarié (bulletins de paie). Il perd en plus tout accès à ses relevés et pièces comptables, que la politique de confidentialité dit conservés dix ans.
  corr: Motif par espace : pour un partenaire, « Contrat de distribution résilié (motif) — tes relevés restent disponibles en lecture » et ouvrir 05 en lecture seule pour un point clos (ou « sur demande à PayEnCash »).

[16] g2 incoherence | ui/assets/payencash-data.js | _revendeurSuitPoint (patch) ; en-tête payencash-partenaire.js
  Le socle affirme que la fiche de vente a « même raison sociale, même SIRET, même mode d'exercice, même ville », tenue par le data-layer ; en réalité elle recopie l'identité à sa création et ne la suit plus : le téléphone et l'e-mail changés dans Mon point, l'enseigne, le SIRET ou la ville corrigés par le manager (29) restent anciens sur la fiche de vente, sur les ventes (revendeur) et sur la ligne de remise (débiteur du fichier faute de titulaire). Le manager peut en plus poser un SIRET invalide (14 chiffres sans clé ni unicité).
  corr: Ne plus copier l'identité sur la fiche de vente : la lire sur le point (techRevendeur rend raisonSociale/siret/tel/email/ville depuis partenaire(partenaireId)) ; ou ajouter ces champs au patch de _revendeurSuitPoint ; contrôler le SIRET par D.siretValide et partenaireParSiret dans partenaireEnregistrer.

[17] g2 contourne | ui/assets/payencash-data.js | _revendeurSuitPoint → techRevendeurCreer({cgu:true})
  La fiche de vente naît avec une acceptation des CGU fabriquée (cgu:true et la version courante), sans geste du gérant : la trace « CGU acceptées » sur la fiche ne correspond à aucune lecture ni acceptation réelle.
  corr: Supprimer cgu/cguVersion de techRevendeurCreer pour une fiche née d'un point ; la preuve d'acceptation est celle de pec-acceptations sous l'identifiant du gérant (déjà lue par techPeutVendre).

[18] g2 contourne | ui/distributeur/07-mon-point.html | #mp-signataire, #mp-contrat-signer ; #mp-responsable
  Le signataire du contrat est un nom tapé librement (3 caractères) qui n'est jamais comparé au gérant dont la pièce d'identité et la vidéo ont été contrôlées (point.gerant) ; le commerce peut en plus changer le « Responsable, comme au Kbis » dans sa fiche sans contrôle, ce qui change le signataire proposé. Aucun code à usage unique à la signature par Mon point. Le contrat exige pourtant la signature « par le gérant ».
  corr: Pré-remplir et verrouiller le signataire à partir de point.gerant (civilité, prénom, nom) ; refuser dans contratPartenaireSigner un signataire différent du gérant contrôlé ; exiger un code (OTP e-mail du compte) à la signature ; retirer « responsable » des champs libres de la fiche (ou le séparer du signataire).

[19] g2 incoherence | ui/assets/payencash-data.js | techPeutVendre ; CONDITIONS.contrat_partenaire ; P.aFaire
  Un avenant à signer n'a aucun effet : dès que le manager change une part, l'heure d'arrêté, le plafond ou la pénalité, les nouvelles conditions s'appliquent aux ventes et aux impayés avant toute signature ; et les réglages qui touchent l'argent du commerce hors de cette liste (frais de représentation, cadence des offres, nombre d'impayés avant suspension) ne déclenchent même pas d'avenant. À l'inverse, un Kbis périmé (« une pièce périmée vaut pièce manquante ») s'affiche sous « À faire pour que ton point vende » alors que la vente continue.
  corr: Faire lire à techPeutVendre l'état de la pièce contrat (refus 'avenant' → « Signe l'avenant dans Mon point ») ou appliquer l'ancienne valeur tant que l'avenant n'est pas signé ; compléter CONDITIONS.contrat_partenaire (coutRepresentation, cadence par offre, impayesAvantSuspension) ; séparer dans « À faire » ce qui ferme la vente de ce qui est à régulariser.

[20] g2 casse | ui/assets/payencash-garde.js | connecte() ; payencash-partenaire.js compteSession ; techBonEmettre
  Retirer ou suspendre l'accès d'un collaborateur ne coupe pas sa session ouverte : la garde ne regarde que le préfixe de l'espace de la session, le socle relit le compte sans son statut, et l'émission ne vérifie pas le vendeur. Le collaborateur retiré continue d'émettre des bons au nom du point jusqu'à ce qu'il se déconnecte.
  corr: Dans PEC_PART.compteSession (ou la garde), traiter un compte non 'actif' comme une déconnexion (compteDeconnecter + retour à 01 avec le motif) ; faire refuser par techBonEmettre un « par » dont le compte n'est pas actif.

[21] g2 incoherence | ui/distributeur/09-marques.html | marqueCarte, blocDroit ; 03-vendre majCadre (#v-sous, #v-cadre)
  La règle de l'app est que ce que le point garde et doit « regarde le titulaire » (03 majDu, 02, 04 masquent la part au collaborateur). Mais 09 (dans le menu du collaborateur) lui affiche « sur 100 € de bons, tu gardes X € », « ta part », et « Tu revends pour ton propre compte… Ce que tu nous dois… Ta marge t'appartient » ; 03 lui dit aussi « Tu nous achètes le bon en le vendant … ta part est ta marge ». Un salarié lit qu'il est revendeur et débiteur.
  corr: Dans 09 et majCadre (03), si P.collab() : masquer la part et le cadre juridique, et dire « Tu vends au nom de <enseigne> » (texte de 02 majRegle), comme majDu.

[22] g2 casse | ui/manager/45-marchand-paiements.html | [data-appel] → techImpayeAppelNoter
  L'appel noté enregistre toujours l'accord du commerce (accord: true) : l'écran n'a pas de champ pour le dire, et le data-layer met vrai par défaut. Le journal atteste un accord qui n'a peut-être pas été donné, et la représentation ne regarde pas cette réponse.
  corr: Ajouter au formulaire d'appel un choix « le commerce accepte la représentation / conteste / injoignable » passé en o.accord (sans défaut à vrai) ; faire refuser techRepresenter si accord === false sans confirmation motivée du manager.

[23] g2 promesse_sans_logique | ui/manager/45-marchand-paiements.html | [data-fichier], [data-deposer] « Déposer à Crédit Mutuel »
  « Déposer à Crédit Mutuel » ne produit aucun fichier : le XML pain.008 s'affiche en texte dans un bloc, sans bouton pour le télécharger (.xml) ; le geste ne fait que marquer la remise « déposée ». La fondatrice décrit « je dépose mon fichier » : il n'y a pas de fichier à déposer.
  corr: Ajouter « Télécharger RMS-….xml » (Blob + a[download], nom f.nom) et ne proposer « Marquer comme déposée » qu'après le téléchargement.

[24] g2 impasse | ui/assets/payencash-data.js | techBonAnnuler (motifs) ; 04-titres.html #bl-note
  Passé le délai, ou quand la vente est partie au prélèvement, le commerce lit « Fais une reprise avec la marque » / « seule la marque peut encore rembourser ». Aucun flux de reprise ou de remboursement n'existe (ni dans l’espace marchand, ni au manager), et le commerce n'a aucune relation avec la marque (« entre eux, rien — c'est le grossiste qui achète et qui revend »). Le contrat 3.2 dit d'ailleurs que l'annulation tardive « relève de PayEnCash et de la Marque ».
  corr: Remplacer par « Écris à PayEnCash depuis Mon point » et ouvrir une demande hotline typée « annulation tardive » (bon, vente, motif) que le manager traite (annulation du bon non utilisé + avoir sur la remise suivante) ; ou retirer la promesse.

[25] g2 incoherence | ui/assets/payencash-data.js | techBonTicketHTML
  Le ticket remis par un commerce sédentaire dit « PayEnCash a acheté ce bon à la marque et l'a vendu à travers son réseau », ce qui contredit sa qualification (il achète le bon et le revend pour son propre compte) ; il ne nomme pas le vendeur (enseigne, SIRET) et omet des mentions exigées par le contrat 3.2 : « s'utilise depuis l'app Mes bons » (absente du ticket d'une rencontre, qui n'a pas de flashcode) et les conditions (ni échange ni remboursement en espèces, aucun rendu de monnaie).
  corr: Faire dépendre la dernière ligne du mode de la vente (sédentaire : « Vendu par <enseigne>, SIRET …, qui l'a acheté à PayEnCash » ; nomade : texte actuel) ; ajouter en dur-dérivé les mentions de ref (conditions du bon) et « s'utilise depuis l'app Mes bons » dans techBonTicketHTML lui-même.

[26] g2 manque_fonctionnel | ui/distributeur/00-inscription.html | #pi-adresse (et 07 fiche, 29 fiche)
  Aucun geste ne pose la position d'un commerce sédentaire : l'adresse de l'inscription est un champ texte non géocodé, Mon point et le manager n'ont pas de position. Tous les commerces apparaissent au centre de leur ville sur la carte de Mes bons (geoApprox), et « M'y rendre » ne s'affiche jamais pour eux — alors que l'inscription promet « Elle place ton commerce sur la carte où les clients cherchent un point de vente ».
  corr: Brancher PEC_GEO.autocompleteAdresse (BAN) sur l'adresse de 00 et de 07, écrire geo {lat,lng} avec partenaireActiviteSet / partenaireEnregistrer ; afficher en 07 « position sur la carte : exacte / approchée » avec le geste pour la corriger.

[27] g2 casse | ui/assets/payencash-data.js | techBonEmettre (ordre des écritures)
  La vente (ligne à prélever, ou débit de l'avance) est écrite AVANT le tirage du code et l'écriture du bon ; si le tirage sûr échoue ou si l'écriture du bon est refusée, il reste une vente « à prélever » sans bon : le commerce sera prélevé pour un bon qui n'existe pas.
  corr: Tirer le code et préparer le bon avant _techVenteEnregistrer, ou annuler la vente (statut annulee + recrédit de l'avance) sur chaque retour d'échec après elle.

[28] g2 impasse | ui/assets/payencash-data.js | techRemisePreparer (lignes = points de l'arrêté)
  Une pénalité « à prélever » ne part que si son point a des ventes dans un arrêté dû : les lignes naissent de a.points. Un point suspendu dont l'impayé n'est pas représenté (ou un point clos sans vente) garde ses pénalités « à prélever » pour toujours, et le fil lui dit « prélevée avec le prochain arrêté ».
  corr: Ajouter aux lignes de la remise les points qui n'ont que des pénalités à prélever (mandat actif), ou un geste manager « prélever les pénalités seules » ; ajuster la phrase du fil.

[29] g3 incoherence | ui/distributeur/05-releves.html | #rv-statut (état du mois)
  Le bandeau du mois affiche « À prélever » dès qu'une vente attend, même quand toutes sont déjà remises à la banque (« Prélèvement remis ») ; le data-layer distingue pourtant les deux (techEncours.aPrelever / enPrelevement) et l'accueil les dit séparément.
  corr: Calculer l'état du mois avec trois cas : a_prelever s'il en reste, sinon en_prelevement s'il y en a, sinon regle.

[30] g3 incoherence | ui/distributeur/04-titres.html | flashHTML (réimpression)
  Le ticket réimprimé pointe toujours vers 02-titre, alors que le comptoir envoie un bon né d'un bon proposé vers 05-offre (où il se range et s'utilise) ; et il dit « À scanner avec l'app Mes bons — le bon s'y range » même pour un bon de rencontre déjà rangé chez son client, que 03 imprime sans flashcode. Le commentaire affirme pourtant « la même que celle du comptoir ».
  corr: Déplacer urlApp/flashHTML au data-layer (ex. D.techBonUrlApp(b) selon b.ordre, et pas de flashcode si la vente vient d'une rencontre servie) et l'utiliser dans 03 et 04.

[31] g3 incoherence | ui/distributeur/08-notifications.html | .nt-note ; commentaire d'en-tête
  La note dit que le fil ne vient que du dossier, du contrat, de l'état du point, des documents et de la hotline, et l'en-tête dit que les impayés se lisent dans Mes relevés ; le fil pousse pourtant aussi les impayés, les pénalités, les bons annulés, le mandat à signer et les mises en relation.
  corr: Dériver la note des familles réellement poussées (ou l'écrire complète : mandat, prélèvements impayés, pénalités, bons annulés, rencontres).

[32] g3 obsolete | ui/manager/29-partenaires.html | notice du cycle (l.61), colonne Réseau des marques (l.286), message d'activation (l.357) ; 07 kv('Fiche de vente')
  Le manager lit que le commerce « rejoint le réseau des marques depuis son app » et « pas encore inscrit — depuis son app » : ce geste n'existe plus, la fiche de vente naît d'office avec le point. Mon point dit « créée à l'activation du point » alors qu'elle naît à la validation du compte.
  corr: Réécrire : « sa fiche de vente naît avec le point ; à l'activation il signe son mandat SEPA » ; « Fiche de vente : en attente de l'activation » ; remplacer « pas encore inscrit » par le motif réel (_rvdRefus).

[33] g3 code_mort | ui/assets/payencash-data.js | contratPartenaireSigner (prospect, lien, OTP), partenaireInviterGerant ; 01 ?invit= ; 07 « Conseiller »
  Le chemin de signature par un commercial (prospect, lien jetonné + OTP, invitation du gérant ?invit=, champ commercial affiché « Conseiller ») survit alors que l'espace commercial n'existe plus ; Mon point parle encore du contrat signé « avec ton conseiller ». Le lien d'invitation est de plus un identifiant de compte séquentiel (registre A-41).
  corr: Réduire contratPartenaireSigner au seul chemin 'coffre' (point existant, gérant en session), supprimer partenaireParProspect, signatureLienEtat/Otp, partenaireInviterGerant, le bloc ?invit= de 01, le kv Conseiller et la phrase « avec ton conseiller », et le commentaire périmé de techBons.

[34] g3 obsolete | ui/assets/payencash-data.js | bonsRef()
  La validité des bons de marque (03, 04, 07 conditions, contrat) est lue dans bonsRef(), le référentiel du Bon d'achat PayEnCash retiré (nom par défaut « Bon d'achat PayEnCash », commissionPct, psp, préfixe 'BV-', plafonds par bon et par client jamais appliqués aux bons de marque).
  corr: Porter validiteMois (et les plafonds réellement appliqués) dans ref.tech (techRef().bon), faire lire 03/04/07/contrat depuis là, supprimer bonsRef et ref.bons.

[35] g3 genre | ui/assets/payencash-docs.js | PIECES.partenaire (labels) ; payencash-partenaire.js aFaire ; 00 h2
  Les pièces et les phrases supposent un homme : « Pièce d'identité du gérant », « Vidéo du gérant (visage + pièce) », « c'est lui qui signera le contrat », alors que la qualité « gérante » existe au référentiel et que l'écran de fin dit déjà « la personne qui dirige ».
  corr: Libellés neutres : « Pièce d'identité de la personne qui dirige », « Vidéo de la personne qui dirige » ; « c'est cette personne qui signera ».

[36] g3 incoherence | ui/assets/payencash-partenaire.js | P.aFaire (item dossier) ; 29 notice du cycle
  La liste des pièces annoncée au commerce (« À faire ») et au manager (29) oublie le RIB, pièce obligatoire du dossier (compte prélevé par le mandat).
  corr: Dériver la liste de PEC_DOCS.piecesDe('partenaire') (comme 07 #mp-dossier-intro) au lieu de l'écrire.

[37] g3 vocabulaire | ui/assets/payencash-garde.js | texte hors session 'partenaire/05-releves'
  Hors session, la page des relevés est décrite par « commission gagnée … autofactures » : un commerce sédentaire garde une part (marge), pas une commission, et aucune autofacture n'existe.
  corr: « Tes relevés : bons vendus, part gardée ou commission, prélèvements et pénalités — ils sont personnels. »

[38] g3 promesse_sans_logique | ui/distributeur/07-mon-point.html | #mp-rgpd-mode
  La note RGPD affirme « Le mandat SEPA ne garde que l'IBAN et sa référence » ; le mandat garde aussi le titulaire, le BIC, l'IBAN masqué, la date, le signataire, l'ICS et la mention.
  corr: « Le mandat garde ce qui sert à prélever : titulaire, IBAN, BIC, sa référence et sa date de signature. »

[39] g3 vocabulaire | ui/distributeur/09-marques.html | #mq-ordre-go (message d'erreur)
  Le refus d'une référence de bon proposé dit « sur cet appareil » : un artefact de la maquette (stockage local) exposé au commerce, qui croit à un problème de son téléphone.
  corr: « Aucun bon proposé ne porte cette référence — vérifie celle écrite sous le flashcode. »

[40] g3 vocabulaire | ui/distributeur/02-accueil.html | majMarques (#pb-mq-s) ; 03 majMarques (option vide)
  Le commerce lit que les marques « vendent leurs bons dans le réseau » : le glossaire veut que le réseau ACHÈTE les bons (jamais « vente du réseau ») ; la marque vend ses bons à PayEnCash.
  corr: « N marques du réseau : tu peux vendre leurs bons » / « Aucune marque n'est encore prête : ses bons se vendront ici dès sa vérification ».

[41] g3 contourne | ui/distributeur/00-inscription.html | #pi-code-demo
  Le code de confirmation de l'e-mail s'affiche en clair sous le champ (« Maquette : aucun e-mail ne part. Code attendu : … ») sans être gardé par le drapeau de démonstration du référentiel (scenario.demo) : la vérification de l'adresse est contournable.
  corr: N'afficher le bloc .demo que si D.scenario.demo est vrai (même règle que les autres simulateurs).

[42] g3 incoherence | ui/assets/payencash-data.js | techRemisePreparer (depotAvant)
  La règle « fichier déposé dans les 15 min de la vérification journalière » est mesurée depuis la préparation (clic du manager), pas depuis l'arrêté : une remise préparée à 23:00 et déposée à 23:10 est « dans les temps ».
  corr: depotAvant = fin + depotMinutes ; signaler aussi une préparation postérieure à ce délai.

[43] g3 manque_fonctionnel | ui/distributeur/02-accueil.html | majAFaire, majKpi ; 03 panneau encours
  Un commerce dont l'encours atteint le plafond, qui a un document à relire ou un mandat absent disparaît de la carte de Mes bons (pointsBons ne garde que ceux qui peuvent vendre) sans qu'aucun écran du commerce ne le lui dise ; le nomade, lui, est prévenu (« aucun client ne te voit »).
  corr: Ajouter à P.aFaire (sédentaire) la conséquence : « Tant que … ton commerce n'apparaît pas sur la carte de Mes bons ».

[44] g3 manque_fonctionnel | ui/assets/payencash-data.js | partenaireCloturer / partenaireSuspendre (comptes des collaborateurs)
  Clôturer un point ne clôt que le premier compte rattaché (le gérant) : les accès des collaborateurs restent actifs et se connectent sur un point clos.
  corr: À la clôture, appeler collaborateurRetirer pour chaque D.collaborateurs('point', id) non clos.


######## nomade — Le distributeur nomade (36 confirmés, 9 oublis, 0 réfutés)

[0] g1 casse | ui/manager/29-partenaires.html | Panneau « Rencontres — commissionnaires nomades », KPI SERVIES (#rc-k-srv-s)
  `somme` n'existe ni dans l'IIFE des rencontres ni ailleurs dans la page. Dès qu'une rencontre est servie, rendreRdv lève une ReferenceError AVANT d'écrire #rc-rows. Le tableau ne se peint plus, le manager ne peut plus annuler aucune rencontre, et l'erreur revient à chaque événement pec-bus. Défaut introduit par 8e549ff.
  corr: Remplacer l'appel par `var tSrv = Math.round(srv.reduce(function (a, r) { return a + (+r.montant || 0); }, 0) * 100) / 100;` puis `D.eur(tSrv)`, sur le modèle de `sa` quatre lignes plus haut. Ajouter au banc un scénario manager 29 avec une rencontre servie ET une rencontre 'acceptee', qui vérifie que #rc-rows a 2 lignes et que [data-rc-ann] est présent sur la rencontre vivante.

[1] g1 manque_fonctionnel | ui/manager/45-marchand-paiements.html | Table « Commissionnaires nomades — avances » : aucun geste pour la garantie
  Aucun écran ne permet de constater la garantie : avanceGarantieVerser n'est appelée que par le banc et le jeu de démo. Avec le réglage par défaut (200 €), aucun distributeur nomade ne peut vendre en production. Si le manager passe le virement de garantie par « Constater », il le crédite comme AVANCE et la vente reste fermée. Le nomade reçoit la même référence de virement pour la garantie et pour l'avance, donc le manager ne peut pas les distinguer. Le texte vide de 45 promet pourtant « son avance naît à sa première garantie », et le fil annonce « c'est elle qui ouvre ta vente ».
  corr: Ajouter en 45, sur la ligne d'un nomade dont `!et.garantieVersee`, un bouton « Constater la garantie » : montant pré-rempli à garantieDue − garantie, référence du virement obligatoire. Faire exiger `o.reference` (au moins 3 caractères) par avanceGarantieVerser. Dériver au data-layer deux références distinctes (avanceReference(id,'garantie') = r.id+'-GAR' ; 'avance' = r.id), les afficher dans 07-mon-point (#avance), et faire refuser par avanceRecharger une référence de garantie. Réécrire le fil : « Verse ta garantie… : avec une première avance, elle ouvre ta vente ».

[2] g1 impasse | ui/distributeur/07-mon-point.html | #mp-avance-etat, ligne « Virer »
  Le nomade doit virer sa garantie et son avance, mais l'écran lui montre l'IBAN de PayEnCash MASQUÉ (« FR76 •••• •••• •••• 123 »), sans titulaire. Avec le réglage par défaut (iban ''), il ne voit que « Crédit Mutuel ». Il ne peut faire aucun virement. Tous les liens « Verser une avance › » (03-vendre), « comment » (05-releves) et « À faire » mènent à cette impasse.
  corr: Afficher l'IBAN complet, le BIC et le titulaire (D.ref.societe.nom), avec un bouton « Copier » : ce sont les coordonnées du bénéficiaire, pas un secret. Si Pm.iban est vide, afficher « Coordonnées de virement pas encore publiées : n'effectue aucun virement » et fermer l'étape. Pousser aussi « IBAN du compte de réception à saisir » dans le fil du manager (10-configuration).

[3] g1 promesse_sans_logique | ui/assets/payencash-data.js | AVANCE_TYPES / avanceGarantieRestituer / manager 45
  Le contrat promet de restituer le solde d'avance non imputé à la fin du contrat, avec la garantie, sur décompte écrit. Rien ne l'implémente : aucun type de mouvement, aucune fonction, aucun geste manager, aucun décompte. partenaireCloturer n'écrit rien sur l'avance. L'argent déjà payé d'avance par le nomade reste bloqué chez PayEnCash.
  corr: Ajouter avanceSoldeRestituer(type, id, o) : type 'restitution_avance', montant −solde, référence du virement retour obligatoire, refus tant que le point n'est pas 'clos'. Ajouter en 45 « Restituer le solde », avec l'IBAN du RIB déposé au coffre, pièce 'rib'. Créer un modèle 'decompte_avance' au coffre (portée partenaire), lisible dans 05-releves et dans le manager 29. À la clôture, faire pousser par filPro côté manager « Restitution due avant le <closAt + restitutionJours> ».

[4] g1 casse | ui/assets/payencash-data.js | avanceRecharger (référence du virement)
  La référence du virement n'est ni vérifiée ni unique. Le même virement peut être constaté deux fois, ou sur un autre nomade, sans aucun refus. L'avance créditée à tort laisse vendre des bons que PayEnCash paie ensuite à la marque sans avoir reçu les fonds.
  corr: Refuser une référence déjà utilisée par un mouvement 'recharge' ou 'garantie', tous acteurs confondus : `avanceMouvementsGet().some(function (m) { return (m.type === 'recharge' || m.type === 'garantie') && String(m.source).toUpperCase() === ref.toUpperCase(); })`. Ne pas REFUSER une référence qui ne contient pas r.id (un libellé bancaire est souvent tronqué ou mal saisi par le client) : dans ce cas, exiger un `o.motifRapprochement` d'au moins 10 caractères, journalisé. Afficher en 45 le dernier virement constaté et sa référence sur chaque ligne.

[5] g1 incoherence | ui/assets/payencash-data.js | avanceSolde.garantieVersee lu sur le réglage VIF
  Si le manager relève la garantie dans Configuration, garantieVersee devient faux pour TOUS les nomades déjà en règle. La vente se ferme, la disponibilité est refusée, les nomades disparaissent de la carte, et rien ne permet de verser le complément (constat précédent). Le contrat promet pourtant un préavis d'un mois sur la garantie. Le motif affiché réclame le montant entier (« Verse ta garantie de 300 € ») au lieu du complément. Inversement, un réglage à 0 affiche « aucune garantie demandée » alors que 200 € sont détenus.
  corr: Lire la garantie exigible sur le contrat signé du point : `PEC_DOCS.get('partenaire', pointId, 'contrat').conditions.garantie.v`. Les conditions sont stockées en {l, v}. Utiliser le réglage vif seulement pour un contrat sans relevé. Appliquer un nouveau montant à l'avenant signé, après sa date d'effet (+ préavisMois). Traiter rechargeMin et rechargeMax de la même façon. Dans les motifs et le fil, dire le complément (garantieDue − garantie). Dans 07, afficher la garantie détenue quel que soit le réglage.

[6] g1 promesse_sans_logique | ui/assets/payencash-docs.js | Article 6.8 et modèle facture_commission_bons
  Le contrat signé charge PayEnCash d'établir les autofactures de la commission du nomade et de les mettre à disposition dans l'application (art. 289 I-2 CGI), et 07 lui dit que cette commission est tout son chiffre d'affaires. Aucune autofacture n'est jamais produite. Le seul modèle est du code mort d'un pivot abandonné : « Relevé mensuel du Bon d’achat PayEnCash », « sa carte n'est prélevée que du solde ».
  corr: Créer techAutofacture(revendeurId, mois), avec le nomade et le sédentaire dans la même porte : somme des partPoint des ventes vives du mois, TVA selon le régime déclaré (franchise art. 293 B ou assujetti), mention « Autofacturation », numérotation continue. Écrire un modèle 'autofacture_distributeur' rangé au coffre (portée partenaire, clé autofacture-<mois>). Proposer « Ouvrir » mois par mois dans 05-releves et dans la fiche du manager 29. Supprimer facture_commission_bons.

[7] g1 promesse_sans_logique | index.html (vitrine) | Bloc |05| « La promotion » — carte « Le réseau nomade »
  La vitrine promet aux marques que les nomades animent leurs réseaux sociaux : « Des flyers à votre marque et l’animation de leurs réseaux sociaux : ils partagent vos visuels et vos vidéos, avec le lien qui mène à votre bon ». Rien ne le permet. L'app partenaire n'a ni kit de partage, ni visuels de marque, ni flyer, ni lien attribué au nomade, et aucun geste n'est journalisé. Le contrat (6.6) dit pourtant que le nomade est « autorisé, non obligé » à faire état du réseau et ne reçoit « aucun ordre ni directive » : la promesse ne peut pas être tenue sans contredire l'indépendance. La même vitrine (l.308) écrit que les nomades vendent « au comptoir ».
  corr: Deux options. Soit construire l'outil : dans l'app partenaire, un « Kit de partage » par marque (visuels des articles publiés dans l’espace marchand, lien de vente attribué au distributeur, flyer PDF généré au coffre), facultatif et journalisé ; la vitrine dit alors « peuvent partager ». Soit réécrire la carte : « Des distributeurs indépendants qui se déplacent jusqu’au client » et rien de plus. Corriger aussi la l.308 : « … les vendent au comptoir ou jusqu’au client ».

[8] g1 manque_fonctionnel | documents/politique-confidentialite-partenaire.html ; documents/cgu-espace-partenaire.html | Tableau des traitements (art. 13/14) et art. 6.1 des CGU
  La politique de confidentialité, annexe 5 du contrat, et les CGU partenaire ne mentionnent ni la position en direct du nomade pendant un rendez-vous (publierPosition, lue par le client, et par le manager via techRencontreEta), ni la position exacte de son point de départ (depart.geo), ni sa disponibilité, ni les notes et commentaires que les clients laissent sur lui. Ces notes sont affichées publiquement avant tout choix, ce qui constitue une évaluation d'une personne physique. Traiter la localisation en temps réel d'un indépendant sans l'en informer contrevient aux art. 13 et 14 du RGPD.
  corr: Ajouter à la politique partenaire, puis faire relire, une ligne « Position partagée pendant un rendez-vous validé (sur ton geste « Je pars ») : lue par le client et par PayEnCash, conservée positionTtlMin minutes au plus, effacée à la fermeture ». Ajouter aussi le « Point de départ (ville ou position exacte si tu la donnes) », la « Disponibilité (allumée/éteinte, horodatée) » et les « Notes et commentaires des clients : affichés aux clients, conservés N mois, contestables auprès de PayEnCash ». Monter la version pour redemander la lecture. Même ajout dans l'art. 6.1 des CGU partenaire.

[9] g2 contourne | ui/manager/45-marchand-paiements.html | Bouton « Restituer la garantie » (data-av-rest)
  Le bouton s'affiche pour tout nomade qui a une garantie, même actif. Le motif est écrit en dur par l'écran, ce qui contourne la règle du data-layer (« Une restitution se motive : fin de contrat, retrait du réseau… »). Rien ne vérifie la fin du contrat ni le délai restitutionJours, et aucun décompte écrit n'est produit. Restituer la garantie d'un nomade actif ferme sa vente, sans geste pour la reverser. Le manager ne voit pas non plus les mouvements du nomade pour établir le décompte.
  corr: N'afficher le bouton que pour un point 'clos'. Exiger un motif saisi et la référence du virement retour. Faire refuser par avanceGarantieRestituer tant que `partenaire(r.partenaireId).statut !== 'clos'`. Afficher l'IBAN du RIB contrôlé du nomade et l'échéance closAt + restitutionJours. Déplier la ligne sur avanceMouvements('revendeur', id).

[10] g2 impasse | ui/assets/payencash-data.js | avanceRecharger au-delà de rechargeMax
  Le référentiel dit qu'au-delà de rechargeMax « le manager tranche au cas par cas ». La fonction refuse pourtant tout montant supérieur, y compris pour le manager, à qui elle répond « contacte-nous ». Un virement de 3 500 € bien reçu ne peut être constaté ni en une fois, ni en deux (une seule référence de virement).
  corr: Ajouter au data-layer un geste avanceVirementRenvoyer(type, id, montant, {reference, motif}), journalisé, pour renvoyer un virement hors bornes, ou bien constater jusqu'à rechargeMax et inscrire l'excédent comme trop-perçu à renvoyer. Au choix de la fondatrice, prévoir aussi une option `o.depassementMotif` (vigilance LCB-FT, au moins 10 caractères, journalisée 'avance_depassement'), ce qui impose d'amender l'art. 6.3. Aligner le commentaire du référentiel. Dans 07, écrire « chaque virement entre X et Y ; au-delà, préviens PayEnCash avant de virer ».

[11] g2 promesse_sans_logique | ui/manager/10-configuration.html | Bloc « Commissionnaires nomades — l'avance » : aucun réglage tech.nomade.*
  Le référentiel annonce que « tout se règle en Configuration (tech.nomade.*) », et le data-layer lit bien param('tech.nomade.*'). Mais aucun champ n'existe pour rayonMaxKm, paliersKm, reponseMin, dispoHeures, rdvMaxMin, creneauMin, positionTtlMin, vitesseMMin ou rayonArriveeM. tech.avance.restitutionJours n'est pas réglable non plus, alors que le contrat s'en sert trois fois.
  corr: Ajouter dans 10-configuration un bloc « Distributeurs nomades — déplacement et rendez-vous » : data-p="tech.nomade.<clé>" pour chaque réglage, et paliersKm en liste de nombres croissants inférieurs à rayonMaxKm, contrôlée à l'enregistrement. Faire lire paliersKm par nomadeRef via param. Ajouter tech.avance.restitutionJours au bloc avance. Signaler l'écart de contrat (conditionsEcart) pour ceux qui figurent au contrat.

[12] g2 obsolete | ui/distributeur/00-inscription.html | Étape ② « Où te déplaces-tu ? » (villes multiples, rayon 0–100 km) et liste finale
  L'inscription collecte encore l'ancienne « zone » : plusieurs villes et un rayon jusqu'à 100 km, alors que le réseau plafonne à 20 km. Elle promet que cette zone « te vaudra des demandes de rencontre » et qu'elle se change « depuis Mon point ». C'est faux : les demandes viennent de nomadesAutour, qui ne lit que le départ et les paliers, et Mon point n'offre plus cette zone. En attendant le départ, 07 et 02 affichent la zone d'inscription (« … (jusqu'à 60 km) »), et le contrat l'écrit comme « zone déclarée ». La liste « Ce qui suit » oublie l'étape départ, prix et disponibilité, sans laquelle aucun client ne le voit.
  corr: Remplacer l'étape par « Ta ville de départ » : un seul select sur zoneVillesRef(), sans rayon, repris tel quel comme depart.ville par partenaireDeplacement tant que le nomade ne l'a pas changé. Retirer zoneVilles et zoneRayonKm du profil, de partenaireActiviteSet et de compteValider. Faire tomber partenaireZoneLbl à « départ à poser ». Ajouter à la liste finale « Pose tes prix de déplacement dans Mon point, puis allume ta disponibilité sur l’accueil ». Dans le contrat, écrire « départ : <ville> » ou rien.

[13] g2 manque_fonctionnel | ui/assets/payencash-data.js | techRencontreValider et nomadesAutour : l'avance n'est pas réservée
  La validation d'un rendez-vous contrôle le solde COURANT sans déduire les rendez-vous déjà validés. Avec 100 € d'avance, deux demandes de 90 € sont validées ; la seconde échoue à la caisse APRÈS le déplacement et le scan (« Avance insuffisante »). Le commentaire « il ne se déplace pas pour un refus » est donc faux. Aucun motif d'incident ne correspond : le client lit « annulée sur place » ou « ne peut plus s'y rendre ».
  corr: Ajouter avanceEngagee(revendeurId) : somme des prix réseau (techRepartition(montant, mode de la marque).prixPoint) des rencontres 'acceptee' non servies. _avanceControle reçoit un paramètre `engage` et compare (solde − engagé) pour techRencontreValider et nomadesAutour. Afficher à la validation « il te restera X € d’avance ». Ajouter un incident {cle:'avance', quand:'rdv', motif:'la personne choisie ne peut pas émettre ce bon pour l’instant, rien n’a été payé'}.

[14] g2 impasse | ui/assets/payencash-data.js | _techRencontreVive / techRencontreAnnuler
  Un rendez-vous dont le flashcode a été reconnu n'expire jamais. Le client ne peut pas l'annuler (« c'est elle qui clôt la rencontre »), et la règle « une demande à la fois » l'empêche de choisir quelqu'un d'autre. Si le nomade repart sans émettre ni fermer, le client est bloqué indéfiniment. Seul le manager peut le débloquer, et son panneau plante (constat 29). Les expirations dérivées ne sont jamais écrites : téléphone, adresse et position restent stockés.
  corr: Donner une échéance à la remise vérifiée (verifieeTs + rdvMaxMin) qui passe la rencontre en 'annulee', motif « remise non conclue — rien n’a été payé ». Écrire toute fermeture dérivée à la première lecture qui la constate : statut, effacement de tel, prénom, adresse, aide et note, oublierPosition. Signaler ces cas au manager (29) et à la hotline.

[15] g2 incoherence | ui/assets/payencash-data.js | partenaireSuspendre / partenaireCloturer
  Suspendre ou clôturer un nomade ne ferme pas ses demandes ni ses rendez-vous en cours, et ne remet pas disponibleDepuis à zéro. Le client continue de lire « X va t’appeler » ou « X est en route », alors que le nomade ne peut plus se connecter (compte suspendu ou clos) ni vendre (garde de 03-vendre).
  corr: Dans partenaireSuspendre, partenaireCloturer (et partenaireRefuser par symétrie), annuler les rencontres 'demandee' et 'acceptee' non servies du revendeur par techRencontreAnnuler(id, 'la personne choisie ne peut plus vendre pour l’instant', par), puis écrire `disponibleDepuis: null`. Dans partenaireReactiver, ne jamais rallumer la disponibilité.

[16] g2 promesse_sans_logique | ui/distributeur/02-accueil.html | Interrupteur #pb-dispo-s
  L'interrupteur n'interroge que partenaireDisponible et affirme « Les clients de ton secteur te voient sur la carte ». Or nomadesAutour et nomadesDisponibles le cachent dès que l'avance est épuisée ou le point suspendu, et le cachent aussi pour tout montant que son avance ne couvre pas. Le nomade croit être visible alors qu'il ne l'est pas.
  corr: Dériver au data-layer partenaireVisibilite(p) → {visible, pourquoi, montantMax} (disponibilité, vente ouverte, bon le plus élevé couvert par l'avance). Afficher sous l'interrupteur « Allumé mais invisible : ton avance est épuisée — verse une avance » ou « visible pour des bons jusqu’à X € ».

[17] g2 manque_fonctionnel | ui/distributeur/02-accueil.html, ui/distributeur/07-mon-point.html, ui/manager/29-partenaires.html | Aucun affichage de distributeurNote côté pro
  Les clients notent le nomade et lisent sa note avant de le choisir, mais le nomade ne la voit nulle part, et le manager non plus. Le commentaire stocké n'est jamais montré. Personne ne peut contester ni modérer une note qui pèse pourtant sur son choix par les clients.
  corr: Afficher « Ma note : ★ x,x · n avis » avec les derniers commentaires dans 02-accueil (carte Rencontres) et dans 07-mon-point. Ajouter une colonne note / avis par nomade dans le manager 29. Pousser un élément « Nouvelle note reçue » dans le fil (filPro).

[18] g2 promesse_sans_logique | ui/assets/payencash-data.js (filPro) ; ui/manager/29-partenaires.html | Motif d'annulation manager « le nomade le lira »
  Le manager doit saisir un motif « que l’utilisateur et le nomade liront », mais le nomade ne le lit jamais. La rencontre disparaît de 02-accueil, et son fil ne dit que « Demande fermée. ». La notification dédiée n'existe que si c'est le client qui annule. Même silence quand la rencontre se ferme parce que le bon proposé est fermé.
  corr: Dans filPro, pousser pour toute annulation dont le nomade n'est pas l'auteur un élément « Rendez-vous annulé — <motifAnnulation> » (par le client, par PayEnCash, ou proposition fermée), urgent si le rendez-vous était validé. Remplacer le texte d'état 'annulee' par le motif réel.

[19] g2 manque_fonctionnel | ui/hotline/01-pilotage.html | Aucune vue des rencontres
  La hotline ne voit ni les mises en relation, ni leur étape, ni les incidents, ni les remises bloquées. Le data-layer dit pourtant au nomade que « ton client peut demander un rappel à PayEnCash » quand la remise est bloquée, et le code présente le motif d'incident comme « lu par la hotline ». L'hôte qui rappelle ne peut rien consulter ni débloquer.
  corr: Ajouter à 01-pilotage une recherche « Rencontre » (référence TRV-, téléphone, nomade) qui lit techRencontre et techRencontreSuivi (étape, incidents, essais de remise, motif), avec le geste « Annuler, motivé », identique à celui du manager (techRencontreAnnuler).

[20] g2 vocabulaire | ui/assets/payencash-data.js ; ui/distributeur/05-releves.html ; ui/manager/45-marchand-paiements.html ; ui/manager/30-carte-operations.html ; ui/distributeur/00-inscription.html | Vocabulaire « achat / acheter » appliqué au nomade
  La relecture juridique du 24/09 pose que le nomade n'ACHÈTE pas le bon : il le vend pour le compte de PayEnCash et paie d'avance. Plusieurs écrans disent pourtant le contraire : le motif de chaque débit d'avance (« Achat d'un bon … », visible dans Mes relevés), le total « de bons achetés à PayEnCash Marchand », le manager 45 (« Ils achètent leurs bons d’avance »), la carte 30 (« BONS ACHETÉS AU RÉSEAU »), l'inscription (« paie ses bons »). Le type « Remboursement » contredit aussi la règle « jamais te rembourse ».
  corr: Motif du débit : « Bon <marque> de <montant> édité — imputé sur ton paiement anticipé ». Dans 05-releves:282 pour le nomade : « … de prix réseau imputés sur ton avance ». 45 : « Ils paient d’avance la valeur des bons qu’ils revendent ». 30 : « BONS VENDUS » et, pour un nomade, « imputés sur son avance » au lieu de « il nous doit ». Inscription : « paie d’avance la valeur des bons qu’il revend ». AVANCE_TYPES.remboursement : « Vente annulée — prix réseau ré-imputé à ton avance ».

[21] g2 obsolete | ui/assets/payencash-data.js | compteConnecter : refus d'un compte clos
  Un nomade clos lit à la connexion « tes bulletins restent disponibles » : c'est un reste de l'agent salarié (bulletins de paie). Surtout, il ne peut plus rien consulter : ni ses relevés d'avance, ni le décompte de restitution, ni la notification « Contrat résilié », dont le lien mène à 07-mon-point.
  corr: Remplacer par « Contrat terminé — accès fermé. Ton décompte de fin de contrat et tes relevés te sont envoyés par e-mail ; la hotline te les renvoie sur demande ». Mieux : ouvrir au compte clos un accès en lecture seule (05-releves, décompte, contrat, fil) pendant restitutionJours et la durée de conservation.

[22] g2 code_en_dur | ui/assets/payencash-data.js | partenaireDeplacementSet : plafond de 1 000 € par palier
  Le data-layer impose un plafond de 1 000 € écrit en dur, alors que l'écran et le contrat affirment que PayEnCash ne pose « ni plancher, ni plafond, ni tarif conseillé ». Ce tarif libre est aussi l'argument qui écarte la subordination du commissionnaire.
  corr: Retirer la borne. Si un garde-fou de saisie est voulu, le lire dans ref.tech.nomade.tarifSaisieMax (réglable) et le présenter dans le contrat et dans Mon point comme une limite technique de saisie, pas comme un plafond tarifaire.

[23] g2 contourne | ui/assets/payencash-data.js ; ui/distributeur/11-remise.html | remise.code en clair dans les lectures de l'app partenaire
  Le code qui doit prouver que le bon est remis à la bonne personne est écrit en clair sur la rencontre, et l'app du nomade lit cet enregistrement complet (techRencontre, techRencontresRevendeur). Le nomade peut donc « vérifier » sans le client, et la preuve ne prouve rien.
  corr: Filtrer les lectures côté pro (_techRencontrePourPro qui retire remise.code et ne garde que essais et verifieeTs). Stocker un hachage du code (techRencontreFlashcode le recalcule pour le seul écran client) et comparer ce hachage dans techRencontreRemiseVerifier.

[24] g2 manque_fonctionnel | ui/assets/payencash-data.js ; ui/distributeur/04-titres.html | techBonAnnuler sur un bon remis à un rendez-vous
  Pendant annulationMinutes, le nomade peut annuler à distance, depuis Bons vendus, le bon qu'il vient de remettre à un rendez-vous. Le bon est annulé et son avance recréditée, mais la rencontre reste « Servie — bon d’achat remis ». Rien n'oblige ni ne trace le remboursement du client, qui a payé en espèces le bon et le déplacement.
  corr: Refuser techBonAnnuler pour un bon rattaché à une rencontre servie, sauf avec la preuve de présence du client (nouveau scan de son flashcode) ou à sa demande depuis Mes bons. Si l'annulation passe, écrire sur la rencontre 'annulee', motif « vente annulée — <nomade> te rembourse <total> », visible dans 09 et 01 #achat.

[25] g2 manque_fonctionnel | documents/cgu-mes-bons.html | Préambule et article 6 — Données personnelles
  Les CGU de Mes bons ignorent l'achat auprès d'un distributeur nomade : le bon y est « acheté au comptoir d'un commerce de ce réseau, ou reçu en cadeau ». L'article 6 ne liste pas les données que l'app transmet au nomade choisi (téléphone, canal WhatsApp, prénom, adresse ou position, consignes d'accès, règlement annoncé et billets déclarés), ni le suivi de sa position, ni la note que l'utilisateur laisse. Le texte d'accord coché à la demande couvre l'appel, pas le reste.
  corr: Ajouter un article « Acheter auprès d’un distributeur nomade » : il est choisi par l'utilisateur, fixe librement son tarif de déplacement, vend pour le compte de PayEnCash (vendeurStatutHTML), et le rendez-vous se valide par son appel. Compléter l'article 6 avec les données transmises au seul distributeur choisi, leur durée (effacées à la fermeture) et la note publiée. Monter la version de cgu-mes-bons.

[26] g2 incoherence | ui/distributeur/02-accueil.html ; ui/distributeur/03-vendre.html ; documents/cgu-espace-partenaire.html | Bloc « Ton rôle » (02) ; #v-cadre (03) ; CGU 5.1
  Pour le nomade, 02-accueil dit « c’est ta vente … Tu n’encaisses jamais pour notre compte », 03-vendre dit « c’est ta vente » et la CGU partenaire 5.1 dit « cette vente est celle du partenaire ». À l'inverse, 09-marques, le glossaire (vendeurStatutHTML) et le contrat 6.1 disent qu'il vend « en son nom, pour le compte de PayEnCash, en commissionnaire ». Sur la qualification juridique du réseau, deux écrans d'une même app disent le contraire.
  corr: Faire lire à ces écrans une phrase unique du data-layer, par exemple D.roleVendeurTxt(mode). Pour le nomade : « Tu vends en ton nom, pour le compte de <nom>, en commissionnaire ; ton client te règle par le moyen de ton choix ». Réserver « c’est ta vente » et « tu n’encaisses jamais pour notre compte » au commerce sédentaire. Aligner la CGU 5.1 par mode et faire relire.

[27] g2 manque_fonctionnel | ui/manager/29-partenaires.html ; ui/manager/30-carte-operations.html ; ui/hotline/01-pilotage.html | Fiche nomade, tableau des rencontres, détail de carte
  Ni le manager ni la hotline ne voient le point de départ du nomade, sa grille de prix par palier, sa carte bancaire déclarée ou sa disponibilité, ni, sur chaque rencontre, le tarif et le palier que le client a acceptés (r.tarif, r.palier, r.km). Si un client conteste le prix demandé sur place, personne ne peut vérifier ce qui était affiché. Le journal 'distributeur_tarif' est écrit, mais aucun écran ne le relit pour un nomade.
  corr: Dans la fiche nomade de 29 et le détail de 30 : départ (D.partenaireDeplacement(p).depart.ville), D.partenaireTarifLbl(p), « encaisse aussi par carte », état de disponibilité et échéance (partenaireDisponibleJusqua), dernier changement de tarif (journal distributeur_tarif). Dans le tableau des rencontres, ajouter une colonne « Déplacement » (tarif, palier, km) et le total annoncé. Même lecture dans la vue « Rencontre » de la hotline (voir [17]).

[28] g2 manque_fonctionnel | ui/assets/payencash-data.js | techRencontreServir / techRencontreAnnuler (patch de fermeture) ; techRencontresRevendeur
  Même quand la fermeture est ÉCRITE (servie, annulée), seul le téléphone s'efface. Le prénom, l'adresse complète (numéro, voie, étage, porte, instructions), la position du client, les consignes d'accès, la note et le texte du consentement restent pour toujours dans pec-tech-rencontres. Ils restent lisibles par l'app du nomade via techRencontresRevendeur, qui renvoie l'enregistrement entier, et par le manager. Or la CGU et la politique partenaire promettent que le distributeur « n'utilise l'adresse d'une rencontre que pour cette rencontre et ne la conserve pas », et le schéma dit « ne servent qu'à ce rendez-vous ».
  corr: À toute fermeture, écrite ou dérivée (voir [12]) : effacer prenom, adresse (sauf ville et cp, utiles à la statistique), geo, aide, note et lieu, puis PEC_BUS.oublierPosition. Garder ce que la preuve exige (référence, marque, montant, tarif, palier, horodatages, consentement horodaté conservé N mois selon la politique). Côté pro, filtrer les lectures (_techRencontrePourPro) : un nomade ne relit jamais l'adresse d'une rencontre fermée.

[29] g3 obsolete | ui/manager/29-partenaires.html ; ui/manager/30-carte-operations.html | Textes du panneau Rencontres et du détail de carte
  Les textes décrivent encore l'ancien modèle (demande diffusée, pas de suivi) : « Un nomade de marque ne partage pas sa position », « qui l'a pris », KPI « PRISES » et « SANS PRENEUR », « un nomade est en route » pour un simple rendez-vous validé, « joignables / aucun sur la ville », « depuis la page d'un bon proposé » (la carte de Mes bons est oubliée). La 30 dit aussi « l'a prise » et « nomades joignables sur la ville ».
  corr: Réécrire selon le modèle dirigé : « choisi par le client », KPI « VALIDÉES / EN ROUTE (palier techRencontreSuivi) / SERVIES / FERMÉES SANS SUITE ». Supprimer joignables. Dire que la position est partagée pendant le rendez-vous. Mentionner la carte de Mes bons comme origine des demandes.

[30] g3 incoherence | ui/assets/payencash-data.js | RENCONTRE_STATUTS.expiree
  Le libellé « Expirée — sans appel dans le délai » s'applique aussi aux rendez-vous validés mais non tenus (echueApresValidation). Le manager lit donc « sans appel » pour un nomade qui a bien appelé, et le KPI « SANS PRENEUR … sans appel dans les 30 min » mélange les deux cas.
  corr: Faire lire à rencontreStatutLbl la rencontre elle-même (rencontreStatutLbl(st, r)), avec « Expirée — rendez-vous non tenu » quand echueApresValidation. Séparer les deux compteurs dans le manager 29.

[31] g3 vocabulaire | ui/manager/45-marchand-paiements.html, 29-partenaires.html, 10-configuration.html, 07-tresorerie.html, 27-journal-flux.html, 30-carte-operations.html | Titres « Commissionnaires nomades »
  Le glossaire unique impose « distributeur nomade » dans les apps pro : un écran lit terme() et n'écrit jamais son propre mot. Le back-office titre pourtant « Commissionnaire(s) nomade(s) » partout. Ce mot juridique est réservé aux contrats et à « Bon à savoir ».
  corr: Remplacer ces mentions par D.terme('nomade','pluriel',true) ou D.terme('nomade','nom',true). Ne garder « commissionnaire » que là où la qualification juridique est citée (contrat, 09-marques, Bon à savoir).

[32] g3 vocabulaire | ui/assets/payencash-data.js | Motifs d'avanceRecharger
  Le mot banni « recharge » apparaît dans les motifs que le manager lit en 45 : « La recharge minimum… », « la recharge se traite au cas par cas », « La recharge » dans le refus d'écriture.
  corr: Écrire « Le versement d’avance minimum est de … », « Au-delà de …, un versement d’avance se traite à part (voir [8]) », « Le versement d’avance » et « La ré-imputation de l’avance » dans _refusEcriture. Renommer aussi le libellé de journal avance_mouvement (« compte d'avance … recharge, achat, remboursement »).

[33] g3 manque_fonctionnel | ui/assets/payencash-data.js (filPro, MESSAGES_CATALOGUE) | Fil partenaire en mode mobile
  Le fil du nomade ne dit que « Garantie à verser » et « Avance épuisée / bientôt épuisée ». Il ne signale ni un virement constaté (le moment où il peut vendre), ni une garantie restituée, ni une note reçue, ni une disponibilité qui s'éteint. Le catalogue des messages ne prévoit aucun e-mail pour le nomade.
  corr: Dans filPro, pousser un élément par mouvement 'recharge'/'garantie'/'restitution' (« Ton virement de X € est arrivé : ton avance est à Y € »), par note reçue, et « Ta disponibilité s’est éteinte à HH:MM ». Ajouter au catalogue 'avance_mouvement' (e-mail, cible 'nomade') et 'point_clos' (e-mail avec décompte). Faire suivre le mode aux objets point_active/point_suspendu (« Ton compte de distributeur nomade est actif »).

[34] g3 vocabulaire | ui/assets/payencash-docs.js ; ui/distributeur/07-mon-point.html ; ui/distributeur/03-vendre.html ; ui/distributeur/11-remise.html ; ui/distributeur/02-accueil.html | Libellés du dossier, de la fiche et des refus
  Le nomade micro-entrepreneur, sans commerce ni adresse, lit des libellés de commerce : « Extrait Kbis … le gérant », « RIB du commerce — Au nom du commerce », « Téléphone du commerce », « Enseigne, adresse et SIRET viennent du Kbis », « connecte-toi avec l’identifiant de ton commerce », le placeholder de rappel « ex. mon mandat SEPA », « Annulation au comptoir ».
  corr: Faire suivre le mode à ces libellés (partenaireEstMobile et glossaire) : « Extrait d’immatriculation (Kbis ou RNE) », « titulaire », « RIB de ton activité », « ton téléphone professionnel », « l’identifiant de ton compte », un placeholder propre au mode, « Annulation d’une vente ».

[35] g3 design | ui/assets/payencash-partenaire.js ; ui/assets/logos/ | Logo du mode mobile (payencash-coursier-*)
  L'icône d'onglet et d'écran d'accueil du nomade représente un livreur en scooter avec une caisse de livraison, alors que le glossaire dit qu'un nomade n'est « jamais un coursier ». Cette imagerie de livraison contredit le positionnement de commissionnaire.
  corr: Produire un visuel propre au nomade (piéton ou sacoche, sans caisse de livraison), le nommer payencash-nomade-*.png et passer la clé à 'nomade' dans P.LOGOS et dans MARQUE_NOMS.

[36] g3 code_mort | ui/assets/payencash-data.js ; ui/assets/payencash-tech.js ; ui/titres/05-offre.html ; ui/assets/payencash-docs.js ; tests/jeu-demo.js | agentsMobiles, zoneCouvre, rencontresGet, commentaires périmés, facture_commission_bons, jeu de démo
  Plusieurs restes obsolètes demeurent. agentsMobiles et zoneCouvre (« agent », zone par villes, lecture de p.geo que le nomade n'a pas) servent encore à compter les nomades dans PEC_TECH.reseau (sans disponibilité ni départ) et dans 05-offre (sans le montant du bon). rencontresGet, rencontre, _rencontreVive et rencontreFenetreMin (pec-rencontres de Mode) ne sont appelés nulle part. Plusieurs commentaires sont faux : « débit sur SA carte », « reçoit le prix POUR SON PROPRE COMPTE », « pas de position partagée », « on ne demande pas une adresse de domicile ». Le jeu de démo passe encore `heure`, remplacé par rdvAt.
  corr: Faire lire nomadesDisponibles() par PEC_TECH.reseau (vitrine, 11-site), et nomadesAutour({pos, montant, marchandId}) par 05-offre quand la position est connue, sinon nomadesDisponibles filtré par techPeutVendre(montant). Supprimer ensuite agentsMobiles, zoneCouvre, rencontresGet, rencontre, _rencontreVive, rencontreFenetreMin et facture_commission_bons. Réécrire les commentaires selon le modèle commissionnaire (vendeurStatutHTML), suivi de position et adresse. Passer `rdvAt` (un créneau de techRencontreCreneaux) dans le jeu de démo.

[37] g3 manque_fonctionnel | ui/distributeur/02-accueil.html ; ui/assets/payencash-bus.js | arreterSuivi et fermeture dérivée
  Quand un rendez-vous se ferme par dérivation (non tenu, bon proposé fermé), 02-accueil coupe la géolocalisation sans effacer la dernière position publiée. Elle ne s'efface qu'à une lecture après péremption. La position d'un indépendant reste donc stockée, contrairement à la règle RGPD « une position par rendez-vous, effacée à la fermeture ».
  corr: Dans majRdv, appeler PEC_BUS.oublierPosition(id) quand la rencontre suivie n'est plus 'acceptee'. Écrire les fermetures dérivées (voir le constat sur la remise vérifiée) pour déclencher _techRencontreMaj → oublierPosition.

[38] g3 redondance | ui/titres/09-rencontre.html | Texte d'un rendez-vous expiré
  L'écran recopie la règle d'échéance au lieu de lire celle du data-layer. Il dit « pas tenu dans les 3 h » (rdvMaxMin / 60, arrondi), alors que le délai court depuis l'HEURE CONVENUE quand il y en a une (techRencontreEcheanceTxt). Le client, le fil du nomade et le data-layer ne disent donc pas la même chose.
  corr: Dans les deux écrans (09-rencontre:270 et 01-mes-titres:680), remplacer le texte par `'Rendez-vous validé mais pas tenu ' + D.techRencontreEcheanceTxt(r) + ' : il s’est fermé, rien n’a été payé.'`.

[39] g3 genre | ui/titres/09-rencontre.html ; ui/assets/payencash-data.js | « il vient te vendre ton bon » ; SMS « comme il l’a choisi »
  Ces deux textes supposent le genre de la personne, alors que le code s'impose « sans « il » : on ne suppose pas le genre de la personne choisie ».
  corr: « … sur la carte : la personne choisie vient te vendre ton bon, à son prix de déplacement. » et « contacte ton client par le canal choisi (appel ou WhatsApp) ».

[40] g3 incoherence | ui/manager/30-carte-operations.html ; ui/manager/29-partenaires.html | « se déplace à <ville> » et marqueur de ville
  Le manager place et nomme le nomade avec techRevendeur.ville, recopiée à l'inscription (première ville de l'ancienne zone). Elle n'est jamais mise à jour quand le nomade pose ou change sa ville de départ : la carte et la liste montrent une ville d'où il ne part pas.
  corr: Côté manager, lire la ville de départ par D.partenaireDeplacement(r.partenaireId).depart.ville (ou « départ à poser »), et jamais techRevendeur.ville pour un nomade. Ou faire écrire p.ville par partenaireDeplacementSet.

[41] g3 incoherence | ui/distributeur/05-releves.html | Calcul du mois (#rv-calc, #rv-calc-txt) en mode nomade
  Pour le nomade, 05-releves parle de « valeur faciale, prix conseillé au client » et de « tu as gardé X ». Or 03-vendre lui dit que la valeur faciale est « son prix de vente » (contrat, art. 3.3), et sa part est une commission. Deux écrans disent donc la même chose différemment.
  corr: Faire suivre le mode aux libellés : « valeur faciale — ton prix de vente » et « ta commission ce mois-ci : X sur Y vendus » pour le nomade ; garder « prix conseillé » et « gardé » pour le commerce.

[42] g3 obsolete | ui/assets/payencash-data.js (libellés du journal, lus par ui/manager/27-journal-flux.html) | tech_rencontre_acceptee, rencontre_*, distributeur_zone, avance_mouvement
  Le journal du manager nomme les faits de la rencontre et de l'avance avec les mots de l'ancien modèle ou des mots bannis. tech_rencontre_acceptee dit « Rencontre prise par un distributeur nomade ». Il reste les libellés des propositions de tarif abandonnées (rencontre_proposition, rencontre_proposition_retiree, rencontre_choisie) et des rencontres Mode (rencontre_demandee, acceptee « prise », servie, annulee). distributeur_zone dit « Zone de déplacement définie ». avance_mouvement parle d'un « compte d'avance » avec « recharge, achat, remboursement ».
  corr: Supprimer les libellés sans émetteur (rencontre_proposition*, rencontre_choisie, rencontre_demandee/acceptee/servie/annulee de Mode, distributeur_zone). tech_rencontre_acceptee devient « Rendez-vous validé par l’appel du distributeur nomade ». avance_mouvement devient « Mouvement de l’avance d’un distributeur nomade (garantie, versement, bon édité, vente annulée, restitution) ». L'acteur de 27 est lu par D.terme('nomade','nom',true).

[43] g3 contourne | ui/assets/payencash-bus.js | PEC_BUS.publierPosition
  La porte qui publie la position d'un rendez-vous vérifie qu'il est 'acceptee', mais pas que l'appelant (`par`) est le nomade de CE rendez-vous. Elle pose ensuite le départ au nom de r.revendeurId quel que soit l'appelant. N'importe quel écran ou compte peut donc faire « partir » un nomade et publier une fausse approche vue par le client. Les autres portes de la rencontre (techRencontreDepart, techRencontreArrivee, techRencontreRemiseVerifier) contrôlent pourtant `r.revendeurId !== revendeurId`.
  corr: Refuser quand `par !== r.revendeurId` (« Cette rencontre est adressée à un autre distributeur nomade »), et appeler techRencontreDepart(rdvId, par).

[44] g3 impasse | ui/assets/payencash-data.js ; ui/distributeur/03-vendre.html | techRencontreServir (origine 'lien') et verrou de montant de la caisse
  Pour une rencontre née d'un bon proposé, techRencontreServir émet au montant figé à la demande (r.montant = x.restant de l'époque) et ignore le montant saisi. Si le reste de la proposition a baissé entre-temps (autre bon posé en partie par le client), techBonEmettre refuse avec « Ce bon proposé n’attend plus que X : c’est le montant à vendre ». Mais la caisse, verrouillée sur r.montant, ne peut pas vendre X. Le nomade, sur place, ne peut que fermer la rencontre par un incident.
  corr: Pour l'origine 'lien', lire le montant à vendre au moment de servir (techOrdreVente(slug).montant), l'afficher dans la caisse et l'écrire sur la rencontre (patchS.montant). Dans 09-rencontre et le fil du nomade, dire que le montant a changé depuis la demande.


######## manager — Le back-office manager (55 confirmés, 0 oublis, 0 réfutés)

[0] g1 casse | ui/manager/29-partenaires.html | KPI « SERVIES » et tableau des rencontres (rendreRdv)
  La fonction somme() n'existe pas dans le script des rencontres : dès qu'une rencontre est « servie », rendreRdv lève une ReferenceError avant de peindre le tableau. Le manager ne voit plus aucune rencontre et perd le bouton « Annuler ».
  corr: Remplacer par une somme locale : `var tSrv = srv.reduce(function (t, r) { return t + (+r.montant || 0); }, 0); … D.eur(Math.round(tSrv * 100) / 100)`. Ajouter au banc un scénario avec une rencontre servie et le manager 29 ouvert.

[1] g1 manque_fonctionnel | ui/manager/45-marchand-paiements.html | Table « Commissionnaires nomades — avances » : aucun geste pour la garantie
  La garantie d'un nomade ne peut être constatée par aucun écran. avanceGarantieVerser n'est appelée que par le banc. Avec la garantie par défaut de 200 €, _avanceControle refuse toute vente : un distributeur nomade réel ne peut jamais vendre. Pourtant l'app partenaire lui annonce que « nous constatons » sa garantie.
  corr: Dans 45, ajouter sur chaque ligne où la garantie n'est pas versée un geste « Constater la garantie » (montant attendu, référence du virement obligatoire), qui appelle `D.avanceGarantieVerser('revendeur', id, { reference, par: acteur(), acteur })`. Faire exiger la référence par avanceGarantieVerser, comme par avanceRecharger. Ajouter l'alerte « garantie à constater » dans 20.

[2] g1 manque_fonctionnel | ui/manager/45-marchand-paiements.html | Bouton « Virer » et RIB de la marque (techMarchandRib)
  Le virement part vers le RIB que la marque a tapé elle-même, sans contrôle. Ce RIB passe devant le RIB relevé au coffre, et aucun statut « à contrôler » n'existe. Un changement d'IBAN, par la marque ou par quelqu'un qui a pris son compte, détourne le virement suivant. En 46, le manager ne voit qu'un IBAN masqué.
  corr: Un RIB saisi ou modifié passe au statut `a_controler` et exige la pièce RIB au coffre avec un titulaire égal à la raison sociale. techReglementEmettre refuse un RIB non contrôlé. Ajouter en 46 le geste « RIB contrôlé » (journalisé), l'alerte 20 « IBAN modifié » et, en 45, l'origine et la date du RIB.

[3] g1 promesse_sans_logique | ui/manager/17-comptes-manager.html (et 10, 40, 19, 45, 29, 46) | Droits des rôles ROLES_MANAGER
  Les droits des rôles sont affichés (« Opérateur — ni configuration, ni comptes ») mais aucun écran ne les applique, sauf l'effacement RGPD. Un opérateur peut changer les taux, suspendre la direction, inviter un compte Direction, payer les marques et valider des marques. L'écran 19 dit pourtant qu'il est « impossible de s'attribuer un rôle supérieur ».
  corr: Donner aux rôles des droits structurés (config, comptes, argent, validation) et créer `PEC_MGR.peut(droit)` dans manager-nav : page en lecture seule avec bandeau et boutons désactivés. Vérifier aussi le droit dans les setters sensibles (parametreSet, compteSuspendre sur un compte manager, compteCreer manager/hotline avec un rôle au plus égal à celui de l'invitant, techReglementEmettre).

[4] g1 contourne | ui/manager/01-connexion.html | Bouton « Activer mon compte » affiché après une connexion refusée
  Il suffit de taper l'identifiant (l'e-mail) d'un compte invité, avec n'importe quel mot de passe, pour obtenir le lien d'activation et choisir soi-même le mot de passe. Cela permet de prendre un accès au back-office, jusqu'au rôle Direction. Les ids d'invitation sont en plus séquentiels (cpt-manager-001…). Les écrans 17 et 19 promettent le contraire.
  corr: Supprimer ce bouton. L'activation exige un jeton aléatoire distinct de l'id du compte, stocké haché et remis à l'invité (e-mail, ou affiché au seul invitant en démo). compteActiverInvitation vérifie ce jeton.

[5] g2 promesse_sans_logique | ui/manager/10-configuration.html | Règles des bons de marque (bonsRef / ref.bons)
  Les règles d'argent des bons de marque (validité 12 mois, 5 € minimum, 250 € par bon, 1 000 €/jour et 3 000 €/mois par client) viennent encore du référentiel obsolète « Bon d’achat PayEnCash ». Le data-layer affirme que « le manager les ajuste dans Configuration (bons d’achat.*) », mais l'écran 10 n'a aucun champ bons.*. Il dit même que le Bon d'achat PayEnCash est « parti ».
  corr: Déplacer ces règles sous ref.tech.bons, lues par techRef().bons (paramètres tech.bons.*). Ajouter à 10 un panneau « Règles des bons de marque » (validité, minimum, plafond par bon, plafonds client jour/mois, fenêtre). Supprimer ref.bons.nom, psp et commissionPct, puis bonsRef.

[6] g2 promesse_sans_logique | ui/manager/10-configuration.html | Réglages des distributeurs nomades et de la carte
  Le référentiel annonce que le déplacement des nomades « se règle en Configuration (tech.nomade.*) » : rayon, délai d'appel, disponibilité, rendez-vous, créneaux, vitesse, rayon d'arrivée, durée de vie de la position. nomadeRef lit bien tech.nomade.*, mais 10 n'offre aucun de ces champs. Il en va de même pour carte.rayonsM et carte.rayonDefautM.
  corr: Ajouter à 10 un panneau « Distributeurs nomades » (rayonMaxKm, reponseMin, dispoHeures, rdvMaxMin, creneauMin, vitesseMMin, rayonArriveeM, positionTtlMin) et un panneau « Carte ». Sinon, retirer les promesses du référentiel.

[7] g2 manque_fonctionnel | ui/manager/10-configuration.html | Offres : remise et part du commerce
  Une part du commerce supérieure à la remise de la marque est enregistrée et appliquée aux ventes suivantes (marge négative). L'écran ne l'affiche en rouge qu'après l'enregistrement : une faute de frappe (30 au lieu de 3) fait perdre de l'argent sur chaque vente.
  corr: Dans le handler « Enregistrer » d'une ligne tech.mode.<id>, lire les deux champs et refuser si part > remise, avec le message d'erreur du champ. Mettre la même garde dans le data-layer (validation de parametreSet pour tech.mode.*.partPointPct).

[8] g2 incoherence | ui/manager/10-configuration.html | Bouton « Tout rétablir »
  « Tout rétablir » efface d'un clic tous les paramètres, sans confirmation ni journal : ni auteur, ni valeurs d'avant. L'ICS, l'IBAN et le BIC du compte créancier partent aussi, et la préparation des prélèvements est bloquée. La page affirme pourtant que « chaque modification est journalisée avec son auteur ».
  corr: Demander une confirmation qui liste les écarts. Journaliser `parametres_retablis` (acteur, liste avant/après). Exclure tech.paiement.ics, iban et bic, qui sont des coordonnées et non des écarts, ou exiger une seconde confirmation pour eux.

[9] g2 incoherence | ui/manager/10-configuration.html | Texte « Ce que la banque nous prend »
  Configuration affirme que le coût d'une représentation est porté par notre marge et « ne se répercute nulle part automatiquement ». En réalité, techRepresenter crée automatiquement une pénalité « frais de représentation » à la charge du commerce, et 45 le lui annonce.
  corr: Faire trancher par la fondatrice, puis aligner. Soit le texte de 10 dit « la représentation est refacturée au commerce (pénalité), clause du contrat de distribution » et la clause est vérifiée dans documents/, soit la pénalité est supprimée de techRepresenter.

[10] g2 contourne | ui/manager/29-partenaires.html | Fiche du point : champ SIRET et « Enregistrer la fiche »
  La fiche contrôle le SIRET par une simple regex de 14 chiffres, alors que la règle unique de la maison exige la clé (siretValide). Elle laisse aussi changer le SIRET, l'enseigne ou le responsable d'un point actif dont le Kbis a été contrôlé, sans nouveau contrôle ni avertissement.
  corr: Utiliser `D.siretValide(siret)` dans 29 et dans partenaireEnregistrer. Un changement de SIRET ou de raison sociale sur un point au kyb 'valide' ou au contrat signé est refusé, ou remet le Kbis « à recontrôler » (journalisé).

[11] g2 incoherence | ui/manager/29-partenaires.html | KPI « Suspendus »
  Un commerce suspendu est compté deux fois : son point est « suspendu », et sa fiche de vente est mise « suspended » par _revendeurSuitPoint.
  corr: Compter sur lignes() : un commerce est suspendu si `(x.p && x.p.statut === 'suspendu') || (x.r && x.r.statut === 'suspended')`, une seule fois par ligne.

[12] g2 obsolete | ui/manager/29-partenaires.html, ui/manager/30-carte-operations.html | Textes sur la position du nomade et les « joignables sur la ville »
  Les deux écrans affirment que le nomade « ne partage pas sa position ». La même page 29 affiche pourtant « en route — à X, arrivée vers H » grâce au suivi en direct. Ils parlent aussi de nomades « joignables sur la ville », un reste de la diffusion par commune retirée : une demande va désormais au seul distributeur choisi. Enfin, la carte 30 place le nomade au centre de sa ville alors qu'il a un départ et un rayon.
  corr: Dire « le suivi s'affiche dès que le distributeur partage sa position (effacée à la fermeture) ». Remplacer « joignables » par le distributeur choisi (r.revendeur). Sur la carte, placer le nomade à son départ (partenaireDeplacement) avec un cercle de rayon.

[13] g2 incoherence | ui/manager/46-marques.html | Ligne « Déclaration « réseau limité » »
  46 attend un statut 'rejected' qui n'existe pas : une déclaration refusée (to_correct) s'affiche « à statuer » avec les boutons Valider et Refuser. Le manager peut donc valider le texte refusé sans que la marque l'ait corrigé. Les écrans 42 et 20 la traitent, eux, comme refusée.
  corr: Créer au data-layer TECH_CONFORMITE_STATUTS (pending « à statuer », validated « validée », to_correct « refusée — à corriger par la marque ») et le faire lire par 42, 46 et 20. Dans 46, masquer les boutons quand le statut est to_correct.

[14] g2 impasse | ui/manager/46-marques.html | Gestes du cycle de vie d'une marque
  Une marque ne peut être ni refusée (dossier frauduleux, déclaration irrecevable), ni résiliée, alors que le contrat-cadre est dit « résiliable à tout moment par l’une ou l’autre des parties ». Une marque en attente reste « en attente » indéfiniment. Il n'existe pas d'état de fin.
  corr: Ajouter les statuts `refused` et `closed`, avec techMarchandRefuser et techMarchandResilier (motif, date, compte marque clos, bons vendus toujours valables, dettes envers la marque toujours payables). Ajouter les gestes correspondants dans 46, et le libellé dans TECH_STATUTS et dans le CHECK du schéma.

[15] g2 impasse | ui/manager/46-marques.html, ui/manager/20-notifications.html | Seuil ACPR atteint
  Au seuil atteint, l'émission est bloquée « avant sa déclaration à l'ACPR », mais aucun écran ne permet d'enregistrer cette déclaration. La marque reste bloquée jusqu'à ce que la fenêtre de douze mois redescende. De plus, le test `>=` bloque à 1 000 000 € pile, alors que le texte vise le montant qui « dépasse ».
  corr: Créer techMarchandAcprDeclarer(id, { deposeeLe, preuve au coffre }, par) et un geste en 46. techQuota lève le blocage quand la déclaration est posée et datée de moins de douze mois (actualisation annuelle). Comparer avec `>`.

[16] g2 code_en_dur | ui/manager/45-marchand-paiements.html | Bouton « Restituer la garantie »
  La restitution passe un motif écrit en dur, ce qui contourne la règle « une restitution se motive ». Le bouton est aussi offert pour un nomade actif, qui ne peut alors plus vendre. Le délai restitutionJours du référentiel (30 jours) n'est appliqué ni affiché nulle part, et il n'est pas réglable.
  corr: Rendre le motif obligatoire (champ). N'offrir le bouton que si le point est clos ou refusé, ou après confirmation « le commissionnaire quitte le réseau ». Afficher l'échéance (closAt + restitutionJours), alerter en 20 et rendre tech.avance.restitutionJours réglable en 10.

[17] g2 impasse | ui/manager/45-marchand-paiements.html | Détail d'une remise : pas d'annulation, pas de rejet global
  Une remise préparée ne peut jamais être annulée : erreur, délai de dépôt manqué ou mandat révoqué. L'état « Annulée » existe mais rien ne l'atteint, et ses ventes restent bloquées « en prélèvement ». Un fichier rejeté en bloc par la banque (statut au niveau du groupe) n'est pas lu ; le seul moyen serait de déclarer chaque ligne impayée, ce qui pénaliserait et suspendrait les commerces pour notre erreur.
  corr: Créer techRemiseAnnuler(ref, motif, par) pour une remise non déposée : ventes et pénalités repassent à a_prelever, remiseRef effacé, journal. Traiter le rejet de groupe (GrpSts RJCT) : lignes remises à a_prelever, sans pénalité ni suspension, et motif affiché.

[18] g2 manque_fonctionnel | ui/manager/45-marchand-paiements.html | « Virer » et « Virements émis »
  Un virement est considéré comme payé dès le clic, sans confirmation bancaire. Aucun état « rejeté » ni geste de reprise n'existe : un virement instantané refusé (IBAN clos, titulaire) laisse la marque « payée » pour toujours.
  corr: Donner au virement un statut (emis → execute | rejete) et un geste « Virement rejeté (motif) » qui remet les ventes à a_payer et journalise. Afficher le rejet en 20 et en 46.

[19] g2 promesse_sans_logique | ui/manager/45-marchand-paiements.html (data-layer techRemisePreparer) | Échéance de la marque posée à la préparation de la remise
  L'échéance de paiement d'une marque (sédentaire) est calculée depuis l'arrêté du jour où le manager clique « Préparer la remise », pas depuis l'arrêté qui a fermé la fenêtre de la vente. Une préparation tardive retarde d'autant le paiement promis (« dans les 24 heures qui suivent l'arrêté »). Une ligne écartée (mandat absent) laisse la vente sans échéance : la marque n'est jamais due, alors que « le risque d’impayé d’un commerce est pour nous ». Une représentation réécrit aussi l'échéance.
  corr: Poser echeanceMarque à partir de la fin de la fenêtre d'arrêté qui contient v.at (premier arrêté après la vente), indépendamment de notre remise, et ne jamais la réécrire une fois posée. Si ce n'est pas fait à la vente, faire poser l'échéance des ventes écartées par techArrete.

[20] g2 manque_fonctionnel | ui/manager/07-tresorerie.html, ui/manager/46-marques.html, ui/manager/45-marchand-paiements.html | Encaissements et échecs de carte des abonnements
  Les abonnements débités par carte n'apparaissent dans aucune poche de trésorerie. L'échec d'un débit (carte absente ou expirée) n'est dit que dans un message éphémère de 45 : ni la fiche marque 46, ni les notifications 20 ne montrent un abonnement impayé ou le motif du refus.
  corr: Dans 07, ajouter les poches « abonnements encaissés (carte) » et « abonnements impayés » (techFactures). Dans 46, une ligne « Abonnement : période, facture, payée ou échec (motif, tentatives) ». Dans 20, une alerte sur tech_facture_echec, et une suite définie (relance, puis suspension de l'édition ?).

[21] g2 incoherence | ui/manager/42-verifications.html, ui/manager/18-fiche-client.html | Dossiers client (portée client)
  Mes bons envoie la vérification par le bus (PEC_BUS.ouvrirVerification), jamais par DOCS.soumettre. 42 affiche donc le dossier « pas encore envoyé au contrôle », sans échéance, sans assignation ni escalade, alors que l'utilisateur a lu « notre équipe contrôle ton dossier ». Côté manager, la décision n'existe nulle part : 18 montre le statut bus en code brut (a_controler, transmise_pvid) sans geste, et seule la hotline peut décider.
  corr: Soit Mes bons appelle aussi DOCS.soumettre('client', id) à l'envoi, soit 42 fusionne PEC_BUS.verifications() pour la portée client (échéance ref.verification.delaiHeures, assignation, geste « Décider » → deciderVerification). Dans 18, traduire le statut en libellé et renvoyer vers 42.

[22] g2 promesse_sans_logique | ui/manager/42-verifications.html, ui/manager/10-configuration.html | KPI « Urgents », pastilles URGENT · commande et « examen réglé », règles « 4 h en urgence »
  Deux écrans promettent un déblocage urgent traité en 4 h et des frais d'examen, mais aucun écran ne peut demander l'urgence : tous les DOCS.soumettre sont appelés sans urgence. Ce sont des restes du parcours fournisseur de Mode (commande client en attente, 2,99 € et 9,99 €). ref.verification ne connaît pas la marque (ni tarif, ni signature) et désigne encore le contrat partenaire comme « Contrat de distribution du Bon d’achat PayEnCash ».
  corr: Retirer urgence, commande et frais de 42 et de PEC_DOCS (fraisDe, fraisRegles, soumettre). Nettoyer ref.verification : tarifs et signature pour la marque, suppression de « fournisseur », nouveau libellé du contrat partenaire. Si une urgence est voulue, créer le geste qui la demande.

[23] g2 casse | ui/manager/20-notifications.html, ui/manager/17-comptes-manager.html | Détails et noms injectés sans échappement
  20 injecte n.detail en HTML brut. Ce détail contient du texte saisi par des tiers (sujet et nom d'une demande SAV d'un utilisateur de Mes bons, raison sociale d'une marque) : une balise saisie dans Mes bons s'exécute dans le back-office. 17 injecte de même le nom, l'identifiant et la note des comptes invités.
  corr: Passer toutes les données interpolées par D.esc(). Pour 20, construire detail avec des morceaux déjà échappés (seul le balisage `<b>` ajouté par la page reste brut).

[24] g2 incoherence | ui/manager/20-notifications.html | « Tout marquer comme lu »
  Il n'existe pas de lecture ligne par ligne : un clic attribue toutes les alertes à une seule personne. Les ids stables (rib:<marque>, mq:<marque>, prt-cand:<compte>) font qu'un écart encore présent (marque sans RIB, marque à valider) reste masqué pour toujours. Le principe annoncé « la ligne s'éteint dès que le fait disparaît » ne tient plus : ici, elle disparaît alors que le fait persiste.
  corr: Ajouter un geste par ligne « Je prends » (par, at). Une alerte dont le fait persiste reste visible (« prise par X ») ou revient après un délai. Faire entrer dans l'id la version du fait (échéance, montant, statut).

[25] g2 manque_fonctionnel | ui/manager/20-notifications.html | Sources du fil
  Le fil ignore des écarts qui attendent une décision du manager : garantie ou versement d'avance à constater, échec de débit d'un abonnement, bon refusé noté par la hotline, vérification d'identité Mes bons à décider, rencontre expirée sans appel, dossier en attente non encore en retard.
  corr: Ajouter ces sources avec un lien vers le geste : 45 avances, 46 abonnement, 46 refus signalés, 42 KYC, 29 rencontres.

[26] g2 incoherence | ui/manager/16-communications.html (catalogue du data-layer) | Modèle « code_verification » par SMS sur compte_cree
  Chaque compte_cree planifie un SMS « Ton code de vérification », y compris pour une marque ou un commerce (vérifiés par e-mail) et pour une invitation manager ou hotline (aucun code). Le code de mot de passe part aussi toujours par SMS, alors que la règle du data-layer est « jamais un SMS vers un numéro que personne n'a vérifié ». Le KPI dit encore « Codes de vérification (inscription, connexion) » alors que la connexion ne passe plus par SMS.
  corr: Scinder les entrées avec `si` : SMS pour `espace: 'client'`, e-mail pour marque et partenaire, rien sur compte_cree manager/hotline (une entrée « invitation » par e-mail à la place). Pour mdp_code_envoye, prendre le canal dans data.canal. Corriger le texte du KPI.

[27] g2 impasse | ui/manager/17-comptes-manager.html, ui/manager/19-invitation.html, ui/manager/01-connexion.html | Invitation expirée
  Une invitation expirée ne peut être ni renouvelée ni révoquée. Réinviter la même adresse est refusé (« Un compte existe déjà »), alors que 01 et 19 disent « demande une nouvelle invitation » et « il faut en émettre un nouveau ». L'adresse est bloquée définitivement.
  corr: Ajouter en 17 les gestes « Renouveler » (nouvelle échéance, nouveau jeton, journal) et « Révoquer ». Dans compteCreer, réémettre sur un compte 'invite' expiré du même identifiant au lieu de refuser.

[28] g2 contourne | ui/manager/40-comptes.html, ui/manager/17-comptes-manager.html | Suspension du dernier compte Direction et session d'un compte suspendu
  La protection du « dernier propriétaire actif » n'existe que dans l'affichage de 17 : 40 propose « Suspendre » sur tous les comptes manager et compteSuspendre n'a aucune garde. Une session déjà ouverte d'un compte suspendu reste valide, car la garde ne relit pas le statut, alors que 17 promet qu'« il n’attend pas l’expiration de son jeton ».
  corr: Mettre la garde dans compteSuspendre : refuser la suspension du dernier compte direction actif. Dans sessionManager / payencash-garde, vérifier que compte(identifiant).statut === 'actif', sinon déconnecter (y compris sur l'évènement storage).

[29] g2 incoherence | ui/manager/40-comptes.html | Comptes de l'espace « Marque »
  40 dit que les marques n'entrent pas dans sa table, mais ses filtres dérivés d'ESPACES_COMPTE affichent l'espace Marque et listent les comptes marque. Ces comptes passent « Actif » dès l'e-mail confirmé (validation vide), alors que la marque est « Inscription à terminer » ou « Inactif — vérification en attente » en 46 : deux écrans disent deux choses de la même marque.
  corr: Pour un compte de l'espace marque, afficher dans 40 le statut de la marque (techMarchandParCompte → techStatutLbl/Pill) avec un lien vers 46, et corriger les textes. Sinon, exclure l'espace marque de la table comme le texte l'annonce.

[30] g2 impasse | ui/manager/18-fiche-client.html | Sas RGPD : accès et rectification
  Le sas est destiné à « quelqu’un qui n’a plus accès à son compte ». Pourtant la rectification renvoie l'utilisateur vers son compte, sans formulaire côté manager. L'accès annonce un export envoyé par e-mail sous 48 h, mais aucun export n'est produit et aucun message n'est planifié : rgpd_export_demande n'est pas au catalogue.
  corr: Ajouter un formulaire manager de rectification (champs du profil → compteProfilMaj avec par = acteur, journal). Créer compteExporter(id) qui produit l'export JSON, et une entrée catalogue `rgpd_export_demande` (e-mail, délai ref.rgpd.exportDelaiH) pour que l'envoi apparaisse au journal des envois.

[31] g2 incoherence | ui/manager/11-audit.html, ui/manager/40-comptes.html | Plafond de 1000 entrées, absence de filtre de période, bouton « Purger le journal »
  Le journal d'audit « ne se réécrit pas », mais au-delà de 1000 évènements les plus anciens sont supprimés, et l'écran avoue lui-même qu'il manque un filtre de période. Le journal de connexion, lui, se purge d'un clic sans laisser de trace : effacer les tentatives refusées n'est ni journalisé ni réservé à la direction.
  corr: Donner à l'audit un magasin non plafonné (ou archivé par mois, exportable) et un filtre de période dans 11. Supprimer « Purger » ou le réserver à la direction avec la journalisation `connexions_purgees` (acteur, nombre, période).

[32] g2 incoherence | ui/assets/payencash-manager-nav.js (PEC_MGR.finance), ui/manager/14-comptabilite.html | Écriture « Ventes » d'une vente de commissionnaire nomade
  La vente d'un nomade est comptabilisée comme une revente au commissionnaire (« revendu à X … payé d’avance ») au prix réseau. Le data-layer et l'app partenaire le qualifient pourtant de commissionnaire qui vend pour notre compte (il n'achète pas le bon). Le mouvement d'avance, repris dans l'export de trésorerie, s'intitule en plus « Achat d'un bon ». Le journal contredit la qualification juridique.
  corr: Pour paiement === 'avance', écrire la vente au client (valeur faciale, pour notre compte) et la commission du commissionnaire (partPoint) en charge, ou au minimum le libellé « vendu pour notre compte par X (commission N %) ». Passer le motif d'avance à « Bon édité — imputé sur le paiement anticipé ». Faire valider le schéma d'écritures par l'expert-comptable.

[33] g2 impasse | ui/manager/01-connexion.html, ui/manager/31-comptes-demo.html | « Compte de démo : voir Accès & comptes démo (écran 31) »
  La page de connexion renvoie vers l'écran 31 pour trouver les identifiants de démo, mais 31 est derrière la garde manager : il faut être connecté pour lire comment se connecter. Le portail ne donne aucun identifiant.
  corr: En démo, afficher le trousseau sur portail.html ou dans un volet public de 01-connexion, ou rendre 31 publique en environnement de démonstration, en le disant.

[34] g3 incoherence | ui/manager/29-partenaires.html | KPI « PRISES » et « SANS PRENEUR »
  « Prises » annonce « un nomade est en route » pour une rencontre seulement validée : le départ est un geste distinct (departTs). « Sans preneur — sans appel dans les N min » compte aussi les rendez-vous validés puis non tenus (echueApresValidation), qui avaient un preneur. Les annulées ne sont comptées nulle part.
  corr: Séparer les compteurs « validées », « en route » (departTs), « expirées sans appel », « rendez-vous non tenus » et « annulées ».

[35] g3 promesse_sans_logique | ui/manager/10-configuration.html | Réglages lus mais non réglables, ou affichés mais non appliqués
  Plusieurs réglages lus par le code n'ont pas de champ : cadence d'une offre (tech.mode.<id>.cadenceJours), restitution de la garantie (tech.avance.restitutionJours), type de mandat (mandatDefaut), jour de l'abonnement (abonnementJour). abonnementJour est affiché (« Débité le 1 de chaque mois ») mais n'est lu par aucune logique : la facturation part au clic en 45, n'importe quel jour. Le coût mensuel du service bancaire (offreMensuelle) n'entre pas dans les charges du compte de résultat.
  corr: Exposer ces champs dans 10, ou retirer le texte. Faire lire abonnementJour par une tâche datée (le bouton 45 refuse avant le jour, ou le dit). Compter offreMensuelle en charge mensuelle dans finance().

[36] g3 code_en_dur | ui/manager/10-configuration.html (référentiel des offres) | Détail des offres affiché sous chaque remise
  Le texte des offres écrit « entre deux arrêtés de 20:00 » et « dans les 7 jours ouvrés » en dur, alors que l'heure d'arrêté se règle deux panneaux plus bas : après un changement d'heure, la page se contredit.
  corr: Utiliser des marqueurs {arrete} et {delai} remplis par techModes depuis paiement.arreteHeure et le délai de l'offre.

[37] g3 design | ui/manager/10-configuration.html | Jargon technique et note interne visibles
  L'écran affiche au manager des noms de fonctions et de clés, ainsi qu'une note de travail sur la forme juridique de la société.
  corr: Remplacer par des phrases métier. Ne pas afficher ref.societe.note : trancher la forme juridique dans le référentiel.

[38] g3 redondance | ui/assets/payencash-data.js (lu par 29/30 et Mes bons) | Durée de vie d'une position
  Trois valeurs coexistent pour la même notion : ref.rencontre.positionTtlMin = 30 (héritée de Mode), tech.nomade.positionTtlMin = 30 (utilisée par le bus) et ref.rgpd.positionTTLMin = 60 (utilisée par PEC_GEO et par le texte RGPD montré aux utilisateurs). Aucune n'est réglable.
  corr: Garder une seule valeur (tech.nomade.positionTtlMin), lue par le bus, PEC_GEO et le texte RGPD. La rendre réglable en 10 et supprimer ref.rencontre.

[39] g3 incoherence | ui/manager/02-tableau-de-bord.html, 07, 08, 30, 46 | « Dû aux marques », « À prélever », « Bons achetés »
  Les mêmes libellés portent des nombres différents d'un écran à l'autre. « Dû aux marques » (02) ne compte que les ventes arrêtées, alors que « nous lui devons » (46) et « Encore dû » (30, 08) comptent toutes les ventes a_payer. « À prélever » (02) exclut les pénalités, que 07 inclut. « Bons achetés » vaut un NOMBRE en 02, la valeur faciale en 30 et le prix réseau en 08.
  corr: Définir au data-layer ces grandeurs avec leurs libellés (dû arrêté, dû non arrêté, à prélever hors ou avec pénalités, valeur des bons, prix réseau) et nommer chaque tuile d'après ce qu'elle somme.

[40] g3 vocabulaire | ui/manager/02-tableau-de-bord.html, ui/manager/30-carte-operations.html | Statut marque « Nous te devons »
  Le libellé du statut dû à la marque tutoie la marque (« Nous te devons ») et s'affiche tel quel dans le back-office.
  corr: Donner des libellés selon le point de vue : techMarqueStatutLbl(s, 'manager') → « Dû à la marque » ; 'marque' → « Nous te devons ».

[41] g3 redondance | ui/manager/40-comptes.html, 29, 30 | Couleur des pastilles recopiée
  Plusieurs écrans recopient la règle de couleur des statuts au lieu de lire D.techStatutPill et D.rencontreStatutPill, créées justement parce que « les écrans la recopiaient ».
  corr: Remplacer ces ternaires par D.techStatutPill(statut) et D.rencontreStatutPill(statut).

[42] g3 incoherence | ui/manager/18-fiche-client.html | KPI « Comptes — X actifs · Y suspendus »
  Tout compte non actif est compté « suspendu », y compris les comptes à vérifier.
  corr: Compter `c.statut === 'suspendu'`, et ajouter si besoin « à vérifier ».

[43] g3 code_en_dur | ui/manager/16-communications.html | KPI « Push à envoyer » et « Échecs d’envoi »
  Le catalogue ne contient aucun message push : la tuile Push est toujours à 0, et la promesse « doublé par une notification dans l’app » n'a pas de logique. La tuile Échecs affiche un 0 écrit en dur, avec le style d'alerte rouge en permanence.
  corr: Retirer la tuile Push ou ajouter des entrées push. Ne mettre l'alerte que si des échecs sont journalisés (et dire « expéditeur non branché » dans un style neutre).

[44] g3 incoherence | ui/manager/16-communications.html (inscriptionsRelancer) | Relances J+1 et J+7
  La relance s'écrit dans le journal du compte (compte_relance) et devient le « dernier geste » : la relance de J+7 part en fait à J+8. Si le bouton n'est cliqué qu'à J+7 ou après, les deux relances partent ensemble.
  corr: Calculer le dernier geste en ignorant compte_relance et mdp_*. N'envoyer que le palier le plus élevé dû.

[45] g3 obsolete | ui/manager/11-audit.html, ui/manager/27-journal-flux.html | Libellés ref.auditLibelles
  Des évènements émis n'ont pas de libellé et s'affichent en code : rgpd_consultation_fiche, rgpd_code_envoye, rgpd_code_refuse, rgpd_effacement_refuse, rgpd_export_demande, rgpd_rectification_demande (18) et tech_marchand_categorie. Des évènements vivants portent un libellé obsolète ou banni : contrat_partenaire_signe → « Contrat de distribution du Bon d’achat PayEnCash signé », avance_mouvement → « compte d'avance … recharge, achat ». Environ 150 libellés Mode, Fly, fournisseur ou commercial ne sont plus jamais émis.
  corr: Ajouter les libellés manquants. Reformuler contrat_partenaire_signe (« Contrat de distribution des bons de marque signé ») et avance_mouvement (« Mouvement sur le paiement anticipé d'un commissionnaire (garantie, versement, bon édité, …) »). Supprimer les libellés morts, la maquette grossiste repartant d'un stockage vide.

[46] g3 incoherence | ui/manager/27-journal-flux.html | Acteurs et règle de la maison
  La pénalité et la suspension pour impayé sont attribuées au MANAGER alors qu'elles naissent du retour de la BANQUE. La « règle de la maison » décrit mal les statuts : une vente passe d'« à prélever » à « en prélèvement », et la vente d'un nomade naît réglée. Les évènements tech_revendeur_statut, tech_impaye_appel et tech_abonnements_factures n'ont pas d'acteur.
  corr: Mettre BANQUE comme acteur de tech_penalite (source retour) et de tech_revendeur_suspendu. Compléter la table. Corriger la phrase : « à prélever jusqu'à l'arrêté, en prélèvement jusqu'au retour ; la vente d'un nomade naît réglée ».

[47] g3 incoherence | ui/manager/42-verifications.html | « Reprendre le dossier »
  Le dossier est assigné au RÔLE de la session (« Assigné à Direction ») plutôt qu'à la personne. Les gestes de 42 et 46 signent aussi par D.session() au lieu de la règle commune PEC_MGR.acteur().
  corr: Utiliser PEC_MGR.acteur() partout (identifiant de la personne).

[48] g3 incoherence | ui/manager/21-compte-resultat.html | KPI « Résultat cumulé (exercice) »
  Ce « résultat de l'exercice » est calculé depuis la création de la société (finance(null)), sans notion de date de clôture.
  corr: Ajouter une date de clôture d'exercice à ref.societe et calculer sur l'exercice en cours, ou renommer le KPI « Résultat depuis la création ».

[49] g3 design | ui/manager/45-marchand-paiements.html | Ligne des règles (sp-regles)
  Le pluriel est figé : « échéance à 2 jour ouvré » dès que le réglage dépasse 1.
  corr: `PEC_DATA.nb(P.remiseJoursOuvresAvant, 'jour ouvré', 'jours ouvrés')`.

[50] g3 manque_fonctionnel | ui/manager/45-marchand-paiements.html | Pénalités des commerces
  Le manager ne voit la liste des pénalités (en attente, prélevées, impayées) nulle part, et ne peut pas en annuler une injustifiée : impayé dû à notre erreur, représentation offerte.
  corr: Ajouter en 45 une table des pénalités (filtre par commerce et statut) et un geste techPenaliteAnnuler(ref, motif, par), journalisé, pour une pénalité a_prelever.

[51] g3 incoherence | ui/manager/31-comptes-demo.html | Lien d'inscription à Mes bons
  « Un utilisateur de Mes bons naît de son inscription dans Mes bons » pointe vers 01-mes-titres, une page gardée, au lieu de la page d'inscription.
  corr: Pointer vers ../titres/00-inscription.html.

[52] g3 redondance | ui/manager/17-comptes-manager.html, 19-invitation.html, 40-comptes.html | Trois formulaires d'invitation, rôle par défaut Direction
  Trois formulaires créent la même invitation, avec des règles différentes : 19 exige une session manager, 40 signe « manager (démo) » sans session. Le rôle présélectionné est Direction, donc tous les droits par défaut.
  corr: Garder un seul formulaire (19, ou un composant partagé), exiger la session manager, présélectionner le rôle le moins élevé (opérateur) ou n'en présélectionner aucun.

[53] g3 obsolete | ui/manager/*.html (commentaires « tables du schéma reflétées ») | Noms de tables cités en tête des écrans
  Les écrans citent des tables qui n'existent pas dans server/db/schema.sql (tech_sales, tech_dd_files, tech_direct_debits, tech_payouts, tech_penalties, tech_subscriptions, tech_invoices, tech_sepa_mandates, tech_advance_movements, tech_meetings, tech_merchants, tech_resellers, manager_users, audit_log, event_log, kyc_documents, verification_codes, support_*) et « partie 6 ». Le schéma du 24/09 les nomme sales, direct_debit_files, direct_debits, payouts, penalties, subscriptions, invoices, sepa_mandates, advance_movements, meetings, merchants, resellers, event_log_entries, vault_documents…
  corr: Mettre à jour ces commentaires (02, 07, 08, 11, 14, 19, 27, 29, 30, 31, 40, 42, 45) avec les noms du schéma, ou les générer depuis schema-lecteur.

[54] g3 code_mort | ui/assets/payencash-data.js | Branches fournisseur et Bon d'achat PayEnCash toujours vivantes
  Le protocole de compte utilisé par 40, 42 et 17 garde des branches du parcours fournisseur de Mode. Elles couvrent la création, la liaison métier avec les prospects commerciaux, la synchronisation d'accès, la portée de dossier et la remise à zéro. techBonUtiliser n'a plus d'appelant, et _techBonControle parle encore de « payencash.fr (Mode, Fly) ».
  corr: Supprimer ces branches et clés (règle « supprimer l'obsolète »), ainsi que techBonUtiliser si aucun écran ne l'utilise. Vérifier le banc.


######## hotline-fils — Hotline, rappels, réclamations et fils de notifications (61 confirmés, 0 oublis, 0 réfutés)

[0] g1 promesse_sans_logique | ui/bons (01-mes-titres, 04-compte) ↔ documents/cgu-mes-bons.html | Canal de réclamation écrite du porteur
  Les CGU promettent une réclamation écrite au service client, préalable légal à la médiation qu'elles citent ; l'app n'offre qu'un rappel téléphonique et, pour un seul cas, le signalement d'un bon refusé. Aucun écran pour écrire au sujet du compte, d'une rencontre non honorée, d'un code perdu ou d'un achat au comptoir — cas que manager/27 annonce pourtant.
  corr: Ajouter dans Mes bons 04-compte (et l'onglet Aide de 01) une carte « Écrire à PayEnCash » : type (question / réclamation), sujet, texte → PEC_BUS.ouvrirDemande({type, clientId: B.porteurId(), client, canal:'app', sujet, texte}) ; puis une liste « Mes demandes » lue dans PEC_BUS.demandesSav() filtrée sur clientId, avec le fil, le libellé STATUTS_DEMANDE[…].client et la réponse (repondreDemande(id, txt, id, 'moi')).

[1] g1 promesse_sans_logique | ui/assets/payencash-bus.js (demanderAppel) + cartes de rappel des trois apps | Échéance « sous 15 min » calculée hors planning
  L'échéance d'un rappel vaut toujours « maintenant + 15 min », à n'importe quelle heure : la nuit, ou un jour sans créneau, l'app annonce « la hotline te rappelle sous 15 min » alors que personne n'est en poste ; hoteEnPoste retombe sur la superviseure hors créneau et l'assignation est quand même marquée « planning ».
  corr: Ajouter au data-layer D.hotlineProchainCreneau(at) (lit assistance.hotline.planning) ; dans demanderAppel et ouvrirDemande, dueAt = max(at, début du prochain créneau) + rappelDelaiMin ; assigneSource 'repli' quand personne n'est en poste ; une fonction unique PEC_BUS.echeanceLbl(x) (« sous 15 min », « demain à partir de 8 h ») lue par les cinq cartes de rappel.

[2] g1 casse | ui/assets/payencash-data.js (satisfactionAjouter) + PEC_BUS.monterRetour | Réclamation orpheline, « la hotline revient vers toi »
  La réclamation ouverte par une note basse ne porte ni clientId, ni téléphone, ni espace, ni marque : Mes bons ne la voit pas, filPro ne la ramène pas au commerce (client = enseigne, pas d'espace), Solution n'a aucun canal, et la hotline ne peut pas rappeler faute de numéro. La carte promet pourtant « la hotline revient vers toi ». (Aggrave E-07, toujours présent.)
  corr: Dans satisfactionAjouter, recopier de l'échange noté : clientId: q.clientId, tel: q.tel, et pour un commerce espace:'partenaire' + client: pointId (ou partenaireId), pour une marque marchandId ; afficher la réclamation dans « Mes demandes » (Mes bons), dans filPro, et dans une section demandes de l’espace marchand.

[3] g1 casse | ui/manager/20-notifications.html | Colonne Sujet/détail des alertes (escalades ⑤)
  Le détail d'une alerte est injecté en HTML brut ; pour une demande escaladée il contient le sujet tapé par un commerce (enseigne + son message) et le nom du demandeur. Un commerce peut donc injecter du HTML/JS exécuté dans le back-office manager (même défaut sur ① avec c.usageDeclare saisi par la marque).
  corr: Échapper chaque morceau dynamique à la construction du détail (esc(d.sujet), esc(d.client), esc(c.usageDeclare)…) et garder le balisage voulu (<b>délai dépassé</b>) hors des données, ou rendre n.detail avec esc() et un champ `alerte` séparé pour le gras.

[4] g2 casse | ui/assets/payencash-bus.js (demandesSav) | Règle enRetard
  La règle est inversée : une demande à laquelle l'hôte a répondu DANS le délai devient « EN RETARD » dès l'échéance passée, et le reste ; une réponse donnée après l'échéance efface le retard. Vérifié sous node (réponse à T+5 min, lecture à T+16 : true ; réponse à T+20, lecture à T+21 : false). Le KPI « En retard » de la hotline et la pastille de manager/27 sont faux.
  corr: En retard = en_cours ET dueAt < now ET aucune réponse de l'hôte AVANT dueAt, soit « !(d.derniereReponseAt && d.derniereReponseAt <= d.dueAt) » sur la première réponse (dérivée du fil : premier echanges[qui='hote'].at) ; puis, si le demandeur réécrit après une réponse, reposer une nouvelle échéance (dernier message 'moi' + délai).

[5] g2 incoherence | ui/assets/payencash-data.js ref.hotline + ui/manager/27 | Deux délais contradictoires pour une même demande écrite
  Une demande écrite reçoit une échéance de 15 min (délai de RAPPEL) alors que le référentiel dit « réponse de l'hôte sous 2 h ouvrées (au-delà : EN RETARD) » ; la supervision n'est saisie qu'à 2 h, le retard s'affiche à 15 min. Les 2 h et 48 h existent deux fois (slaHoteH/slaManagerH et escalade[].apres), et « heures ouvrées » n'est jamais calculé (escaladeDemande compte des heures d'horloge, week-end et nuit compris). Le compteur mesure aussi le silence de l'hôte quand c'est le demandeur qui doit répondre.
  corr: Un délai par nature : ref.hotline.reponseDemandeH (demande écrite) distinct de rappelDelaiMin (rappel) ; supprimer slaHoteH/slaManagerH et lire escalade[].apres partout (27 compris) ; calculer les heures ouvrées sur le planning (D.heuresOuvrees(de, a)) ; ne compter le silence que lorsque le dernier message du fil est du demandeur.

[6] g2 incoherence | ui/hotline/01-pilotage.html, ui/manager/20, ui/assets/payencash-data.js | Statut 'mediateur' traité comme ouvert
  Une demande transmise au médiateur n'est close pour personne : la hotline affiche encore l'échéance « en retard de N j » et le bouton Clôturer (qui la remet en 'cloturee' et envoie un questionnaire), escaladeDemande continue, manager/20 affiche « Médiation ouverte » à jamais, l'à-faire de la marque la garde, et une note du demandeur la re-clôt en clot_satisfait (E-08, non corrigé).
  corr: Un seul prédicat D.demandeClose(d) = d.statut !== 'en_cours', employé par hotline/01, 27, 20, filPro, escaladeDemande, T.aFaire et 02-titre ; cloreDemande refuse de réécrire une demande déjà close ; la note s'écrit comme une issue à part sans toucher statut ni cloAt.

[7] g2 promesse_sans_logique | ui/manager/27-assistance-reclamations.html | Bouton « Transmettre au médiateur »
  Le bouton fait croire que PayEnCash saisit le médiateur, alors que le référentiel dit « Le client peut saisir le médiateur » ; il est proposé sur les questions (INF-) des commerces, qui sont des professionnels hors médiation de la consommation, et sur les bons refusés que la CGU 9.3 renvoie au médiateur de la marque. Il promet que l'utilisateur « reçoit les coordonnées du médiateur » sans qu'aucun message ni écran ne les lui donne.
  corr: Renommer en « Clore et communiquer les coordonnées du médiateur », réservé aux réclamations d'un porteur (clientId présent, type reclamation, motif ≠ bon_refuse) ; écrire la réponse avec les coordonnées lues dans ref.juridique.mediationConso et planifier un message (evt 'reclamation_decision' au catalogue) ; pour bon_refuse, orienter vers le service client de la marque.

[8] g2 incoherence | ui/assets/payencash-data.js (filPro) + ref.hotline.escalade | Palier « médiateur » appliqué à un commerce
  Les paliers d'escalade ne distinguent pas le demandeur : au-delà de 60 jours, le fil d'un commerce affiche « Le client peut saisir le médiateur » (médiateur de la consommation), qui ne concerne pas un professionnel, et manager/20 annonce « Médiation ouverte » pour une question de commerce.
  corr: Porter sur chaque palier une portée (publics: ['porteur']) et faire filtrer escaladeNiveaux(d) selon le demandeur (clientId → porteur, espace partenaire → commerce, marchandId → marque) ; le dernier palier d'un commerce ou d'une marque est le manager.

[9] g2 incoherence | ui/manager/27-assistance-reclamations.html | Tableau « Réclamations escaladées — à traiter », KPI « Réclamations chez moi », colonne SLA
  Le tableau liste TOUTES les REC- et INF- dès leur ouverture (y compris celles que l'hôte traite dans les délais), le KPI « chez moi » les compte toutes, et la colonne SLA affiche la même constante « 48 h » pour chaque ligne : l'écran n'utilise pas escaladeDemande alors que le banc et 20-notifications disent que le manager ne voit que ce qui a dépassé le palier.
  corr: Deux onglets : « À trancher » = D.demandesEscaladees('manager') (plus 'mediateur' pour mémoire) et « Toutes les demandes » ; colonne SLA = escaladeDemande(d) (niveau, « depuis N h », prochain palier dans N h) ; KPI « chez moi » = demandesEscaladees('manager').length.

[10] g2 casse | ui/manager/27-assistance-reclamations.html | Colonne Historique et registre event_log
  Chaque échange est daté de l'ouverture de la demande, pas de son propre instant : une réponse donnée trois jours plus tard s'affiche à l'heure d'ouverture, dans l'historique comme dans le registre exporté.
  corr: Utiliser quandFr(e.at || d.at) et garder e.par comme auteur (au lieu de r.hote dans le registre).

[11] g2 casse | ui/manager/09-appels.html | Liste des appels du jour
  La liste ne montre que les appels CRÉÉS le jour choisi : un rappel demandé la veille, encore « à faire » ou « sans réponse », disparaît de l'écran du jour et le compteur « Appels planifiés ce jour » l'ignore — alors que la hotline le garde en file.
  corr: Pour aujourd'hui : tous les appels non « fait » quelle que soit leur date + ceux créés ou traités ce jour ; pour une date passée : créés ou traités (faitAt) ce jour-là ; afficher l'échéance et le retard comme la hotline.

[12] g2 incoherence | ui/manager/09-appels.html | « Terminé » sans questionnaire, texte « Voie normale »
  Terminer un appel depuis le manager n'envoie pas le questionnaire, alors que le même geste à la hotline l'envoie et que la page affirme qu'il « part tout seul à la fin de l'appel ou de la demande » (E-28, toujours présent). Même écart pour « Répondre & clore » de manager/27.
  corr: Déplacer l'envoi dans le bus : traiterAppel (issue 'fait') et cloreDemande (clôture par l'hôte ou le manager) appellent D.satisfactionDemander, qui dédoublonne déjà ; retirer envoyerQuestionnaireAppel et l'appel de window.clore.

[13] g2 incoherence | ui/manager/09-appels.html vs ui/hotline/01-pilotage.html | Bloc « Satisfaction (mois en cours) »
  Le bloc titré « mois en cours » et « Questionnaires complétés ce mois-ci » agrège en fait tout l'historique ; la hotline calcule la même satisfaction sur 30 jours glissants : deux chiffres différents pour un même indicateur.
  corr: Une fonction D.satisfactionIndicateurs({fenetreJours}) (moyenne, nombre, à relancer) lue par les deux écrans, sur ref.hotline.fenetreIndicateursJours, et un titre dérivé (« Satisfaction (30 j) »).

[14] g2 incoherence | ui/manager/09-appels.html vs PEC_BUS.monterRetour | Questions du questionnaire
  La note saisie au manager répond à « Application intuitive ? » et « Pourquoi avoir acheté un bon de marque au comptoir ? », celle donnée dans l'app à « Ton avis sur notre échange » : deux questions différentes versées dans la même moyenne ; la question d'achat au comptoir n'a pas de sens pour une marque ou un commerce rappelé.
  corr: Un seul modèle de questionnaire au référentiel (ref.hotline.questionnaire : question notée, question libre), lu par monterRetour et par la saisie manager ; la saisie téléphonique reprend exactement la même question et écrit canal:'telephone' (E-16).

[15] g2 promesse_sans_logique | ui/hotline/01-pilotage.html | Texte du panneau Satisfaction vs journalisation d'un appel reçu
  Le panneau affirme que « chaque appel passé » déclenche un questionnaire ; un appel entrant journalisé naît « fait » sans questionnaire (et sans moyen d'en envoyer, faute de lien à un compte).
  corr: Soit proposer à la journalisation « Envoyer le questionnaire » quand l'interlocuteur est rattaché à un compte (résolution de la réf, E-01), soit corriger le texte : « chaque rappel passé et chaque demande close ».

[16] g2 promesse_sans_logique | ui/assets/payencash-data.js (MESSAGES_CATALOGUE, satisfactionDemander) + hotline/manager | « Envoyé par Brevo (e-mail) »
  Les écrans annoncent un questionnaire envoyé par e-mail ; aucun modèle n'existe au catalogue, rien n'apparaît dans manager/16, et le questionnaire ne recopie aucune adresse e-mail (seulement le téléphone). Seule la carte dans l'app existe (E-15, toujours présent).
  corr: Ajouter { evt: 'questionnaire_satisfaction', canal: 'email', modele: 'questionnaire_satisfaction', objet: 'Ton avis sur notre échange', cible: 'demandeur' } ; satisfactionDemander recopie l'adresse (compte, point ou marque) ; satisfactionCanal devient un code ('email') et le libellé une donnée à part.

[17] g2 manque_fonctionnel | ui/assets/payencash-data.js MESSAGES_CATALOGUE | Évènements du support sans message
  Les faits du support qui changent la situation d'une personne ne produisent aucun message : accusé de réception d'une demande ('sav' : numéro de dossier), rappel resté « sans réponse » (« nous avons essayé de te joindre »), décision sur une réclamation ou passage au médiateur ('reclamation_decision'), refus d'un bon noté chez la marque ('tech_bon_refus_note', que les Conditions 4.1 disent « notifié à la Marque »), décision d'identité ('kyc'). Seul 'sav_reponse' existe.
  corr: Ajouter au catalogue : sav (accusé, cible demandeur, si {statut:'en_cours'}), appel (si {statut:'sans_reponse'}, SMS au demandeur), reclamation_decision (e-mail motivé, avec coordonnées du médiateur quand decision = mediateur), tech_bon_refus_note (e-mail à la marque, cible marque), kyc (si decision refusee/a_refaire, e-mail au porteur).

[18] g2 manque_fonctionnel | ui/assets/payencash-data.js MESSAGES_CATALOGUE + ui/manager/18-fiche-client.html | Évènements importants sans message
  Sans message : compte Mes bons suspendu / réactivé / clos / supprimé, point refusé / clos / réactivé, vente d'un commerce suspendue pour impayé (tech_revendeur_suspendu, contrat 5.5), marque réactivée, mandat SEPA révoqué, rencontre acceptée / annulée / expirée pour le porteur (seul le nomade a son SMS), et le code RGPD que l'écran dit « émis sur le numéro du compte ».
  corr: Compléter MESSAGES_CATALOGUE (canal, modèle, objet, cible) pour chacun, avec `si` quand l'évènement a plusieurs auteurs ; ajouter au banc un contrôle « tout évènement qui change l'état d'un compte, d'un point ou d'une rencontre a un message ou une exemption justifiée ».

[19] g2 casse | ui/assets/payencash-data.js envoiPlanifier | Destinataire de la réponse de la hotline
  L'e-mail « Réponse à ta demande » n'a pas de destinataire : repondreDemande ne transmet ni client ni clientId, donc le destinataire devient la référence citée (code du bon, id du point) ; le message ne peut pas partir vers la bonne personne (E-04, toujours présent).
  corr: repondreDemande passe { demande: id, client: d.client, clientId: d.clientId, espace: d.espace } ; envoiPlanifier résout l'adresse selon `cible` (demandeur → compte du clientId, e-mail du point, e-mail de la marque).

[20] g2 manque_fonctionnel | ui/bons (01, 02, 04) | Absence de fil et de cloche
  Le porteur n'a aucun fil : la réponse de la hotline n'est visible que sur la page du bon concerné, le rappel passé et le questionnaire dorment dans l'onglet « Aide » (sans pastille), la décision d'identité dans Compte ; rien ne l'avertit.
  corr: Étendre filPro à l'espace 'client' (réponses et clôtures de ses demandes par clientId, rappel passé, questionnaire en attente, décision KYC, étapes de rencontre, bon proposé reçu) et PEC_FIL.espaceDuChemin/identiteDe à ui/bons (identité = clientActifGet) ; cloche dans l'en-tête et pastille sur l'onglet Aide.

[21] g2 promesse_sans_logique | ui/tech (10-compte, 02-espace) + textes hotline/portail/manager 16 | Aucune demande écrite ni fil pour la marque
  La marque ne peut que demander un rappel : elle n'a ni formulaire écrit, ni fil, ni réponse à lire, alors que la hotline, le portail, la connexion hotline et manager/16 parlent des « demandes des marques » et de leur « fil des demandes ».
  corr: Ajouter à 10-compte section aide « Écrire à PayEnCash » (ouvrirDemande avec marchandId, espace:'marque') et une liste de ses demandes ; étendre filPro à 'marque' (réponses, refus de bon noté, pièces, paiement) avec une cloche dans T.menu ; sinon corriger les textes.

[22] g2 impasse | ui/distributeur/07-mon-point.html + filPro | Réponse de la hotline sans fil ni réponse possible
  Le commerce lit « Réponse de la hotline — INF-… » dans son fil, mais la carte n'a pas de lien : il ne peut ni relire l'échange, ni répondre, ni voir ses demandes en cours ; seul recours, ouvrir une nouvelle demande.
  corr: Ajouter dans 07-mon-point une liste « Mes demandes » (demandesSav filtré sur espace 'partenaire' et le point) avec le fil complet et une zone de réponse (repondreDemande(id, txt, enseigne, 'moi')) ; href des cartes sav-rep/sav-clos = '07-mon-point.html#demande-' + dm.id.

[23] g2 manque_fonctionnel | ui/titres/02-titre.html | Suivi du signalement
  Le porteur voit seulement la dernière réponse de l'hôte : pas de fil, pas de champ pour répondre à une question de la hotline, pas d'information sur le refus noté chez la marque.
  corr: Afficher le fil (echanges) et une zone de réponse (repondreDemande(rec.id, txt, clientId, 'moi')) ; afficher « Refus noté chez {marque} le … » quand rec.refusNote existe ; statut via STATUTS_DEMANDE[…].client.

[24] g2 impasse | ui/titres/02-titre.html | Bouton « Signaler un problème »
  Dès qu'une réclamation existe sur un code, même close, le bouton disparaît pour toujours : un nouveau refus de la marque le mois suivant ne peut plus être signalé.
  corr: Ne masquer le formulaire que si une réclamation EN COURS existe (D.demandeClose(rec) faux) ; sinon montrer l'historique et laisser « Signaler un nouveau problème ».

[25] g2 promesse_sans_logique | Cartes de rappel : ui/titres/01, 04 ; ui/distributeur/02, 07 ; ui/marchand/10 | État affiché après un « sans réponse »
  Après un appel sans réponse ou « à rappeler », l'app dit toujours « la hotline te rappelle sous 15 min » (libellé figé à la naissance, ou relu au référentiel côté commerce) : la personne ne sait pas qu'on a essayé de la joindre, ni quand on réessaiera.
  corr: Un rendu partagé PEC_BUS.monterRappel(el, o) qui dit l'état : « à faire — {échéance dérivée} », « tentative du {faitAt} sans réponse — nouvel essai {échéance} », « à rappeler le {date} » ; plus de libellé figé.

[26] g2 manque_fonctionnel | ui/assets/payencash-bus.js (traiterAppel) + hotline/01 + manager/09 | Aucun état de fin autre que « fait »
  Un rappel injoignable ou devenu sans objet ne peut sortir de la file que par « Appel passé », qui envoie un questionnaire et affiche « Rappel passé » au demandeur ; le demandeur, lui, ne peut ni annuler ni redemander (bouton masqué tant que statut ≠ fait). Aucun plafond de tentatives.
  corr: Ajouter les issues 'injoignable' (après ref.hotline.tentativesMax) et 'annule' (par le demandeur, bouton « Annuler ma demande ») au bus, à APPEL_STATUTS et au CHECK SQL ; monterRetour les dit ; aucun questionnaire hors 'fait'.

[27] g2 promesse_sans_logique | ui/hotline/01-pilotage.html + ui/manager/09-appels.html | Issue « À rappeler »
  « À rappeler » n'enregistre ni date ni heure : l'appel garde son échéance d'origine (déjà dépassée), reste « en retard » et rien ne dit quand rappeler.
  corr: Pour l'issue 'rappeler', exiger un créneau (champ date-heure) et reposer dueAt ; pour 'sans_reponse', dueAt = maintenant + ref.hotline.relanceMin.

[28] g2 manque_fonctionnel | ui/manager/20-notifications.html + hotline/01 | Rappels en retard jamais escaladés
  Un rappel promis « sous 15 min » peut rester en retard des jours : seul le compteur de la hotline le dit ; ni la superviseure ni le manager ne reçoivent d'alerte (20-notifications ne lit que les demandes), et « la superviseure est alertée » n'a aucun mécanisme.
  corr: Étendre escaladeDemande aux appels (D.escaladeAppel, même référentiel) ; section « Rappels en retard » dans 20-notifications et un bandeau d'alerte pour la superviseure dans hotline/01.

[29] g2 impasse | ui/hotline/01-pilotage.html | Lien « Réclamations (manager) ↗ »
  Le lien mène à un écran du back-office que la garde refuse à une session hotline : un conseiller clique et tombe sur un écran fermé.
  corr: N'afficher le lien que pour une session manager (estManager()) ; pour la hotline, un filtre « escaladées au manager » dans son propre panneau Demandes.

[30] g2 impasse | ui/assets/payencash-fil.js (PEC_FIL.brancher) | Cloche posée pour un collaborateur
  La cloche automatique est posée sur chaque page à barre d'état, y compris pour un collaborateur : il voit le nombre de notifications du titulaire (impayés, pénalités, dossier) et le lien mène à 08-notifications, qui le renvoie à l'accueil. L'accueil, lui, a pris soin de ne pas lui montrer ce fil.
  corr: Dans F.brancher : « if (window.PEC_PART && PEC_PART.collab && PEC_PART.collab()) return; » ; masquer aussi à un collaborateur la carte de rappel et monterRetour (compte rendu du titulaire) dans 02-accueil (majRappel).

[31] g2 casse | ui/assets/payencash-bus.js | Écritures dont l'échec est ignoré
  demanderAppel, traiterAppel, assignerAppel, assignerDemande et cloreDemande ignorent le retour d'ecrire() : sur un stockage plein, l'écran affiche « Demande enregistrée » ou la clôture, et le journal trace un fait qui n'existe pas — contre la règle du 11/09 appliquée à ouvrirDemande et repondreDemande.
  corr: « if (!ecrire(…)) return refusEcriture('Ta demande de rappel'); » avant toute trace dans ces cinq fonctions ; les écrans testent déjà a.ok === false ou !a.id.

[32] g2 obsolete | ui/assets/payencash-bus.js (_poseClient) | Liste des apps client
  La pose automatique du compte ne reconnaît que les apps mortes (Mode, Fly, écrans, parcours) et jamais Mes bons : tout objet né dans ui/bons sans clientId explicite (la réclamation d'une note basse) reste anonyme (E-07).
  corr: Remplacer la liste par ['bons'], ou supprimer _poseClient puisque chaque écran passe déjà clientId, et le passer explicitement dans satisfactionAjouter.

[33] g2 manque_fonctionnel | ui/assets/payencash-data.js assistance.hotline + manager (aucun écran) | Planning figé, conseiller invité sans créneau
  L'équipe et les créneaux sont écrits dans le data-layer, aucun écran ne les modifie, aucune table ne les porte (le commentaire cite « Miroir table hotline_shifts », absente du schéma) : un conseiller invité par le manager n'a jamais de créneau, donc ne reçoit jamais d'appel ou de demande depuis les apps, et on ne peut pas nommer une nouvelle superviseure.
  corr: Écran manager « Équipe hotline » (rôle, créneaux par jour) écrivant hotline_shifts via D.hotlineCreneauSet ; hotlinePlanning lit ce magasin (référentiel en repli) ; assignation par compte, pas par prénom (E-17).

[34] g2 manque_fonctionnel | ref.hotline.numero + vitrine et apps | Numéro de la hotline
  Le numéro « 0 805 » est incomplet et n'est publié nulle part hors de la hotline : ni Mes bons, ni l'app du commerce, ni Solution, ni la vitrine (aucun contact sur index.html) ne permettent d'appeler ; l'appel entrant n'a pas de porte.
  corr: Renseigner le numéro complet au référentiel (vide tant qu'il n'existe pas, et l'écran le dit) et l'afficher par une fonction D.hotlineContact() dans les cartes de rappel, 04-compte, 07-mon-point, 10-compte, les CGU et le pied de la vitrine.

[35] g2 manque_fonctionnel | ui/hotline/01-pilotage.html | Ouvrir une demande pour un appelant
  Un appel reçu ne peut pas devenir un dossier écrit : la hotline n'a aucun geste pour ouvrir une réclamation ou une question au nom de l'appelant (bon refusé signalé au téléphone, porteur sans l'app), donc ni suivi, ni réponse motivée, ni escalade.
  corr: Dans « Journaliser un appel reçu », case « Ouvrir un dossier » (type, sujet, compte rattaché résolu depuis la réf) → ouvrirDemande({…, canal:'0805', appelId}) ; corriger le texte de l'état vide (Mes bons ouvre aussi des réclamations).

[36] g2 impasse | ui/assets/payencash-bus.js repondreDemande | « rouvre-la avant de répondre »
  Le bus renvoie à un geste qui n'existe nulle part : aucune fonction ni aucun bouton ne rouvre une demande close.
  corr: Ajouter PEC_BUS.rouvrirDemande(id, par, motif) (statut en_cours, nouvelle échéance, trace 'sav_reouverture') et un bouton « Rouvrir » dans hotline/01 et manager/27 ; rouvrir aussi quand le demandeur écrit sur une demande close depuis moins de N jours.

[37] g2 casse | ui/manager/09-appels.html | Réf et téléphone insérés sans échappement
  La réf et le téléphone d'un appel sont injectés bruts ; la réf d'un appel entrant est du texte libre tapé à la hotline, le téléphone vient des fiches : une saisie contenant du HTML s'exécute dans le back-office.
  corr: D.esc(a.ref || a.id) et D.esc(a.tel) ; même contrôle sur option value="' + a.id + '".

[38] g3 incoherence | ui/manager/27-assistance-reclamations.html | « Répondre & clore » sans questionnaire
  Une demande close par la hotline déclenche un questionnaire, la même demande close par le manager avec une réponse motivée n'en déclenche pas ; les indicateurs de satisfaction ignorent les dossiers les plus sensibles.
  corr: Centraliser l'envoi dans cloreDemande (voir la correction du geste « Terminé »).

[39] g3 code_mort | ui/manager/27-assistance-reclamations.html | Panneau « Conversations des hôtes » et « Mes conversations »
  Plus aucun écrivain n'ouvre de conversation CNV- : le panneau et le KPI « Conversations ouvertes » sont toujours vides, et le texte renvoie à « Mes conversations », écran qui n'existe pas dans Mes bons (E-26).
  corr: Supprimer le panneau, le KPI, la branche CNV- d'ouvrirDemande et le placeholder « CNV-… » de la recherche.

[40] g3 code_mort | ui/hotline/01-pilotage.html | Auteur « Assistant », pastille « auto-résolue »
  La hotline lit encore l'auteur « Assistant » et le canal 'app-auto' de la FAQ de l'ancienne app client, que plus rien n'écrit (E-26).
  corr: Retirer 'Assistant' et 'app-auto' ; la pastille dit la vraie provenance (Mes bons, commerce, note basse via d.source).

[41] g3 code_mort | ui/assets/payencash-data.js assistance | conversations, reclamations, escalade (textes) et en-tête Mode
  Trois champs sans lecteur doublent le référentiel vivant (dont « résolution sous 48 h — sinon geste commercial proposé », promesse absente ailleurs), et l'en-tête parle de l'app client « 14-assistance » et de « manager/24 », écrans de Mode.
  corr: Supprimer conversations, reclamations et escalade de assistance ; réécrire l'en-tête (Mes bons, commerce, Solution, hotline/01, manager/27).

[42] g3 obsolete | ui/assets/payencash-data.js filPro | En-tête du fil
  L'en-tête décrit un fil pour « le partenaire, le fournisseur et le commercial » et « une seule dérivation pour les trois espaces », alors que seul le commerce existe (le fournisseur et le commercial sont hors périmètre).
  corr: Réécrire l'en-tête : fil du commerce (et, quand ils existeront, du porteur et de la marque).

[43] g3 obsolete | ui/manager/09-appels.html | Commentaires d'en-tête
  Les commentaires parlent encore d'« appel de bienvenue » et de « sécurisations », types retirés d'APPEL_TYPES.
  corr: Supprimer ces mentions (rappel demandé et appel entrant seulement).

[44] g3 incoherence | ui/assets/payencash-data.js comptesDemo + assistance.hotline.equipe | hotline.op
  Le trousseau présente hotline.op comme « Conseiller » pour la « file de sécurisation & rappels », alors que l'équipe le rattache à Naïma, superviseure (droit de réassigner) ; la sécurisation n'existe plus ; et un mot de passe en clair est versé au dépôt malgré la règle « jamais de mot de passe dans le dépôt ».
  corr: Aligner le rôle (Superviseure) et la note (« file des rappels, demandes et dossiers ») ; ajouter un compte conseiller simple pour tester la vue non superviseure ; sortir les mots de passe de démo du dépôt (générés au premier lancement).

[45] g3 vocabulaire | ui/manager/27-assistance-reclamations.html | Pastille « ouverte par la note SMS »
  La note se donne dans l'app (et le questionnaire est annoncé par e-mail) : aucune note n'arrive par SMS.
  corr: « ouverte par une note basse (≤ seuil) » ; le canal réel viendra de la réponse (E-16).

[46] g3 casse | ui/manager/27-assistance-reclamations.html | Pastille de retard
  La pastille affiche le code brut « en_retard » : statutDemande ne dérive le libellé que d'une demande en_cours avec enRetard, pas du code 'en_retard'.
  corr: Afficher D.STATUT_DEMANDE_RETARD.lbl, ou statutLbl sur l'objet demande (statutDemande(d)).

[47] g3 incoherence | ui/manager/27-assistance-reclamations.html | Colonnes Utilisateur et Journal des événements
  Toute demande est présentée comme venant d'un « Utilisateur » de l'« app Mes bons », même la question d'un commerce ; la colonne demandeur affiche l'id du point (PRT-…) au lieu de l'enseigne ; l'auteur d'une réponse est l'assigné, pas celui qui a écrit.
  corr: Nommer le demandeur par la même fonction que la hotline (demandeur(d) à déplacer au data-layer) et l'espace réel (Mes bons, commerce, marque) ; auteur = e.par.

[48] g3 promesse_sans_logique | ui/manager/09-appels.html | Textes de l'écran
  « Le bloc disparaît si aucun questionnaire n’a été saisi » est faux (rien ne se masque) ; la notice promet la « durée » de chaque appel, jamais enregistrée ; le commentaire annonce un numéro cliquable (tel:) que l'écran affiche en texte brut.
  corr: Retirer ou corriger les deux textes ; rendre le numéro en <a href="tel:…"> échappé ; n'annoncer la durée que lorsqu'un champ la porte.

[49] g3 incoherence | ui/assets/payencash-data.js filPro | Signature des réponses et clôtures
  Le fil du commerce montre l'identifiant de connexion du manager (ex. « emilie.r ») quand celui-ci répond ou clôt, alors que la même fonction s'interdit ailleurs de montrer un identifiant d'équipe (« l'équipe PayEnCash »).
  corr: Signer « l'équipe PayEnCash » (ou le prénom de l'hôte) : une fonction D.signatureEquipe(par) qui masque tout identifiant de connexion.

[50] g3 redondance | ui/titres/01, 04 ; ui/distributeur/02, 07 ; ui/marchand/10 | Carte de rappel copiée cinq fois
  La même carte (attente, formulaire, envoi) est réécrite dans cinq écrans, avec des sources qui divergent : délai relu sur a.quand (Mes bons, Solution) ou au référentiel (commerce), téléphone pris dans telComplet (01) ou dans l'identifiant du compte (04), nom construit de deux façons.
  corr: Un module partagé PEC_BUS.monterRappel(el, {clientId | ref, client, tel}) comme monterRetour, qui porte l'attente, le formulaire, l'envoi et le retour ; les cinq écrans ne font que le monter.

[51] g3 redondance | ui/assets/payencash-data.js STATUTS_DEMANDE + ui/titres/02-titre.html | Libellés « client » jamais lus
  Les libellés destinés au demandeur (« Close — note ton échange », « en retard, la superviseure est alertée ») ne sont lus par aucun écran ; 02-titre réinvente sa propre règle de clôture (regex incluant l'ancien 'resolue') et ses phrases.
  corr: 02-titre, filPro et la future liste « Mes demandes » affichent D.statutDemande(d).client et testent D.demandeClose(d).

[52] g3 code_mort | ui/assets/payencash-data.js | satisfactionEnAttente
  La fonction n'est appelée que par le banc ; monterRetour refait son propre filtre (par clientId ou par ref).
  corr: Faire lire à monterRetour une seule fonction D.satisfactionEnAttente({clientId | ref}) et supprimer le filtre dupliqué.

[53] g3 incoherence | ui/assets/payencash-bus.js monterRetour | Durée d'affichage, message de remerciement, questionnaires anciens
  Le « Rappel passé » reste affiché selon la fenêtre des indicateurs (réglage d'une autre nature) ; le « Merci » reste collé à la carte jusqu'au rechargement, même quand un nouveau questionnaire arrive ; un questionnaire jamais noté n'expire pas et reste « En attente » pour toujours.
  corr: ref.hotline.retourVisibleJours et ref.hotline.questionnaireValiditeJours (questionnaire 'expire' dérivé) ; effacer o.merci au premier repeint suivant.

[54] g3 incoherence | ui/hotline/01-pilotage.html + data.js hoteEnPoste | KPI « Non assignés » et source « planning »
  hoteEnPoste retombe toujours sur la superviseure : « Non assignés » ne peut presque jamais dépasser 0 alors que son aide dit « l'assignation du planning n'a trouvé personne en poste », et une assignation de repli hors créneau est marquée « planning ».
  corr: hoteEnPoste renvoie {membre, source:'planning'|'repli'} ; KPI « Assignés hors créneau (repli) » à la place de « Non assignés ».

[55] g3 vocabulaire | ui/manager/27-journal-flux.html + ref.auditLibelles | Acteur de 'sav', libellé de 'appel'
  L'ouverture d'une demande par un porteur ou un commerce s'affiche avec l'acteur « HOTLINE » ; la demande d'un rappel est libellée « Appel passé » dans l'audit, puisque demande et issue partagent l'évènement 'appel'.
  corr: Évènements distincts : 'appel_demande', 'appel_issue', 'sav_ouverture', 'sav_cloture', avec leurs libellés ; acteur déduit de `par`.

[56] g3 code_mort | ui/distributeur/08-notifications.html | Double abonnement au bus, commentaire périmé
  PEC_FIL.rendre s'abonne déjà à 'pec-bus' et 'storage' ; la page s'abonne une seconde fois (deux repeints par évènement), et son commentaire cite un « prélèvement refusé ou remboursé » par carte, flux retiré.
  corr: Supprimer les deux écouteurs de la page et le commentaire.

[57] g3 promesse_sans_logique | ui/manager/16-communications.html | Push, textes des audiences et des SMS
  Un KPI et une notice parlent de push « doublé par une notification dans l’app » alors qu'aucun modèle n'a le canal push ; la marque « lit » dans un « fil des demandes » inexistant ; l'aide des SMS ne cite que les codes de vérification alors que la mise en relation nomade part aussi par SMS (E-24 partiel).
  corr: Retirer le push tant qu'aucun canal n'existe ; dériver « Où ils lisent » des fils réellement disponibles ; dériver l'aide SMS des modèles du catalogue en canal sms.

[58] g3 incoherence | ui/manager/45-marchand-paiements.html + manager/09 | Deux registres d'appels
  L'appel obligatoire avant représentation d'un impayé (contrat 5.5 « PayEnCash prend contact avec le commerce ») est noté sur la ligne de remise, hors du centre d'appels : ni la hotline ni manager/09 ne le voient, ni le commerce dans son retour d'appel.
  corr: techImpayeAppelNoter crée aussi un appel sortant (type 'sortant', motif 'impaye', ref = pointId, compteRendu) dans hotline_calls, lu par 09 et par monterRetour du commerce.

[59] g3 manque_fonctionnel | ui/assets/payencash-tech.js T.aFaire | Entrée « Un client signale que ton bon … a été refusé »
  La marque lit une mise en cause contractuelle sans date, sans détail ni moyen de répondre (le lien mène aux documents), et l'entrée disparaît à la clôture sans trace dans son espace.
  corr: Section « Signalements » dans 10-compte : date du refus noté, solde au constat, statut du dossier, zone de réponse de la marque (échange rattaché à la demande), historique conservé après clôture.

[60] g3 incoherence | ui/manager/18-fiche-client.html | Historique assistance et appels
  L'état d'un appel est réduit à « Fait / À passer » (un « sans réponse » ou « à rappeler » disparaît) et le sujet affiché est la réf (l'id du compte) au lieu du motif.
  corr: sujet: a.motif ; état = libellé d'APPEL_STATUTS (à créer, E-10) avec tentatives.
