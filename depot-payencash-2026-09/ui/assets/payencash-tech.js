/* ══ PAYENCASH SOLUTION — socle partagé des écrans (19/09, nuit) ═══════════════════════════════════════
   Cahier des charges « API de mise en relation pour réseaux limités de bons d'achat ».

   Ce module porte UNE fois ce qui est commun aux pages de l'espace : la session, la liste de ce qui reste à
   faire, et l'origine du site (pour les bouts de code d'intégration). Il se charge APRÈS payencash-data.js
   et payencash-bus.js, AVANT les scripts de page.

   API :
     PEC_TECH.session(type)    → { id, type:'marchand'|'revendeur', at } ou null (sans type : la première ouverte)
     PEC_TECH.entrer(id,type)  → ouvre la session de CET espace, sans toucher à l'autre
     PEC_TECH.deconnecter(t)   → ferme celle de cet espace (sans argument : les deux)
     PEC_TECH.aFaire(id)       → ce qui manque à une marque (vendre, être payée, intégrer), DÉRIVÉ, dans l'ordre où
                                 il faut le faire — chaque ligne { txt, href } mène à la carte du compte où agir
     PEC_TECH.origine()        → l'origine du site, pour composer un bout de code d'intégration copiable
     PEC_TECH.entete(el, o)    → la marque payEnCash Solution, en haut de chaque écran ({ lien:false } : sans lien)
     PEC_TECH.menu(el, actif)  → la barre de navigation de l'espace (celle du rôle connecté), `actif` = nom du fichier
     PEC_TECH.hero(el, o)      → le haut de page léger : { teinte, titre, promesse, etapes[≤3], idTitre, idSub }
                                 (ni icône ni surtitre depuis le 23/09 au soir : `ico`, `eyebrow`, `idEyebrow` sont ignorés)
     PEC_TECH.sousNav(el, o)   → le haut d'une page à sections : { teinte, retour:{href,lbl}, titre, sous, onglets[] }
     PEC_TECH.renvoiRevendeurHTML(rv) → la carte qui ramène un point de vente dans SON app (il n'a plus d'écran ici)
     PEC_TECH.reseauOu(id, o)  → le réseau d'une marque, tel que le lit le module « comment payer » (Mode, Fly) ;
                                 o.slug : le bon proposé dont la rencontre dépend
     PEC_TECH.jeuDemo(cb)      → monte la chaîne de démonstration d'un geste (zéro seed sans lui) ; dossierDemo(m, dir)
                                 pose et contrôle le dossier KYB au coffre
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  var T = {};
  T.D = function () { return window.PEC_DATA; };

  /* (19/09, nuit) UNE SESSION PAR ESPACE, PAS UNE POUR LES DEUX. Un même professionnel peut être
     commerçant sur son site ET revendeur pour un autre : avec une clé unique, entrer dans l'un
     éjectait de l'autre — et la galerie des maquettes ne pouvait montrer qu'un des deux écrans, le
     second affichant sa garde. Deux espaces distincts, deux sessions distinctes. */
  T.CLES = { marchand: 'pec-tech-session-marchand', revendeur: 'pec-tech-session-revendeur' };
  T.session = function (type) {
    var l = type ? [type] : ['marchand', 'revendeur'];
    for (var i = 0; i < l.length; i++) {
      try {
        var s = JSON.parse(localStorage.getItem(T.CLES[l[i]]) || 'null');
        if (s && s.id) { s.type = l[i]; return s; }
      } catch (e) {}
    }
    return null;
  };
  T.entrer = function (id, type) {
    if (!id || !T.CLES[type]) return null;
    var s = { id: id, type: type, at: Date.now() };
    try { localStorage.setItem(T.CLES[type], JSON.stringify(s)); } catch (e) {}
    return s;
  };
  T.deconnecter = function (type) {
    (type ? [type] : ['marchand', 'revendeur']).forEach(function (t) {
      try { localStorage.removeItem(T.CLES[t]); } catch (e) {}
    });
  };

  /* CE QUI RESTE À FAIRE — dérivé de l'état réel, jamais une liste écrite dans un écran. L'ordre compte :
     on ne demande pas une clé d'API à quelqu'un dont le compte n'est pas encore validé. Tout n'y bloque pas la
     vente : le compte, la déclaration, les documents et le contrat l'empêchent ; l'offre, le RIB, le mandat de
     l'abonnement et la clé d'API manquent pour être PAYÉE et INTÉGRÉE — l'écran titre la liste en conséquence. */
  /* (23/09, soir — fondatrice : « si une page me demande quelque chose, ça doit me ramener à l'endroit où je dois agir :
     raccourci immédiat vers le détail ») CHAQUE CHOSE À FAIRE PORTE SON ADRESSE : `{ txt, href }`, l'écran en fait un lien. */
  T.aFaire = function (marchandId) {
    var D = T.D(); if (!D) return [];
    var m = D.techMarchand(marchandId); if (!m) return [];
    var l = [];
    if (m.statut === 'pending') l.push({ txt: 'Ton compte est en attente de vérification — nous contrôlons ton identité légale.', href: '10-compte.html?s=identite#dossier' });
    if (m.statut === 'suspended') l.push({ txt: 'Ton compte est suspendu : plus aucun bon ne s’émet. Contacte-nous.', href: '10-compte.html?s=identite#identite' });
    if (!D.techMarchandConforme(m.id)) l.push({ txt: 'Ta déclaration « réseau limité » n’est pas encore validée — c’est elle qui tient l’exemption, et rien ne s’ouvre avant.', href: '10-compte.html?s=documents#declaration' });
    /* (23/09) CE QUI EMPÊCHE DE TRAVAILLER AVEC NOUS — la règle unique du data-layer (dirigeant, documents lus et acceptés,
       contrat-cadre signé, déclaration validée) : l'écran ne la réécrit pas, il la lit, avec l'adresse de chaque manque. */
    if (D.techMarchandPeutTravailler) D.techMarchandPeutTravailler(m.id).manque.forEach(function (x) { if (x.cle !== 'statut' && x.cle !== 'declaration') l.push({ txt: x.libelle, href: x.href }); });
    /* (22/09 — grossiste) CE QUI MANQUE POUR ÊTRE PAYÉE : son offre de paiement et son RIB. Nous lui achetons
       ses bons ; sans RIB il n’y a personne à virer, et sans offre choisie c’est la nôtre par défaut qui court. */
    if (m.statut === 'validated' && !m.modePaiement) {
      var d0 = D.techModeDefaut();
      l.push({ txt: 'Choisis ton offre de paiement — sans choix, c’est « ' + d0.libelle + ' » (remise ' + String(d0.remisePct).replace('.', ',') + ' %) qui s’applique.', href: '10-compte.html?s=paiement#modalites' });
    }
    if (m.statut === 'validated' && !D.techMarchandRib(m)) l.push({ txt: 'Dépose ton RIB : c’est le compte bancaire que nous virons à chaque échéance — aucun virement ne part sans lui.', href: '10-compte.html?s=paiement#rib' });
    var fo = D.techMarchandFormule(m);
    if (fo && fo.prix > 0 && !D.techSepaMandat('marchand', m.id)) l.push({ txt: 'Signe le mandat de prélèvement de ton abonnement « ' + fo.nom + ' » (' + D.eur(fo.prix) + '/mois).', href: '10-compte.html?s=abonnement#abonnement' });
    if (m.statut === 'validated' && D.techMarchandConforme(m.id) && !D.techCleActive(m.id)) l.push({ txt: 'Génère ta clé d’API : c’est elle qui fait parler ton site à notre base.', href: '10-compte.html?s=integration#api' });
    /* (23/09) plus de « revendeurs sous contrat » à attendre : c'est tout le réseau qui vend ses bons. */
    return l;
  };

  /* ══ LA MARQUE ET LE MENU (20/09, fondatrice : « créer un menu pour l'espace PayEnCash Technologie, et
     pourquoi il n'y a pas le logo ») ═══════════════════════════════════════════════════════════════
     C'était vrai : les six écrans n'affichaient qu'un intitulé en capitales, sans la marque écrite comme
     partout ailleurs (pay<b>En</b>Cash + le nom de l'app), et on ne pouvait passer d'un écran à l'autre
     qu'en revenant en arrière. Les deux vivent ICI, une seule fois : six copies d'une barre de navigation,
     c'est six occasions de la laisser dériver.
     LE MENU SUIT LE RÔLE CONNECTÉ : un revendeur n'a rien à faire dans l'espace d'un commerçant, et une
     entrée qui mène à une garde de session est une entrée qui ment. */
  /* (22/09, fondatrice : « dans l'espace PayEnCash Solution, menu Bon d'achat, Paiement, Outils, Compte »)
     QUATRE ENTRÉES, LES MÊMES POUR LES DEUX RÔLES — ce qui change, c'est où elles mènent : la marque émet et se
     fait payer, le point de vente vend et se fait prélever. Deux libellés différents pour la même idée, c'est
     deux façons d'apprendre le même espace. */
  T.ESPACES = {
    marchand: [
      { href: '02-espace.html',      lbl: 'Bon d’achat', ico: 'i-ticket' },   // (23/09, audit) un bon est un ticket, pas une carte bancaire
      { href: '08-paiement.html',    lbl: 'Paiement',    ico: 'i-receipt' },
      { href: '09-outils.html',      lbl: 'Outils',      ico: 'i-file' },
      { href: '10-compte.html',      lbl: 'Compte',      ico: 'i-user' }
    ],
    /* ══ (23/09, fondatrice : « l'app PayEnCash Solution s'adresse aux marques ; nos partenaires ont leur propre
       app ») LE POINT DE VENTE N'A PLUS D'ESPACE ICI ═══════════════════════════════════════════════════════
       Il en avait un, et c'était une erreur de structure : un commerce qui distribue nos bons ET ceux des marques
       n'a pas à ouvrir deux applications ni à retenir deux mots de passe. Tout ce qui le concerne — son comptoir,
       ses contrats de marque, son mandat de prélèvement ou son compte d'avance, ses rencontres — vit désormais
       dans SON app, à l'onglet « Marques » (ui/partenaire/09-marques.html). Solution ne parle plus qu'aux marques. */
    revendeur: [
      { href: '../partenaire/09-marques.html', lbl: 'Mon app', ico: 'i-store' }
    ],
    /* PERSONNE N'EST CONNECTÉ : on ne montre que les deux portes, et la documentation qui est publique. */
    /* (23/09) LE VISITEUR ARRIVE MAINTENANT QUELQUE PART : la page principale de PayEnCash Solution dit à quelles
       marques nous nous adressons et ce que nous leur achetons. Avant elle, une marque qui entendait parler de
       nous tombait sur une page de connexion — c'est-à-dire sur une porte fermée. */
    visiteur: [
      { href: 'index.html',          lbl: 'Accueil',     ico: 'i-home' },
      { href: '01-connexion.html',   lbl: 'Connexion',   ico: 'i-user' },
      { href: '00-inscription.html', lbl: 'Rejoindre',   ico: 'i-plus' },
      { href: '03-documentation.html', lbl: 'API',       ico: 'i-file' }
    ]
  };
  /* LA MARQUE — écrite comme dans les autres apps : pay<b>En</b>Cash suivi du nom de l'espace en capitales.
     Le nom vient du référentiel : le jour où il change, les six écrans changent avec lui. */
  T.entete = function (el, o) {
    if (typeof el === 'string') el = document.getElementById(el);
    if (!el) return null;
    var D = T.D(), nom = (D && D.techRef) ? D.techRef().nom : 'PayEnCash Solution';
    var s = T.session();
    /* ELLE RAMÈNE CHEZ SOI : chez le commerçant, chez le revendeur, ou à la porte si personne n'est entré.
       (21/09) SAUF SUR LA PAGE DU CLIENT FINAL ({ lien: false }) : il n'a pas d'espace chez nous, et la marque
       le menait à la porte des PROFESSIONNELS — ou, dans la fenêtre du widget, faisait quitter son paiement. */
    /* (23/09) « CHEZ SOI » POUR UN POINT DE VENTE, C'EST SON APP — plus un écran de Solution : depuis que le
       comptoir des marques vit dans l'app du commerce, la marque le ramène là-bas, pas sur une redirection. */
    var chez = s ? (s.type === 'revendeur' ? '../partenaire/09-marques.html' : '02-espace.html') : '01-connexion.html';
    /* (21/09, fondatrice : « le logo P … dans le style de départ », « intègre le logo sur PayEnCash Technologie ; tu
       utilises le P avec le shop », puis « les slogans unifiés sur toutes les apps ») LA MARQUE DES AUTRES APPS : le P au
       sac (détouré de son fond noir) remplace le bouclier, le nom s'écrit comme partout, le slogan vient dessous. */
    var corps = D ? D.marqueHTML('solution', { slogan: true, nom: nom.replace(/^PayEnCash\s*/i, '') }) : nom;
    el.innerHTML = (o && o.lien === false)
      ? '<span class="pec-marque" role="img" aria-label="' + nom + '">' + corps + '</span>'
      : '<a class="pec-marque" href="' + chez + '" aria-label="' + nom + '">' + corps + '</a>';
    return el;
  };
  /* ══ (21/09, fondatrice : « la modale qui s'ouvre doit être celle COMMENT PAYER, en sachant que c'est pour
     la boutique connectée ») LE RÉSEAU D'UNE BOUTIQUE, TEL QUE LE LIT « COMMENT VEUX-TU PAYER ? » ═══════════
     Le choix partagé avec Mode et Fly (payencash-comment-payer.js) montre les points d'UN réseau ; on lui
     passe ici celui de CETTE boutique : ses revendeurs sous contrat vivant, en boutique ou mobiles. Tout vient
     du data-layer (techChemins, techPoints, techRevendeursMobiles) — ce module ne fait que traduire.
     Rend null pour un commerçant inconnu : on ne monte pas un choix vers un réseau qui n'existe pas.
     (21/09, fondatrice : « pourquoi c'est pas comme Fly et Mode, la carte etc. ») LA RENCONTRE aussi : « un agent
     se déplace » fait ce qu'il fait sur Mode — l'adresse, la carte, la demande — avec ce qui change quand le
     client n'a pas de compte chez nous (le numéro qu'il laisse, l'accord rangé sur la rencontre). */
  T.reseauOu = function (marchandId, o) {
    o = o || {};
    var D = T.D(), m = (D && D.techMarchand) ? D.techMarchand(marchandId) : null;
    if (!m) return null;
    var slug = o.slug || null;
    var esc = function (v) { return D.esc(v); };
    return {
      points: function (opts) { return D.techPoints(marchandId, opts); },
      listeComplete: null,          // pas de page de référence : la liste de la boutique EST ici
      videTxt: function (filtre) {
        return filtre
          ? '<b>Aucun revendeur pour cette recherche</b> — efface le filtre, ou choisis une autre ville.'
          : '<b>' + esc(m.raisonSociale) + ' n’a pas encore de commerce qui vend ses bons ici.</b> Si tu as déjà un de ses bons, l’app Mes bons l’utilise tout de suite.';
      },
      trio: function () {
        var k = {}; D.techChemins(marchandId).forEach(function (c) { k[c.cle] = c; });
        return {
          enligne: 'Tu as déjà un bon ' + m.raisonSociale + ' : utilise-le depuis l’app Mes bons.',
          /* (21/09, fondatrice : « ça doit être pareil que [Mode] sauf que c'est la boutique, ses infos ») LES TROIS
             CHEMINS S'OUVRENT TOUJOURS, comme sur Mode. Grisé, « chez un partenaire » cachait sa carte et sa
             recherche à qui voulait voir ; ouvert, son volet dit la vérité — personne ici pour l'instant. */
          partenaire: { t: k.partenaire.titre, s: k.partenaire.aide },
          agent: { t: k.agent.titre, s: k.agent.aide }
        };
      },
      /* ══ (23/09, fondatrice : « pour la modale de paiement, ajoute pour API et lien envoyé, modale qui s'ouvre : notre
         réseau accepte espèces, pièces et CB ; ses bons d'achat sont utilisés sur le site de l'émetteur ; une fois
         utilisé, non remboursable ; pas de possibilité d'utiliser un bon sur un autre site ; réseau limité »)
         CE QU'IL FAUT SAVOIR AVANT D'ALLER AU COMPTOIR ═══════════════════════════════════════════════════════
         Rendu par « Comment veux-tu payer ? » sous le titre de « Acheter un bon d'achat » — pour la page d'une marque
         seulement (lien envoyé, flashcode, fenêtre du widget) : Mode et Fly n'ont pas de `rappel`, leur carte ne
         change pas. Il dit ce que le réseau ACCEPTE, pas ce qu'il promet d'éviter (23/09 : « enlève "payer sans
         carte" de partout »). RIEN N'EST ÉCRIT ICI : les moyens et la devise viennent de techRef().encaissement,
         l'article du réseau limité de techRef().seuils, le site de la fiche de la marque, la validité de bonsRef()
         — celle que techBonEmettre pose sur le bon. Le jour où l'avocat fait bouger un mot, il bouge dans le
         référentiel, pas dans un écran. HTML échappé, prêt à poser. */
      rappel: function () {
        var R = D.techRef(), E = R.encaissement || {}, S = R.seuils || {}, B = D.bonsRef ? D.bonsRef() : {};
        var court = function (txt) { return D.refArticle ? D.refArticle(txt) : String(txt || '').split(' — ')[0]; };
        var cite = function (txt) { return '<b title="' + esc(txt) + '">' + esc(court(txt)) + '</b>'; };
        var moyens = (E.moyens || []).map(function (x) {
          var s = '<b title="' + esc(x.source || '') + '">' + esc(x.lbl) + '</b>';
          if (x.k === 'especes' && E.piecesMaxParPaiement) s += ' (' + esc(String(E.piecesMaxParPaiement)) + ' pièces au plus par règlement)';
          if (x.k === 'carte' && x.source) s += ' (' + esc(court(x.source)) + ')';   // « selon les moyens que le commerce accepte et affiche »
          return s;
        });
        var l = [];
        /* la devise ne se réécrit pas : les libellés la portent déjà, sa source tient en infobulle sur la ligne */
        if (moyens.length) l.push('<li' + (E.deviseSource ? ' title="' + esc(E.deviseSource) + '"' : '') + '>Le réseau ' + esc(R.nom) + ' accepte ' + moyens.join(' et ') + '.</li>');
        l.push('<li>Le bon d’achat <b>' + esc(m.raisonSociale) + '</b> s’utilise uniquement sur <b>' + esc(m.siteUrl || ('le site de ' + m.raisonSociale)) + '</b> — sur aucun autre site : c’est un réseau limité' + (S.reseauLimiteSource ? ' (' + cite(S.reseauLimiteSource) + ')' : '') + '.</li>');
        l.push('<li>Une fois utilisé, il n’est <b>pas remboursable</b> — ni en espèces, ni contre de la monnaie.</li>');
        if (B.validiteMois) l.push('<li>Valable <b>' + esc(String(B.validiteMois)) + ' mois</b>.</li>');
        return '<b class="t"' + (E.consommation ? ' title="' + esc(E.consommation) + '"' : '') + '>Ce qu’il faut savoir</b><ul>' + l.join('') + '</ul>';
      },
      rencontre: !slug ? null : {
        titre: function () { return 'Un bon ' + m.raisonSociale + ' à te remettre'; },
        montantHTML: function (montant) { return 'Bon ' + esc(m.raisonSociale) + ' de <b>' + esc(D.eur(montant)) + '</b> — tu le lui paies en main propre, aucun frais.'; },
        garantieHTML: 'Il te vend un <b style="color:var(--color-ink)">bon ' + esc(m.raisonSociale) + '</b> et en reçoit le prix pour son propre compte : ni lui ni nous n’encaissons ta commande.',
        joignables: function (ville) { return D.techRevendeursMobilesVille(marchandId, ville); },
        personneTxt: function (ville) { return 'Aucun revendeur de ' + m.raisonSociale + ' ne se déplace à ' + ville + ' pour l’instant — cherche plutôt « Chez un partenaire », ou utilise un bon que tu as déjà depuis l’app Mes bons.'; },
        cta: 'Rechercher un revendeur',
        enCours: function () { return D.techRencontresLien(slug).filter(function (r) { return r.statut === 'demandee' || r.statut === 'acceptee'; })[0] || null; },
        /* SERVIE, ET SON BON PAS ENCORE UTILISÉ : une fois le bon proposé couvert par lui, on ne le relance plus. */
        servie: function () {
          var x = D.techLien(slug), pris = {}; ((x && x.usages) || []).forEach(function (p) { pris[p.code] = 1; });
          return D.techRencontresLien(slug).filter(function (r) { return r.statut === 'servie' && (r.codes || []).some(function (c) { return !pris[c]; }); })[0] || null;
        },
        verifier: function (b) { return D.techRencontreVerifier({ slug: slug, adresse: b.adresse, note: b.note }); },
        demander: function (b) { return D.techRencontreDemander({ slug: slug, adresse: b.adresse, note: b.note, tel: b.tel, canal: b.canal, consentement: b.consentement }); },
        annuler: function (id) { return D.techRencontreAnnuler(id, 'annulée par le client', 'client'); },
        popupHTML: 'Le revendeur qui prend ta demande <b style="color:var(--color-ink)">t’appelle pour confirmer le rendez-vous</b>. '
          + '<b style="color:var(--color-ink)">Il ne part qu’après cet appel</b> — c’est la règle, pour toi comme pour lui.',
        recapHTML: function (montant) { return 'Un bon ' + esc(m.raisonSociale) + ' de <b>' + esc(D.eur(montant)) + '</b>, dont tu lui paies le prix en main propre'; },
        accordSuffixe: 'Mon numéro n’est lu que par le revendeur qui prend la demande, et il s’efface quand elle se ferme.'
      }
    };
  };
  /* LA BARRE DE NAVIGATION — celle du rôle connecté, avec la page courante marquée. `actif` est le nom du
     fichier : on ne le devine pas depuis l'adresse, un écran sait où il est. */
  /* ══ LE HÉROS D'UNE PAGE (23/09, fondatrice : « adapte le visuel au contenu, fais comprendre facilement, usage facile »
     puis, le soir : « ton design de haut de page pour Bon d'achat, Paiement, Outils est trop lourd »)
     PREMIÈRE VERSION : un bloc sombre plein cadre, une grosse icône, trois cartes qui chevauchaient — 40 % de l'écran
     avant le premier chiffre utile. DÉSORMAIS : une icône teintée, un œil-de-bouche, un titre, une promesse en une
     ligne, sur le fond de la page ; « comment ça marche » se replie derrière un mot (`<details>`) — celui qui veut la
     logique l'ouvre, les autres voient tout de suite leur contenu. Les ids du titre et du sous-titre sont ceux que la
     page lit déjà (elle les repeint), la teinte vient de `data-tk` sur le cadre. */
  T.hero = function (el, o) {
    if (typeof el === 'string') el = document.getElementById(el);
    if (!el) return null;
    o = o || {};
    var D = T.D(), e = function (v) { return (D && D.esc) ? D.esc(v) : String(v == null ? '' : v); };
    var pas = (o.etapes || []).slice(0, 3);
    /* (23/09, soir — fondatrice : « le logo en haut, dessous “Compte” : pas beau ») UN SEUL EN-TÊTE, celui de la maison
       (.pec-root-header : le titre directement sur le fond) — ni icône, ni surtitre : la marque est déjà au-dessus. */
    el.innerHTML = '<section class="tk-hero">'
      + '<h1' + (o.idTitre ? ' id="' + e(o.idTitre) + '"' : '') + '>' + e(o.titre || '—') + '</h1>'
      + '<p class="sub"' + (o.idSub ? ' id="' + e(o.idSub) + '"' : '') + '>' + e(o.promesse || '—') + '</p>'
      + '</section>'
      + (pas.length ? '<details class="tk-pas"><summary><svg class="pec-ico" viewBox="0 0 24 24"><use href="#i-chevron-right"/></svg>Comment ça marche</summary><ol>'
          + pas.map(function (p) { return '<li>' + e(p) + '</li>'; }).join('') + '</ol></details>' : '');
    if (o.teinte) { var cadre = el.closest ? el.closest('.pec-device') : null; if (cadre) cadre.setAttribute('data-tk', o.teinte); }
    return el;
  };
  /* ══ LA SOUS-NAVIGATION D'UNE PAGE À SECTIONS (23/09, fondatrice : « revérifie la navigation de Compte page par page,
     le retour arrière, où sont les onglets ») ═══════════════════════════════════════════════════════════════════
     Dans une section, le retour tenait dans un petit lien sous le héros — invisible. Ici : une barre « ‹ Compte ›
     Documents » et, dessous, les onglets des sections qui défilent au doigt, la courante marquée. Une seule fois
     écrite : la page dit ses onglets, pas leur forme. */
  T.sousNav = function (el, o) {
    if (typeof el === 'string') el = document.getElementById(el);
    if (!el) return null;
    o = o || {};
    var D = T.D(), e = function (v) { return (D && D.esc) ? D.esc(v) : String(v == null ? '' : v); };
    var r = o.retour || {};
    el.innerHTML = '<div class="tk-sousnav">'
      + (r.href ? '<a class="retour tap" href="' + e(r.href) + '" aria-label="Retour à ' + e(r.lbl || 'la page précédente') + '"><svg class="pec-ico" viewBox="0 0 24 24"><use href="#i-chevron-left"/></svg><span>' + e(r.lbl || 'Retour') + '</span></a>' : '')
      + '<div class="tx"><h1 class="titre"' + (o.idTitre ? ' id="' + e(o.idTitre) + '"' : '') + '>' + e(o.titre || '—') + '</h1>'
      + (o.sous ? '<p class="sous"' + (o.idSub ? ' id="' + e(o.idSub) + '"' : '') + '>' + e(o.sous) + '</p>' : '') + '</div>'
      + '</div>'
      + ((o.onglets || []).length ? '<nav class="tk-onglets" aria-label="' + e(o.ongletsLbl || 'Sections') + '">' + o.onglets.map(function (t) {
          return '<a class="tap" href="' + e(t.href) + '"' + (t.actif ? ' aria-current="page"' : '') + (t.cle ? ' data-onglet="' + e(t.cle) + '"' : '') + '>' + e(t.lbl) + '</a>';
        }).join('') + '</nav>' : '');
    if (o.teinte) { var cadre = el.closest ? el.closest('.pec-device') : null; if (cadre) cadre.setAttribute('data-tk', o.teinte); }
    /* L'ONGLET COURANT SE MET EN VUE : sur un téléphone, le septième est hors champ, et une barre qui commence toujours au
       premier onglet fait croire qu'on n'est nulle part. */
    try { var cur = el.querySelector('.tk-onglets a[aria-current]'); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e0) {}
    return el;
  };

  /* ══ (23/09) UN POINT DE VENTE QUI ARRIVE SUR UN ÉCRAN DE MARQUE N'EST PAS ÉCONDUIT : on lui dit où est son écran,
     et on l'y mène. Sa session Solution existe encore — elle ouvre SON app, pas un écran vide. Écrit une fois : les
     pages Paiement et Outils le posaient chacune avec leurs mots, et Outils lui servait encore de vieux liens. ══ */
  T.renvoiRevendeurHTML = function (rv) {
    var D = T.D(), e = function (v) { return (D && D.esc) ? D.esc(v) : String(v == null ? '' : v); };
    var nom = (D && D.techRef) ? D.techRef().nom : 'PayEnCash Solution';
    return '<p class="pec-section-label tk-sec">Ton écran est dans l’app des commerces</p>'
      + '<div class="pec-card" style="padding:13px 15px"><p style="margin:0;font-size:12.5px;line-height:1.6;color:var(--color-muted)">'
      + (rv ? '<b style="color:var(--color-ink)">' + e(rv.raisonSociale) + '</b> est un point de vente. ' : '')
      + 'L’espace ' + e(nom) + ' s’adresse aux marques qui émettent les bons ; toi, tu les vends. '
      + 'Ton comptoir, ton mandat de prélèvement ou ton compte d’avance, ton encours et tes contrats sont à l’onglet « Marques » de ton app.</p>'
      + '<a class="pec-cta tap" href="../partenaire/09-marques.html" style="display:block;text-align:center;margin-top:11px">Ouvrir mon onglet « Marques »</a></div>';
  };

  T.menu = function (el, actif) {
    if (typeof el === 'string') el = document.getElementById(el);
    if (!el) return null;
    var s = T.session();
    var items = T.ESPACES[(s && s.type) || 'visiteur'] || T.ESPACES.visiteur;
    el.className = 'pec-tabbar';
    el.setAttribute('aria-label', 'Navigation de l\'espace');
    el.innerHTML = items.map(function (x) {
      var ici = x.href === actif;
      return '<a class="pec-tab" href="' + x.href + '"' + (ici ? ' aria-current="page"' : '') + '>'
        + '<svg class="pec-ico" viewBox="0 0 24 24"><use href="#' + x.ico + '"/></svg>' + x.lbl + '</a>';
    }).join('');
    return el;
  };

  /* L'ORIGINE DU SITE — pour le bout de code que le commerçant colle chez lui. En http(s) c'est l'origine
     réelle ; ouvert en fichier local, on le DIT plutôt que d'écrire une adresse qui ne marchera pas. */
  T.origine = function () {
    try {
      if (location.origin && location.origin.indexOf('http') === 0) return location.origin;
    } catch (e) {}
    return 'https://solution.payencash.fr';
  };

  /* ══ (19/09, nuit — « crée un compte de démo pour PayEnCash Technologie ») LE JEU DE DÉMONSTRATION ═════
     Il monte, D'UN GESTE et seulement sur un geste, la chaîne entière du cahier des charges : un commerçant
     e-commerce, deux revendeurs (une boutique et un mobile — de quoi remplir les trois chemins du client
     final), la déclaration « réseau limité » validée, les trois mandats, les deux mises en relation avec
     leurs contrats exécutés, et la clé d'API du commerçant.
     ZÉRO SEED : rien de tout cela n'existe tant que personne n'a cliqué — et rejouer le geste ne duplique
     rien, chaque création est contrôlée par le data-layer (SIRET unique, un seul contrat vivant par couple).
     LE SECRET DE LA CLÉ EST RENDU UNE FOIS, dans le rappel : nous n'en gardons que l'empreinte. */
  T.jeuDemo = function (cb) {
    var D = T.D(); cb = cb || function () {};
    if (!D || !D.techMarchandCreer) { cb({ ok: false, motif: 'La couche de données n\'est pas chargée.' }); return; }
    var fait = [];

    function siretValide(base) {
      /* UN SIRET DE DÉMONSTRATION DOIT PASSER LE MÊME CONTRÔLE QUE LES AUTRES (14 chiffres + clé de Luhn) :
         on ne desserre jamais une règle pour se faire plaisir — on cherche la clé qui tombe juste. */
      for (var k = 0; k < 10; k++) { var c = base + k; if (D._techSiretOk(c)) return c; }
      return null;
    }

    var m = D.techMarchands().filter(function (x) { return x.siteUrl === 'https://boutique-lila.fr'; })[0];
    var DIR = { prenom: 'Lila', nom: 'Benali', qualite: 'présidente' };   // (23/09) la dirigeante déclarée : c'est elle qui signe
    if (!m) {
      var r = D.techMarchandCreer({ raisonSociale: 'Boutique Lila', siret: siretValide('4048330480002'),
        siteUrl: 'https://boutique-lila.fr', email: 'hello@boutique-lila.fr', cgu: true, dirigeant: DIR,
        declarationUsage: 'Nos bons d\'achat sont émis par Boutique Lila et utilisables uniquement sur boutique-lila.fr, à l\'exclusion de tout autre site ou enseigne.' });
      if (!r.ok) { cb({ ok: false, motif: r.motif }); return; }
      m = r.marchand; fait.push('commerçant ' + m.id);
    }
    /* UNE MARQUE DE DÉMONSTRATION NÉE AVANT LA RÈGLE N'A PAS DE DIRIGEANT : on le déclare, comme l'écran Identité le ferait. */
    if (!D.techMarchandDirigeant(m)) { if (D.techMarchandDirigeantSet(m.id, DIR, 'démo').ok) fait.push('dirigeante déclarée'); m = D.techMarchand(m.id); }
    /* (23/09) LE DOSSIER KYB DE LA DÉMONSTRATION EST POSÉ AU COFFRE ET CONTRÔLÉ — la signature du contrat-cadre exige la
       pièce d'identité du dirigeant VALIDÉE (KYC), et la vente exige le dossier complet : on le fait pour de vrai, pièce
       par pièce, comme le contrôleur le ferait, et on le DIT dans `fait`. Sans coffre chargé, on le dit aussi. */
    if (T.dossierDemo(m, DIR)) fait.push('dossier KYB contrôlé (démo)'); else fait.push('coffre absent : dossier KYB non posé');
    var rvs = [
      { nom: 'Presse du Cours', base: '5521005540001', mode: 'sedentaire', ville: 'Marseille', adresse: '31 cours Mirabeau', mail: 'contact@presse-du-cours.fr' },
      { nom: 'Karim D.',        base: '3801298660002', mode: 'mobile',     ville: 'Marseille', adresse: '',                  mail: 'karim@distri.fr' }
    ].map(function (x) {
      var e = D.techRevendeurs().filter(function (y) { return y.raisonSociale === x.nom; })[0];
      if (e) return e;
      var r = D.techRevendeurCreer({ raisonSociale: x.nom, siret: siretValide(x.base), email: x.mail,
        cgu: true, mode: x.mode, ville: x.ville, adresse: x.adresse });
      if (r.ok) fait.push('revendeur ' + r.revendeur.id + ' (' + x.mode + ')');
      return r.ok ? r.revendeur : null;
    }).filter(Boolean);

    /* LA PLATEFORME STATUE — c'est son rôle (UC-3), et le geste est journalisé comme les autres. */
    var cnf = D.techConformiteMarchand(m.id);
    if (cnf && cnf.statut !== 'validated') { D.techConformiteStatuer(cnf.id, true, '', 'demo'); fait.push('conformité validée'); }
    /* LA VÉRIFICATION D'IDENTITÉ LÉGALE : en démonstration on la passe, et on le DIT — en production c'est
       un contrôle humain sur pièces, pas une ligne de code. */
    [['pec-tech-marchands', m.id], ['pec-tech-revendeurs', null]].forEach(function (p) {
      try {
        var l = JSON.parse(localStorage.getItem(p[0]) || '[]');
        l.forEach(function (x) { if (x.statut === 'pending') x.statut = 'validated'; });
        localStorage.setItem(p[0], JSON.stringify(l));
      } catch (e) {}
    });
    fait.push('comptes validés');
    /* (23/09) UNE MARQUE QUI VEND A LU ET ACCEPTÉ CHAQUE DOCUMENT ET SIGNÉ LE CONTRAT-CADRE : c'est la règle
       (techMarchandPeutTravailler), pas une facilité de démonstration — le jeu la joue donc pour de vrai. */
    try {
      var docs = ((D.ref.documents || {}).marchand || []).map(function (d) { return d.cle; });
      docs.forEach(function (k) { D.documentConsulter('marchand', m.id, k, 'démo'); });
      if (D.acceptationsRequises('marchand', m.id).length) { D.acceptationsPoser('marchand', m.id, docs, 'démo'); fait.push('documents lus et acceptés'); }
      if (!m.contratSigneLe) { var sg = D.techMarchandContratSigner(m.id, { accepte: true, par: 'démo' }); fait.push(sg.ok ? 'contrat-cadre signé par ' + sg.signataire : 'contrat-cadre non signé : ' + sg.motif); }
    } catch (eDoc) {}

    /* (23/09, soir — audit) LA MARQUE N'A PLUS DE MANDAT NI DE CONTRAT PAR POINT : nous lui ACHETONS ses bons, et tout le réseau
       vérifié les vend. Seul le mandat du revendeur (son engagement envers nous) reste — c'est ce qui ouvre son comptoir. */
    rvs.forEach(function (r) {
      if (!D.techMandatActif('reseller', r.id)) { D.techMandatSigner({ mandantType: 'reseller', mandantId: r.id, accepte: true, signePar: 'démo' }); fait.push('mandat de ' + r.id); }
    });

    var cle = D.techCleActive(m.id);
    if (cle) { cb({ ok: true, marchand: m, revendeurs: rvs, cle: cle, secret: null, fait: fait }); return; }
    D.techCleGenerer(m.id, function (g) {
      if (g.ok) fait.push('clé ' + g.cle.id);
      cb({ ok: true, marchand: m, revendeurs: rvs, cle: g.cle || null, secret: g.secret || null, fait: fait, motifCle: g.ok ? null : g.motif });
    });
  };

  /* LE DOSSIER KYB DE DÉMONSTRATION — chaque pièce obligatoire de la portée « marchand » déposée (un PDF de démonstration)
     puis VALIDÉE par le contrôle, avec les mentions relevées (Kbis : la société et sa dirigeante ; RIB : le compte) et la
     péremption des pièces qui expirent. Même écriture que le coffre (pec-doc:marchand:<id>:<pièce>), même verdict
     (PEC_DOCS.statuer). Le contrat-cadre, lui, n'est PAS posé ici : il se signe par la porte réelle. Rend faux sans coffre. */
  T.dossierDemo = function (m, dir) {
    var D = T.D(), DOCS = window.PEC_DOCS;
    if (!D || !DOCS || !DOCS.piecesDe || !DOCS.statuer) return false;
    var siren = String(m.siret || '').slice(0, 9), dans180 = new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);
    var fait = false;
    DOCS.piecesDe('marchand').forEach(function (p) {
      if (!p.obligatoire || p.genere) return;
      if (DOCS.get('marchand', m.id, p.id)) return;   // une pièce déjà là (déposée à la main) n'est pas écrasée
      var k = 'pec-doc:marchand:' + m.id + ':' + p.id, extra = {};
      if (p.id === 'kbis') extra.mentions = { raisonSociale: m.raisonSociale, formeJuridique: 'SAS', siren: siren, siret: m.siret, rcs: 'Marseille B ' + siren, adresse: '18 rue Paradis, 13001 Marseille', dirigeant: dir.prenom + ' ' + dir.nom };
      if (p.id === 'rib') extra.mentions = { iban: 'FR7630004000031234567890143', bic: 'BNPAFRPP', titulaire: m.raisonSociale };
      if (p.expire) extra.expiresOn = dans180;
      try { localStorage.setItem(k, JSON.stringify({ portee: 'marchand', id: m.id, piece: p.id, nom: p.id + '-demo.pdf', type: 'application/pdf', taille: 1024, at: Date.now(), statut: 'deposee', motif: '', data: 'data:application/pdf;base64,JVBERi0=' })); } catch (e) { return; }
      DOCS.statuer('marchand', m.id, p.id, 'validee', '', 'démo', Object.keys(extra).length ? extra : null);
      fait = true;
    });
    return fait || !!DOCS.get('marchand', m.id, 'cni');
  };

  window.PEC_TECH = T;
})();
