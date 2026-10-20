/* ══ PEC_BONS — LE SOCLE DE L'APP « MES BONS » (fondatrice 23/09) ═══════════════════════════════════════════
   « créer une app utilisateur, avec KYC : dépasse 250 euros de bons en espèces, 500 si CB ; app ultra simple pour
     conserver et stocker ses bons d'achat / cartes cadeaux ; attention vocabulaire : aucun mot de portefeuille, pas de définition
     trompeuse, rappel et usage, CGV CGU etc. ; il peut chercher des marques et compagnies »
   « CGV, CGU : pareil pour le bon côté app utilisateur » — chaque document se CONSULTE, puis se reconnaît « lu et
     accepté » ; tant que ce n'est pas fait, on ne range rien.
   (23/09, après-midi — fondatrice : « pour l'app Mes bons, ce sont LES BONS DES MARQUES — attention au juridique ;
     il gère LEURS bons, utilisables UNIQUEMENT chez la marque émettrice ; PayEnCash est secondaire : elle a vendu le
     bon à travers son réseau ; l'app est OBLIGATOIRE pour utiliser un bon de marque, ça permet de retracer »)

   CE QUE CE SOCLE FAIT : il RANGE les CODES des bons d'achat émis par les MARQUES du réseau (PayEnCash Solution :
   techBon / techMarchand), et lui seul permet de les UTILISER sur un bon proposé par leur marque (page 05 :
   techLienUtiliserBon, qui exige le compte du porteur — c'est ce qui rend chaque usage retraçable). Pour chaque bon
   rangé, on n'écrit que le code et la date à laquelle le porteur l'a rangé — jamais un montant, jamais ce qu'il
   reste, jamais un état : tout cela se RELIT chez la marque, dans PEC_DATA, à chaque peinture. Une copie serait fausse
   dès le premier usage — et une valeur écrite ici ressemblerait à une valeur détenue ici, ce que cette app n'est pas.

   CE QUE CE SOCLE N'EST PAS : pas un compte de paiement, aucune valeur détenue, aucun fonds. Il ne débite, ne crédite,
   ne bloque rien : ce qu'il reste sur un bon, c'est la marque qui le tient ; l'usage passe par la porte du data-layer,
   sous le compte du porteur. Il LIT PEC_DATA et n'écrit que sous SA clé, par compte client :
   `pec-bons-porteur:<clientId>` — la liste des codes. Les consultations et acceptations de documents, elles, sont
   celles du data-layer (espace `bons` : documentConsulter / acceptationsPoser, miroir de la table `consents`).

   LA FAMILLE « BON D'ACHAT PAYENCASH » (Mode, Fly) N'EST PAS ICI : un tel code est reconnu pour être REFUSÉ, avec la
   phrase qui dit pourquoi — cette app est celle des bons de marque. PayEnCash n'y apparaît qu'en note : elle a vendu
   le bon à travers son réseau, elle ne l'émet pas, ne le tient pas, n'en détient aucune valeur.

   Le porteur, c'est le COMPTE CLIENT existant (pec-client-actif, ouvert depuis mode/08-compte ou mode/21-inscription) :
   aucun compte n'est créé ici. Sans session, rien n'est lu ni écrit — la garde (payencash-garde.js, espace `bons`)
   ferme d'ailleurs les pages personnelles avant que ce socle ne peigne quoi que ce soit.

   VOCABULAIRE (règle ACPR — « une erreur coûte plus qu'une absence d'information ») : « bon d'achat de la marque »,
   « ranger un code », « ce qu'il te reste sur ce bon », « utiliser ce bon chez {marque} », « bon proposé par {marque} »,
   « couvert ». Jamais un mot qui ferait croire à un compte, à une valeur stockée, à un paiement ou à un usage
   universel. ══ */
