/* ══ PAYENCASH SOLUTION — LE BOUTON « BON D'ACHAT DE LA MARQUE » (19/09, nuit ; 23/09 : vocabulaire) ═════════
   Décision fondatrice : « lorsque le e-commerce l'ajoute, il doit automatiquement avoir la page avec Comment tu
   paies : tu as un bon, chez un partenaire, un agent se déplace — c'est notre marque de fabrique. »
   (23/09, fondatrice : « attention au vocabulaire juridique ») CE N'EST PAS UN WIDGET DE PAIEMENT : PayEnCash n'est
   pas un moyen de paiement. Le bouton PROPOSE au client un bon d'achat DE LA MARQUE, du montant de sa commande ;
   le client l'achète au comptoir du réseau, et l'utilise chez la marque depuis l'app Mes bons.

   CE QUE LE COMMERÇANT COLLE CHEZ LUI, et rien d'autre :
     <script src="…/ui/tech/payencash-tech-widget.js"></script>
     <div data-payencash="pk_…" data-montant="49.90" data-commande="CMD-2026-001"></div>

   CE QUE ÇA FAIT : un bouton « Bon d'achat {marque} » à côté de ses moyens de paiement ; au clic, une fenêtre
   qui montre NOTRE page du bon proposé pour cette commande.
   (21/09, fondatrice : « lorsqu'il clique sur PayEnCash Technologie, la modale qui s'ouvre doit être celle
   COMMENT PAYER, en sachant que c'est pour la boutique connectée ») LA FENÊTRE NE REFAIT PLUS LE CHOIX. Elle en
   portait une copie à elle — des émojis, une liste de noms, ni carte ni recherche — et un défaut : un bon plus
   petit que la commande y affichait « ta commande est réglée ». Elle montre désormais, dans un cadre, la page
   du bon proposé pour CETTE commande (07-lien) : où l'acheter (le trio de Mode et de Fly, appliqué au réseau),
   et l'app Mes bons pour l'utiliser. Le cadre est la façon ordinaire d'intégrer une page tierce : notre page
   reste la nôtre — notre marque, nos règles — et aucun code de bon ne se tape dans la page de la marque.

   CE QUE ÇA NE FAIT PAS, ET NE FERA JAMAIS : encaisser. Aucun champ de carte, aucun montant qui transite,
   aucun appel de paiement. Le client achète son bon à un commerce du réseau (qui en reçoit le prix pour son
   propre compte) et l'utilise depuis l'app Mes bons ; la page de la marque est prévenue quand sa commande est
   couverte — c'est son serveur qui vérifie, avec sa clé secrète.

   LA CLÉ PUBLIQUE SUFFIT, et ne peut rien d'autre : elle identifie la marque et ouvre le bon proposé de SA
   commande (un par référence — rouvrir la fenêtre le retrouve). La clé secrète ne doit JAMAIS figurer dans
   une page — le bouton ne la lit pas, ne la demande pas, et refuse de fonctionner avec.
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var D = window.PEC_DATA;
  /* NOTRE PAGE VIT À CÔTÉ DE CE FICHIER : son adresse se déduit de celle du script, jamais d'une valeur écrite. */
  var ICI = (document.currentScript && document.currentScript.src) ? document.currentScript.src.replace(/[^/]*$/, '') : '';

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }
  function eur(v) { return D && D.eur ? D.eur(v) : (Math.round(v * 100) / 100).toFixed(2).replace('.', ',') + ' €'; }

  /* LES STYLES DU WIDGET sont posés UNE fois et portent tous un préfixe : il vit dans la page de quelqu'un
     d'autre, il n'a pas à lui imposer quoi que ce soit ni à hériter de ses règles par accident. */
  function styles() {
    if (document.getElementById('pect-css')) return;
    var s = document.createElement('style');
    s.id = 'pect-css';
    s.textContent = [
      '.pect-btn{display:flex;align-items:center;gap:10px;width:100%;border:1.5px solid #cfe0d8;border-radius:14px;background:#fff;padding:13px 14px;cursor:pointer;font:inherit;text-align:left}',
      '.pect-btn:hover{border-color:#10a06a}',
      '.pect-btn:focus-visible{outline:2px solid #0c7f54;outline-offset:2px}',
      '.pect-btn .pect-ic{flex:none;display:block;width:34px;height:34px}',
      '.pect-btn .pect-ic img{display:block;width:100%;height:100%;object-fit:contain}',
      /* le nom est du TEXTE en ligne : en inline-flex, chaque morceau (pay · En · Cash) devenait une case, et
         l'écart de la boîte s'intercalait entre eux — « pay En Cash » (21/09) */
      '.pect-btn .pect-mk{display:inline;font-weight:800;font-size:14px;color:#0f2a24}',
      '.pect-btn .pect-mk em{font-style:normal;color:#10a06a}',
      '.pect-btn small{display:block;font-size:11.5px;line-height:1.45;color:#5d7570;margin-top:2px}',
      /* (20/09, soir — décision fondatrice : « ça doit être TOUJOURS LA MÊME ANIMATION ») LA MÊME OUVERTURE
         QUE NOS ÉCRANS : le fond se voile, la feuille monte de douze pixels. Les images sont RECOPIÉES ici
         — ce widget vit dans la page d'un commerçant, il n'a pas notre feuille de style et ne doit rien lui
         demander — mais la courbe et les durées sont celles du socle (pecVoile / pecModale), au millième. */
      '@keyframes pectVoile{from{opacity:0}to{opacity:1}}',
      '@keyframes pectModale{from{opacity:0;transform:translateY(12px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}',
      '@media (prefers-reduced-motion:reduce){@keyframes pectModale{from{opacity:0}to{opacity:1}}}',
      '.pect-scrim{position:fixed;inset:0;z-index:2147483000;background:rgba(15,42,36,.5);display:flex;align-items:center;justify-content:center;padding:18px;animation:pectVoile .18s ease-out both}',
      /* LE CADRE A LA TAILLE D'UN ÉCRAN DE TÉLÉPHONE : c'est une page de nos applications qui s'y affiche. */
      '.pect-mod{position:relative;width:100%;max-width:420px;height:min(760px,92vh);background:#fff;border-radius:22px;overflow:hidden;box-shadow:0 24px 60px rgba(15,42,36,.4);animation:pectModale .24s cubic-bezier(.22,.8,.3,1) both}',
      '.pect-mod iframe{display:block;width:100%;height:100%;border:0}',
      '.pect-x{position:absolute;top:9px;right:10px;z-index:2;display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border:none;border-radius:999px;background:rgba(255,255,255,.94);box-shadow:0 2px 8px rgba(15,42,36,.2);font-size:21px;line-height:1;color:#0f2a24;cursor:pointer}',
      '.pect-x:focus-visible{outline:2px solid #0c7f54;outline-offset:2px}',
      /* SUR UN TÉLÉPHONE, LA FENÊTRE MONTE DU BAS et prend l'écran : c'est la forme qu'on y attend. */
      '@media (max-width:480px){.pect-scrim{padding:0;align-items:flex-end}.pect-mod{max-width:none;height:94vh;border-radius:22px 22px 0 0}}',
      '.pect-msg{margin:9px 0 0;font-size:12px;line-height:1.5;border-radius:12px;padding:10px 12px}',
      '.pect-msg.ko{background:#fdecea;color:#8e2a1e;font-weight:700}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function marque() { return '<span class="pect-mk">pay<em>En</em>Cash <span style="font-weight:700">Solution</span></span>'; }
  /* (21/09, fondatrice : « intègre le logo sur PayEnCash Technologie ; tu utilises le P avec le shop ») LE SYMBOLE
     DE LA MARQUE — le P au sac — remplace le bouclier dessiné ici. Il est servi par NOUS, à côté de notre page de
     bon proposé (même dossier que ce script, `ICI`) : la page de la marque n'a rien à héberger. */
  var SYMBOLE = '<img src="' + ICI + '../assets/logos/payencash-solution-symbole.webp" alt="" width="34" height="34">';

  /* ══ LA FENÊTRE — notre page du bon proposé, dans un cadre ═══════════════════════════════════════════ */
  function ouvrir(ctx) {
    var r = D.techLienPourCommande({ marchandId: ctx.marchand.id, montant: ctx.montant, reference: ctx.commande });
    if (!r.ok) {
      /* ON NE MONTRE PAS UNE FENÊTRE VIDE : le refus se dit sous le bouton, avec son motif. */
      var e = ctx.hote.querySelector('.pect-msg') || document.createElement('div');
      e.className = 'pect-msg ko'; e.textContent = r.motif;
      ctx.hote.appendChild(e);
      return;
    }
    var retour = document.activeElement;
    var scrim = document.createElement('div');
    scrim.className = 'pect-scrim';
    scrim.setAttribute('role', 'dialog');
    scrim.setAttribute('aria-modal', 'true');
    scrim.setAttribute('aria-label', 'Bon d’achat ' + ctx.marchand.raisonSociale + ' — PayEnCash Solution');
    var mod = document.createElement('div');
    mod.className = 'pect-mod';
    var x = document.createElement('button');
    x.type = 'button'; x.className = 'pect-x'; x.setAttribute('aria-label', 'Fermer'); x.innerHTML = '&times;';
    var f = document.createElement('iframe');
    f.className = 'pect-frame';
    f.title = 'Ton bon d’achat ' + ctx.marchand.raisonSociale + ' — PayEnCash Solution';
    f.src = ICI + '07-lien.html?l=' + encodeURIComponent(r.lien.slug) + '&integre=1';
    mod.appendChild(x); mod.appendChild(f); scrim.appendChild(mod);
    document.body.appendChild(scrim);
    var origine = null;
    try { origine = new URL(f.src, location.href).origin; } catch (e2) {}

    function fermer() {
      window.removeEventListener('message', surMessage);
      document.removeEventListener('keydown', surTouche);
      scrim.remove();
      if (retour && retour.focus) retour.focus();
    }
    function surTouche(e) { if (e.key === 'Escape') fermer(); }
    /* ON N'ÉCOUTE QUE NOTRE CADRE : même fenêtre, même origine. Et ce qu'il dit est une information pour le
       tunnel de la marque, pas une preuve — son serveur vérifie le bon proposé avec sa clé secrète. */
    function surMessage(e) {
      if (e.source !== f.contentWindow || e.origin !== origine) return;
      var m = e.data || {};
      if (m.source !== 'payencash-solution') return;
      if (m.type === 'fermer') { fermer(); return; }
      /* (23/09) « COUVERT », pas « payé » : la commande de la marque est couverte par ses bons — nous n'avons rien
         réglé, nous le lui disons. */
      if (m.type === 'couvert') {
        try {
          ctx.hote.dispatchEvent(new CustomEvent('payencash:couvert', { bubbles: true,
            detail: { commande: m.commande, montant: m.montant, bons: m.bons || [], offre: m.offre, marchand: m.marchand } }));
        } catch (e3) {}
      }
    }
    window.addEventListener('message', surMessage);
    document.addEventListener('keydown', surTouche);
    x.addEventListener('click', fermer);
    scrim.addEventListener('click', function (e) { if (e.target === scrim) fermer(); });
    x.focus();
  }

  /* ══ LE MONTAGE — un bouton par emplacement déclaré ══════════════════════════════════════════════════ */
  function monter(hote) {
    if (hote.getAttribute('data-pect-monte') === '1') return;
    hote.setAttribute('data-pect-monte', '1');
    var pk = hote.getAttribute('data-payencash') || '';
    var montant = Math.round((parseFloat(String(hote.getAttribute('data-montant') || '').replace(',', '.')) || 0) * 100) / 100;
    var commande = hote.getAttribute('data-commande') || null;

    /* LA CLÉ SECRÈTE N'A RIEN À FAIRE DANS UNE PAGE : si on en voit une, on refuse net et on le dit. */
    if (/^sk_/.test(pk)) {
      hote.innerHTML = '<div class="pect-msg ko">Clé SECRÈTE dans la page : PayEnCash Solution refuse de démarrer. '
        + 'Utilise ta clé publique (pk_…) ici, et garde la clé secrète sur ton serveur.</div>';
      return;
    }
    var m = null;
    try { m = (D.techMarchands() || []).filter(function (x) { return (D.techCles(x.id) || []).some(function (c) { return c.clePublique === pk && !c.revoqueLe; }); })[0] || null; } catch (e) {}
    if (!m) {
      hote.innerHTML = '<div class="pect-msg ko">Clé publique inconnue ou révoquée — vérifie-la dans ton espace PayEnCash Solution.</div>';
      return;
    }
    if (!(montant > 0)) {
      hote.innerHTML = '<div class="pect-msg ko">Aucun montant (data-montant) — le bouton ne s’affiche pas.</div>';
      return;
    }
    if (!commande) {
      hote.innerHTML = '<div class="pect-msg ko">Aucune référence de commande (data-commande) — c’est elle qui retrouve le bon proposé.</div>';
      return;
    }
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pect-btn';
    b.innerHTML = '<span class="pect-ic">' + SYMBOLE + '</span><span style="min-width:0;flex:1">' + marque()
      /* (21/09) le slogan unifié (ref.marque.slogan), puis ce que le bouton propose — un bon d'achat de CETTE marque */
      + '<small>' + esc(D.slogan ? D.slogan() : '') + ' · bon d’achat ' + esc(m.raisonSociale) + '</small></span>'
      + '<span style="flex:none;font-weight:800;font-size:13.5px">' + esc(eur(montant)) + '</span>';
    b.addEventListener('click', function () { ouvrir({ marchand: m, montant: montant, commande: commande, hote: hote }); });
    hote.innerHTML = '';
    hote.appendChild(b);
  }

  function demarrer() {
    if (!window.PEC_DATA || !window.PEC_DATA.techLienPourCommande) {
      /* SANS LE DATA-LAYER, ON NE FAIT PAS SEMBLANT : le widget le dit à l'intégrateur, dans sa page. */
      [].forEach.call(document.querySelectorAll('[data-payencash]'), function (h) {
        h.textContent = 'PayEnCash Solution : la couche de données n’est pas chargée sur cette page.';
      });
      return;
    }
    D = window.PEC_DATA;
    styles();
    [].forEach.call(document.querySelectorAll('[data-payencash]'), monter);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
