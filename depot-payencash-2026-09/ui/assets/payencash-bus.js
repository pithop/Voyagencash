/* PEC_BUS — le canal INTER-APPS réel de la maquette (fondatrice 25/08 : « je veux de
   vraies interactions entre apps, pas un système pré-rempli »).
   Même origine = localStorage PARTAGÉ entre l'app client, l'app partenaire et le back-office
   + événement 'storage' entre onglets. AUCUNE simulation automatique :
   ① le CLIENT annonce sa commande (annoncerCommande) → elle apparaît au manager, en direct ;
   ② trois déclarants, et personne d'autre (17/09 — pivot : plus de borne, plus de point qui encaisse une commande) :
        · le BON D’ACHAT PAYENCASH, quand il couvre la commande — par:'bon' ;
        · le MANAGER qui enregistre un encaissement déjà fait, motif à l'appui — par:'manager' ;
        · le BON D’ACHAT PAYENCASH (18/09) qui couvre toute la commande — par:'bon' : le bus débite le bon d’achat lui-même (PEC_DATA.bonDebiter) ;
          un bon d’achat qui ne couvre qu'une partie s'APPLIQUE (bonAppliquer) et le reste se règle par un autre déclarant.
   ③ l'écran du client ATTEND (surPaiement) et bascule quand SA réf est payée.
   Règle miroir de la contrainte SQL payments.valideur_obligatoire.
   ── FLUX CONSIGNÉS (écran par écran) ─────────────────────────────────────────
   EN LIGNE (Bon d’achat PayEnCash) :
     mode/05 · fly/01 (comment payer)    → le client saisit le code de son bon, vérifié par bonValider
                                           → payer(ref, {par:'bon', bon}) : le bus le débite et solde la commande
   (18/09, soir) LE FLUX « À DOMICILE (agent) » A DISPARU : fly/05-recherche-agent, coursier/06-scan-code et
   coursier/07-encaissement sont partis avec l'agent de caisse mobile, et avec eux le déclarant par:'agent'.
   Personne ne se déplace plus compter des espèces : le client achète son Bon d’achat PayEnCash au comptoir
   d'un commerce — ou à un distributeur mobile qui vient jusqu'à lui — puis règle avec.
   La réf canonique vient de PEC_DATA.scenario.refPaiement (le littéral n'est qu'un
   filet si le data-layer ne charge pas). Le banc rejoue le flux en ligne : BUS·218. */
