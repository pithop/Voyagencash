/* ──────────────────────────────────────────────────────────────────────────────
   PEC_SAT — « NOTE TON ÉCHANGE » côté CLIENT (08/09 — boucle hotline)
   Le questionnaire post-échange est ENVOYÉ par SMS (PEC_DATA.satisfactionDemander,
   canal ref.hotline.satisfactionCanal) à la fin de chaque appel passé et de chaque
   demande close. Le client le retrouve ICI, dans son app : une carte par
   questionnaire EN ATTENTE (PEC_DATA.satisfactionEnAttente), 5 notes, une raison.
   Sa réponse fait foi : note ≤ ref.hotline.satisfactionSeuilReclamation → une
   réclamation s'ouvre AUTOMATIQUEMENT (PEC_DATA.satisfactionAjouter) et la carte
   le DIT (« Ta note a ouvert la réclamation REC-… »).
   Une seule écriture pour Fly (ecrans/14-assistance) et Mode (mode/22-livraisons) :
   avant, la promesse du SMS n'avait aucune retombée côté client.
   Usage : PEC_SAT.carte('mon-hote', { client: <objet|fonction>, onDone: fn }).
   ────────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  function D() { return window.PEC_DATA || null; }
  // (11/09) l'échappement du data-layer : une seule règle pour toute la maquette
  function esc(x) { return (window.PEC_DATA && PEC_DATA.esc) ? PEC_DATA.esc(x) : String(x == null ? '' : x); }
  // le seuil de réclamation vient du référentiel — jamais écrit dans une page
  function seuil() {
    var d = D(); return (((d && d.ref) || {}).hotline || {}).satisfactionSeuilReclamation || 0;
  }
  function nomDe(c) {
    if (!c) return null;
    if (typeof c === 'string') return c;
    return c.nomComplet || ((c.prenom || '') + ' ' + (c.nom || '')).trim() || c.nom || null;
  }
  // le client par défaut : la session cliente, sinon le profil hydraté
  function clientDefaut() {
    var d = D(); if (!d) return null;
    return (d.clientCourant && d.clientCourant()) || { nomComplet: (d.profil || {}).nomComplet };
  }

  function carteHTML(q) {
    var s = seuil(), quoi = q.appelId ? 'ton appel' : 'ta demande';
    var lien = q.ref || q.appelId || q.demandeId || '';
    var notes = [1, 2, 3, 4, 5].map(function (n) {
      return '<button type="button" class="tap" data-sat-note="' + n + '" aria-pressed="false" aria-label="Note ' + n + ' sur 5"'
        + ' style="flex:1;min-width:38px;border:0;border-radius:11px;padding:9px 0;font-size:13.5px;font-weight:800;cursor:pointer;'
        + 'background:var(--color-segment);color:var(--color-ink)">' + n + '</button>';
    }).join('');
    return '<div data-sat-id="' + esc(q.id) + '" style="border-radius:14px;background:var(--color-card);box-shadow:var(--shadow-card);padding:12px 13px;margin-bottom:9px">'
      + '<div style="font-size:12.5px;font-weight:800;color:var(--color-ink)">Note ton échange</div>'
      + '<div style="font-size:11px;color:var(--color-muted);margin:2px 0 9px">Un SMS de notation t\'a été envoyé (' + esc(q.canal || '') + ') — note ' + quoi
      + (lien ? ' <b>' + esc(lien) + '</b>' : '') + '.</div>'
      + '<div style="display:flex;gap:6px;margin-bottom:8px">' + notes + '</div>'
      + '<input type="text" data-sat-raison placeholder="Dis-nous pourquoi (facultatif)" aria-label="Raison de ta note"'
      + ' style="width:100%;box-sizing:border-box;border:0;border-radius:11px;background:var(--color-segment);color:var(--color-ink);font-size:12px;padding:9px 11px">'
      + (s ? '<div data-sat-hint style="font-size:10.5px;color:var(--color-muted);margin-top:5px">Une raison est demandée si ta note est de ' + s + '/5 ou moins : elle ouvre une réclamation suivie par un conseiller.</div>' : '')
      + '<button type="button" class="tap" data-sat-envoyer style="margin-top:9px;border:0;border-radius:999px;background:var(--color-mint);color:var(--color-primary-dark);font-size:11.5px;font-weight:800;padding:8px 14px;cursor:pointer">Envoyer ma note</button>'
      + '<div data-sat-msg style="font-size:11px;margin-top:6px"></div>'
      + '</div>';
  }
  // la carte répondue reste à l'écran et DIT ce qui s'est passé (la réponse a quitté « en attente »)
  function merciHTML(m) {
    return '<div style="border-radius:14px;background:var(--color-card);box-shadow:var(--shadow-card);padding:11px 13px;margin-bottom:9px">'
      + '<div style="font-size:12px;font-weight:800;color:var(--color-primary-dark)">' + esc(m) + '</div></div>';
  }

  var PEC_SAT = {
    /* rend la ou les cartes de notation dans #hoteId ; repeint sur pec-bus / storage */
    carte: function (hoteId, opts) {
      opts = opts || {};
      var hote = typeof hoteId === 'string' ? document.getElementById(hoteId) : hoteId;
      var d = D();
      if (!hote || !d || !d.satisfactionEnAttente || !d.satisfactionAjouter) return null;
      var dits = {};   // q.id → message de confirmation, gardé au travers des repeints

      function client() {
        var c = typeof opts.client === 'function' ? opts.client() : opts.client;
        return c || clientDefaut();
      }
      function rendre() {
        var c = client();
        var l = [];
        try { l = d.satisfactionEnAttente(c) || []; } catch (e) { l = []; }
        var html = Object.keys(dits).map(function (k) { return merciHTML(dits[k]); }).join('')
          + l.map(carteHTML).join('');
        hote.innerHTML = html;
        hote.style.display = html ? '' : 'none';
      }

      hote.addEventListener('click', function (ev) {
        var carte = ev.target.closest ? ev.target.closest('[data-sat-id]') : null;
        if (!carte) return;
        var bn = ev.target.closest('[data-sat-note]');
        if (bn) {
          carte.querySelectorAll('[data-sat-note]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
          bn.setAttribute('aria-pressed', 'true');
          return;
        }
        if (!ev.target.closest('[data-sat-envoyer]')) return;
        var msg = carte.querySelector('[data-sat-msg]');
        var choisi = carte.querySelector('[data-sat-note][aria-pressed="true"]');
        if (!choisi) { msg.style.color = 'var(--color-danger)'; msg.textContent = 'Choisis une note de 1 à 5.'; return; }
        var note = parseInt(choisi.getAttribute('data-sat-note'), 10);
        var raison = (carte.querySelector('[data-sat-raison]') || {}).value || '';
        var s = seuil();
        if (s && note <= s && !String(raison).trim()) {
          msg.style.color = 'var(--color-danger)';
          msg.textContent = 'Dis-nous ce qui n\'a pas été : la raison est obligatoire à ' + s + '/5 ou moins.';
          return;
        }
        var id = carte.getAttribute('data-sat-id');
        var q = (d.satisfactionDemandesGet ? d.satisfactionDemandesGet() : []).filter(function (x) { return x.id === id; })[0] || {};
        var r = d.satisfactionAjouter({ appelId: q.appelId || null, demandeId: q.demandeId || null, ref: q.ref || null,
          note: note, raison: raison, client: q.client || nomDe(client()) }, 'client');
        if (!r || !r.ok) { msg.style.color = 'var(--color-danger)'; msg.textContent = (r && r.motif) || 'Note non enregistrée.'; return; }
        dits[id] = r.reponse.reclamationId
          ? 'Ta note a ouvert la réclamation ' + r.reponse.reclamationId + ' — un conseiller te recontacte.'
          : 'Merci — ta note de ' + note + '/5 est enregistrée, l\'échange est clos.';
        rendre();
        if (typeof opts.onDone === 'function') opts.onDone(r.reponse);
      });

      window.addEventListener('pec-bus', rendre);
      window.addEventListener('storage', rendre);
      rendre();
      return { rendre: rendre };
    }
  };

  window.PEC_SAT = PEC_SAT;
})();
