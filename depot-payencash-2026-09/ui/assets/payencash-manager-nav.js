/* =============================================================================
   PayEnCash — Barre latérale de l'ESPACE MANAGER (source unique)
   -----------------------------------------------------------------------------
   La même barre était recopiée à l'identique dans les 14 maquettes manager. Une
   entrée renommée, c'était 14 fichiers à éditer — et, en pratique, des copies qui
   divergent. Elle est désormais décrite ICI et nulle part ailleurs.

   Usage dans un écran :
       <aside class="pec-aside" data-pec-nav></aside>
   L'entrée active est déduite du nom de fichier courant : aucun paramètre à
   maintenir écran par écran, donc rien à oublier de mettre à jour.

   Icônes : ids du sprite `payencash-icons.js` — jamais d'emoji (charte).
   ============================================================================= */
(function () {
  // GROUPES PAR DOMAINE (fondatrice 02/09) : on lit le menu comme on pense le métier — piloter, la ligne
  // Mode et ses fournisseurs, les voyages, les MOYENS D'ENCAISSEMENT, l'argent, la relation client,
  // l'administration. Un groupe se replie ; seul le groupe de l'écran courant s'ouvre.
  // (17/09 — pivot) le réseau de points qui ENCAISSAIT a disparu : le canal « non agent » est le paiement en ligne
  // (20/09) le suivi des paiements en ligne est parti avec le prestataire. Les commerces partenaires reviennent
  // comme VENDEURS du Bon d’achat PayEnCash — réseau, activations et reversements en 29-partenaires, les bons d’achat en 41.
  // (18/09, soir — l'agent de caisse mobile est abandonné) le groupe « Encaissement » ne compte plus que DEUX canaux :
  // le commerce partenaire qui vend le Bon d’achat PayEnCash, et le distributeur mobile qui se déplace.
  // Sept entrées ont donc disparu du menu avec leurs écrans — supervision des courses (03), roster des agents (05),
  // planning (24), zones & dispatch (06), flotte (22), fonds de caisse remis aux agents (33) et masse salariale des
  // agents (15) : plus personne de PayEnCash ne se déplace pour prendre des espèces, il n'y a donc plus rien à
  // superviser, à planifier, à assurer ni à payer. Ce que le client règle en espèces passe désormais par un commerçant.
  var GROUPS = [
    {
      label: 'Pilotage', key: 'pilotage',
      items: [
        { file: '02-tableau-de-bord.html', icon: 'i-home', label: 'Tableau de bord' },
        { file: '30-carte-operations.html', icon: 'i-map-pin', label: 'Carte des opérations' },
        { file: '27-journal-flux.html', icon: 'i-route', label: 'Journal des flux' },
        { file: '20-notifications.html', icon: 'i-bell', label: 'Notifications' },
        { file: '11-audit.html', icon: 'i-history', label: 'Journal d’audit' },
      ],
    },
    {
      label: 'Mode — boutique & fournisseurs', key: 'mode',
      items: [
        { file: '25-mode.html', icon: 'i-file', label: 'Ligne Mode' },
        { file: '34-atelier.html', icon: 'i-scan', label: 'Atelier — contrôle & photos' },
        { file: '35-stock-mode.html', icon: 'i-tag', label: 'Stock Mode' },
        { file: '38-invendus-mode.html', icon: 'i-history', label: 'Invendus & démarque' },
        { file: '41-cartes-cadeaux.html', icon: 'i-promo', label: 'Bons d’achat PayEnCash & cartes cadeaux' },   // (18/09) tous les bons d’achat : vendus par les partenaires, émis par le manager
        { file: '26-fournisseurs.html', icon: 'i-store', label: 'Fournisseurs Mode' },
        { file: '36-facturation-fournisseurs.html', icon: 'i-banknote', label: 'Facturation fournisseurs' },
        { file: '43-reclamations-mode.html', icon: 'i-alert', label: 'Réclamations Mode' },   // (10/09 — lot 5) du client au fournisseur : constat, débit, contestation
        { file: '44-expeditions-mode.html', icon: 'i-package', label: 'Colis Mode' },          // (10/09 — lot 6) suivi transporteur jusqu'à la livraison + contrôle qualité
        { file: '37-livre-police.html', icon: 'i-lock', label: 'Livre de police' },
      ],
    },
    {
      label: 'Fly — voyages', key: 'fly',
      items: [
        { file: '04-commandes.html', icon: 'i-ticket', label: 'Réservations' },
        { file: '26-editer-promos.html', icon: 'i-star', label: 'Promos & offres' },
        { file: '13-solde-fournisseur.html', icon: 'i-plane', label: 'Solde fournisseur voyage' },
      ],
    },
    {
      label: 'Encaissement — commerces partenaires', key: 'encaissement',
      items: [
        { file: '29-partenaires.html', icon: 'i-store', label: 'Commerces partenaires — Bons d’achat' },   // (18/09) réseau de vente du Bon d’achat PayEnCash : candidatures, activation, reversements
        { file: '46-marques.html', icon: 'i-tag', label: 'Solution — les marques' },   // (23/09) dossier, déclaration, contrat, validation, quota
        { file: '45-solution-paiements.html', icon: 'i-banknote', label: 'Solution — prélèvements & règlements' },   // (22/09) l'argent de la seconde ligne : arrêté, fichier SEPA, retour bancaire, virements aux marques
      ],
    },
    {
      label: 'Finance', key: 'finance',
      items: [
        { file: '21-compte-resultat.html', icon: 'i-coin', label: 'Compte de résultat' },
        { file: '07-tresorerie.html', icon: 'i-landmark', label: 'Trésorerie' },
        { file: '08-finance.html', icon: 'i-banknote', label: 'Suivi financier' },
        { file: '14-comptabilite.html', icon: 'i-file', label: 'Comptabilité & TVA' },
        /* (18/09, soir — l'agent de caisse mobile est abandonné) TROIS ENTRÉES DE CE GROUPE ONT DISPARU :
             · « Fonds & relevés de caisse » (33) — le fond de caisse remis de main en main à l'agent à sa prise
               de poste et repris en fin de service : il n'y a plus de caisse à confier ;
             · « Masse salariale & paie » (15) — le salaire, les charges et les bulletins des agents salariés ;
             · « Rapprochement bancaire » (32) — il ne rapprochait que deux circuits d'agent, les dépôts d'espèces
               contre le rapport Cash Services et le complément carte de son terminal contre le relevé CB. Les deux
               ont disparu, et l'écran n'avait rien d'autre à rapprocher : les versements des deux prestataires
               (prélèvement sur la carte des commerces, paiement en ligne) n'ont pas encore de relevé au data-layer.
           L'argent des espèces arrive maintenant par la carte des commerces partenaires (29) ; celui de PayEnCash
           Solution par le prélèvement SEPA des points de vente (45) ; il se suit poche par poche en Trésorerie (07). */
      ],
    },
    {
      label: 'Clients & support', key: 'support',
      items: [
        { file: '39-clients.html', icon: 'i-user', label: 'Clients Mode — comptes' },
        { file: '18-fiche-client.html', icon: 'i-user', label: 'Fiche client (support)' },
        { file: '09-appels.html', icon: 'i-headset', label: 'Centre d’appels' },
        { file: '27-assistance-reclamations.html', icon: 'i-shield', label: 'Assistance & réclamations' },
        { file: '23-appels-commerciaux.html', icon: 'i-headset', label: 'Appels commerciaux' },
        { file: '16-communications.html', icon: 'i-mail', label: 'Communications' },
      ],
    },
    {
      label: 'Administration', key: 'admin',
      items: [
        { file: '40-comptes.html', icon: 'i-user', label: 'Comptes & accès (tous espaces)' },
        { file: '42-verifications.html', icon: 'i-shield', label: 'Vérifications KYC / KYB' },
        { file: '17-comptes-manager.html', icon: 'i-users', label: 'Comptes manager' },
        { file: '10-configuration.html', icon: 'i-edit', label: 'Configuration' },
        { file: '31-comptes-demo.html', icon: 'i-lock', label: 'Accès & comptes démo' },
      ],
    },
  ];

  // SESSION MANAGER (audit 03/09 — zéro-dur) : le pied nommait « Emilie R. · administratrice » EN DUR,
  // quelle que soit la session. Il lit désormais PEC_DATA.session() : la session n'est « manager » que si
  // son espace contient « Manager » (une session fournisseur/partenaire ouverte dans le même navigateur n'est
  // JAMAIS prise pour le manager — règle appliquée à tout acteur d'action manager : PEC_MGR.acteur()).
  function sessionManager() {
    try {
      var s = window.PEC_DATA && PEC_DATA.session ? PEC_DATA.session() : null;
      return s && /Manager/.test(String(s.espace || '')) ? s : null;
    } catch (e) { return null; }
  }
  function sessionQuelconque() {
    try { return window.PEC_DATA && PEC_DATA.session ? PEC_DATA.session() : null; } catch (e) { return null; }
  }
  // (11/09) l'échappement du data-layer — celui-ci oubliait le guillemet, donc ne protégeait pas un attribut
  function escapeHtml(s) { return (window.PEC_DATA && PEC_DATA.esc) ? PEC_DATA.esc(s) : String(s == null ? '' : s); }
  function foot() {
    var s = sessionManager();
    var qui = s ? escapeHtml((s.role ? s.role + ' · ' : '') + s.identifiant) : 'Aucune session manager';
    // « Se déconnecter » = PEC_DATA.compteDeconnecter() (protocole unique de compte) — purge la session
    // ET les clés de l'espace métier ouvert ; l'ancien appel `deconnecter()` ne faisait que la moitié.
    return 'Espace manager · v2.0<br>' + qui +
      '<a class="pec-aside-logout" href="01-connexion.html" onclick="try{window.PEC_DATA&&(PEC_DATA.compteDeconnecter?PEC_DATA.compteDeconnecter():PEC_DATA.deconnecter())}catch(e){}">' +
      '<svg class="pec-ico" viewBox="0 0 24 24"><use href="#i-power"/></svg>Se déconnecter</a>';
  }

  // UTILITAIRES PARTAGÉS DES ÉCRANS MANAGER (une seule source, chargée par tous les écrans à barre latérale)
  window.PEC_MGR = {
    // l'acteur d'une action manager : l'identifiant de la session SI elle est manager, sinon « manager (démo) »
    acteur: function () { var s = sessionManager(); return s ? s.identifiant : 'manager (démo)'; },
    sessionManager: sessionManager,
    // EXPORT CSV RÉEL (les boutons « Exporter » n'avaient aucun handler) : fichier téléchargé, dérivé des
    // données passées par l'écran, et journalisé sur le bus (evt `export`, acteur) — « chaque export est journalisé ».
    csv: function (nom, entetes, lignes) {
      var esc = function (v) { v = v == null ? '' : String(v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
      var txt = '\ufeff' + [entetes].concat(lignes || []).map(function (l) { return l.map(esc).join(';'); }).join('\n');
      /* (11/09) « chaque export est journalisé » : encore faut-il qu'il ait eu lieu. L'échec du téléchargement
         était avalé, et le journal portait quand même la ligne « export » — un registre qui atteste d'une
         sortie de données qui n'est jamais partie. */
      var parti = true;
      try {
        var a = document.createElement('a');
        a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(txt);
        a.download = nom + '.csv';
        document.body.appendChild(a); a.click(); a.remove();
      } catch (e) { parti = false; }
      if (!parti) return null;
      try { if (window.PEC_BUS && PEC_BUS.noter) PEC_BUS.noter('export', nom, { par: this.acteur(), lignes: (lignes || []).length }); } catch (e2) {}
      return txt;
    }
  };

  // GARDE DE SESSION (audit 03/09) : aucun écran manager ne vérifiait la session. Bandeau discret en tête
  // de l'écran — SANS redirection (les tests chargent les pages sans session) : « Session manager absente —
  // se connecter », ou « session d'un autre espace » quand un fournisseur/partenaire est connecté à la place.
  function garde() {
    var id = 'pec-garde-session';
    var old = document.getElementById(id); if (old) old.remove();
    if (sessionManager()) return;
    var autre = sessionQuelconque();
    var div = document.createElement('div');
    div.id = id;
    div.setAttribute('role', 'status');
    div.style.cssText = 'display:flex;align-items:center;gap:10px;margin:0 0 14px;padding:9px 14px;border-radius:12px;background:var(--color-amber-well,#FFF4E0);color:var(--color-amber-text,#8A5A10);font-size:12.5px;font-weight:600';
    div.innerHTML = '<svg class="pec-ico" viewBox="0 0 24 24"><use href="#i-alert"/></svg><span>' +
      (autre ? 'Session « ' + escapeHtml(autre.espace || '') + ' » (' + escapeHtml(autre.identifiant || '') + ') ouverte — cet espace est réservé au manager. '
             : 'Session manager absente — ') +
      '<a href="01-connexion.html" style="color:inherit;font-weight:800">se connecter</a></span>';
    try {
      var main = document.querySelector('.pec-main');
      if (main) main.insertBefore(div, main.firstChild); else document.body.insertBefore(div, document.body.firstChild);
    } catch (e) {}
  }

  function icon(id) {
    return '<svg class="pec-ico" viewBox="0 0 24 24"><use href="#' + id + '"/></svg>';
  }

  function currentFile() {
    var parts = window.location.pathname.split('/');
    return decodeURIComponent(parts[parts.length - 1] || '');
  }

  function render(aside) {
    var here = currentFile();
    var html =
      /* (21/09, fondatrice : « P générique ») la marque du back-office : le P et le nom écrit, plus un billet et « PayEnCash » */
      '<div class="pec-aside-brand">' + ((window.PEC_DATA && PEC_DATA.marqueHTML) ? '<span class="pec-marque pec-marque--sombre">' + PEC_DATA.marqueHTML('manager') + '</span>' : 'PayEnCash') + '</div>';

    // état d'ouverture mémorisé (localStorage) ; le groupe de l'écran courant est toujours ouvert
    var ouverts = {}; try { ouverts = JSON.parse(localStorage.getItem('pec-manager-nav-ouverts') || '{}') || {}; } catch (e) {}
    GROUPS.forEach(function (group) {
      var contientActif = group.items.some(function (it) { return it.file === here; });
      var open = contientActif || ouverts[group.key] === true;
      html += '<button type="button" class="pec-aside-group pec-aside-group--btn' + (open ? ' is-open' : '') + '" data-grp="' + group.key + '" aria-expanded="' + (open ? 'true' : 'false') + '">' +
        escapeHtml(group.label) + '<span class="pec-aside-chev" aria-hidden="true">›</span></button>';
      html += '<div class="pec-aside-items" data-grp-items="' + group.key + '"' + (open ? '' : ' hidden') + '>';
      group.items.forEach(function (item) {
        var active = item.file === here;
        // Le compteur de non-lues est annoncé au lecteur d'écran : une pastille purement
        // visuelle ne dit rien à qui ne la voit pas.
        var badge = item.badge
          ? '<span class="pec-aside-badge" aria-label="' + item.badge + ' non lues">' + item.badge + '</span>'
          : '';
        // L'écran courant garde un lien inerte : un lien vers soi-même relance un
        // chargement pour rien et fait clignoter la page.
        html +=
          '<a href="' + (active ? '#' : item.file) + '"' +
          (active ? ' aria-current="page"' : '') + '>' +
          icon(item.icon) + escapeHtml(item.label) + badge + '</a>';
      });
      html += '</div>';
    });

    html += '<div class="pec-aside-foot">' + foot() + '</div>';
    aside.innerHTML = html;
    // repli / dépli au clic sur l'en-tête de groupe (mémorisé) — navigation « facile » : 7 domaines, pas 40 lignes
    aside.addEventListener('click', function (e) {
      var b = e.target.closest('.pec-aside-group--btn'); if (!b) return;
      var key = b.getAttribute('data-grp'), items = aside.querySelector('[data-grp-items="' + key + '"]');
      var open = items.hasAttribute('hidden');
      if (open) items.removeAttribute('hidden'); else items.setAttribute('hidden', '');
      b.classList.toggle('is-open', open); b.setAttribute('aria-expanded', open ? 'true' : 'false');
      try { var o = JSON.parse(localStorage.getItem('pec-manager-nav-ouverts') || '{}') || {}; o[key] = open; localStorage.setItem('pec-manager-nav-ouverts', JSON.stringify(o)); } catch (err) {}
    });
    // styles minimaux du groupe repliable (une seule source : ici)
    if (!document.getElementById('pec-aside-groups-css')) {
      var st = document.createElement('style'); st.id = 'pec-aside-groups-css';
      st.textContent = '.pec-aside-group--btn{display:flex;align-items:center;justify-content:space-between;width:100%;background:none;border:0;cursor:pointer;text-align:left;font:inherit;color:inherit}' +
        '.pec-aside-group--btn .pec-aside-chev{font-size:16px;line-height:1;transition:transform .18s;opacity:.7}' +
        '.pec-aside-group--btn.is-open .pec-aside-chev{transform:rotate(90deg)}' +
        '.pec-aside-items[hidden]{display:none}';
      document.head.appendChild(st);
    }
  }

  function mount() {
    var nodes = document.querySelectorAll('[data-pec-nav]');
    for (var i = 0; i < nodes.length; i++) render(nodes[i]);
    garde();
    // la session change dans un autre onglet (connexion / déconnexion) → bandeau et pied se mettent à jour
    window.addEventListener('storage', function (e) {
      if (e && e.key && e.key !== 'pec-session') return;
      garde();
      for (var j = 0; j < nodes.length; j++) { var f = nodes[j].querySelector('.pec-aside-foot'); if (f) f.innerHTML = foot(); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