(function () {
  'use strict';

  function D() { return window.PEC_DATA || null; }

  var ESPACE = 'bons';                        // l'espace des documents du porteur dans ref.documents / consents
  var PREFIXE = 'pec-bons-porteur:';          // + clientId → { bons: [{ code, ajouteLe }] }

  /* LE RAPPEL D'USAGE — une phrase, dite partout de la même façon (liste, détail, compte, bon proposé). Elle ne
     promet rien : elle rappelle ce que le titre est, qui l'émet, et ce que PayEnCash n'est pas. */
  var RAPPEL = "Un bon de marque s'utilise uniquement chez la marque qui l'a émis, sur son site, et nulle part ailleurs. " +
               "Il n'est ni remboursable en espèces, ni rendu en monnaie ; une fois utilisé, il n'est pas remboursé. " +
               "PayEnCash le vend à travers son réseau : ce qu'il en reste, c'est la marque qui le tient.";

  /* LES ÉTATS D'UN BON DE MARQUE, VUS DU PORTEUR — libellé + pastille du socle visuel. Le cycle de vie du data-layer
     (TECH_BON_ETATS) parle au réseau ; ces mots-ci parlent à celui qui tient le ticket. Deux états sont propres à
     cette app : « pas encore vendu » (un code édité par la marque, jamais passé au comptoir) et « introuvable »
     (un code rangé que les données ne connaissent plus). */
  var ETATS = {
    actif: ['Actif', 'pec-pill--live'],
    epuise: ['Utilisé en totalité', 'pec-pill--done'],
    expire: ['Expiré', 'pec-pill--off'],
    annule: ['Annulé', 'pec-pill--off'],
    vierge: ['Pas encore vendu', 'pec-pill--off'],
    introuvable: ['Introuvable', 'pec-pill--off']
  };
  function etatLbl(etat) { return (ETATS[etat] || [etat || '—'])[0]; }
  function etatPill(etat) { return (ETATS[etat] || ['', ''])[1]; }

  var DERNIER_ECHEC = null;
  function r2(x) { return Math.round((+x || 0) * 100) / 100; }
  function dateFr(ts) { return ts ? new Date(ts).toLocaleDateString('fr-FR') : ''; }

  // ── LE PORTEUR ET SA CLÉ ──────────────────────────────────────────────────────────────────────────────────
  function porteurId() { var d = D(); return (d && d.clientActifGet) ? (d.clientActifGet() || null) : null; }
  function cle() { var id = porteurId(); return id ? PREFIXE + id : null; }
  function lire() {
    var k = cle(); if (!k) return { bons: [] };
    try {
      var o = JSON.parse(localStorage.getItem(k) || 'null');
      if (o && typeof o === 'object') return { bons: Array.isArray(o.bons) ? o.bons : [] };
    } catch (e) {}
    return { bons: [] };
  }
  /* UNE ÉCRITURE REFUSÉE SE DIT : comme dans le data-layer (_ecrit), on rend vrai/faux et on garde le motif —
     un bon qu'on croit rangé et qui ne l'est pas, c'est un code que le porteur ne retrouvera pas. */
  function ecrire(o) {
    var k = cle(); if (!k) return false;
    try { localStorage.setItem(k, JSON.stringify(o)); }
    catch (e) { DERNIER_ECHEC = (e && e.name === 'QuotaExceededError') ? 'stockage plein' : ((e && e.message) || 'écriture refusée'); return false; }
    try { window.dispatchEvent(new Event('pec-bus')); } catch (e2) {}   // les écrans de l'app repeignent ; les autres onglets suivent par `storage`
    return true;
  }

  // ── LIRE UN CODE DANS LES DONNÉES ─────────────────────────────────────────────────────────────────────────
  /* La saisie prend la forme de son réseau (bonSaisieFormater : le préfixe des marques est conservé) — une seule
     mise en forme, celle du data-layer, jamais une copie. */
  function formater(code) {
    var d = D(), s = String(code == null ? '' : code).trim();
    if (!s) return '';
    return (d && d.bonSaisieFormater) ? d.bonSaisieFormater(s) : s.toUpperCase().replace(/\s/g, '');
  }
  function moyenValide(d, m) { return !!(d && d.MOYENS_COMPTOIR && d.MOYENS_COMPTOIR[m]); }

  /* L'AUTRE FAMILLE — le Bon d'achat PayEnCash (Mode, Fly). On ne le range pas ; on le RECONNAÎT pour le dire, comme
     le comptoir des marques le fait (_techBonControle) : « ce code est un Bon d'achat PayEnCash » vaut mieux qu'un
     « code inconnu » qui ferait chercher une faute qui n'existe pas. */
  function estBonPayEnCash(code) {
    var d = D(); if (!d || !d.bonNormaliserCode) return false;
    var n = d.bonNormaliserCode(code); if (!n) return false;
    return !!((d.bonParCode && d.bonParCode(n)) || (d.bonSerieVue && d.bonSerieVue(n, Date.now())));
  }

  /* LA VUE D'UN BON DE MARQUE — il ne vaut que sur le site de la marque émettrice. Son état de porteur se DÉRIVE
     de son cycle de vie (TECH_BON_ETATS parle au réseau, pas au porteur) : annulé, pas encore vendu (un code édité
     sans montant), utilisé en totalité, expiré, sinon actif — même ordre que le contrôle du data-layer
     (_techBonControle). Les mentions sont celles du référentiel (techRef : réseau limité, validité). */
  function vueMarque(tb, now) {
    var d = D(), T = d.techRef ? d.techRef() : {}, S = T.seuils || {}, F = T.fondement || {};
    var expire = !!(tb.expireLe && now > tb.expireLe);
    var etat = tb.etat === 'cancelled' ? 'annule'
      : tb.montant == null ? 'vierge'
      : (tb.etat === 'redeemed' || !(tb.solde > 0.004)) ? 'epuise'
      : expire ? 'expire' : 'actif';
    var detail = etat === 'annule' ? ('annulé' + (tb.annuleLe ? ' le ' + dateFr(tb.annuleLe) : '') + (tb.motifAnnulation ? ' — ' + tb.motifAnnulation : ''))
      : etat === 'epuise' ? (tb.utiliseLe ? 'utilisé le ' + dateFr(tb.utiliseLe) : '')
      : etat === 'expire' ? 'expiré le ' + dateFr(tb.expireLe) : '';
    var rev = (tb.revendeurId && d.techRevendeur) ? d.techRevendeur(tb.revendeurId) : null;
    var art = (d.refArticle && S.reseauLimiteSource) ? d.refArticle(S.reseauLimiteSource) : '';
    var siteLbl = String(tb.site || '').replace(/^https?:\/\//, '').replace(/\/$/, '');   // à l'écran, l'adresse sans son schéma ; le lien garde tout
    var mentions = [
      'Utilisable uniquement sur ' + siteLbl + ' — le site de ' + tb.marchand + ', qui l\'a émis. C\'est un réseau limité' + (art ? ' (' + art + ')' : '') + ' : il ne vaut nulle part ailleurs.',
      tb.expireLe ? 'Valable jusqu\'au ' + dateFr(tb.expireLe) + (F.validite && d.refArticle ? ' (' + d.refArticle(F.validite) + ' : au moins un an)' : '') + ' ; passé ce délai, ce qu\'il reste est perdu.' : '',
      'Ni échangeable, ni remboursable en espèces, ne donne lieu à aucun rendu de monnaie ; s\'utilise en une ou plusieurs fois, jusqu\'à épuisement — depuis cette app, avec ton compte.',
      'Le code vaut titre : conserve-le, il ne sera pas remplacé en cas de perte ou de vol.'
    ].filter(Boolean);   // le rôle de PayEnCash n'est pas une mention du bon : le détail le dit en note, la liste dans son rappel
    return {
      code: tb.code, marchandId: tb.marchandId,
      emetteur: tb.marchand, site: tb.site, siteLbl: siteLbl, ou: 'uniquement sur ' + siteLbl,
      montant: tb.montant, solde: tb.solde,
      etat: etat, etatLbl: etatLbl(etat), pill: etatPill(etat), detail: detail,
      expireLe: tb.expireLe || null, emisLe: tb.emisLe || null, venduLe: tb.venduLe || tb.emisLe || null,
      enseigne: rev ? rev.raisonSociale : null,
      moyen: moyenValide(d, tb.moyen) ? tb.moyen : null,
      mentions: mentions,
      reseauLimiteSource: S.reseauLimiteSource || ''
    };
  }

  /* RÉSOUDRE UN CODE — chez les marques du réseau (techBon), et là seulement. Rend null si aucune marque ne
     connaît ce code : un Bon d'achat PayEnCash est null ici aussi (estBonPayEnCash le nomme, à part). */
  function resoudre(code) {
    var d = D(); if (!d || !d.techBon) return null;
    var c = formater(code); if (!c) return null;
    var tb = d.techBon(c);
    return tb ? vueMarque(tb, Date.now()) : null;
  }

  // ── LA LISTE DU PORTEUR ───────────────────────────────────────────────────────────────────────────────────
  /* Chaque entrée est RELUE : un code que les données ne connaissent plus reste visible, dit « introuvable » —
     jamais une carte vide, jamais un montant recopié de la dernière fois. Un code de l'AUTRE famille (rangé avant
     que l'app ne se limite aux bons de marque) n'est plus listé : il n'a rien à faire ici, et le bon lui-même n'en
     est pas touché — il reste utilisable avec son ticket, là où il vaut. Le plus récemment rangé en tête. */
  function liste() {
    var st = lire();
    return st.bons.slice().sort(function (a, b) { return (b.ajouteLe || 0) - (a.ajouteLe || 0); }).map(function (e) {
      var r = resoudre(e.code);
      if (!r && estBonPayEnCash(e.code)) return null;
      if (!r) r = { code: e.code, marchandId: null, introuvable: true,
        emetteur: 'Bon de marque', site: '', siteLbl: '', ou: '', montant: null, solde: null,
        etat: 'introuvable', etatLbl: etatLbl('introuvable'), pill: etatPill('introuvable'),
        detail: 'ce code n\'est plus connu des données — vérifie-le sur ton ticket', expireLe: null, emisLe: null, venduLe: null,
        enseigne: null, moyen: null, mentions: [] };
      r.ajouteLe = e.ajouteLe || null;
      return r;
    }).filter(Boolean);
  }
  function estRange(code) {
    var c = formater(code); if (!c) return false;
    return lire().bons.some(function (e) { return e.code === c; });
  }
  /* LES BONS RANGÉS D'UNE MARQUE — ceux qu'un bon proposé par cette marque peut utiliser (page 05). */
  function bonsDeMarque(marchandId) {
    return liste().filter(function (r) { return !r.introuvable && r.marchandId === marchandId; });
  }
  /* CE QU'IL TE RESTE SUR TES BONS — la somme de ce qu'il reste sur les bons ACTIFS (un bon expiré ou annulé ne
     s'utilise pas : le compter serait mentir). Ce n'est le solde d'aucun compte : c'est une addition. */
  function total() {
    var l = liste(), t = 0, n = 0;
    l.forEach(function (r) { if (r.etat === 'actif' && r.solde > 0) { t += r.solde; n++; } });
    return { reste: r2(t), utilisables: n, nb: l.length };
  }

  // ── LES DOCUMENTS : CONSULTER, PUIS RECONNAÎTRE « LU ET ACCEPTÉ » ─────────────────────────────────────────
  /* Tout est porté par le data-layer (ref.documents.bons, documentConsulter, documentsEtat, acceptationsPoser) :
     l'état de chaque document — consulté ? accepté ? dans quelle version ? — se LIT, jamais déduit ici. */
  function documents() {
    var d = D(), id = porteurId();
    if (!d || !id || !d.documentsEtat) return [];
    return d.documentsEtat(ESPACE, id);
  }
  function acceptations() { var d = D(), id = porteurId(); return (d && id && d.acceptationsGet) ? d.acceptationsGet(ESPACE, id) : []; }
  function acceptationsRequises() { var d = D(), id = porteurId(); return (d && id && d.acceptationsRequises) ? d.acceptationsRequises(ESPACE, id) : []; }
  /* CONSULTER — l'écran ouvre le document ET le note ici (clé, version, horodatage) : c'est cette trace qui ouvre
     ensuite l'acceptation, sur la même version. */
  function consulter(cle) {
    var d = D(), id = porteurId();
    if (!d || !d.documentConsulter) return { ok: false, motif: 'La consultation des documents n\'est pas disponible.' };
    if (!id) return { ok: false, motif: 'Connecte-toi pour que ta lecture soit notée sur ton compte client.' };
    var r = d.documentConsulter(ESPACE, id, cle, id);
    return r && r.ok ? { ok: true } : { ok: false, motif: (r && (r.message || r.motif)) || 'Consultation non enregistrée.' };
  }
  /* ACCEPTER — refusé tant que le document n'a pas été consulté dans cette version : une case cochée sur un texte
     jamais ouvert n'est pas un consentement. */
  function accepter(cle) {
    var d = D(), id = porteurId();
    if (!id) return { ok: false, motif: 'Connecte-toi pour accepter les documents : une acceptation appartient à un compte client.' };
    if (!d || !d.acceptationsPoser) return { ok: false, motif: 'L\'acceptation des documents n\'est pas disponible.' };
    var doc = documents().filter(function (x) { return x.cle === cle; })[0];
    if (!doc) return { ok: false, motif: 'Document inconnu.' };
    if (doc.aJour) return { ok: true, deja: true, document: doc };
    if (!doc.peutAccepter) return { ok: false, aLire: true, motif: 'Consulte d\'abord « ' + doc.titre + ' » (version ' + doc.version + ') : on n\'accepte pas un texte qu\'on n\'a pas ouvert.' };
    var poses = d.acceptationsPoser(ESPACE, id, [cle], id) || [];
    if (!poses.length) return { ok: false, motif: 'L\'acceptation n\'a PAS été enregistrée (écriture refusée) — libère de la place sur cet appareil et recommence.' };
    return { ok: true, document: documents().filter(function (x) { return x.cle === cle; })[0] || doc };
  }

  // ── LA VÉRIFICATION D'IDENTITÉ DU PORTEUR ─────────────────────────────────────────────────────────────────
  /* LE BESOIN SE DÉRIVE, il ne s'écrit pas : la somme des montants des bons rangés ACHETÉS EN ESPÈCES au comptoir
     sur la fenêtre glissante, comparée au palier espèces ; la même chose PAR CARTE. Les paliers viennent de
     kycPorteurRef() — aucun chiffre ici. Un bon dont le moyen d'achat n'est pas connu NE COMPTE PAS : on n'invente
     pas comment le porteur a payé son bon, et l'écran dit combien de bons sont dans ce cas. La fenêtre s'applique
     à la date d'ACHAT (vente au comptoir), pas à la date où le porteur a rangé le code. C'est une VIGILANCE sur qui
     porte les bons — pas la limite d'un compte : il n'y en a pas.
     `candidat` (facultatif) : la vue d'un bon qu'on s'apprête à ranger — comptée AVEC les autres, pour savoir si
     c'est LUI qui fait franchir un palier. */
  function kyc(candidat) {
    var d = D(), P = (d && d.kycPorteurRef) ? d.kycPorteurRef() : { especesEur: 0, carteEur: 0, fenetreJours: 0, source: '' };
    var now = Date.now(), deb = now - (+P.fenetreJours || 0) * 86400000;
    var esp = 0, cb = 0, sansMoyen = 0, horsFenetre = 0;
    var l = liste(); if (candidat) l = l.concat([candidat]);
    l.forEach(function (r) {
      if (r.introuvable || r.montant == null) return;
      var t = r.venduLe || r.emisLe || 0;
      if (!(t >= deb && t <= now)) { horsFenetre++; return; }
      if (r.moyen === 'especes') esp += r.montant;
      else if (r.moyen === 'carte') cb += r.montant;
      else sansMoyen++;
    });
    esp = r2(esp); cb = r2(cb);
    var id = porteurId();
    var verifie = !!(id && d && d.clientIdentiteVerifiee && d.clientIdentiteVerifiee(id));
    // un dossier déjà déposé (bus, si chargé) : la décision appartient à la hotline, on la LIT
    var dossier = null;
    try {
      if (id && window.PEC_BUS && PEC_BUS.verifications) dossier = PEC_BUS.verifications().filter(function (v) { return v.clientId === id; })[0] || null;
    } catch (e) {}
    if (dossier && dossier.statut === 'validee') verifie = true;
    return { paliers: P, cumulEspeces: esp, cumulCarte: cb, sansMoyen: sansMoyen, horsFenetre: horsFenetre,
      depasseEspeces: esp > P.especesEur, depasseCarte: cb > P.carteEur,
      requis: (esp > P.especesEur || cb > P.carteEur), verifie: verifie,
      dossier: dossier ? { id: dossier.id, statut: dossier.statut, motif: dossier.motif || null } : null };
  }

  /* PEUT-ON RANGER ? — tout accepté ET, si la vérification d'identité est requise, vérification faite. Rend ce qui
     manque, en clair, avec l'écran où y remédier. `candidat` : le bon qu'on veut ranger, compté dans les paliers. */
  function peutRanger(candidat) {
    var manque = [];
    if (!porteurId()) return { ok: false, manque: [{ cle: 'session', libelle: 'Connecte-toi à ton compte client : la liste est la tienne.', href: '04-compte.html' }] };
    var req = acceptationsRequises();
    if (req.length) manque.push({ cle: 'documents', libelle: 'Lis et accepte ' + (req.length > 1 ? 'les documents en vigueur' : 'le document en vigueur') + ' : ' + req.map(function (x) { return x.titre; }).join(', ') + '.', href: '04-compte.html', documents: req });
    var k = kyc(candidat);
    if (k.requis && !k.verifie) {
      var quoi = candidat ? 'En rangeant ce bon, tes bons ' : 'Tes bons ';
      manque.push({ cle: 'identite', kyc: k,
        libelle: k.dossier && (k.dossier.statut === 'a_controler' || k.dossier.statut === 'transmise_pvid')
          ? quoi + 'dépassent un palier de vigilance : ta vérification d\'identité (dossier ' + k.dossier.id + ') est en contrôle — on range dès la décision.'
          : quoi + 'dépass' + (candidat ? 'eraient' : 'ent') + ' le palier de vigilance ' + (k.depasseEspeces && k.depasseCarte ? 'des bons achetés en espèces et par carte' : k.depasseEspeces ? 'des bons achetés en espèces' : 'des bons achetés par carte') + ' : vérifie ton identité avant.',
        href: '04-compte.html' });
    }
    return { ok: !manque.length, manque: manque };
  }

  // ── RANGER / RETIRER ──────────────────────────────────────────────────────────────────────────────────────
  /* RANGER UN CODE — chaque refus a SON motif (jamais un échec muet) : session, documents à accepter, identité à
     vérifier, code de l'autre famille, forme du code, code inconnu, code pas encore vendu, bon annulé, doublon.
     On n'écrit que le code. */
  function ajouter(code) {
    var d = D(); if (!d) return { ok: false, motif: 'Les données ne sont pas chargées — rouvre la page.' };
    if (!porteurId()) return { ok: false, session: true, motif: 'Connecte-toi à ton compte client pour ranger un bon : la liste est la tienne, elle n\'existe pas sans compte.' };
    var pr = peutRanger();
    if (!pr.ok) return { ok: false, manque: pr.manque, documents: (pr.manque.filter(function (m) { return m.cle === 'documents'; })[0] || {}).documents || null, motif: pr.manque.map(function (m) { return m.libelle; }).join(' ') };
    var brut = String(code == null ? '' : code).trim();
    if (!brut) return { ok: false, champ: 'code', motif: 'Saisis le code imprimé sur ton ticket.' };
    var r = resoudre(brut);
    if (!r) {
      /* LA FRONTIÈRE SE DIT, elle ne se devine pas : un Bon d'achat PayEnCash n'est pas « inconnu », il est d'une
         autre famille — et cette app n'est pas la sienne. */
      if (estBonPayEnCash(brut)) return { ok: false, champ: 'code', famille: 'payencash', motif: 'Ce code est un Bon d’achat PayEnCash : il ne se range pas ici, cette app est celle des bons de marque.' };
      var pre = String(((d.techRef ? d.techRef() : {}).prefixeBon) || '').toUpperCase();
      var preA = pre.replace(/[^A-Z0-9]/g, ''), alnum = brut.toUpperCase().replace(/[^A-Z0-9]/g, '');
      var formeMarque = !!preA && alnum.indexOf(preA) === 0 && alnum.length === preA.length + 12;
      if (!formeMarque) return { ok: false, champ: 'code', motif: 'Ce code n\'a pas la forme d\'un bon de marque' + (pre ? ' (' + pre + 'XXXX-XXXX-XXXX)' : '') + '. Vérifie le ticket.' };
      return { ok: false, champ: 'code', motif: 'Code inconnu — aucune marque du réseau n\'a émis ce code. Vérifie le code imprimé sur ton ticket : les bons de marque sont remis au comptoir des commerces du réseau PayEnCash.' };
    }
    if (r.etat === 'vierge') return { ok: false, champ: 'code', motif: 'Ce code existe chez ' + r.emetteur + ' mais n\'a pas encore été vendu au comptoir : il n\'y a rien à ranger pour l\'instant.' };
    if (r.etat === 'annule') return { ok: false, champ: 'code', motif: 'Ce bon a été ' + (r.detail || 'annulé') + ' : il ne vaut plus rien, on ne le range pas.' };
    var st = lire();
    if (st.bons.some(function (e) { return e.code === r.code; })) return { ok: false, champ: 'code', doublon: r.code, motif: 'Ce bon est déjà rangé.' };
    // c'est CE bon qui ferait franchir un palier : on le dit avant d'écrire, et le bon reste utilisable avec son ticket
    var pc = peutRanger(r);
    if (!pc.ok) return { ok: false, manque: pc.manque, identite: true, motif: pc.manque.map(function (m) { return m.libelle; }).join(' ') + ' Ton bon reste tel quel, avec son ticket.' };
    st.bons.unshift({ code: r.code, ajouteLe: Date.now() });
    if (!ecrire(st)) return { ok: false, motif: 'Le bon n\'a PAS été rangé (' + (DERNIER_ECHEC || 'écriture refusée') + ') — libère de la place sur cet appareil et recommence ; rien n\'a été pris en compte.' };
    return { ok: true, bon: r };
  }
  function retirer(code) {
    if (!porteurId()) return { ok: false, motif: 'Aucune session : rien à retirer.' };
    var c = formater(code), st = lire(), avant = st.bons.length;
    st.bons = st.bons.filter(function (e) { return e.code !== c; });
    if (st.bons.length === avant) return { ok: false, motif: 'Ce code n\'est pas dans ta liste.' };
    if (!ecrire(st)) return { ok: false, motif: 'Le retrait n\'a PAS été enregistré (' + (DERNIER_ECHEC || 'écriture refusée') + ').' };
    return { ok: true };
  }

  // ── UTILISER UN BON SUR UN BON PROPOSÉ PAR SA MARQUE (page 05) ────────────────────────────────────────────
  /* L'APP EST OBLIGATOIRE, ET C'EST ICI QUE ÇA SE JOUE : l'usage porte le compte du porteur (`par`) — le data-layer
     le refuse sans lui, et chaque usage le garde (retraçable). On VÉRIFIE d'abord (ce que le bon prendra, sans rien
     toucher : techBonVerifier tient la règle du réseau limité), puis on UTILISE (techLienUtiliserBon). Le bon doit
     être RANGÉ dans la liste du porteur : un bon de marque s'utilise depuis l'app, pas depuis un code dicté — et un
     bon qu'un palier de vigilance empêche de ranger ne s'utilise pas tant que l'identité n'est pas vérifiée. */
  function utiliser(slug, code) {
    var d = D(), id = porteurId();
    if (!d) return { ok: false, motif: 'Les données ne sont pas chargées — rouvre la page.' };
    if (!id) return { ok: false, session: true, motif: 'Connecte-toi à ton compte client : un bon de marque s\'utilise depuis l\'app, avec ton compte.' };
    if (!d.techLien || !d.techBonVerifier || !d.techLienUtiliserBon) return { ok: false, motif: 'L\'utilisation d\'un bon n\'est pas disponible dans cette version des données.' };
    var x = d.techLien(slug); if (!x) return { ok: false, motif: 'Ce bon proposé est introuvable.' };
    var c = formater(code);
    if (!c) return { ok: false, motif: 'Aucun code de bon.' };
    if (!estRange(c)) return { ok: false, motif: 'Range d\'abord ce bon dans ta liste : un bon de marque s\'utilise depuis l\'app, avec ton compte.' };
    var v = d.techBonVerifier(c, { marchandId: x.marchandId, montant: x.restant });
    if (!v.ok) return v;
    var u = d.techLienUtiliserBon(slug, c, { par: id });
    if (!u.ok) return u;
    return { ok: true, pris: u.pris, reste: u.reste, soldeBon: u.soldeBon, lien: u.lien, bon: resoudre(c) };
  }

  function moyenLbl(k) { var d = D(); return (d && d.MOYENS_COMPTOIR && d.MOYENS_COMPTOIR[k]) || ''; }

  window.PEC_BONS = {
    PREFIXE: PREFIXE, ESPACE: ESPACE, RAPPEL: RAPPEL, ETATS: ETATS,
    porteurId: porteurId, formater: formater, resoudre: resoudre, estBonPayEnCash: estBonPayEnCash,
    liste: liste, estRange: estRange, total: total, bonsDeMarque: bonsDeMarque,
    ajouter: ajouter, retirer: retirer, utiliser: utiliser, peutRanger: peutRanger,
    kyc: kyc,
    documents: documents, acceptations: acceptations, acceptationsRequises: acceptationsRequises, consulter: consulter, accepter: accepter,
    etatLbl: etatLbl, etatPill: etatPill, moyenLbl: moyenLbl, dateFr: dateFr,
    dernierEchec: function () { return DERNIER_ECHEC; }
  };
})();