(function () {
  var P = 'pec_bus_';
  function lire(k) { try { return JSON.parse(localStorage.getItem(P + k) || 'null'); } catch (e) { return null; } }
  /* ── (11/09) UNE ÉCRITURE QUI ÉCHOUE SE DIT — Y COMPRIS ICI ────────────────────────────────────────────────
     `ecrire` avalait l'exception. Or TOUT passe par elle : la commande annoncée, le paiement, le dépôt, la
     reprise de caisse, le rapprochement. Stockage plein, navigation privée, quota d'un iPhone bien rempli —
     et `payer()` répondait `{ok:true}` sur une commande qui n'existait nulle part. Le client voit « réglé »,
     le manager ne verra jamais l'argent. Elle renvoie maintenant si elle a écrit, et retient le
     dernier échec pour que les écrans puissent le dire. ── */
  var ECHEC = null;
  function ecrire(k, v) {
    var ok = true;
    try { localStorage.setItem(P + k, JSON.stringify(v)); }
    catch (e) { ok = false; ECHEC = { cle: k, at: Date.now(), motif: (e && e.name === 'QuotaExceededError') ? 'stockage plein' : ((e && e.message) || 'écriture refusée') }; }
    // l'événement 'storage' n'atteint JAMAIS l'onglet qui écrit (spec) : on
    // notifie aussi l'onglet courant — les listes se rafraîchissent en direct (28/08)
    try { window.dispatchEvent(new CustomEvent('pec-bus', { detail: { cle: k, ecrit: ok } })); } catch (e2) {}
    return ok;
  }
  // Le message qu'un écran affiche quand le bus n'a pas pu écrire : jamais un succès muet.
  function refusEcriture(quoi) {
    var m = (ECHEC && ECHEC.motif) || 'écriture refusée';
    return { ok: false, motif: 'stockage', message: quoi + ' n\'a PAS été enregistré (' + m + ') — libère de la place sur cet appareil et recommence ; rien n\'a été pris en compte.' };
  }

  window.PEC_BUS = {
    // CLIENT → la commande part vers le back-office, en attente de son règlement
    annoncerCommande: function (ref, data) {
      if (!ref) return { ok: false, motif: 'sans_ref', message: 'Aucune référence de commande.' };
      var c = lire('cmd_' + ref) || {}, neuve = !c.ref;
      if (c.statut === 'paye') return { ok: false, motif: 'deja_reglee', commande: c, message: 'Commande déjà réglée — elle ne se ré-annonce pas.' };   // déjà soldée : ne pas rétrograder
      /* (09/09 — lot 3 courses à domicile) UNE COMMANDE CLOSE NE RESSUSCITE PAS. Les écrans de suivi (client) et de recherche
         ré-annonçaient au CHARGEMENT : rouvrir son suivi après une annulation ou une expiration remettait la commande
         « à payer » avec son motif, et une expirée ré-expirait en boucle. Une nouvelle commande, c'est une nouvelle référence. */
      if (c.statut === 'annule' || c.statut === 'echec' || c.statut === 'rembourse') {
        return { ok: false, motif: c.statut, commande: c,
          message: 'Commande ' + (c.statut === 'echec' ? 'en échec d\'encaissement' : c.statut === 'annule' ? ('annulée' + (c.motifAnnulation ? ' — ' + c.motifAnnulation : '')) : 'remboursée') + ' : elle ne se relance pas, il faut en créer une nouvelle.' };
      }
      // une commande (ré)annoncée est À PAYER : un pay_ résiduel du même ref
      // (réf réutilisée, cycle antérieur) est purgé — sinon l'écran client la
      // croirait déjà payée (surPaiement). La cohérence vient du statut, pas d'un vestige.
      try { localStorage.removeItem(P + 'pay_' + ref); } catch (e) {}
      if (c.statut !== 'a_payer') this.noter('annonce', ref, { par: 'client', montant: data && data.montant, point: data && data.point });
      // FUSION ADDITIVE (27/08) : les détails déjà connus (trajet, vols, hébergement,
      // bagages…) ne sont JAMAIS perdus — une ré-annonce pauvre ne les écrase pas.
      var fusion = Object.assign({ ref: ref, at: c.at || Date.now(), statut: 'a_payer' }, c);
      var d = data || {};
      // (04/09 — bascule de canal) une valeur NULL efface la clé : re-choisir un moyen de paiement retire de la
      // commande les clés de l'ancien — undefined reste ignoré (fusion additive).
      for (var k in d) { if (d[k] === null) delete fusion[k]; else if (d[k] !== undefined) fusion[k] = d[k]; }
      this._poseClient(fusion, d);   // (09/09 — lot 1 socle) la commande porte le COMPTE, plus seulement un nom
      /* (18/09) UN BON D’ACHAT APPLIQUÉ SUIT LA RÉ-ANNONCE. Les tunnels ré-annoncent leur montant BRUT à chaque choix de moyen : sans
         cette règle, la part du bon d’achat disparaissait du dû. Un montant égal au net courant ne change rien ; un montant nouveau
         devient le brut, et la part du bon d’achat est recalculée (au plus son solde vif). */
      try {
        if (fusion.bonApplique && !fusion.bonApplique.consommeAt && d.montant !== undefined && d.montant !== null) {
          var numB = function (x) { return Math.round((parseFloat(String(x == null ? '' : x).replace(/\s/g, '').replace(',', '.')) || 0) * 100) / 100; };
          var mNew = numB(d.montant), mNet = numB(c.montant);
          if (Math.abs(mNew - mNet) < 0.005) { fusion.montant = c.montant; fusion.montantBrut = c.montantBrut; }
          else {
            var DB = window.PEC_DATA, vB = (DB && DB.bonValider) ? DB.bonValider(fusion.bonApplique.code, { clientId: fusion.clientId || fusion.bonApplique.clientId || null, montant: mNew }) : null;
            var partB = vB && vB.ok ? Math.min(vB.applicable, mNew) : 0;
            fusion.montantBrut = mNew.toFixed(2).replace('.', ',');
            if (partB > 0.004) { fusion.bonApplique = Object.assign({}, fusion.bonApplique, { montant: Math.round(partB * 100) / 100 }); fusion.montant = (Math.round((mNew - partB) * 100) / 100).toFixed(2).replace('.', ','); }
            else { delete fusion.bonApplique; delete fusion.montantBrut; fusion.montant = fusion.montantBrut ? fusion.montantBrut : d.montant; }
          }
        }
      } catch (eBA) {}
      /* (18/09, soir — l'agent de caisse mobile est abandonné) LA RÉPARTITION ESPÈCES / CARTE N'A PLUS D'OBJET. Elle
         existait parce qu'au-delà du plafond légal des espèces (art. L112-6 CMF), la part au-dessus devait passer par
         le terminal de l'agent — « le bon d’achat » s'arrêtait là. Les deux moyens d'aujourd'hui n'ont pas ce
         problème : le client paie son bon d’achat ou son ticket en espèces AU COMPTOIR d'un commerce, et ce qu'il règle
         ensuite sur le site est déjà prépayé. Le plafond qui vaut est celui du Bon d’achat (250 € par bon d’achat, 1 000 € par
         client et par jour), et il se dit à « Comment payer ». */
      fusion.statut = 'a_payer';
      /* (18/09, soir) LA NAISSANCE D'UNE COURSE À DOMICILE (fenêtre propre, position dérivée de l'adresse, code de
         sécurité émis au client) et la RÈGLE D'ABUS qui suspendait le domicile après trop d'annulations sont parties
         avec l'agent de caisse mobile : il n'y a plus de course, donc plus d'adresse à géocoder ni de code à émettre.
         La fenêtre unique ci-dessous, elle, vaut pour TOUTE commande — c'est le délai du code de paiement. */
      /* ══ (11/09 — constats C6 & C15 du 09/09) UNE SEULE FENÊTRE, POUR TOUTE COMMANDE ══════════════════════
         `expireTs` n'était posé que sur une course à domicile. Deux conséquences, chacune vécue par le client :
         ① Le code de paiement d'une commande AU POINT n'expirait nulle part dans le bus. Passé le délai, l'écran
            du client disait « expiré » pendant que le partenaire, lui, l'encaissait encore — argent pris sur une
            commande que le client croyait annulée.
         ② Faute d'échéance, les lecteurs retombaient sur leur propre repli (60 min dans « Mes codes », dans le fil
            de notifications et côté Fly) quand la page de paiement, elle, affichait 120 min. Deux comptes à rebours
            pour la même commande. Les trois lecteurs préfèrent déjà `expireTs` : il suffisait de le poser. */
      try {
        /* (11/09, revue) LA FENÊTRE PART DU CODE, PAS DU DÉPÔT. `at` vient de l'appelant : le tunnel Fly le pose
           au moment où le client TERMINE sa recherche (`commandeEnCoursSet`), et l'étale ensuite dans l'annonce.
           Un client qui revenait chercher son code deux heures plus tard recevait donc une commande née avec
           quelques minutes à vivre — ou déjà morte — pendant que son écran affichait 120 min. Ce qui commence à
           courir, c'est l'ÉMISSION DU CODE : une commande NEUVE part de maintenant. `at` reste l'horodatage du
           dépôt, et une commande déjà annoncée garde son échéance (sauf réaffectation, qui la rouvre). */
        var fen3 = this._fenetreMin();
        // (17/09) UNE seule horloge : une commande neuve dont l'appelant n'a pas daté le dépôt part de SON `at` (posé à la création,
        // ligne 72) — deux Date.now() à cheval sur une milliseconde donnaient expireTs ≠ at + fenêtre (« même milliseconde », lot 9).
        // Un `at` fourni par l'appelant (le tunnel Fly, à la fin de la recherche) peut être vieux : la fenêtre part alors de maintenant.
        if (!fusion.expireTs || fusion.fenetreAt) fusion.expireTs = (fusion.fenetreAt || (neuve && data && data.at ? Date.now() : fusion.at)) + fen3 * 60000;
      } catch (eF3) {}
      // (11/09) une commande « annoncée » qui n'est écrite nulle part, c'est un client qui attend un code que personne n'a émis
      if (!ecrire('cmd_' + ref, fusion)) return refusEcriture('La commande ' + ref);
      return { ok: true, commande: fusion };
    },
    /* (09/09 — revue lot 3) LA FENÊTRE D'ENCAISSEMENT SE LIT EN UN SEUL ENDROIT : trois copies la relisaient (annonce,
       expiration, réaffectation) et deux d'entre elles ignoraient le paramètre VIF — une fenêtre reconfigurée n'était
       appliquée qu'à la naissance de la commande. */
    _fenetreMin: function () {
      var fen = 120;
      try {
        var D = window.PEC_DATA;
        if (D && D.param) { var v = D.param('scenario.fenetreEncaissementMinutes', D.scenario && D.scenario.fenetreEncaissementMinutes); if (typeof v === 'number' && v > 0) fen = v; }
        else if (D && D.scenario && D.scenario.fenetreEncaissementMinutes > 0) fen = D.scenario.fenetreEncaissementMinutes;
      } catch (e) {}
      return fen;
    },
    /* (18/09, soir) L'APPEL DE SÉCURISATION DE LA PREMIÈRE COMMANDE À DOMICILE est parti avec l'agent de caisse
       mobile : il protégeait un salarié qui allait sonner chez un client inconnu. Plus de déplacement, plus d'appel. */
    /* ── CANAL SAV (fondatrice 27/08) : la modale « problème de réservation »
          OUVRE une demande ici — l'app hotline la voit EN DIRECT. La réf du
          ticket (PEC-, CMD-) reste la clé commune ; l'assignation suit le
          PLANNING (hôte en poste), jamais « au premier qui la voit ». ── */
    /* id UNIQUE par compteur — plusieurs utilisateurs / plusieurs demandes en même
       temps ne se marchent jamais dessus (Date.now() collisionnait). */
    seq: function () {
      var n = parseInt(localStorage.getItem(P + 'seq') || '1000', 10) + 1;
      try { localStorage.setItem(P + 'seq', String(n)); } catch (e) {}
      return n;
    },
    /* ── CANAL KYC (spec-kyc-verifications, 28/08) : le client SOUMET, le
          prestataire PVID INSTRUIT (avis consultatif), la HOTLINE DÉCIDE d'un
          CLIC — aucune bascule automatique (miroir de la règle paiement).
          États : transmise_pvid → a_controler → validee | refusee | a_refaire. ── */
    ouvrirVerification: function (d) {
      d = this._poseClient(Object.assign({}, d || {}), d);   // (09/09 — lot 1 socle) la vérification porte le COMPTE
      var id = 'KYC-' + this.seq();
      var v = Object.assign({ id: id, at: Date.now(), statut: 'transmise_pvid', evenements: [{ acteur: 'client', evenement: 'soumission (pièce + selfie → prestataire)', at: Date.now() }] }, d || {});
      /* ══ (11/09 — constat C28 du 09/09) L'AVIS DU PRESTATAIRE NE REGARDAIT AUCUNE PIÈCE ═══════════════════
         Il rendait « conforme · score 0,97 » à TOUS LES COUPS, sans jamais ouvrir le dossier — une vérification
         ouverte sur un coffre vide s'annonçait donc conforme, et c'est ce que le conseiller lisait avant de
         trancher. Deux vérités pour un même dossier : l'avis mock d'un côté, les pièces de l'autre.
         L'adaptateur (toujours un mock, il le dit) rend maintenant ce que le COFFRE permet de dire : conforme
         quand les pièces obligatoires sont là et validées, « incomplet » sinon, avec ce qui manque. */
      var _et = null;
      try { if (window.PEC_DOCS && PEC_DOCS.etat && v.clientId) _et = PEC_DOCS.etat('client', v.clientId); } catch (eK) {}
      var _manque = _et ? (_et.manquantes || []) : null;
      /* CE QU'ON EXIGE DU DÉPOSANT, ET RIEN DE PLUS : aucune pièce obligatoire manquante, aucune refusée. Ni
         `etat === 'valide'` (qui réclame en plus l'envoi au contrôle — une vérification arrivée ici l'a été),
         ni `complet()` (qui attend AUSSI la contresignature PayEnCash des CGU : la balle est chez nous, pas
         chez le client — l'exiger bloquerait toute validation). Sans coffre lisible (parcours hors compte),
         l'avis reste consultatif. */
      var _ok = _et ? (!(_et.manquantes || []).length && !(_et.refusees || []).length) : true;
      v.pvid = _et
        ? { ref: 'PVID-' + id.slice(4), resultat: _ok ? 'conforme' : 'incomplet', score: _ok ? 0.97 : null, mock: true,
            manquantes: _manque.map(function (p) { return p.label || p.id; }) }
        : { ref: 'PVID-' + id.slice(4), resultat: 'non instruit', score: null, mock: true, motif: 'aucun dossier rattaché à un compte' };
      v.statut = _ok ? 'a_controler' : 'a_completer';
      v.evenements.push({ acteur: 'pvid', at: Date.now(), evenement: _ok
        ? 'résultat prestataire : conforme · score 0,97 (adaptateur mock, pièces du coffre lues)'
        : 'résultat prestataire : dossier incomplet — ' + ((v.pvid.manquantes || []).join(', ') || (v.pvid.motif || 'pièces non lisibles')) + ' (adaptateur mock)' });
      // (11/09) une vérification qui ne s'écrit pas, c'est un client qui attend un contrôle que personne n'a reçu
      if (!ecrire('kyc_' + id, v)) return refusEcriture('Ta demande de vérification');
      return v;
    },
    verifications: function () {
      var l = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(P + 'kyc_') === 0) { var v = lire(k.slice(P.length)); if (v) l.push(v); }
      }
      return l.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    },
    deciderVerification: function (id, decision, motif, par) {
      // decision : 'validee' | 'refusee' | 'a_refaire' — motif OBLIGATOIRE hors validation
      var v = lire('kyc_' + id); if (!v) return null;
      if (decision !== 'validee' && !(motif || '').trim()) return null;
      /* (11/09 — C28) ON NE VALIDE PAS UNE IDENTITÉ SANS REGARDER LES PIÈCES. La décision s'écrivait sans
         jamais consulter le coffre : une vérification pouvait passer « validée » alors que la pièce d'identité
         manquait, attendait encore un contrôle, ou venait d'être REFUSÉE par le manager. Le coffre fait foi. */
      if (decision === 'validee' && v.clientId) {
        var complet = true, det = '';
        try {
          if (window.PEC_DOCS && PEC_DOCS.etat) {
            var e = PEC_DOCS.etat('client', v.clientId);
            complet = !(e.manquantes || []).length && !(e.refusees || []).length;
            det = [].concat((e.manquantes || []).map(function (p) { return p.label || p.id; }),
                            (e.refusees || []).map(function (p) { return (p.label || p.id) + ' (refusée)'; })).join(', ') || 'dossier non lisible';
          }
        } catch (eD) {}
        if (!complet) return { ok: false, motif: 'Dossier incomplet au coffre : ' + det + ' — on ne valide pas une identité sur un avis de prestataire.', verification: v };
      }
      v.statut = decision;
      v.motif = (motif || '').trim() || null;
      v.decidePar = par || 'hotline';
      v.decideAt = Date.now();
      v.evenements.push({ acteur: 'hote', evenement: 'décision : ' + decision + (motif ? ' — ' + motif : '') + ' (par ' + (par || 'hotline') + ')', at: Date.now() });
      // (11/09) la décision D'ABORD, la trace ensuite — un verdict journalisé que le client ne verra jamais n'est pas un verdict
      if (!ecrire('kyc_' + id, v)) return refusEcriture('La décision sur la vérification ' + id);
      this.noter('kyc', id, { decision: decision, par: par });
      return v;
    },

    ouvrirDemande: function (d) {
      d = this._poseClient(Object.assign({}, d || {}), d);   // (09/09 — lot 1 socle) la demande porte le COMPTE
      var n = this.seq();
      var id = (d.type === 'reclamation' ? 'REC-' : d.type === 'conversation' ? 'CNV-' : 'INF-') + n;
      var hote = (window.PEC_DATA && PEC_DATA.hoteEnPoste) ? PEC_DATA.hoteEnPoste() : null;
      // (08/09 — audit hotline) l'ÉCHÉANCE est une DATE (dueAt = ouverture + ref.hotline.rappelDelaiMin), plus une chaîne « rappel sous
      // 15 min » écrite ici ; le libellé `due` reste dérivé pour les écrans. Un retard se DÉRIVE à la lecture (demandesSav → enRetard).
      var delaiMin = ((window.PEC_DATA && PEC_DATA.ref && PEC_DATA.ref.hotline) || {}).rappelDelaiMin || 15;
      var clos = d.statut && d.statut.indexOf('clot') === 0, at = Date.now();
      var dem = Object.assign({ id: id, at: at, canal: 'app', statut: 'en_cours',
        assigne: hote ? hote.nom : null, assigneSource: hote ? 'planning' : null,
        dueAt: clos ? null : at + delaiMin * 60000, due: clos ? '—' : 'rappel sous ' + delaiMin + ' min' }, d, { id: id });
      /* ══ (11/09 — constat C1 du 09/09) LE MESSAGE DU CLIENT EST LE PREMIER ÉCHANGE ═══════════════════════
         Le formulaire de contact et la réclamation Mode passaient le message dans `texte` — et RIEN ne le
         convertissait en `echanges`. La hotline, qui ne lit que ce fil, affichait « Aucun échange consigné »
         sur un dossier ouvert justement parce que quelqu'un avait écrit : le conseiller devait répondre à une
         question qu'il ne voyait pas. Un seul point de passage, tous les émetteurs rattrapés. */
      if (dem.texte && !(dem.echanges && dem.echanges.length)) {
        dem.echanges = [{ qui: 'moi', texte: String(dem.texte).trim(), at: at, par: dem.client || 'client' }];
        dem.derniereReponseClientAt = at;
      }
      /* (11/09) UNE DEMANDE NON ÉCRITE N'EST PAS UNE DEMANDE. L'écriture était avalée et le journal recevait
         « sav » quand même : l'écran annonçait un numéro de dossier à quelqu'un qui attendait un rappel que
         personne ne verrait jamais arriver. */
      if (!ecrire('sav_' + id, dem)) return null;
      this.noter('sav', d.ref || '—', { par: d.source === 'satisfaction' ? 'systeme' : 'client', sujet: d.sujet, demande: id, statut: dem.statut, source: d.source || 'app' });
      return dem;
    },
    /* (08/09 — audit hotline) LE CONSEILLER RÉPOND : l'échange s'écrit sur la demande (qui:'hote', par = l'hôte), le client le lit dans
       son Assistance et dans son fil de notifications. Avant, « Chat en direct » était en lecture seule. */
    repondreDemande: function (id, texte, par, qui) {
      var d = lire('sav_' + id); if (!d) return { ok: false, motif: 'Demande introuvable.' };
      texte = String(texte || '').trim(); if (!texte) return { ok: false, motif: 'Le message est vide.' };
      if ((d.statut || '').indexOf('clot') === 0) return { ok: false, motif: 'La demande est close : rouvre-la avant de répondre.' };
      qui = qui === 'moi' ? 'moi' : 'hote';   // 'moi' = le CLIENT répond dans son fil (support_messages.auteur = client), sinon l'hôte
      d.echanges = d.echanges || [];
      d.echanges.push({ qui: qui, texte: texte, at: Date.now(), par: qui === 'hote' ? (par || 'hotline') : (par || d.client || 'client') });
      if (qui === 'hote') d.derniereReponseAt = Date.now(); else d.derniereReponseClientAt = Date.now();
      // (11/09) un message « envoyé » qui n'est écrit nulle part, c'est un client qui attend une réponse à une question que personne n'a reçue
      if (!ecrire('sav_' + id, d)) return refusEcriture('Ton message');
      this.noter('sav_reponse', d.ref || '—', { par: qui === 'hote' ? (par || 'hotline') : 'client', demande: id, qui: qui });
      return { ok: true, demande: d };
    },
    /* (08/09) RÉASSIGNER : la superviseure (ou l'hôte qui « prend ») change l'assigné — tracé, source 'reprise' */
    assignerDemande: function (id, nom, par) {
      var d = lire('sav_' + id); if (!d || !nom) return null;
      d.assigne = nom; d.assigneSource = 'reprise'; d.assigneAt = Date.now(); ecrire('sav_' + id, d);
      this.noter('sav_assignation', d.ref || '—', { par: par || 'hotline', demande: id, assigne: nom });
      return d;
    },
    assignerAppel: function (id, nom, par) {
      var a = lire('apl_' + id); if (!a || !nom) return null;
      a.assigne = nom; a.assigneSource = 'reprise'; a.assigneAt = Date.now(); ecrire('apl_' + id, a);
      this.noter('appel_assignation', a.ref || '—', { par: par || 'hotline', appel: id, assigne: nom });
      return a;
    },
    /* ── CANAL APPELS (audit 27/08) : le RAPPEL demandé (assistance) et l'appel de
          SÉCURISATION 1ʳᵉ commande (fly/05) REMONTENT ici — la hotline les voit en
          direct. Assignation : l'hôte EN POSTE du planning. Les appels ENTRANTS
          (0805) n'ont pas de source in-app : exemples du data-layer, étiquetés. ── */
    demanderAppel: function (a) {
      a = this._poseClient(Object.assign({}, a || {}), a);   // (09/09 — lot 1 socle) l'appel porte le COMPTE
      var id = 'APL-' + this.seq(), at = Date.now();
      var hote = (window.PEC_DATA && PEC_DATA.hoteEnPoste) ? PEC_DATA.hoteEnPoste() : null;
      // (08/09 — audit hotline) l'ÉCHÉANCE se calcule du référentiel (ref.hotline) selon le type ; le libellé `quand` en dérive.
      // Un appel ENTRANT (0 805) journalisé par l'hôte naît déjà « fait », signé par lui.
      var R = ((window.PEC_DATA && PEC_DATA.ref && PEC_DATA.ref.hotline) || {});
      var dueAt = a.type === 'rappel' ? at + (R.rappelDelaiMin || 15) * 60000
                : a.type === 'bienvenue' ? at + (R.bienvenueDelaiH || 24) * 3600000
                : a.type === 'retour_j1' ? at + (R.retourJ1Jours || 1) * 86400000 : null;
      var quand = a.type === 'rappel' ? 'sous ' + (R.rappelDelaiMin || 15) + ' min'
                : a.type === 'bienvenue' ? 'sous ' + (R.bienvenueDelaiH || 24) + ' h (accompagnement lancement)'
                : a.type === 'retour_j1' ? 'J+' + (R.retourJ1Jours || 1) + ' après le voyage'
                : a.type === 'entrant' ? 'reçu' : 'dès que possible';   // (18/09, soir) le repli disait « avant le départ de l'agent » : plus personne ne part
      var entrant = a.type === 'entrant';
      var apl = Object.assign({ id: id, at: at, statut: entrant ? 'fait' : 'a_faire',   // (07/09) le mot de SQL (hotline_calls.status)
        assigne: entrant ? (a.hote || null) : (hote ? hote.nom : null), assigneSource: entrant ? 'reprise' : (hote ? 'planning' : null),
        priorite: a.type === 'rappel' || a.type === 'securisation' ? 'haute' : 'normale',
        dueAt: dueAt, quand: quand }, a, { id: id });
      if (entrant) { apl.faitAt = at; apl.faitPar = a.hote || 'hotline'; }
      ecrire('apl_' + id, apl);
      this.noter('appel', a.ref || '—', { par: entrant ? (a.hote || 'hotline') : (a.par || 'client'), type: a.type, canal: a.canal, appel: id, statut: apl.statut });
      return apl;
    },
    appels: function () {
      var out = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(P + 'apl_') === 0) { var v = lire(k.slice(P.length)); if (v) out.push(v); }
      }
      return out.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    },
    traiterAppel: function (id, extra) {
      extra = extra || {};   // (03/09) qui a passé l'appel : hôte de la session hotline, sinon 'hotline'
      var a = lire('apl_' + id); if (!a) return null;
      // (08/09 — audit hotline) l'issue est un mot de SQL (hotline_calls.status) : fait · sans_reponse · rappeler ; le compte rendu
      // (notes) est conservé et le client le lit ; « sans réponse » reste en file pour être retenté
      var issue = extra.statut === 'sans_reponse' || extra.statut === 'rappeler' ? extra.statut : 'fait';
      a.statut = issue; a.faitAt = Date.now(); a.faitPar = extra.par || 'hotline';
      if (extra.compteRendu) a.compteRendu = String(extra.compteRendu).trim();
      a.tentatives = (a.tentatives || 0) + 1;
      ecrire('apl_' + id, a);
      this.noter('appel', a.ref || '—', { par: a.faitPar, appel: id, statut: issue, tentatives: a.tentatives });
      return a;
    },

    demandesSav: function () {
      var out = [], now = Date.now();
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(P + 'sav_') === 0) { var v = lire(k.slice(P.length)); if (v) out.push(v); }
      }
      // (08/09) EN RETARD se dérive : en cours, échéance passée, aucune réponse de l'hôte depuis — jamais un statut écrit
      out.forEach(function (d) { d.enRetard = d.statut === 'en_cours' && !!d.dueAt && d.dueAt < now && !(d.derniereReponseAt && d.derniereReponseAt >= d.dueAt - 0); });
      return out.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    },
    cloreDemande: function (id, statut, extra) {
      extra = extra || {};   // (03/09) l'acteur de la clôture (hotline, manager) est porté par l'appelant
      var d = lire('sav_' + id); if (!d) return;
      // (08/09 — audit hotline) l'hôte CLÔT ('cloturee') ; « satisfait / insatisfait » vient de la NOTE du client (satisfactionAjouter)
      d.statut = statut || 'cloturee'; d.cloAt = Date.now(); if (extra.par) d.cloPar = extra.par; if (extra.note) d.note = extra.note;
      // (09/09 — lot 1 socle) LA DÉCISION est portée par la demande : 27-assistance la reconstruisait depuis le journal (tronqué)
      d.decision = { statut: d.statut, par: extra.par || 'hotline', at: d.cloAt, commande: extra.commande || d.ref || null, mode: extra.mode || null, motif: extra.motif || '' };
      ecrire('sav_' + id, d);
      this.noter('sav', d.ref || '—', { par: extra.par || 'hotline', demande: id, statut: d.statut, motif: extra.motif || '' });
    },

    commandes: function () {
      var out = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(P + 'cmd_') === 0) { var v = lire(k.slice(P.length)); if (v) out.push(v); }
      }
      /* Une commande « à payer » que personne n'a réglée dans la fenêtre du code (scenario.fenetreEncaissementMinutes,
         la même que le prix bloqué côté client) EXPIRE : 'annule' par le système, motif tracé. Dérivé à la lecture,
         donc valable pour les commandes créées avant cette règle. */
      var fen = this._fenetreMin();
      var limite = Date.now() - fen * 60000, self3 = this;
      /* (11/09, revue) ON N'ÉCRIT PAS DEPUIS LA LECTURE, EN PLEINE BOUCLE. `ecrire` réveille les écrans
         SYNCHRONEMENT (événement `pec-bus`) : expirer la première commande relançait le rendu, qui rappelait
         `commandes()`, qui expirait la deuxième, et ainsi de suite — une réentrance en escalier, des
         notifications en double et un rendu qui travaillait sur une liste déjà périmée. On REPÈRE d'abord,
         on applique ENSUITE, une seule fois, et on relit chaque commande juste avant de l'écrire (un autre
         onglet a pu la payer entre-temps). */
      var aExpirer = [];
      out.forEach(function (c) {
        // (11/09 — C15) toute commande a son échéance : `expireTs` d'abord, l'âge en repli pour celles d'avant cette règle
        var _exp = c.expireTs ? (c.expireTs < Date.now()) : ((c.fenetreAt || c.at) && (c.fenetreAt || c.at) < limite);
        if (c.statut === 'a_payer' && _exp) aExpirer.push(c);   // (09/09) fenetreAt = rouverte par une réaffectation
      });
      aExpirer.forEach(function (c) {
        var frais = lire('cmd_' + c.ref);
        if (!frais || frais.statut !== 'a_payer') return;   // payée ou annulée entre-temps : on ne la ferme pas
        c.statut = 'annule'; c.annuleAt = Date.now(); c.annulePar = 'systeme';
        c.motifAnnulation = 'expirée — le code de paiement a dépassé sa fenêtre (' + fen + ' min), le client peut la relancer';
        // (09/09 — lot 3) l'EXPIRATION est explicite (plus une regex sur le motif — miroir orders.expired_at).
        c.expire = true; c.expireAt = c.annuleAt;
        /* (11/09 — constat C5) LES PIÈCES RETENUES REVIENNENT À LA VENTE. Le relâchement ne vivait que dans
           `libererCommande`, qui ne connaît que la commande en cours de CE navigateur : un client qui fermait
           son onglet retirait la pièce du catalogue pour toujours. L'expiration se dérivant à la lecture, la
           libération suit — depuis n'importe quel écran, et la file d'attente est notifiée. */
        try { if (window.PEC_DATA && PEC_DATA.libererReservationsDe) PEC_DATA.libererReservationsDe(c.ref, 'commande expirée'); } catch (eR3) {}
        ecrire('cmd_' + c.ref, c);
        try { window.PEC_BUS.noter('commande_expiree', c.ref, { par: 'systeme', fenetreMin: fen }); } catch (e2) {}
      });
      return out.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    },
    commande: function (ref) { return lire('cmd_' + ref); },
    // LE JOURNAL — la trace de ce qui fait basculer le client
    noter: function (evt, ref, data) {
      // JOURNAL DES FLUX (fondatrice 27/08) : chaque événement inter-apps est
      // consigné — qui a fait quoi, quand. Consultable : manager/27-journal-flux.
      /* (09/09 — lot 1 socle) LE JOURNAL EST UNE TRACE, PLUS UNE BASE DE DONNÉES. Il était plafonné à 200 entrées ET relu comme
         source d'ÉTAT (virements de commission, étape d'un prospect, jeton de signature, participations au concours,
         envois, notations, vérification du flashcode…) : passé 200 événements, ces états
         DISPARAISSAIENT — une commission pouvait être virée deux fois. Chaque état a désormais son magasin
         (etatGet/etatSet ici, ou l'entité elle-même) ; le journal ne sert plus qu'à l'audit, avec un plafond ASSUMÉ et dit
         à l'écran (manager/11), jamais silencieux. */
      try {
        var j = JSON.parse(localStorage.getItem(P + 'journal') || '[]');
        j.unshift(Object.assign({ evt: evt, ref: ref, at: Date.now() }, data || {}));
        var cap = this.JOURNAL_MAX;
        if (j.length > cap) { j = j.slice(0, cap); }
        localStorage.setItem(P + 'journal', JSON.stringify(j));
      } catch (e) {}
      // le CATALOGUE des messages transactionnels est alimenté ici, à la source (un seul point de branchement)
      try { if (window.PEC_DATA && PEC_DATA.envoiPlanifier) PEC_DATA.envoiPlanifier(evt, ref, data || {}); } catch (e2) {}
    },
    JOURNAL_MAX: 1000,   // (09/09) plafond de la TRACE — aucun état n'en dépend
    /* ── ÉTATS PERSISTÉS DU BUS (09/09 — lot 1 socle) : les faits que le journal portait à tort. Rangés dans l'espace du bus
          (pec_bus_etat_…) : ils suivent le même cycle de vie que les commandes et sont remis à zéro par PEC_BUS.reset(). ── */
    /* ── L'IDENTITÉ DE COMPTE (09/09 — lot 1 socle) ─────────────────────────────────────────────────────────
       Le bus ne posait JAMAIS d'identité : une commande, une demande, un appel, une vérification ne portaient qu'un NOM
       en clair. Tout se joignait donc par le nom — deux homonymes partageaient leurs réservations, leurs tickets et leur
       vérification d'identité ; le RIB du remboursement par virement (clientRibPour(c.clientId)) n'était jamais retrouvé.
       Le bus pose désormais l'id LUI-MÊME, et seulement depuis une APP CLIENT (Mode, Fly, écrans, parcours) : une app
       partenaire, fournisseur ou manager n'attribue jamais un compte qu'elle ne détient pas. Un appelant qui sait mieux passe
       `clientId` explicitement ; `clientId: null` reste un effacement volontaire (règle du 04/09). */
    _espaceCourant: function () { try { var m = String(location.pathname || '').match(/\/ui\/([a-z]+)\//); return m ? m[1] : null; } catch (e) { return null; } },
    _estAppClient: function () { return ['mode', 'fly', 'ecrans', 'parcours'].indexOf(this._espaceCourant()) > -1; },
    _clientCourant: function () { try { return (window.PEC_DATA && PEC_DATA.clientActifGet) ? (PEC_DATA.clientActifGet() || null) : null; } catch (e) { return null; } },
    _poseClient: function (obj, data) {
      if (data && data.clientId !== undefined) return obj;              // l'appelant a tranché (id ou null volontaire)
      if (obj.clientId) return obj;                                     // déjà porté (fusion additive)
      if (!this._estAppClient()) return obj;                            // geste d'un autre espace : on n'invente pas un compte
      var id = this._clientCourant(); if (id) obj.clientId = id;
      return obj;
    },
    etatGet: function (cle, defaut) { var v = lire('etat_' + cle); return v == null ? (defaut === undefined ? null : defaut) : v; },
    // (11/09) un état qui n'a pas pu être écrit le DIT à son appelant : la liste qu'il repeint n'existerait pas au rechargement
    etatSet: function (cle, valeur) { return ecrire('etat_' + cle, valeur) ? valeur : null; },
    /* Le dernier refus d'écriture du bus — un écran peut le dire, le banc peut le vérifier. `null` = tout va bien. */
    dernierEchecEcriture: function () { return ECHEC ? { cle: ECHEC.cle, at: ECHEC.at, motif: ECHEC.motif } : null; },
    oublierEchecEcriture: function () { ECHEC = null; },
    journal: function () {
      try { return JSON.parse(localStorage.getItem(P + 'journal') || '[]'); } catch (e) { return []; }
    },
    viderJournal: function () { try { localStorage.removeItem(P + 'journal'); } catch (e) {} },
    numeroRecu: function () {
      var pfx = 'PEC';
      try { pfx = (window.PEC_DATA && PEC_DATA.ref && PEC_DATA.ref.prefixeRecu) || pfx; } catch (e) {}
      return pfx + '-' + this.seq();
    },
    /* ══ (18/09) LE BON D’ACHAT PAYENCASH SUR UNE COMMANDE ══════════════════════════════════════════════════════════════════
       bonAppliquer(ref, code, clientId) : le bon d’achat est APPLIQUÉ — sa part (au plus son solde, au plus le dû, au plus ce que le
       plafond du jour laisse) est retirée du montant à régler ; le bon d’achat n'est DÉBITÉ qu'au règlement (payer), jamais avant :
       une commande expirée ou annulée le laisse intact. Un reste de zéro se règle par payer(ref, {par:'bon'}) ; un reste
       positif se règle par un autre déclarant, qui débite la part du bon d’achat en même temps. ══ */
    bonAppliquer: function (ref, code, clientId) {
      var D = window.PEC_DATA; if (!D || !D.bonValider) return { ok: false, motif: 'indisponible', message: 'Le Bon d’achat PayEnCash n\'est pas disponible sur cet appareil.' };
      var c = lire('cmd_' + ref); if (!c || !c.ref) return { ok: false, motif: 'inconnue', message: 'Commande inconnue : annonce-la avant d\'y appliquer un bon d’achat.' };
      if (c.statut !== 'a_payer') return { ok: false, motif: c.statut, message: 'Cette commande n\'est plus à régler (' + c.statut + ').' };
      var num = function (x) { return parseFloat(String(x == null ? '' : x).replace(/\s/g, '').replace(',', '.')) || 0; }, rd = function (x) { return Math.round(x * 100) / 100; };
      var brut = c.bonApplique && !c.bonApplique.consommeAt ? num(c.montantBrut) : num(c.montant);
      if (!(brut > 0)) return { ok: false, motif: 'montant', message: 'Aucun montant à régler sur cette commande.' };
      var cid = clientId || c.clientId || null;
      var v = D.bonValider(code, { clientId: cid, montant: brut });
      if (!v.ok) return { ok: false, motif: 'bon_refuse', message: v.motif, bon: v.bon || null };
      /* (21/09) UN SECOND BON NE REMPLACE PAS LE PREMIER EN SILENCE. La commande ne garde qu'un bon en attente
         (`bonApplique`) : appliquer un autre code écrasait le premier — la cliente croyait les deux posés, l'écran
         n'en comptait qu'un. Le second règle le reste au paiement (payer par:'bon', deux débits liés) ; pour en
         changer, on retire d'abord le premier. Réappliquer le MÊME code recalcule sa part. */
      if (c.bonApplique && !c.bonApplique.consommeAt && c.bonApplique.code !== v.bon.code)
        return { ok: false, motif: 'bon_deja_applique', message: 'Un bon d’achat est déjà appliqué à cette commande : présente un bon qui règle tout le reste, ou retire le premier.' };
      var part = rd(Math.min(v.applicable, brut));
      if (!(part > 0)) return { ok: false, motif: 'bon_refuse', message: 'Ce bon d’achat ne peut rien régler aujourd\'hui sur ce compte.' };
      c.montantBrut = brut.toFixed(2).replace('.', ',');
      c.bonApplique = { code: v.bon.code, montant: part, at: Date.now(), clientId: cid, plafonne: !!v.plafonne };
      c.montant = rd(brut - part).toFixed(2).replace('.', ',');
      if (!ecrire('cmd_' + ref, c)) return refusEcriture('L\'application du bon d’achat à ' + ref);
      this.noter('bon_applique', ref, { par: 'client', bon: v.bon.code, montant: part, reste: c.montant, clientId: cid });
      return { ok: true, commande: c, part: part, reste: rd(brut - part), soldeApres: rd(v.bon.solde - part), bon: v.bon, plafonne: !!v.plafonne };
    },
    bonRetirer: function (ref) {
      var c = lire('cmd_' + ref); if (!c || !c.bonApplique) return { ok: false, motif: 'aucun', message: 'Aucun bon d’achat appliqué à cette commande.' };
      if (c.bonApplique.consommeAt) return { ok: false, motif: 'consomme', message: 'Le bon d’achat a déjà été débité : la commande est réglée.' };
      var code = c.bonApplique.code; c.montant = c.montantBrut || c.montant; delete c.bonApplique; delete c.montantBrut;
      if (!ecrire('cmd_' + ref, c)) return refusEcriture('Le retrait du bon d’achat de ' + ref);
      this.noter('bon_retire', ref, { par: 'client', bon: code, montant: c.montant });
      return { ok: true, commande: c };
    },
    _debiterBon: function (c, data, du) {
      var D = window.PEC_DATA || null, rd = function (x) { return Math.round(x * 100) / 100; };
      if (!D || !D.bonDebiter) return null;
      var qui = data.par === 'bon' ? 'client' : data.par;
      if (c.bonApplique && c.bonApplique.montant > 0 && !c.bonApplique.consommeAt) {
        /* ══ (20/09 — « au-delà de 250 € ça crée plusieurs bons… les deux sont utilisables ») LE RESTE SE RÈGLE
           PAR UN AUTRE BON ═════════════════════════════════════════════════════════════════════════════
           Le bus refusait ici : « il reste X € après le bon d'achat : choisis un AUTRE MOYEN ». Cette phrase datait
           d'un monde à deux moyens. Il n'en reste qu'un — et le plafond LCB-FT étant PAR BON, une commande de plus
           de 250 € ne PEUT se régler qu'avec plusieurs bons. Refuser le second, c'était rendre impayable tout ce
           que le comptoir vient d'émettre en série.
           LES DEUX DÉBITS VONT ENSEMBLE : si le second échoue, le premier est re-crédité — on ne laisse jamais un
           bon débité pour une commande qui n'est pas réglée. */
        if (data.par === 'bon' && du != null && du > 0.004) {
          if (!data.bon) return { ok: false, motif: 'bon_requis', message: 'Il reste ' + du.toFixed(2) + ' € après le bon d’achat appliqué : présente un second bon pour le solde.' };
          var cidB = c.clientId || c.bonApplique.clientId || null;
          var v2 = D.bonValider(data.bon, { clientId: cidB, montant: du });
          if (!v2.ok) return { ok: false, motif: 'bon_refuse', message: v2.motif };
          if (v2.bon.code === c.bonApplique.code) return { ok: false, motif: 'bon_deja_applique', message: 'Ce bon d’achat est déjà appliqué à cette commande : présente-en un autre pour le reste.' };
          if (v2.applicable + 0.004 < du) return { ok: false, motif: 'bon_insuffisant', message: 'Ce bon d’achat ne couvre que ' + v2.applicable.toFixed(2) + ' € sur les ' + du.toFixed(2) + ' € qui restent : applique-le, puis présente-en un troisième.' };
          var rA = D.bonDebiter(c.bonApplique.code, c.bonApplique.montant, c.ref, cidB, qui);
          if (!rA || !rA.ok) return { ok: false, motif: 'bon_indisponible', message: (rA && rA.motif) || 'Le Bon d’achat PayEnCash appliqué ne peut plus être débité.' };
          var rB = D.bonDebiter(v2.bon.code, du, c.ref, cidB, 'client');
          if (!rB || !rB.ok) {
            try { D.bonRecrediter(c.bonApplique.code, c.bonApplique.montant, c.ref, 'règlement interrompu — le second bon n\'a pas pu être débité', 'systeme'); } catch (eR) {}
            return { ok: false, motif: 'bon_indisponible', message: (rB && rB.motif) || 'Le second bon d’achat ne peut pas être débité.' };
          }
          c.bonApplique.consommeAt = Date.now(); c.bonApplique.resteApres = rA.reste;
          c.bon = { code: v2.bon.code, montant: du, resteApres: rB.reste };
          return { ok: true };
        }
        var r1 = D.bonDebiter(c.bonApplique.code, c.bonApplique.montant, c.ref, c.clientId || c.bonApplique.clientId || null, qui);
        if (!r1 || !r1.ok) return { ok: false, motif: 'bon_indisponible', message: (r1 && r1.motif) || 'Le Bon d’achat PayEnCash appliqué ne peut plus être débité.' };
        c.bonApplique.consommeAt = Date.now(); c.bonApplique.resteApres = r1.reste;
        if (data.par === 'bon') c.bon = { code: c.bonApplique.code, montant: c.bonApplique.montant, resteApres: r1.reste };
        return { ok: true };
      }
      if (data.par === 'bon') {
        if (!data.bon) return { ok: false, motif: 'bon_requis', message: 'Un règlement par Bon d’achat PayEnCash passe le code du bon d’achat.' };
        var mnt = du != null ? du : rd(parseFloat(String(c.montant || '0').replace(',', '.')) || 0);
        if (!(mnt > 0)) return { ok: false, motif: 'montant', message: 'Aucun montant à régler.' };
        var v = D.bonValider(data.bon, { clientId: c.clientId || null, montant: mnt });
        if (!v.ok) return { ok: false, motif: 'bon_refuse', message: v.motif };
        if (v.applicable + 0.004 < mnt) return { ok: false, motif: 'bon_insuffisant', message: 'Ce bon d’achat ne couvre que ' + v.applicable.toFixed(2) + ' € sur ' + mnt.toFixed(2) + ' € : applique-le à la commande, puis présente un autre bon pour le reste.' };
        var r2 = D.bonDebiter(v.bon.code, mnt, c.ref, c.clientId || null, 'client');
        if (!r2 || !r2.ok) return { ok: false, motif: 'bon_indisponible', message: (r2 && r2.motif) || 'Le bon d’achat ne peut pas être débité.' };
        c.bon = { code: v.bon.code, montant: mnt, resteApres: r2.reste };
        return { ok: true };
      }
      return null;
    },
    /* (20/09) LE BUS DIT OÙ IL VIT. Il lit déjà `window.PEC_DATA` partout à l'intérieur ; un outil qui ne
       reçoit que le bus (le banc, la simulation) n'avait, lui, aucun moyen de retrouver LA couche de données
       de CETTE fenêtre — il retombait sur celle de la sienne, qui n'existe pas. Un accesseur, et le problème
       disparaît : le bus et sa donnée ne se perdent plus de vue. */
    donnees: function () { return window.PEC_DATA || null; },
    payer: function (ref, data) {
      data = data || {};
      /* (17/09 — PIVOT ; 18/09, soir) QUI PEUT DÉCLARER UN PAIEMENT : le prestataire en ligne, le manager qui
         enregistre — et (18/09) le BON D’ACHAT PAYENCASH qui couvre toute la commande. La BORNE, le POINT qui encaissait une
         commande et l'AGENT de caisse mobile (par:'agent') n'existent plus — un appelant qui s'en réclame est refusé,
         pas rabattu en silence sur un autre canal. */
      /* (19/09, soir) QUATRIÈME DÉCLARANT : 'soldee' — la commande était DÉJÀ couverte à la seconde où elle est
         née (Bon d’achat PayEnCash et/ou avoir appliqués au sac). Il n'y a rien à encaisser, mais elle est PAYÉE,
         et elle doit le dire : sans ce chemin, elle ne passait « payée » nulle part. Le bon d’achat et l'avoir
         sont débités par reglerCommande, appelé plus bas — jamais deux fois. */
      if (['manager', 'bon', 'soldee'].indexOf(data.par) === -1) {
        this.noter('encaissement_refuse', ref, { motif: 'canal_inconnu', par: data.par || null });
        return { ok: false, motif: 'canal_inconnu', message: 'Canal d\'encaissement inconnu (' + (data.par || 'aucun') + ') : un paiement se déclare par un Bon d’achat PayEnCash, par le manager, ou parce que la commande était déjà soldée.' };
      }
      var c = lire('cmd_' + ref) || { ref: ref };
      /* ══ DEUX VERROUS SUR L'ARGENT (fondatrice 06/09 « sécurise le flux et process commande,
         réservation, paiement point ou à domicile ») ═══════════════════════════════════════
         ① UNE COMMANDE NE S'ENCAISSE QU'UNE FOIS. Elle pouvait être réglée deux fois, dans
            deux points différents : le second écrasait le point et la date, et chaque appel
            notifiait et comptait dans une caisse. Un code déjà réglé ne vaut plus rien — on
            le dit, avec où et quand il l'a été.
         ② LE MONTANT N'EST PAS LIBRE. On pouvait déclarer 1 € sur une commande de 150 € et la
            passer « payée ». Le montant dû est celui ANNONCÉ avec la commande ; un écart est
            refusé. (Tolérance d'un centime : les écrans écrivent « 115,43 », le data-layer
            115.43.) Sans montant annoncé, on accepte celui qui est déclaré — on n'invente pas
            une créance qui n'existe pas. */
      var _eur = function (x) { var n = parseFloat(String(x == null ? '' : x).replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? null : n; };
      if (c.statut === 'paye') {
        this.noter('encaissement_refuse', ref, { motif: 'deja_reglee', par: data.par, point: data.point || null });
        return { ok: false, motif: 'deja_reglee', commande: c,
          message: 'Commande déjà réglée' + (c.point ? ' à ' + c.point : '') + (c.payeAt ? ' le ' + new Date(c.payeAt).toLocaleString('fr-FR') : '') + '.' };
      }
      // (07/09) l'objet du bus porte 'annule' / 'rembourse' (annuler / rembourser) — le contrôle testait les
      // formes FÉMININES, des valeurs qu'il ne reçoit JAMAIS : une commande annulée passait à l'encaissement.
      /* (11/09) MÊME PORTE POUR UNE COMMANDE DÉJÀ FERMÉE PAR LA FENÊTRE : le manager enregistre l'encaissement
         physique, motif à l'appui. Une annulation VOULUE (client, manager) reste, elle, définitive. */
      if (c.statut === 'annule' && c.expire && (data.par || '') === 'manager') {
        c.statut = 'a_payer'; c.horsFenetre = true;
        delete c.annuleAt; delete c.annulePar; delete c.motifAnnulation; delete c.expire; delete c.expireAt;
        this.noter('encaissement_hors_fenetre', ref, { par: data.manager || 'manager', motif: data.motif || '', fenetreMin: this._fenetreMin() });
      }
      if (c.statut === 'annule' || c.statut === 'rembourse') {
        // (11/09 — C15) le journal dit le VRAI motif : « expirée » quand c'est la fenêtre qui a fermé la commande
        this.noter('encaissement_refuse', ref, { motif: c.expire ? 'expiree' : c.statut, par: data.par });
        /* (11/09 — C15) « annulée » ne suffit pas quand c'est la FENÊTRE qui l'a fermée : le partenaire a le client
           devant lui, il doit pouvoir lui dire quoi faire — relancer depuis son app, pas recommencer au comptoir. */
        return { ok: false, motif: c.expire ? 'expiree' : c.statut, commande: c,
          message: c.expire ? ('Commande expirée — la fenêtre de ' + this._fenetreMin() + ' min est dépassée. Le client la relance depuis son app ; rien ne s\'encaisse ici.')
                            : ('Commande ' + (c.statut === 'annule' ? 'annulée' : 'remboursée') + ' — rien à encaisser.') };
      }
      /* (18/09, soir) TROIS GARDES SONT PARTIES AVEC L'AGENT DE CAISSE MOBILE : la course EN ÉCHEC qu'il fallait
         réaffecter avant d'encaisser, le repli sur l'agent de session (`PEC_DATA.agentConnecte`, disparu du socle),
         et le refus d'encaisser la course prise par un collègue. Plus de course, plus d'agent, plus de caisse par
         personne : ce qui reste se règle en ligne ou par un bon d’achat déjà payé au comptoir. */
      var _du = _eur(c.montant), _paye = _eur(data.montant);
      if (_du != null && _paye != null && Math.abs(_du - _paye) > 0.01) {
        this.noter('encaissement_refuse', ref, { motif: 'montant_incoherent', du: c.montant, declare: data.montant, par: data.par });
        return { ok: false, motif: 'montant_incoherent', commande: c, du: c.montant, declare: data.montant,
          message: 'Montant déclaré (' + data.montant + ') différent du montant dû (' + c.montant + ').' };
      }
      /* (19/09, soir) 'soldee' NE COUVRE QUE LE ZÉRO : dès qu'il reste un centime à payer, ce n'est pas une
         commande soldée — elle se règle par le prestataire ou par un Bon d’achat PayEnCash, et on le dit. */
      if (data.par === 'soldee' && _du != null && _du > 0.004) {
        this.noter('encaissement_refuse', ref, { motif: 'non_soldee', par: data.par, montant: c.montant });
        return { ok: false, motif: 'non_soldee', commande: c,
          message: 'Il reste ' + _du.toFixed(2).replace('.', ',') + ' € à régler sur cette commande : elle n\'est pas soldée.' };
      }
      /* ══ (09/09 — lot 2 l'argent) LES RÈGLES D'ARGENT SE TRANCHENT ICI, AVANT D'ÉCRIRE — les écrans lisent le refus ══
         ① PLAFOND ESPÈCES (art. L112-6 CMF) : la part espèces NETTE d'un règlement ne dépasse jamais scenario.plafondEspeces —
            « réglé » en configuration, il n'était qu'affiché (la borne encaissait 1 200 € d'espèces sans un mot).
         ② VENTILATION COHÉRENTE : espèces − rendu + carte = dû, au centime — seule l'interface le garantissait.
         (18/09, soir) ③ LE CONTRÔLE LCB-FT AU COMPTOIR, le billet de 500 € refusé et le rendu de monnaie par virement
            sont partis avec l'agent de caisse mobile : plus personne ne reçoit d'espèces de la main du client. Ce qui
            reste tient dans _reglesArgent : le bon d’achat et l'avoir doivent être disponibles au moment de payer. */
      /* (11/09 — C15) LA FENÊTRE SE FAIT RESPECTER À L'ENCAISSEMENT. `payer()` lit la commande en direct (pas par
         `commandes()`, où l'expiration se dérive) : sans ce contrôle, le partenaire encaissait une commande que
         l'écran du client annonçait expirée depuis longtemps. Le client la relance, il ne paie pas deux fois. */
      /* (11/09) LE MANAGER GARDE LA PORTE. Sa confirmation manuelle (12-commande-detail, motif obligatoire,
         journalisée) n'encaisse RIEN : elle ENREGISTRE un encaissement physique déjà fait. La refuser au motif
         de la fenêtre enfermait l'argent dans un cul-de-sac — le partenaire avait les billets en caisse et plus
         aucun chemin pour les rattacher à une commande (ni ré-annonce, ni réaffectation, ni confirmation). La
         commande garde la marque de son retard : `horsFenetre`. */
      if (c.expireTs && Date.now() > c.expireTs) {
        var fenE = this._fenetreMin();
        if ((data.par || '') !== 'manager') {
          this.noter('encaissement_refuse', ref, { motif: 'expiree', par: data.par, fenetreMin: fenE });
          return { ok: false, motif: 'expiree', commande: c,
            message: 'Commande expirée — la fenêtre de ' + fenE + ' min est dépassée. Le client la relance depuis son app ; rien ne s\'encaisse ici.' };
        }
        /* (20/09) L'EXCEPTION DU MANAGER LAISSE SA TRACE, MÊME QUAND LA COMMANDE EST ENCORE « à régler ». Le
           commentaire ci-dessus promettait déjà que « la commande garde la marque de son retard » — mais elle ne
           la gardait que dans UN cas (une commande déjà fermée par la fenêtre). Une commande dont l'échéance
           venait de passer sans que personne ne l'ait close était enregistrée hors délai SANS QUE RIEN NE LE DISE :
           une exception qui ne se voit pas est une faille. Elle se voit désormais, et elle se journalise. */
        if (!c.horsFenetre) {
          c.horsFenetre = true;
          this.noter('encaissement_hors_fenetre', ref, { par: data.manager || 'manager', motif: data.motif || '', fenetreMin: fenE });
        }
      }
      var _regle = this._reglesArgent(c, data, _du);
      if (!_regle.ok) {
        this.noter('encaissement_refuse', ref, { motif: _regle.motif, par: data.par, detail: _regle.message, montant: c.montant });
        return { ok: false, motif: _regle.motif, commande: c, message: _regle.message };
      }
      /* (18/09) LE BON D’ACHAT PAYENCASH SE DÉBITE ICI, avant d'écrire — comme l'avoir. Deux cas : un bon d’achat APPLIQUÉ (bonAppliquer,
         partiel ou total) est débité de sa part quel que soit le déclarant ; un déclarant `bon d’achat` sans application préalable
         doit couvrir TOUT le dû avec le code qu'il passe (data.bon). Un débit refusé refuse le règlement, motif à l'appui. */
      var _bon = this._debiterBon(c, data, _du);
      if (_bon && _bon.ok === false) {
        this.noter('encaissement_refuse', ref, { motif: _bon.motif, par: data.par, detail: _bon.message, montant: c.montant });
        return { ok: false, motif: _bon.motif, commande: c, message: _bon.message };
      }
      this.noter('paiement', ref, { par: data.par, montant: data.montant, moyen: data.moyen || (data.par === 'bon' ? 'bon' : null), transaction: data.transaction || null, bon: (c.bon && c.bon.code) || (c.bonApplique && c.bonApplique.code) || null });
      c.statut = 'paye'; c.payeAt = Date.now(); c.par = data.par;
      // (18/09) le MOYEN qui a réglé — le Bon d’achat PayEnCash — la trésorerie et les remboursements en dépendent
      c.moyen = data.moyen || (data.par === 'bon' ? 'bon' : (c.moyen || null));
      // (18/09, soir) le contrôle LCB-FT au comptoir et la confirmation manuelle d'une course AGENT (cash rattaché à
      // l'encours de l'agent) sont partis avec l'agent de caisse mobile : plus de pièce d'identité relevée sur le pas
      // de la porte, plus d'encours par personne. La confirmation manuelle du manager reste, sans rattachement.
      if (c.par === 'manager') { c.confirmePar = data.manager || data.confirmePar || 'manager'; c.confirmationManuelle = true; }
      if (data.montant) c.montant = data.montant;
      // NUMÉRO DE REÇU (simulation 360° du 05/09) : c'est une PREUVE DE PAIEMENT. Il était
      // fabriqué par chaque interface — deux formats différents — et restait vide dès qu'un
      // autre chemin déclarait le règlement (le client lisait « Reçu n° — »). Le bus en pose
      // un, toujours, dérivé du préfixe du référentiel.
      if (data.recu) c.recu = data.recu;
      if (!c.recu) c.recu = this.numeroRecu();
      // RÈGLEMENT MODE AU MOMENT DU PAIEMENT (02/09, parcours coordonné) : la commande groupée Mode est soldée
      // (stock SORTI chez le fournisseur, journal Réglées, verrou levé) dès que le règlement est déclaré — plus
      // seulement quand le client rouvre ses Commandes. Idempotent : reglerCommande ne solde que LA commande en cours.
      try { var _D = window.PEC_DATA; var _g = _D && _D.panierCommandeGet && _D.panierCommandeGet(); if (_g && _g.ref === ref && _D.reglerCommande) _D.reglerCommande({ recu: c.recu || data.recu || null, par: data.par, moyen: c.moyen || null }); } catch (eR) {}
      // (09/09 — lot 2) l'AVOIR appliqué au récap Fly (c.avoir, posé à l'annonce par l'itinéraire) est CONSOMMÉ au règlement — jamais avant
      if (c.avoir && c.avoir.montant > 0 && !c.avoir.consommeAt) { try { var rAv = (window.PEC_DATA && PEC_DATA.avoirConsommer) ? PEC_DATA.avoirConsommer(c.clientId, c.avoir.montant, ref) : null; if (rAv && rAv.ok) { c.avoir.consommeAt = Date.now(); c.avoir.avoirs = rAv.avoirs; } else c.avoir.echec = (rAv && rAv.motif) || 'avoir non consommé'; } catch (eAC) {} }
      /* (11/09) L'ENCAISSEMENT NE S'ANNONCE PAS AVANT D'ÊTRE ÉCRIT. `ecrire` avalait l'exception : sur un
         appareil au stockage plein, `payer` répondait `{ok:true}` sur une commande qui n'existait nulle part —
         le client lisait « réglé », et le manager ne voyait jamais l'argent. */
      if (!ecrire('cmd_' + ref, c) || !ecrire('pay_' + ref, { ref: ref, at: c.payeAt, par: c.par, recu: c.recu || null, reglement: c.reglement || null })) {
        return refusEcriture('Le règlement de ' + ref);
      }
      return { ok: true, commande: c };   // (08/09) un succès se lit comme un refus : {ok} — les écrans testent r.ok
    },
    /* ══ LES RÈGLES D'ARGENT D'UN RÈGLEMENT — une fonction, lue par payer() ═══════════════════════════════════════
       (09/09 — lot 2) Elle tranchait la VENTILATION d'un encaissement en espèces : billets et pièces, part carte au-delà
       du plafond légal, monnaie rendue, billet de 500 € refusé, pièce d'identité au-dessus du seuil LCB-FT.
       (18/09, soir — l'agent de caisse mobile est abandonné) Tout cela est parti avec lui : plus personne ne compte des
       espèces devant un client, donc plus rien à ventiler, à rendre ou à contrôler au comptoir. Ce que le client règle
       ici est TOUJOURS déjà prépayé — un Bon d’achat PayEnCash acheté au comptoir d'un commerçant, ou un
       avoir de son compte. Il reste donc deux vérifications, et elles portent sur ce qui peut avoir été dépensé
       ailleurs entre l'application et le règlement : le BON D’ACHAT et l'AVOIR doivent être disponibles AU MOMENT de payer.
       Rend { ok, r: null } ou un refus { ok:false, motif, message } que les écrans affichent tel quel. ══ */
    _reglesArgent: function (c, data, du) {
      var D = window.PEC_DATA || null;
      var out = { ok: true, r: null, lcbft: null };
      /* LE BON D’ACHAT APPLIQUÉ doit être DISPONIBLE (solde, blocage, expiration, plafond du jour du compte) — commande Fly
         (c.bonApplique) ou commande Mode (le bon d’achat du sac, débité par reglerCommande). */
      var bonDu = (c.bonApplique && c.bonApplique.montant > 0 && !c.bonApplique.consommeAt) ? { code: c.bonApplique.code, montant: c.bonApplique.montant } : null, cidB = c.clientId || null;
      if (bonDu && D && D.bonValider) {
        var vb = D.bonValider(bonDu.code, { clientId: cidB, montant: bonDu.montant });
        if (!vb.ok || vb.applicable + 0.004 < bonDu.montant) return { ok: false, motif: 'bon_indisponible', message: 'La commande déduit ' + bonDu.montant.toFixed(2) + ' € d\'un Bon d’achat PayEnCash qui ' + (vb.ok ? 'ne couvre plus que ' + vb.applicable.toFixed(2) + ' € aujourd\'hui' : 'n\'est plus utilisable (' + vb.motif + ')') + ' : le client le retire de sa commande, ou règle autrement.' };
      }
      /* (19/09, soir) LA COMMANDE MODE PEUT PORTER PLUSIEURS BONS (un bon est borné à 250 € — un sac à 600 € en
         demande trois). On les revalide TOUS, avec le même plafond du jour commun que le sac a utilisé pour
         calculer les parts : sans cela, on ne vérifierait que le premier. */
      try {
        var gb = (D && D.panierCommandeGet) ? D.panierCommandeGet() : null;
        if (gb && gb.ref === c.ref && (gb.bons || []).length && !gb.bonConsomme && D.bonsParts) {
          var duB = gb.bons.reduce(function (sx, bx) { return sx + (bx.montant || 0); }, 0);
          var pb = D.bonsParts(gb.bons.map(function (bx) { return bx.code; }), duB, gb.clientId || cidB || null);
          if (pb.refus.length) return { ok: false, motif: 'bon_indisponible', message: 'La commande déduit un Bon d’achat PayEnCash qui n\'est plus utilisable (' + pb.refus[0].motif + ') : le client le retire de sa commande, ou règle autrement.' };
          if (pb.total + 0.004 < duB) return { ok: false, motif: 'bon_indisponible', message: 'La commande déduit ' + duB.toFixed(2) + ' € de bons d’achat qui ne couvrent plus que ' + pb.total.toFixed(2) + ' € aujourd\'hui : le client en retire un, ou règle autrement.' };
        }
      } catch (eGb) {}
      /* (revue lot 2) L'AVOIR appliqué à la commande doit l'être aussi — sinon elle serait réglée nette d'un avoir
         déjà dépensé ailleurs (« dépensé deux fois »). */
      var avoirDu = (c.avoir && c.avoir.montant > 0 && !c.avoir.consommeAt) ? c.avoir.montant : 0, cidAv = c.clientId || null;
      try { var gg = (D && D.panierCommandeGet) ? D.panierCommandeGet() : null; if (gg && gg.ref === c.ref && gg.avoir > 0 && !gg.avoirConsomme) { avoirDu = Math.max(avoirDu, gg.avoir); cidAv = cidAv || gg.clientId || null; } } catch (eG) {}
      if (avoirDu > 0) {
        var soldeAv = 0; try { soldeAv = (cidAv && D && D.avoirSolde) ? D.avoirSolde(cidAv) : 0; } catch (eS) {}
        if (!cidAv || soldeAv + 0.004 < avoirDu) return { ok: false, motif: 'avoir_insuffisant', message: 'La commande déduit un avoir de ' + avoirDu.toFixed(2) + ' € qui n\'est plus disponible (' + soldeAv.toFixed(2) + ' € sur le compte) : recommence depuis ton panier.' };
      }
      return out;
    },
    /* ══ (20/09 — décision fondatrice « enlève la logique Neosurf, supprime toute mention Neosurf ») ════
       LE RAIL DU PRESTATAIRE EN LIGNE EST PARTI AVEC LE TICKET QU'IL PORTAIT. Il ouvrait une transaction, on
       partait sur une page hébergée, et une notification serveur (« pingback ») déclarait la commande réglée.
       Ce chemin n'existait que pour un moyen tiers ; il n'en reste aucun, et un rail sans train est du code
       mort — avec lui sont partis `paiementPspInitier`, `paiementPspNotifier`, `remboursementPspEmettre`, la
       table des transactions et la page simulée du prestataire.
       CE QUI RÈGLE UNE COMMANDE AUJOURD'HUI : le BON D'ACHAT PAYENCASH (par:'bon'), acheté au comptoir d'un
       commerce partenaire ou à un distributeur mobile ; une commande déjà couverte à sa naissance (par:'soldee') ;
       ou le manager qui enregistre un règlement reçu autrement (par:'manager'). Trois déclarants, et pas un de
       plus — `payer` refuse tout le reste au lieu de se rabattre en silence. ═════════════════════════════════ */
    /* (18/09, soir) TOUT LE CIRCUIT DE L'AGENT DE CAISSE MOBILE EST PARTI D'ICI. Les fonctions avaient déjà été
       retirées ; il ne restait que leurs commentaires, qui décrivaient un code absent — pire qu'un silence, parce
       qu'on les lisait comme une promesse encore tenue. Sont partis avec le salarié qui se déplaçait encaisser :
         · l'import du rapport Cash Services et le rapprochement des dépôts d'espèces ;
         · le chat agent ↔ client et la déclaration d'arrivée sur le pas de la porte ;
         · le code de sécurité à 4 chiffres (`essaisCodeMax`, blocage après 3 refus, déblocage par le manager) ;
         · la tournée de collecte, la remise au manager, le dépôt à l'automate, les relevés de caisse ;
         · le service et la caisse par personne (`_moi`, `FOND_MANAGER`, `FOND_AGENT`), l'encours et sa part CB ;
         · l'accusé de réception d'une course et la vérification de la référence par scan.
       Ce qui règle une commande aujourd'hui est déjà payé au comptoir : le Bon d’achat PayEnCash. */
    /* (09/09) LA DEMANDE DE FACTURE PDF (client, fly/10) est un fait de la commande, plus une ligne de journal. */
    demanderFacture: function (ref, o) {
      o = o || {}; if (!ref) return { ok: false, motif: 'Réservation inconnue.' };
      var c = lire('cmd_' + ref); if (!c) return { ok: false, motif: 'Réservation inconnue.' };
      if (c.factureDemande) return { ok: true, deja: true, factureDemande: c.factureDemande };
      c.factureDemande = { at: Date.now(), email: o.email || null, numero: o.numero || null, par: o.par || 'client' };
      ecrire('cmd_' + ref, c);
      this.noter('facture_pdf', ref, { par: o.par || 'client', numero: c.factureDemande.numero, email: c.factureDemande.email });
      return { ok: true, factureDemande: c.factureDemande };
    },
    /* (09/09) LE LOT CB RAPPROCHÉ du jour (manager/32) : un état, pas une trace — il ne disparaît plus au 201ᵉ événement. */
    _jourISO: function (t) { var d = t ? new Date(t) : new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); },
    /* (18/09, soir) LES JALONS D'UNE COURSE (arrivée déclarée, encaissement commencé) sont partis avec l'agent de
       caisse mobile : entre son arrivée et le paiement, le client ne voyait rien pendant que l'agent comptait les
       espèces. Plus de déplacement, donc plus d'étape à montrer entre les deux. */
    paiement: function (ref) { return lire('pay_' + ref); },
    // CLIENT : attendre le paiement de SA réf (storage inter-onglets + filet polling)
    surPaiement: function (ref, cb) {
      // « payé » = la COMMANDE est réellement au statut 'paye' (déclaré par le
      // prestataire, le manager ou un Bon d’achat). Un pay_ résiduel d'un cycle antérieur (réf
      // réutilisée / déterministe par montant) ne doit JAMAIS faire basculer une
      // commande encore 'a_payer' en ticket payé (bug 29/08 : « présenté comme payé »).
      function paye() { var c = window.PEC_BUS.commande(ref), p = window.PEC_BUS.paiement(ref); return (p && c && c.statut === 'paye') ? p : null; }
      var p0 = paye();
      if (p0) { cb(p0); return; }
      var done = false;
      function check() { var p = paye(); if (p && !done) { done = true; cb(p); } }
      window.addEventListener('storage', check);
      var iv = setInterval(function () { check(); if (done) clearInterval(iv); }, 800);
    },
    // BACK-OFFICE : être prévenu des NOUVELLES commandes en direct
    /* (08/09) UN redessin à la fois : storage, pec-bus et le poll passent par le même débouncé ; `stop()` détache tout. */
    surCommandes: function (cb) {
      var self = this, t = null, actif = true;
      function tick() { if (!actif) return; if (t) return; t = setTimeout(function () { t = null; try { cb(self.commandes()); } catch (e) {} }, 60); }
      cb(this.commandes());
      window.addEventListener('storage', tick); window.addEventListener('pec-bus', tick);
      var iv = setInterval(tick, 1500);
      return { stop: function () { actif = false; clearInterval(iv); window.removeEventListener('storage', tick); window.removeEventListener('pec-bus', tick); } };
    },
    /* (18/09, soir) Sont partis au même endroit, et pour la même raison : la lecture de l'état du code de sécurité,
       les RENDUS DE MONNAIE À VIRER (plus d'espèces comptées, donc plus d'écart à rendre) et le CANAL DÉPÔTS
       (encours, part CB du jour, dépôt d'espèces à l'automate) : il n'y a plus ni caisse à porter, ni ticket
       d'automate à rapprocher.

       ══ (20/09 — décision fondatrice « lorsque je passe par un agent qui se déplace, aucune carte avec l'agent
       qui arrive — or il y avait toute cette logique dans les anciens commits, JUSQU'À PAYER ») ════════════
       LE CANAL POSITIONS REVIENT, POUR LE DISTRIBUTEUR MOBILE. Il était parti le 18/09 avec l'agent SALARIÉ — et
       avec lui l'écran du client : `PEC_DATA.rencontreEta` appelait `positionAgent`, qui n'existait plus, et
       rendait donc toujours null. Résultat : la carte du rendez-vous n'a jamais montré personne arriver, et
       l'écran disait éternellement « il n'a pas encore partagé sa position ». Ce n'était pas une pudeur, c'était
       une porte manquante.
       CE QUI CHANGE PAR RAPPORT À L'AGENT SALARIÉ : la position n'est plus celle d'un employé suivi par son
       employeur — c'est un indépendant qui, le temps d'un rendez-vous qu'il a ACCEPTÉ, dit où il en est à la
       personne qui l'attend. Elle est donc bornée des deux côtés :
         · dans le TEMPS — `ref.rencontre.positionTtlMin` (30 min) : au-delà, on ne sait plus, et on le DIT ;
         · dans la PORTÉE — une position par RENDEZ-VOUS, jamais par personne : rien ne se recoupe d'un
           rendez-vous à l'autre, et il n'y a aucun historique de déplacement (minimisation, RGPD).
       Elle est EFFACÉE dès que le rendez-vous se ferme (servi, annulé) : `oublierPosition`.
       Miroir de la table `meeting_positions` (Étape 6) : une ligne par rendez-vous, effacée à sa fermeture. ══ */
    publierPosition: function (rdvId, pos, par) {
      if (!rdvId || !pos || !isFinite(pos.lat) || !isFinite(pos.lng)) return { ok: false, motif: 'Position incomplète.' };
      var D = this.donnees();
      var r = (D && D.rencontre) ? D.rencontre(rdvId) : null;
      if (!r) return { ok: false, motif: 'Rendez-vous inconnu.' };
      if (r.statut !== 'acceptee') return { ok: false, motif: 'On ne partage sa position que sur un rendez-vous ACCEPTÉ (état : ' + r.statut + ').' };
      var v = { lat: Number(pos.lat), lng: Number(pos.lng), at: Date.now(), par: par || r.distributeurId || null };
      if (!ecrire('pos_' + rdvId, v)) return { ok: false, motif: 'La position n\'a pas pu être enregistrée.' };
      return { ok: true, position: v };
    },
    /* LA POSITION VIVE D'UN RENDEZ-VOUS — null dès qu'elle a dépassé son TTL. On ne rend JAMAIS une position
       périmée : mieux vaut « on ne sait pas où il est » qu'une épingle qui ment de vingt minutes. */
    positionAgent: function (rdvId) {
      var v = lire('pos_' + rdvId); if (!v || !isFinite(v.lat)) return null;
      var D = this.donnees();
      var ttl = Number(((D && D.ref && D.ref.rencontre) || {}).positionTtlMin) || 30;
      /* UNE POSITION PÉRIMÉE NE SE TAIT PAS : ELLE S'EFFACE. La taire suffirait à ne pas mentir à l'écran,
         mais elle resterait en clair dans l'appareil — et une position gardée au-delà de son usage, c'est
         exactement ce que la minimisation interdit. On la supprime donc à la première lecture qui la trouve
         périmée : une position n'est pas un historique de déplacement. */
      if (Date.now() - (v.at || 0) > ttl * 60000) { this.oublierPosition(rdvId); return null; }
      return v;
    },
    oublierPosition: function (rdvId) { try { localStorage.removeItem(P + 'pos_' + rdvId); } catch (e) {} try { window.dispatchEvent(new Event('pec-bus')); } catch (e2) {} return { ok: true }; },
    /* (10/09 — lot 6, constat C21) LA COMMANDE EST LIVRÉE — le fait manquait. Sans lui, la rétractation de 14 jours
       « à compter de la réception » n'a pas de point de départ, et une réclamation ne sait pas si elle est dans les
       délais. La date vient du TRANSPORTEUR (PEC_DATA.expeditionSuivi), jamais d'un écran. */
    marquerLivree: function (ref, at) {
      var c = lire('cmd_' + ref); if (!c) return { ok: false, motif: 'Commande inconnue du bus.' };
      if (c.statut !== 'paye') return { ok: false, motif: 'Une commande non réglée ne se livre pas.' };
      if (c.livreAt) return { ok: true, commande: c, deja: true };
      c.livreAt = at || Date.now();
      ecrire('cmd_' + ref, c);
      this.noter('commande_livree', ref, { par: 'transporteur', at: c.livreAt });
      return { ok: true, commande: c };
    },
    remboursements: function (ref) { var c = lire('cmd_' + ref); return (c && c.remboursements) || []; },
    /* REMBOURSEMENT (manager / hotline, 03/09) : une commande PAYÉE peut être remboursée — avoir ou virement,
       jamais en espèces (LCB-FT). Le statut passe à 'rembourse', l'horodatage et le mode sont portés. */
    /* (09/09 — lot 2 l'argent) LE REMBOURSEMENT EST RÉEL : en AVOIR, il crédite le livre d'avoirs du compte (PEC_DATA.avoirCrediter) ;
       par VIREMENT, il crée une créance { a_virer, dueAt, iban } émise par le manager (remboursementVirementEmettre, refus sans RIB) ;
       il peut être PARTIEL (montant net d'un retour, par ligne) — la commande ne passe « remboursée » qu'une fois tout rendu.
       Avant : un mot sur la commande (« avoir »), aucun solde nulle part, aucun virement jamais émis. */
    rembourser: function (ref, data) {
      data = data || {};
      var c = lire('cmd_' + ref) || { ref: ref };
      if (c.statut !== 'paye' && c.statut !== 'rembourse') return c;   // on ne rembourse que ce qui a été encaissé
      if (c.statut === 'rembourse') return c;                          // tout est déjà rendu : rien ne se réécrit
      var num = function (x) { return parseFloat(String(x == null ? '' : x).replace(/\s/g, '').replace(',', '.')); };
      var rd = function (x) { return Math.round(x * 100) / 100; };
      var du = num(c.montant); if (!(du > 0)) du = 0;
      /* (18/09) UNE COMMANDE ENTIÈREMENT RÉGLÉE PAR UN BON D’ACHAT a un montant encaissé de zéro : ce qui se rembourse, c'est la part
         du bon d’achat — et elle revient SUR LE BON D’ACHAT (jamais en espèces) : le mode par défaut est alors le re-crédit. */
      var parBon = c.moyen === 'bon' && c.bon && c.bon.montant > 0;
      if (parBon && !(du > 0)) du = rd(c.bon.montant);
      var deja = rd((c.remboursements || []).reduce(function (s, m) { return s + (m.montant || 0); }, 0));
      var mode = data.mode === 'virement' ? 'virement' : (data.mode === 'bon' || (parBon && !data.mode) ? 'bon' : 'avoir');   // jamais 'especes' ; (18/09) 'bon' = re-crédit du Bon d’achat PayEnCash qui a réglé
      var mnt = (data.montant != null && String(data.montant).trim() !== '') ? num(data.montant) : rd(du - deja);
      if (!(mnt > 0)) return c;
      if (du > 0 && mnt > rd(du - deja) + 0.005) mnt = rd(du - deja);   // jamais plus que l'encaissé
      var D = window.PEC_DATA || null;
      var mv = { id: 'RMB-' + this.seq(), montant: rd(mnt), mode: mode, ligne: data.ligne || null, motif: data.motif || '', par: data.par || 'manager', at: Date.now() };
      if (mode === 'bon') {
        /* (18/09) LE BON D’ACHAT QUI A RÉGLÉ EST RE-CRÉDITÉ — de ce qu'il a réglé sur CETTE commande, au plus (bonRecrediter le borne). */
        var codeB = (c.moyen === 'bon' && c.bon && c.bon.code) || (c.bonApplique && c.bonApplique.code) || data.bon || null, rb = null;
        try { rb = (codeB && D && D.bonRecrediter) ? D.bonRecrediter(codeB, mv.montant, ref, mv.motif || 'remboursement', mv.par) : null; } catch (eB) {}
        if (rb && rb.ok) { mv.bon = codeB; mv.bonSolde = rb.solde; } else { mv.enAttente = true; mv.bonNonCredite = (rb && rb.motif) || 'aucun Bon d’achat PayEnCash n\'a réglé cette commande'; }
      } else if (mode === 'avoir') {
        var av = null; try { av = (c.clientId && D && D.avoirCrediter) ? D.avoirCrediter(c.clientId, mv.montant, { ref: ref, motif: mv.motif || 'remboursement', par: mv.par }) : null; } catch (eA) {}
        if (av && av.ok) mv.avoirId = av.id; else { mv.avoirNonCredite = c.clientId ? ((av && av.motif) || 'avoir non crédité') : 'compte client inconnu — à rattacher (07-trésorerie)'; mv.enAttente = true; }
      } else {
        var hV = 48, ribV = null; try { hV = (D && D.scenario && D.scenario.lcbft && D.scenario.lcbft.virementHeures) || 48; var rb = (D && D.clientRibPour) ? D.clientRibPour(c.clientId) : null; if (rb && rb.iban) ribV = D.ibanMasque(rb.iban); } catch (eV) {}
        mv.virement = { statut: 'a_virer', dueAt: Date.now() + hV * 3600000, iban: ribV, clientId: c.clientId || null };
      }
      c.remboursements = (c.remboursements || []).concat([mv]);
      // (revue lot 2) un avoir NON crédité (commande sans compte) n'est pas un remboursement effectif : la commande reste réglée, le
      // geste est « en attente de rattachement » (avoirsEnAttente / avoirRattacher) — avant, « remboursée » définitivement sans qu'un centime ne bouge
      this._recalculerRemboursement(c, du);
      // (18/09) la PART DU BON D’ACHAT appliquée en complément d'un autre moyen est restituée SUR LE BON D’ACHAT au premier remboursement effectif
      if (!mv.enAttente && c.bonApplique && c.bonApplique.consommeAt && !c.bonApplique.restitueAt && D && D.bonRecrediter) {
        try { var rbA = D.bonRecrediter(c.bonApplique.code, c.bonApplique.montant, ref, 'bon d’achat restitué (remboursement)', mv.par); if (rbA && rbA.ok) c.bonApplique.restitueAt = Date.now(); } catch (eRb) {}
      }
      // (revue lot 2) l'AVOIR que la commande avait CONSOMMÉ est restitué au premier remboursement effectif (il fait partie de ce que le client avait payé)
      if (!mv.enAttente && c.clientId && c.avoir && c.avoir.consommeAt && !c.avoir.restitueAt && D && D.avoirCrediter) {
        try { var avR = D.avoirCrediter(c.clientId, c.avoir.montant, { ref: ref, motif: 'avoir restitué (remboursement)', par: mv.par }); if (avR && avR.ok) { c.avoir.restitueAt = Date.now(); c.avoir.restitueId = avR.id; } } catch (eR) {}
      }
      ecrire('cmd_' + ref, c);
      this.noter('remboursement', ref, { par: mv.par, mode: mode, montant: mv.montant, motif: mv.motif, ligne: mv.ligne, avoir: mv.avoirId || null, partiel: !!c.remboursePartiel, clientId: c.clientId || null, client: c.client || null });
      try { window.dispatchEvent(new Event('pec-bus')); } catch (e) {}
      return c;
    },
    /* le statut de remboursement se DÉRIVE des gestes effectifs (avoir crédité, virement décidé) — un avoir en attente ne compte pas */
    _recalculerRemboursement: function (c, du) {
      var rd = function (x) { return Math.round(x * 100) / 100; };
      var eff = (c.remboursements || []).filter(function (m) { return !m.enAttente; });
      var total = rd(eff.reduce(function (s, m) { return s + (m.montant || 0); }, 0)), dern = (c.remboursements || [])[(c.remboursements || []).length - 1] || {};
      c.montantRembourse = total; c.modeRemboursement = dern.mode || c.modeRemboursement; c.rembourseePar = dern.par || c.rembourseePar; c.motifRemboursement = dern.motif || c.motifRemboursement;
      c.avoirNonCredite = (c.remboursements || []).some(function (m) { return m.enAttente; }) ? (dern.avoirNonCredite || 'avoir à rattacher') : null;
      c.avoirEnAttente = (c.remboursements || []).filter(function (m) { return m.enAttente; }).reduce(function (s, m) { return s + m.montant; }, 0) || null;
      if (du == null) du = parseFloat(String(c.montant || '0').replace(/\s/g, '').replace(',', '.')) || 0;
      if (total > 0 && (!du || total >= du - 0.005)) {
        c.statut = 'rembourse'; c.rembourseAt = c.rembourseAt || Date.now(); delete c.remboursePartiel;
        /* (12/09) UNE VENTE ATTRIBUÉE À UN LIEN DE PARTAGE PUIS REMBOURSÉE NE RESTE PAS AU COMPTEUR du
           fournisseur : le retrait s'inscrit au journal de partage (il n'efface rien, il vient en face). */
        try { if (window.PEC_DATA && PEC_DATA.partageRetirerVente) PEC_DATA.partageRetirerVente(c.ref, 'commande remboursée'); } catch (ePr) {}
      }
      else { if (c.statut === 'rembourse') c.statut = 'paye'; if (total > 0) c.remboursePartiel = total; else delete c.remboursePartiel; }
    },
    /* (revue lot 2) LES AVOIRS À RATTACHER : remboursements en avoir décidés sur une commande sans compte client — le manager (07) choisit le compte */
    avoirsEnAttente: function () {
      var out = [];
      this.commandes().forEach(function (c) { (c.remboursements || []).forEach(function (m) { if (m.mode === 'avoir' && m.enAttente) out.push({ ref: c.ref, client: c.client || null, mv: m, commande: c }); }); });
      return out.sort(function (a, b) { return (a.mv.at || 0) - (b.mv.at || 0); });
    },
    avoirRattacher: function (ref, id, clientId, par) {
      var c = lire('cmd_' + ref); if (!c) return { ok: false, motif: 'Commande inconnue.' };
      var mv = (c.remboursements || []).filter(function (m) { return m.id === id && m.mode === 'avoir' && m.enAttente; })[0];
      if (!mv) return { ok: false, motif: 'Aucun avoir en attente ' + id + ' sur cette commande.' };
      if (!clientId) return { ok: false, motif: 'Choisis le compte client à créditer.' };
      var D = window.PEC_DATA, av = null; try { av = (D && D.avoirCrediter) ? D.avoirCrediter(clientId, mv.montant, { ref: ref, motif: mv.motif || 'remboursement', par: par || 'manager' }) : null; } catch (e) {}
      if (!av || !av.ok) return { ok: false, motif: (av && av.motif) || 'Avoir non crédité.' };
      mv.avoirId = av.id; delete mv.enAttente; delete mv.avoirNonCredite; mv.rattachePar = par || 'manager'; mv.rattacheAt = Date.now(); c.clientId = c.clientId || clientId;
      this._recalculerRemboursement(c, null);
      ecrire('cmd_' + ref, c);
      this.noter('avoir_rattache', ref, { par: par || 'manager', clientId: clientId, montant: mv.montant, avoir: av.id, id: id });
      try { window.dispatchEvent(new Event('pec-bus')); } catch (e2) {}
      return { ok: true, avoir: av.id };
    },
    remboursementsAVirer: function () {
      var out = [];
      this.commandes().forEach(function (c) { (c.remboursements || []).forEach(function (m) { if (m.mode === 'virement' && m.virement && m.virement.statut === 'a_virer') out.push({ ref: c.ref, client: c.client || null, clientId: c.clientId || null, mv: m, commande: c }); }); });
      return out.sort(function (a, b) { return (a.mv.virement.dueAt || 0) - (b.mv.virement.dueAt || 0); });
    },
    remboursementVirementEmettre: function (ref, id, par) {
      var c = lire('cmd_' + ref); if (!c) return { ok: false, motif: 'Commande inconnue.' };
      var mv = (c.remboursements || []).filter(function (m) { return m.id === id && m.mode === 'virement'; })[0];
      if (!mv || !mv.virement) return { ok: false, motif: 'Aucun remboursement par virement ' + id + ' sur cette commande.' };
      if (mv.virement.statut === 'vire') return { ok: false, motif: 'Virement déjà émis.' };
      if (!mv.virement.iban) { try { var rb = window.PEC_DATA && PEC_DATA.clientRibPour ? PEC_DATA.clientRibPour(c.clientId) : null; if (rb && rb.iban) mv.virement.iban = PEC_DATA.ibanMasque(rb.iban); } catch (eI) {} }
      if (!mv.virement.iban) return { ok: false, motif: 'RIB manquant : le client doit enregistrer son IBAN avant l\'émission.' };
      mv.virement.statut = 'vire'; mv.virement.vireAt = Date.now(); mv.virement.par = par || 'manager';
      ecrire('cmd_' + ref, c);
      this.noter('remboursement_virement_emis', ref, { par: par || 'manager', montant: mv.montant, iban: mv.virement.iban, id: id, clientId: c.clientId || null, client: c.client || null });
      try { window.dispatchEvent(new Event('pec-bus')); } catch (e) {}
      return { ok: true, montant: mv.montant };
    },
    /* ANNULATION (manager, 03/09) : une commande non payée passe en 'annule' avec motif et acteur — jamais une commande payée. */
    annuler: function (ref, data) {
      data = data || {};
      var c = lire('cmd_' + ref) || { ref: ref };
      if (c.statut === 'paye' || c.statut === 'rembourse') return c;   // une commande encaissée (même remboursée) ne s'annule jamais
      c.statut = 'annule'; c.annuleAt = Date.now(); c.motifAnnulation = data.motif || ''; c.annulePar = data.par || 'manager';
      ecrire('cmd_' + ref, c);
      this.noter('annulation', ref, { par: c.annulePar, motif: c.motifAnnulation });
      try { window.dispatchEvent(new Event('pec-bus')); } catch (e) {}
      return c;
    },
    /* (09/09 — lot 3) LE CLIENT ANNULE VRAIMENT. « Annuler la recherche » et « Un imprévu ? » n'étaient que des liens : la course
       restait « à payer » et le panier Mode verrouillé jusqu'à l'expiration.
       ARBITRAGE (fondatrice) : rien n'ayant été encaissé, AUCUN frais n'est dû — cinq écrans promettaient des « frais de
       déplacement dus » que rien ne créait, et le référentiel disait l'inverse. La contrepartie est une règle d'abus réelle :
       au-delà de ref.annulationDomicile.abusSeuil annulations APRÈS acceptation sur la fenêtre glissante, le paiement à
       domicile est suspendu pour ce compte (le paiement au point reste ouvert). */
    annulerParClient: function (ref, motif) {
      var c = lire('cmd_' + ref);
      if (!c) return { ok: false, motif: 'inconnue', message: 'Commande inconnue.' };
      if (c.statut === 'paye' || c.statut === 'rembourse') return { ok: false, motif: c.statut, commande: c, message: 'Commande déjà réglée — elle se rembourse, elle ne s\'annule plus.' };
      if (c.statut !== 'a_payer') return { ok: false, motif: c.statut, commande: c, message: 'Commande déjà ' + (c.statut === 'echec' ? 'en échec' : 'annulée') + '.' };
      var apresPrise = !!c.accepteAt;
      var r = this.annuler(ref, { par: 'client', motif: String(motif || 'annulée par le client').trim() });
      r.annuleParClient = true; r.apresPrise = apresPrise; ecrire('cmd_' + ref, r);
      this.noter('annulation_client', ref, { par: 'client', clientId: c.clientId || null, client: c.client || null, apresPrise: apresPrise, motif: r.motifAnnulation });
      try { if (window.PEC_DATA && PEC_DATA.panierCommandeGet && PEC_DATA.panierCommandeGet() && PEC_DATA.panierCommandeGet().ref === ref && PEC_DATA.panierCommandeReset) PEC_DATA.panierCommandeReset(); } catch (eP) {}   // le verrou du panier Mode se lève
      return { ok: true, commande: r, apresPrise: apresPrise };
    },
    /* (18/09, soir) Sont parties avec l'agent de caisse mobile : la lecture des annulations APRÈS acceptation (elle
       servait à fermer le domicile à un compte qui en abusait), la RÉAFFECTATION d'une course à un autre agent, et
       la purge RGPD de la position live, du fil de messages et du code de sécurité d'une course close. */
    /* (07/09 — UN vocabulaire ; 18/09, soir) le bus porte les cycles de vie de la commande, du remboursement par
       virement, du paiement en ligne, de l'appel, de la demande et de la vérification PVID. La TOURNÉE, la REMISE et
       le DÉPÔT d'espèces sont partis avec l'agent de caisse mobile. Chacun est le MIROIR d'une colonne SQL : table, colonne, correspondances.
       Tout statut que le bus ÉCRIT figure ici, et chaque cible existe dans le CHECK/ENUM de sa colonne —
       ZT·419 le vérifie contre le source du bus ET contre schema.sql. */
    STATUT_SQL: {
      /* (18/09, soir) L'ÉCHEC D'ENCAISSEMENT N'EXISTE PLUS. `COLLECTION_FAILED` disait « l'agent s'est déplacé et
         n'a pas pu encaisser » : plus personne ne se déplace, et l'enum du serveur ne porte plus cette valeur. Une
         commande qui n'est pas réglée EXPIRE (orders.expired_at) ou est ANNULÉE — il n'y a pas de troisième sort.
         Partis avec l'agent : la tournée de collecte, la remise au manager, le dépôt d'espèces, et l'automate. */
      commande:     { table: 'orders',                colonne: 'status', vers: { a_payer: 'AWAITING_CASH', paye: 'PAID', livree: 'FULFILLED', annule: 'CANCELLED', rembourse: 'REFUNDED' } },
      // (18/09, soir) le cycle du RENDU DE MONNAIE PAR VIREMENT (`change_transfers`) est parti avec l'agent : il n'y a plus de monnaie à rendre.
      remboursementVirement: { table: 'refund_transfers', colonne: 'status', vers: { a_virer: 'a_virer', vire: 'vire' } },   // (09/09 — lot 2) remboursement par virement
      appel:        { table: 'hotline_calls',         colonne: 'status', vers: { a_faire: 'a_faire', fait: 'fait', sans_reponse: 'sans_reponse', rappeler: 'rappeler' } },
      demande:      { table: 'support_conversations', colonne: 'statut', vers: { en_cours: 'en_cours', cloturee: 'resolue', clot_satisfait: 'resolue', clot_insatisfait: 'resolue', clot_rembourse: 'resolue', clot_repondu: 'resolue', niveau_manager: 'transferee', mediateur: 'transferee' } },   // l'issue va dans support_conversations.issue
      verification: { table: 'kyc_checks',            colonne: 'status', vers: { transmise_pvid: 'transmise_pvid', a_controler: 'a_controler', validee: 'validee', refusee: 'refusee', a_refaire: 'a_refaire' } },
      /* ── (11/09 — lot 9) LES CYCLES DE VIE QUE LE DATA-LAYER TIENT ────────────────────────────────────────────
         Le dictionnaire ne couvrait que ce que LE BUS écrit : ni le point partenaire, ni sa borne, ni le compte,
         ni le fournisseur, ni la facture, ni la campagne, ni la créa, ni l'influenceur n'y figuraient — huit
         cycles de vie tenus par PEC_DATA, dont personne ne vérifiait qu'ils tiennent en base. Chacun est ici, et
         le banc contrôle que chaque valeur existe dans le CHECK ou l'ENUM réel de sa colonne (ZT·419).
         Une entrée `source: 'data'` dit qui l'écrit : le bus n'a pas à connaître ces gestes, il les DÉCLARE. ── */
      compte:       { table: 'accounts',   colonne: 'statut', source: 'data', vers: { a_verifier: 'a_verifier', a_valider: 'a_valider', invite: 'invite', actif: 'actif', suspendu: 'suspendu', refuse: 'refuse', clos: 'clos', supprime: 'supprime' } },
      fournisseur:  { table: 'suppliers',  colonne: 'status', source: 'data', vers: { candidature: 'candidate', kyb_en_cours: 'kyb_pending', actif: 'active', surveille: 'watch', suspendu: 'suspended' } },
      campagne:     { table: 'ad_campaigns', colonne: 'status', source: 'data', vers: { draft: 'draft', active: 'active', paused: 'paused', ended: 'ended' } },
      crea:         { table: 'ged_assets', colonne: 'status', source: 'data', vers: { brouillon: 'brouillon', valide: 'valide', imprime: 'imprime', en_ligne: 'en_ligne', en_distribution: 'en_distribution' } },
      influenceur:  { table: 'influencer_links', colonne: 'status', source: 'data', vers: { brief: 'brief', actif: 'actif', termine: 'termine' } },
      expedition:   { table: 'shipments',  colonne: 'status', source: 'data', vers: { a_expedier: 'to_ship', etiquette_prete: 'label_created', expedie: 'picked_up', en_acheminement: 'in_transit', dispo_relais: 'at_relay', livre: 'delivered', bloque_controle: 'blocked_control', controle_refuse: 'control_refused' } },
      facture:      { table: 'supplier_invoices', colonne: 'status', source: 'data', vers: { a_facturer: 'a_facturer', emise: 'emise', viree: 'viree', annulee: 'annulee' } },
      reclamation:  { table: 'mode_claims', colonne: 'status', source: 'data', vers: { ouverte: 'ouverte', remboursee: 'remboursee', retour_attendu: 'retour_attendu', retour_recu: 'retour_recu', constatee: 'constatee', contestee: 'contestee', close: 'close' } },
      debitFournisseur: { table: 'supplier_debits', colonne: 'status', source: 'data', vers: { gele: 'gele', definitif: 'definitif', conteste: 'conteste', annule: 'annule', impute: 'impute' } },
      /* (18/09) LE BON D’ACHAT PAYENCASH ET SON RÉSEAU : le point (partners), le bon d’achat (gift_cards — seuls bloqué/annulé s'écrivent, épuisé et
         expiré se dérivent) et le prélèvement à la vente (`partner_charges`). Chaque valeur existe dans le CHECK réel de sa colonne. */
      partenaire:   { table: 'partners',  colonne: 'status', source: 'data', vers: { contrat_a_signer: 'contrat_a_signer', contrat_signe: 'contrat_signe', actif: 'actif', suspendu: 'suspendu', clos: 'clos' } },
      bon:          { table: 'gift_cards', colonne: 'status', source: 'data', vers: { actif: 'active', bloque: 'blocked', annule: 'cancelled' } },
      /* (18/09, soir — décision fondatrice « le partenaire paie par carte à chaque vente ») Le REVERSEMENT mensuel
         (une créance, une échéance, une relance, et sa table) est abandonné : ce qui vit désormais est le
         PRÉLÈVEMENT, accepté, refusé ou remboursé — et un refus n'émet aucun bon d’achat. */
      prelevement:  { table: 'partner_charges', colonne: 'status', source: 'data', vers: { accepte: 'accepted', refuse: 'refused', rembourse: 'refunded' } },
      /* (19/09, nuit — « supprime le flashcode, il achète un bon ») LA DEMANDE DE BON D'ACHAT est partie avec
         le flashcode : au comptoir le client n'a rien à montrer, donc rien à suivre. La table SQL voucher_requests
         est partie avec — elle n'est plus le miroir de rien. */
      /* ══ (19/09, nuit) PAYENCASH SOLUTION — les sept cycles de vie de la seconde ligne ═══════════════
         Ils sont tenus par le DATA-LAYER, pas par le bus : c'est lui qui les écrit, et le garde-fou ZT·419
         vérifie que chacun tient en base. Sans eux, un statut comme « revoked » ou « paid » vivrait dans le
         code sans colonne en face — exactement le trou qu'on s'interdit. */
      techActeur:     { table: 'tech_merchants', colonne: 'status', source: 'data', vers: { pending: 'pending', validated: 'validated', suspended: 'suspended' } },
      techConformite: { table: 'tech_compliance_declarations', colonne: 'status', source: 'data', vers: { validated: 'validated', to_correct: 'to_correct' } },
      techMandat:     { table: 'tech_mandates', colonne: 'status', source: 'data', vers: { active: 'active', revoked: 'revoked' } },
      techMatch:      { table: 'tech_matches', colonne: 'status', source: 'data', vers: { proposed: 'proposed', accepted: 'accepted', rejected: 'rejected' } },
      techContrat:    { table: 'tech_distribution_contracts', colonne: 'state', source: 'data', vers: { draft: 'draft', sent: 'sent', signed: 'signed', active: 'active', terminated: 'terminated', closed: 'closed' } },
      techFacture:    { table: 'tech_invoices', colonne: 'status', source: 'data', vers: { draft: 'draft', sent: 'sent', paid: 'paid', overdue: 'overdue' } },
      techBon:        { table: 'tech_vouchers', colonne: 'state', source: 'data', vers: { issued: 'issued', allocated: 'allocated', sold: 'sold', redeemed: 'redeemed', cancelled: 'cancelled' } },
      /* (20/09) LA DEMANDE DE PAIEMENT : deux de ses états sont DÉRIVÉS — « entamée » se lit dans ses
         règlements, « expirée » dans le calendrier. La table garde l'état POSÉ (open/paid/cancelled) ;
         le miroir doit connaître les cinq, sinon il accuse deux états d'être sans colonne. */
      techLien:       { table: 'tech_bon_offers', colonne: 'state', source: 'data', vers: { open: 'open', partial: 'open', used: 'used', cancelled: 'cancelled', expired: 'open' } },   // (23/09, soir) le bon proposé : couvert = used
      /* ══ (23/09 — grossiste) LES CINQ CYCLES DE L'ARGENT DE SOLUTION ══════════════════════════════════════
         La vente porte DEUX états qui ne se confondent pas : ce que le point nous doit (`techVente`) et ce que
         nous devons à la marque (`techVenteMarque`). Viennent ensuite la remise déposée à la banque, ses lignes,
         la pénalité d'impayé et l'abonnement au logiciel. Chacun tient dans une colonne réelle — ZT·419 le
         vérifie, et c'est ce garde-fou qui interdit un statut vivant dans le code sans table en face. */
      techVente:      { table: 'tech_sales', colonne: 'statut', source: 'data', vers: { a_prelever: 'a_prelever', en_prelevement: 'en_prelevement', regle: 'regle', impaye: 'impaye', annulee: 'annulee' } },
      techVenteMarque:{ table: 'tech_sales', colonne: 'brand_status', source: 'data', vers: { a_payer: 'a_payer', paye: 'paye', annule: 'annule' } },
      techRemise:     { table: 'tech_dd_files', colonne: 'statut', source: 'data', vers: { prepare: 'prepare', depose: 'depose', partiel: 'partiel', traite: 'traite', annulee: 'annulee' } },
      techPrelevement:{ table: 'tech_direct_debits', colonne: 'statut', source: 'data', vers: { prepare: 'prepare', depose: 'depose', paye: 'paye', impaye: 'impaye', ecartee: 'ecartee' } },
      techPenalite:   { table: 'tech_penalties', colonne: 'statut', source: 'data', vers: { a_prelever: 'a_prelever', en_prelevement: 'en_prelevement', regle: 'regle', impaye: 'impaye' } },
      techAbonnement: { table: 'tech_subscriptions', colonne: 'statut', source: 'data', vers: { du: 'du', en_prelevement: 'en_prelevement', regle: 'regle', impaye: 'impaye' } },
      techSepaMandat: { table: 'tech_sepa_mandates', colonne: 'statut', source: 'data', vers: { actif: 'actif', revoque: 'revoque' } }
    },
    statutSql: function (entite, statut) { var e = this.STATUT_SQL[entite]; return e && e.vers[statut] || null; },   // alias côté client (11-suivi-etats-echec)
    /* (18/09, soir) LE CIRCUIT DES ESPÈCES EST PARTI AVEC L'AGENT : l'échec d'encaissement à domicile, le rapport
       de l'automate Cash Services, le rapprochement d'un dépôt et l'arbitrage d'un écart n'ont plus d'objet — plus
       aucun billet ne transite par PayEnCash. L'argent du client va au commerçant, et le commerçant nous règle par
       carte à la vente (prelevementPartenaire). */
    reset: function () {
      var del = [];
      for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(P) === 0) del.push(k); }
      del.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    }
  };
})();
